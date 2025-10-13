/**
 * Device Discovery API Client (facade)
 *
 * Thin wrapper around the core DeviceApiClient to preserve legacy imports
 * while the discovery workflow migrates to the consolidated device store.
 */

import { deviceApiClient } from '@/lib/api/device-api-client';
import type { Device, DiscoveredDevice, DeviceType } from '@/types/device';

export class DeviceDiscoveryApiClient {
  /**
   * Retrieve discovered devices for an optional room scope.
   */
  async getDiscoveredDevices(roomId?: string): Promise<DiscoveredDevice[]> {
    return deviceApiClient.getDiscoveredDevices(roomId);
  }

  /**
   * Register a discovered device, defaulting to the discovery metadata when overrides are absent.
   */
  async registerDiscoveredDevice(
    roomId: string,
    deviceIdentifier: string,
    deviceType?: DeviceType,
    metadata?: Record<string, unknown>
  ): Promise<Device> {
    return deviceApiClient.registerDiscoveredDevice({
      deviceIdentifier,
      roomId,
      deviceType,
      metadata,
    });
  }

  /**
   * Dismiss a discovery without registering the device.
   */
  async dismissDiscoveredDevice(deviceIdentifier: string): Promise<void> {
    return deviceApiClient.dismissDiscoveredDevice(deviceIdentifier);
  }
}

export const deviceDiscoveryApiClient = new DeviceDiscoveryApiClient();
