import { DeviceStatus } from './device-strategy.interface';

/**
 * Air Conditioner specific commands
 */
export enum AirConditionerCommandType {
  SET_POWER = 'ac_set_power',
  GET_POWER = 'ac_get_power',
  SET_TEMPERATURE = 'ac_set_temperature',
  GET_TEMPERATURE = 'ac_get_temperature',
  SET_MODE = 'ac_set_mode',
  GET_MODE = 'ac_get_mode',
  SET_FAN = 'ac_set_fan',
  GET_FAN = 'ac_get_fan',
  SET_VANE = 'ac_set_vane',
  GET_VANE = 'ac_get_vane',
  SET_WIDEVANE = 'ac_set_widevane',
  GET_WIDEVANE = 'ac_get_widevane',
  GET_STATUS = 'ac_get_status',
  GET_SETTINGS = 'ac_get_settings',
  GET_STATE = 'ac_get_state',
}
/**
 * Air conditioner specific command parameters
 */
export interface AirConditionerCommandParameters {
  readonly power?: boolean;
  readonly temperature?: number;
  readonly mode?: 'auto' | 'cool' | 'heat' | 'dry' | 'fan';
  readonly fan?: 'auto' | 'low' | 'medium' | 'high' | 'quiet';
  readonly vane?: 'auto' | '1' | '2' | '3' | '4' | '5';
  readonly wideVane?: 'left' | 'right' | 'both' | 'off';
  readonly ecoMode?: boolean;
  readonly turboMode?: boolean;
  readonly sleepTimer?: number;
  readonly iFeel?: boolean;
  readonly threeDairflow?: boolean;
}

/**
 * Type guard to check if a command is an Air Conditioner command
 */
export function isAirConditionerCommand(
  command: string,
): command is AirConditionerCommandType {
  return Object.values(AirConditionerCommandType).includes(
    command as AirConditionerCommandType,
  );
}

export interface AirConditionerDeviceStatus extends DeviceStatus {}
