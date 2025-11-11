import type { AirConState } from './aircon-state.interface';

// Matching Spring Boot RoomStateUpdate exactly
export interface RoomStateUpdate {
  roomId: string;
  state: AirConState;
  timestamp: Date;
  // Additional update information as needed
  previousState?: AirConState;
  changeType?:
    | 'POWER'
    | 'MODE'
    | 'TEMPERATURE'
    | 'FAN_SPEED'
    | 'SETTINGS'
    | 'FULL';
}
