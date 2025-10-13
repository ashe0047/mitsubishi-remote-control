/**
 * Quota system type definitions
 * Provides comprehensive types for the quota management system
 */


/**
 * Quota types supported by the system
 */
export type QuotaType = 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';

/**
 * Quota status enumeration
 */
export type QuotaStatus = 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'PAUSED';

/**
 * Reset schedule options for quotas
 */
export type ResetSchedule = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/**
 * Urgency levels for override requests
 */
export type OverrideUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

/**
 * Override request types
 */
export type OverrideRequestType = 'TEMPORARY_INCREASE' | 'TIME_EXTENSION' | 'EMERGENCY_OVERRIDE';

/**
 * Override request status
 */
export type OverrideRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * Violation types for quota alerts
 */
export type ViolationType = 'WARNING_THRESHOLD' | 'LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS';

/**
 * Core quota usage interface
 */
export interface QuotaUsage {
  quotaId: string;
  familyMemberId: string;
  roomId: string;
  quotaType: QuotaType;
  
  // Current usage values
  currentUsage: number; // seconds for TIME, count for USAGE, kWh for ENERGY, dollars for COST
  dailyLimit: number;
  
  // Status and metadata
  status: QuotaStatus;
  warningThreshold: number; // percentage
  resetTime: string; // ISO timestamp for next reset
  lastUpdated: string; // ISO timestamp
  
  // Real-time session tracking
  isCurrentlyActive: boolean; // is AC currently running
  sessionStartTime?: string; // when current session started
  estimatedSessionUsage: number; // current session usage
}

/**
 * Quota configuration interface for setup
 */
export interface QuotaConfig {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  quotaType: QuotaType;
  
  // Limits based on quota type
  dailyLimitSeconds?: number; // for TIME_BASED
  dailyLimitUsages?: number; // for USAGE_BASED  
  dailyLimitKwh?: number; // for ENERGY_BASED
  dailyLimitAmount?: number; // for COST_BASED
  
  // Common settings
  resetSchedule: ResetSchedule;
  warningThreshold: number;
  
  // Optional time restrictions
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  activeDays?: number[]; // 0=Sunday, 1=Monday, etc.
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string; // parent user ID
}

/**
 * Override request interface
 */
export interface OverrideRequest {
  id: string;
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  
  // Request details
  requestType: OverrideRequestType;
  duration: number; // in minutes
  reason: string;
  urgency: OverrideUrgency;
  
  // Status and timestamps
  status: OverrideRequestStatus;
  requestedAt: string; // ISO timestamp
  respondedAt?: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp
  
  // Response details
  approvedBy?: string; // family member ID
  responseReason?: string;
  actualDuration?: number; // approved duration might differ from requested
}

/**
 * Quota violation alert interface
 */
export interface QuotaViolationAlert {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  violationType: ViolationType;
  currentUsage: number;
  limit: number;
  timestamp: string;
}

/**
 * WebSocket message types for quota system
 */
export interface QuotaUpdateMessage {
  type: 'QUOTA_UPDATE';
  payload: {
    quotaId: string;
    familyMemberId: string;
    roomId: string;
    currentUsage: number;
    dailyLimit: number;
    status: QuotaStatus;
    isCurrentlyActive: boolean;
    sessionStartTime?: string;
    estimatedSessionUsage: number;
    lastUpdated: string;
  };
}

export interface OverrideRequestMessage {
  type: 'OVERRIDE_REQUEST_CREATED' | 'OVERRIDE_REQUEST_UPDATED' | 'OVERRIDE_REQUEST_EXPIRED';
  payload: {
    requestId: string;
    quotaId: string;
    familyMemberId: string;
    status: OverrideRequestStatus;
    requestType: OverrideRequestType;
    duration: number;
    reason: string;
    urgency: OverrideUrgency;
    requestedAt: string;
    respondedAt?: string;
    approvedBy?: string;
    responseReason?: string;
  };
}

export interface QuotaViolationAlertMessage {
  type: 'QUOTA_VIOLATION_ALERT';
  payload: QuotaViolationAlert;
}

export type QuotaWebSocketMessage = QuotaUpdateMessage | OverrideRequestMessage | QuotaViolationAlertMessage;

/**
 * Form data interfaces for quota setup wizard
 */
export interface QuotaTypeSelectionFormData {
  type: QuotaType;
  template?: string;
}

export interface QuotaConfigFormData {
  dailyLimitSeconds?: number;
  dailyLimitUsages?: number;
  dailyLimitKwh?: number;
  dailyLimitAmount?: number;
  resetSchedule: ResetSchedule;
  warningThreshold: number;
  startTime?: string;
  endTime?: string;
  activeDays?: number[];
}

export interface FamilyMemberSelectionFormData {
  selectedMembers: string[];
}

export interface RoomSelectionFormData {
  selectedRooms: string[];
  applyToAll: boolean;
}

/**
 * Complete wizard data interface
 */
export interface QuotaWizardData {
  quotaType?: QuotaTypeSelectionFormData;
  quotaConfig?: QuotaConfigFormData;
  familyMembers?: FamilyMemberSelectionFormData;
  roomSelection?: RoomSelectionFormData;
}

/**
 * Quota template interface for quick setup
 */
export interface QuotaTemplate {
  id: string;
  name: string;
  description: string;
  type: QuotaType;
  resetSchedule: ResetSchedule;
  warningThreshold: number;
  
  // Default limits based on type
  dailyLimitSeconds?: number;
  dailyLimitUsages?: number;
  dailyLimitKwh?: number;
  dailyLimitAmount?: number;
}

/**
 * Quota statistics interface
 */
export interface QuotaStats {
  total: number;
  active: number;
  warning: number;
  exceeded: number;
  paused: number;
}

/**
 * Component prop interfaces
 */
export interface QuotaStatusWidgetProps {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  quotaType: QuotaType;
  currentUsage: number;
  dailyLimit: number;
  status: QuotaStatus;
  warningThreshold: number;
  resetTime?: string;
  showOverrideButton?: boolean;
  onOverrideClick?: () => void;
  compact?: boolean;
  className?: string;
}

export interface UsageTrackerProps {
  quotaId: string;
  familyMemberId: string;
  roomId: string;
  onUsageUpdate?: (usage: QuotaUsage) => void;
  onStatusChange?: (status: QuotaStatus) => void;
  className?: string;
}

export interface QuotaOverrideRequestProps {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  currentUsage: number;
  dailyLimit: number;
  quotaType: QuotaType;
  onRequestSubmit?: (request: OverrideRequestFormData) => Promise<void>;
  className?: string;
}

export interface OverrideRequestListProps {
  requests: OverrideRequest[];
  onApprove?: (requestId: string, duration?: number, reason?: string) => Promise<void>;
  onReject?: (requestId: string, reason: string) => Promise<void>;
  showActions?: boolean;
  className?: string;
}

/**
 * Override request form data
 */
export interface OverrideRequestFormData {
  requestType: OverrideRequestType;
  duration: number;
  reason: string;
  urgency: OverrideUrgency;
}

/**
 * Available rooms for quota assignment
 */
export interface QuotaRoom {
  id: string;
  name: string;
  location: string;
}

/**
 * Default quota templates
 */
export const DEFAULT_QUOTA_TEMPLATES: QuotaTemplate[] = [
  {
    id: 'child-basic-time',
    name: 'Child Basic Time',
    description: '2 hours daily AC usage for children',
    type: 'TIME_BASED',
    dailyLimitSeconds: 2 * 60 * 60, // 2 hours
    resetSchedule: 'DAILY',
    warningThreshold: 75,
  },
  {
    id: 'child-extended-time',
    name: 'Child Extended Time',
    description: '4 hours daily AC usage for older children',
    type: 'TIME_BASED',
    dailyLimitSeconds: 4 * 60 * 60, // 4 hours
    resetSchedule: 'DAILY',
    warningThreshold: 80,
  },
  {
    id: 'energy-conscious',
    name: 'Energy Conscious',
    description: '5 kWh daily energy limit for eco-friendly usage',
    type: 'ENERGY_BASED',
    dailyLimitKwh: 5.0,
    resetSchedule: 'DAILY',
    warningThreshold: 75,
  },
  {
    id: 'budget-friendly',
    name: 'Budget Friendly',
    description: '$15 daily cost limit for budget management',
    type: 'COST_BASED',
    dailyLimitAmount: 15.0,
    resetSchedule: 'DAILY',
    warningThreshold: 80,
  },
];

/**
 * Helper functions for quota management
 */
export const formatQuotaUsage = (type: QuotaType, usage: number): string => {
  switch (type) {
    case 'TIME_BASED':
      const hours = Math.floor(usage / 3600);
      const minutes = Math.floor((usage % 3600) / 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    case 'USAGE_BASED':
      return `${usage} use${usage !== 1 ? 's' : ''}`;
    case 'ENERGY_BASED':
      return `${(usage / 1000).toFixed(2)} kWh`;
    case 'COST_BASED':
      return `$${usage.toFixed(2)}`;
    default:
      return `${usage}`;
  }
};

export const getQuotaTypeIcon = (type: QuotaType): string => {
  switch (type) {
    case 'TIME_BASED': return 'Clock';
    case 'USAGE_BASED': return 'Activity';
    case 'ENERGY_BASED': return 'Zap';
    case 'COST_BASED': return 'DollarSign';
    default: return 'Clock';
  }
};

export const getStatusColor = (status: QuotaStatus): string => {
  switch (status) {
    case 'ACTIVE': return 'text-green-600 dark:text-green-400';
    case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
    case 'EXCEEDED': return 'text-red-600 dark:text-red-400';
    case 'PAUSED': return 'text-gray-600 dark:text-gray-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
};