/**
 * Device Message Adapter
 *
 * Adapter pattern implementation for WebSocket message transformation.
 * Centralizes all message conversion logic (DRY compliance).
 *
 * Transforms backend WebSocket messages to frontend format:
 * - Device state updates (STATE, SETTINGS)
 * - Device discovery notifications (DEVICE_DISCOVERED)
 * - Error handling and validation
 */

import {
  DeviceStateMessage,
  DeviceDiscoveryMessage,
  AirConState,
} from '@/lib/websocket/types';
import {
  Device,
  DiscoveredDevice,
  isValidDeviceIdentifier,
  extractDeviceIdentifier,
  safeParseDeviceType,
} from '@/types';

/**
 * Adapted device state update
 * Result of transforming DeviceStateMessage
 */
export interface AdaptedDeviceState {
  roomId?: string; // Optional - backend may not always provide roomId
  deviceIdentifier: string;
  state: AirConState;
  timestamp: number;
}

/**
 * Device Message Adapter
 * Static methods for message transformation (stateless, pure functions)
 */
export class DeviceMessageAdapter {
  /**
   * Adapt device state message from backend to frontend format
   *
   * @param wsMessage Device state message from WebSocket
   * @returns Adapted state or null if invalid
   */
  static adaptStateMessage(
    wsMessage: DeviceStateMessage
  ): AdaptedDeviceState | null {
    try {
      const payload = wsMessage.payload;

      // Validate required fields
      if (!payload || !payload.deviceIdentifier || !payload.data) {
        console.error('Invalid device state message: missing required fields', wsMessage);
        return null;
      }

      // Validate device identifier format
      if (!isValidDeviceIdentifier(payload.deviceIdentifier)) {
        console.error(
          `Invalid device identifier format: ${payload.deviceIdentifier}`,
          wsMessage
        );
        return null;
      }

      return {
        roomId: wsMessage.roomId, // May be undefined
        deviceIdentifier: payload.deviceIdentifier,
        state: payload.data,
        timestamp: payload.timestamp || Date.now(),
      };
    } catch (error) {
      console.error('Failed to adapt device state message:', error, wsMessage);
      return null;
    }
  }

  /**
   * Adapt device discovery message from backend to frontend format
   *
   * @param wsMessage Device discovery message from WebSocket
   * @returns Discovered device or null if invalid
   */
  static adaptDiscoveryMessage(
    wsMessage: DeviceDiscoveryMessage
  ): DiscoveredDevice | null {
    try {
      const payload = wsMessage.payload;

      if (!payload || !payload.deviceIdentifier) {
        console.error('Invalid discovery message: missing device identifier', wsMessage);
        return null;
      }

      if (!isValidDeviceIdentifier(payload.deviceIdentifier)) {
        console.error(
          `Invalid device identifier format: ${payload.deviceIdentifier}`,
          wsMessage
        );
        return null;
      }

      const deviceType = safeParseDeviceType(payload.deviceType ?? undefined);
      const firstSeen = coerceIsoTimestamp(payload.firstSeenAt ?? payload.timestamp);
      const lastSeen = coerceIsoTimestamp(payload.lastSeenAt ?? payload.timestamp);
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : undefined;
      const metadata = isRecord(payload.metadata) ? (payload.metadata as Record<string, unknown>) : {};
      const mqttPayload = isRecord(payload.mqttPayload) ? (payload.mqttPayload as Record<string, unknown>) : {};

      return {
        deviceIdentifier: payload.deviceIdentifier,
        deviceType,
        roomId: roomId ?? null,
        payload: mqttPayload,
        metadata,
        firstSeenAt: firstSeen,
        lastSeenAt: lastSeen,
        requiresRegistration: payload.requiresRegistration ?? true,
      };
    } catch (error) {
      console.error('Failed to adapt discovery message:', error, wsMessage);
      return null;
    }
  }

  /**
   * Extract device identifier from MQTT topic
   * Pattern: mitsubishi2mqtt/{deviceId}/state
   *
   * @param topic MQTT topic string
   * @returns Device identifier or null if invalid
   */
  static extractDeviceIdentifierFromTopic(topic: string): string | null {
    return extractDeviceIdentifier(topic);
  }

  /**
   * Validate device identifier format
   * Must be lowercase alphanumeric with hyphens or underscores only
   *
   * @param identifier Device identifier to validate
   * @returns True if valid format
   */
  static isValidDeviceIdentifier(identifier: string): boolean {
    return isValidDeviceIdentifier(identifier);
  }

  /**
   * Extract room ID from device (requires lookup)
   * Note: This requires device-to-room mapping from store
   *
   * @param deviceIdentifier Device identifier
   * @param deviceLookup Function to lookup device by identifier
   * @returns Room ID or null if not found
   */
  static extractRoomId(
    deviceIdentifier: string,
    deviceLookup: (id: string) => Device | undefined
  ): string | null {
    const device = deviceLookup(deviceIdentifier);
    return device?.roomId || null;
  }
}
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const coerceIsoTimestamp = (value: unknown): string => {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

