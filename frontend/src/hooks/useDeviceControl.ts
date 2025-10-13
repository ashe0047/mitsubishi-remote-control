/**
 * useDeviceControl Hook
 *
 * Facade pattern implementation for device control commands.
 * Simplifies interface by hiding roomId parameter and device selection logic.
 *
 * This hook automatically routes commands to the selected device in the room.
 *
 * CRITICAL Zustand v5 Pattern:
 * - Use specific selectors for store methods
 */

import { useStore } from 'zustand';
import { deviceStore } from '@/stores/device-store';
import { websocketClient } from '@/lib/websocket/websocket-client';
import type { AirConState } from '@/lib/websocket/types';

export interface UseDeviceControlReturn {
  /** Set device temperature */
  setTemperature: (temperature: number) => Promise<void>;

  /** Set device mode */
  setMode: (mode: string) => Promise<void>;

  /** Set fan speed */
  setFan: (fan: string) => Promise<void>;

  /** Set power on/off */
  setPower: (power: 'on' | 'off') => Promise<void>;

  /** Get current device state */
  getState: () => AirConState | undefined;
}

/**
 * Hook for controlling devices in a room
 *
 * @param roomId Room UUID
 *
 * @example
 * const { setTemperature, setMode, setPower } = useDeviceControl(roomId);
 *
 * // Commands automatically route to selected device
 * await setTemperature(24);
 * await setMode('cool');
 * await setPower('on');
 */
export function useDeviceControl(roomId: string): UseDeviceControlReturn {
  // Zustand v5: Use specific selectors
  const getSelectedDevice = useStore(deviceStore, (state) => state.getSelectedDevice);
  const getDeviceState = useStore(deviceStore, (state) => state.getDeviceState);

  /**
   * Get selected device or throw error
   */
  const getSelectedDeviceOrThrow = () => {
    const device = getSelectedDevice(roomId);
    if (!device) {
      throw new Error(`No device selected for room ${roomId}`);
    }
    return device;
  };

  /**
   * Set temperature command
   */
  const setTemperature = async (temperature: number): Promise<void> => {
    const device = getSelectedDeviceOrThrow();

    try {
      await websocketClient.sendTemperatureCommand(roomId, temperature);
      console.log(
        `Set temperature to ${temperature}°C for device ${device.deviceIdentifier}`
      );
    } catch (error) {
      console.error('Failed to set temperature:', error);
      throw error;
    }
  };

  /**
   * Set mode command
   */
  const setMode = async (mode: string): Promise<void> => {
    const device = getSelectedDeviceOrThrow();

    try {
      await websocketClient.sendModeCommand(
        roomId,
        mode as 'heat' | 'cool' | 'auto' | 'dry' | 'fan'
      );
      console.log(`Set mode to ${mode} for device ${device.deviceIdentifier}`);
    } catch (error) {
      console.error('Failed to set mode:', error);
      throw error;
    }
  };

  /**
   * Set fan speed command
   */
  const setFan = async (fan: string): Promise<void> => {
    const device = getSelectedDeviceOrThrow();

    // Note: WebSocket client may not have sendFanCommand yet
    console.log(`Set fan to ${fan} for device ${device.deviceIdentifier}`);
    // TODO: Implement when websocket client supports fan command
    throw new Error('Fan command not yet implemented in WebSocket client');
  };

  /**
   * Set power command
   */
  const setPower = async (power: 'on' | 'off'): Promise<void> => {
    const device = getSelectedDeviceOrThrow();

    try {
      await websocketClient.sendPowerCommand(roomId, power);
      console.log(`Set power to ${power} for device ${device.deviceIdentifier}`);
    } catch (error) {
      console.error('Failed to set power:', error);
      throw error;
    }
  };

  /**
   * Get current device state
   */
  const getState = (): AirConState | undefined => {
    const device = getSelectedDevice(roomId);
    if (!device) return undefined;

    return getDeviceState(device.deviceIdentifier);
  };

  return {
    setTemperature,
    setMode,
    setFan,
    setPower,
    getState,
  };
}
