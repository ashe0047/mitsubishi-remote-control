/**
 * Quota Enums - Database Schema Alignment
 * Matches Spring Boot enums exactly
 */

export enum QuotaType {
  TIME_BASED = 'TIME_BASED', // Matches Spring Boot QuotaType.TIME_BASED
  USAGE_COUNT = 'USAGE_COUNT', // Matches Spring Boot QuotaType.USAGE_COUNT
  ENERGY_BASED = 'ENERGY_BASED', // Matches Spring Boot QuotaType.ENERGY_BASED
  COST_BASED = 'COST_BASED', // Matches Spring Boot QuotaType.COST_BASED
}

export enum QuotaScope {
  GLOBAL = 'GLOBAL', // Matches Spring Boot QuotaScope.GLOBAL
  ROOM = 'ROOM', // Matches Spring Boot QuotaScope.ROOM
  DEVICE = 'DEVICE', // Matches Spring Boot QuotaScope.DEVICE
}

export enum QuotaPeriod {
  HOURLY = 'HOURLY', // Matches Spring Boot QuotaPeriod.HOURLY
  DAILY = 'DAILY', // Matches Spring Boot QuotaPeriod.DAILY
  WEEKLY = 'WEEKLY', // Matches Spring Boot QuotaPeriod.WEEKLY
  MONTHLY = 'MONTHLY', // Matches Spring Boot QuotaPeriod.MONTHLY
  CUSTOM = 'CUSTOM', // Matches Spring Boot QuotaPeriod.CUSTOM
}

export enum QuotaStatus {
  ACTIVE = 'ACTIVE', // Matches Spring Boot QuotaStatus.ACTIVE
  PAUSED = 'PAUSED', // Matches Spring Boot QuotaStatus.PAUSED
  EXCEEDED = 'EXCEEDED', // Matches Spring Boot QuotaStatus.EXCEEDED
  EXPIRED = 'EXPIRED', // Matches Spring Boot QuotaStatus.EXPIRED
}

export enum EnforcementAction {
  WARN = 'WARN', // Matches Spring Boot EnforcementAction.WARN
  RESTRICT = 'RESTRICT', // Matches Spring Boot EnforcementAction.RESTRICT
  BLOCK = 'BLOCK', // Matches Spring Boot EnforcementAction.BLOCK
}
