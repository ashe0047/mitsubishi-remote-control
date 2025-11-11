/**
 * WebSocket message types
 */
export enum WebSocketMessageTypes {
  CONNECTION_STATUS = 'connection_status',
  DEVICE_COMMAND = 'device_command',
  DEVICE_RESPONSE = 'device_response',
  QUOTA_OPERATION = 'quota_operation',
  QUOTA_RESPONSE = 'quota_response',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  SUBSCRIPTION_ACK = 'subscription_ack',
  UNSUBSCRIPTION_ACK = 'unsubscription_ack',
  BROADCAST_UPDATE = 'broadcast_update',
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket gateway types
 */
export enum WebSocketGatewayType {
  DEVICE = 'device',
  QUOTA = 'quota',
}

/**
 * Device types supported by the system
 */
export enum DeviceType {
  AIRCONDITIONER = 'airconditioner',
  GENERIC = 'generic',
}

// Device command types have been moved to device-commands.interface.ts
// to maintain hierarchical organization and avoid duplication

/**
 * Device operation modes
 */
export enum DeviceMode {
  COOL = 'cool',
  HEAT = 'heat',
  AUTO = 'auto',
  DRY = 'dry',
  FAN = 'fan',
}

/**
 * Fan speed levels
 */
export enum FanSpeed {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  AUTO = 'auto',
}

/**
 * Quota types
 */
export enum QuotaType {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

/**
 * Quota operation types
 */
export enum QuotaOperationType {
  GET_USAGE = 'get_usage',
  GET_LIMIT = 'get_limit',
  SET_LIMIT = 'set_limit',
  REQUEST_OVERRIDE = 'request_override',
  APPROVE_OVERRIDE = 'approve_override',
  REJECT_OVERRIDE = 'reject_override',
  GET_STATUS = 'get_status',
  GET_HISTORY = 'get_history',
}

/**
 * Quota status types
 */
export enum QuotaStatus {
  ACTIVE = 'active',
  EXCEEDED = 'exceeded',
  WARNING = 'warning',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * Override status types
 */
export enum OverrideStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * WebSocket error categories
 */
export enum WebSocketErrorCategory {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
}

/**
 * WebSocket error codes
 */
export enum WebSocketErrorCode {
  // Authentication errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MISSING_TOKEN = 'MISSING_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_PARAMETER_VALUES = 'INVALID_PARAMETER_VALUES',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',

  // Business logic errors
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ROOM_ACCESS_DENIED = 'ROOM_ACCESS_DENIED',
  INVALID_DEVICE_STATE = 'INVALID_DEVICE_STATE',
  OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',

  // System errors
  STRATEGY_NOT_FOUND = 'STRATEGY_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Connection status types
 */
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * Room membership status
 */
export enum RoomMembershipStatus {
  JOINED = 'joined',
  LEFT = 'left',
  KICKED = 'kicked',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Event types for monitoring and analytics
 */
export enum WebSocketEventType {
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_TERMINATED = 'connection_terminated',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_PROCESSED = 'message_processed',
  ERROR_OCCURRED = 'error_occurred',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  BROADCAST_SENT = 'broadcast_sent',
  STRATEGY_EXECUTED = 'strategy_executed',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILED = 'authentication_failed',
}

/**
 * Strategy execution status
 */
export enum StrategyExecutionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * Rate limiting periods
 */
export enum RateLimitPeriod {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
}

/**
 * Cache key patterns
 */
export enum CacheKeyPattern {
  SESSION_PREFIX = 'ws:session:',
  ROOM_PREFIX = 'ws:room:',
  USER_PREFIX = 'ws:user:',
  STRATEGY_PREFIX = 'ws:strategy:',
  METRICS_PREFIX = 'ws:metrics:',
}

/**
 * WebSocket namespaces
 */
export enum WebSocketNamespace {
  DEVICE = '/device',
  QUOTA = '/quota',
  HEALTH = '/health',
}

/**
 * Default configuration values
 */
export enum WebSocketDefaults {
  MAX_CONNECTIONS_PER_USER = 10,
  MESSAGE_RATE_LIMIT = 100,
  SESSION_TIMEOUT_MINUTES = 30,
  HEARTBEAT_INTERVAL_SECONDS = 30,
  MAX_MESSAGE_SIZE_BYTES = 1024 * 1024, // 1MB
  BUFFER_SIZE = 1000,
  RETRY_ATTEMPTS = 3,
  RETRY_DELAY_MS = 1000,
}
