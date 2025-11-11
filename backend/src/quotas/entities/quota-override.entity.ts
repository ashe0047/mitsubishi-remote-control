import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { OverrideType, OverrideStatus } from '../enums/override.enums';
import { Quota } from './quota.entity';
import { User } from '../../users/entities/user.entity';
import { OverrideParameters } from '../interfaces/session-metadata.interface';

@Entity('quota_overrides')
@Index(['quotaId', 'status'])
@Index(['requestedByUserId', 'status'])
@Index(['type', 'isActive'])
@Index(['expiresAt'])
export class QuotaOverride extends BaseEntity {
  @Column({ name: 'quota_id' })
  quotaId: string;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId: string;

  @Column({ name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string;

  @Column({
    type: 'enum',
    enum: OverrideType,
  })
  type: OverrideType;

  @Column({ type: 'json' })
  parameters: OverrideParameters;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: OverrideStatus,
    default: OverrideStatus.PENDING,
  })
  status: OverrideStatus;

  @Column({ name: 'requested_at', type: 'timestamp' })
  requestedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Quota, (quota) => quota.quotaOverrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quota_id' })
  quota: Quota;

  @ManyToOne(() => User, (user) => user.requestedOverrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;

  @ManyToOne(() => User, (user) => user.approvedOverrides, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy: User;

  // Computed properties
  get isPending(): boolean {
    return this.status === OverrideStatus.PENDING;
  }

  get isApproved(): boolean {
    return this.status === OverrideStatus.APPROVED;
  }

  get isRejected(): boolean {
    return this.status === OverrideStatus.REJECTED;
  }

  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get isValid(): boolean {
    return this.isApproved && this.isActive && !this.isExpired;
  }

  get remainingTime(): number {
    if (!this.expiresAt) return 0;
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.max(0, diffTime);
  }

  get remainingMinutes(): number {
    return Math.floor(this.remainingTime / (1000 * 60));
  }

  get remainingHours(): number {
    return Math.floor(this.remainingTime / (1000 * 60 * 60));
  }

  // Override lifecycle methods
  approve(approvedByUserId: string): void {
    this.status = OverrideStatus.APPROVED;
    this.approvedByUserId = approvedByUserId;
    this.approvedAt = new Date();
    this.isActive = true;
    this.activatedAt = new Date();
  }

  reject(rejectedByUserId: string): void {
    this.status = OverrideStatus.REJECTED;
    this.approvedByUserId = rejectedByUserId;
    this.isActive = false;
  }

  cancel(): void {
    this.status = OverrideStatus.CANCELLED;
    this.isActive = false;
  }

  activate(): void {
    if (this.isApproved && !this.isActive) {
      this.isActive = true;
      this.activatedAt = new Date();
    }
  }

  deactivate(): void {
    this.isActive = false;
  }

  expire(): void {
    this.status = OverrideStatus.EXPIRED;
    this.isActive = false;
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isPending: this.isPending,
      isApproved: this.isApproved,
      isRejected: this.isRejected,
      isExpired: this.isExpired,
      isValid: this.isValid,
      remainingTime: this.remainingTime,
      remainingMinutes: this.remainingMinutes,
    };
  }
}
