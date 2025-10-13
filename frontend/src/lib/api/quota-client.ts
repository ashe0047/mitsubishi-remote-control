/**
 * Quota Management API Client
 * Provides seamless integration between frontend quota store and backend quota services
 * Migrated to use centralized axios client with enhanced error handling and validation
 */

import { axiosClient } from "../http/axios-client";
import type { ApiRequestConfig } from "../http/axios-client";
import type { QuotaBalance, UsageSummary } from "@/stores/quota-store";

// Backend API Types (matching Java backend DTOs)
export interface CreateQuotaRequest {
	userId: string;
	roomId: string;
	quotaType: "TIME_BASED" | "USAGE_COUNT" | "ENERGY_BASED" | "COST_BASED";
	allowedAmount: number;
	warningThreshold?: number;
}

export interface OverrideRequest {
	type: "ADD_TIME" | "UNLOCK_DAY" | "EMERGENCY_OVERRIDE";
	additionalSeconds?: number;
	reason?: string;
}

export interface QuotaBackendResponse {
	id: string;
	userId: string;
	targetId: string; // roomId in backend
	quotaType: string;
	allowedAmount: number;
	usedAmount: number;
	status: string;
	warningThresholds: number[];
	createdAt: string;
	updatedAt: string;
}

export interface UsageSessionResponse {
	id: string;
	userId: string;
	roomId: string;
	startedAt: string;
	endedAt?: string;
	durationMinutes?: number;
	temperatureSet?: number;
	mode?: string;
	fanSpeed?: string;
	energyConsumed?: number;
	estimatedCost?: number;
	status: string;
}

// WebSocket Integration Types
export interface QuotaWebSocketMessage {
	type: 'QUOTA_UPDATE' | 'QUOTA_VIOLATION' | 'OVERRIDE_REQUEST' | 'OVERRIDE_RESPONSE';
	payload: any;
	timestamp?: string;
	userId?: string;
	roomId?: string;
	quotaId?: string;
}

export interface QuotaUpdateWebSocketPayload {
	quotaId: string;
	userId: string;
	roomId: string;
	currentUsage: number;
	dailyLimit: number;
	status: 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'OVERRIDE_ACTIVE';
	lastUpdated: string;
	isCurrentlyActive: boolean;
	sessionStartTime?: string;
	estimatedSessionUsage: number;
}

export interface QuotaViolationWebSocketPayload {
	quotaId: string;
	userId: string;
	roomId: string;
	violationType: 'WARNING_THRESHOLD' | 'LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS';
	currentUsage: number;
	limit: number;
	timestamp: string;
	message: string;
}

export interface QuotaSubscriptionResponse {
	subscriptionId: string;
	initialBalance: QuotaBalance;
}

/**
 * Quota Management API Client
 * Handles all quota-related API communications with proper authentication and error handling
 * Uses centralized axios client with interceptors for authentication, retry logic, and error transformation
 */
export class QuotaApiClient {
	private readonly baseUrl = "/api/quotas";
	private readonly usageUrl = "/api/usage";
	private readonly airconUrl = "/api/aircon";

	/**
	 * Create or update a quota for a user in a specific room
	 */
	async createOrUpdateQuota(
		request: CreateQuotaRequest,
		config?: ApiRequestConfig
	): Promise<QuotaBackendResponse> {
		try {
			return await axiosClient.post<QuotaBackendResponse>(
				this.baseUrl,
				request,
				{
					...config,
					deduplicationKey: `create-quota-${request.userId}-${request.roomId}`,
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to create quota: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get current quota balance for a user in a room
	 */
	async getQuotaBalance(
		userId: string,
		roomId: string,
		config?: ApiRequestConfig
	): Promise<QuotaBalance> {
		try {
			const backendBalance = await axiosClient.get<Record<string, unknown>>(
				`${this.baseUrl}/user/${userId}?roomId=${encodeURIComponent(roomId)}`,
				{
					...config,
					deduplicationKey: `quota-balance-${userId}-${roomId}`,
				}
			);
			return this.transformBackendBalance(backendBalance);
		} catch (error: any) {
			// Handle 404 as no quota configured
			if (error.status === 404) {
				return this.createEmptyBalance(userId, roomId);
			}
			throw new Error(
				`Failed to get quota balance: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get all quotas for a user
	 */
	async getAllUserQuotas(
		userId: string,
		config?: ApiRequestConfig
	): Promise<QuotaBackendResponse[]> {
		try {
			return await axiosClient.get<QuotaBackendResponse[]>(
				`${this.baseUrl}/user/${userId}/all`,
				{
					...config,
					deduplicationKey: `user-quotas-${userId}`,
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to get user quotas: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Request quota override (parent privileges required)
	 */
	async requestOverride(
		quotaId: string,
		overrideRequest: OverrideRequest,
		config?: ApiRequestConfig
	): Promise<{
		message: string;
		quotaId: string;
		overrideType: string;
		grantedAt: string;
	}> {
		try {
			return await axiosClient.post<{
				message: string;
				quotaId: string;
				overrideType: string;
				grantedAt: string;
			}>(
				`${this.baseUrl}/${quotaId}/override`,
				overrideRequest,
				{
					...config,
					priority: 'high', // Override requests are high priority
				}
			);
		} catch (error) {
			throw new Error(
				`Override request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Delete a quota (parent privileges required)
	 */
	async deleteQuota(
		quotaId: string,
		config?: ApiRequestConfig
	): Promise<{ message: string }> {
		try {
			return await axiosClient.delete<{ message: string }>(
				`${this.baseUrl}/${quotaId}`,
				{
					...config,
					priority: 'high', // Delete operations are high priority
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to delete quota: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get usage summaries for a user within a date range
	 */
	async getUsageSummaries(
		userId: string,
		startDate: string,
		endDate: string,
		config?: ApiRequestConfig
	): Promise<UsageSummary[]> {
		try {
			const sessions = await axiosClient.get<UsageSessionResponse[]>(
				`${this.usageUrl}/summary/${userId}?start=${startDate}&end=${endDate}`,
				{
					...config,
					deduplicationKey: `usage-summaries-${userId}-${startDate}-${endDate}`,
				}
			);
			return this.transformSessionsToSummaries(sessions);
		} catch (error) {
			throw new Error(
				`Failed to get usage summaries: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Start a new usage session (when AC is turned on)
	 */
	async startUsageSession(
		userId: string,
		roomId: string,
		initialSettings: Record<string, unknown>,
		config?: ApiRequestConfig
	): Promise<string> {
		try {
			const session = await axiosClient.post<{ id: string }>(
				`${this.usageUrl}/sessions`,
				{
					userId,
					roomId,
					initialSettings,
				},
				{
					...config,
					priority: 'high', // Session start is high priority
				}
			);
			return session.id;
		} catch (error) {
			throw new Error(
				`Failed to start usage session: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * End a usage session (when AC is turned off)
	 */
	async endUsageSession(
		sessionId: string,
		finalSettings: Record<string, unknown>,
		config?: ApiRequestConfig
	): Promise<void> {
		try {
			await axiosClient.post<void>(
				`${this.usageUrl}/sessions/${sessionId}/end`,
				{
					finalSettings,
				},
				{
					...config,
					priority: 'high', // Session end is high priority
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to end usage session: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Validate if a command would exceed quota
	 */
	async validateCommand(
		userId: string,
		roomId: string,
		command: Record<string, unknown>,
		config?: ApiRequestConfig
	): Promise<{ allowed: boolean; reason?: string; warning?: string }> {
		try {
			return await axiosClient.post<{
				allowed: boolean;
				reason?: string;
				warning?: string;
			}>(
				`${this.airconUrl}/validate`,
				{
					userId,
					roomId,
					command,
				},
				{
					...config,
					priority: 'high', // Command validation is high priority
					timeout: 5000, // Short timeout for validation
				}
			);
		} catch (error) {
			// If validation service is down, fail open (allow command)
			console.warn(
				"Quota validation service unavailable, allowing command:",
				error instanceof Error ? error.message : 'Unknown error'
			);
			return { 
				allowed: true, 
				reason: "Validation service unavailable",
				warning: "Could not validate quota limits"
			};
		}
	}

	/**
	 * Get quota status for multiple users/rooms in a single request
	 * Enhanced method for batch operations
	 */
	async getBatchQuotaStatus(
		requests: Array<{ userId: string; roomId: string }>,
		config?: ApiRequestConfig
	): Promise<Array<{ userId: string; roomId: string; balance: QuotaBalance | null; error?: string }>> {
		try {
			const results = await Promise.allSettled(
				requests.map(async ({ userId, roomId }) => {
					try {
						const balance = await this.getQuotaBalance(userId, roomId, {
							...config,
							deduplicationKey: `batch-quota-${userId}-${roomId}`,
						});
						return { userId, roomId, balance };
					} catch (error) {
						return {
							userId,
							roomId,
							balance: null,
							error: error instanceof Error ? error.message : 'Unknown error',
						};
					}
				})
			);

			return results.map((result) => {
				if (result.status === 'fulfilled') {
					return result.value;
				} else {
					// This shouldn't happen since we catch errors above, but just in case
					return {
						userId: '',
						roomId: '',
						balance: null,
						error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
					};
				}
			});
		} catch (error) {
			throw new Error(
				`Failed to get batch quota status: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Update quota settings (enhanced method for configuration updates)
	 */
	async updateQuotaSettings(
		quotaId: string,
		settings: {
			allowedAmount?: number;
			warningThreshold?: number;
			quotaType?: "TIME_BASED" | "USAGE_COUNT" | "ENERGY_BASED" | "COST_BASED";
		},
		config?: ApiRequestConfig
	): Promise<QuotaBackendResponse> {
		try {
			return await axiosClient.patch<QuotaBackendResponse>(
				`${this.baseUrl}/${quotaId}`,
				settings,
				{
					...config,
					priority: 'normal',
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to update quota settings: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get quota history for analytics and reporting
	 */
	async getQuotaHistory(
		userId: string,
		roomId: string,
		startDate: string,
		endDate: string,
		config?: ApiRequestConfig
	): Promise<Array<{
		date: string;
		totalUsed: number;
		quotaLimit: number;
		violationCount: number;
		overrideCount: number;
	}>> {
		try {
			return await axiosClient.get<Array<{
				date: string;
				totalUsed: number;
				quotaLimit: number;
				violationCount: number;
				overrideCount: number;
			}>>(
				`${this.baseUrl}/history/${userId}?roomId=${encodeURIComponent(roomId)}&start=${startDate}&end=${endDate}`,
				{
					...config,
					deduplicationKey: `quota-history-${userId}-${roomId}-${startDate}-${endDate}`,
				}
			);
		} catch (error) {
			throw new Error(
				`Failed to get quota history: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// ===== WEBSOCKET INTEGRATION PREPARATION METHODS =====

	/**
	 * Prepare quota client for reconnecting-websocket integration
	 * This method sets up message handlers and state synchronization
	 */
	private websocketMessageHandlers: Map<string, (message: any) => void> = new Map();
	private websocketFallbackEnabled: boolean = true;

	/**
	 * Register WebSocket message handler for quota updates
	 */
	registerWebSocketHandler(messageType: string, handler: (message: any) => void): void {
		this.websocketMessageHandlers.set(messageType, handler);
	}

	/**
	 * Unregister WebSocket message handler
	 */
	unregisterWebSocketHandler(messageType: string): void {
		this.websocketMessageHandlers.delete(messageType);
	}

	/**
	 * Handle incoming WebSocket messages for quota updates
	 */
	handleWebSocketMessage(message: {
		type: string;
		payload: any;
		timestamp?: string;
		userId?: string;
		roomId?: string;
	}): void {
		const handler = this.websocketMessageHandlers.get(message.type);
		if (handler) {
			try {
				handler(message);
			} catch (error) {
				console.error(`Error handling WebSocket message type ${message.type}:`, error);
			}
		}
	}

	/**
	 * Synchronize quota state with WebSocket updates
	 * This method ensures consistency between HTTP API and WebSocket data
	 */
	async synchronizeQuotaState(
		userId: string,
		roomId: string,
		websocketData: {
			quotaId: string;
			currentUsage: number;
			dailyLimit: number;
			status: string;
			lastUpdated: string;
		},
		config?: ApiRequestConfig
	): Promise<QuotaBalance> {
		try {
			// First try to get the latest data from HTTP API as fallback
			let httpBalance: QuotaBalance | null = null;
			
			if (this.websocketFallbackEnabled) {
				try {
					httpBalance = await this.getQuotaBalance(userId, roomId, {
						...config,
						timeout: 3000, // Short timeout for sync operation
					});
				} catch (error) {
					console.warn('HTTP fallback failed during quota sync:', error);
				}
			}

			// Create synchronized balance from WebSocket data
			const syncedBalance: QuotaBalance = {
				quotaId: websocketData.quotaId,
				userId,
				roomId,
				totalSeconds: websocketData.dailyLimit,
				usedSeconds: websocketData.currentUsage,
				remainingSeconds: Math.max(0, websocketData.dailyLimit - websocketData.currentUsage),
				warningThreshold: httpBalance?.warningThreshold || 75,
				lastUpdated: websocketData.lastUpdated,
				resetTime: httpBalance?.resetTime,
				isActive: websocketData.status === 'ACTIVE',
				isExceeded: websocketData.status === 'EXCEEDED',
				hasOverride: websocketData.status === 'OVERRIDE_ACTIVE',
				// Preserve other fields from HTTP data if available
				totalUsageCount: httpBalance?.totalUsageCount,
				usedUsageCount: httpBalance?.usedUsageCount,
				remainingUsageCount: httpBalance?.remainingUsageCount,
				totalEnergyKwh: httpBalance?.totalEnergyKwh,
				usedEnergyKwh: httpBalance?.usedEnergyKwh,
				remainingEnergyKwh: httpBalance?.remainingEnergyKwh,
				totalCostAmount: httpBalance?.totalCostAmount,
				usedCostAmount: httpBalance?.usedCostAmount,
				remainingCostAmount: httpBalance?.remainingCostAmount,
			};

			return syncedBalance;
		} catch (error) {
			throw new Error(
				`Failed to synchronize quota state: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Enable or disable WebSocket fallback to HTTP API
	 */
	setWebSocketFallbackEnabled(enabled: boolean): void {
		this.websocketFallbackEnabled = enabled;
	}

	/**
	 * Get WebSocket fallback status
	 */
	isWebSocketFallbackEnabled(): boolean {
		return this.websocketFallbackEnabled;
	}

	/**
	 * Prepare quota operations for WebSocket message-based communication
	 * This method queues operations when WebSocket is disconnected
	 */
	private messageQueue: Array<{
		type: string;
		payload: any;
		timestamp: number;
		retryCount: number;
	}> = [];
	private maxQueueSize: number = 100;
	private maxRetries: number = 3;

	/**
	 * Queue a message for WebSocket transmission
	 */
	queueWebSocketMessage(type: string, payload: any): void {
		if (this.messageQueue.length >= this.maxQueueSize) {
			// Remove oldest message to make room
			this.messageQueue.shift();
		}

		this.messageQueue.push({
			type,
			payload,
			timestamp: Date.now(),
			retryCount: 0,
		});
	}

	/**
	 * Process queued messages when WebSocket reconnects
	 */
	processQueuedMessages(sendMessage: (type: string, payload: any) => void): void {
		const now = Date.now();
		const maxAge = 5 * 60 * 1000; // 5 minutes

		// Filter out expired messages and process remaining ones
		this.messageQueue = this.messageQueue.filter(message => {
			if (now - message.timestamp > maxAge) {
				return false; // Remove expired message
			}

			if (message.retryCount < this.maxRetries) {
				try {
					sendMessage(message.type, message.payload);
					return false; // Remove successfully sent message
				} catch (error) {
					message.retryCount++;
					console.warn(`Failed to send queued message (attempt ${message.retryCount}):`, error);
					return message.retryCount < this.maxRetries; // Keep if under retry limit
				}
			}

			return false; // Remove message that exceeded retry limit
		});
	}

	/**
	 * Get queued message count for monitoring
	 */
	getQueuedMessageCount(): number {
		return this.messageQueue.length;
	}

	/**
	 * Clear all queued messages
	 */
	clearMessageQueue(): void {
		this.messageQueue = [];
	}

	/**
	 * WebSocket fallback operations - these methods provide HTTP fallback
	 * when WebSocket operations fail or are unavailable
	 */

	/**
	 * Subscribe to quota updates with HTTP fallback
	 */
	async subscribeToQuotaUpdates(
		userId: string,
		roomId: string,
		config?: ApiRequestConfig
	): Promise<{ subscriptionId: string; initialBalance: QuotaBalance }> {
		try {
			// For HTTP fallback, we simulate subscription by getting initial balance
			const initialBalance = await this.getQuotaBalance(userId, roomId, config);
			const subscriptionId = `http-fallback-${userId}-${roomId}-${Date.now()}`;
			
			return {
				subscriptionId,
				initialBalance,
			};
		} catch (error) {
			throw new Error(
				`Failed to subscribe to quota updates: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Unsubscribe from quota updates
	 */
	async unsubscribeFromQuotaUpdates(subscriptionId: string): Promise<void> {
		// For HTTP fallback, this is a no-op since we don't maintain server-side subscriptions
		console.log(`Unsubscribed from quota updates: ${subscriptionId}`);
	}

	/**
	 * Poll for quota updates when WebSocket is unavailable
	 */
	async pollQuotaUpdates(
		userId: string,
		roomId: string,
		lastUpdateTime?: string,
		config?: ApiRequestConfig
	): Promise<QuotaBalance | null> {
		try {
			const balance = await this.getQuotaBalance(userId, roomId, {
				...config,
				deduplicationKey: `poll-quota-${userId}-${roomId}`,
			});

			// Return balance only if it's newer than lastUpdateTime
			if (lastUpdateTime && balance.lastUpdated <= lastUpdateTime) {
				return null; // No updates
			}

			return balance;
		} catch (error) {
			console.warn('Failed to poll quota updates:', error);
			return null;
		}
	}

	/**
	 * Transform backend quota balance to frontend format
	 */
	private transformBackendBalance(backendBalance: Record<string, unknown>): QuotaBalance {
		return {
			quotaId: String(backendBalance.quotaId ?? ""),
			userId: String(backendBalance.userId ?? ""),
			roomId: String(backendBalance.roomId ?? ""),
			totalSeconds: backendBalance.totalSeconds as number | undefined,
			usedSeconds: backendBalance.usedSeconds as number | undefined,
			remainingSeconds: backendBalance.remainingSeconds as number | undefined,
			totalUsageCount: backendBalance.totalUsageCount as number | undefined,
			usedUsageCount: backendBalance.usedUsageCount as number | undefined,
			remainingUsageCount: backendBalance.remainingUsageCount as number | undefined,
			totalEnergyKwh: backendBalance.totalEnergyKwh as number | undefined,
			usedEnergyKwh: backendBalance.usedEnergyKwh as number | undefined,
			remainingEnergyKwh: backendBalance.remainingEnergyKwh as number | undefined,
			totalCostAmount: backendBalance.totalCostAmount as number | undefined,
			usedCostAmount: backendBalance.usedCostAmount as number | undefined,
			remainingCostAmount: backendBalance.remainingCostAmount as number | undefined,
			warningThreshold: (backendBalance.warningThreshold as number | undefined) || 75,
			lastUpdated: (backendBalance.lastUpdated as string | undefined) || new Date().toISOString(),
			resetTime: backendBalance.resetTime as string | undefined,
			isActive: Boolean(backendBalance.isActive),
			isExceeded: backendBalance.isExceeded as boolean | undefined,
			hasOverride: false,
		};
	}

	/**
	 * Create empty balance for users without quotas
	 */
	private createEmptyBalance(userId: string, roomId: string): QuotaBalance {
		return {
			quotaId: "",
			userId,
			roomId,
			warningThreshold: 75,
			lastUpdated: new Date().toISOString(),
			isActive: false,
			isExceeded: false,
			hasOverride: false,
		};
	}

	/**
	 * Transform usage sessions to summaries for frontend consumption
	 */
	private transformSessionsToSummaries(
		sessions: UsageSessionResponse[]
	): UsageSummary[] {
		// Group by userId, roomId, and date
		const grouped = sessions.reduce((acc, session) => {
			const date = new Date(session.startedAt)
				.toISOString()
				.split("T")[0];
			const key = `${session.userId}:${session.roomId}:${date}`;

			if (!acc[key]) {
				acc[key] = {
					userId: session.userId,
					roomId: session.roomId,
					date,
					sessions: [],
				};
			}

			acc[key].sessions.push(session);
			return acc;
		}, {} as Record<string, { userId: string; roomId: string; date: string; sessions: UsageSessionResponse[] }>);

		// Transform to summaries
		return Object.values(grouped).map((group) => ({
			userId: group.userId,
			roomId: group.roomId,
			date: group.date,
			totalDurationSeconds: group.sessions.reduce(
				(sum, s) => sum + (s.durationMinutes || 0) * 60,
				0
			),
			sessionCount: group.sessions.length,
			avgSessionDurationSeconds:
				group.sessions.length > 0
					? group.sessions.reduce(
							(sum, s) => sum + (s.durationMinutes || 0) * 60,
							0
					  ) / group.sessions.length
					: 0,
			energyUsedKwh: group.sessions.reduce(
				(sum, s) => sum + (s.energyConsumed || 0),
				0
			),
			costIncurred: group.sessions.reduce(
				(sum, s) => sum + (s.estimatedCost || 0),
				0
			),
		}));
	}
}

// Export singleton instance
export const quotaApiClient = new QuotaApiClient();

// Helper hooks for React components
export const useQuotaApi = () => {
	return {
		createQuota: quotaApiClient.createOrUpdateQuota.bind(quotaApiClient),
		getBalance: quotaApiClient.getQuotaBalance.bind(quotaApiClient),
		getAllQuotas: quotaApiClient.getAllUserQuotas.bind(quotaApiClient),
		requestOverride: quotaApiClient.requestOverride.bind(quotaApiClient),
		deleteQuota: quotaApiClient.deleteQuota.bind(quotaApiClient),
		getUsageSummaries: quotaApiClient.getUsageSummaries.bind(quotaApiClient),
		startSession: quotaApiClient.startUsageSession.bind(quotaApiClient),
		endSession: quotaApiClient.endUsageSession.bind(quotaApiClient),
		validateCommand: quotaApiClient.validateCommand.bind(quotaApiClient),
		// Enhanced methods
		getBatchStatus: quotaApiClient.getBatchQuotaStatus.bind(quotaApiClient),
		updateSettings: quotaApiClient.updateQuotaSettings.bind(quotaApiClient),
		getHistory: quotaApiClient.getQuotaHistory.bind(quotaApiClient),
		// WebSocket integration methods
		registerWebSocketHandler: quotaApiClient.registerWebSocketHandler.bind(quotaApiClient),
		unregisterWebSocketHandler: quotaApiClient.unregisterWebSocketHandler.bind(quotaApiClient),
		handleWebSocketMessage: quotaApiClient.handleWebSocketMessage.bind(quotaApiClient),
		synchronizeQuotaState: quotaApiClient.synchronizeQuotaState.bind(quotaApiClient),
		setWebSocketFallbackEnabled: quotaApiClient.setWebSocketFallbackEnabled.bind(quotaApiClient),
		isWebSocketFallbackEnabled: quotaApiClient.isWebSocketFallbackEnabled.bind(quotaApiClient),
		queueWebSocketMessage: quotaApiClient.queueWebSocketMessage.bind(quotaApiClient),
		processQueuedMessages: quotaApiClient.processQueuedMessages.bind(quotaApiClient),
		getQueuedMessageCount: quotaApiClient.getQueuedMessageCount.bind(quotaApiClient),
		clearMessageQueue: quotaApiClient.clearMessageQueue.bind(quotaApiClient),
		subscribeToQuotaUpdates: quotaApiClient.subscribeToQuotaUpdates.bind(quotaApiClient),
		unsubscribeFromQuotaUpdates: quotaApiClient.unsubscribeFromQuotaUpdates.bind(quotaApiClient),
		pollQuotaUpdates: quotaApiClient.pollQuotaUpdates.bind(quotaApiClient),
	};
};

export default quotaApiClient;
