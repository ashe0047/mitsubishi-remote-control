import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { BaseWebSocketMessage } from './websocket-message.dto';
import { OverrideStatus } from '../../../quotas/enums/override.enums';

// Re-export OverrideStatus for other modules
export { OverrideStatus };
import { RecurringType } from '../../../quotas/enums/quota.enums';

// Re-export RecurringType for other modules
export { RecurringType };

/**
 * Quota command types
 */
export enum QuotaCommand {
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  OVERRIDE_REQUEST = 'OVERRIDE_REQUEST',
  OVERRIDE_APPROVAL = 'OVERRIDE_APPROVAL',
  OVERRIDE_REJECTION = 'OVERRIDE_REJECTION',
  HEALTH_CHECK = 'HEALTH_CHECK',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  STATUS_UPDATE = 'STATUS_UPDATE',
  WARNING_THRESHOLD = 'WARNING_THRESHOLD',
}

/**
 * Subscription types for quota monitoring
 */
export enum QuotaSubscriptionType {
  STATUS = 'STATUS', // Real-time status updates
  ALERTS = 'ALERTS', // Only alerts and warnings
  ALL = 'ALL', // All quota-related events
}

/**
 * Quota WebSocket command message
 */
export class QuotaCommandMessage extends BaseWebSocketMessage {
  @IsEnum(QuotaCommand)
  declare type: QuotaCommand;

  @IsObject()
  declare data: {
    quotaId: string;
    roomId: string;
    familyMemberId: string;
    parameters: QuotaCommandParameters;
  };
}

/**
 * Quota command parameters
 */
export class QuotaCommandParameters {
  @IsOptional()
  @IsEnum(QuotaSubscriptionType)
  subscriptionType?: QuotaSubscriptionType;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440) // Max 24 hours in minutes
  overrideDuration?: number;

  @IsOptional()
  @IsString()
  requestedBy?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  overrideId?: string;
}

/**
 * Quota status information
 */
export class QuotaStatus {
  @IsString()
  quotaId!: string;

  @IsString()
  roomId!: string;

  @IsNumber()
  currentUsage!: number;

  @IsNumber()
  allowedLimit!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentageUsed!: number;

  @IsBoolean()
  isExceeded!: boolean;

  @IsBoolean()
  isWarning!: boolean;

  @IsEnum(RecurringType)
  period!: RecurringType;

  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  @IsOptional()
  @IsObject()
  warnings?: {
    type: 'threshold' | 'rate' | 'time';
    message: string;
    threshold: number;
    currentValue: number;
  }[];

  @IsOptional()
  @IsObject()
  lastOverride?: {
    id: string;
    requestedBy: string;
    approvedBy?: string;
    reason: string;
    duration: number;
    createdAt: string;
    expiresAt: string;
    status: OverrideStatus;
  };

  @IsString()
  lastUpdated!: string;
}

/**
 * Quota status update message
 */
export class QuotaStatusUpdateMessage {
  @IsString()
  id!: string;

  @IsEnum(['status_update', 'quota_status_changed'])
  type!: 'status_update' | 'quota_status_changed';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    status: QuotaStatus;
    source: 'system' | 'user_action' | 'calculation';
  };

  @IsString()
  timestamp!: string;
}

/**
 * Override request data
 */
export class OverrideRequest {
  @IsString()
  id!: string;

  @IsString()
  quotaId!: string;

  @IsString()
  roomId!: string;

  @IsString()
  requestedBy!: string;

  @IsString()
  reason!: string;

  @IsNumber()
  @Min(1)
  @Max(1440)
  duration!: number; // in minutes

  @IsEnum(OverrideStatus)
  status!: OverrideStatus;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsString()
  createdAt!: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  approvedAt?: string;

  @IsOptional()
  @IsString()
  rejectedAt?: string;
}

/**
 * Override request message
 */
export class OverrideRequestMessage {
  @IsString()
  id!: string;

  @IsEnum(['override_requested'])
  type!: 'override_requested';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    request: OverrideRequest;
    requiresApproval: boolean;
    approvers: string[];
  };

  @IsString()
  timestamp!: string;
}

/**
 * Override decision message (approval/rejection)
 */
export class OverrideDecisionMessage {
  @IsString()
  id!: string;

  @IsEnum(['override_approved', 'override_rejected'])
  type!: 'override_approved' | 'override_rejected';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    request: OverrideRequest;
    decidedBy: string;
    decisionReason?: string;
    newQuotaStatus?: QuotaStatus;
  };

  @IsString()
  timestamp!: string;
}

/**
 * Quota warning message
 */
export class QuotaWarningMessage {
  @IsString()
  id!: string;

  @IsEnum(['warning_threshold'])
  type!: 'warning_threshold';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    warningType: 'threshold_exceeded' | 'rate_warning' | 'time_warning';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    currentUsage: number;
    threshold: number;
    percentageUsed: number;
    timeRemaining?: string; // for time-based warnings
  };

  @IsString()
  timestamp!: string;
}

/**
 * Quota exceeded message
 */
export class QuotaExceededMessage {
  @IsString()
  id!: string;

  @IsEnum(['quota_exceeded'])
  type!: 'quota_exceeded';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    currentUsage: number;
    allowedLimit: number;
    exceedAmount: number;
    exceedTime: string;
    availableOverrides: number;
    nextResetTime: string;
  };

  @IsString()
  timestamp!: string;
}

/**
 * Subscription confirmation message
 */
export class SubscriptionConfirmationMessage {
  @IsString()
  id!: string;

  @IsEnum(['subscription_confirmed', 'subscription_cancelled'])
  type!: 'subscription_confirmed' | 'subscription_cancelled';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    subscriptionType: QuotaSubscriptionType;
    userId: string;
    isActive: boolean;
    subscribedAt?: string;
    cancelledAt?: string;
  };

  @IsString()
  timestamp!: string;
}

/**
 * Quota health check response
 */
export class QuotaHealthCheckResponse {
  @IsString()
  id!: string;

  @IsEnum(['health_check'])
  type!: 'health_check';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    isActive: boolean;
    lastUpdate: string;
    monitoringSubscriptions: number;
    activeOverrides: number;
    systemHealth: {
      calculationEngine: 'healthy' | 'degraded' | 'offline';
      database: 'healthy' | 'degraded' | 'offline';
      notificationSystem: 'healthy' | 'degraded' | 'offline';
    };
  };

  @IsString()
  timestamp!: string;
}

/**
 * Quota command response
 */
export class QuotaCommandResponse {
  @IsString()
  id!: string;

  @IsEnum(['success', 'error'])
  status!: 'success' | 'error';

  @IsObject()
  data!: {
    success: boolean;
    command: QuotaCommand;
    quotaId: string;
    roomId: string;
    result?: {
      subscriptionActive?: boolean;
      overrideRequest?: OverrideRequest;
      quotaStatus?: QuotaStatus;
      healthStatus?: QuotaHealthCheckResponse['data'];
    };
    validationErrors?: string[];
    processingTime: number;
  };

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  statusUpdate?: {
    quotaId: string;
    roomId: string;
    newStatus?: QuotaStatus;
    currentUsage?: number;
    allowedLimit?: number;
    timestamp: string;
  };

  @IsString()
  timestamp!: string;
}

/**
 * Real-time quota analytics data
 */
export class QuotaAnalyticsData {
  @IsString()
  quotaId!: string;

  @IsString()
  roomId!: string;

  @IsObject()
  usageTrend: {
    current: number;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };

  @IsObject()
  consumptionRate: {
    currentRate: number; // units per hour
    averageRate: number;
    projectedUsage: number;
    timeToLimit: number; // minutes until limit reached
  };

  @IsObject()
  efficiency: {
    score: number; // 0-100
    vsAverage: number; // percentage compared to historical average
    recommendations: string[];
  };

  @IsString()
  timestamp!: string;
}

/**
 * Quota analytics update message
 */
export class QuotaAnalyticsUpdateMessage {
  @IsString()
  id!: string;

  @IsEnum(['analytics_update'])
  type!: 'analytics_update';

  @IsObject()
  data!: {
    quotaId: string;
    roomId: string;
    analytics: QuotaAnalyticsData;
  };

  @IsString()
  timestamp!: string;
}
