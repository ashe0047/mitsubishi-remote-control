import type { AirConSettings } from './aircon-settings.interface';

// Matching Spring Boot MqttSettingsUpdateEvent exactly
export interface MqttSettingsUpdateEvent {
  roomId: string;
  settings: AirConSettings;
  timestamp: Date;
  // Additional event information as needed
  deviceId?: string;
  topic?: string;
  rawMessage?: any;
}
