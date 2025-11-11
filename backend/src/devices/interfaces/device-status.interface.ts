import type { AirConState } from './aircon-state.interface';
import type { AirConSettings } from './aircon-settings.interface';

// Matching Spring Boot DeviceStatus exactly
export interface DeviceStatus {
  deviceId: string;
  roomId: string;
  isOnline: boolean;
  lastSeen: Date;
  state?: AirConState;
  settings?: AirConSettings;
  // Additional device status information
  model?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  signalStrength?: number;
  batteryLevel?: number;
  errors?: string[];
}
