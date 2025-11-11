import type { AirConState } from './aircon-state.interface';

// Matching Spring Boot MqttStateUpdateEvent exactly
export interface MqttStateUpdateEvent {
  roomId: string;
  state: AirConState;
  timestamp: Date;
  // Additional event information as needed
  deviceId?: string;
  topic?: string;
  rawMessage?: any;
}
