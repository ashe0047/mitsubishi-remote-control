import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

// Import types from websocket-messages.interface for use within this file
import type {
  WebSocketContext,
  ConnectionMetrics,
  ValidatedMessage,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  WebSocketMessage,
} from './websocket-messages.interface';
import { ZodType } from 'zod';

// Re-export enums from websocket.enums
export {
  WebSocketErrorCode,
  WebSocketErrorCategory,
  DeviceType,
  QuotaType,
} from '../enums/websocket.enums';

/**
 * Main WebSocket gateway interface
 * Defines the contract for common WebSocket functionality
 */
export interface IWebSocketGateway {
  handleConnection(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): Promise<WebSocketContext>;
  handleDisconnect(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): Promise<void>;
  authenticateClient(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): Promise<AuthenticatedContext>;
  joinRoom(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    roomId: string,
  ): Promise<void>;
  leaveRoom(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    roomId: string,
  ): Promise<void>;
  broadcastToRoom(roomId: string, event: string, data: any): Promise<void>;
  getConnectionMetrics(): ConnectionMetrics;
}

/**
 * Device gateway interface
 * Extends base gateway for device-specific functionality
 */
// Note: Domain-specific gateway interfaces live in their respective modules

/**
 * Session manager interface
 * Handles WebSocket session lifecycle and management
 */
export interface IWebSocketSessionManager {
  registerSession(context: WebSocketContext): Promise<void>;
  unregisterSession(socketId: string): Promise<void>;
  getSession(socketId: string): Promise<WebSocketContext | undefined>;
  updateSessionContext(
    socketId: string,
    updates: Partial<WebSocketContext>,
  ): Promise<void>;
  getSessionsByRoom(roomId: string): Promise<WebSocketContext[]>;
  getSessionsByUser(userId: string): Promise<WebSocketContext[]>;
  getActiveSessionCount(): Promise<number>;
  cleanupInactiveSessions(): Promise<void>;
  getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    sessionsByRoom: Record<string, number>;
    sessionsByUser: Record<string, number>;
  }>;
}

/**
 * Message validator interface
 * Handles WebSocket message validation
 */
export interface IMessageValidator {
  validateMessage(
    message: unknown,
  ): Promise<ValidatedMessage<WebSocketMessage>>;
  validateWithSchema<T extends WebSocketMessage>(
    message: unknown,
    schema: ZodType<T>,
  ): Promise<ValidatedMessage<T>>;
  getSchemaVersion(): string;
}

/**
 * Event broadcast service interface
 * Handles real-time event broadcasting
 */
export interface IEventBroadcastService {
  broadcastToRoom(roomId: string, event: string, data: any): Promise<void>;
  broadcastToUser(userId: string, event: string, data: any): Promise<void>;
  broadcastToHousehold(
    householdId: string,
    event: string,
    data: any,
  ): Promise<void>;
  broadcastGlobal(event: string, data: any): Promise<void>;
  createEventStream(eventPattern: string): Observable<any>;
}

/**
 * Room manager interface
 * Manages WebSocket room memberships
 */
export interface IRoomManager {
  joinRoom(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    roomId: string,
  ): Promise<void>;
  leaveRoom(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    roomId: string,
  ): Promise<void>;
  getRoomMembers(roomId: string): string[];
  getUserRooms(userId: string): string[];
  getRoomCount(): number;
  cleanupEmptyRooms(): void;
}

/**
 * Authentication context interface
 */
export interface AuthenticatedContext {
  user: {
    id: string;
    email: string;
    householdId: string;
    role: string;
  };
  token: string;
  expiresAt: Date;
}

/**
 * Device update interface
 */
export interface DeviceUpdate {
  deviceId: string;
  deviceType: string;
  status: string;
  properties: Record<string, unknown>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Quota update interface
 */
export interface QuotaUpdate {
  quotaId: string;
  quotaType: string;
  householdId: string;
  currentUsage: number;
  limit: number;
  status: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
