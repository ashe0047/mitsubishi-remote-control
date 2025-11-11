import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../shared/database/entities/base.entity';
import { Device } from './device.entity';
import { UsageSession } from '../../quotas/entities/usage-session.entity';

@Entity('device_status_history')
@Index(['deviceId'])
@Index(['createdAt'])
@Index(['usageSessionId']) // Session tracking index
@Index(['powerState']) // Power state queries
@Index(['operationMode']) // Mode filtering
@Index(['statusCode']) // Status filtering
@Index(['errorCode']) // Error tracking
@Index(['currentTemperature']) // Temperature analysis
@Index(['deviceId', 'createdAt']) // Device history composite index
@Index(['deviceId', 'powerState']) // Device power state queries
@Index(['deviceId', 'operationMode']) // Device mode queries
@Index(['usageSessionId', 'createdAt']) // Session timeline queries
@Index('idx_device_status_history_device_id', ['deviceId'])
@Index('idx_device_status_history_created_at', ['createdAt'])
@Index('idx_device_status_history_usage_session_id', ['usageSessionId'])
@Index('idx_device_status_history_power_state', ['powerState'])
@Index('idx_device_status_history_operation_mode', ['operationMode'])
@Index('idx_device_status_history_status_code', ['statusCode'])
@Index('idx_device_status_history_error_code', ['errorCode'])
@Index('idx_device_status_history_current_temperature', ['currentTemperature'])
@Index('idx_device_status_history_composite', ['deviceId', 'createdAt'])
@Index('idx_device_status_history_power_composite', ['deviceId', 'powerState'])
@Index('idx_device_status_history_mode_composite', [
  'deviceId',
  'operationMode',
])
@Index('idx_device_status_history_session_timeline', [
  'usageSessionId',
  'createdAt',
])
export class DeviceStatusHistory extends BaseEntity {
  @Column({ name: 'device_id' })
  deviceId!: string;

  /**
   * Usage Session ID - optional link to usage session
   * Allows correlating device status changes with specific usage sessions
   */
  @Column({ name: 'usage_session_id', type: 'uuid', nullable: true })
  usageSessionId?: string | null;

  // Enhanced status fields for better queryability
  @Column({ name: 'power_state', type: 'boolean', nullable: true })
  powerState?: boolean | null;

  @Column({
    name: 'current_temperature',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  currentTemperature?: number | null;

  @Column({
    name: 'target_temperature',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  targetTemperature?: number | null;

  @Column({
    name: 'operation_mode',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  operationMode?: string | null;

  @Column({
    name: 'fan_speed_setting',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  fanSpeedSetting?: string | null;

  @Column({ name: 'status_code', type: 'varchar', length: 50, nullable: true })
  statusCode?: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode?: string | null;

  @Column({
    name: 'energy_consumption',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  energyConsumption?: number | null;

  // Relationships
  @ManyToOne(() => Device, (device) => device.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  /**
   * Usage Session relationship - optional link to usage session
   * Preserves device status history even if session is deleted
   */
  @ManyToOne(() => UsageSession, {
    nullable: true,
    onDelete: 'SET NULL', // Preserve history even if session is deleted
  })
  @JoinColumn({ name: 'usage_session_id' })
  usageSession?: UsageSession | null;

  // Computed properties
  get statusTimestamp(): number {
    return this.createdAt.getTime();
  }

  get deviceIdentifier(): string {
    return ''; // Device identifier should come from the device relationship
  }

  get power(): boolean {
    return this.powerState !== undefined && this.powerState !== null
      ? this.powerState
      : false;
  }

  get temperature(): number | null {
    return this.currentTemperature !== null &&
      this.currentTemperature !== undefined
      ? this.currentTemperature
      : null;
  }

  get targetTemp(): number | null {
    return this.targetTemperature !== null &&
      this.targetTemperature !== undefined
      ? this.targetTemperature
      : null;
  }

  get mode(): string | null {
    return this.operationMode || null;
  }

  get fanSpeed(): string | null {
    return this.fanSpeedSetting || null;
  }

  get status(): string | null {
    return this.statusCode || null;
  }

  get hasError(): boolean {
    return !!this.errorCode;
  }

  get error(): string | null {
    return this.errorCode || null;
  }

  get energyUsage(): number | null {
    return this.energyConsumption !== null &&
      this.energyConsumption !== undefined
      ? this.energyConsumption
      : null;
  }

  // Advanced computed properties for analytics
  get isHeating(): boolean {
    const currentMode = this.mode?.toLowerCase();
    return this.power && (currentMode === 'heat' || currentMode === 'auto');
  }

  get isCooling(): boolean {
    const currentMode = this.mode?.toLowerCase();
    return this.power && (currentMode === 'cool' || currentMode === 'dry');
  }

  get temperatureDelta(): number | null {
    const currentTemp = this.temperature;
    const targetTemp = this.targetTemp;
    if (currentTemp === null || targetTemp === null) {
      return null;
    }
    return currentTemp - targetTemp;
  }

  get isEnergyEfficient(): boolean {
    // Simple efficiency check - can be enhanced with more sophisticated logic
    return this.energyUsage !== null && this.energyUsage < 2.0; // kWh threshold
  }

  // Methods for status analysis
  hasStatusChanged(other: DeviceStatusHistory): boolean {
    return (
      this.powerState !== other.powerState ||
      this.currentTemperature !== other.currentTemperature ||
      this.targetTemperature !== other.targetTemperature ||
      this.operationMode !== other.operationMode ||
      this.fanSpeedSetting !== other.fanSpeedSetting ||
      this.statusCode !== other.statusCode ||
      this.errorCode !== other.errorCode
    );
  }

  getPowerChangeFrom(other: DeviceStatusHistory): 'on' | 'off' | 'no_change' {
    const currentPower = this.power;
    const previousPower = other.power;

    if (currentPower === previousPower) return 'no_change';
    return currentPower ? 'on' : 'off';
  }

  getTemperatureChangeFrom(other: DeviceStatusHistory): number | null {
    const currentTemp = this.temperature;
    const previousTemp = other.temperature;

    if (currentTemp === null || previousTemp === null) return null;
    return currentTemp - previousTemp;
  }

  // Serialization for API responses
  toJSON() {
    return {
      id: this.id,
      deviceId: this.deviceId,
      usageSessionId: this.usageSessionId,
      // Structured fields
      powerState: this.powerState,
      currentTemperature: this.currentTemperature,
      targetTemperature: this.targetTemperature,
      operationMode: this.operationMode,
      fanSpeedSetting: this.fanSpeedSetting,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      energyConsumption: this.energyConsumption,
      createdAt: this.createdAt,
      // Computed properties
      statusTimestamp: this.statusTimestamp,
      deviceIdentifier: this.deviceIdentifier,
      power: this.power,
      temperature: this.temperature,
      targetTemp: this.targetTemp,
      mode: this.mode,
      fanSpeed: this.fanSpeed,
      status: this.status,
      hasError: this.hasError,
      error: this.error,
      energyUsage: this.energyUsage,
      isHeating: this.isHeating,
      isCooling: this.isCooling,
      temperatureDelta: this.temperatureDelta,
      isEnergyEfficient: this.isEnergyEfficient,
    };
  }
}
