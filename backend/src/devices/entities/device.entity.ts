import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { DeviceStatusHistory } from './device-status.entity';
import { Room } from '../../rooms/entities/room.entity';
import { UsageSession } from '../../quotas/entities/usage-session.entity';
import { AccessControl } from '../../users/entities/access-control.entity';

export enum DeviceType {
  /** Air conditioner / HVAC system */
  AIRCONDITIONER = 'airconditioner',

  /** Thermostat device */
  THERMOSTAT = 'thermostat',

  /** Humidifier / Dehumidifier */
  HUMIDIFIER = 'humidifier',

  /** Fan device */
  FAN = 'fan',
}

@Entity('devices')
@Index(['roomId', 'type', 'identifier'], { unique: true })
@Index(['id']) // For performance (primary key)
@Index(['type']) // For filtering by device type
@Index(['enabled']) // For filtering enabled devices
@Index('idx_devices_room_id', ['roomId'])
@Index('idx_devices_device_type', ['type'])
@Index('idx_devices_device_identifier', ['identifier'])
@Index('idx_devices_enabled', ['enabled'])
// Note: GIN index for metadata will be created manually as it's a special index type
export class Device extends BaseEntity {
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId!: string; // References Room.id (primary key) for proper foreign key constraint

  /**
   * Room relationship
   * Uses Room.id (primary key) for proper foreign key constraint
   * Device history is preserved when room is deleted
   */
  @ManyToOne(() => Room, (room) => room.devices, {
    onDelete: 'SET NULL', // Preserve device history when room is deleted
    nullable: true,
  })
  @JoinColumn({
    name: 'room_id',
    referencedColumnName: 'id',
  })
  room?: Room;

  @Column({ name: 'device_type', type: 'varchar', length: 50 })
  type!: DeviceType;

  @Column({ name: 'device_identifier', type: 'varchar', length: 255 })
  identifier!: string; // per-room unique identifier for device

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, any>;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

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

  // Status history relationships
  @OneToMany(() => DeviceStatusHistory, (status) => status.device)
  statusHistory: DeviceStatusHistory[];

  // Usage session relationships
  @OneToMany(() => UsageSession, (session) => session.device)
  usageSessions: UsageSession[];

  // Unified access assignment relationships
  @OneToMany(() => AccessControl, (assignment) => assignment.device)
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
    return !this.isDeleted && !this.isArchived && this.enabled;
  }

  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
    };
  }
}
