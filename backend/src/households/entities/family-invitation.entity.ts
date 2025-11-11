import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { InvitationStatus } from '../enums/invitation.enums';
import { UserRole } from '../../users/enums/access.enums';
import { Household } from './household.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Family invitation entity for user onboarding
 * Matches Spring Boot FamilyInvitation entity exactly
 */
@Entity('family_invitations')
@Unique(['token'])
@Index(['email'])
@Index(['expiresAt'])
@Index(['householdId'])
@Index(['invitedByUserId'])
@Index(['status'])
@Index('idx_family_invitations_household_id', ['householdId'])
@Index('idx_family_invitations_email', ['email'])
@Index('idx_family_invitations_token', ['token'])
@Index('idx_family_invitations_status', ['status'])
@Index('idx_family_invitations_invited_by', ['invitedByUserId'])
@Index('idx_family_invitations_expires_at', ['expiresAt'])
export class FamilyInvitation extends BaseEntity {
  /**
   * Household ID - required field
   * Matches Spring Boot @Column("household_id") private UUID householdId;
   */
  @Column({ name: 'household_id' })
  householdId!: string;

  @Column({ name: 'invited_by_user_id' })
  invitedByUserId!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CHILD,
  })
  role!: UserRole;

  @Column({ type: 'varchar', length: 255 })
  token!: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt?: Date | null;

  @Column({ name: 'declined_at', type: 'timestamp', nullable: true })
  declinedAt?: Date | null;

  @Column({ name: 'accepted_user_id', nullable: true })
  acceptedUserId?: string | null;

  @Column({ name: 'resend_count', default: 0 })
  resendCount!: number;

  // Relationships
  @ManyToOne(() => Household, (household) => household.invitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'household_id' })
  household!: Household;

  @ManyToOne(() => User, (user) => user.sentInvitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedByUser!: User;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'accepted_user_id' })
  acceptedUser?: User | null;

  // Computed properties
  get isPending(): boolean {
    return this.status === InvitationStatus.PENDING;
  }

  get isAccepted(): boolean {
    return this.status === InvitationStatus.ACCEPTED;
  }

  get isDeclined(): boolean {
    return this.status === InvitationStatus.DECLINED;
  }

  get isExpired(): boolean {
    return (
      this.status === InvitationStatus.EXPIRED || new Date() > this.expiresAt
    );
  }

  get isCancelled(): boolean {
    return this.status === InvitationStatus.CANCELLED;
  }

  get canBeAccepted(): boolean {
    return this.isPending && !this.isExpired;
  }

  get remainingDays(): number {
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get isValid(): boolean {
    return this.isPending && !this.isExpired;
  }

  // Invitation lifecycle methods
  accept(acceptedUserId: string): void {
    this.status = InvitationStatus.ACCEPTED;
    this.acceptedAt = new Date();
    this.acceptedUserId = acceptedUserId;
  }

  decline(): void {
    this.status = InvitationStatus.DECLINED;
    this.declinedAt = new Date();
  }

  cancel(): void {
    this.status = InvitationStatus.CANCELLED;
  }

  expire(): void {
    this.status = InvitationStatus.EXPIRED;
  }

  resend(): void {
    if (this.isPending || this.isExpired) {
      this.status = InvitationStatus.PENDING;
      this.sentAt = new Date();
      this.resendCount += 1;

      // Extend expiry by 7 days from resend time
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);
      this.expiresAt = newExpiry;
    }
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isPending: this.isPending,
      isAccepted: this.isAccepted,
      isDeclined: this.isDeclined,
      isExpired: this.isExpired,
      isCancelled: this.isCancelled,
      canBeAccepted: this.canBeAccepted,
      remainingDays: this.remainingDays,
      isValid: this.isValid,
    };
  }
}
