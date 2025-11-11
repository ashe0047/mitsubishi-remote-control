export interface QuotaSettings {
  energyRate?: number; // Cost per kWh
  costPerHour?: number; // Cost per hour for time-based
  operationWeights?: Record<string, number>; // Weight for different operations
  exemptOperations?: string[]; // Operations that don't count towards quota
  businessHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    days: number[]; // 0-6 (Sunday-Saturday)
  };
}
