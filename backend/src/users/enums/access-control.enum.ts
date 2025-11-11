/**
 * Access Control Enumeration Types
 * Comprehensive access control system for rooms and devices
 */

/**
 * Access Level Enumeration
 * Complete set of access levels for fine-grained control
 */
export enum AccessLevel {
  /** Full control over target (room or device) */
  FULL = 'FULL',

  /** Limited control - basic operations only */
  LIMITED = 'LIMITED',

  /** View only - can see status but not change anything */
  VIEW_ONLY = 'VIEW_ONLY',

  /** Scheduled access - only during specific time windows */
  SCHEDULED = 'SCHEDULED',

  /** Emergency only - can use only in emergency situations */
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',

  /** Maintenance access - diagnostic and configuration operations */
  MAINTENANCE = 'MAINTENANCE',

  /** No access - explicitly denied */
  NONE = 'NONE',
}

/**
 * Permission Action Enumeration
 * Combines room and device specific actions into a comprehensive set
 */
export enum PermissionAction {
  // Basic control actions
  /** Turn device on/off */
  POWER_CONTROL = 'POWER_CONTROL',

  /** Adjust temperature settings */
  TEMPERATURE_CONTROL = 'TEMPERATURE_CONTROL',

  /** Change device mode (cool, heat, fan, auto, etc.) */
  MODE_CONTROL = 'MODE_CONTROL',

  /** Adjust fan speed and settings */
  FAN_CONTROL = 'FAN_CONTROL',

  // Scheduling and automation
  /** Schedule operations and time-based controls */
  SCHEDULE_CONTROL = 'SCHEDULE_CONTROL',

  /** Create and manage automation rules */
  AUTOMATION_CONTROL = 'AUTOMATION_CONTROL',

  // Monitoring and information
  /** View current status and settings */
  VIEW_STATUS = 'VIEW_STATUS',

  /** View usage history and statistics */
  VIEW_USAGE = 'VIEW_USAGE',

  /** View energy consumption and cost data */
  VIEW_ENERGY = 'VIEW_ENERGY',

  /** View system logs and diagnostics */
  VIEW_LOGS = 'VIEW_LOGS',

  // Configuration and management
  /** Configure device settings and parameters */
  CONFIGURE_SETTINGS = 'CONFIGURE_SETTINGS',

  /** Perform device diagnostics and health checks */
  DIAGNOSTICS = 'DIAGNOSTICS',

  /** Update device firmware and software */
  FIRMWARE_UPDATE = 'FIRMWARE_UPDATE',

  /** Reset device to factory defaults */
  RESET_DEVICE = 'RESET_DEVICE',

  // User and access management
  /** Manage user access and permissions for the target */
  MANAGE_ACCESS = 'MANAGE_ACCESS',

  /** Create and modify quotas for the target */
  MANAGE_QUOTAS = 'MANAGE_QUOTAS',

  /** Override quotas and restrictions */
  OVERRIDE_QUOTAS = 'OVERRIDE_QUOTAS',

  // Emergency and safety
  /** Emergency shutdown or safety operations */
  EMERGENCY_CONTROL = 'EMERGENCY_CONTROL',

  /** Access and manage safety features */
  SAFETY_CONTROL = 'SAFETY_CONTROL',
}

export enum TargetType {
  ROOM = 'ROOM',
  DEVICE = 'DEVICE',
}
/**
 * Default permissions per unified access level
 * Maps access levels to their default permission sets
 */
export const DEFAULT_PERMISSIONS = {
  [AccessLevel.FULL]: [
    PermissionAction.POWER_CONTROL,
    PermissionAction.TEMPERATURE_CONTROL,
    PermissionAction.MODE_CONTROL,
    PermissionAction.FAN_CONTROL,
    PermissionAction.SCHEDULE_CONTROL,
    PermissionAction.AUTOMATION_CONTROL,
    PermissionAction.VIEW_STATUS,
    PermissionAction.VIEW_USAGE,
    PermissionAction.VIEW_ENERGY,
    PermissionAction.VIEW_LOGS,
    PermissionAction.CONFIGURE_SETTINGS,
    PermissionAction.DIAGNOSTICS,
    PermissionAction.FIRMWARE_UPDATE,
    PermissionAction.RESET_DEVICE,
    PermissionAction.MANAGE_ACCESS,
    PermissionAction.MANAGE_QUOTAS,
    PermissionAction.OVERRIDE_QUOTAS,
    PermissionAction.EMERGENCY_CONTROL,
    PermissionAction.SAFETY_CONTROL,
  ],

  [AccessLevel.LIMITED]: [
    PermissionAction.POWER_CONTROL,
    PermissionAction.TEMPERATURE_CONTROL,
    PermissionAction.MODE_CONTROL,
    PermissionAction.FAN_CONTROL,
    PermissionAction.SCHEDULE_CONTROL,
    PermissionAction.VIEW_STATUS,
    PermissionAction.VIEW_USAGE,
    PermissionAction.VIEW_ENERGY,
  ],

  [AccessLevel.VIEW_ONLY]: [
    PermissionAction.VIEW_STATUS,
    PermissionAction.VIEW_USAGE,
    PermissionAction.VIEW_ENERGY,
  ],

  [AccessLevel.SCHEDULED]: [
    PermissionAction.POWER_CONTROL,
    PermissionAction.TEMPERATURE_CONTROL,
    PermissionAction.MODE_CONTROL,
    PermissionAction.FAN_CONTROL,
    PermissionAction.VIEW_STATUS,
    PermissionAction.VIEW_USAGE,
  ],

  [AccessLevel.EMERGENCY_ONLY]: [
    PermissionAction.EMERGENCY_CONTROL,
    PermissionAction.SAFETY_CONTROL,
    PermissionAction.VIEW_STATUS,
  ],

  [AccessLevel.MAINTENANCE]: [
    PermissionAction.VIEW_STATUS,
    PermissionAction.VIEW_USAGE,
    PermissionAction.VIEW_ENERGY,
    PermissionAction.VIEW_LOGS,
    PermissionAction.DIAGNOSTICS,
    PermissionAction.CONFIGURE_SETTINGS,
    PermissionAction.FIRMWARE_UPDATE,
    PermissionAction.RESET_DEVICE,
  ],

  [AccessLevel.NONE]: [],
};

/**
 * Helper function to get default permissions for a unified access level
 */
export function getDefaultPermissionsForAccessLevel(
  accessLevel: AccessLevel,
): PermissionAction[] {
  return DEFAULT_PERMISSIONS[accessLevel] || [];
}

/**
 * Helper function to check if action is allowed for access level
 */
export function isActionAllowedForAccessLevel(
  action: PermissionAction,
  accessLevel: AccessLevel,
): boolean {
  const allowedActions = getDefaultPermissionsForAccessLevel(accessLevel);
  return allowedActions.includes(action);
}
