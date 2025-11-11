import type { Observable } from 'rxjs';
import type {
  WebSocketContext,
  WebSocketMessage,
  ValidatedMessage,
  WsErrorResponse,
} from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import type { DeviceCommandResponse } from '../contracts/device-response.contract';
import type { DeviceCommandType } from './generic-device.interface';

/**
 * Device capabilities definition
 * Defines what a device can do and what features it supports
 */
export interface DeviceCapabilities {
  readonly supportedCommands: readonly string[];
  readonly supportedEvents: readonly string[];
  readonly features: {
    readonly realTimeMonitoring: boolean;
    readonly batchOperations: boolean;
    readonly historicalData: boolean;
    readonly predictiveAnalysis: boolean;
    readonly remoteConfiguration: boolean;
  };
  readonly limitations: {
    readonly maxConcurrentCommands: number;
    readonly commandRateLimit: number; // commands per second
    readonly dataRetentionDays: number;
    readonly maxSubscriptions: number;
    readonly maxPayloadSize: number;
  };
  readonly metadata: {
    readonly manufacturer?: string;
    readonly model?: string;
    readonly firmwareVersion?: string;
    readonly protocolVersion?: string;
    readonly supportedProtocols: readonly string[];
  };
}

/**
 * Device command validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly sanitizedData?: Record<string, unknown>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  readonly id: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly processingTime: number;
  readonly deviceId?: string;
  readonly commandType: string;
  readonly timestamp: Date;
  readonly metadata: {
    readonly command?: DeviceCommandType;
    readonly [key: string]: unknown;
  };
}

/**
 * Device status information
 */
export interface DeviceStatus {
  readonly deviceId: string;
  readonly deviceType: string;
  readonly isConnected: boolean;
  readonly isOnline: boolean;
  readonly lastSeen: Date;
  readonly currentState: Record<string, unknown>;
  readonly capabilities: Partial<DeviceCapabilities>;
  readonly healthStatus: 'healthy' | 'warning' | 'error' | 'offline';
  readonly metrics?: DeviceMetrics;
}

/**
 * Device metrics for monitoring
 */
export interface DeviceMetrics {
  readonly responseTime: number;
  readonly successRate: number;
  readonly errorCount: number;
  readonly lastCommandAt?: Date;
  readonly uptime?: number;
  readonly resourceUsage?: {
    readonly cpu?: number;
    readonly memory?: number;
    readonly network?: number;
  };
}

/**
 * Broadcast update context
 */
export interface BroadcastContext {
  readonly targetRooms?: readonly string[];
  readonly targetUsers?: readonly string[];
  readonly targetDeviceTypes?: readonly string[];
  readonly excludeSelf?: boolean;
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Strategy performance metrics
 */
export interface StrategyMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageProcessingTime: number;
  commandsPerSecond: number;
  activeConnections: number;
  memoryUsage: number;
  lastResetAt: Date;
}

/**
 * Main device strategy interface
 * Defines the contract that all device strategies must implement
 */
export interface IDeviceStrategy {
  /** Unique identifier for this strategy */
  readonly deviceType: string;

  /** Display name for the strategy */
  readonly displayName: string;

  /** List of commands this strategy can handle */
  readonly supportedCommands: readonly string[];

  /** Device capabilities */
  readonly capabilities: DeviceCapabilities;

  /**
   * Validates incoming command message against strategy-specific schema
   * @param message Raw message from WebSocket client
   * @returns Validated message with proper typing
   * @throws ValidationError if validation fails
   */
  validateCommand(
    message: unknown,
  ): Promise<ValidatedMessage<WebSocketMessage>>;

  /**
   * Processes a validated command and returns the response
   * @param message Validated command message
   * @param context WebSocket context for the command
   * @returns Command response with execution result
   */
  processCommand(
    message: ValidatedMessage<WebSocketMessage>,
    context: WebSocketContext,
  ): Promise<DeviceCommandResponse | WsErrorResponse>;

  /**
   * Creates an RxJS observable stream for processing commands
   * @param context WebSocket context for command processing
   * @returns Observable stream of command results
   */
  createCommandStream(context: WebSocketContext): Observable<CommandResult>;

  /**
   * Creates an RxJS observable stream for device status updates
   * @param deviceId Unique identifier of the device
   * @returns Observable stream of device status updates
   */
  createStatusStream(deviceId: string): Observable<DeviceStatus>;

  /**
   * Broadcasts command response to relevant clients
   * @param context WebSocket context
   * @param response Command response to broadcast
   * @param broadcastContext Optional targeting context for broadcast
   * @returns Promise resolving when broadcast is complete
   */
  broadcastUpdate(
    context: WebSocketContext,
    response: DeviceCommandResponse,
    broadcastContext?: BroadcastContext,
  ): Promise<void>;

  /**
   * Returns the capabilities definition for this strategy
   * @returns Device capabilities object
   */
  getDeviceCapabilities(): DeviceCapabilities;

  /**
   * Handles errors that occur during command processing
   * @param error The error that occurred
   * @param context WebSocket context where error occurred
   * @returns Properly formatted error response
   */
  handleError(
    error: unknown,
    context: WebSocketContext,
  ): Promise<WsErrorResponse>;

  /**
   * Returns performance metrics for the strategy
   * @returns Strategy performance metrics
   */
  getMetrics(): StrategyMetrics;

  /**
   * Performs health check on strategy and its dependencies
   * @returns Health check result
   */
  healthCheck(): Promise<{
    readonly healthy: boolean;
    readonly status: string;
    readonly dependencies: Record<string, boolean>;
    readonly lastCheck: Date;
  }>;

  /**
   * Initializes the strategy (called during strategy registration)
   * @returns Promise resolving when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources when strategy is unregistered
   * @returns Promise resolving when cleanup is complete
   */
  dispose(): Promise<void>;
}

/**
 * Strategy factory interface for dynamic strategy creation
 */
export interface IStrategyFactory {
  readonly deviceType: string;
  readonly displayName: string;

  /**
   * Creates a new instance of the strategy
   * @param dependencies Strategy dependencies
   * @returns New strategy instance
   */
  create(dependencies: Record<string, unknown>): Promise<IDeviceStrategy>;

  /**
   * Validates that required dependencies are available
   * @param dependencies Available dependencies
   * @returns Validation result
   */
  validateDependencies(dependencies: Record<string, unknown>): ValidationResult;
}

/**
 * Strategy lifecycle events
 */
export interface StrategyEvent {
  readonly type:
    | 'registered'
    | 'unregistered'
    | 'initialized'
    | 'disposed'
    | 'error';
  readonly deviceType: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
  readonly error?: string;
}
