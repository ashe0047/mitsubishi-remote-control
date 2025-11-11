import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { Household } from '../../households/entities/household.entity';
import { FamilyInvitation } from '../../households/entities/family-invitation.entity';
import { Quota } from '../../quotas/entities/quota.entity';
import { UsageSession } from '../../quotas/entities/usage-session.entity';
import { QuotaOverride } from '../../quotas/entities/quota-override.entity';
import { QuotaViolation } from '../../quotas/entities/quota-violation.entity';
import { AccessControl } from './access-control.entity';
import { UserRole, UserStatus } from '../enums/access.enums';

@Entity('users')
@Index('idx_users_household_id', ['householdId'])
@Index('idx_users_email', ['email'])
@Index('idx_users_role', ['role'])
@Index('idx_users_status', ['status'])
@Index('idx_users_created_at', ['createdAt'])
@Index('idx_users_last_login', ['lastLoginAt'])
export class User extends BaseEntity {
  /**
   * Household ID - required field
   * Matches Spring Boot @NotNull(message = "Household ID is required") @Column("household_id") private UUID householdId;
   */
  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  /**
   * Email address with unique constraint
   * Matches Spring Boot @Email(message = "Invalid email format") @NotBlank(message = "Email is required") @Column("email") private String email;
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /**
   * Password hash
   * Matches Spring Boot @NotBlank(message = "Password hash is required") @Column("password_hash") private String passwordHash;
   */
  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  /**
   * User name - required field
   * Matches Spring Boot @NotBlank(message = "Name is required") @Column("name") private String name;
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * User role with default
   * Matches Spring Boot @NotNull(message = "User role is required") @Column("role") @Builder.Default private UserRole role = UserRole.child;
   */
  @Column({
    type: 'varchar',
    length: 32,
    default: UserRole.CHILD,
  })
  role!: UserRole;

  /**
   * User status with default
   * Matches Spring Boot @NotNull(message = "User status is required") @Column("status") @Builder.Default private UserStatus status = UserStatus.active;
   */
  @Column({
    type: 'varchar',
    length: 32,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  /**
   * Date of birth - cannot be in future
   * Matches Spring Boot @PastOrPresent(message = "Birth date cannot be in the future") @Column("date_of_birth") private LocalDate dateOfBirth;
   */
  @Column({ type: 'date', nullable: true, name: 'date_of_birth' })
  dateOfBirth?: Date | null;

  /**
   * Avatar URL
   * Matches Spring Boot @Column("avatar_url") private String avatarUrl;
   */
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' })
  avatarUrl?: string | null;

  /**
   * Phone number
   * Matches Spring Boot @Column("phone") private String phone;
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  /**
   * User preferences stored as JSONB
   * Matches Spring Boot @Column("preferences") private String preferences; // JSONB for user preferences
   */
  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, any> | null;

  /**
   * Emergency contacts stored as JSONB
   * Matches Spring Boot @Column("emergency_contacts") private String emergencyContacts; // JSONB for emergency contacts
   */
  @Column({ type: 'jsonb', nullable: true })
  emergency_contacts?: Record<string, any> | null;

  /**
   * Employee ID for organization users
   * Matches Spring Boot @Column("employee_id") private String employeeId;
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  employee_id?: string | null;

  /**
   * Department for organization users
   * Matches Spring Boot @Column("department") private String department;
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string | null;

  /**
   * Cost center for organization users
   * Matches Spring Boot @Column("cost_center") private String costCenter;
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  cost_center?: string | null;

  /**
   * Last login timestamp
   * Matches Spring Boot @Column("last_login_at") private Instant lastLoginAt;
   */
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_login_at',
  })
  lastLoginAt?: Date | null;

  /**
   * User who created this user
   * Matches Spring Boot @Column("created_by") private UUID createdBy;
   */
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
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

  @ManyToOne(() => Household, (h) => h.members, { nullable: true })
  @JoinColumn({ name: 'household_id' })
  household?: Household | null;

  // Quota relationships
  @OneToMany(() => Quota, (quota) => quota.user)
  quotas: Quota[];

  @OneToMany(() => UsageSession, (session) => session.user)
  sessions: UsageSession[];

  @OneToMany(() => QuotaOverride, (override) => override.requestedBy)
  requestedOverrides: QuotaOverride[];

  @OneToMany(() => QuotaOverride, (override) => override.approvedBy)
  approvedOverrides: QuotaOverride[];

  @OneToMany(() => FamilyInvitation, (invitation) => invitation.invitedByUser)
  sentInvitations: FamilyInvitation[];

  @OneToMany(() => FamilyInvitation, (invitation) => invitation.acceptedUser)
  acceptedInvitations: FamilyInvitation[];

  @OneToMany(() => QuotaViolation, (violation) => violation.user)
  quotaViolations: QuotaViolation[];

  @OneToMany(() => QuotaViolation, (violation) => violation.overrideByUser)
  overriddenViolations: QuotaViolation[];

  @OneToMany(() => QuotaViolation, (violation) => violation.resolvedByUser)
  resolvedViolations: QuotaViolation[];

  // Access assignment relationships
  @OneToMany(() => AccessControl, (assignment) => assignment.user)
  accessRules: AccessControl[];

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
      !this.isDeleted && !this.isArchived && this.status === UserStatus.ACTIVE
    );
  }

  get isSuspended(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.status === UserStatus.SUSPENDED
    );
  }

  get isPending(): boolean {
    return (
      !this.isDeleted && !this.isArchived && this.status === UserStatus.PENDING
    );
  }

  get isArchivedUser(): boolean {
    return !this.isDeleted && this.isArchived;
  }

  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      isSuspended: this.isSuspended,
      isPending: this.isPending,
      isArchivedUser: this.isArchivedUser,
    };
  }
}
