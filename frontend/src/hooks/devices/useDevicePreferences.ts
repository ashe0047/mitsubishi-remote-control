import { useCallback } from 'react';
import useAirConPreferences from '@/hooks/usePrefs';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobile } from '@/hooks/useMobile';

export interface DevicePreferences {
  useFahrenheit: boolean;
  sleepMode: boolean;
  toggleTemperatureUnit: () => void;
  toggleSleepMode: () => void;
}

/**
 * Manages user preferences for device controls
 * Includes temperature unit and sleep mode settings
 * @returns Preferences object with toggle functions
 */
export const useDevicePreferences = (): DevicePreferences => {
  const [prefs, setPrefs] = useAirConPreferences();
  const isMobile = useMobile();
  const triggerHaptic = useHaptic(isMobile);

  const toggleTemperatureUnit = useCallback(() => {
    setPrefs((prev) => ({ ...prev, useFahrenheit: !prev.useFahrenheit }));
    triggerHaptic(30);
  }, [setPrefs, triggerHaptic]);

  const toggleSleepMode = useCallback(() => {
    setPrefs((prev) => ({ ...prev, sleepMode: !prev.sleepMode }));
    triggerHaptic(50);
  }, [setPrefs, triggerHaptic]);

  return {
    useFahrenheit: prefs.useFahrenheit,
    sleepMode: prefs.sleepMode,
    toggleTemperatureUnit,
    toggleSleepMode,
  };
};
