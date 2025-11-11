export interface SessionMetadata {
  lastOperation?: string;
  operationHistory?: OperationRecord[];
  deviceState?: Record<string, any>;
  pauseReason?: string;
  pausedAt?: Date;
  terminationReason?: string;
  resumedAt?: Date;
}

export interface OperationRecord {
  operation: string;
  timestamp: Date;
  value?: any;
}

export interface OverrideParameters {
  amount?: number; // For ADD_TIME
  duration?: number; // Duration in hours
  unlimitedAccess?: boolean; // For EMERGENCY_OVERRIDE
  customSettings?: Record<string, any>;
}
