export interface DeviceOperation {
  type: string;
  value?: unknown;
  hasEmergencyOverride?: boolean;
  isBusinessHoursExempt?: boolean;
}

export interface QuotaValidationRequest {
  userId: string;
  roomId: string;
  deviceId: string;
  operation: DeviceOperation;
  sessionId?: string;
}

export interface QuotaValidationResult {
  isValid: boolean;
  reason: string;
  status?: ValidationStatus;
  warning?: boolean;
  bypassType?: string;
  overrideIds?: string[];
  quotaResults?: QuotaValidationResult[];
  timestamp: Date;
  duration?: number;
  balance?: QuotaBalance;
  usagePercentage?: number;
}

// Import ValidationStatus (circular import workaround)
export enum ValidationStatus {
  ALLOW = 'ALLOW',
  ALLOW_WITH_WARNING = 'ALLOW_WITH_WARNING',
  BLOCK = 'BLOCK',
  FAIL_OPEN = 'FAIL_OPEN',
}

export interface QuotaBalance {
  quotaId: string;
  userId: string;
  roomId: string;
  quotaType: string;
  scope: string;
  status: string;
  allowedAmount: number;
  usedAmount: number;
  remainingAmount: number;
  warningThresholds: number[];
  notificationMethods: string[];
  enforcementAction: string;
  overrides: Array<{
    id: string;
    type: string;
    status: string;
    expiresAt?: Date | null;
    isActive: boolean;
  }>;
  updatedAt: Date;
}
