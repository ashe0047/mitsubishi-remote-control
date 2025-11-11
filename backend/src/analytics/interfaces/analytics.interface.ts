// Matching Spring Boot AnalyticsReport structure exactly

export enum TimePeriod {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}
// Base analytics response wrapper
export interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
  timestamp: string;
}

// Usage statistics matching Spring Boot UsageStatistics
export interface UsageStatistics {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  statistics: {
    totalSessions: number;
    totalDurationMinutes: number;
    totalEnergyKwh: number;
    totalCost: number;
    averageSessionLengthMinutes: number;
    averageEnergyPerSessionKwh: number;
    averageCostPerSession: number;
  };
  sessions: Array<{
    sessionId: string;
    roomId: string;
    roomName: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    peakTemperature: number;
    averageTemperature: number;
    mode: string;
    fanSpeed: string;
  }>;
}

// Usage trends matching Spring Boot UsageTrends
export interface UsageTrends {
  today: {
    date: string;
    sessions: number;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    quotaUtilization: number;
  };
  weekly: Array<{
    weekStart: string;
    weekEnd: string;
    sessions: number;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    quotaUtilization: number;
  }>;
  monthly: Array<{
    month: string;
    year: number;
    sessions: number;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    quotaUtilization: number;
  }>;
  insights: {
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    weeklyGrowthRate: number;
    monthlyGrowthRate: number;
    peakUsageDay: string;
    averageDailyUsage: number;
  };
}

// Household usage matching Spring Boot HouseholdUsage
export interface HouseholdUsage {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  family: {
    householdId: string;
    householdName: string;
    totalUsers: number;
  };
  usageByFamilyMember: Array<{
    userId: string;
    userName: string;
    sessions: number;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    quotaUtilization: number;
    complianceRate: number;
  }>;
  usageByRoom: Array<{
    roomId: string;
    roomName: string;
    sessions: number;
    durationMinutes: number;
    energyKwh: number;
    cost: number;
    averageSessionLength: number;
    mostUsedBy: string;
  }>;
  totalUsage: {
    totalSessions: number;
    totalDurationMinutes: number;
    totalEnergyKwh: number;
    totalCost: number;
    averagePerUser: {
      sessions: number;
      durationMinutes: number;
      energyKwh: number;
      cost: number;
    };
  };
}

// Quota utilization matching Spring Boot QuotaUtilization
export interface QuotaUtilization {
  period: {
    startDate: string;
    endDate: string;
  };
  quotaTypes: Array<{
    quotaType: 'TIME' | 'ENERGY' | 'COST' | 'COUNT';
    quotaId: string;
    quotaName: string;
    currentLimit: number;
    currentUsage: number;
    utilizationPercent: number;
    remainingAmount: number;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    projectedExhaustion?: string;
  }>;
  violations: Array<{
    quotaType: string;
    violationDate: string;
    exceededAmount: number;
    limitAmount: number;
    overrideUsed: boolean;
    overrideMinutes?: number;
    reason: string;
  }>;
  compliance: {
    overallComplianceRate: number;
    daysInCompliance: number;
    totalDays: number;
    violationFrequency: number;
    averageTimeToViolation: number;
  };
}

// User insights matching Spring Boot UserInsights
export interface UserInsights {
  period: {
    startDate: string;
    endDate: string;
  };
  user: {
    userId: string;
    userName: string;
  };
  usagePatterns: {
    typicalSessionLength: number;
    preferredRooms: Array<{
      roomId: string;
      roomName: string;
      usagePercentage: number;
      sessionCount: number;
    }>;
    preferredModes: Array<{
      mode: string;
      usagePercentage: number;
      sessionCount: number;
    }>;
    peakUsageHours: Array<{
      hour: number;
      sessionCount: number;
      averageDuration: number;
    }>;
    dayOfWeekPatterns: Array<{
      dayOfWeek: string;
      sessionCount: number;
      totalDuration: number;
      averageSessionLength: number;
    }>;
  };
  efficiency: {
    energyEfficiencyRating: number; // 1-10 scale
    costEfficiencyRating: number; // 1-10 scale
    optimalTemperatureSettings: Array<{
      temperature: number;
      durationHours: number;
      costPerHour: number;
    }>;
    wasteDetection: Array<{
      sessionId: string;
      date: string;
      wasteType: 'EMPTY_ROOM' | 'OVERCOOLING' | 'INEFFICIENT_MODE';
      estimatedWasteCost: number;
    }>;
  };
  recommendations: Array<{
    type: 'TEMPERATURE' | 'SCHEDULING' | 'MODE' | 'MAINTENANCE';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    potentialSavings: {
      energyKwh: number;
      cost: number;
    };
  }>;
}

// System overview matching Spring Boot SystemOverview
export interface SystemOverview {
  timestamp: string;
  system: {
    version: string;
    uptime: number;
    activeConnections: number;
    totalUsers: number;
    totalHouseholds: number;
    totalRooms: number;
  };
  performance: {
    averageResponseTime: number;
    cacheHitRate: number;
    databaseConnections: number;
    mqttConnectionStatus: 'connected' | 'disconnected' | 'error';
    websocketConnections: number;
  };
  quotas: {
    totalActiveQuotas: number;
    quotasInWarning: number;
    quotasInCritical: number;
    quotasExceeded: number;
    overrideRequestsToday: number;
    overrideRequestsApproved: number;
  };
  usage: {
    activeSessions: number;
    sessionsToday: number;
    totalUsageToday: {
      durationMinutes: number;
      energyKwh: number;
      cost: number;
    };
    peakUsageHour: number;
    averageSessionDuration: number;
  };
  health: {
    overallStatus: 'healthy' | 'warning' | 'critical';
    issues: Array<{
      component: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      timestamp: string;
    }>;
    lastHealthCheck: string;
  };
}

// Analytics query parameters
export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  roomId?: string;
  quotaType?: 'TIME' | 'ENERGY' | 'COST' | 'COUNT';
  period: TimePeriod;
  includeViolations?: boolean;
  includeInsights?: boolean;
  timezone?: string;
}

// Export request for analytics reports
export interface ExportRequest {
  format: 'CSV' | 'PDF' | 'JSON';
  reportType: 'usage' | 'trends' | 'household' | 'quota' | 'insights';
  query: AnalyticsQuery;
  emailDelivery?: boolean;
  emailAddress?: string;
}

// Export response
export interface ExportResponse {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  estimatedCompletion?: string;
  errorMessage?: string;
}
