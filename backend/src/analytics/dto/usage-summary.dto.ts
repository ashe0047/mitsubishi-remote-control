export interface UsageTotals {
  durationSeconds: number;
  energyKwh: number;
  cost: number;
}

export interface UsageSummaryResponse {
  userId: string;
  period: {
    start: string;
    end: string;
  };
  totals: UsageTotals;
  sessionsCount: number;
  generatedAt: string;
}

export interface AnalyticsUsageResponse {
  userId: string;
  period: {
    start: string;
    end: string;
  };
  roomId: string | null;
  statistics: Record<string, unknown>;
  todayUsageSeconds: number;
  sessions: Array<Record<string, unknown>>;
  generatedAt: string;
}
