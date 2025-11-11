import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AccessControl } from '../entities/access-control.entity';
import {
  AccessLevel,
  PermissionAction,
  TargetType,
  getDefaultPermissionsForAccessLevel,
} from '../enums/access-control.enum';

export interface ScheduleConfig {
  days: number[];
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface ConstraintConfig {
  maxTemperature?: number;
  minTemperature?: number;
  allowedModes?: string[];
  maxFanSpeed?: string;
  energyLimit?: number;
  timeLimit?: number;
}

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(AccessControl)
    private readonly accessControlRepository: Repository<AccessControl>,
  ) {}

  // Business logic methods

  /**
   * Check if an action is allowed for a specific access assignment
   */
  isActionAllowed(
    assignment: AccessControl,
    action: PermissionAction,
  ): boolean {
    if (!this.isActive(assignment)) {
      return false;
    }

    const effectiveActions = this.getEffectiveAllowedActions(assignment);
    return effectiveActions.includes(action);
  }

  /**
   * Check if the assignment is currently active (not soft deleted, not expired, within schedule)
   */
  isActive(assignment: AccessControl): boolean {
    // Check if soft deleted
    if (assignment.isDeleted || assignment.isArchived) {
      return false;
    }

    const now = new Date();

    // Check validity window
    if (assignment.validFrom && now < assignment.validFrom) {
      return false;
    }

    if (assignment.validUntil && now > assignment.validUntil) {
      return false;
    }

    // Check schedule if defined
    if (assignment.accessSchedule) {
      return this.isCurrentlyScheduled(assignment);
    }

    return true;
  }

  /**
   * Check if assignment is currently within scheduled time window
   */
  isCurrentlyScheduled(assignment: AccessControl): boolean {
    if (!assignment.accessSchedule) return true;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.

    const { days, startTime, endTime } = assignment.accessSchedule;

    // Check if current day is allowed
    if (!days.includes(currentDay)) {
      return false;
    }

    // Check if current time is within the allowed window
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Grant a specific permission action to this assignment
   */
  async grantAction(
    assignment: AccessControl,
    action: PermissionAction,
  ): Promise<AccessControl> {
    if (!assignment.allowedActions) {
      assignment.allowedActions = getDefaultPermissionsForAccessLevel(
        assignment.accessLevel,
      );
    }

    if (
      assignment.allowedActions &&
      !assignment.allowedActions.includes(action)
    ) {
      assignment.allowedActions.push(action);
    }

    // Remove from restricted actions if present
    if (assignment.restrictedActions) {
      assignment.restrictedActions = assignment.restrictedActions.filter(
        (a) => a !== action,
      );
    }

    assignment.updatedAt = new Date();
    return this.accessControlRepository.save(assignment);
  }

  /**
   * Restrict a specific permission action for this assignment
   */
  async restrictAction(
    assignment: AccessControl,
    action: PermissionAction,
  ): Promise<AccessControl> {
    if (!assignment.restrictedActions) {
      assignment.restrictedActions = [];
    }

    if (!assignment.restrictedActions.includes(action)) {
      assignment.restrictedActions.push(action);
    }

    // Remove from allowed actions if present
    if (assignment.allowedActions) {
      assignment.allowedActions = assignment.allowedActions.filter(
        (a) => a !== action,
      );
    }

    assignment.updatedAt = new Date();
    return this.accessControlRepository.save(assignment);
  }

  /**
   * Update the access level for this assignment
   */
  async updateAccessLevel(
    assignment: AccessControl,
    newLevel: AccessLevel,
    reason?: string,
  ): Promise<AccessControl> {
    assignment.accessLevel = newLevel;
    assignment.allowedActions = null; // Reset to default for new level
    assignment.restrictedActions = null; // Clear restrictions
    assignment.assignmentReason = reason;
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Set validity time window for this assignment
   */
  async setValidityWindow(
    assignment: AccessControl,
    from?: Date,
    until?: Date,
  ): Promise<AccessControl> {
    assignment.validFrom = from;
    assignment.validUntil = until;
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Set access schedule for time-based restrictions
   */
  async setAccessSchedule(
    assignment: AccessControl,
    schedule: ScheduleConfig,
  ): Promise<AccessControl> {
    assignment.accessSchedule = schedule;
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Update constraint rules for this assignment
   */
  async updateConstraints(
    assignment: AccessControl,
    constraints: ConstraintConfig,
  ): Promise<AccessControl> {
    assignment.constraints = { ...assignment.constraints, ...constraints };
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  // Computed business logic methods

  /**
   * Get the effective allowed actions considering restrictions
   */
  getEffectiveAllowedActions(assignment: AccessControl): PermissionAction[] {
    const baseActions = this.getAllowedActionsList(assignment);

    // Remove restricted actions if any
    if (
      assignment.restrictedActions &&
      assignment.restrictedActions.length > 0
    ) {
      return baseActions.filter(
        (action) => !assignment.restrictedActions!.includes(action),
      );
    }

    return baseActions;
  }

  /**
   * Get allowed actions list with default fallback
   */
  private getAllowedActionsList(assignment: AccessControl): PermissionAction[] {
    // If custom allowed actions are defined, use them
    if (assignment.allowedActions && assignment.allowedActions.length > 0) {
      return assignment.allowedActions;
    }

    // Otherwise use default permissions for access level
    return getDefaultPermissionsForAccessLevel(assignment.accessLevel);
  }

  // Repository methods for common operations

  /**
   * Find all active access assignments for a user
   */
  async findActiveAssignmentsForUser(userId: string): Promise<AccessControl[]> {
    return this.accessControlRepository.find({
      where: {
        userId,
        deletedAt: IsNull(),
        isArchived: false,
      },
      relations: ['user', 'room', 'device'],
    });
  }

  /**
   * Find access assignments for a specific target (room or device)
   */
  async findAssignmentsForTarget(
    targetType: TargetType,
    targetId: string,
  ): Promise<AccessControl[]> {
    return this.accessControlRepository.find({
      where: {
        targetType,
        targetId,
        deletedAt: IsNull(),
        isArchived: false,
      },
      relations: ['user', 'room', 'device'],
    });
  }

  /**
   * Create a new access assignment
   */
  async createAssignment(data: {
    userId: string;
    targetType: TargetType;
    targetId: string;
    accessLevel: AccessLevel;
    assignmentReason?: string;
    createdBy?: string;
  }): Promise<AccessControl> {
    const assignment = this.accessControlRepository.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Soft delete an access assignment
   */
  async softDeleteAssignment(
    assignment: AccessControl,
    deletedBy?: string,
  ): Promise<AccessControl> {
    assignment.deletedAt = new Date();
    assignment.deletedBy = deletedBy;
    assignment.isArchived = true;
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Restore a soft-deleted access assignment
   */
  async restoreAssignment(assignment: AccessControl): Promise<AccessControl> {
    assignment.deletedAt = null;
    assignment.deletedBy = null;
    assignment.isArchived = false;
    assignment.updatedAt = new Date();

    return this.accessControlRepository.save(assignment);
  }

  /**
   * Find assignment by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<AccessControl | null> {
    return this.accessControlRepository.findOne({
      where: { id },
      relations: ['user', 'room', 'device'],
    });
  }

  /**
   * Get all assignments for a user including inactive ones
   */
  async findAllAssignmentsForUser(userId: string): Promise<AccessControl[]> {
    return this.accessControlRepository.find({
      where: { userId },
      relations: ['user', 'room', 'device'],
      order: { createdAt: 'DESC' },
    });
  }
}
