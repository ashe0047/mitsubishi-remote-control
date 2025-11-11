// Matching Spring Boot AirConSettings exactly
export interface AirConSettings {
  targetTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  temperatureUnit: 'C' | 'F';
  supportedModes: ('COOL' | 'HEAT' | 'AUTO' | 'DRY' | 'FAN')[];
  supportedFanSpeeds: ('LOW' | 'MEDIUM' | 'HIGH' | 'AUTO')[];
  hasSwing: boolean;
  hasTurbo: boolean;
  hasEco: boolean;
  hasQuiet: boolean;
  hasFilter: boolean;
  hasSleep: boolean;
  hasIFeel: boolean;
  hasTimer: boolean;
  // Additional settings as needed
  deviceId?: string;
  roomId?: string;
  lastUpdated?: Date;
}
