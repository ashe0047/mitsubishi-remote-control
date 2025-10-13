/**
 * Device Domain Types
 *
 * Core type definitions for the device-room integration architecture.
 * These types align with the backend Device entity and support protocol-agnostic
 * device management (MQTT, HTTP, future protocols).
 */

/**
 * Device type enumeration
 * Maps to backend DeviceType enum codes
 */
export enum DeviceType {
  AIR_CONDITIONER = 'airconditioner',
  THERMOSTAT = 'thermostat',
  HUMIDIFIER = 'humidifier',
  FAN = 'fan',
}

/**
 * Device entity
 * Represents a registered device in the system
 *
 * Aligned with backend Device.java:
 * - id: UUID from backend
 * - deviceIdentifier: Protocol-agnostic identifier (lowercase alphanumeric + hyphens/underscores)
 * - enabled: Control whether device can receive commands
 */
export interface Device {
  /** Unique device ID (UUID from backend) */
  id: string;

  /** Room this device belongs to (UUID) */
  roomId: string;

  /** Type of device */
  deviceType: DeviceType;

  /** Protocol-agnostic device identifier (e.g., "master_bedroom_aircon") */
  deviceIdentifier: string;

  /** Optional manufacturer name */
  manufacturer?: string;

  /** Optional model name */
  model?: string;

  /** Whether device is enabled for control */
  enabled: boolean;

  /** Additional device metadata (key-value pairs) */
  metadata?: Record<string, unknown>;

  /** Device creation timestamp (ISO 8601) */
  createdAt: string;

  /** Device last updated timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Request payload for registering a new device.
 */
export interface RegisterDeviceRequest {
  /** Room ID to assign device to (required) */
  roomId: string;
  /** Device type (required) */
  deviceType: DeviceType;
  /** Device identifier (required, unique business key) */
  deviceIdentifier: string;
  /** Device manufacturer (optional) */
  manufacturer?: string;
  /** Device model (optional) */
  model?: string;
  /** Whether device should be enabled on registration (default: true) */
  enabled?: boolean;
}

/**
 * Request payload for updating device metadata.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateDeviceMetadataRequest {
  /** Updated manufacturer (optional) */
  manufacturer?: string;
  /** Updated model (optional) */
  model?: string;
  /** Updated enabled status (optional) */
  enabled?: boolean;
}

/**
 * Form data for device create/edit dialogs.
 */
export interface DeviceFormData {
  roomId: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  manufacturer: string;
  model: string;
  enabled: boolean;
}

/**
 * Discovered device
 * Represents a device detected via MQTT but not yet registered
 *
 * Triggered by backend when unknown device sends MQTT message
 */
export interface DiscoveredDevice {
  /** Device identifier from MQTT topic */
  deviceIdentifier: string;

  /** Type of device detected (unknown when not provided) */
  deviceType?: DeviceType;

  /** Optional room identifier hinted by backend */
  roomId?: string | null;

  /** Raw discovery payload from MQTT */
  payload?: Record<string, unknown>;

  /** Discovery metadata (e.g., topic, message type) */
  metadata?: Record<string, unknown>;

  /** Timestamp when discovery was first seen */
  firstSeenAt: string;

  /** Timestamp for the last seen MQTT message */
  lastSeenAt: string;

  /** Whether the device still requires registration */
  requiresRegistration: boolean;
}

export function safeParseDeviceType(value?: string | null): DeviceType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return Object.values(DeviceType).find((type) => type === normalized) as DeviceType | undefined;
}

/**
 * Device filter criteria for search/filter functionality.
 */
export interface DeviceFilters {
  /** Search term (searches identifier, manufacturer, model) */
  searchTerm?: string;
  /** Filter by device type */
  deviceType?: DeviceType | 'all';
  /** Filter by enabled status */
  enabled?: boolean | 'all';
  /** Filter by room ID */
  roomId?: string;
}

/**
 * Device state wrapper
 * Associates device identifier with its current state
 */
export interface DeviceState<T = any> {
  /** Device identifier */
  deviceIdentifier: string;

  /** Current device state (e.g., AirConState, ThermostatState) */
  state: T;

  /** Last state update timestamp (Unix milliseconds) */
  lastUpdate: number;
}

/**
 * Device identifier validation
 * Must be lowercase alphanumeric with hyphens or underscores only
 */
export const DEVICE_IDENTIFIER_PATTERN = /^[a-z0-9_-]+$/;

/**
 * Validate device identifier format
 */
export function isValidDeviceIdentifier(identifier: string): boolean {
  return DEVICE_IDENTIFIER_PATTERN.test(identifier);
}

/**
 * Extract device identifier from MQTT topic
 * Pattern: mitsubishi2mqtt/{deviceId}/state
 */
export function extractDeviceIdentifier(topic: string): string | null {
  const match = topic.match(/mitsubishi2mqtt\/([^\/]+)\//);
  return match?.[1] || null;
}
