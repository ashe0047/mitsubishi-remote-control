export enum QuotaType {
  TIME_BASED = 'TIME_BASED',
  USAGE_COUNT = 'USAGE_COUNT',
  ENERGY_BASED = 'ENERGY_BASED',
  COST_BASED = 'COST_BASED',
}

export enum QuotaStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  PAUSED = 'PAUSED',
}

export enum RecurringType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}
