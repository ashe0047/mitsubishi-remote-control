import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { FamilyInvitation } from './family-invitation.entity';
import { Room } from '../../rooms/entities/room.entity';

// Validation enums to match Spring Boot
export enum SubscriptionPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

@Entity('households')
@Index('idx_households_organization', ['organizationId'])
@Index('idx_households_subscription_plan', ['subscriptionPlan'])
@Index('idx_households_created_at', ['createdAt'])
export class Household extends BaseEntity {
  /**
   * Household name - required field
   * Matches Spring Boot @NotBlank(message = "Household name is required") @Column("name") private String name;
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Subscription plan with default value
   * Matches Spring Boot @Column("subscription_plan") @Builder.Default private String subscriptionPlan = "basic";
   */
  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    nullable: true,
    default: SubscriptionPlan.BASIC,
    name: 'subscription_plan',
  })
  subscriptionPlan?: SubscriptionPlan | null;

  /**
   * Billing email address
   * Matches Spring Boot @Email(message = "Invalid email format") @Column("billing_email") private String billingEmail;
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'billing_email',
  })
  billingEmail?: string | null;

  /**
   * Address information stored as JSONB
   * Matches Spring Boot @Column("address") private String address; // JSONB for address information
   */
  @Column({ type: 'jsonb', nullable: true })
  address?: Record<string, any> | null;

  /**
   * Timezone with default UTC
   * Matches Spring Boot @Column("timezone") @Builder.Default private String timezone = "UTC";
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: 'UTC',
  })
  timezone?: string | null;

  /**
   * Organization ID for multi-organization support
   * Matches Spring Boot @Column("organization_id") private UUID organizationId;
   */
  @Column({ type: 'uuid', nullable: true, name: 'organization_id' })
  organizationId!: string | null;

  /**
   * Extended settings stored as JSONB
   * Matches Spring Boot @Column("settings") private String settings; // JSONB for extended settings
   */
  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any> | null;

  /**
   * User who created this household
   * Reinstated for audit trail and user tracking
   */
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  created_by?: string | null;

  // User relationships - one household has many members
  @OneToMany(() => User, (user) => user.household)
  members!: User[];

  // Room relationships - one household has many rooms
  @OneToMany(() => Room, (room) => room.household)
  rooms!: Room[];

  // Family invitation relationships
  @OneToMany(() => FamilyInvitation, (invitation) => invitation.household)
  invitations!: FamilyInvitation[];
}
