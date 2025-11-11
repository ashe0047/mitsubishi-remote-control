import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import {
  QuotaType,
  QuotaScope,
  QuotaPeriod,
  QuotaStatus,
  EnforcementAction,
} from '../enums/quota-db.enums';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { QuotaViolation } from './quota-violation.entity';
import { QuotaOverride } from './quota-override.entity';

@Entity('quotas')
@Index(['userId'])
@Index(['targetId'])
@Index(['status'])
@Index(['quotaType', 'scope'])
@Index(['period'])
@Index(['lastResetAt'])
@Index('idx_quotas_user_id', ['userId'])
@Index('idx_quotas_target_id', ['targetId'])
@Index('idx_quotas_status', ['status'])
@Index('idx_quotas_type_scope', ['quotaType', 'scope'])
@Index('idx_quotas_period', ['period'])
@Index('idx_quotas_last_reset', ['lastResetAt'])
export class Quota extends BaseEntity {
  /**
   * User ID - required field
   * Matches Spring Boot @NotNull(message = "User ID is required") @Column("user_id") private UUID userId;
   */
  @Column({ name: 'user_id' })
  userId!: string;

  // Core quota definition
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    name: 'quota_type',
    type: 'enum',
    enum: QuotaType,
    default: QuotaType.TIME_BASED,
  })
  quotaType!: QuotaType;

  @Column({
    name: 'scope',
    type: 'enum',
    enum: QuotaScope,
    default: QuotaScope.ROOM,
  })
  scope!: QuotaScope;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null;

  // Quota amounts (flexible for different quota types)
  @Column({
    name: 'allowed_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  allowedAmount!: number;

  @Column({
    name: 'used_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  usedAmount!: number;

  // Reset and period configuration
  @Column({
    name: 'period',
    type: 'enum',
    enum: QuotaPeriod,
    default: QuotaPeriod.DAILY,
  })
  period!: QuotaPeriod;

  @Column({
    name: 'period_start',
    type: 'timestamp with time zone',
    nullable: true,
  })
  periodStart?: Date | null;

  @Column({
    name: 'period_duration',
    type: 'interval',
    nullable: true,
  })
  periodDuration?: string | null;

  @Column({
    name: 'reset_time',
    type: 'time without time zone',
    default: '00:00:00',
  })
  resetTime!: string;

  // Enforcement configuration
  @Column({
    name: 'enforcement_action',
    type: 'enum',
    enum: EnforcementAction,
    default: EnforcementAction.BLOCK,
  })
  enforcementAction!: EnforcementAction;

  @Column({
    name: 'status',
    type: 'enum',
    enum: QuotaStatus,
    default: QuotaStatus.ACTIVE,
  })
  status!: QuotaStatus;

  // Advanced features
  @Column({ type: 'integer', default: 1 })
  priority!: number;

  @Column({ name: 'allow_rollover', type: 'boolean', default: false })
  allowRollover!: boolean;

  @Column({
    name: 'max_rollover_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxRolloverAmount?: number | null;

  // Warning system
  @Column({ name: 'warning_thresholds', type: 'jsonb' })
  warningThresholds!: number[];

  @Column({ name: 'notification_methods', type: 'jsonb' })
  notificationMethods!: string[];

  // Grace periods and overrides
  @Column({ name: 'grace_period_minutes', type: 'integer', default: 0 })
  gracePeriodMinutes!: number;

  @Column({ name: 'max_grace_uses', type: 'integer', default: 1 })
  maxGraceUses!: number;

  @Column({ name: 'grace_cooldown_hours', type: 'integer', default: 24 })
  graceCooldownHours!: number;

  // Sharing and pooling (future extensibility)
  @Column({ name: 'allow_sharing', type: 'boolean', default: false })
  allowSharing!: boolean;

  @Column({ name: 'allow_borrowing', type: 'boolean', default: false })
  allowBorrowing!: boolean;

  @Column({
    name: 'sharing_pool_id',
    type: 'uuid',
    nullable: true,
  })
  sharingPoolId?: string | null;

  @Column({
    name: 'last_reset_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastResetAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

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
  @ManyToOne(() => User, (user) => user.quotas, {
    onDelete: 'SET NULL', // Preserve quota history when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  /**
   * Room relationship - References Room.id (primary key) for proper foreign key constraint
   * Updated to use primary key reference for database integrity
   */
  @ManyToOne(() => Room, (room) => room.quotas, {
    onDelete: 'SET NULL', // Preserve quota history when room is deleted
    nullable: true,
  })
  @JoinColumn({
    name: 'target_id',
    referencedColumnName: 'id', // Reference primary key, not business key
  })
  room?: Room | null;

  @OneToMany(() => QuotaViolation, (violation) => violation.quota)
  quotaViolations!: QuotaViolation[];

  @OneToMany(() => QuotaOverride, (override) => override.quota)
  quotaOverrides!: QuotaOverride[];

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
    return (
      !this.isDeleted && !this.isArchived && this.status === QuotaStatus.ACTIVE
    );
  }

  get isPaused(): boolean {
    return (
      !this.isDeleted && !this.isArchived && this.status === QuotaStatus.PAUSED
    );
  }

  get isExceeded(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.status === QuotaStatus.EXCEEDED
    );
  }

  get isExpired(): boolean {
    return (
      !this.isDeleted && !this.isArchived && this.status === QuotaStatus.EXPIRED
    );
  }

  get usagePercentage(): number {
    if (this.allowedAmount <= 0) return 0;
    return Math.min(100, (this.usedAmount / this.allowedAmount) * 100);
  }

  get remainingAmount(): number {
    return Math.max(0, this.allowedAmount - this.usedAmount);
  }

  get isWarningThresholdReached(): boolean {
    return this.warningThresholds.some(
      (threshold) => this.usagePercentage >= threshold,
    );
  }

  // Quota management methods
  incrementUsage(amount: number): void {
    this.usedAmount += amount;
    this.updatedAt = new Date();
  }

  resetUsage(): void {
    this.usedAmount = 0;
    this.lastResetAt = new Date();
    this.updatedAt = new Date();
  }

  pause(): void {
    this.status = QuotaStatus.PAUSED;
    this.updatedAt = new Date();
  }

  resume(): void {
    this.status = QuotaStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  // Validation methods
  canConsume(amount: number): boolean {
    if (!this.isActive) return false;
    if (this.enforcementAction === EnforcementAction.BLOCK) {
      return this.remainingAmount >= amount;
    }
    return true; // WARN or RESTRICT allows usage
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      isPaused: this.isPaused,
      isExceeded: this.isExceeded,
      isExpired: this.isExpired,
      usagePercentage: this.usagePercentage,
      remainingAmount: this.remainingAmount,
      isWarningThresholdReached: this.isWarningThresholdReached,
    };
  }
}
