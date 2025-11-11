import type { AirConState } from './aircon-state.interface';
import type { AirConSettings } from './aircon-settings.interface';

// Matching Spring Boot RoomInfo exactly
export interface RoomInfo {
  roomId: string;
  roomName: string;
  state: AirConState;
  isOnline: boolean;
  lastUpdated: Date;
  // Additional room information as needed
  settings?: AirConSettings;
  householdId?: string;
  location?: string;
}
