import { Socket } from 'socket.io';
import { JwtClaims } from '../../types/auth';

/**
 * WebSocket connection context information
 */
export interface WebSocketConnectionContext {
  socket: Socket;
  user: {
    id: string;
    email: string;
    householdId: string;
    familyMemberId: string;
  };
  roomId: string;
  familyMemberId: string;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

/**
 * WebSocket message processing result
 */
export interface WebSocketMessageResult {
  success: boolean;
  data?: any;
  error?: string;
  broadcastTargets?: string[];
}

/**
 * Performance metrics for WebSocket operations
 */
export interface WebSocketMetrics {
  connectionTime: number;
  messageProcessingTime: number;
  broadcastTime: number;
  totalConnections: number;
  activeConnections: number;
  messagesPerSecond: number;
  averageLatency: number;
}

/**
 * Room-based subscription information
 */
export interface RoomSubscription {
  roomId: string;
  userId: string;
  householdId: string;
  socketId: string;
  subscribedAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
}

/**
 * Event broadcasting configuration
 */
export interface BroadcastConfig {
  targetRooms?: string[];
  targetUsers?: string[];
  targetHouseholds?: string[];
  excludeSelf?: boolean;
  requireActiveConnection?: boolean;
}

/**
 * WebSocket command types for air conditioner control
 */
export enum AirConditionerCommandType {
  SET_POWER = 'SET_POWER',
  SET_TEMPERATURE = 'SET_TEMPERATURE',
  SET_MODE = 'SET_MODE',
  SET_FAN = 'SET_FAN',
  SET_VANE = 'SET_VANE',
  SET_WIDEVANE = 'SET_WIDEVANE',
  GET_STATUS = 'GET_STATUS',
  STATE_UPDATE = 'STATE_UPDATE',
}

/**
 * WebSocket command types for quota management
 */
export enum QuotaCommandType {
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  OVERRIDE_REQUEST = 'OVERRIDE_REQUEST',
  OVERRIDE_APPROVAL = 'OVERRIDE_APPROVAL',
  HEALTH_CHECK = 'HEALTH_CHECK',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  STATUS_UPDATE = 'STATUS_UPDATE',
}

/**
 * Air conditioner control command data
 */
export interface AirConditionerCommandData {
  roomId: string;
  familyMemberId: string;
  deviceId?: string;
  command: AirConditionerCommandType;
  parameters: {
    power?: 'on' | 'off';
    temperature?: number;
    mode?: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only';
    fan?: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET';
    vane?: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING';
    wideVane?: '<<' | '<' | '|' | '>' | '>>' | 'SWING';
  };
}

/**
 * Quota management command data
 */
export interface QuotaCommandData {
  quotaId: string;
  roomId: string;
  familyMemberId: string;
  command: QuotaCommandType;
  parameters: {
    subscriptionType?: 'status' | 'alerts' | 'all';
    overrideReason?: string;
    overrideDuration?: number;
    requestedBy?: string;
    approvedBy?: string;
    threshold?: number;
    overrideId?: string;
  };
}

/**
 * Device status update data
 */
export interface DeviceStatusUpdateData {
  roomId: string;
  deviceId: string;
  status: {
    power: 'on' | 'off';
    temperature?: number;
    mode?: string;
    fanSpeed?: string;
    vanePosition?: string;
    wideVanePosition?: string;
    roomTemperature?: number;
    energyConsumption?: number;
    lastUpdated: string;
  };
  source: 'mqtt' | 'api' | 'websocket';
}

/**
 * Quota status update data
 */
export interface QuotaStatusUpdateData {
  quotaId: string;
  roomId: string;
  status: {
    currentUsage: number;
    allowedLimit: number;
    percentageUsed: number;
    isExceeded: boolean;
    warnings: string[];
    lastOverride?: {
      requestedBy: string;
      approvedBy: string;
      reason: string;
      expiresAt: string;
    };
  };
  timestamp: string;
}

/**
 * WebSocket event types for real-time updates
 */
export enum WebSocketEventType {
  DEVICE_STATUS_CHANGED = 'device.status.changed',
  QUOTA_STATUS_CHANGED = 'quota.status.changed',
  OVERRIDE_REQUESTED = 'override.requested',
  OVERRIDE_APPROVED = 'override.approved',
  WARNING_THRESHOLD_REACHED = 'warning.threshold.reached',
  SYSTEM_STATUS_CHANGED = 'system.status.changed',
  CONNECTION_ESTABLISHED = 'connection.established',
  CONNECTION_LOST = 'connection.lost',
}

/**
 * Real-time event data
 */
export interface WebSocketEventData {
  type: WebSocketEventType;
  roomId?: string;
  quotaId?: string;
  userId?: string;
  householdId?: string;
  data: any;
  timestamp: string;
  source: string;
}

/**
 * WebSocket room management interface
 */
export interface IWebSocketRoomManager {
  addClientToRoom(
    socketId: string,
    roomId: string,
    context: WebSocketConnectionContext,
  ): Promise<void>;
  removeClientFromRoom(socketId: string, roomId: string): Promise<void>;
  getClientsInRoom(roomId: string): Promise<WebSocketConnectionContext[]>;
  getRoomsForClient(socketId: string): Promise<string[]>;
  broadcastToRoom(roomId: string, event: string, data: any): Promise<void>;
  broadcastToUsers(userIds: string[], event: string, data: any): Promise<void>;
}

/**
 * WebSocket authentication interface
 */
export interface IWebSocketAuthenticator {
  authenticateSocket(socket: Socket): Promise<JwtClaims>;
  validateRoomAccess(user: JwtClaims, roomId: string): Promise<boolean>;
  validateQuotaAccess(user: JwtClaims, quotaId: string): Promise<boolean>;
}

/**
 * WebSocket message validator interface
 */
export interface IWebSocketMessageValidator {
  validateAirConditionerCommand(data: any): Promise<AirConditionerCommandData>;
  validateQuotaCommand(data: any): Promise<QuotaCommandData>;
  validateMessageStructure(message: any): Promise<boolean>;
}

/**
 * WebSocket metrics collector interface
 */
export interface IWebSocketMetricsCollector {
  recordConnectionEstablished(
    socketId: string,
    context: WebSocketConnectionContext,
  ): Promise<void>;
  recordMessageProcessed(
    socketId: string,
    messageType: string,
    processingTime: number,
  ): Promise<void>;
  recordBroadcast(
    eventType: string,
    targetCount: number,
    duration: number,
  ): Promise<void>;
  getMetrics(): Promise<WebSocketMetrics>;
  resetMetrics(): Promise<void>;
}
