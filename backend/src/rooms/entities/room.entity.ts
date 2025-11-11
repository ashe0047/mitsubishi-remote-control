import {
  Entity,
  Column,
  Index,
  Unique,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { UsageSession } from '../../quotas/entities/usage-session.entity';
import { Quota } from '../../quotas/entities/quota.entity';
import { Household } from '../../households/entities/household.entity';
import { Device } from '../../devices/entities/device.entity';
import { AccessControl } from '../../users/entities/access-control.entity';

@Entity('rooms')
@Unique(['householdId', 'roomIdentifier'])
@Unique(['householdId', 'name'])
@Index('idx_rooms_household_id', ['householdId'])
@Index('idx_rooms_room_identifier', ['roomIdentifier'])
export class Room extends BaseEntity {
  /**
   * Household ID - required field
   * Matches Spring Boot @Column("household_id") private UUID householdId;
   */
  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  /**
   * Household relationship
   * Rooms are deleted when household is deleted
   */
  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'household_id' })
  household!: Household;

  /**
   * Room name
   * Matches Spring Boot @Column("name") private String name;
   */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /**
   * Room identifier used for MQTT topics and business keys
   * This is the critical field that Spring Boot references in UsageSession
   * Matches Spring Boot @Column("room_identifier") private String roomIdentifier;
   */
  @Column({ name: 'room_identifier', type: 'varchar', length: 100 })
  roomIdentifier!: string;

  /**
   * Room location description
   * Matches Spring Boot @Column("location") private String location;
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string | null;

  /**
   * Detailed room description
   * Matches Spring Boot @Column("description") private String description;
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

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

  // Quota relationships for room-scoped quotas
  @OneToMany(() => Quota, (quota) => quota.room)
  quotas: Quota[];

  @OneToMany(() => UsageSession, (session) => session.room)
  sessions: UsageSession[];

  // Device relationships
  @OneToMany(() => Device, (device) => device.room)
  devices: Device[];

  // Unified access assignment relationships
  @OneToMany(() => AccessControl, (assignment) => assignment.room)
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

  get isActive(): boolean {
    return !this.isDeleted && !this.isArchived;
  }

  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
    };
  }
}
