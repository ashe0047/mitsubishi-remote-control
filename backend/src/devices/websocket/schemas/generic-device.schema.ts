import { z } from 'zod';

import { webSocketMessageSchema } from '../../../shared/websocket-gateway/schemas/base-schemas';
import { AirConditionerCommandType } from '../interfaces/air-conditioner.interface';
import {
  BatchCommandType,
  ConfigurationCommandType,
  GenericDeviceCommandType,
  MonitoringCommandType,
  SubscriptionCommandType,
} from '../interfaces/generic-device.interface';

export const deviceCommandTypeSchema = z.enum([
  // Air conditioner commands
  ...Object.values(AirConditionerCommandType),
  // Generic device commands
  ...Object.values(GenericDeviceCommandType),
  // Batch commands
  ...Object.values(BatchCommandType),
  // Configuration commands
  ...Object.values(ConfigurationCommandType),
  // Monitoring commands
  ...Object.values(MonitoringCommandType),
  // Subscription commands
  ...Object.values(SubscriptionCommandType),
]);

/**
 * Device-specific command message schema
 * Matches the DeviceCommand interface exactly
 */
export const deviceCommandSchema = webSocketMessageSchema.extend({
  type: z.literal('device_command'),
  gatewayType: z.literal('device'),
  deviceType: z.enum(['airconditioner', 'generic']),
  deviceId: z.string(),
  command: deviceCommandTypeSchema,
});

// Export a concrete TypeScript type for validated device command messages
export type DeviceCommandMessage = z.infer<typeof deviceCommandSchema>;

// Generic device command data schemas
export const connectDataSchema = z.object({
  protocol: z.enum(['mqtt', 'websocket']).optional(),
  timeout: z.number().positive().optional(),
  autoReconnect: z.boolean().optional(),
});

export const disconnectDataSchema = z.object({
  reason: z.string().optional(),
  graceful: z.boolean().optional(),
});

export const restartDataSchema = z.object({
  timeout: z.number().positive().optional(),
  force: z.boolean().optional(),
});

export const getInfoDataSchema = z.object({
  includeCapabilities: z.boolean().optional(),
  includeMetrics: z.boolean().optional(),
});

export const getCapabilitiesDataSchema = z.object({
  includeFeatures: z.boolean().optional(),
  includeLimitations: z.boolean().optional(),
});

export const pingDataSchema = z.object({
  timestamp: z.date().optional(),
  includeMetrics: z.boolean().optional(),
});

export const healthCheckDataSchema = z.object({
  includeDetails: z.boolean().optional(),
  timeout: z.number().positive().optional(),
});

export const subscribeEventsDataSchema = z.object({
  deviceId: z.string().optional(),
  events: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const unsubscribeEventsDataSchema = z.object({
  deviceId: z.string().optional(),
  events: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

// Batch operation data schemas
export const batchCommandDataSchema = z.object({
  commands: z.array(
    z.object({
      command: z.string(),
      deviceId: z.string(),
      parameters: z.record(z.string(), z.unknown()),
      priority: z.number().optional(),
    }),
  ),
  executeSequentially: z.boolean().optional(),
  stopOnError: z.boolean().optional(),
});

export const batchStatusDataSchema = z.object({
  batchId: z.string(),
});

// Configuration command data schemas
export const configUpdateDataSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  scope: z.enum(['global', 'device', 'session']).optional(),
});

export const configGetDataSchema = z.object({
  key: z.string().optional(),
  scope: z.enum(['global', 'device', 'session']).optional(),
  includeDefaults: z.boolean().optional(),
});

export const configResetDataSchema = z.object({
  scope: z.enum(['global', 'device', 'session']).optional(),
  confirm: z.boolean().optional(),
});

// Monitoring command data schemas
export const monitoringStartDataSchema = z.object({
  deviceId: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  interval: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  bufferSize: z.number().positive().optional(),
});

export const monitoringStopDataSchema = z.object({
  deviceId: z.string().optional(),
  flush: z.boolean().optional(),
});

export const monitoringGetDataSchema = z.object({
  deviceId: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  timeRange: z
    .object({
      start: z.string(),
      end: z.string(),
      duration: z.number().optional(),
    })
    .optional(),
  aggregation: z.enum(['average', 'sum', 'min', 'max', 'count']).optional(),
});

// Generic device command schemas
export const genericDeviceCommandSchemas = [
  createCommandDataSchema(
    GenericDeviceCommandType.CONNECT,
    connectDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.DISCONNECT,
    disconnectDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.RESTART,
    restartDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.GET_INFO,
    getInfoDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.GET_CAPABILITIES,
    getCapabilitiesDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.PING,
    pingDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.HEALTH_CHECK,
    healthCheckDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    SubscriptionCommandType.SUBSCRIBE,
    subscribeEventsDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    SubscriptionCommandType.UNSUBSCRIBE,
    unsubscribeEventsDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    BatchCommandType.COMMAND,
    batchCommandDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    BatchCommandType.STATUS,
    batchStatusDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    ConfigurationCommandType.UPDATE,
    configUpdateDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    ConfigurationCommandType.GET,
    configGetDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    ConfigurationCommandType.RESET,
    configResetDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    MonitoringCommandType.START,
    monitoringStartDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    MonitoringCommandType.STOP,
    monitoringStopDataSchema,
    'generic',
  ),
  createCommandDataSchema(
    MonitoringCommandType.GET_DATA,
    monitoringGetDataSchema,
    'generic',
  ),
] as const;

// Combined validation schema for generic devices
export const genericDeviceValidationSchema = createDiscriminatedCommandSchema([
  ...genericDeviceCommandSchemas,
] as const);

/**
 * Creates a discriminated union schema for command validation
 * @param commandOptions - Array of discriminated union options with literal command fields
 * @returns Zod schema that validates based on command field with proper type inference
 */
type CommandOptionSchema<Cmd extends string = string> = z.ZodObject<
  { command: z.ZodLiteral<Cmd> } & Record<string, z.ZodTypeAny>
>;

export function createDiscriminatedCommandSchema<
  const TOptions extends readonly [
    CommandOptionSchema<string>,
    ...CommandOptionSchema<string>[],
  ],
>(commandOptions: TOptions) {
  // Build a union without using non-exported discriminated types
  const union: z.ZodUnion<TOptions> = z.union(
    commandOptions as unknown as TOptions,
  );

  // Intersect with the base device command schema (excluding command/data)
  // so the union's precise command & data types are preserved, while
  // still ensuring the full base message shape is present.
  const baseWithoutCmdData = deviceCommandSchema.omit({
    command: true,
    data: true,
  });
  return baseWithoutCmdData.and(union);
}

/**
 * Validates and transforms command data for a specific command type
 * @param command - The command type (will be inferred as literal)
 * @param dataSchema - The schema for the command's data
 * @param deviceType - The device type (will be inferred as literal)
 * @returns Validation schema for the specific command with proper type inference
 */
export function createCommandDataSchema<
  C extends string,
  D extends z.ZodTypeAny,
  DT extends string,
>(command: C, dataSchema: D, deviceType: DT) {
  return z.object({
    command: z.literal(command),
    data: dataSchema,
    deviceType: z.literal(deviceType),
  });
}

/**
 * Creates a generic device command schema
 * @param deviceType - The device type
 * @param deviceId - The device ID
 * @returns Base device command schema for the specific device
 */
export function createGenericDeviceCommandSchema(
  deviceType: string,
  deviceId: string,
) {
  return z.object({
    command: z.string(),
    data: z.record(z.string(), z.unknown()),
    deviceType: z.literal(deviceType),
    deviceId: z.literal(deviceId),
  });
}
