import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseWebSocketMessage } from './websocket-message.dto';

/**
 * Air conditioner command types
 */
export enum AirConditionerCommand {
  SET_POWER = 'SET_POWER',
  SET_TEMPERATURE = 'SET_TEMPERATURE',
  SET_MODE = 'SET_MODE',
  SET_FAN = 'SET_FAN',
  SET_VANE = 'SET_VANE',
  SET_WIDEVANE = 'SET_WIDEVANE',
  GET_STATUS = 'GET_STATUS',
  STATE_UPDATE = 'STATE_UPDATE',
}

/**
 * Air conditioner modes
 */
export enum AirConditionerMode {
  OFF = 'OFF',
  HEAT_COOL = 'HEAT_COOL',
  COOL = 'COOL',
  DRY = 'DRY',
  HEAT = 'HEAT',
  FAN_ONLY = 'FAN_ONLY',
}

/**
 * Fan speed settings
 */
export enum FanSpeed {
  AUTO = 'AUTO',
  SPEED_1 = '1',
  SPEED_2 = '2',
  SPEED_3 = '3',
  SPEED_4 = '4',
  QUIET = 'QUIET',
}

/**
 * Vane position settings
 */
export enum VanePosition {
  AUTO = 'AUTO',
  POSITION_1 = '1',
  POSITION_2 = '2',
  POSITION_3 = '3',
  POSITION_4 = '4',
  POSITION_5 = '5',
  SWING = 'SWING',
}

/**
 * Wide vane position settings
 */
export enum WideVanePosition {
  FAR_LEFT = '<<',
  LEFT = '<',
  CENTER = '|',
  RIGHT = '>',
  FAR_RIGHT = '>>',
  SWING = 'SWING',
}

/**
 * Air conditioner control parameters
 */
export class AirConditionerParameters {
  @IsOptional()
  @IsEnum(['on', 'off'])
  power?: 'on' | 'off';

  @IsOptional()
  @IsNumber()
  @Min(16)
  @Max(31)
  temperature?: number;

  @IsOptional()
  @IsEnum(AirConditionerMode)
  mode?: AirConditionerMode;

  @IsOptional()
  @IsEnum(FanSpeed)
  fan?: FanSpeed;

  @IsOptional()
  @IsEnum(VanePosition)
  vane?: VanePosition;

  @IsOptional()
  @IsEnum(WideVanePosition)
  wideVane?: WideVanePosition;
}

/**
 * Air conditioner WebSocket command message
 */
export class AirConditionerCommandMessage extends BaseWebSocketMessage {
  @IsEnum(AirConditionerCommand)
  declare type: AirConditionerCommand;

  @IsObject()
  @Type(() => AirConditionerParameters)
  declare data: {
    roomId: string;
    familyMemberId: string;
    deviceId?: string;
    parameters: AirConditionerParameters;
  };
}

/**
 * Device status information
 */
export class DeviceStatus {
  @IsString()
  deviceId!: string;

  @IsEnum(['on', 'off'])
  power!: 'on' | 'off';

  @IsOptional()
  @IsNumber()
  @Min(16)
  @Max(31)
  temperature?: number;

  @IsOptional()
  @IsEnum(AirConditionerMode)
  mode?: AirConditionerMode;

  @IsOptional()
  @IsEnum(FanSpeed)
  fan?: FanSpeed;

  @IsOptional()
  @IsEnum(VanePosition)
  vane?: VanePosition;

  @IsOptional()
  @IsEnum(WideVanePosition)
  wideVane?: WideVanePosition;

  @IsOptional()
  @IsNumber()
  roomTemperature?: number;

  @IsOptional()
  @IsNumber()
  energyConsumption?: number;

  @IsString()
  lastUpdated!: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsString()
  errorCode?: string;
}

/**
 * Device status update message
 */
export class DeviceStatusUpdateMessage {
  @IsString()
  id!: string;

  @IsEnum(['status_update', 'device_status_changed'])
  type!: 'status_update' | 'device_status_changed';

  @IsObject()
  data!: {
    roomId: string;
    status: DeviceStatus;
    source: 'mqtt' | 'api' | 'websocket';
  };

  @IsString()
  timestamp!: string;
}

/**
 * Air conditioner status response
 */
export class AirConditionerStatusResponse {
  @IsString()
  roomId!: string;

  @IsString()
  deviceId!: string;

  @IsObject()
  status!: DeviceStatus;

  @IsOptional()
  @IsObject()
  metadata?: {
    model?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    installationDate?: string;
  };

  @IsString()
  timestamp!: string;
}

/**
 * Air conditioner command response
 */
export class AirConditionerCommandResponse {
  @IsString()
  id!: string;

  @IsEnum(['success', 'error'])
  status!: 'success' | 'error';

  @IsObject()
  data!: {
    success: boolean;
    command: AirConditionerCommand;
    deviceId: string;
    roomId: string;
    result?: DeviceStatus;
    validationErrors?: string[];
    processingTime: number;
  };

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  timestamp!: string;
}

/**
 * Room devices information
 */
export class RoomDevicesInfo {
  @IsString()
  roomId!: string;

  @IsObject()
  devices!: Record<string, DeviceStatus>;

  @IsNumber()
  totalDevices!: number;

  @IsNumber()
  activeDevices!: number;

  @IsOptional()
  @IsNumber()
  totalEnergyConsumption?: number;

  @IsString()
  timestamp!: string;
}

/**
 * Energy consumption data
 */
export class EnergyConsumptionData {
  @IsString()
  deviceId!: string;

  @IsNumber()
  currentConsumption!: number; // in watts

  @IsNumber()
  dailyConsumption!: number; // in kWh

  @IsNumber()
  monthlyConsumption!: number; // in kWh

  @IsString()
  timestamp!: string;
}

/**
 * Energy consumption update message
 */
export class EnergyConsumptionUpdateMessage {
  @IsString()
  id!: string;

  @IsEnum(['energy_update'])
  type!: 'energy_update';

  @IsObject()
  data!: {
    roomId: string;
    consumption: Record<string, EnergyConsumptionData>;
  };

  @IsString()
  timestamp!: string;
}
