/**
 * useDeviceSelection Hook
 *
 * Focused interface for device selection within a room (ISP compliance).
 * Handles device selection, persistence, and multi-device scenarios.
 *
 * CRITICAL Zustand v5 Pattern:
 * - Use specific selectors for each value needed
 * - Use useShallow for multiple related values
 */

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { deviceStore } from '@/stores/device-store';
import type { Device } from '@/types';

export interface UseDeviceSelectionReturn {
  /** All devices in room */
  devices: Device[];

  /** Enabled devices only */
  enabledDevices: Device[];

  /** Currently selected device */
  selectedDevice: Device | undefined;

  /** Select a device */
  selectDevice: (deviceIdentifier: string) => void;

  /** Whether room has multiple devices */
  hasMultipleDevices: boolean;

  /** Whether room has multiple enabled devices */
  hasMultipleEnabledDevices: boolean;
}

/**
 * Hook for device selection within a room
 *
 * @param roomId Room UUID
 *
 * @example
 * const {
 *   devices,
 *   selectedDevice,
 *   selectDevice,
 *   hasMultipleDevices
 * } = useDeviceSelection(roomId);
 *
 * // Show device selector if multiple devices
 * if (hasMultipleDevices) {
 *   return <DeviceSelector devices={devices} onSelect={selectDevice} />;
 * }
 *
 * // Use selected device for commands
 * sendCommand(selectedDevice.deviceIdentifier, command);
 */
export function useDeviceSelection(roomId: string): UseDeviceSelectionReturn {
  // Zustand v5: Use useShallow for multiple related values
  const [devices, selectedDevices, getEnabledDevices, selectDeviceAction] = useStore(
    deviceStore,
    useShallow((state) => [
      state.devices[roomId] || [],
      state.selectedDevices,
      state.getEnabledDevices,
      state.selectDevice,
    ])
  );

  const selectedIdentifier = selectedDevices[roomId];
  const selectedDevice = selectedIdentifier
    ? devices.find((d) => d.deviceIdentifier === selectedIdentifier)
    : undefined;

  const enabledDevices = getEnabledDevices(roomId);

  const selectDevice = (deviceIdentifier: string) => {
    selectDeviceAction(roomId, deviceIdentifier);
  };

  return {
    devices,
    enabledDevices,
    selectedDevice,
    selectDevice,
    hasMultipleDevices: devices.length > 1,
    hasMultipleEnabledDevices: enabledDevices.length > 1,
  };
}
