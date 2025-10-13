"use client";

import { Observable, Subject, BehaviorSubject, share } from "rxjs";
import {
	createWebSocketClient,
	type WebSocketClient,
	type WebSocketMessage,
	type WSMessage,
	type RoomMessage,
	type RoomStatusUpdateMessage,
	type RoomStatusUpdatePayload,
	type RoomInfo,
	type AirConCommand,
	type AirConState,
	type DeviceStateMessage,
	type DeviceDiscoveryMessage,
} from "@/lib/websocket";
import { MODE_VALUES } from "@/lib/mqtt/mqtt-config";
import { ConnectionStatus } from "@/types/navigation";
import { websocketConfigManager } from "@/lib/config/websocket-config";

export class WebSocketApiClient {
	private wsClient: WebSocketClient | null = null;
	private messageSubject: Subject<WSMessage> = new Subject<WSMessage>();
	private deviceStateSubject = new Subject<DeviceStateMessage>();
	private deviceDiscoverySubject = new Subject<DeviceDiscoveryMessage>();
	private connectionStatus = new BehaviorSubject<boolean>(false);
	private detailedConnectionStatus = new BehaviorSubject<
		ConnectionStatus["websocket"]
	>({
		state: "disconnected",
		lastConnected: null,
		reconnectAttempts: 0,
	});
	private lastMqttStatus = new BehaviorSubject<ConnectionStatus["mqtt"]>({
		state: "unknown",
		lastUpdate: null,
	});

	private wsUrl: string | null = null;

	constructor() {
		this.wsUrl = this.getConfiguredWebSocketUrl();
	}

	/**
	 * Connect to WebSocket server and return observable stream
	 * @param roomId - The room ID to connect to (required for airconditioner endpoint)
	 * @param setIsConnected - Callback to update connection status
	 */
	connect(
		roomId: string,
		setIsConnected: (connected: boolean) => void
	): Observable<WSMessage> {
		this.ensureActiveSubjects();
		console.log("WebSocketApiClient: Starting connection to", this.wsUrl, "for room:", roomId);

		if (!this.wsUrl) {
			console.error("WebSocket URL not configured");
			return this.messageSubject.asObservable().pipe(share());
		}

		if (!roomId) {
			console.error("WebSocket connection requires roomId parameter");
			return this.messageSubject.asObservable().pipe(share());
		}

		const initializeConnection = async () => {
			try {
				// Get authentication token from auth store
				const { useAuthStore } = await import('@/stores/auth-store');
				const accessToken = await useAuthStore.getState().getValidAccessToken();

				if (!accessToken) {
					console.error('🔑 No access token available - redirecting to login');
					const { redirectToLogin } = await import('@/lib/auth/auth-client');
					redirectToLogin(window.location.pathname);
					return;
				}

				console.log('🔑 Retrieved access token for WebSocket authentication');

				// Append roomId and token to WebSocket URL
				const authenticatedUrl = `${this.wsUrl}?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(accessToken)}`;
				console.log("WebSocketApiClient: Connecting with authentication to", authenticatedUrl);

				// Create simple WebSocket client
				this.wsClient = createWebSocketClient(authenticatedUrl, {
					debug: process.env.NODE_ENV === "development",
					maxReconnectAttempts: 10,
					reconnectInterval: 2000,
				});

				// Subscribe to room messages
				this.wsClient.subscribe("room", (message: WebSocketMessage) => {
					try {
						// Convert new WebSocket message format to legacy format
						const wsMessage: WSMessage =
							this.convertToLegacyFormat(message);
						this.messageSubject.next(wsMessage);
					} catch (error) {
						console.error("Error converting message:", error);
					}
				});

				// Subscribe to device messages
				this.wsClient.subscribe("device", (message: WebSocketMessage) => {
					try {
						if (this.isDeviceStateMessage(message)) {
							this.deviceStateSubject.next(message);
						} else if (this.isDeviceDiscoveryMessage(message)) {
							this.deviceDiscoverySubject.next(message);
						}
					} catch (error) {
						console.error("Error handling device message:", error);
					}
				});

				// Subscribe to unified room status updates
				this.wsClient.subscribe("ROOM_STATUS_UPDATE", (message: WebSocketMessage) => {
					console.log('[WebSocketApiClient] ROOM_STATUS_UPDATE subscription triggered:', message);
					try {
						const wsMessage = this.convertToLegacyFormat(message);
						console.log('[WebSocketApiClient] Converted to legacy format:', wsMessage);
						this.messageSubject.next(wsMessage);
						console.log('[WebSocketApiClient] Emitted to messageSubject');
					} catch (error) {
						console.error("Error handling room status update message:", error);
					}
				});

				// Connect to server
				await this.wsClient.connect();

				// Update connection status
				setIsConnected(true);
				this.connectionStatus.next(true);
				this.detailedConnectionStatus.next({
					state: "connected",
					lastConnected: Date.now(),
					reconnectAttempts: 0,
				});

				console.log("WebSocketApiClient: Connected successfully");

				// Monitor connection status
				const checkConnection = setInterval(() => {
					if (this.wsClient) {
						const isConnected = this.wsClient.isConnected;
						if (isConnected !== this.connectionStatus.value) {
							setIsConnected(isConnected);
							this.connectionStatus.next(isConnected);

							if (isConnected) {
								this.detailedConnectionStatus.next({
									state: "connected",
									lastConnected: Date.now(),
									reconnectAttempts: 0,
								});
							} else {
								this.detailedConnectionStatus.next({
									state: "disconnected",
									lastConnected:
										this.detailedConnectionStatus.value
											.lastConnected,
									reconnectAttempts:
										this.detailedConnectionStatus.value
											.reconnectAttempts + 1,
								});
							}
						}
					}
				}, 1000);

				return () => {
					clearInterval(checkConnection);
				};
			} catch (error) {
				console.error("WebSocketApiClient: Connection failed:", error);
				setIsConnected(false);
				this.connectionStatus.next(false);
				this.detailedConnectionStatus.next({
					state: "disconnected",
					lastConnected: null,
					reconnectAttempts: 0,
				});
			}
		};

		initializeConnection();

		return this.messageSubject.asObservable().pipe(share());
	}

	/**
	 * Convert new WebSocket message format to legacy format for compatibility
	 */
	private convertToLegacyFormat(message: WebSocketMessage): WSMessage {
		switch (message.type) {
			case "room":
				if (this.isRoomMessage(message)) {
					const payload = message.payload;
					if (payload.command === "update" && payload.data) {
						return {
							type: "room-state",
							roomId: message.roomId,
							data: this.isAirConState(payload.data)
								? payload.data
								: null,
						};
					}
				}
				return {
					type: "room-state",
					roomId: message.roomId,
					data: null,
				};

			case "system":
				return {
					type: "mqtt-status",
					data: "connected",
				};

			case "ROOM_STATUS_UPDATE":
				if (this.isRoomStatusUpdateMessage(message)) {
					const payload = this.normalizeRoomStatusPayload(message.payload);
					return {
						type: "room-status-update",
						roomId: payload.roomId,
						data: payload,
					};
				}
				return {
					type: "room-status-update",
					roomId: message.roomId,
					data: null,
				};

			default:
				return {
					type: "command-response",
					roomId: message.roomId,
					data: this.convertPayloadToData(message.payload),
				};
		}
	}

	/**
	 * Type guard to check if message is a room message
	 */
	private isRoomMessage(message: WebSocketMessage): message is RoomMessage {
		return (
			message.type === "room" &&
			message.roomId !== undefined &&
			message.payload !== undefined &&
			typeof message.payload === "object" &&
			message.payload !== null &&
			"command" in message.payload
		);
	}

	/**
	 * Type guard to check if data is AirConState
	 */
	private isAirConState(data: unknown): data is AirConState {
		return (
			data !== null &&
			typeof data === "object" &&
			"power" in data &&
			"temperature" in data &&
			"mode" in data
		);
	}

	/**
	 * Type guard to check if message is DeviceStateMessage
	 */
	private isDeviceStateMessage(message: WebSocketMessage): message is DeviceStateMessage {
		return (
			message.type === "device" &&
			message.payload !== undefined &&
			typeof message.payload === "object" &&
			message.payload !== null &&
			"messageType" in message.payload &&
			(message.payload.messageType === "STATE" || message.payload.messageType === "SETTINGS") &&
			"deviceIdentifier" in message.payload &&
			"data" in message.payload
		);
	}

	/**
	 * Type guard to check if message is DeviceDiscoveryMessage
	 */
	private isDeviceDiscoveryMessage(message: WebSocketMessage): message is DeviceDiscoveryMessage {
		return (
			message.type === "device" &&
			message.payload !== undefined &&
			typeof message.payload === "object" &&
			message.payload !== null &&
			"messageType" in message.payload &&
			message.payload.messageType === "DEVICE_DISCOVERED" &&
			"deviceIdentifier" in message.payload &&
			"requiresRegistration" in message.payload
		);
	}

	/**
	 * Type guard to check if message is RoomStatusUpdateMessage
	 */
	private isRoomStatusUpdateMessage(
		message: WebSocketMessage
	): message is RoomStatusUpdateMessage {
		return (
			message.type === "ROOM_STATUS_UPDATE" &&
			message.payload !== undefined &&
			message.payload !== null &&
			typeof message.payload === "object" &&
			"roomId" in message.payload &&
			"roomName" in message.payload
		);
	}

	/**
	 * Convert unknown payload to valid WSMessage data type
	 */
	private convertPayloadToData(payload: unknown): RoomInfo[] | AirConState | AirConCommand | boolean | string | null {
		if (payload === null || payload === undefined) {
			return null;
		}

		if (typeof payload === 'boolean' || typeof payload === 'string') {
			return payload;
		}

		if (Array.isArray(payload)) {
			// Assume array is RoomInfo[] - this is a simplification
			return payload as RoomInfo[];
		}

		if (typeof payload === 'object') {
			// Check if it's AirConState
			if (this.isAirConState(payload)) {
				return payload;
			}

			// Check if it's AirConCommand (has field and value properties)
			if ('field' in payload && 'value' in payload) {
				return payload as AirConCommand;
			}
		}

		// Fallback to string representation
		return String(payload);
	}

	/**
	 * Normalize room status payload by ensuring optional fields are present.
	 */
	private normalizeRoomStatusPayload(payload: RoomStatusUpdatePayload): RoomStatusUpdatePayload {
		return {
			...payload,
			aggregateStatus: payload.aggregateStatus ?? null,
			deviceUpdates: payload.deviceUpdates ?? [],
			timestamp: payload.timestamp ?? new Date().toISOString(),
			state: payload.state ?? null,
			settings: payload.settings ?? null,
		};
	}

	/**
	 * Send temperature command
	 */
	async sendTemperatureCommand(
		roomId: string,
		temperature: number
	): Promise<void> {
		if (!this.wsClient || !this.wsClient.isConnected) {
			console.error("WebSocket not connected");
			return;
		}

		const message = {
			type: "SET_TEMPERATURE",
			messageId: crypto.randomUUID(),
			roomId,
			temperature,
		} as WebSocketMessage & { temperature: number };

		await this.wsClient.send(message);
		console.log(
			"WebSocketApiClient: Sent temperature command:",
			temperature
		);
	}

	/**
	 * Send mode command
	 */
	async sendModeCommand(
		roomId: string,
		mode: 'heat' | 'cool' | 'auto' | 'dry' | 'fan'
	): Promise<void> {
		if (!this.wsClient || !this.wsClient.isConnected) {
			console.error("WebSocket not connected");
			return;
		}

		const modeMapping: Record<string, string> = {
			heat_cool: "auto",
			auto: "auto",
			cool: "cool",
			heat: "heat",
			dry: "dry",
			fan: "fan",
			fan_only: "fan",
		};

		const normalizedMode = modeMapping[mode] ?? mode;

		const message = {
			type: "SET_MODE",
			messageId: crypto.randomUUID(),
			roomId,
			mode: normalizedMode,
		} as WebSocketMessage & { mode: string };

		await this.wsClient.send(message);
		console.log("WebSocketApiClient: Sent mode command:", normalizedMode);
	}

	/**
	 * Send power command
	 */
	async sendPowerCommand(roomId: string, power: "on" | "off"): Promise<void> {
		if (!this.wsClient || !this.wsClient.isConnected) {
			console.error("WebSocket not connected");
			return;
		}

		const message = {
			type: "SET_POWER",
			messageId: crypto.randomUUID(),
			roomId,
			power: power === "on",
		} as WebSocketMessage & { power: boolean };

		await this.wsClient.send(message);
		console.log("WebSocketApiClient: Sent power command:", power);
	}

	/**
	 * Disconnect from WebSocket server
	 */
	async disconnect(): Promise<void> {
		console.log("WebSocketApiClient: Disconnecting...");

		if (this.wsClient) {
			await this.wsClient.disconnect();
			this.wsClient = null;
		}

		this.connectionStatus.next(false);
		const currentDetailed = this.detailedConnectionStatus.value;
		this.detailedConnectionStatus.next({
			state: "disconnected",
			lastConnected: currentDetailed.lastConnected,
			reconnectAttempts: currentDetailed.reconnectAttempts,
		});
	}

	/**
	 * Compatibility stub for legacy room-state subscriptions.
	 *
	 * Room updates are now handled centrally within this client, so this is a no-op.
	 */
	subscribeToRoomState(_roomId: string): void {
		// Intentionally left blank
	}

	/**
	 * Whether the underlying WebSocket client is connected.
	 */
	isConnected(): boolean {
		return !!this.wsClient && this.wsClient.isConnected;
	}

	/**
	 * Force a reconnect attempt using the existing URL.
	 */
	async forceReconnect(): Promise<void> {
		if (!this.wsClient) return;
		try {
			await this.wsClient.disconnect();
			await this.wsClient.connect();
		} catch (e) {
			console.error('WebSocketApiClient: forceReconnect failed', e);
			throw e;
		}
	}

	/**
	 * Poll or refresh MQTT status.
	 * Backend does not require an explicit request; we update the local
	 * status timestamp so polling callers do not error.
	 */
	async getMqttStatus(): Promise<void> {
		const current = this.connectionStatus.value;
		this.lastMqttStatus.next({
			state: current ? 'connected' : 'unknown',
			lastUpdate: Date.now(),
		});
	}

    

	/**
	 * Get connection status observables
	 */
	getConnectionStatus() {
		return {
			isConnected$: this.connectionStatus.asObservable(),
			detailedStatus$: this.detailedConnectionStatus.asObservable(),
			mqttStatus$: this.lastMqttStatus.asObservable(),
		};
	}

	/**
	 * Get device state observable stream
	 */
	getDeviceStateStream(): Observable<DeviceStateMessage> {
		return this.deviceStateSubject.asObservable().pipe(share());
	}

	/**
	 * Get device discovery observable stream
	 */
	getDeviceDiscoveryStream(): Observable<DeviceDiscoveryMessage> {
		return this.deviceDiscoverySubject.asObservable().pipe(share());
	}

	/**
	 * Get WebSocket URL from configuration manager
	 */
	private getConfiguredWebSocketUrl(): string | null {
		try {
			const config = websocketConfigManager.getConfig();
			return config.url;
		} catch (error) {
			console.error("Failed to load WebSocket configuration:", error);
			return null;
		}
	}

	/**
	 * Ensure Subjects are ready for reuse after any previous completion.
	 */
	private ensureActiveSubjects(): void {
		if (this.messageSubject.closed) {
			this.messageSubject = new Subject<WSMessage>();
		}
	}
}

// Create and export singleton instance
export const websocketClient = new WebSocketApiClient();
