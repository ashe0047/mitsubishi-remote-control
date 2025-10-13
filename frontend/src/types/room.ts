/**
 * Room management types for the frontend.
 *
 * These types mirror the backend DTOs and provide type safety for room operations.
 */

import { DeviceType } from './device';

/**
 * Device information embedded in room responses.
 * Contains device metadata and current status.
 */
export interface DeviceInfo {
  /** Unique device ID (UUID) - can be null for MQTT-only devices */
  id: string | null;
  /** Protocol-agnostic device identifier */
  deviceIdentifier: string;
  /** Type of device */
  type: DeviceType;
  /** Device name */
  name: string;
  /** Device manufacturer (optional, can be null) */
  manufacturer?: string | null;
  /** Device model (optional, can be null) */
  model?: string | null;
  /** Whether device is enabled for control */
  enabled: boolean;
  /** Whether device is currently online */
  online: boolean;
  /** Current device status (optional if offline, can be null) */
  currentStatus?: DeviceCurrentStatus | null;
  /** Timestamp when device status was last updated (can be null) */
  lastStatusUpdate?: string | null;
}

/**
 * Current status of a device.
 * Contains real-time operational data.
 */
export interface DeviceCurrentStatus {
  /** Power state (e.g., "ON", "OFF") */
  power: string;
  /** Target temperature setting (can be null) */
  temperature?: number | null;
  /** Operating mode (e.g., "cool", "heat", "auto") */
  mode: string;
  /** Fan speed setting */
  fan: string;
  /** Vane position (optional, can be null) */
  vane?: string | null;
  /** Wide vane position (optional, can be null) */
  wideVane?: string | null;
  /** Current room temperature (optional, can be null) */
  roomTemperature?: number | null;
  /** Compressor frequency (optional, can be null) */
  compressorFrequency?: number | null;
  /** Timestamp when this status was captured */
  timestamp: string;
}

/**
 * Aggregate status for a room.
 * Contains calculated statistics from all devices in the room.
 */
export interface AggregateStatus {
  /** Whether any devices in the room are actively running */
  hasActiveDevices: boolean;
  /** Average temperature across all devices with temperature readings (can be null) */
  averageTemperature?: number | null;
  /** Total number of devices in the room */
  totalDevices: number;
  /** Number of devices currently online */
  onlineDevices: number;
  /** Number of devices that are enabled */
  enabledDevices: number;
  /** Number of devices that are currently active (powered on and running) */
  activeDevices: number;
  /** Average target temperature setting across active devices (can be null) */
  averageTargetTemperature?: number | null;
  /** Minimum room temperature reading across all devices (can be null) */
  minRoomTemperature?: number | null;
  /** Maximum room temperature reading across all devices (can be null) */
  maxRoomTemperature?: number | null;
}

/**
 * Room entity returned from the API.
 * Enhanced with embedded device information and aggregate status.
 */
export interface Room {
  /** Unique room identifier (UUID) */
  id: string;
  /** Household ID this room belongs to */
  householdId: string;
  /** Room name (e.g., "Living Room") */
  name: string;
  /** Stable business identifier (slug) for the room (e.g., "living-room") */
  roomIdentifier: string;
  /** Room location (optional, e.g., "Ground Floor") */
  location?: string;
  /** Room description (optional) */
  description?: string;
  /** List of devices in this room with their current status */
  devices: DeviceInfo[];
  /** Aggregate status calculated from all devices in the room */
  aggregateStatus: AggregateStatus;
  /** Timestamp when room was created */
  createdAt: string;
  /** Timestamp when room was last updated */
  updatedAt: string;
}

/**
 * Request payload for creating a new room.
 */
export interface CreateRoomRequest {
  /** Room name (required, 2-100 characters) */
  name: string;
  /** Room location (optional, max 100 characters) */
  location?: string;
  /** Room description (optional, max 500 characters) */
  description?: string;
}

/**
 * Request payload for updating an existing room.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateRoomRequest {
  /** Updated room name (optional, 2-100 characters) */
  name?: string;
  /** Updated room location (optional, max 100 characters) */
  location?: string;
  /** Updated room description (optional, max 500 characters) */
  description?: string;
}

/**
 * Form data for room create/edit dialogs.
 */
export interface RoomFormData {
  name: string;
  location: string;
  description: string;
}

/**
 * Validation result for room form data.
 */
export interface RoomValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    location?: string;
    description?: string;
  };
}
/**
 * Device control action types.
 * Defines all possible control operations for devices.
 */

/** Power control action */
export interface PowerControlAction {
  type: 'power';
  payload: {
    power: 'on' | 'off';
  };
}

/** Temperature control action */
export interface TemperatureControlAction {
  type: 'temperature';
  payload: {
    temperature: number;
  };
}

/** Mode control action */
export interface ModeControlAction {
  type: 'mode';
  payload: {
    mode: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only';
  };
}

/** Fan control action */
export interface FanControlAction {
  type: 'fan';
  payload: {
    fan: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET' | 'auto' | 'low' | 'middle' | 'medium' | 'high' | 'diffuse';
  };
}

/** Vane control action */
export interface VaneControlAction {
  type: 'vane';
  payload: {
    vane: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING';
  };
}

/** Wide vane control action */
export interface WideVaneControlAction {
  type: 'wideVane';
  payload: {
    wideVane: '<<' | '<' | '|' | '>' | '>>' | 'SWING';
  };
}

/** Settings update action */
export interface SettingsControlAction {
  type: 'settings';
  payload: {
    temperature: number;
    fan: string;
    vane: string;
    wideVane: string;
    mode: string;
  };
}

/**
 * Union type for all device control actions.
 * Used for type-safe device control operations.
 */
export type DeviceControlAction = 
  | PowerControlAction
  | TemperatureControlAction
  | ModeControlAction
  | FanControlAction
  | VaneControlAction
  | WideVaneControlAction
  | SettingsControlAction;

/**
 * Quota validation result from the backend.
 * Contains information about whether an operation is allowed based on quota constraints.
 */
export interface QuotaValidationResult {
  /** The validation status determining if the command should proceed */
  status: 'ALLOW' | 'ALLOW_WITH_WARNING' | 'BLOCK' | 'FAIL_OPEN';
  /** Human-readable message explaining the validation result */
  message?: string;
  /** Internal reason for the validation decision */
  reason?: string;
  /** Additional context data for the validation result */
  context?: Record<string, any>;
  /** Timestamp when the validation was performed */
  validatedAt: string;
  /** Time taken to perform the validation in milliseconds */
  validationDurationMs?: number;
}

/**
 * Usage session information.
 * Contains details about device usage sessions for quota tracking.
 */
export interface UsageSession {
  /** Unique session identifier */
  id: string;
  /** User who started this session */
  userId: string;
  /** Room identifier where this session occurred */
  roomId: string;
  /** Type of device being controlled */
  deviceType: string;
  /** When the session was started */
  startedAt: string;
  /** When the session ended (null for active sessions) */
  endedAt?: string;
  /** Duration of the session in minutes */
  durationMinutes?: number;
  /** Current status of the session */
  status: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED' | 'OVERRIDE';
  /** AC settings when the session was started */
  initialSettings?: Record<string, any>;
  /** AC settings when the session ended */
  finalSettings?: Record<string, any>;
  /** Temperature setting during the session */
  temperatureSet?: number;
  /** AC mode during the session */
  mode?: string;
  /** Fan speed setting during the session */
  fanSpeed?: string;
  /** Energy consumed during this session in kWh */
  energyConsumed?: number;
  /** Estimated cost of this session in USD */
  estimatedCost?: number;
  /** Efficiency rating of this session (0.0 to 1.0) */
  efficiencyRating?: number;
  /** Outdoor temperature during the session */
  outdoorTemperature?: number;
  /** Weather conditions during the session */
  weatherConditions?: string;
  /** Quota violations that occurred during this session */
  quotaViolations?: any[];
  /** Reason for any override that occurred during this session */
  overrideReason?: string;
  /** User who performed an override (parent/admin) */
  overrideBy?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when session was created */
  createdAt: string;
  /** Timestamp when session was last updated */
  updatedAt: string;
}

/**
 * Enhanced response from device control operations with integrated quota and session information.
 * Contains operation result, updated room data, quota validation results, and session management information.
 */
export interface DeviceControlResponse {
  /** Whether the device control operation was successful */
  success: boolean;
  /** Human-readable message describing the operation result */
  message: string;
  /** The room ID where the operation was performed */
  roomId: string;
  /** The device identifier that was controlled */
  deviceId: string;
  /** The action that was performed */
  action: string;
  /** Updated room information after the device control operation */
  updatedRoom?: Room;
  /** Quota validation results for this device control operation */
  quotaResult?: QuotaValidationResult;
  /** Usage session information when applicable */
  session?: UsageSession;
  /** Timestamp when the operation was completed */
  timestamp: string;
  /** Additional metadata about the operation */
  metadata?: Record<string, any>;
}

/**
 * Type-safe action creators for device control operations.
 */
export const DeviceControlActions = {
  /**
   * Create a power control action.
   */
  power: (power: 'on' | 'off'): PowerControlAction => ({
    type: 'power',
    payload: { power }
  }),

  /**
   * Create a temperature control action.
   */
  temperature: (temperature: number): TemperatureControlAction => ({
    type: 'temperature',
    payload: { temperature }
  }),

  /**
   * Create a mode control action.
   */
  mode: (mode: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only'): ModeControlAction => ({
    type: 'mode',
    payload: { mode }
  }),

  /**
   * Create a fan control action.
   */
  fan: (fan: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET' | 'auto' | 'low' | 'middle' | 'medium' | 'high' | 'diffuse'): FanControlAction => ({
    type: 'fan',
    payload: { fan }
  }),

  /**
   * Create a vane control action.
   */
  vane: (vane: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING'): VaneControlAction => ({
    type: 'vane',
    payload: { vane }
  }),

  /**
   * Create a wide vane control action.
   */
  wideVane: (wideVane: '<<' | '<' | '|' | '>' | '>>' | 'SWING'): WideVaneControlAction => ({
    type: 'wideVane',
    payload: { wideVane }
  }),

  /**
   * Create a settings update action.
   */
  settings: (settings: {
    temperature: number;
    fan: string;
    vane: string;
    wideVane: string;
    mode: string;
  }): SettingsControlAction => ({
    type: 'settings',
    payload: settings
  })
} as const;/**
 * Z
od validation schemas for room interfaces.
 * Provides runtime validation for API responses and type safety.
 */

import { z } from 'zod';

/**
 * Schema for device current status validation.
 */
export const DeviceCurrentStatusSchema = z.object({
  power: z.string(),
  temperature: z.number().min(16).max(31).nullable().optional(),
  mode: z.enum(['off', 'heat_cool', 'cool', 'dry', 'heat', 'fan_only']),
  fan: z.string(),
  vane: z.string().nullable().optional(),
  wideVane: z.string().nullable().optional(),
  roomTemperature: z.number().nullable().optional(),
  compressorFrequency: z.number().nullable().optional(),
  timestamp: z.string()
});

/**
 * Schema for device info validation.
 */
export const DeviceInfoSchema = z.object({
  id: z.string().uuid().nullable(),
  deviceIdentifier: z.string().min(1),
  type: z.nativeEnum(DeviceType),
  name: z.string().min(1),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  enabled: z.boolean(),
  online: z.boolean(),
  currentStatus: DeviceCurrentStatusSchema.nullable().optional(),
  lastStatusUpdate: z.string().nullable().optional()
});

/**
 * Schema for aggregate status validation.
 */
export const AggregateStatusSchema = z.object({
  hasActiveDevices: z.boolean(),
  averageTemperature: z.number().nullable().optional(),
  totalDevices: z.number().min(0),
  onlineDevices: z.number().min(0),
  enabledDevices: z.number().min(0),
  activeDevices: z.number().min(0),
  averageTargetTemperature: z.number().nullable().optional(),
  minRoomTemperature: z.number().nullable().optional(),
  maxRoomTemperature: z.number().nullable().optional()
});

/**
 * Schema for room validation.
 */
export const RoomSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string().min(2).max(100),
  roomIdentifier: z.string().min(1),
  location: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  devices: z.array(DeviceInfoSchema),
  aggregateStatus: AggregateStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

/**
 * Schema for create room request validation.
 */
export const CreateRoomRequestSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().max(100).optional(),
  description: z.string().max(500).optional()
});

/**
 * Schema for update room request validation.
 */
export const UpdateRoomRequestSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  location: z.string().max(100).optional(),
  description: z.string().max(500).optional()
});

/**
 * Schema for device control action payload validation.
 */
export const PowerControlPayloadSchema = z.object({
  power: z.enum(['on', 'off'])
});

export const TemperatureControlPayloadSchema = z.object({
  temperature: z.number().min(16).max(31)
});

export const ModeControlPayloadSchema = z.object({
  mode: z.enum(['off', 'heat_cool', 'cool', 'dry', 'heat', 'fan_only'])
});

export const FanControlPayloadSchema = z.object({
  fan: z.enum(['AUTO', '1', '2', '3', '4', 'QUIET', 'auto', 'low', 'middle', 'medium', 'high', 'diffuse'])
});

export const VaneControlPayloadSchema = z.object({
  vane: z.enum(['AUTO', '1', '2', '3', '4', '5', 'SWING'])
});

export const WideVaneControlPayloadSchema = z.object({
  wideVane: z.enum(['<<', '<', '|', '>', '>>', 'SWING'])
});

export const SettingsControlPayloadSchema = z.object({
  temperature: z.number().min(16).max(31),
  fan: z.string(),
  vane: z.string(),
  wideVane: z.string(),
  mode: z.string()
});

/**
 * Schema for device control action validation.
 */
export const DeviceControlActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('power'),
    payload: PowerControlPayloadSchema
  }),
  z.object({
    type: z.literal('temperature'),
    payload: TemperatureControlPayloadSchema
  }),
  z.object({
    type: z.literal('mode'),
    payload: ModeControlPayloadSchema
  }),
  z.object({
    type: z.literal('fan'),
    payload: FanControlPayloadSchema
  }),
  z.object({
    type: z.literal('vane'),
    payload: VaneControlPayloadSchema
  }),
  z.object({
    type: z.literal('wideVane'),
    payload: WideVaneControlPayloadSchema
  }),
  z.object({
    type: z.literal('settings'),
    payload: SettingsControlPayloadSchema
  })
]);

/**
 * Schema for quota validation result validation.
 */
export const QuotaValidationResultSchema = z.object({
  status: z.enum(['ALLOW', 'ALLOW_WITH_WARNING', 'BLOCK', 'FAIL_OPEN']),
  message: z.string().optional(),
  reason: z.string().optional(),
  context: z.record(z.any()).optional(),
  validatedAt: z.string(),
  validationDurationMs: z.number().optional()
});

/**
 * Schema for usage session validation.
 */
export const UsageSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  roomId: z.string(),
  deviceType: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMinutes: z.number().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'INTERRUPTED', 'OVERRIDE']),
  initialSettings: z.record(z.any()).optional(),
  finalSettings: z.record(z.any()).optional(),
  temperatureSet: z.number().optional(),
  mode: z.string().optional(),
  fanSpeed: z.string().optional(),
  energyConsumed: z.number().optional(),
  estimatedCost: z.number().optional(),
  efficiencyRating: z.number().optional(),
  outdoorTemperature: z.number().optional(),
  weatherConditions: z.string().optional(),
  quotaViolations: z.array(z.any()).optional(),
  overrideReason: z.string().optional(),
  overrideBy: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

/**
 * Schema for enhanced device control response validation.
 */
export const DeviceControlResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  roomId: z.string().min(1), // Allow roomIdentifier or UUID
  deviceId: z.string(),
  action: z.string(),
  updatedRoom: RoomSchema.optional(),
  quotaResult: QuotaValidationResultSchema.optional(),
  session: UsageSessionSchema.optional(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional()
});

/**
 * Validation helper functions with error handling.
 */
export const RoomValidation = {
  /**
   * Validate room data with detailed error reporting.
   */
  validateRoom: (data: unknown): { success: true; data: z.infer<typeof RoomSchema> } | { success: false; errors: z.ZodError } => {
    const result = RoomSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate create room request with detailed error reporting.
   */
  validateCreateRoomRequest: (data: unknown): { success: true; data: z.infer<typeof CreateRoomRequestSchema> } | { success: false; errors: z.ZodError } => {
    const result = CreateRoomRequestSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate update room request with detailed error reporting.
   */
  validateUpdateRoomRequest: (data: unknown): { success: true; data: z.infer<typeof UpdateRoomRequestSchema> } | { success: false; errors: z.ZodError } => {
    const result = UpdateRoomRequestSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate device control action with detailed error reporting.
   */
  validateDeviceControlAction: (data: unknown): { success: true; data: z.infer<typeof DeviceControlActionSchema> } | { success: false; errors: z.ZodError } => {
    const result = DeviceControlActionSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate quota validation result with detailed error reporting.
   */
  validateQuotaValidationResult: (data: unknown): { success: true; data: z.infer<typeof QuotaValidationResultSchema> } | { success: false; errors: z.ZodError } => {
    const result = QuotaValidationResultSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate usage session with detailed error reporting.
   */
  validateUsageSession: (data: unknown): { success: true; data: z.infer<typeof UsageSessionSchema> } | { success: false; errors: z.ZodError } => {
    const result = UsageSessionSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Validate enhanced device control response with detailed error reporting.
   */
  validateDeviceControlResponse: (data: unknown): { success: true; data: z.infer<typeof DeviceControlResponseSchema> } | { success: false; errors: z.ZodError } => {
    const result = DeviceControlResponseSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  },

  /**
   * Format validation errors for user-friendly display.
   */
  formatValidationErrors: (errors: z.ZodError): Record<string, string> => {
    const formatted: Record<string, string> = {};
    
    errors.issues.forEach((issue) => {
      const path = issue.path.join('.');
      formatted[path] = issue.message;
    });
    
    return formatted;
  },

  /**
   * Check if validation error is a specific field error.
   */
  hasFieldError: (errors: z.ZodError, fieldPath: string): boolean => {
    return errors.issues.some(issue => issue.path.join('.') === fieldPath);
  },

  /**
   * Get error message for a specific field.
   */
  getFieldError: (errors: z.ZodError, fieldPath: string): string | undefined => {
    const issue = errors.issues.find(issue => issue.path.join('.') === fieldPath);
    return issue?.message;
  }
} as const;