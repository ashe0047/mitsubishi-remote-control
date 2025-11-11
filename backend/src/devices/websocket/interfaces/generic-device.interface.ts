import {
  AirConditionerCommandParameters,
  AirConditionerCommandType,
  isAirConditionerCommand,
} from './air-conditioner.interface';
import { CommandResult } from './device-strategy.interface';

/**
 * DeviceCommandType as a union of all command type enums
 * This maintains backward compatibility while providing proper type separation
 */
export type DeviceCommandType =
  | AirConditionerCommandType
  | GenericDeviceCommandType
  | BatchCommandType
  | ConfigurationCommandType
  | MonitoringCommandType
  | SubscriptionCommandType;

/**
 * Generic device commands applicable to all device types
 */
export enum GenericDeviceCommandType {
  CONNECT = 'device_connect',
  DISCONNECT = 'device_disconnect',
  RESTART = 'device_restart',
  GET_INFO = 'device_get_info',
  GET_CAPABILITIES = 'device_get_capabilities',
  PING = 'device_ping',
  HEALTH_CHECK = 'device_health_check',
}

/**
 * Batch operation commands
 */
export enum BatchCommandType {
  COMMAND = 'batch_command',
  STATUS = 'batch_status',
}

/**
 * Configuration commands
 */
export enum ConfigurationCommandType {
  UPDATE = 'config_update',
  GET = 'config_get',
  RESET = 'config_reset',
}

/**
 * Monitoring commands
 */
export enum MonitoringCommandType {
  START = 'monitoring_start',
  STOP = 'monitoring_stop',
  GET_DATA = 'monitoring_get_data',
}

/**
 * Subscription commands
 */
export enum SubscriptionCommandType {
  SUBSCRIBE = 'subscribe_events',
  UNSUBSCRIBE = 'unsubscribe_events',
  GET_SUBSCRIPTIONS = 'get_subscriptions',
}

/**
 * Generic device command parameters
 */
export interface GenericDeviceCommandParameters {
  readonly [key: string]: unknown;
}

/**
 * Batch command parameters
 */
export interface BatchCommandParameters {
  readonly commands: Array<{
    readonly command: string;
    readonly deviceId: string;
    readonly parameters: Record<string, unknown>;
    readonly priority?: number;
  }>;
  readonly executeSequentially?: boolean;
  readonly stopOnError?: boolean;
}

/**
 * Monitoring command parameters
 */
export interface MonitoringCommandParameters {
  readonly deviceId?: string;
  readonly metrics?: readonly string[];
  readonly interval?: number;
  readonly duration?: number;
  readonly bufferSize?: number;
}

/**
 * Subscription command parameters
 */
export interface SubscriptionCommandParameters {
  readonly events?: readonly string[];
  readonly deviceId?: string;
  readonly deviceType?: string;
  readonly filters?: Record<string, unknown>;
}

/**
 * Device command request structure
 */
export interface DeviceCommandRequest {
  readonly id: string;
  readonly type: DeviceCommandType;
  readonly deviceType: string;
  readonly deviceId: string;
  readonly parameters:
    | AirConditionerCommandParameters
    | GenericDeviceCommandParameters
    | BatchCommandParameters
    | MonitoringCommandParameters
    | SubscriptionCommandParameters;
  readonly metadata: {
    readonly roomId: string;
    readonly userId: string;
    readonly householdId: string;
    readonly timestamp: string;
    readonly priority?: 'low' | 'normal' | 'high' | 'critical';
    readonly timeout?: number;
    readonly retryCount?: number;
    readonly sessionId?: string;
  };
}

/**
 * Device health check result
 */
export interface DeviceHealthCheck {
  readonly deviceId: string;
  readonly deviceType: string;
  readonly healthy: boolean;
  readonly status: 'online' | 'offline' | 'error' | 'unknown';
  readonly lastCheck: Date;
  readonly nextCheck: Date;
  readonly responseTime?: number;
  readonly uptime?: number;
  readonly message?: string;
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
}

/**
 * Batch command result
 */
export interface BatchCommandResult {
  readonly id: string;
  readonly totalCommands: number;
  readonly successfulCommands: number;
  readonly failedCommands: number;
  readonly results: readonly CommandResult[];
  readonly overallSuccess: boolean;
  readonly executionTime: number;
  readonly executedSequentially: boolean;
  readonly stoppedOnError: boolean;
  readonly timestamp: Date;
}

/**
 * Monitoring data result
 */
export interface MonitoringDataResult {
  readonly deviceId: string;
  readonly deviceType: string;
  readonly metrics: Record<string, unknown>;
  readonly timeRange: {
    readonly start: Date;
    readonly end: Date;
    readonly duration: number;
  };
  readonly sampleCount: number;
  readonly aggregation: 'average' | 'sum' | 'min' | 'max' | 'count';
  readonly timestamp: Date;
}

/**
 * Subscription result
 */
export interface SubscriptionResult {
  readonly subscriptionId: string;
  readonly deviceType?: string;
  readonly deviceId?: string;
  readonly events: readonly string[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly lastEvent?: Date;
  readonly eventCount: number;
  readonly filters?: Record<string, unknown>;
}

/**
 * Type guard to check if a command is a Generic Device command
 */
export function isGenericDeviceCommand(
  command: string,
): command is GenericDeviceCommandType {
  return Object.values(GenericDeviceCommandType).includes(
    command as GenericDeviceCommandType,
  );
}

/**
 * Type guard to check if a command is a Batch command
 */
export function isBatchCommand(command: string): command is BatchCommandType {
  return Object.values(BatchCommandType).includes(command as BatchCommandType);
}

/**
 * Type guard to check if a command is a Configuration command
 */
export function isConfigurationCommand(
  command: string,
): command is ConfigurationCommandType {
  return Object.values(ConfigurationCommandType).includes(
    command as ConfigurationCommandType,
  );
}

/**
 * Type guard to check if a command is a Monitoring command
 */
export function isMonitoringCommand(
  command: string,
): command is MonitoringCommandType {
  return Object.values(MonitoringCommandType).includes(
    command as MonitoringCommandType,
  );
}

/**
 * Type guard to check if a command is a Subscription command
 */
export function isSubscriptionCommand(
  command: string,
): command is SubscriptionCommandType {
  return Object.values(SubscriptionCommandType).includes(
    command as SubscriptionCommandType,
  );
}

/**
 * Type guard to safely narrow string to DeviceCommandType
 * This validates that the command is a valid DeviceCommandType union value
 */
export function isValidDeviceCommand(
  command: string,
): command is DeviceCommandType {
  return (
    isAirConditionerCommand(command) ||
    isGenericDeviceCommand(command) ||
    isBatchCommand(command) ||
    isConfigurationCommand(command) ||
    isMonitoringCommand(command) ||
    isSubscriptionCommand(command)
  );
}

/**
 * Type guard to validate a command against a strategy's supported commands
 * This provides type-safe validation for strategy-specific command lists
 */
export function isSupportedDeviceCommand(
  command: string,
  supportedCommands: readonly string[],
): command is DeviceCommandType {
  return supportedCommands.includes(command) && isValidDeviceCommand(command);
}
