import { useMemo } from 'react';
import { useAirconContext } from '@/hooks/useAircon';
import { MODE_VALUES } from '@/lib/mqtt/mqtt-config';

export interface AirConditionerState {
  temperature: number;
  mode: string;
  fan: string;
  isActive: boolean;
  currentTemp?: number;
  vane?: string;
  wideVane?: string;
}

/**
 * Extract air conditioner state for a specific room
 * @param roomId - The room ID to get AC state for
 * @returns AC state object or undefined if room not found
 */
export const useAirConditionerState = (
  roomId: string
): AirConditionerState | undefined => {
  const { getRoomInfo } = useAirconContext();
  const roomInfo = getRoomInfo(roomId);

  console.log('[useAirConditionerState] DEBUG:', {
    roomId,
    roomInfo,
    hasState: !!roomInfo?.state,
    hasSettings: !!roomInfo?.settings,
    hasDevices: !!roomInfo?.devices,
    deviceCount: roomInfo?.devices?.length ?? 0,
  });

  return useMemo(() => {
    const baseState = deriveStateFromRoomInfo(roomInfo);
    console.log('[useAirConditionerState] Derived state:', baseState);

    if (!baseState) {
      console.warn('[useAirConditionerState] No base state derived for room:', roomId);
      return undefined;
    }

    const result = {
      temperature: baseState.temperature,
      mode: baseState.mode,
      fan: baseState.fan,
      isActive: baseState.mode !== MODE_VALUES.OFF,
      currentTemp: baseState.roomTemperature,
      vane: baseState.vane,
      wideVane: baseState.wideVane,
    };

    console.log('[useAirConditionerState] Returning:', result);
    return result;
  }, [roomInfo, roomId]);
};

const deriveStateFromRoomInfo = (roomInfo: ReturnType<ReturnType<typeof useAirconContext>['getRoomInfo']>) => {
  if (!roomInfo) {
    return undefined;
  }

  if (roomInfo.state) {
    return roomInfo.state;
  }

  if (roomInfo.settings) {
    return {
      roomTemperature: roomInfo.state?.roomTemperature ?? -1,
      temperature: roomInfo.settings.temperature ?? 24,
      fan: roomInfo.settings.fan ?? 'AUTO',
      vane: roomInfo.settings.vane ?? 'AUTO',
      wideVane: roomInfo.settings.wideVane ?? '|',
      mode: roomInfo.settings.mode ?? MODE_VALUES.OFF,
      action: roomInfo.settings.mode && roomInfo.settings.mode !== MODE_VALUES.OFF ? 'running' : 'idle',
      compressorFrequency: roomInfo.state?.compressorFrequency ?? undefined,
    };
  }

  const deviceWithStatus = roomInfo.devices?.find((device) => device.currentStatus);
  if (deviceWithStatus?.currentStatus) {
    const status = deviceWithStatus.currentStatus;
    return {
      roomTemperature: status.roomTemperature ?? -1,
      temperature: status.temperature ?? status.roomTemperature ?? 24,
      fan: status.fan ?? 'AUTO',
      vane: status.vane ?? 'AUTO',
      wideVane: status.wideVane ?? '|',
      mode: status.mode ?? MODE_VALUES.OFF,
      action: status.power?.toLowerCase() === 'on' ? 'running' : 'idle',
      compressorFrequency: status.compressorFrequency ?? undefined,
    };
  }

  return {
    roomTemperature: -1,
    temperature: 24,
    fan: 'AUTO',
    vane: 'AUTO',
    wideVane: '|',
    mode: MODE_VALUES.OFF,
    action: 'idle',
    compressorFrequency: undefined,
  };
};
