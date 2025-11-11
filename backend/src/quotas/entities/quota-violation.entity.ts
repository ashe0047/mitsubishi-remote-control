import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { ViolationType, EnforcementAction } from '../enums/violation.enums';
import { User } from '../../users/entities/user.entity';
import { Quota } from './quota.entity';
import { UsageSession } from './usage-session.entity';

/**
 * Quota violation tracking entity
 * Matches Spring Boot QuotaViolation entity exactly
 */
@Entity('quota_violations')
@Index(['userId', 'createdAt'])
@Index(['quotaId'])
@Index(['roomId', 'createdAt'])
@Index(['resolved'])
@Index(['violationType'])
@Index(['usageSessionId']) // NEW: Session tracking index
@Index('idx_quota_violations_user_id', ['userId'])
@Index('idx_quota_violations_quota_id', ['quotaId'])
@Index('idx_quota_violations_created_at', ['createdAt'])
@Index('idx_quota_violations_violation_type', ['violationType'])
@Index('idx_quota_violations_resolved', ['resolved'])
@Index('idx_quota_violations_usage_session_id', ['usageSessionId']) // NEW: Session tracking index
@Index('idx_quota_violations_composite', [
  'userId',
  'quotaId',
  'usageSessionId',
]) // NEW: Composite tracking index
export class QuotaViolation extends BaseEntity {
  /**
   * User ID - required field
   * Matches Spring Boot @NotNull(message = "User ID is required") @Column("user_id") private UUID userId;
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /**
   * Quota ID - required field
   * Matches Spring Boot @NotNull(message = "Quota ID is required") @Column("quota_id") private UUID quotaId;
   */
  @Column({ name: 'quota_id', type: 'uuid' })
  quotaId!: string;

  /**
   * Room ID - references room_identifier (VARCHAR), not UUID primary key
   * Matches Spring Boot usage pattern for room references
   */
  @Column({ name: 'room_id', type: 'varchar' })
  roomId!: string;

  /**
   * Usage Session ID - nullable
   * Matches Spring Boot @Column("usage_session_id") private UUID usageSessionId;
   */
  @Column({ name: 'usage_session_id', type: 'uuid', nullable: true })
  usageSessionId?: string | null;

  @Column({
    type: 'enum',
    enum: ViolationType,
  })
  violationType!: ViolationType;

  @Column({
    name: 'violation_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  violationAmount!: number;

  @Column({ name: 'quota_limit', type: 'decimal', precision: 10, scale: 2 })
  quotaLimit!: number;

  @Column({
    type: 'enum',
    enum: EnforcementAction,
  })
  enforcementAction!: EnforcementAction;

  @Column({ name: 'override_granted', default: false })
  overrideGranted!: boolean;

  @Column({ name: 'override_by', type: 'uuid', nullable: true })
  overrideBy?: string | null;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string | null;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({
    name: 'override_duration_minutes',
    type: 'integer',
    nullable: true,
  })
  overrideDurationMinutes?: number | null;

  @Column({ default: false })
  resolved!: boolean;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string | null;

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
  @ManyToOne(() => User, (user) => user.quotaViolations, {
    onDelete: 'SET NULL', // Preserve violation history when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Quota, (quota) => quota.quotaViolations, {
    onDelete: 'SET NULL', // Preserve violation history when quota is deleted
  })
  @JoinColumn({ name: 'quota_id' })
  quota!: Quota;

  /**
   * Usage Session relationship - links violation to specific usage session
   * Preserve violation history even when session is deleted
   */
  @ManyToOne(() => UsageSession, (session) => session.violations, {
    nullable: true,
    onDelete: 'SET NULL', // Preserve violation history when session is deleted
  })
  @JoinColumn({ name: 'usage_session_id' })
  usageSession?: UsageSession | null;

  @ManyToOne(() => User, {
    onDelete: 'NO ACTION', // Matches database: NO ACTION
  })
  @JoinColumn({ name: 'override_by' })
  overrideByUser?: User | null;

  @ManyToOne(() => User, {
    onDelete: 'NO ACTION', // Matches database: NO ACTION
  })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser?: User | null;

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
  get isResolved(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.resolved &&
      this.resolvedAt !== null
    );
  }

  get isActive(): boolean {
    return !this.isDeleted && !this.isArchived && !this.isResolved;
  }

  get overrideExpiryTime(): Date | null {
    if (!this.overrideGranted || !this.overrideDurationMinutes) {
      return null;
    }

    const expiryTime = new Date(this.createdAt);
    expiryTime.setMinutes(
      expiryTime.getMinutes() + this.overrideDurationMinutes,
    );
    return expiryTime;
  }

  get isOverrideActive(): boolean {
    if (!this.overrideGranted || this.isResolved) {
      return false;
    }

    const expiryTime = this.overrideExpiryTime;
    return expiryTime ? new Date() < expiryTime : false;
  }

  get violationPercentage(): number {
    if (this.quotaLimit <= 0) return 0;
    return Math.min(100, (this.violationAmount / this.quotaLimit) * 100);
  }

  get excessAmount(): number {
    return Math.max(0, this.violationAmount - this.quotaLimit);
  }

  // Violation management methods
  resolve(resolvedBy: string, resolutionNotes?: string): void {
    this.resolved = true;
    this.resolvedAt = new Date();
    this.resolvedBy = resolvedBy;
    this.resolutionNotes = resolutionNotes;
  }

  grantOverride(
    overrideBy: string,
    reason: string,
    durationMinutes?: number,
  ): void {
    this.overrideGranted = true;
    this.overrideBy = overrideBy;
    this.overrideReason = reason;
    this.overrideDurationMinutes = durationMinutes;
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isResolved: this.isResolved,
      isActive: this.isActive,
      isOverrideActive: this.isOverrideActive,
      overrideExpiryTime: this.overrideExpiryTime,
      violationPercentage: this.violationPercentage,
      excessAmount: this.excessAmount,
    };
  }
}
