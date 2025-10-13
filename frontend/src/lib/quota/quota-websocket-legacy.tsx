import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/stores/auth-store";
import { useQuotaStore } from "@/stores/quota-store";
import {
  createWebSocketClient,
  type IWebSocketClient,
  type WebSocketMessage,
  type ConnectionState as WSConnectionState
} from "@/lib/websocket/index-new";

// WebSocket message schemas - adapted for new client system
const quotaUpdateMessageSchema = z.object({
	type: z.literal("quota"),
	messageId: z.string(),
	roomId: z.string().optional(),
	payload: z.object({
		quotaId: z.string(),
		familyMemberId: z.string(),
		roomId: z.string(),
		currentUsage: z.number(),
		dailyLimit: z.number(),
		status: z.enum(["ACTIVE", "WARNING", "EXCEEDED", "PAUSED"]),
		isCurrentlyActive: z.boolean(),
		sessionStartTime: z.string().optional(),
		estimatedSessionUsage: z.number(),
		lastUpdated: z.string(),
	}),
	timestamp: z.number().optional(),
});

const overrideRequestMessageSchema = z.object({
	type: z.literal("quota"),
	messageId: z.string(),
	roomId: z.string().optional(),
	payload: z.object({
		action: z.enum([
			"OVERRIDE_REQUEST_CREATED",
			"OVERRIDE_REQUEST_UPDATED",
			"OVERRIDE_REQUEST_EXPIRED",
		]),
		requestId: z.string(),
		quotaId: z.string(),
		familyMemberId: z.string(),
		status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
		requestType: z.enum([
			"TEMPORARY_INCREASE",
			"TIME_EXTENSION",
			"EMERGENCY_OVERRIDE",
		]),
		duration: z.number(),
		reason: z.string(),
		urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]),
		requestedAt: z.string(),
		respondedAt: z.string().optional(),
		approvedBy: z.string().optional(),
		responseReason: z.string().optional(),
	}),
	timestamp: z.number().optional(),
});

const quotaViolationAlertSchema = z.object({
	type: z.literal("quota"),
	messageId: z.string(),
	roomId: z.string().optional(),
	payload: z.object({
		action: z.literal("QUOTA_VIOLATION_ALERT"),
		quotaId: z.string(),
		familyMemberId: z.string(),
		familyMemberName: z.string(),
		roomId: z.string(),
		roomName: z.string(),
		violationType: z.enum([
			"WARNING_THRESHOLD",
			"LIMIT_EXCEEDED",
			"UNAUTHORIZED_ACCESS",
		]),
		currentUsage: z.number(),
		limit: z.number(),
		timestamp: z.string(),
	}),
	timestamp: z.number().optional(),
});

// Combine all quota message schemas using the common 'quota' type
const quotaWebSocketMessageSchema = z.union([
	quotaUpdateMessageSchema,
	overrideRequestMessageSchema,
	quotaViolationAlertSchema,
]);

// Enhanced validation for outbound messages
const outboundMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("SUBSCRIBE_QUOTA"),
		payload: z.object({
			quotaId: z.string().min(1),
		}),
	}),
	z.object({
		type: z.literal("UNSUBSCRIBE_QUOTA"),
		payload: z.object({
			quotaId: z.string().min(1),
		}),
	}),
	z.object({
		type: z.literal("REQUEST_OVERRIDE"),
		payload: z.object({
			quotaId: z.string().min(1),
			requestType: z.enum(["TEMPORARY_INCREASE", "TIME_EXTENSION", "EMERGENCY_OVERRIDE"]),
			duration: z.number().positive(),
			reason: z.string().min(1),
			urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]),
			familyMemberId: z.string().min(1),
		}),
	}),
	z.object({
		type: z.literal("APPROVE_OVERRIDE"),
		payload: z.object({
			requestId: z.string().min(1),
			approvedBy: z.string().min(1),
			actualDuration: z.number().positive().optional(),
			responseReason: z.string().optional(),
		}),
	}),
	z.object({
		type: z.literal("REJECT_OVERRIDE"),
		payload: z.object({
			requestId: z.string().min(1),
			approvedBy: z.string().min(1),
			responseReason: z.string().min(1),
		}),
	}),
]);

export type QuotaWebSocketMessage = z.infer<typeof quotaWebSocketMessageSchema>;
export type QuotaUpdateMessage = z.infer<typeof quotaUpdateMessageSchema>;
export type OverrideRequestMessage = z.infer<
	typeof overrideRequestMessageSchema
>;
export type QuotaViolationAlert = z.infer<typeof quotaViolationAlertSchema>;

interface UseQuotaWebSocketOptions {
	familyMemberId: string;
	roomId?: string;
	quotaId?: string;
	onQuotaUpdate?: (update: QuotaUpdateMessage["payload"]) => void;
	onOverrideRequest?: (request: OverrideRequestMessage) => void;
	onViolationAlert?: (alert: QuotaViolationAlert["payload"]) => void;
	onConnectionChange?: (isConnected: boolean) => void;
}

// Connection state enum to replace ReadyState
enum ConnectionState {
	CONNECTING = 0,
	OPEN = 1,
	CLOSING = 2,
	CLOSED = 3,
}

interface UseQuotaWebSocketReturn {
	connectionState: ConnectionState;
	isConnected: boolean;
	isConnecting: boolean;
	isReconnecting: boolean;
	lastMessage: QuotaWebSocketMessage | null;
	connectionError: string | null;
	retryCount: number;
	queuedMessages: number;
	sendMessage: (message: OutboundMessage) => boolean;
	subscribe: (quotaId: string) => boolean;
	unsubscribe: (quotaId: string) => boolean;
	requestOverride: (request: {
		quotaId: string;
		requestType:
			| "TEMPORARY_INCREASE"
			| "TIME_EXTENSION"
			| "EMERGENCY_OVERRIDE";
		duration: number;
		reason: string;
		urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
	}) => boolean;
	approveOverride: (
		requestId: string,
		duration?: number,
		reason?: string
	) => boolean;
	rejectOverride: (requestId: string, reason: string) => boolean;
	// Enhanced connection management
	forceReconnect: () => Promise<void>;
	getConnectionHealth: () => Promise<boolean>;
	getPerformanceMetrics: () => any;
	clearMessageQueue: () => void;
}

// Custom hook for quota WebSocket connection
// Outbound messages sent by the client over WebSocket
type OutboundMessage =
	| { type: "SUBSCRIBE_QUOTA"; payload: { quotaId: string } }
	| { type: "UNSUBSCRIBE_QUOTA"; payload: { quotaId: string } }
	| {
			type: "REQUEST_OVERRIDE";
			payload: {
				quotaId: string;
				requestType:
					| "TEMPORARY_INCREASE"
					| "TIME_EXTENSION"
					| "EMERGENCY_OVERRIDE";
				duration: number;
				reason: string;
				urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
				familyMemberId: string;
			};
	  }
	| {
			type: "APPROVE_OVERRIDE";
			payload: {
				requestId: string;
				approvedBy: string;
				actualDuration?: number;
				responseReason?: string;
			};
	  }
	| {
			type: "REJECT_OVERRIDE";
			payload: { requestId: string; approvedBy: string; responseReason: string };
	  };

export const useQuotaWebSocket = (
	options: UseQuotaWebSocketOptions
): UseQuotaWebSocketReturn => {
	const hookRenderCount = React.useRef(0);
	hookRenderCount.current++;
	console.log(`[DEBUG] useQuotaWebSocket render #${hookRenderCount.current}`);

	const {
		familyMemberId,
		roomId,
		quotaId,
		onQuotaUpdate,
		onOverrideRequest,
		onViolationAlert,
		onConnectionChange,
	} = options;

	console.log(`[DEBUG] useQuotaWebSocket options:`, {
		familyMemberId,
		roomId,
		quotaId,
		onConnectionChange: !!onConnectionChange,
		onQuotaUpdate: !!onQuotaUpdate,
		onOverrideRequest: !!onOverrideRequest,
		onViolationAlert: !!onViolationAlert,
	});

	const [lastMessage, setLastMessage] =
		useState<QuotaWebSocketMessage | null>(null);
	const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.CLOSED);
	const subscribedQuotas = useRef(new Set<string>());
	const wsClientRef = useRef<ReconnectingWebSocketClient | null>(null);

	// Debouncing for state updates to prevent rapid re-renders
	const debouncedSetConnectionState = useMemo(() => {
		let timeoutId: NodeJS.Timeout;
		return (newState: ConnectionState) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setConnectionState(newState);
			}, 50); // 50ms debounce for connection state
		};
	}, []);

	// Debounced message updates
	const debouncedSetLastMessage = useMemo(() => {
		let timeoutId: NodeJS.Timeout;
		return (message: QuotaWebSocketMessage | null) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setLastMessage(message);
			}, 10); // 10ms debounce for messages
		};
	}, []);

	// Get JWT token for authentication - use specific selectors to prevent unnecessary re-renders
	// Use useShallow to stabilize token selection and prevent re-renders from object reference changes
	const { accessToken, isAuthenticated, user } = useAuthStore(
		useShallow((state) => ({
			accessToken: state.tokens?.accessToken,
			isAuthenticated: state.isAuthenticated,
			user: state.user,
		}))
	);

	// Enhanced debugging for authentication state
	useEffect(() => {
		console.log(`[DEBUG] Auth state changed:`, {
			isAuthenticated,
			hasAccessToken: !!accessToken,
			hasUser: !!user,
			userId: user?.id,
			familyMemberId,
			tokenLength: accessToken?.length,
		});
	}, [isAuthenticated, accessToken, user, familyMemberId]);

	// Store current access token in a ref to avoid recreation on token changes
	const accessTokenRef = useRef<string | null>(null);
	accessTokenRef.current = accessToken;

	// Build WebSocket URL using backend server configuration
	const socketUrl = useMemo(() => {
		// Don't connect if not authenticated or no token
		console.log(`[DEBUG] Building socketUrl - isAuthenticated: ${isAuthenticated}, accessToken: ${accessToken ? 'present' : 'missing'}`);
		if (!isAuthenticated || !accessToken) {
			console.log(`[DEBUG] Skipping WebSocket connection - isAuthenticated: ${isAuthenticated}, accessToken: ${accessToken ? 'present' : 'missing'}`);
			return null;
		}

		// Use backend WebSocket base URL
		// Note: The base URL is used to extract protocol/host, then /ws/quota is appended
		const backendWsUrl = process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || 'ws://localhost:8081/ws';

		// Parse the backend WebSocket base URL
		const baseUrl = new URL(backendWsUrl);

		// Create quota-specific WebSocket URL (always /ws/quota regardless of base URL path)
		const wsUrl = new URL("/ws/quota", `${baseUrl.protocol}//${baseUrl.host}`);

		// Add JWT token for authentication (required by backend WebSocketJwtAuthHandler)
		wsUrl.searchParams.set("token", accessToken);
		console.log(`[DEBUG] Adding token to URL - token length: ${accessToken.length}, first 10 chars: ${accessToken.substring(0, 10)}...`);

		// Add filter parameters
		wsUrl.searchParams.set("familyMemberId", familyMemberId);
		if (roomId) wsUrl.searchParams.set("roomId", roomId);
		if (quotaId) wsUrl.searchParams.set("quotaId", quotaId);

		console.log("Quota WebSocket URL:", wsUrl.toString());
		console.log(`[DEBUG] Final URL token parameter: ${wsUrl.searchParams.get("token")?.substring(0, 10)}...`);
		return wsUrl.toString();
	}, [isAuthenticated, familyMemberId, roomId, quotaId]); // FIXED: Removed accessToken from dependencies

	// Initialize WebSocket client
	useEffect(() => {
		console.log(`[DEBUG] useQuotaWebSocket - WebSocket useEffect triggered`, { socketUrl, hasAccessToken: !!accessTokenRef.current });
		if (!socketUrl || !accessTokenRef.current) {
			console.log(`[DEBUG] useQuotaWebSocket - Early return: no socketUrl or accessToken`);
			return;
		}

		const wsClient = new ReconnectingWebSocketClient({
			url: socketUrl,
			maxRetries: 10,
			connectionTimeout: 30000, // 30 second timeout for debugging
			debug: process.env.NODE_ENV === 'development',
			auth: {
				enabled: false, // Disabled - JWT token is passed as query parameter
				tokenHeader: 'Authorization',
				autoRefresh: true,
			},
			messageQueue: {
				enabled: true,
				maxSize: 100,
			},
		});

		wsClientRef.current = wsClient;

		// Store callback references to avoid re-subscription issues
		const callbacksRef = {
			onConnectionChange,
			onQuotaUpdate,
			onOverrideRequest,
			onViolationAlert,
		};

		// Subscribe to connection state changes with stable callback
		const connectionSub = wsClient.getConnectionState$().subscribe(state => {
			const newConnectionState = state.status === 'connected' ? ConnectionState.OPEN :
				state.status === 'connecting' ? ConnectionState.CONNECTING :
				state.status === 'reconnecting' ? ConnectionState.CONNECTING :
				ConnectionState.CLOSED;
			
			// Use debounced state update to prevent rapid re-renders
			debouncedSetConnectionState(newConnectionState);
			// Use the captured callback reference to prevent re-subscription
			callbacksRef.onConnectionChange?.(newConnectionState === ConnectionState.OPEN);
		});

		// Subscribe to messages
		const messagesSub = wsClient.getMessages$().subscribe(message => {
			try {
				// Filter out non-quota messages (like connection status)
				if (message.type === 'mqtt-status' || message.type === 'rooms' || message.type === 'room-state' || message.type === 'room-settings') {
					// These are not quota messages, ignore them
					return;
				}

				// Enhanced message handling with validation
				let quotaMessage: QuotaWebSocketMessage;
				
				// Handle different message formats from ReconnectingWebSocketClient
				if (message.data && typeof message.data === 'object') {
					// Message data is nested - try to extract quota message
					quotaMessage = message.data as unknown as QuotaWebSocketMessage;
				} else if (typeof message === 'object' && 'type' in message && 'payload' in message) {
					// Message is already in quota format
					quotaMessage = message as unknown as QuotaWebSocketMessage;
				} else {
					console.warn("Unrecognized quota message format:", message);
					return;
				}

				// Additional check: ensure this looks like a quota message before parsing
				if (!quotaMessage.type || !['QUOTA_UPDATE', 'OVERRIDE_REQUEST_CREATED', 'OVERRIDE_REQUEST_UPDATED', 'OVERRIDE_REQUEST_EXPIRED', 'QUOTA_VIOLATION_ALERT'].includes(quotaMessage.type)) {
					console.debug("Ignoring non-quota message:", quotaMessage);
					return;
				}

				// Validate message schema with error handling
				const parseResult = quotaWebSocketMessageSchema.safeParse(quotaMessage);
				if (!parseResult.success) {
					console.error("Failed to parse quota message:", {
						error: parseResult.error,
						message: quotaMessage
					});
					return;
				}
				
				const parsedMessage = parseResult.data;
				// Use debounced message update to prevent rapid re-renders
				debouncedSetLastMessage(parsedMessage);

				// Enhanced message routing with error handling using stable callbacks
				switch (parsedMessage.type) {
					case "QUOTA_UPDATE":
						try {
							callbacksRef.onQuotaUpdate?.(parsedMessage.payload);
						} catch (error) {
							console.error("Error handling quota update:", error);
						}
						break;
					case "OVERRIDE_REQUEST_CREATED":
					case "OVERRIDE_REQUEST_UPDATED":
					case "OVERRIDE_REQUEST_EXPIRED":
						try {
							callbacksRef.onOverrideRequest?.(parsedMessage);
						} catch (error) {
							console.error("Error handling override request:", error);
						}
						break;
					case "QUOTA_VIOLATION_ALERT":
						try {
							callbacksRef.onViolationAlert?.(parsedMessage.payload);
						} catch (error) {
							console.error("Error handling violation alert:", error);
						}
						break;
					default:
						console.warn("Unknown quota message type:", (parsedMessage as any).type);
				}
			} catch (error) {
				console.error("Failed to process quota WebSocket message:", {
					error: error instanceof Error ? error.message : String(error),
					message: typeof message === 'object' ? JSON.stringify(message) : message
				});
			}
		});

		// Connect (JWT token is passed as query parameter for authentication)
		console.log(`[DEBUG] Attempting to connect to quota WebSocket: ${socketUrl}`);
		console.log(`[DEBUG] Using JWT token: ${accessTokenRef.current ? accessTokenRef.current.substring(0, 20) + '...' : 'none'}`);

		wsClient.connect()
			.then(() => {
				console.log("Quota WebSocket connected successfully");

				// Subscribe to existing quotas on connection
				subscribedQuotas.current.forEach((quota) => {
					console.log(`[DEBUG] Subscribing to quota: ${quota}`);
					wsClient.send({
						type: "SUBSCRIBE_QUOTA",
						payload: { quotaId: quota },
					});
				});
			})
			.catch((error) => {
				console.error("Failed to connect quota WebSocket:", error);
				console.error("Error details:", {
					name: error.name,
					message: error.message,
					stack: error.stack
				});
			});

		// Cleanup function
		return () => {
			connectionSub.unsubscribe();
			messagesSub.unsubscribe();
			wsClient.disconnect();
			wsClientRef.current = null;
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [socketUrl]); // FIXED: Removed accessToken from dependencies - using accessTokenRef.current instead
	// Callbacks are intentionally not in deps to prevent infinite re-renders

	const isConnected = connectionState === ConnectionState.OPEN;
	const isConnecting = connectionState === ConnectionState.CONNECTING;
	const isReconnecting = connectionState === ConnectionState.CONNECTING; // ReconnectingWebSocket handles this

	// Enhanced connection management functions
	const forceReconnect = useCallback(async () => {
		if (wsClientRef.current) {
			try {
				// Disconnect and reconnect
				wsClientRef.current.disconnect();
				await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
				await wsClientRef.current.connect();

				// Re-authenticate
				if (accessTokenRef.current) {
					await wsClientRef.current.authenticate(accessTokenRef.current);
				}
			} catch (error) {
				console.error("Force reconnect failed:", error);
				throw error;
			}
		}
	}, []); // FIXED: Removed accessToken dependency - using accessTokenRef.current instead

	const getConnectionHealth = useCallback(async () => {
		if (wsClientRef.current) {
			try {
				return await wsClientRef.current.checkConnectionHealth();
			} catch (error) {
				console.error("Connection health check failed:", error);
				return false;
			}
		}
		return false;
	}, []);

	const getPerformanceMetrics = useCallback(() => {
		return wsClientRef.current?.getPerformanceMetrics() || null;
	}, []);

	const clearMessageQueue = useCallback(() => {
		wsClientRef.current?.clearMessageQueue();
	}, []);

	// Enhanced message sending with validation and error handling
	const sendJsonMessage = useCallback((message: OutboundMessage) => {
		if (!wsClientRef.current || !isConnected) {
			console.warn("Cannot send quota message: WebSocket not connected");
			return false;
		}

		try {
			// Validate outbound message schema
			const validatedMessage = outboundMessageSchema.parse(message);

			// Add message metadata
			const enhancedMessage = {
				...validatedMessage,
				timestamp: Date.now(),
				source: 'quota-client',
				id: `quota-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			};

			wsClientRef.current.send(enhancedMessage);
			
			if (process.env.NODE_ENV === 'development') {
				console.debug("Quota message sent:", enhancedMessage);
			}
			
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				console.error("Message validation failed:", error.errors, message);
			} else {
				console.error("Failed to send quota message:", error, message);
			}
			return false;
		}
	}, [isConnected]);

	// Subscribe to quota updates
	const subscribe = useCallback(
		(quotaId: string): boolean => {
			if (!isConnected) {
				console.warn("Cannot subscribe to quota: WebSocket not connected");
				return false;
			}

			if (!quotaId || quotaId.trim().length === 0) {
				console.error("Cannot subscribe: invalid quotaId");
				return false;
			}

			subscribedQuotas.current.add(quotaId);
			const success = sendJsonMessage({
				type: "SUBSCRIBE_QUOTA",
				payload: { quotaId },
			});

			if (success && process.env.NODE_ENV === 'development') {
				console.debug("Subscribed to quota:", quotaId);
			}

			return success;
		},
		[isConnected, sendJsonMessage]
	);

	// Unsubscribe from quota updates
	const unsubscribe = useCallback(
		(quotaId: string): boolean => {
			if (!isConnected) {
				console.warn("Cannot unsubscribe from quota: WebSocket not connected");
				return false;
			}

			if (!quotaId || quotaId.trim().length === 0) {
				console.error("Cannot unsubscribe: invalid quotaId");
				return false;
			}

			subscribedQuotas.current.delete(quotaId);
			const success = sendJsonMessage({
				type: "UNSUBSCRIBE_QUOTA",
				payload: { quotaId },
			});

			if (success && process.env.NODE_ENV === 'development') {
				console.debug("Unsubscribed from quota:", quotaId);
			}

			return success;
		},
		[isConnected, sendJsonMessage]
	);

	// Send override request
	const requestOverride = useCallback(
		(request: {
			quotaId: string;
			requestType:
				| "TEMPORARY_INCREASE"
				| "TIME_EXTENSION"
				| "EMERGENCY_OVERRIDE";
			duration: number;
			reason: string;
			urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
		}): boolean => {
			if (!isConnected) {
				console.warn("Cannot request override: WebSocket not connected");
				return false;
			}

			if (!request.quotaId || !request.reason || request.duration <= 0) {
				console.error("Cannot request override: invalid request parameters");
				return false;
			}

			const success = sendJsonMessage({
				type: "REQUEST_OVERRIDE",
				payload: {
					...request,
					familyMemberId,
				},
			});

			if (success && process.env.NODE_ENV === 'development') {
				console.debug("Override request sent:", request);
			}

			return success;
		},
		[isConnected, familyMemberId, sendJsonMessage]
	);

	// Approve override request (parent action)
	const approveOverride = useCallback(
		(requestId: string, duration?: number, reason?: string): boolean => {
			if (!isConnected) {
				console.warn("Cannot approve override: WebSocket not connected");
				return false;
			}

			if (!requestId || requestId.trim().length === 0) {
				console.error("Cannot approve override: invalid requestId");
				return false;
			}

			const success = sendJsonMessage({
				type: "APPROVE_OVERRIDE",
				payload: {
					requestId,
					approvedBy: familyMemberId,
					actualDuration: duration,
					responseReason: reason,
				},
			});

			if (success && process.env.NODE_ENV === 'development') {
				console.debug("Override approved:", requestId);
			}

			return success;
		},
		[isConnected, familyMemberId, sendJsonMessage]
	);

	// Reject override request (parent action)
	const rejectOverride = useCallback(
		(requestId: string, reason: string): boolean => {
			if (!isConnected) {
				console.warn("Cannot reject override: WebSocket not connected");
				return false;
			}

			if (!requestId || requestId.trim().length === 0 || !reason || reason.trim().length === 0) {
				console.error("Cannot reject override: invalid parameters");
				return false;
			}

			const success = sendJsonMessage({
				type: "REJECT_OVERRIDE",
				payload: {
					requestId,
					approvedBy: familyMemberId,
					responseReason: reason,
				},
			});

			if (success && process.env.NODE_ENV === 'development') {
				console.debug("Override rejected:", requestId, reason);
			}

			return success;
		},
		[isConnected, familyMemberId, sendJsonMessage]
	);

	// Memoize the return object to prevent unnecessary re-renders
	return useMemo(() => ({
		connectionState,
		isConnected,
		isConnecting,
		isReconnecting,
		lastMessage,
		connectionError: connectionState === ConnectionState.CLOSED ? "Connection closed" : null,
		retryCount: 0, // ReconnectingWebSocketClient handles retry count internally
		queuedMessages: wsClientRef.current?.getQueuedMessageCount() || 0,
		sendMessage: sendJsonMessage,
		subscribe,
		unsubscribe,
		requestOverride,
		approveOverride,
		rejectOverride,
		// Enhanced connection management
		forceReconnect,
		getConnectionHealth,
		getPerformanceMetrics,
		clearMessageQueue,
	}), [
		connectionState,
		isConnected,
		isConnecting,
		isReconnecting,
		lastMessage,
		sendJsonMessage,
		subscribe,
		unsubscribe,
		requestOverride,
		approveOverride,
		rejectOverride,
		forceReconnect,
		getConnectionHealth,
		getPerformanceMetrics,
		clearMessageQueue,
	]);
};

// React Context for quota WebSocket
interface QuotaWebSocketContextValue extends UseQuotaWebSocketReturn {
	quotaUpdates: Map<string, QuotaUpdateMessage["payload"]>;
	violationAlerts: QuotaViolationAlert["payload"][];
	overrideRequests: Map<string, OverrideRequestMessage>;
	// Enhanced connection state for UI components
	connectionStatus: {
		isHealthy: boolean;
		lastHealthCheck?: number;
		performanceMetrics?: any;
	};
}

const QuotaWebSocketContext =
	React.createContext<QuotaWebSocketContextValue | null>(null);

interface QuotaWebSocketProviderProps {
	familyMemberId: string;
	children: React.ReactNode;
}

export const QuotaWebSocketProvider: React.FC<QuotaWebSocketProviderProps> = ({
	familyMemberId,
	children,
}) => {
	console.log(`[PROVIDER] QuotaWebSocketProvider starting for familyMemberId:`, familyMemberId);
	
	// Move all hooks outside try-catch to ensure they are called unconditionally
	const renderCount = React.useRef(0);
	renderCount.current++;
	console.log(`[PROVIDER] QuotaWebSocketProvider render #${renderCount.current}`);
	
	// State management
	const [quotaUpdates, setQuotaUpdates] = useState(
		new Map<string, QuotaUpdateMessage["payload"]>()
	);
	const [violationAlerts, setViolationAlerts] = useState<QuotaViolationAlert["payload"][]>([]);
	const [overrideRequests, setOverrideRequests] = useState(
		new Map<string, OverrideRequestMessage>()
	);
	const [connectionStatus, setConnectionStatus] = useState({
		isHealthy: false as boolean,
		lastHealthCheck: undefined as number | undefined,
		performanceMetrics: null as unknown,
	});

	// Use shallow comparison for Zustand store selectors
	const quotaActions = useQuotaStore(
		useShallow((state) => ({
			setConnected: state.setConnected,
			updateBalance: state.updateBalance,
			addViolation: state.addViolation,
		}))
	);

	console.log(`[PROVIDER] Zustand actions obtained with shallow comparison`);

	// Stable callback functions using shallow-compared actions
	const handleConnectionChange = useCallback((isConnected: boolean) => {
		console.log(`[PROVIDER] Connection change:`, isConnected);
		
		// Update Zustand store connection status
		quotaActions.setConnected(isConnected);
		
		// Update connection health status
		setConnectionStatus(prev => ({
			...prev,
			isHealthy: isConnected,
			lastHealthCheck: Date.now(),
		}));
	}, [quotaActions.setConnected]);

	const handleQuotaUpdate = useCallback((update: QuotaUpdateMessage["payload"]) => {
		console.log(`[PROVIDER] Quota update:`, update);
		
		try {
			// Enhanced quota update handling with validation
			if (!update.quotaId || !update.familyMemberId || !update.roomId) {
				console.error("Invalid quota update: missing required fields", update);
				return;
			}

			setQuotaUpdates(
				(prev) => new Map(prev.set(update.quotaId, update))
			);
			
			// Enhanced Zustand store update with better data mapping
			const balanceData = {
				quotaId: update.quotaId,
				userId: update.familyMemberId,
				roomId: update.roomId,
				totalSeconds: update.dailyLimit,
				usedSeconds: update.currentUsage,
				remainingSeconds: Math.max(0, update.dailyLimit - update.currentUsage),
				warningThreshold: 75, // Default warning threshold - could be configurable
				lastUpdated: update.lastUpdated,
				resetTime: undefined, // Could be derived from backend data
				isActive: update.status === 'ACTIVE',
				isExceeded: update.status === 'EXCEEDED',
				hasOverride: update.status === 'PAUSED', // Paused status indicates override
			};

			quotaActions.updateBalance(update.familyMemberId, update.roomId, balanceData);

			if (process.env.NODE_ENV === 'development') {
				console.debug("Quota balance updated:", balanceData);
			}
		} catch (error) {
			console.error("Error processing quota update:", error, update);
		}
	}, [quotaActions.updateBalance]);

	const handleOverrideRequest = useCallback((request: OverrideRequestMessage) => {
		console.log(`[PROVIDER] Override request:`, request);
		
		try {
			// Enhanced override request handling with validation
			if (!request.payload.requestId || !request.payload.quotaId || !request.payload.familyMemberId) {
				console.error("Invalid override request: missing required fields", request);
				return;
			}

			setOverrideRequests(
				(prev) => new Map(prev.set(request.payload.requestId, request))
			);

			if (process.env.NODE_ENV === 'development') {
				console.debug("Override request processed:", request.type, request.payload);
			}
		} catch (error) {
			console.error("Error processing override request:", error, request);
		}
	}, []); // No quotaActions dependency needed for this callback

	const handleViolationAlert = useCallback((alert: QuotaViolationAlert["payload"]) => {
		console.log(`[PROVIDER] Violation alert:`, alert);
		
		try {
			// Enhanced violation alert handling with validation
			if (!alert.quotaId || !alert.familyMemberId || !alert.roomId || !alert.violationType) {
				console.error("Invalid violation alert: missing required fields", alert);
				return;
			}

			setViolationAlerts((prev) => [alert, ...prev.slice(0, 99)]); // Keep last 100 alerts
			
			// Enhanced violation mapping for Zustand store
			const violationType: "WARNING" | "EXCEEDED" | "BLOCKED" = alert.violationType === 'LIMIT_EXCEEDED' ? 'EXCEEDED' : 
						 alert.violationType === 'WARNING_THRESHOLD' ? 'WARNING' : 'BLOCKED';

			const violationData = {
				id: `${alert.quotaId}-${alert.timestamp}`,
				userId: alert.familyMemberId,
				roomId: alert.roomId,
				type: violationType,
				message: `Quota ${alert.violationType.toLowerCase().replace('_', ' ')} in ${alert.roomName}`,
				timestamp: alert.timestamp,
			};

			quotaActions.addViolation(violationData);

			if (process.env.NODE_ENV === 'development') {
				console.debug("Violation alert processed:", violationData);
			}
		} catch (error) {
			console.error("Error processing violation alert:", error, alert);
		}
	}, [quotaActions.addViolation]);

	// Use refs for callback functions to avoid re-creation in WebSocket subscriptions
	// Update refs directly during render to avoid unstable useEffect dependencies
	const callbacksRef = useRef({
		onConnectionChange: handleConnectionChange,
		onQuotaUpdate: handleQuotaUpdate,
		onOverrideRequest: handleOverrideRequest,
		onViolationAlert: handleViolationAlert,
	});

	// Update refs directly on each render (safer than useEffect with unstable dependencies)
	callbacksRef.current.onConnectionChange = handleConnectionChange;
	callbacksRef.current.onQuotaUpdate = handleQuotaUpdate;
	callbacksRef.current.onOverrideRequest = handleOverrideRequest;
	callbacksRef.current.onViolationAlert = handleViolationAlert;

	// COMMENTED OUT - Update refs when callbacks change
	// DEBUGGING: This useEffect is likely causing infinite re-renders
	// useEffect(() => {
	// 	callbacksRef.current.onConnectionChange = handleConnectionChange;
	// 	callbacksRef.current.onQuotaUpdate = handleQuotaUpdate;
	// 	callbacksRef.current.onOverrideRequest = handleOverrideRequest;
	// 	callbacksRef.current.onViolationAlert = handleViolationAlert;
	// }, [handleConnectionChange, handleQuotaUpdate, handleOverrideRequest, handleViolationAlert]);

	console.log(`[PROVIDER] About to call useQuotaWebSocket with stable callbacks`);

	// Use the WebSocket hook with refs to prevent re-subscription loops
	const webSocket = useQuotaWebSocket({
		familyMemberId,
		onConnectionChange: (isConnected) => callbacksRef.current.onConnectionChange(isConnected),
		onQuotaUpdate: (update) => callbacksRef.current.onQuotaUpdate(update),
		onOverrideRequest: (request) => callbacksRef.current.onOverrideRequest(request),
		onViolationAlert: (alert) => callbacksRef.current.onViolationAlert(alert),
	});

	console.log(`[PROVIDER] useQuotaWebSocket returned:`, {
		isConnected: webSocket.isConnected,
		connectionState: webSocket.connectionState,
	});

	// Debounced connection status update
	const debouncedSetConnectionStatus = useMemo(() => {
		let timeoutId: NodeJS.Timeout;
		return (updater: (prev: typeof connectionStatus) => typeof connectionStatus) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setConnectionStatus(updater);
			}, 100); // 100ms debounce
		};
	}, []);

	// Store refs to WebSocket functions to prevent re-subscription issues
	// Initialize once and use the current webSocket reference directly in health checks
	const webSocketFunctionsRef = useRef({
		getConnectionHealth: () => webSocket.getConnectionHealth(),
		getPerformanceMetrics: () => webSocket.getPerformanceMetrics(),
	});

	// COMMENTED OUT - Update refs to always use current webSocket functions without triggering re-renders
	// DEBUGGING: This useEffect creates unstable WebSocket function references
	// useEffect(() => {
	// 	webSocketFunctionsRef.current.getConnectionHealth = () => webSocket.getConnectionHealth();
	// 	webSocketFunctionsRef.current.getPerformanceMetrics = () => webSocket.getPerformanceMetrics();
	// }, []); // Empty dependency array - only set once

	// COMMENTED OUT - Periodic connection health monitoring with debouncing
	// DEBUGGING: This useEffect has unstable dependencies causing infinite re-renders
	// useEffect(() => {
	// 	if (!webSocket.isConnected) return;
	//
	// 	const healthCheckInterval = setInterval(async () => {
	// 		try {
	// 			// Use the current webSocket reference directly to avoid stale closures
	// 			const isHealthy = await webSocket.getConnectionHealth();
	// 			const metrics = webSocket.getPerformanceMetrics();
	// 			
	// 			debouncedSetConnectionStatus(() => ({
	// 				isHealthy,
	// 				lastHealthCheck: Date.now(),
	// 				performanceMetrics: metrics,
	// 			}));
	// 		} catch (error) {
	// 			console.error("Connection health check failed:", error);
	// 			debouncedSetConnectionStatus(prev => ({
	// 				...prev,
	// 				isHealthy: false,
	// 				lastHealthCheck: Date.now(),
	// 			}));
	// 		}
	// 	}, 30000); // Check every 30 seconds
	//
	// 	return () => {
	// 		clearInterval(healthCheckInterval);
	// 	};
	// }, [webSocket.isConnected, debouncedSetConnectionStatus]); // Stable dependencies only

	// Memoize context value to prevent unnecessary re-renders
	// Extract webSocket properties to avoid object spread in dependencies
	const {
		connectionState,
		isConnected,
		isConnecting,
		isReconnecting,
		lastMessage,
		connectionError,
		retryCount,
		queuedMessages,
		sendMessage,
		subscribe,
		unsubscribe,
		requestOverride,
		approveOverride,
		rejectOverride,
		forceReconnect,
		getConnectionHealth,
		getPerformanceMetrics,
		clearMessageQueue,
	} = webSocket;

	// Create stable function references that access the current WebSocket instance directly
	const stableSubscribe = useCallback((quotaId: string): boolean => {
		return webSocket.subscribe?.(quotaId) ?? false;
	}, []); // No dependencies - access webSocket directly

	const stableUnsubscribe = useCallback((quotaId: string): boolean => {
		return webSocket.unsubscribe?.(quotaId) ?? false;
	}, []); // No dependencies

	const stableRequestOverride = useCallback((request: {
		quotaId: string;
		requestType: "TEMPORARY_INCREASE" | "TIME_EXTENSION" | "EMERGENCY_OVERRIDE";
		duration: number;
		reason: string;
		urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
	}): boolean => {
		return webSocket.requestOverride?.(request) ?? false;
	}, []); // No dependencies

	const stableApproveOverride = useCallback((requestId: string, duration?: number, reason?: string): boolean => {
		return webSocket.approveOverride?.(requestId, duration, reason) ?? false;
	}, []); // No dependencies

	const stableRejectOverride = useCallback((requestId: string, reason: string): boolean => {
		return webSocket.rejectOverride?.(requestId, reason) ?? false;
	}, []); // No dependencies

	const stableForceReconnect = useCallback(async (): Promise<void> => {
		return webSocket.forceReconnect?.() ?? Promise.resolve();
	}, []); // No dependencies

	const stableGetConnectionHealth = useCallback(async (): Promise<boolean> => {
		return webSocket.getConnectionHealth?.() ?? Promise.resolve(false);
	}, []); // No dependencies

	const stableGetPerformanceMetrics = useCallback(() => {
		return webSocket.getPerformanceMetrics?.() ?? null;
	}, []); // No dependencies

	const stableClearMessageQueue = useCallback((): void => {
		return webSocket.clearMessageQueue?.();
	}, []); // No dependencies

	const contextValue: QuotaWebSocketContextValue = useMemo(() => ({
		connectionState,
		isConnected,
		isConnecting,
		isReconnecting,
		lastMessage,
		connectionError,
		retryCount,
		queuedMessages,
		sendMessage,
		// Use stable function references instead of direct WebSocket methods
		subscribe: stableSubscribe,
		unsubscribe: stableUnsubscribe,
		requestOverride: stableRequestOverride,
		approveOverride: stableApproveOverride,
		rejectOverride: stableRejectOverride,
		forceReconnect: stableForceReconnect,
		getConnectionHealth: stableGetConnectionHealth,
		getPerformanceMetrics: stableGetPerformanceMetrics,
		clearMessageQueue: stableClearMessageQueue,
		quotaUpdates,
		violationAlerts,
		overrideRequests,
		connectionStatus,
	}), [
		connectionState,
		isConnected,
		isConnecting,
		isReconnecting,
		lastMessage,
		connectionError,
		retryCount,
		queuedMessages,
		sendMessage,
		stableSubscribe,
		stableUnsubscribe,
		stableRequestOverride,
		stableApproveOverride,
		stableRejectOverride,
		stableForceReconnect,
		stableGetConnectionHealth,
		stableGetPerformanceMetrics,
		stableClearMessageQueue,
		quotaUpdates,
		violationAlerts,
		overrideRequests,
		connectionStatus,
	]);

	console.log(`[PROVIDER] Provider ready, rendering context`);

	try {
		return (
			<QuotaWebSocketContext.Provider value={contextValue}>
				{children}
			</QuotaWebSocketContext.Provider>
		);
	} catch (error) {
		console.error("[PROVIDER ERROR] QuotaWebSocketProvider crashed:", error);
		return <>{children}</>;
	}
};

export const useQuotaWebSocketContext = (): QuotaWebSocketContextValue => {
	const context = React.useContext(QuotaWebSocketContext);
	if (!context) {
		throw new Error(
			"useQuotaWebSocketContext must be used within QuotaWebSocketProvider"
		);
	}
	return context;
};

// Utility hook for specific quota tracking
export const useQuotaTracking = (quotaId: string) => {
	const { subscribe, unsubscribe, quotaUpdates, isConnected } =
		useQuotaWebSocketContext();
	const quotaUpdate = quotaUpdates.get(quotaId);

	useEffect(() => {
		if (isConnected) {
			subscribe(quotaId);
		}

		return () => {
			if (isConnected) {
				unsubscribe(quotaId);
			}
		};
	}, [quotaId, isConnected, subscribe, unsubscribe]);

	return {
		quotaUpdate,
		isConnected,
	};
};

export default useQuotaWebSocket;
