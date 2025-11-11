import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { SessionStatus } from '../enums/usage-session.enums';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Device } from '../../devices/entities/device.entity';
import { QuotaViolation } from './quota-violation.entity';

/**
 * Detailed AC usage session tracking entity
 * Matches Spring Boot UsageSession entity exactly
 *
 * CRITICAL: roomId references Room.room_identifier (VARCHAR), NOT Room.id (UUID)
 * This matches Spring Boot which references room_identifier business key
 */
@Entity('usage_sessions')
@Index(['userId', 'roomId'])
@Index(['deviceType', 'status'])
@Index(['startedAt'])
@Index(['endedAt'])
@Index('idx_usage_sessions_user_id', ['userId'])
@Index('idx_usage_sessions_room_id', ['roomId'])
@Index('idx_usage_sessions_device_id', ['deviceId']) // NEW: Device tracking index
@Index('idx_usage_sessions_started_at', ['startedAt'])
@Index('idx_usage_sessions_ended_at', ['endedAt'])
@Index('idx_usage_sessions_status', ['status'])
@Index('idx_usage_sessions_date_range', ['startedAt', 'endedAt'])
@Index('idx_usage_sessions_quota_validation', ['userId', 'roomId', 'startedAt'])
@Index('idx_usage_sessions_device_tracking', [
  'userId',
  'deviceId',
  'startedAt',
]) // NEW: Composite device tracking index
export class UsageSession extends BaseEntity {
  /**
   * User ID - required field
   * Matches Spring Boot @NotNull(message = "User ID is required") @Column("user_id") private UUID userId;
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /**
   * Room ID - references Room.id (UUID primary key) for proper foreign key constraint
   * Updated to use primary key reference for database integrity
   */
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId!: string;

  /**
   * Device type with default
   * Matches Spring Boot @NotBlank(message = "Device type is required") @Column("device_type") @Builder.Default private String deviceType = "ac";
   */
  @Column({ name: 'device_type', type: 'varchar', default: 'ac' })
  deviceType!: string;

  /**
   * Device ID - references Device.id for specific device tracking
   * Allows tracking which specific device was used in multi-device rooms
   */
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId?: string | null;

  /**
   * Quota ID - references the quota this session is tracking against
   * Used for quota validation and reporting
   */
  @Column({ name: 'quota_id', type: 'uuid', nullable: true })
  quotaId?: string | null;

  /**
   * Session start time with default
   * Matches Spring Boot @NotNull(message = "Start time is required") @Column("started_at") @Builder.Default private Instant startedAt = Instant.now();
   */
  @Column({
    name: 'started_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt!: Date;

  @Column({
    name: 'ended_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  endedAt?: Date | null;

  @Column({
    name: 'duration_minutes',
    type: 'integer',
    nullable: true,
  })
  durationMinutes?: number | null;

  // Session status
  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status!: SessionStatus;

  // AC settings (stored as JSONB)
  @Column({
    name: 'initial_settings',
    type: 'jsonb',
    nullable: true,
  })
  initialSettings?: Record<string, any> | null;

  @Column({
    name: 'final_settings',
    type: 'jsonb',
    nullable: true,
  })
  finalSettings?: Record<string, any> | null;

  // AC control parameters
  @Column({
    name: 'temperature_set',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  temperatureSet?: number | null;

  @Column({
    name: 'mode',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  mode?: string | null;

  @Column({
    name: 'fan_speed',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  fanSpeed?: string | null;

  // Energy and cost tracking
  @Column({
    name: 'energy_consumed',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  energyConsumed!: number; // Energy in kWh

  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  estimatedCost!: number; // Cost in USD

  @Column({
    name: 'efficiency_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  efficiencyRating?: number | null; // 0.00 to 1.00

  // Environmental data
  @Column({
    name: 'outdoor_temperature',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  outdoorTemperature?: number | null;

  @Column({
    name: 'weather_conditions',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  weatherConditions?: string | null;

  // Quota enforcement
  @Column({
    name: 'quota_violations',
    type: 'jsonb',
    nullable: true,
  })
  quotaViolations?: Array<{
    quotaId: string;
    violationType: string;
    amount: number;
    timestamp: string;
  }> | null;

  @Column({
    name: 'override_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  overrideReason?: string | null;

  @Column({
    name: 'override_by',
    type: 'uuid',
    nullable: true,
  })
  overrideBy?: string | null;

  // Legacy metadata (maintained for backward compatibility)
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any> | null;

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

  // Relationships matching Spring Boot structure
  @ManyToOne(() => User, (user) => user.sessions, {
    onDelete: 'SET NULL', // Preserve session history when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /**
   * Room relationship - References Room.id (primary key) for proper foreign key constraint
   * Updated to use primary key reference for database integrity
   */
  @ManyToOne(() => Room, (room) => room.sessions, {
    onDelete: 'SET NULL', // Preserve session history when room is deleted
  })
  @JoinColumn({
    name: 'room_id',
    referencedColumnName: 'id', // Reference primary key, not business key
  })
  room!: Room;

  @ManyToOne(() => User, {
    onDelete: 'NO ACTION', // Matches database: NO ACTION
  })
  @JoinColumn({ name: 'override_by' })
  overrideByUser?: User | null;

  /**
   * Device relationship - tracks which specific device was used
   * Preserves session data even if device is deleted (SET NULL)
   */
  @ManyToOne(() => Device, (device) => device.usageSessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'device_id' })
  device?: Device | null;

  // Quota violation relationships
  @OneToMany(() => QuotaViolation, (violation) => violation.usageSession)
  violations: QuotaViolation[];

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
      !this.isDeleted &&
      !this.isArchived &&
      this.status === SessionStatus.ACTIVE
    );
  }

  get isCompleted(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.status === SessionStatus.COMPLETED
    );
  }

  get isInterrupted(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.status === SessionStatus.INTERRUPTED
    );
  }

  get isOverride(): boolean {
    return (
      !this.isDeleted &&
      !this.isArchived &&
      this.status === SessionStatus.OVERRIDE
    );
  }

  get duration(): number {
    if (this.endedAt) {
      return this.endedAt.getTime() - this.startedAt.getTime();
    }
    return Date.now() - this.startedAt.getTime();
  }

  get calculatedDurationMinutes(): number {
    return Math.floor(this.duration / (1000 * 60));
  }

  get durationHours(): number {
    return Math.floor(this.duration / (1000 * 60 * 60));
  }

  get hasQuotaViolations(): boolean {
    return !!(this.quotaViolations && this.quotaViolations.length > 0);
  }

  get hasOverride(): boolean {
    return !!(this.overrideReason && this.overrideBy);
  }

  // Session management methods
  pause(pauseReason?: string): void {
    this.status = SessionStatus.INTERRUPTED;
    if (!this.metadata) this.metadata = {};
    this.metadata.pauseReason = pauseReason;
    this.metadata.pausedAt = new Date().toISOString();
    this.updatedAt = new Date();
  }

  resume(): void {
    this.status = SessionStatus.ACTIVE;
    if (this.metadata) {
      delete this.metadata.pauseReason;
      delete this.metadata.pausedAt;
    }
    this.updatedAt = new Date();
  }

  complete(finalSettings?: Record<string, any>): void {
    this.status = SessionStatus.COMPLETED;
    this.endedAt = new Date();
    this.durationMinutes = this.durationMinutes;
    if (finalSettings) {
      this.finalSettings = finalSettings;
    }
    this.updatedAt = new Date();
  }

  terminate(terminationReason: string, overrideBy?: string): void {
    this.status = SessionStatus.INTERRUPTED;
    this.endedAt = new Date();
    this.durationMinutes = this.durationMinutes;
    this.overrideReason = terminationReason;
    if (overrideBy) {
      this.overrideBy = overrideBy;
    }
    this.updatedAt = new Date();
  }

  override(overrideReason: string, overrideBy: string): void {
    this.status = SessionStatus.OVERRIDE;
    this.endedAt = new Date();
    this.durationMinutes = this.durationMinutes;
    this.overrideReason = overrideReason;
    this.overrideBy = overrideBy;
    this.updatedAt = new Date();
  }

  // AC control methods
  updateACSettings(settings: {
    temperature?: number;
    mode?: string;
    fanSpeed?: string;
  }): void {
    if (settings.temperature !== undefined) {
      this.temperatureSet = settings.temperature;
    }
    if (settings.mode) {
      this.mode = settings.mode;
    }
    if (settings.fanSpeed) {
      this.fanSpeed = settings.fanSpeed;
    }
    this.updatedAt = new Date();
  }

  // Energy and cost tracking methods
  addEnergyConsumption(energy: number): void {
    this.energyConsumed += energy;
    this.updatedAt = new Date();
  }

  addCost(cost: number): void {
    this.estimatedCost += cost;
    this.updatedAt = new Date();
  }

  updateEfficiency(rating: number): void {
    this.efficiencyRating = Math.max(0, Math.min(1, rating));
    this.updatedAt = new Date();
  }

  updateEnvironmentalData(data: {
    outdoorTemperature?: number;
    weatherConditions?: string;
  }): void {
    if (data.outdoorTemperature !== undefined) {
      this.outdoorTemperature = data.outdoorTemperature;
    }
    if (data.weatherConditions) {
      this.weatherConditions = data.weatherConditions;
    }
    this.updatedAt = new Date();
  }

  addQuotaViolation(violation: {
    quotaId: string;
    violationType: string;
    amount: number;
  }): void {
    if (!this.quotaViolations) {
      this.quotaViolations = [];
    }
    this.quotaViolations.push({
      ...violation,
      timestamp: new Date().toISOString(),
    });
    this.updatedAt = new Date();
  }

  // Legacy methods for backward compatibility
  addOperation(operation: { type: string; value?: any }): void {
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.operationHistory) this.metadata.operationHistory = [];

    const record = {
      operation: operation.type,
      timestamp: new Date().toISOString(),
      value: operation.value,
    };

    this.metadata.operationHistory.push(record);

    // Keep only last 100 operations
    if (this.metadata.operationHistory.length > 100) {
      this.metadata.operationHistory =
        this.metadata.operationHistory.slice(-100);
    }

    this.updatedAt = new Date();
  }

  addUsage(amount: number): void {
    // For backward compatibility - store in metadata as there's no totalUsage field
    if (!this.metadata) this.metadata = {};
    this.metadata.totalUsage =
      ((this.metadata.totalUsage as number) || 0) + amount;
    this.updatedAt = new Date();
  }

  // Legacy properties for backward compatibility
  get startTime(): Date {
    return this.startedAt;
  }

  get endTime(): Date | null | undefined {
    return this.endedAt;
  }

  get totalDuration(): number {
    return this.duration;
  }

  get totalUsage(): number {
    return (this.metadata?.totalUsage as number) || 0;
  }

  // Additional adapter properties for service compatibility
  // Note: quotaId and deviceId are now stored as strings, not relationships
  // quotaId would need to be added as a column if needed
  // deviceId would need to be added as a column if needed

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      isCompleted: this.isCompleted,
      isInterrupted: this.isInterrupted,
      isOverride: this.isOverride,
      duration: this.duration,
      durationMinutes: this.calculatedDurationMinutes,
      durationHours: this.durationHours,
      hasQuotaViolations: this.hasQuotaViolations,
      hasOverride: this.hasOverride,
    };
  }
}
