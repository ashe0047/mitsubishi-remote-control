import type { AirConState } from './aircon-state.interface';
import type { AirConSettings } from './aircon-settings.interface';

// Matching Spring Boot MqttStateUpdateEvent exactly
export interface MqttStateUpdateEvent {
  readonly source: string;
  readonly roomId: string;
  readonly state: AirConState;
  readonly timestamp: Date;
}

// Matching Spring Boot MqttSettingsUpdateEvent exactly
export interface MqttSettingsUpdateEvent {
  readonly source: string;
  readonly roomId: string;
  readonly settings: AirConSettings;
  readonly timestamp: Date;
}

// Matching Spring Boot MqttConnectionEvent exactly
export interface MqttConnectionEvent {
  readonly source: string;
  readonly clientId: string;
  readonly connected: boolean;
  readonly timestamp: Date;
  readonly reason?: string;
}

// Matching Spring Boot QuotaUpdateEvent exactly
export interface QuotaUpdateEvent {
  readonly source: string;
  readonly quotaId: string;
  readonly userId: string;
  readonly userName: string;
  readonly roomId: string;
  readonly roomName: string;
  readonly usage: {
    remainingSeconds?: number;
    remainingCount?: number;
    remainingEnergy?: number;
    remainingCost?: number;
  };
  readonly timestamp: Date;
}

// Matching Spring Boot QuotaViolationEvent exactly
export interface QuotaViolationEvent {
  readonly source: string;
  readonly quotaId: string;
  readonly userId: string;
  readonly userName: string;
  readonly roomId: string;
  readonly roomName: string;
  readonly violationType:
    | 'TIME_QUOTA'
    | 'COUNT_QUOTA'
    | 'ENERGY_QUOTA'
    | 'COST_QUOTA';
  readonly usagePercent: number;
  readonly limitPercent: number;
  readonly timestamp: Date;
}
