import { useCallback, useMemo } from 'react';
import { useAirconContext } from '@/hooks/useAircon';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobile } from '@/hooks/useMobile';
import { MODE_VALUES } from '@/lib/mqtt/mqtt-config';
import { useAirConditionerState } from './useAirConditionerState';

export interface AirConditionerControls {
  setTemperature: (temp: number) => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  setFan: (fan: string) => Promise<void>;
  togglePower: () => Promise<void>;
  incrementTemperature: () => Promise<void>;
  decrementTemperature: () => Promise<void>;
}

/**
 * Provides air conditioner control functions for a specific room
 * Includes haptic feedback on mobile devices
 * @param roomId - The room ID to control
 * @returns Object with AC control functions
 */
export const useAirConditionerControls = (
  roomId: string
): AirConditionerControls => {
  const {
    setTemperature: setTempApi,
    setMode: setModeApi,
    setFan: setFanApi
  } = useAirconContext();
  const state = useAirConditionerState(roomId);
  const isMobile = useMobile();
  const triggerHaptic = useHaptic(isMobile);

  const setTemperature = useCallback(
    async (temp: number) => {
      try {
        await setTempApi(roomId, temp);
        triggerHaptic(30);
      } catch (error) {
        console.error('Failed to set temperature:', error);
      }
    },
    [roomId, setTempApi, triggerHaptic]
  );

  const setMode = useCallback(
    async (mode: string) => {
      try {
        await setModeApi(roomId, mode);
        triggerHaptic(50);
      } catch (error) {
        console.error('Failed to set mode:', error);
      }
    },
    [roomId, setModeApi, triggerHaptic]
  );

  const setFan = useCallback(
    async (fan: string) => {
      try {
        await setFanApi(roomId, fan);
        triggerHaptic(30);
      } catch (error) {
        console.error('Failed to set fan:', error);
      }
    },
    [roomId, setFanApi, triggerHaptic]
  );

  const togglePower = useCallback(
    async () => {
      if (!state) return;
      const newMode = state.isActive ? MODE_VALUES.OFF : MODE_VALUES.COOL;
      try {
        await setModeApi(roomId, newMode);
        triggerHaptic(100);
      } catch (error) {
        console.error('Failed to toggle power:', error);
      }
    },
    [state, roomId, setModeApi, triggerHaptic]
  );

  const incrementTemperature = useCallback(
    async () => {
      if (!state) return;
      const newTemp = Math.min(state.temperature + 1, 31);
      await setTemperature(newTemp);
    },
    [state, setTemperature]
  );

  const decrementTemperature = useCallback(
    async () => {
      if (!state) return;
      const newTemp = Math.max(state.temperature - 1, 16);
      await setTemperature(newTemp);
    },
    [state, setTemperature]
  );

  return useMemo(
    () => ({
      setTemperature,
      setMode,
      setFan,
      togglePower,
      incrementTemperature,
      decrementTemperature,
    }),
    [setTemperature, setMode, setFan, togglePower, incrementTemperature, decrementTemperature]
  );
};
