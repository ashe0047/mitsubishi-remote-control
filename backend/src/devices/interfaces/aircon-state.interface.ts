// Matching Spring Boot AirConState exactly
export interface AirConState {
  power: boolean;
  mode: 'COOL' | 'HEAT' | 'AUTO' | 'DRY' | 'FAN';
  temperature: number;
  fanSpeed: 'LOW' | 'MEDIUM' | 'HIGH' | 'AUTO';
  swing?: boolean;
  turbo?: boolean;
  eco?: boolean;
  quiet?: boolean;
  filter?: boolean;
  sleep?: boolean;
  iFeel?: boolean;
  timer?: {
    enabled: boolean;
    hours?: number;
    minutes?: number;
  };
  // Additional state properties as needed
  lastUpdated?: Date;
  deviceId?: string;
  roomId?: string;
}
