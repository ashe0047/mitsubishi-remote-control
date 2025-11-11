/**
 * Room API Client Enhanced
 *
 * Provides methods for interacting with the enhanced room API.
 * Consolidates room data, device information, and control operations.
 */

import { AxiosInstance } from "axios";
import { axiosClient } from "@/lib/http/axios-client";
import type {
	Room,
	CreateRoomRequest,
	UpdateRoomRequest,
	DeviceControlAction,
	DeviceControlResponse,
	QuotaValidationResult,
	UsageSession,
} from "@/types/room";
import { RoomValidation } from "@/types/room";

/**
 * Enhanced API error interface for detailed error information.
 */
interface ApiErrorResponse {
	error: string;
	message: string;
	status: number;
	path: string;
	timestamp: string;
	details?: Record<string, any>;
}

/**
 * Enhanced quota-specific error interface.
 */
interface QuotaErrorDetails {
	quotaType: string;
	currentUsage: number;
	limit: number;
	resetTime: string;
	overrideAvailable: boolean;
}

export class RoomApiClient {
	private client: AxiosInstance;
	private baseUrl = "/api/rooms";
	private requestCache: Map<string, { data: unknown; timestamp: number }>;
	private batchedRequests: Map<
		string,
		Array<{
			resolve: (value: any) => void;
			reject: (reason?: unknown) => void;
		}>
	>;
	private batchTimeouts: Map<string, NodeJS.Timeout>;

	private readonly CACHE_TTL = 30 * 1000; // 30 seconds for API-level cache
	private readonly BATCH_DELAY = 50; // 50ms batch delay
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1000; // 1 second base delay

	constructor(httpClient?: AxiosInstance) {
		this.client = httpClient || axiosClient.getInstance();
		this.requestCache = new Map();
		this.batchedRequests = new Map();
		this.batchTimeouts = new Map();
	}

	/**
	 * Get all rooms with embedded device information and aggregate status.
	 *
	 * @returns Promise<Room[]>
	 * @throws ApiError if request fails
	 */
	async getAllRooms(): Promise<Room[]> {
		const cacheKey = "getAllRooms";

		// Check API-level cache
		const cached = this.requestCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			return cached.data as Room[];
		}

		try {
			const response = await this.retryRequest(async () => {
				const axiosResponse = await this.client.get<Room[]>(
					this.baseUrl
				);
				return axiosResponse.data;
			});

			// Validate response data
			let validatedRooms: Room[];
			if (Array.isArray(response)) {
				validatedRooms = response.map((room, index) => {
					// Transform backend response to match frontend schema
					const transformedRoom = this.transformRoomResponse(
						room as unknown as Record<string, unknown>
					);
					const validation =
						RoomValidation.validateRoom(transformedRoom);
					if (!validation.success) {
						console.warn(
							`Invalid room data received for room ${index}:`,
							validation.errors
						);
						console.warn("Room data:", room);
						const firstError = validation.errors.errors[0];
						const fieldPath =
							firstError?.path?.join(".") || "unknown field";
						const errorMessage =
							firstError?.message || "validation failed";
						throw new Error(
							`Room data validation failed: ${fieldPath} - ${errorMessage}`
						);
					}
					return validation.data;
				});
			} else {
				validatedRooms = response;
			}

			// Cache the validated response
			this.requestCache.set(cacheKey, {
				data: validatedRooms as unknown,
				timestamp: Date.now(),
			});

			return validatedRooms;
		} catch (error) {
			this.handleApiError(error, "Failed to fetch rooms");
			throw error;
		}
	}

	/**
	 * Backwards-compatible alias for getAllRooms.
	 */
	async getRooms(): Promise<Room[]> {
		return this.getAllRooms();
	}

	/**
	 * Get a specific room by ID with complete device information.
	 *
	 * @param roomId - Room ID
	 * @returns Promise<Room>
	 * @throws ApiError if room not found or request fails
	 */
	async getRoomById(roomId: string): Promise<Room> {
		const cacheKey = `getRoomById_${roomId}`;

		// Check API-level cache
		const cached = this.requestCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			return cached.data as Room;
		}

		// Use batching for multiple room requests
		return this.batchRequest(cacheKey, async () => {
			try {
				const response = await this.retryRequest(async () => {
					const axiosResponse = await this.client.get<Room>(
						`${this.baseUrl}/${roomId}`
					);
					return axiosResponse.data;
				});

				const transformedRoom = this.transformRoomResponse(
					response as unknown as Record<string, unknown>
				);
				const validation = RoomValidation.validateRoom(transformedRoom);
				if (!validation.success) {
					console.warn(
						"Invalid room data received:",
						validation.errors
					);
					throw new Error("Invalid room data format");
				}

				// Cache the validated response
				this.requestCache.set(cacheKey, {
					data: validation.data,
					timestamp: Date.now(),
				});

				return validation.data;
			} catch (error) {
				this.handleApiError(error, `Failed to fetch room ${roomId}`);
				throw error;
			}
		});
	}

	/**
	 * Get a specific room by identifier (slug).
	 *
	 * @param roomIdentifier - Room identifier (e.g., "living-room")
	 * @returns Promise<Room>
	 * @throws ApiError if room not found or request fails
	 */
	async getRoomByIdentifier(roomIdentifier: string): Promise<Room> {
		try {
			const response = await this.retryRequest(async () => {
				const axiosResponse = await this.client.get<Room>(
					`${this.baseUrl}/identifier/${roomIdentifier}`
				);
				return axiosResponse.data;
			});

			const transformedRoom = this.transformRoomResponse(
				response as unknown as Record<string, unknown>
			);
			const validation = RoomValidation.validateRoom(transformedRoom);
			if (!validation.success) {
				console.warn("Invalid room data received:", validation.errors);
				throw new Error("Invalid room data format");
			}

			return validation.data;
		} catch (error) {
			this.handleApiError(
				error,
				`Failed to fetch room with identifier ${roomIdentifier}`
			);
			throw error;
		}
	}

	/**
	 * Create a new room (parent-only).
	 *
	 * @param request - Create room request
	 * @returns Promise<Room> - Created room with empty devices array
	 * @throws ApiError if validation fails or request fails
	 */
	async createRoom(request: CreateRoomRequest): Promise<Room> {
		// Validate request data
		const validation = RoomValidation.validateCreateRoomRequest(request);
		if (!validation.success) {
			const errors = RoomValidation.formatValidationErrors(
				validation.errors
			);
			throw new Error(`Invalid request data: ${JSON.stringify(errors)}`);
		}

		try {
			const response = await this.retryRequest(async () => {
				const axiosResponse = await this.client.post<Room>(
					this.baseUrl,
					validation.data
				);
				return axiosResponse.data;
			});

			const transformedRoom = this.transformRoomResponse(
				response as unknown as Record<string, unknown>
			);
			const responseValidation =
				RoomValidation.validateRoom(transformedRoom);
			if (!responseValidation.success) {
				console.warn(
					"Invalid room data received:",
					responseValidation.errors
				);
				throw new Error("Invalid room data format");
			}

			// Invalidate cache after successful creation
			this.invalidateCache(["getAllRooms"]);

			return responseValidation.data;
		} catch (error) {
			this.handleApiError(error, "Failed to create room");
			throw error;
		}
	}

	/**
	 * Update an existing room (parent-only).
	 *
	 * @param roomId - Room ID
	 * @param request - Update room request (partial updates supported)
	 * @returns Promise<Room> - Updated room with current device information
	 * @throws ApiError if room not found, validation fails, or request fails
	 */
	async updateRoom(
		roomId: string,
		request: UpdateRoomRequest
	): Promise<Room> {
		// Validate request data
		const validation = RoomValidation.validateUpdateRoomRequest(request);
		if (!validation.success) {
			const errors = RoomValidation.formatValidationErrors(
				validation.errors
			);
			throw new Error(`Invalid request data: ${JSON.stringify(errors)}`);
		}

		try {
			const response = await this.retryRequest(async () => {
				const axiosResponse = await this.client.put<Room>(
					`${this.baseUrl}/${roomId}`,
					validation.data
				);
				return axiosResponse.data;
			});

			const transformedRoom = this.transformRoomResponse(
				response as unknown as Record<string, unknown>
			);
			const responseValidation =
				RoomValidation.validateRoom(transformedRoom);
			if (!responseValidation.success) {
				console.warn(
					"Invalid room data received:",
					responseValidation.errors
				);
				throw new Error("Invalid room data format");
			}

			// Invalidate cache after successful update
			this.invalidateCache(["getAllRooms", `getRoomById_${roomId}`]);

			return responseValidation.data;
		} catch (error) {
			this.handleApiError(error, `Failed to update room ${roomId}`);
			throw error;
		}
	}

	/**
	 * Delete a room (parent-only).
	 *
	 * @param roomId - Room ID
	 * @returns Promise<void>
	 * @throws ApiError if room not found or request fails
	 */
	async deleteRoom(roomId: string): Promise<void> {
		try {
			await this.retryRequest(async () => {
				await this.client.delete(`${this.baseUrl}/${roomId}`);
				return undefined;
			});

			// Invalidate cache after successful deletion
			this.invalidateCache(["getAllRooms", `getRoomById_${roomId}`]);
		} catch (error) {
			this.handleApiError(error, `Failed to delete room ${roomId}`);
			throw error;
		}
	}

	/**
	 * Control a device within a room context.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param action - Device control action
	 * @returns Promise<DeviceControlResponse> - Operation result and updated status
	 * @throws ApiError if device not found, validation fails, or request fails
	 */
	async controlDevice(
		roomId: string,
		deviceId: string,
		action: DeviceControlAction
	): Promise<DeviceControlResponse> {
		try {
			// Validate action data
			const validation =
				RoomValidation.validateDeviceControlAction(action);
			if (!validation.success) {
				const errors = RoomValidation.formatValidationErrors(
					validation.errors
				);
				throw new Error(
					`Invalid action data: ${JSON.stringify(errors)}`
				);
			}

			const endpointAction = action.type.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
			const endpoint = `${this.baseUrl}/${roomId}/devices/${deviceId}/${endpointAction}`;
			return this.executeDeviceControlOperation(
				endpoint,
				validation.data.payload,
				roomId,
				deviceId,
				action.type
			);
		} catch (error) {
			this.handleApiError(
				error,
				`Failed to control device ${deviceId} in room ${roomId}`
			);
			throw error;
		}
	}

	/**
	 * Set device power state.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param power - Power state ('on' | 'off')
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDevicePower(
		roomId: string,
		deviceId: string,
		power: "on" | "off"
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "power",
			payload: { power },
		});
	}

	/**
	 * Set device temperature.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param temperature - Target temperature (16-31°C)
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDeviceTemperature(
		roomId: string,
		deviceId: string,
		temperature: number
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "temperature",
			payload: { temperature },
		});
	}

	/**
	 * Set device mode.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param mode - Operating mode
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDeviceMode(
		roomId: string,
		deviceId: string,
		mode: "off" | "heat_cool" | "cool" | "dry" | "heat" | "fan_only"
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "mode",
			payload: { mode },
		});
	}

	/**
	 * Set device fan speed.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param fan - Fan speed setting
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDeviceFan(
		roomId: string,
		deviceId: string,
		fan: "AUTO" | "1" | "2" | "3" | "4" | "QUIET" | "auto" | "low" | "middle" | "medium" | "high" | "diffuse"
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "fan",
			payload: { fan },
		});
	}

	/**
	 * Set device vane position.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param vane - Vane position setting
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDeviceVane(
		roomId: string,
		deviceId: string,
		vane: "AUTO" | "1" | "2" | "3" | "4" | "5" | "SWING"
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "vane",
			payload: { vane },
		});
	}

	/**
	 * Set device wide vane position.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param wideVane - Wide vane position setting
	 * @returns Promise<DeviceControlResponse>
	 */
	async setDeviceWideVane(
		roomId: string,
		deviceId: string,
		wideVane: "<<" | "<" | "|" | ">" | ">>" | "SWING"
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "wideVane",
			payload: { wideVane },
		});
	}

	/**
	 * Update multiple device settings at once.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param settings - Device settings to update
	 * @returns Promise<DeviceControlResponse>
	 */
	async updateDeviceSettings(
		roomId: string,
		deviceId: string,
		settings: {
			temperature: number;
			fan: string;
			vane: string;
			wideVane: string;
			mode: string;
		}
	): Promise<DeviceControlResponse> {
		return this.controlDevice(roomId, deviceId, {
			type: "settings",
			payload: settings,
		});
	}

	/**
	 * Validate a device control command without executing it.
	 *
	 * @param roomId - Room ID
	 * @param deviceId - Device identifier
	 * @param action - Device control action to validate
	 * @returns Promise<{ valid: boolean; reason?: string; quotaValidation?: QuotaValidationResult }>
	 */
	async validateDeviceCommand(
		roomId: string,
		deviceId: string,
		action: DeviceControlAction
	): Promise<{
		valid: boolean;
		reason?: string;
		quotaValidation?: QuotaValidationResult;
	}> {
		try {
			// Validate action data
			const validation =
				RoomValidation.validateDeviceControlAction(action);
			if (!validation.success) {
				const errors = RoomValidation.formatValidationErrors(
					validation.errors
				);
				return {
					valid: false,
					reason: `Invalid action data: ${JSON.stringify(errors)}`,
				};
			}

			const endpoint = `${this.baseUrl}/${roomId}/devices/${deviceId}/validate`;
			const response = await this.retryRequest(async () => {
				const axiosResponse = await this.client.post(endpoint, {
					action: action.type,
					payload: validation.data.payload,
				});
				return axiosResponse.data;
			});

			return response;
		} catch (error) {
			this.handleApiError(
				error,
				`Failed to validate command for device ${deviceId} in room ${roomId}`
			);
			throw error;
		}
	}

	/**
	 * Execute a device control operation with retry, logging, and cache management.
	 *
	 * @private
	 */
	private async executeDeviceControlOperation(
		endpoint: string,
		payload: unknown,
		roomId: string,
		deviceId: string,
		actionType: string
	): Promise<DeviceControlResponse> {
		const response = await this.retryRequest(async () => {
			const axiosResponse = await this.client.post<DeviceControlResponse>(
				endpoint,
				payload
			);
			return axiosResponse.data;
		});

		// Log the raw response for debugging
		console.log("[DeviceControl] Raw API response:", JSON.stringify(response, null, 2));

		const responseValidation =
			RoomValidation.validateDeviceControlResponse(response);
		if (!responseValidation.success) {
			console.error(
				"[DeviceControl] Validation failed for response:",
				JSON.stringify(response, null, 2)
			);
			console.error(
				"[DeviceControl] Validation errors:",
				JSON.stringify(responseValidation.errors.format(), null, 2)
			);
			throw new Error("Invalid device control response format");
		}

		const validatedResponse = responseValidation.data;

		if (validatedResponse.quotaResult) {
			const quotaStatus = validatedResponse.quotaResult.status;
			console.info(`Device control quota validation: ${quotaStatus}`, {
				roomId,
				deviceId,
				action: actionType,
				quotaStatus,
				message: validatedResponse.quotaResult.message,
			});
		}

		if (validatedResponse.session) {
			const sessionAction = validatedResponse.session.endedAt
				? "ended"
				: "started";
			console.info(`Usage session ${sessionAction}:`, {
				sessionId: validatedResponse.session.id,
				roomId,
				deviceId,
				action: actionType,
				sessionStatus: validatedResponse.session.status,
			});
		}

		this.invalidateCache(["getAllRooms", `getRoomById_${roomId}`]);

		if (validatedResponse.updatedRoom) {
			this.requestCache.set(`getRoomById_${roomId}`, {
				data: validatedResponse.updatedRoom,
				timestamp: Date.now(),
			});
		}

		return validatedResponse;
	}

	/**
	 * Batch multiple requests together to reduce network overhead.
	 *
	 * @private
	 * @param batchKey - Key to group requests
	 * @param requestFn - Function that makes the actual request
	 * @returns Promise with the request result
	 */
	private async batchRequest<T>(
		batchKey: string,
		requestFn: () => Promise<T>
	): Promise<T> {
		return new Promise((resolve, reject) => {
			// Add to batch
			if (!this.batchedRequests.has(batchKey)) {
				this.batchedRequests.set(batchKey, []);
			}

			this.batchedRequests.get(batchKey)!.push({ resolve, reject });

			// Clear existing timeout
			if (this.batchTimeouts.has(batchKey)) {
				clearTimeout(this.batchTimeouts.get(batchKey)!);
			}

			// Set new timeout to execute batch
			const timeout = setTimeout(async () => {
				const requests = this.batchedRequests.get(batchKey) || [];
				this.batchedRequests.delete(batchKey);
				this.batchTimeouts.delete(batchKey);

				try {
					const result = await requestFn();
					// Resolve all batched requests with the same result
					requests.forEach(({ resolve }) => resolve(result));
				} catch (error) {
					// Reject all batched requests with the same error
					requests.forEach(({ reject }) => reject(error));
				}
			}, this.BATCH_DELAY);

			this.batchTimeouts.set(batchKey, timeout);
		});
	}

	/**
	 * Clear the API-level request cache.
	 */
	clearCache(): void {
		this.requestCache.clear();
	}

	/**
	 * Invalidate specific cache entries.
	 *
	 * @param keys - Cache keys to invalidate
	 */
	invalidateCache(keys: string[]): void {
		keys.forEach((key) => this.requestCache.delete(key));
	}

	/**
	 * Get cache statistics.
	 *
	 * @returns Cache statistics
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.requestCache.size,
			keys: Array.from(this.requestCache.keys()),
		};
	}

	/**
	 * Cleanup expired cache entries.
	 */
	cleanupCache(): void {
		const now = Date.now();
		for (const [key, entry] of this.requestCache.entries()) {
			if (now - entry.timestamp > this.CACHE_TTL) {
				this.requestCache.delete(key);
			}
		}
	}

	/**
	 * Transform backend room response to match frontend schema.
	 * Handles mismatches between backend and frontend data formats.
	 *
	 * @private
	 * @param room - Raw room response from backend
	 * @returns Transformed room data matching frontend schema
	 */
	private transformRoomResponse(
		room: Record<string, unknown>
	): Record<string, unknown> {
		// Transform device data if present
		if (room.devices && Array.isArray(room.devices)) {
			room.devices = room.devices.map(
				(device: Record<string, unknown>) => ({
					...device,
					// Add missing id field (backend may return devices without UUID)
					id: device.id || null,
					// Transform device type from backend format (AIR_CONDITIONER) to frontend enum (airconditioner)
					type: device.type
						? this.normalizeDeviceType(device.type as string)
						: device.type,
					currentStatus: this.normalizeDeviceStatus(
						device.currentStatus
					),
				})
			);
		}
		return room;
	}

	/**
	 * Normalize device current status to satisfy frontend validation.
	 *
	 * @private
	 */
	private normalizeDeviceStatus(
		status: unknown
	): Record<string, unknown> | null {
		if (!status || typeof status !== "object") {
			return null;
		}

		const statusObj = status as Record<string, unknown>;
		const fallbackMode =
			typeof statusObj.mode === "string" ? statusObj.mode : "off";
		const normalizedStatus = {
			power: this.normalizePower(statusObj.power, fallbackMode),
			temperature:
				typeof statusObj.temperature === "number"
					? statusObj.temperature
					: 24,
			mode: this.normalizeMode(statusObj.mode),
			fan: statusObj.fan ?? "AUTO",
			vane: statusObj.vane ?? "AUTO",
			wideVane: statusObj.wideVane ?? "|",
			roomTemperature: statusObj.roomTemperature ?? null,
			compressorFrequency: statusObj.compressorFrequency ?? null,
			timestamp: statusObj.timestamp ?? new Date().toISOString(),
		};

		return normalizedStatus;
	}

	private normalizePower(power: unknown, mode: string): string {
		if (typeof power === "string") {
			return power.toUpperCase();
		}
		return mode && mode.toLowerCase() !== "off" ? "ON" : "OFF";
	}

	private normalizeMode(mode: unknown): string {
		if (typeof mode === "string") {
			return mode;
		}
		return "off";
	}

	/**
	 * Normalize device type from backend format to frontend enum format.
	 * Backend: AIR_CONDITIONER, Frontend: airconditioner
	 *
	 * @private
	 * @param backendType - Device type from backend (e.g., "AIR_CONDITIONER")
	 * @returns Frontend enum value (e.g., "airconditioner")
	 */
	private normalizeDeviceType(backendType: string): string {
		// Convert from SCREAMING_SNAKE_CASE to lowercase
		return backendType.toLowerCase().replace(/_/g, "");
	}

	/**
	 * Retry request with enhanced error-type-aware backoff strategy.
	 *
	 * @private
	 * @param requestFn - Function that makes the request
	 * @param retryCount - Current retry attempt
	 * @returns Promise with the request result
	 */
	private async retryRequest<T>(
		requestFn: () => Promise<T>,
		retryCount: number = 0
	): Promise<T> {
		try {
			return await requestFn();
		} catch (error: unknown) {
			const errorDetails = this.extractErrorDetails(error);

			// Check if error is retryable and we haven't exceeded max retries
			if (errorDetails.retryable && retryCount < this.MAX_RETRIES) {
				const delay = this.calculateRetryDelay(
					errorDetails,
					retryCount
				);

				console.warn(
					`Request failed (${
						errorDetails.type
					}), retrying in ${delay}ms (attempt ${retryCount + 1}/${
						this.MAX_RETRIES
					}):`,
					errorDetails.message
				);

				await new Promise((resolve) => setTimeout(resolve, delay));
				return this.retryRequest(requestFn, retryCount + 1);
			}

			// Log non-retryable errors for debugging
			if (!errorDetails.retryable) {
				console.info(
					`Non-retryable error (${errorDetails.type}):`,
					errorDetails.message
				);
			}

			throw error;
		}
	}

	/**
	 * Calculate retry delay based on error type and attempt count.
	 *
	 * @private
	 * @param errorDetails - Error details
	 * @param retryCount - Current retry attempt
	 * @returns Delay in milliseconds
	 */
	private calculateRetryDelay(
		errorDetails: { type: string; status?: number },
		retryCount: number
	): number {
		// Different retry strategies for different error types
		switch (errorDetails.type) {
			case "device_communication":
				// Longer delays for device communication errors
				return this.RETRY_DELAY * 2 * Math.pow(2, retryCount);

			case "network":
				// Standard exponential backoff for network errors
				return this.RETRY_DELAY * Math.pow(2, retryCount);

			case "server":
				if (errorDetails.status === 429) {
					// Longer delays for rate limiting
					return this.RETRY_DELAY * 3 * Math.pow(2, retryCount);
				}
				// Standard backoff for other server errors
				return this.RETRY_DELAY * Math.pow(2, retryCount);

			default:
				return this.RETRY_DELAY * Math.pow(2, retryCount);
		}
	}

	/**
	 * Check if an error is retryable with enhanced quota-aware logic.
	 *
	 * @private
	 * @param error - Error to check
	 * @returns Whether the error is retryable
	 */
	private isRetryableError(error: unknown): boolean {
		const err = error as {
			response?: { status: number; data?: Record<string, unknown> };
		};

		// Network errors are retryable
		if (!err.response) {
			return true;
		}

		const status = err.response.status;
		const responseData = err.response.data;

		// Quota errors (403) should NOT be retried
		if (status === 403 && this.isQuotaError(responseData)) {
			return false;
		}

		// Authorization errors (401) should NOT be retried
		if (status === 401) {
			return false;
		}

		// Validation errors (400) should NOT be retried
		if (status === 400) {
			return false;
		}

		// Device communication errors (503) ARE retryable
		if (status === 503) {
			return true;
		}

		// 5xx server errors are retryable
		if (status >= 500) {
			return true;
		}

		// 429 Too Many Requests is retryable
		if (status === 429) {
			return true;
		}

		// 408 Request Timeout is retryable
		if (status === 408) {
			return true;
		}

		// 404 Not Found should NOT be retried
		if (status === 404) {
			return false;
		}

		return false;
	}

	/**
	 * Handle API errors with enhanced error formatting and quota-specific handling.
	 *
	 * @private
	 * @param error - Original error
	 * @param context - Context message for the error
	 */
	private handleApiError(error: unknown, context: string): void {
		const err = error as {
			response?: {
				status: number;
				data?: ApiErrorResponse | { message?: string };
			};
			request?: unknown;
			message?: string;
		};

		if (err.response) {
			// Server responded with error status
			const status = err.response.status;
			const responseData = err.response.data;

			// Handle quota-specific errors (403 Forbidden)
			if (
				status === 403 &&
				this.isQuotaError(responseData as Record<string, unknown>)
			) {
				this.handleQuotaError(
					responseData as ApiErrorResponse,
					context
				);
				return;
			}

			// Handle device communication errors (503 Service Unavailable)
			if (status === 503) {
				this.handleDeviceCommunicationError(
					responseData as Record<string, unknown>,
					context
				);
				return;
			}

			// Handle validation errors (400 Bad Request)
			if (status === 400) {
				this.handleValidationError(
					responseData as Record<string, unknown>,
					context
				);
				return;
			}

			// Handle authorization errors (401 Unauthorized)
			if (status === 401) {
				this.handleAuthorizationError(
					responseData as Record<string, unknown>,
					context
				);
				return;
			}

			// Handle general server errors
			const message =
				this.extractErrorMessage(
					responseData as Record<string, unknown>
				) || err.message;
			console.error(`${context} (${status}):`, message);

			// Log additional error details if available
			if (
				this.isApiErrorResponse(
					responseData as Record<string, unknown>
				) &&
				(responseData as ApiErrorResponse).details
			) {
				console.error(
					"Error details:",
					(responseData as ApiErrorResponse).details
				);
			}
		} else if (err.request) {
			// Network error
			console.error(`${context} - Network error:`, err.message);
		} else {
			// Other error
			console.error(`${context}:`, err.message);
		}
	}

	/**
	 * Handle quota-specific errors with detailed information.
	 *
	 * @private
	 * @param errorData - API error response
	 * @param context - Context message
	 */
	private handleQuotaError(
		errorData: ApiErrorResponse,
		context: string
	): void {
		console.warn(`${context} - Quota exceeded:`, errorData.message);

		if (errorData.details) {
			const quotaDetails = errorData.details as QuotaErrorDetails;
			console.warn("Quota details:", {
				type: quotaDetails.quotaType,
				usage: `${quotaDetails.currentUsage}/${quotaDetails.limit}`,
				resetTime: quotaDetails.resetTime,
				overrideAvailable: quotaDetails.overrideAvailable,
			});
		}
	}

	/**
	 * Handle device communication errors.
	 *
	 * @private
	 * @param errorData - API error response
	 * @param context - Context message
	 */
	private handleDeviceCommunicationError(
		errorData: Record<string, unknown> | undefined,
		context: string
	): void {
		const message =
			this.extractErrorMessage(errorData) ||
			"Device communication failed";
		console.warn(`${context} - Device unavailable:`, message);

		if (errorData && this.isApiErrorResponse(errorData) && errorData.details) {
			console.warn("Device error details:", errorData.details);
		}
	}

	/**
	 * Handle validation errors with field-level details.
	 *
	 * @private
	 * @param errorData - API error response
	 * @param context - Context message
	 */
	private handleValidationError(
		errorData: Record<string, unknown> | undefined,
		context: string
	): void {
		const message =
			this.extractErrorMessage(errorData) || "Validation failed";
		console.error(`${context} - Validation error:`, message);

		if (errorData && this.isApiErrorResponse(errorData) && errorData.details) {
			console.error("Validation details:", errorData.details);
		}
	}

	/**
	 * Handle authorization errors.
	 *
	 * @private
	 * @param errorData - API error response
	 * @param context - Context message
	 */
	private handleAuthorizationError(
		errorData: Record<string, unknown> | undefined,
		context: string
	): void {
		const message =
			this.extractErrorMessage(errorData) || "Authorization failed";
		console.error(`${context} - Unauthorized:`, message);
	}

	/**
	 * Check if error response is quota-related.
	 *
	 * @private
	 * @param errorData - Error response data
	 * @returns True if error is quota-related
	 */
	private isQuotaError(
		errorData: Record<string, unknown> | undefined
	): boolean {
		if (!errorData || !this.isApiErrorResponse(errorData)) {
			return false;
		}

		const error =
			typeof errorData.error === "string"
				? errorData.error.toLowerCase()
				: "";
		const message =
			typeof errorData.message === "string"
				? errorData.message.toLowerCase()
				: "";

		return (
			error.includes("quota") ||
			message.includes("quota") ||
			message.includes("limit") ||
			message.includes("exceeded")
		);
	}

	/**
	 * Check if object is QuotaErrorDetails (type guard).
	 *
	 * @private
	 * @param data - Data to check
	 * @returns True if data is QuotaErrorDetails
	 */
	private isQuotaErrorDetails(data: unknown): data is QuotaErrorDetails {
		if (!data || typeof data !== "object") {
			return false;
		}
		const obj = data as Record<string, unknown>;
		return (
			typeof obj.quotaType === "string" &&
			typeof obj.currentUsage === "number" &&
			typeof obj.limit === "number" &&
			typeof obj.resetTime === "string" &&
			typeof obj.overrideAvailable === "boolean"
		);
	}

	/**
	 * Check if response data is an API error response.
	 *
	 * @private
	 * @param data - Response data
	 * @returns True if data is API error response
	 */
	private isApiErrorResponse(
		data: Record<string, unknown> | undefined
	): boolean {
		return (
			data !== undefined &&
			data !== null &&
			typeof data === "object" &&
			typeof data.error === "string" &&
			typeof data.message === "string" &&
			typeof data.status === "number"
		);
	}

	/**
	 * Extract error message from response data.
	 *
	 * @private
	 * @param errorData - Error response data
	 * @returns Error message or null
	 */
	private extractErrorMessage(
		errorData: Record<string, unknown> | undefined
	): string | null {
		if (errorData && this.isApiErrorResponse(errorData)) {
			const apiErrorResponse = errorData as unknown as ApiErrorResponse;
			return apiErrorResponse.message;
		}

		if (errorData && typeof errorData.message === "string") {
			return errorData.message;
		}

		return null;
	}

	/**
	 * Extract detailed error information from an API error.
	 *
	 * @param error - API error
	 * @returns Detailed error information
	 */
	extractErrorDetails(error: unknown): {
		status?: number;
		message: string;
		type:
			| "network"
			| "quota"
			| "validation"
			| "authorization"
			| "device_communication"
			| "server"
			| "unknown";
		details?: Record<string, unknown>;
		retryable: boolean;
	} {
		const err = error as {
			response?: {
				status: number;
				data?: ApiErrorResponse | { message?: string };
			};
			request?: unknown;
			message?: string;
		};

		if (err.response) {
			const status = err.response.status;
			const responseData = err.response.data;
			const message =
				this.extractErrorMessage(
					responseData as Record<string, unknown>
				) ||
				err.message ||
				"Unknown error";

			// Determine error type based on status and content
			let type:
				| "quota"
				| "validation"
				| "authorization"
				| "device_communication"
				| "server" = "server";

			if (
				status === 403 &&
				this.isQuotaError(responseData as Record<string, unknown>)
			) {
				type = "quota";
			} else if (status === 400) {
				type = "validation";
			} else if (status === 401) {
				type = "authorization";
			} else if (status === 503) {
				type = "device_communication";
			}

			return {
				status,
				message,
				type,
				details: this.isApiErrorResponse(
					responseData as Record<string, unknown>
				)
					? (responseData as ApiErrorResponse).details
					: undefined,
				retryable: this.isRetryableError(error),
			};
		} else if (err.request) {
			return {
				message: err.message || "Network error",
				type: "network",
				retryable: true,
			};
		} else {
			return {
				message: err.message || "Unknown error",
				type: "unknown",
				retryable: false,
			};
		}
	}

	/**
	 * Extract quota validation information from device control response.
	 *
	 * @param response - Device control response
	 * @returns Quota validation result or null if not present
	 */
	extractQuotaInfo(
		response: DeviceControlResponse
	): QuotaValidationResult | null {
		return response.quotaResult || null;
	}

	/**
	 * Extract session information from device control response.
	 *
	 * @param response - Device control response
	 * @returns Usage session or null if not present
	 */
	extractSessionInfo(response: DeviceControlResponse): UsageSession | null {
		return response.session || null;
	}

	/**
	 * Check if a device control operation was blocked by quota limits.
	 *
	 * @param response - Device control response
	 * @returns True if operation was blocked by quota
	 */
	isQuotaBlocked(response: DeviceControlResponse): boolean {
		return response.quotaResult?.status === "BLOCK" || false;
	}

	/**
	 * Check if a device control operation has quota warnings.
	 *
	 * @param response - Device control response
	 * @returns True if operation has quota warnings
	 */
	hasQuotaWarning(response: DeviceControlResponse): boolean {
		return response.quotaResult?.status === "ALLOW_WITH_WARNING" || false;
	}

	/**
	 * Check if a usage session was started by the operation.
	 *
	 * @param response - Device control response
	 * @returns True if session was started
	 */
	hasSessionStarted(response: DeviceControlResponse): boolean {
		return (
			response.session?.status === "ACTIVE" && !response.session.endedAt
		);
	}

	/**
	 * Check if a usage session was ended by the operation.
	 *
	 * @param response - Device control response
	 * @returns True if session was ended
	 */
	hasSessionEnded(response: DeviceControlResponse): boolean {
		return (
			response.session?.status === "COMPLETED" &&
			!!response.session.endedAt
		);
	}

	/**
	 * Get the updated room data from device control response.
	 *
	 * @param response - Device control response
	 * @returns Updated room data or null if not present
	 */
	getUpdatedRoom(response: DeviceControlResponse): Room | null {
		return response.updatedRoom || null;
	}

	/**
	 * Create a user-friendly error message from an API error.
	 *
	 * @param error - API error
	 * @returns User-friendly error message
	 */
	createUserFriendlyErrorMessage(error: unknown): string {
		const details = this.extractErrorDetails(error);

		switch (details.type) {
			case "quota":
				if (
					details.details &&
					this.isQuotaErrorDetails(details.details)
				) {
					const quotaDetails = details.details;
					return `Usage limit reached. You've used ${
						quotaDetails.currentUsage
					} of ${quotaDetails.limit} allowed. ${
						quotaDetails.overrideAvailable
							? "You can request an override."
							: ""
					}`;
				}
				return "Usage limit reached. Please wait or request an override.";

			case "device_communication":
				return "Device is currently unavailable. Please try again in a moment.";

			case "validation":
				return "Invalid request. Please check your input and try again.";

			case "authorization":
				return "You are not authorized to perform this action. Please log in again.";

			case "network":
				return "Network connection failed. Please check your internet connection and try again.";

			case "server":
				if (details.status && details.status >= 500) {
					return "Server error occurred. Please try again later.";
				}
				return details.message;

			default:
				return details.message;
		}
	}

	/**
	 * Check if an error should trigger a user notification.
	 *
	 * @param error - API error
	 * @returns True if error should be shown to user
	 */
	shouldNotifyUser(error: unknown): boolean {
		const details = this.extractErrorDetails(error);

		// Always notify for quota, validation, and authorization errors
		if (["quota", "validation", "authorization"].includes(details.type)) {
			return true;
		}

		// Notify for device communication errors
		if (details.type === "device_communication") {
			return true;
		}

		// Don't notify for network errors during retries
		if (details.type === "network" && details.retryable) {
			return false;
		}

		// Notify for server errors
		if (details.type === "server") {
			return true;
		}

		return true;
	}
}

/**
 * Singleton instance of RoomApiClientEnhanced.
 * Use this instance throughout the application.
 */
export const roomApiClient = new RoomApiClient();
