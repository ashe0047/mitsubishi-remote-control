"use client";

import { useCallback, useState } from "react";
import { useQuotaStore } from "@/stores/quota-store";
import { useAuthStore } from "@/stores/auth-store";
import { z } from "zod";
import {
  useQuotaWebSocket as useNewQuotaWebSocket,
  type UseQuotaWebSocketOptions,
  type QuotaMessage
} from "@/lib/quota/quota-websocket";

// Legacy message schemas for backward compatibility
const QuotaWebSocketMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("QUOTA_BALANCE_UPDATE"),
		data: z.object({
			userId: z.string(),
			roomId: z.string(),
			balance: z.object({
				quotaId: z.string(),
				userId: z.string(),
				roomId: z.string(),
				totalSeconds: z.number().optional(),
				usedSeconds: z.number().optional(),
				remainingSeconds: z.number().optional(),
				warningThreshold: z.number().optional(),
				lastUpdated: z.string().optional(),
				resetTime: z.string().optional(),
				isActive: z.boolean().optional(),
				isExceeded: z.boolean().optional(),
				hasOverride: z.boolean().optional(),
			}),
		}),
		timestamp: z.number(),
	}),
	z.object({
		type: z.literal("QUOTA_VIOLATION"),
		data: z.object({
			id: z.string(),
			userId: z.string(),
			roomId: z.string(),
			type: z.enum(["WARNING", "EXCEEDED", "BLOCKED"]),
			message: z.string(),
			timestamp: z.string(),
		}),
	}),
	z.object({
		type: z.literal("QUOTA_OVERRIDE_REQUEST"),
		data: z.object({
			id: z.string(),
			userId: z.string(),
			quotaId: z.string(),
			requestType: z.enum(["TEMPORARY_INCREASE", "TIME_EXTENSION", "EMERGENCY_OVERRIDE"]),
			status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
			duration: z.number().optional(),
			reason: z.string().optional(),
			urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).optional(),
			requestedAt: z.string(),
			respondedAt: z.string().optional(),
			approvedBy: z.string().optional(),
			responseReason: z.string().optional(),
		}),
	}),
]);

type QuotaWebSocketMessage = z.infer<typeof QuotaWebSocketMessageSchema>;

// Legacy connection state for backward compatibility
type ConnectionState = {
	status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
	retryCount: number;
	queuedMessages: number;
	lastConnected?: number;
	error?: string;
};

// Legacy hook options
interface UseQuotaWebSocketOptionsLegacy {
	familyMemberId?: string;
	roomId?: string;
	quotaId?: string;
	enableDebugMode?: boolean;
	maxReconnectAttempts?: number;
	reconnectDelay?: number;
	connectionTimeout?: number;
	messageQueueSize?: number;
}

// Legacy hook return type
interface QuotaWebSocketHookReturn {
	connectionState: ConnectionState;
	isConnected: boolean;
	isConnecting: boolean;
	isReconnecting: boolean;
	error: string | null;
	connect: () => Promise<boolean>;
	disconnect: () => Promise<void>;
	sendMessage: (message: any) => Promise<boolean>;
	sendHeartbeat: () => Promise<boolean>;
	clearQueue: () => void;
	getConnectionStats: () => any;
	forceReconnect: () => Promise<boolean>;
}

/**
 * Legacy useQuotaWebSocket hook that wraps the new quota WebSocket implementation.
 * Provides backward compatibility for existing components.
 *
 * @param options Configuration options for WebSocket connection
 * @returns Connection state and control functions
 */
export const useQuotaWebSocket = (options: UseQuotaWebSocketOptionsLegacy = {}): QuotaWebSocketHookReturn => {
	const { familyMemberId: propFamilyMemberId, roomId, quotaId, enableDebugMode } = options;

	// Get family member ID from auth store if not provided
	const { user } = useAuthStore();
	const familyMemberId = propFamilyMemberId || user?.id || '';

	// Local state for legacy compatibility
	const [error, setError] = useState<string | null>(null);

	// Convert new quota message to legacy format
	const convertToLegacyMessage = useCallback((quotaMessage: QuotaMessage): QuotaWebSocketMessage | null => {
		try {
			switch (quotaMessage.payload.action) {
				case 'QUOTA_UPDATE':
					return {
						type: 'QUOTA_BALANCE_UPDATE',
						data: {
							userId: quotaMessage.payload.familyMemberId,
							roomId: quotaMessage.payload.roomId || '',
							balance: {
								quotaId: quotaMessage.payload.quotaId,
								userId: quotaMessage.payload.familyMemberId,
								roomId: quotaMessage.payload.roomId || '',
								totalSeconds: quotaMessage.payload.dailyLimit,
								usedSeconds: quotaMessage.payload.currentUsage,
								remainingSeconds: quotaMessage.payload.dailyLimit && quotaMessage.payload.currentUsage
									? Math.max(0, quotaMessage.payload.dailyLimit - quotaMessage.payload.currentUsage)
									: undefined,
								warningThreshold: 75,
								lastUpdated: quotaMessage.payload.lastUpdated,
								isActive: quotaMessage.payload.isCurrentlyActive,
								isExceeded: quotaMessage.payload.status === 'EXCEEDED',
								hasOverride: quotaMessage.payload.status === 'PAUSED',
							},
						},
						timestamp: quotaMessage.timestamp || Date.now(),
					};

				case 'QUOTA_VIOLATION_ALERT':
					return {
						type: 'QUOTA_VIOLATION',
						data: {
							id: `${quotaMessage.payload.quotaId}-${Date.now()}`,
							userId: quotaMessage.payload.familyMemberId,
							roomId: quotaMessage.payload.roomId || '',
							type: quotaMessage.payload.violationType === 'LIMIT_EXCEEDED' ? 'EXCEEDED' :
								  quotaMessage.payload.violationType === 'WARNING_THRESHOLD' ? 'WARNING' : 'BLOCKED',
							message: `Quota ${quotaMessage.payload.violationType?.toLowerCase().replace('_', ' ')} in ${quotaMessage.payload.roomName || quotaMessage.payload.roomId}`,
							timestamp: quotaMessage.payload.timestamp || new Date().toISOString(),
						},
					};

				case 'OVERRIDE_REQUEST_CREATED':
				case 'OVERRIDE_REQUEST_UPDATED':
				case 'OVERRIDE_REQUEST_EXPIRED':
					return {
						type: 'QUOTA_OVERRIDE_REQUEST',
						data: {
							id: quotaMessage.payload.requestId || `${quotaMessage.payload.quotaId}-override`,
							userId: quotaMessage.payload.familyMemberId,
							quotaId: quotaMessage.payload.quotaId,
							requestType: quotaMessage.payload.requestType || 'TEMPORARY_INCREASE',
							status: quotaMessage.payload.status || 'PENDING',
							duration: quotaMessage.payload.duration,
							reason: quotaMessage.payload.reason,
							urgency: quotaMessage.payload.urgency,
							requestedAt: quotaMessage.payload.requestedAt || new Date().toISOString(),
							respondedAt: quotaMessage.payload.respondedAt,
							approvedBy: quotaMessage.payload.approvedBy,
							responseReason: quotaMessage.payload.responseReason,
						},
					};

				default:
					if (enableDebugMode) {
						console.warn('Unknown quota message action:', quotaMessage.payload.action);
					}
					return null;
			}
		} catch (error) {
			if (enableDebugMode) {
				console.error('Error converting quota message:', error, quotaMessage);
			}
			return null;
		}
	}, [enableDebugMode]);

	// Use the new quota WebSocket hook
	const newWebSocket = useNewQuotaWebSocket({
		familyMemberId,
		roomId,
		quotaId,
		onQuotaUpdate: (update) => {
			// Legacy message handling can be added here if needed
			if (enableDebugMode) {
				console.debug('Quota update received:', update);
			}
		},
		onOverrideRequest: (request) => {
			if (enableDebugMode) {
				console.debug('Override request received:', request);
			}
		},
		onViolationAlert: (alert) => {
			if (enableDebugMode) {
				console.debug('Violation alert received:', alert);
			}
		},
		onConnectionChange: (isConnected) => {
			if (!isConnected) {
				setError('WebSocket connection lost');
			} else {
				setError(null);
			}
		},
	});

	// Convert new connection state to legacy format
	const connectionState: ConnectionState = {
		status: newWebSocket.connectionState,
		retryCount: 0, // Not available in new client
		queuedMessages: 0, // Not available in new client
		lastConnected: newWebSocket.isConnected ? Date.now() : undefined,
		error: newWebSocket.connectionError || undefined,
	};

	// Legacy API implementation
	const connect = useCallback(async (): Promise<boolean> => {
		// Connection is handled automatically by the new hook
		return newWebSocket.isConnected;
	}, [newWebSocket.isConnected]);

	const disconnect = useCallback(async (): Promise<void> => {
		// Disconnect is handled by hook cleanup
		console.log('Disconnect requested - handled by hook cleanup');
	}, []);

	const sendMessage = useCallback(async (message: any): Promise<boolean> => {
		try {
			if (newWebSocket.sendMessage) {
				await newWebSocket.sendMessage(message);
				return true;
			}
			return false;
		} catch (error) {
			if (enableDebugMode) {
				console.error('Failed to send message:', error);
			}
			return false;
		}
	}, [newWebSocket.sendMessage, enableDebugMode]);

	const sendHeartbeat = useCallback(async (): Promise<boolean> => {
		// Heartbeat is handled internally by new client
		return true;
	}, []);

	const clearQueue = useCallback(() => {
		// Queue management is handled internally by new client
		console.log('Queue clear requested - handled internally');
	}, []);

	const getConnectionStats = useCallback(() => {
		return {
			isConnected: newWebSocket.isConnected,
			connectionState: newWebSocket.connectionState,
			error: newWebSocket.connectionError,
			lastMessage: newWebSocket.lastMessage,
		};
	}, [newWebSocket]);

	const forceReconnect = useCallback(async (): Promise<boolean> => {
		try {
			await newWebSocket.forceReconnect();
			return true;
		} catch (error) {
			if (enableDebugMode) {
				console.error('Force reconnect failed:', error);
			}
			return false;
		}
	}, [newWebSocket.forceReconnect, enableDebugMode]);

	return {
		connectionState,
		isConnected: newWebSocket.isConnected,
		isConnecting: newWebSocket.isConnecting,
		isReconnecting: newWebSocket.connectionState === 'connecting',
		error: newWebSocket.connectionError || error,
		connect,
		disconnect,
		sendMessage,
		sendHeartbeat,
		clearQueue,
		getConnectionStats,
		forceReconnect,
	};
};

export default useQuotaWebSocket;