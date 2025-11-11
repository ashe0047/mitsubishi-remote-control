import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { User } from './user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Device } from '../../devices/entities/device.entity';
import {
  AccessLevel,
  PermissionAction,
  TargetType,
  getDefaultPermissionsForAccessLevel,
} from '../enums/access-control.enum';

/**
 * Access Assignment entity
 * Consolidates UserRoomAssignment and DeviceUserAssignment into a single entity
 * Provides flexible access control for both room-level and device-level permissions
 */
@Entity('access_control')
@Unique(['userId', 'targetType', 'targetId'])
@Index(['userId', 'targetType'])
@Index(['targetType', 'targetId'])
@Index(['accessLevel'])
@Index(['validFrom', 'validUntil'])
@Index('idx_access_control_user_id', ['userId'])
@Index('idx_access_control_target', ['targetType', 'targetId'])
@Index('idx_access_control_access_level', ['accessLevel'])
@Index('idx_access_control_validity', ['validFrom', 'validUntil'])
@Index('idx_access_control_composite', [
  'userId',
  'targetType',
  'targetId',
  'accessLevel',
])
export class AccessControl extends BaseEntity {
  /**
   * User ID - required field
   * User being granted access
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * Target type - determines whether this is room or device access
   */
  @Column({
    name: 'target_type',
    type: 'enum',
    enum: TargetType,
  })
  targetType: TargetType;

  /**
   * Target ID - references either Room.id or Device.id based on targetType
   */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /**
   * Access level using access levels
   */
  @Column({
    name: 'access_level',
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.LIMITED,
  })
  accessLevel: AccessLevel;

  /**
   * Specific permissions allowed for this assignment
   * If null, uses default permissions based on accessLevel
   */
  @Column({
    name: 'allowed_actions',
    type: 'jsonb',
    nullable: true,
  })
  allowedActions?: PermissionAction[] | null;

  /**
   * Specific restrictions applied to this assignment
   * These restrictions override allowed actions
   */
  @Column({
    name: 'restricted_actions',
    type: 'jsonb',
    nullable: true,
  })
  restrictedActions?: PermissionAction[] | null;

  /**
   * Time-based access control - when this assignment becomes valid
   */
  @Column({
    name: 'valid_from',
    type: 'timestamp with time zone',
    nullable: true,
  })
  validFrom?: Date | null;

  /**
   * Time-based access control - when this assignment expires
   */
  @Column({
    name: 'valid_until',
    type: 'timestamp with time zone',
    nullable: true,
  })
  validUntil?: Date | null;

  /**
   * Schedule-based access control
   * JSON object defining time windows when access is allowed
   * Format: { days: [1,2,3,4,5], startTime: "09:00", endTime: "17:00" }
   */
  @Column({
    name: 'access_schedule',
    type: 'jsonb',
    nullable: true,
  })
  accessSchedule?: {
    days: number[]; // 0=Sunday, 1=Monday, etc.
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone?: string;
  } | null;

  /**
   * Additional constraints and metadata
   */
  @Column({
    name: 'constraints',
    type: 'jsonb',
    nullable: true,
  })
  constraints?: {
    maxTemperature?: number;
    minTemperature?: number;
    allowedModes?: string[];
    maxFanSpeed?: string;
    energyLimit?: number; // kWh per day
    timeLimit?: number; // minutes per session
  } | null;

  /**
   * Reason for granting this access
   */
  @Column({
    name: 'assignment_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  assignmentReason?: string | null;

  /**
   * User who created this assignment
   */
  @Column({
    name: 'created_by',
    type: 'uuid',
    nullable: true,
  })
  createdBy?: string | null;

  /**
   * Last user who modified this assignment
   */
  @Column({
    name: 'modified_by',
    type: 'uuid',
    nullable: true,
  })
  modifiedBy?: string | null;

  // Soft delete fields
  @Column({
    name: 'deleted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt?: Date | null;

  @Column({
    name: 'deleted_by',
    type: 'uuid',
    nullable: true,
  })
  deletedBy?: string | null;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean = false;

  // Relationships
  @ManyToOne(() => User, (user) => user.accessRules, {
    onDelete: 'SET NULL', // Preserve assignment history when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Polymorphic relationship to Room or Device based on targetType
   * Room relationship
   */
  @ManyToOne(() => Room, (room) => room.accessRules, {
    createForeignKeyConstraints: false,
    onDelete: 'SET NULL', // Preserve assignment history when room is deleted
    nullable: true,
  })
  @JoinColumn({ name: 'target_id' })
  room?: Room | null;

  /**
   * Device relationship
   */
  @ManyToOne(() => Device, (device) => device.accessRules, {
    createForeignKeyConstraints: false,
    onDelete: 'SET NULL', // Preserve assignment history when device is deleted
    nullable: true,
  })
  @JoinColumn({ name: 'target_id' })
  device?: Device | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'modified_by' })
  modifiedByUser?: User | null;

  // Soft delete methods
  softDelete(deletedBy?: string): void {
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.isArchived = true;
    this.updatedAt = new Date();
  }

  restore(): void {
    this.deletedAt = null;
    this.deletedBy = null;
    this.isArchived = false;
    this.updatedAt = new Date();
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  // Computed properties
  get isActive(): boolean {
    // Check if soft deleted
    if (this.isDeleted || this.isArchived) {
      return false;
    }

    const now = new Date();

    // Check validity window
    if (this.validFrom && now < this.validFrom) {
      return false;
    }

    if (this.validUntil && now > this.validUntil) {
      return false;
    }

    // Check schedule if defined
    if (this.accessSchedule) {
      return this.isCurrentlyScheduled;
    }

    return true;
  }

  get isExpired(): boolean {
    if (!this.validUntil) return false;
    return new Date() > this.validUntil;
  }

  get isScheduled(): boolean {
    return !!this.accessSchedule;
  }

  get isRoomAccess(): boolean {
    return this.targetType === TargetType.ROOM;
  }

  get isDeviceAccess(): boolean {
    return this.targetType === TargetType.DEVICE;
  }

  get allowedActionsList(): PermissionAction[] {
    // If custom allowed actions are defined, use them
    if (this.allowedActions && this.allowedActions.length > 0) {
      return this.allowedActions;
    }

    // Otherwise use default permissions for access level
    return getDefaultPermissionsForAccessLevel(this.accessLevel);
  }

  get hasRestrictedActions(): boolean {
    return !!(this.restrictedActions && this.restrictedActions.length > 0);
  }

  get effectiveAllowedActions(): PermissionAction[] {
    const baseActions = this.allowedActionsList;

    // Remove restricted actions if any
    if (this.restrictedActions && this.restrictedActions.length > 0) {
      return baseActions.filter(
        (action) => !this.restrictedActions!.includes(action),
      );
    }

    return baseActions;
  }

  // Simple computed properties (no external dependencies or complex logic)
  get isCurrentlyScheduled(): boolean {
    if (!this.accessSchedule) return true;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.

    const { days, startTime, endTime } = this.accessSchedule;

    // Check if current day is allowed
    if (!days.includes(currentDay)) {
      return false;
    }

    // Check if current time is within the allowed window
    return currentTime >= startTime && currentTime <= endTime;
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      isExpired: this.isExpired,
      isScheduled: this.isScheduled,
      isRoomAccess: this.isRoomAccess,
      isDeviceAccess: this.isDeviceAccess,
      hasRestrictedActions: this.hasRestrictedActions,
      allowedActionsList: this.allowedActionsList,
      effectiveAllowedActions: this.effectiveAllowedActions,
      isCurrentlyScheduled: this.isCurrentlyScheduled,
    };
  }
}
