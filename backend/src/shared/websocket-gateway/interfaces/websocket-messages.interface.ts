import { Socket } from 'socket.io';
import type {
  AuthenticatedContext,
  DeviceUpdate,
} from './websocket-gateway.interface';
import z from 'zod';
import { webSocketMessageSchema } from '../schemas';

/**
 * Socket.IO event interfaces for type safety
 */
export interface ServerToClientEvents {
  connection_status: (data: { status: string; timestamp: number }) => void;
  // Domain-specific responses are typed in domain modules
  device_response: (data: unknown) => void;
  quota_response: (data: unknown) => void;
  error: (data: WsErrorResponse) => void;
  health_check: (data: HealthResponse) => void;
  broadcast_update: (data: BroadcastUpdatePayload) => void;
}

export interface ClientToServerEvents {
  // Domain-specific messages are typed in domain modules
  device_command: (data: unknown) => void;
  quota_operation: (data: unknown) => void;
  health_check: (data: unknown) => void;
  error: (data: WsErrorResponse) => void;
  ping: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  householdId: string;
  familyMemberId: string;
  authenticatedAt: number;
  authenticatedContext?: AuthenticatedContext;
}

/**
 * Discriminated payload for universal broadcast_update events
 */
export type BroadcastUpdatePayload = {
  kind: 'device_status';
  update: DeviceUpdate;
  roomId: string;
  timestamp: string;
};

/**
 * Core WebSocket message interface
 * Base interface for all WebSocket communications
 */
export type WebSocketMessage = z.infer<typeof webSocketMessageSchema>;

/**
 * Quota-specific operation message
 */
// Note: QuotaOperationMessage now lives under quotas/websocket/contracts

/**
 * Validated message after schema validation
 */
export interface ValidatedMessage<T extends WebSocketMessage>
  extends Omit<WebSocketMessage, 'command' | 'data'> {
  command: T['command'];
  data: T['data'];
  validatedData: T;
  schemaVersion: string;
  validatedAt: Date;
}

/**
 * Command response from strategy processing
 */
export interface CommandResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime: number;
  deviceId?: string;
  commandId: string;
  timestamp: Date;
  metadata: {
    strategy: string;
    gatewayType: 'device' | 'quota';
    command?: string;
    sessionId?: string;
    executionContext?: Record<string, unknown>;
  };
}

/**
 * Device response sent to client
 */
// Note: DeviceResponse now lives under devices/websocket/contracts

/**
 * Quota response sent to client
 */
// Note: QuotaResponse now lives under quotas/websocket/contracts

/**
 * WebSocket connection context
 */
export interface WebSocketContext {
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  user: {
    id: string;
    email: string;
    householdId: string;
  };
  sessionId: string;
  roomId: string;
  lastActivity: Date;
  connectedAt: Date;
  metadata: {
    namespace: string;
    userAgent: string;
    ip: string;
  };
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  roomId: string;
  userId: string;
  householdId: string;
  timestamp: string;
}

/**
 * Error response format
 */
export interface WsErrorResponse extends CommandResponse {
  success: false;
  error: string;
  errorCode: string;
  errorCategory:
    | 'validation'
    | 'authorization'
    | 'execution'
    | 'infrastructure';
  stackTrace?: string;
  retryable: boolean;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  gateway: string;
  metrics: {
    connectionCount: number;
    deviceGatewayConnections?: number;
    quotaGatewayConnections?: number;
    activeStrategies: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Connection metrics
 */
export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByNamespace: Record<string, number>;
  averageConnectionDuration: number;
  messagesPerSecond: number;
  errorRate: number;
}

/**
 * Device connection statistics
 */
export interface DeviceConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsByDeviceType: Record<string, number>;
  averageResponseTime: number;
  commandsProcessed: number;
  errorRate: number;
}

/**
 * Quota connection statistics
 */
export interface QuotaConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsByQuotaType: Record<string, number>;
  averageResponseTime: number;
  operationsProcessed: number;
  errorRate: number;
}

/**
 * Validated device command interface
 */
// Note: ValidatedDeviceMessage lives in devices domain using ValidatedMessage<T>

/**
 * Validated quota operation interface
 */
// Note: ValidatedQuotaMessage lives in quotas domain using ValidatedMessage<T>

/**
 * Quota capabilities interface
 */
export interface QuotaCapabilities {
  quotaType: string;
  supportedOperations: string[];
  supportedPolicies: string[];
  requiresApproval: boolean;
  maxOverrideDuration: number;
  supportedTimezones: string[];
}
