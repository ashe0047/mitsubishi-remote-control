/**
 * Quota Violation Enumeration Types
 *
 * These enums match the database custom types for quota violations
 */

export enum ViolationType {
  TIME_EXCEEDED = 'TIME_EXCEEDED',
  USAGE_EXCEEDED = 'USAGE_EXCEEDED',
  ENERGY_EXCEEDED = 'ENERGY_EXCEEDED',
  COST_EXCEEDED = 'COST_EXCEEDED',
  SCHEDULE_VIOLATION = 'SCHEDULE_VIOLATION',
  ACCESS_VIOLATION = 'ACCESS_VIOLATION',
}

export enum EnforcementAction {
  WARN = 'WARN',
  RESTRICT = 'RESTRICT',
  BLOCK = 'BLOCK',
}
