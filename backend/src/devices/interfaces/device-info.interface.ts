import type { AirConState } from './aircon-state.interface';
import type { AirConSettings } from './aircon-settings.interface';

// Matching Spring Boot DeviceInfo exactly
export interface DeviceInfo {
  deviceId: string;
  roomId: string;
  isOnline: boolean;
  lastSeen: Date;
  state?: AirConState;
  settings?: AirConSettings;
  // Additional device metadata
  model?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  signalStrength?: number;
  batteryLevel?: number;
  errors?: string[];
}
