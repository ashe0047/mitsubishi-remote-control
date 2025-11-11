import { z } from 'zod';
import {
  createCommandDataSchema,
  createDiscriminatedCommandSchema,
} from './generic-device.schema';
import { AirConditionerCommandType } from '../interfaces/air-conditioner.interface';
import {
  GenericDeviceCommandType,
  SubscriptionCommandType,
} from '../interfaces/generic-device.interface';

// Air conditioner command data schemas
export const setPowerDataSchema = z.object({
  power: z.boolean(),
});

export const setTemperatureDataSchema = z.object({
  temperature: z.number().min(16).max(32),
});

export const setModeDataSchema = z.object({
  mode: z.enum(['auto', 'cool', 'heat', 'dry', 'fan']),
});

export const setFanDataSchema = z.object({
  fan: z.enum(['auto', 'low', 'medium', 'high', 'quiet']),
});

export const setVaneDataSchema = z.object({
  vane: z.enum(['auto', '1', '2', '3', '4', '5']),
});

export const setWideVaneDataSchema = z.object({
  wideVane: z.enum(['left', 'right', 'both', 'off']),
});

export const getCommandDataSchema = z.object({
  // GET commands don't require additional data
});

export const getDeviceInfoDataSchema = z.object({
  // GET device info doesn't require additional data
});

export const getCapabilitiesDataSchema = z.object({
  // GET capabilities doesn't require additional data
});

export const pingDataSchema = z.object({
  // Ping doesn't require additional data
  timestamp: z.date().optional(),
});

export const healthCheckDataSchema = z.object({
  // Health check doesn't require additional data
  includeDetails: z.boolean().optional(),
});

export const subscribeEventsDataSchema = z.object({
  deviceId: z.string().optional(),
  events: z.array(z.string()).optional(),
});

export const unsubscribeEventsDataSchema = z.object({
  deviceId: z.string().optional(),
  events: z.array(z.string()).optional(),
});

// Air conditioner command schemas
export const airConditionerCommandSchemas = [
  // Power control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_POWER,
    setPowerDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_POWER,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Temperature control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_TEMPERATURE,
    setTemperatureDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_TEMPERATURE,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Mode control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_MODE,
    setModeDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_MODE,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Fan control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_FAN,
    setFanDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_FAN,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Vane control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_VANE,
    setVaneDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_VANE,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Wide vane control commands
  createCommandDataSchema(
    AirConditionerCommandType.SET_WIDEVANE,
    setWideVaneDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_WIDEVANE,
    getCommandDataSchema,
    'airconditioner',
  ),

  // Status and information commands
  createCommandDataSchema(
    AirConditionerCommandType.GET_STATUS,
    getCommandDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_SETTINGS,
    getCommandDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    AirConditionerCommandType.GET_STATE,
    getCommandDataSchema,
    'airconditioner',
  ),
] as const;

// Generic device command schemas for air conditioner
export const genericDeviceCommandSchemas = [
  createCommandDataSchema(
    GenericDeviceCommandType.CONNECT,
    z.object({
      protocol: z.enum(['mqtt', 'websocket']).optional(),
      timeout: z.number().positive().optional(),
    }),
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.DISCONNECT,
    z.object({
      reason: z.string().optional(),
    }),
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.RESTART,
    z.object({
      timeout: z.number().positive().optional(),
    }),
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.GET_INFO,
    getDeviceInfoDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.GET_CAPABILITIES,
    getCapabilitiesDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.PING,
    pingDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    GenericDeviceCommandType.HEALTH_CHECK,
    healthCheckDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    SubscriptionCommandType.SUBSCRIBE,
    subscribeEventsDataSchema,
    'airconditioner',
  ),
  createCommandDataSchema(
    SubscriptionCommandType.UNSUBSCRIBE,
    unsubscribeEventsDataSchema,
    'airconditioner',
  ),
] as const;

// Combined validation schema for air conditioner
export const airConditionerValidationSchema = createDiscriminatedCommandSchema([
  ...airConditionerCommandSchemas,
  ...genericDeviceCommandSchemas,
] as const);
