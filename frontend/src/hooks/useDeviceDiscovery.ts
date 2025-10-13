/**
 * useDeviceDiscovery Hook
 *
 * Focused interface for device discovery operations (ISP compliance).
 * Provides access to discovered devices and registration functionality.
 *
 * CRITICAL Zustand v5 Pattern:
 * - Select stable store methods, invoke them inside memoized callbacks
 * - Avoid selecting entire store objects to prevent infinite loops
 */

import { useCallback, useMemo } from 'react';
import { useDeviceStore } from '@/stores/device-store';
import type { DiscoveredDevice, Device, DeviceType } from '@/types/device';

export interface RegisterDiscoveredDeviceOptions {
  /** Additional metadata to persist on registration */
  metadata?: Record<string, unknown>;
  /** Override device type when discovery payload is missing the value */
  deviceTypeOverride?: DeviceType;
}

export interface UseDeviceDiscoveryReturn {
  /** List of discovered devices */
  discoveredDevices: DiscoveredDevice[];
  /** Whether discovery operations are in-flight */
  isLoading: boolean;
  /** Last discovery error message */
  error: string | null;
  /** Fetch discoveries from REST endpoint */
  fetchDiscoveries: (roomId?: string) => Promise<DiscoveredDevice[]>;
  /** Hydrate store with pre-fetched discoveries */
  hydrateDiscoveries: (discoveries: DiscoveredDevice[]) => void;
  /** Register a discovered device */
  registerDevice: (
    discovery: DiscoveredDevice,
    roomId: string,
    options?: RegisterDiscoveredDeviceOptions
  ) => Promise<Device>;
  /** Dismiss a discovery notification */
  dismissDiscovery: (deviceIdentifier: string) => Promise<void>;
  /** Clear all discoveries */
  clearDiscoveries: () => void;
}

/**
 * Hook for device discovery operations
 *
 * @example
 * const {
 *   discoveredDevices,
 *   fetchDiscoveries,
 *   registerDevice,
 *   dismissDiscovery
 * } = useDeviceDiscovery();
 */
export function useDeviceDiscovery(): UseDeviceDiscoveryReturn {
  const getDiscoveredDevices = useDeviceStore((state) => state.getDiscoveredDevices);
  const fetchDiscoveries = useDeviceStore((state) => state.fetchDiscoveredDevices);
  const hydrateDiscoveries = useDeviceStore((state) => state.hydrateDiscoveredDevices);
  const registerDeviceAction = useDeviceStore((state) => state.registerDiscoveredDevice);
  const dismissDiscoveryAction = useDeviceStore((state) => state.dismissDiscovery);
  const clearDiscoveriesAction = useDeviceStore((state) => state.clearDiscoveries);
  const discoveryError = useDeviceStore((state) => state.discoveryError);
  const isDiscoveryLoading = useDeviceStore((state) => state.isDiscoveryLoading);

  const discoveredDevices = useMemo(() => getDiscoveredDevices(), [getDiscoveredDevices]);

  const registerDevice = useCallback(
    (
      discovery: DiscoveredDevice,
      roomId: string,
      options?: RegisterDiscoveredDeviceOptions
    ) => registerDeviceAction(discovery, roomId, options),
    [registerDeviceAction]
  );

  const dismissDiscovery = useCallback(
    (deviceIdentifier: string) => dismissDiscoveryAction(deviceIdentifier),
    [dismissDiscoveryAction]
  );

  const clearDiscoveries = useCallback(
    () => clearDiscoveriesAction(),
    [clearDiscoveriesAction]
  );

  return {
    discoveredDevices,
    isLoading: isDiscoveryLoading,
    error: discoveryError,
    fetchDiscoveries,
    hydrateDiscoveries,
    registerDevice,
    dismissDiscovery,
    clearDiscoveries,
  };
}
