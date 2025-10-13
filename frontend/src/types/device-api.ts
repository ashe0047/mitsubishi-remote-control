/**
 * Device API Request/Response Types
 *
 * Type definitions for REST API communication with backend device endpoints.
 * All types align with backend DTOs (RegisterDeviceRequest, DeviceDto, etc.)
 */

import { Device, DeviceType } from './device';

/**
 * Device registration request
 * Used when registering a discovered device to a room
 *
 * Aligns with backend RegisterDeviceRequest.java
 */
export interface RegisterDeviceRequest {
  /** Device identifier from discovery (required) */
  discoveredDeviceId: string;

  /** Room ID to register device to (UUID, required) */
  roomId: string;

  /** Optional friendly name for device */
  deviceName?: string;

  /** Optional manufacturer name */
  manufacturer?: string;

  /** Optional model name */
  model?: string;

  /** Optional custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Device update request
 * Used for PATCH /api/devices/{deviceId}
 */
export interface UpdateDeviceRequest {
  /** Enable or disable device */
  enabled?: boolean;

  /** Update device name */
  deviceName?: string;

  /** Update manufacturer */
  manufacturer?: string;

  /** Update model */
  model?: string;

  /** Update metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Device command request
 * Generic structure for device commands via REST API
 */
export interface DeviceCommandRequest {
  /** Device identifier */
  deviceIdentifier: string;

  /** Command type (e.g., 'set_temperature', 'set_mode') */
  command: string;

  /** Command parameters */
  params: Record<string, unknown>;
}

/**
 * API Response wrapper
 * Standard response format from backend
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;

  /** Success flag */
  success: boolean;

  /** Optional error message */
  error?: string;

  /** Response timestamp */
  timestamp: number;
}

/**
 * Device list response
 * Response from GET /api/devices/room/{roomId}
 */
export type DeviceListResponse = Device[];

/**
 * Device registration response
 * Response from POST /api/devices/discovery/register
 */
export type DeviceRegistrationResponse = Device;

/**
 * Discovered devices response
 * Response from GET /api/devices/discovery/room/{roomId}
 */
export type DiscoveredDevicesResponse = Array<{
  deviceIdentifier: string;
  deviceType: DeviceType;
  messageType: string;
  payload: Record<string, unknown>;
  timestamp: number;
  requiresRegistration: boolean;
}>;
