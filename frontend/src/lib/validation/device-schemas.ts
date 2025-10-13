/**
 * Zod validation schemas for device management
 *
 * These schemas validate device-related requests and responses,
 * ensuring type safety at runtime and compile time.
 */

import { z } from 'zod';
import { DeviceType } from '@/types/device';

/**
 * Device type enum schema
 */
export const deviceTypeSchema = z.nativeEnum(DeviceType);

/**
 * Device entity schema (response from API)
 */
export const deviceSchema = z.object({
  id: z.string().uuid('Device ID must be a valid UUID'),
  roomId: z.string().uuid('Room ID must be a valid UUID'),
  deviceType: deviceTypeSchema,
  deviceIdentifier: z
    .string()
    .min(1, 'Device identifier is required')
    .max(100, 'Device identifier must be less than 100 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Device identifier must be lowercase alphanumeric with hyphens or underscores only'
    ),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).optional(), // Device metadata from backend
  createdAt: z.string(), // ISO 8601 timestamp from backend
  updatedAt: z.string(), // ISO 8601 timestamp from backend
});

/**
 * Register device request schema
 */
export const registerDeviceSchema = z.object({
  roomId: z.string().uuid('Room ID must be a valid UUID'),
  deviceType: deviceTypeSchema,
  deviceIdentifier: z
    .string()
    .min(1, 'Device identifier is required')
    .max(100, 'Device identifier must be less than 100 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Device identifier must be lowercase alphanumeric with hyphens or underscores only'
    ),
  manufacturer: z
    .string()
    .max(100, 'Manufacturer must be less than 100 characters')
    .optional(),
  model: z.string().max(100, 'Model must be less than 100 characters').optional(),
  enabled: z.boolean().default(true).optional(),
});

/**
 * Update device metadata request schema
 */
export const updateDeviceMetadataSchema = z.object({
  manufacturer: z
    .string()
    .max(100, 'Manufacturer must be less than 100 characters')
    .optional(),
  model: z.string().max(100, 'Model must be less than 100 characters').optional(),
  enabled: z.boolean().optional(),
});

/**
 * Discovered device schema
 */
export const discoveredDeviceSchema = z.object({
  deviceIdentifier: z
    .string()
    .min(1, 'Device identifier is required')
    .regex(/^[a-z0-9_-]+$/, 'Invalid device identifier format'),
  deviceType: z.string().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  firstSeenAt: z.string().datetime({ message: 'firstSeenAt must be an ISO timestamp' }),
  lastSeenAt: z.string().datetime({ message: 'lastSeenAt must be an ISO timestamp' }),
  requiresRegistration: z.boolean().optional().default(true),
});

export const discoveredDevicesArraySchema = z.array(discoveredDeviceSchema);

/**
 * Device filters schema (for validation of filter inputs)
 */
export const deviceFiltersSchema = z.object({
  searchTerm: z.string().optional(),
  deviceType: z.union([deviceTypeSchema, z.literal('all')]).optional(),
  enabled: z.union([z.boolean(), z.literal('all')]).optional(),
  roomId: z.string().uuid().optional(),
});

/**
 * Array of devices schema (API list response)
 */
export const devicesArraySchema = z.array(deviceSchema);

/**
 * Type inference from schemas
 */
export type DeviceSchemaType = z.infer<typeof deviceSchema>;
export type RegisterDeviceSchemaType = z.infer<typeof registerDeviceSchema>;
export type UpdateDeviceMetadataSchemaType = z.infer<
  typeof updateDeviceMetadataSchema
>;
export type DiscoveredDeviceSchemaType = z.infer<typeof discoveredDeviceSchema>;
export type DeviceFiltersSchemaType = z.infer<typeof deviceFiltersSchema>;
