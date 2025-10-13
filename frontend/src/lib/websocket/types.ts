/**
 * Simple WebSocket Types
 * Clean, focused type definitions for frontend WebSocket client
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface ConnectionConfig {
  url: string;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  timeout?: number;
  debug?: boolean;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export type MessageType =
  | 'auth'
  | 'quota'
  | 'room'
  | 'system'
  | 'error'
  | 'heartbeat'
  | 'device'
  | 'ROOM_STATUS_UPDATE';

export interface WebSocketMessage {
  type: MessageType;
  messageId: string;
  roomId?: string;
  payload?: unknown;
  timestamp?: number;
}

export interface AuthMessage extends WebSocketMessage {
  type: 'auth';
  payload: {
    token: string;
    action: 'authenticate' | 'refresh' | 'logout';
  };
}

export interface QuotaMessage extends WebSocketMessage {
  type: 'quota';
  payload: {
    userId: string;
    quotaType: 'time' | 'energy' | 'cost';
    currentUsage: number;
    limit: number;
    status: 'ok' | 'warning' | 'exceeded';
  };
}

export interface RoomMessage extends WebSocketMessage {
  type: 'room';
  roomId: string;
  payload: RoomMessagePayload;
}

export interface RoomMessagePayload {
  command: 'update' | 'subscribe' | 'unsubscribe';
  data: AirConState | AirConCommand | null;
}

// More specific room message payloads
export interface RoomUpdatePayload {
  command: 'update';
  data: AirConCommand;
}

export interface RoomStatePayload {
  command: 'update';
  data: AirConState;
}

export interface SystemMessage extends WebSocketMessage {
  type: 'system';
  payload: {
    command: 'ping' | 'reconnect' | 'shutdown';
    data?: unknown;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: 'heartbeat';
  payload: {
    timestamp: number;
    sequence: number;
  };
}

// =============================================================================
// DEVICE MESSAGES (NEW - Device-Room Integration)
// =============================================================================

/**
 * Device state update message
 * Sent from backend when device state changes
 */
export interface DeviceStateMessage extends WebSocketMessage {
  type: 'device';
  payload: {
    messageType: 'STATE' | 'SETTINGS';
    deviceIdentifier: string;
    deviceType: string; // 'airconditioner' | 'thermostat' | 'humidifier' | 'fan'
    data: AirConState; // Or ThermostatState, etc. depending on deviceType
    timestamp: number;
  };
}

/**
 * Device discovery message
 * Sent from backend when unknown device detected via MQTT
 */
export interface DeviceDiscoveryMessage extends WebSocketMessage {
  type: 'device';
  payload: {
    messageType: 'DEVICE_DISCOVERED';
    deviceIdentifier: string;
    deviceType?: string | null;
    mqttMessageType?: string; // 'state' | 'settings'
    mqttPayload?: Record<string, unknown>;
    timestamp?: number;
    firstSeenAt?: number;
    lastSeenAt?: number;
    roomId?: string;
    metadata?: Record<string, unknown>;
    requiresRegistration?: boolean;
  };
}

/**
 * Device command message
 * Sent to backend to control a specific device
 */
export interface DeviceCommandMessage extends WebSocketMessage {
  type: 'device';
  roomId: string;
  payload: {
    messageType: 'COMMAND';
    deviceIdentifier?: string; // Optional - backend uses selected device if not provided
    command: 'SET_TEMPERATURE' | 'SET_MODE' | 'SET_FAN_SPEED' | 'SET_POWER' | 'SET_SWING';
    data: Record<string, unknown>;
  };
}

// =============================================================================
// AIR CONDITIONING TYPES
// =============================================================================

export interface AirConState {
  power: 'on' | 'off';
  temperature: number;
  mode: 'heat' | 'cool' | 'auto' | 'dry' | 'fan';
  fan: 'auto' | 'quiet' | '1' | '2' | '3' | '4';
  vane: 'auto' | '1' | '2' | '3' | '4' | '5' | 'swing';
  wideVane: 'auto' | '<<' | '<' | '|' | '>' | '>>' | '<>' | 'swing';
  online: boolean;
  lastUpdate: number;
}

export interface AirConCommand {
  field: keyof Omit<AirConState, 'online' | 'lastUpdate'>;
  value: AirConState[keyof Omit<AirConState, 'online' | 'lastUpdate'>];
}

export interface RoomStatusStatePayload {
  roomTemperature?: number | null;
  temperature?: number | null;
  fan?: string | null;
  vane?: string | null;
  wideVane?: string | null;
  mode?: string | null;
  action?: string | null;
  compressorFrequency?: number | null;
}

export interface RoomStatusSettingsPayload {
  power?: string | null;
  temperature?: number | null;
  fan?: string | null;
  vane?: string | null;
  wideVane?: string | null;
  mode?: string | null;
}

export type RoomUpdateType =
  | 'AGGREGATE_STATUS_CHANGE'
  | 'DEVICE_STATUS_CHANGE'
  | 'DEVICE_CONNECTIVITY_CHANGE'
  | 'DEVICE_ADDED'
  | 'DEVICE_REMOVED'
  | 'ROOM_CONFIG_CHANGE';

export interface RoomStatusUpdatePayload {
  roomId: string;
  roomName: string;
  aggregateStatus: import('@/types/room').AggregateStatus | null;
  deviceUpdates: import('@/types/room').DeviceInfo[];
  timestamp: string;
  updateType: RoomUpdateType;
  state?: RoomStatusStatePayload | null;
  settings?: RoomStatusSettingsPayload | null;
}

export interface RoomStatusUpdateMessage extends WebSocketMessage {
  type: 'ROOM_STATUS_UPDATE';
  payload: RoomStatusUpdatePayload;
}

export interface RoomInfo {
  id: string;
  name: string;
  online: boolean;
  settings?: AirConState;
  state?: AirConState;
  aggregateStatus?: import('@/types/room').AggregateStatus | null;
  devices?: import('@/types/room').DeviceInfo[];
  updatedAt?: number;
}

// =============================================================================
// CLIENT TYPES
// =============================================================================

export type MessageHandler<T extends WebSocketMessage = WebSocketMessage> = (message: T) => void;

export interface WebSocketClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: WebSocketMessage): Promise<void>;
  subscribe<T extends WebSocketMessage = WebSocketMessage>(
    type: MessageType,
    handler: MessageHandler<T>
  ): () => void;
  readonly connectionState: ConnectionState;
  readonly isConnected: boolean;
}

// =============================================================================
// LEGACY COMPATIBILITY (temporary)
// =============================================================================

export interface WSMessage {
  type:
    | 'rooms'
    | 'room-state'
    | 'room-settings'
    | 'room-status-update'
    | 'command-response'
    | 'mqtt-status';
  roomId?: string;
  data: RoomInfo[] | AirConState | AirConCommand | RoomStatusUpdatePayload | boolean | string | null;
}

export interface WebSocketResponse {
  id?: string;
  type: "response" | "stream" | "ack" | "error";
  source: string;
  roomId?: string;
  data?: unknown;
  error?: string;
  timestamp: number;
}

// Type alias for the client interface (used by existing code)
export type IWebSocketClient = WebSocketClient;
