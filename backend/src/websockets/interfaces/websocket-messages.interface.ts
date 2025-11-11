// WebSocket message base interface matching Spring Boot patterns
export interface WebSocketMessage<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
}

// Quota update message payload (matching Spring Boot QuotaUpdateMessage)
export interface QuotaUpdatePayload {
  quotaId: string;
  familyMemberId: string;
  roomId: string;
  currentUsage: number;
  dailyLimit: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
  isCurrentlyActive: boolean;
  sessionStartTime?: string;
  estimatedSessionUsage: number;
  lastUpdated: string;
}

// Quota violation alert payload (matching Spring Boot QuotaViolationAlertMessage)
export interface QuotaViolationPayload {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  violationType: 'TIME_QUOTA' | 'COUNT_QUOTA' | 'ENERGY_QUOTA' | 'COST_QUOTA';
  currentUsage: number;
  limit: number;
  timestamp: string;
}

// Override request payload
export interface OverrideRequestPayload {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  requestedMinutes: number;
  reason: string;
  timestamp: string;
}

// Override granted payload
export interface OverrideGrantedPayload {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  grantedMinutes: number;
  approvedBy: string;
  timestamp: string;
}

// Daily usage summary payload
export interface DailyUsageSummaryPayload {
  familyMemberId: string;
  familyMemberName: string;
  date: string;
  totalUsageHours: number;
  totalSessions: number;
  averageSessionLength: number;
  roomUsage: Array<{
    roomId: string;
    roomName: string;
    usageHours: number;
    sessions: number;
  }>;
}

// WebSocket context record (matching Spring Boot WebSocketContext)
export interface WebSocketContext {
  socket: any;
  sessionId: string;
  familyMemberId?: string;
  roomId?: string;
  quotaId?: string;
  userId?: string;
  householdId?: string;
  userRole?: string;
}

// Message types constants
export const WebSocketMessageTypes = {
  QUOTA_UPDATE: 'QUOTA_UPDATE',
  QUOTA_VIOLATION_ALERT: 'QUOTA_VIOLATION_ALERT',
  OVERRIDE_REQUEST: 'OVERRIDE_REQUEST',
  OVERRIDE_GRANTED: 'OVERRIDE_GRANTED',
  QUOTA_RESET: 'QUOTA_RESET',
  DAILY_USAGE_SUMMARY: 'DAILY_USAGE_SUMMARY',
  CONNECTION_STATUS: 'CONNECTION_STATUS',
  ERROR: 'ERROR',
} as const;
