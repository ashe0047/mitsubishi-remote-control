# Phase 3: Room Management and Device Control - Implementation Plan

## Phase Overview

**Objective**: Implement comprehensive room management and air conditioner device control system maintaining 100% functional equivalence with Spring Boot backend.

**Duration**: 5-7 days
**Success Criteria**:
- All room management operations work identically to Spring Boot
- MQTT-based device control with <1s latency
- Real-time status updates with proper synchronization
- Room-based access control enforcement
- Device discovery and registration functionality
- Performance targets met (room ops <100ms, device control <2s)

## Clean Code Implementation Checklist

### DRY Implementation Strategy
- ✅ **Centralized MQTT Operations**: Shared topic formatting and message parsing
- ✅ **Common Device Validation**: Reusable validation logic across device types
- ✅ **Standardized Room Access Control**: Consistent permission checking patterns
- ✅ **Unified Error Handling**: Standardized error responses and logging
- ✅ **Shared Status Management**: Common status update and caching patterns

### SOLID Principles Implementation
- ✅ **SRP**: Separate modules for rooms, devices, MQTT, and status management
- ✅ **OCP**: Extensible device control strategies and room validation rules
- ✅ **LSP**: Proper inheritance hierarchies for device types
- ✅ **ISP**: Focused interfaces for different concerns
- ✅ **DIP**: Dependency injection for all services and repositories

### YAGNI Implementation Strategy
- ✅ **AC Device Focus**: Only air conditioner control (current requirement)
- ✅ **Basic Room Management**: Essential functionality without over-engineering
- ✅ **MQTT Integration**: mitsubishi2mqtt compatibility only
- ✅ **Simple Status Management**: Essential real-time updates without complex analytics

## Implementation Tasks

### Task 3.1: Database Entities and Migrations

**Objective**: Create TypeORM entities for rooms and devices

**Implementation Steps**:

1. **Room Entity Implementation**
```typescript
// src/modules/rooms/entities/room.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RoomStatus } from '../enums/room-status.enum';
import { Device } from '../../devices/entities/device.entity';
import { Household } from '../../households/entities/household.entity';

@Entity('rooms')
@Index(['householdId', 'isActive'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.OFFLINE,
  })
  status: RoomStatus;

  @Column({ name: 'household_id' })
  householdId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'device_count', default: 0 })
  deviceCount: number;

  @Column({ name: 'online_device_count', default: 0 })
  onlineDeviceCount: number;

  @Column({ type: 'json', nullable: true })
  settings: RoomSettings;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Household, household => household.rooms, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'household_id' })
  household: Household;

  @OneToMany(() => Device, device => device.room, { cascade: true })
  devices: Device[];

  // Computed properties
  get isOnline(): boolean {
    return this.onlineDeviceCount > 0;
  }

  get deviceStatus(): 'online' | 'offline' | 'mixed' {
    if (this.deviceCount === 0) return 'offline';
    return this.onlineDeviceCount === this.deviceCount ? 'online' : 'mixed';
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isOnline: this.isOnline,
      deviceStatus: this.deviceStatus,
    };
  }
}

export interface RoomSettings {
  defaultTemperature?: number;
  defaultMode?: string;
  energySaving?: boolean;
  scheduleEnabled?: boolean;
}
```

2. **Device Entity Implementation**
```typescript
// src/modules/devices/entities/device.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { DeviceType, DeviceStatus } from '../enums/device-type.enum';
import { Room } from '../../rooms/entities/room.entity';
import { DeviceCommand } from './device-command.entity';

@Entity('devices')
@Index(['roomId', 'isActive'])
@Index(['type', 'isOnline'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  type: DeviceType;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.OFFLINE,
  })
  status: DeviceStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date;

  @Column({ type: 'json', nullable: true })
  settings: DeviceSettings;

  @Column({ type: 'json', nullable: true })
  currentState: DeviceState;

  @Column({ type: 'json', nullable: true })
  capabilities: DeviceCapabilities;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Room, room => room.devices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => DeviceCommand, command => command.device)
  commands: DeviceCommand[];

  // Computed properties
  get isControllable(): boolean {
    return this.isActive && this.isOnline;
  }

  get statusDisplay(): string {
    if (!this.isActive) return 'Inactive';
    if (!this.isOnline) return 'Offline';
    return this.currentState?.power ? 'On' : 'Off';
  }

  // Validation methods
  get isValid(): boolean {
    return this.name && this.type && this.roomId;
  }

  // Serialization for API responses
  toJSON() {
    return {
      ...this,
      isControllable: this.isControllable,
      statusDisplay: this.statusDisplay,
    };
  }
}

export interface DeviceSettings {
  temperature?: number;
  mode?: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only';
  fanSpeed?: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET';
  vane?: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING';
  wideVane?: '<<' | '<' | '||' | '|' | '>>' | 'SWING';
}

export interface DeviceState {
  power?: boolean;
  temperature?: number;
  mode?: string;
  fanSpeed?: string;
  vane?: string;
  wideVane?: string;
  roomTemperature?: number;
  lastUpdate?: Date;
}

export interface DeviceCapabilities {
  supportedModes?: string[];
  temperatureRange?: { min: number; max: number };
  supportedFanSpeeds?: string[];
  supportedVanes?: string[];
  supportedWideVanes?: string[];
}
```

3. **Device Command Entity**
```typescript
// src/modules/devices/entities/device-command.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';
import { CommandStatus, CommandType } from '../enums/command.enum';

@Entity('device_commands')
@Index(['deviceId', 'status'])
@Index(['createdAt'])
export class DeviceCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({
    type: 'enum',
    enum: CommandType,
  })
  type: CommandType;

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: CommandStatus,
    default: CommandStatus.PENDING,
  })
  status: CommandStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
  executedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relationships
  @ManyToOne(() => Device, device => device.commands, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  // Computed properties
  get isPending(): boolean {
    return this.status === CommandStatus.PENDING;
  }

  get isCompleted(): boolean {
    return this.status === CommandStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return this.status === CommandStatus.FAILED;
  }

  get canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }
}
```

4. **Database Migration**
```typescript
// migrations/002_create_room_device_tables.ts
import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateRoomDeviceTables1234567891 implements MigrationInterface {
  name = 'CreateRoomDeviceTables1234567891';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create rooms table
    await queryRunner.createTable(
      new Table({
        name: 'rooms',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['online', 'offline', 'mixed'],
            default: `'offline'`,
          },
          { name: 'household_id', type: 'uuid' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'device_count', type: 'int', default: 0 },
          { name: 'online_device_count', type: 'int', default: 0 },
          { name: 'settings', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['household_id'],
            referencedTableName: 'households',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_ROOM_HOUSEHOLD', columnNames: ['household_id'] },
          { name: 'IDX_ROOM_ACTIVE', columnNames: ['is_active'] },
          { name: 'IDX_ROOM_STATUS', columnNames: ['status'] },
        ],
      }),
      true,
    );

    // Create devices table
    await queryRunner.createTable(
      new Table({
        name: 'devices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'name', type: 'varchar', length: '100' },
          {
            name: 'type',
            type: 'enum',
            enum: ['airconditioner'],
          },
          { name: 'room_id', type: 'uuid' },
          {
            name: 'status',
            type: 'enum',
            enum: ['online', 'offline', 'error', 'maintenance'],
            default: `'offline'`,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'is_online', type: 'boolean', default: false },
          { name: 'last_seen', type: 'timestamp', isNullable: true },
          { name: 'settings', type: 'json', isNullable: true },
          { name: 'current_state', type: 'json', isNullable: true },
          { name: 'capabilities', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['room_id'],
            referencedTableName: 'rooms',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_DEVICE_ROOM', columnNames: ['room_id'] },
          { name: 'IDX_DEVICE_TYPE', columnNames: ['type'] },
          { name: 'IDX_DEVICE_STATUS', columnNames: ['status'] },
          { name: 'IDX_DEVICE_ONLINE', columnNames: ['is_online'] },
        ],
      }),
      true,
    );

    // Create device_commands table
    await queryRunner.createTable(
      new Table({
        name: 'device_commands',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'device_id', type: 'uuid' },
          {
            name: 'type',
            type: 'enum',
            enum: ['SET_POWER', 'SET_TEMPERATURE', 'SET_MODE', 'SET_FAN', 'SET_VANE', 'SET_WIDEVANE'],
          },
          { name: 'payload', type: 'json' },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'executing', 'completed', 'failed'],
            default: `'pending'`,
          },
          { name: 'retry_count', type: 'int', default: 0 },
          { name: 'max_retries', type: 'int', default: 3 },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'executed_at', type: 'timestamp', isNullable: true },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['device_id'],
            referencedTableName: 'devices',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_COMMAND_DEVICE', columnNames: ['device_id'] },
          { name: 'IDX_COMMAND_STATUS', columnNames: ['status'] },
          { name: 'IDX_COMMAND_CREATED', columnNames: ['created_at'] },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('device_commands');
    await queryRunner.dropTable('devices');
    await queryRunner.dropTable('rooms');
  }
}
```

**Validation**:
- [ ] All entities compile without TypeScript errors
- [ ] Database migration runs successfully
- [ ] Entity relationships work correctly
- [ ] Indexes are created for performance
- [ ] Computed properties function correctly

### Task 3.2: Room Management Service Implementation

**Objective**: Implement room CRUD operations with access control

**Implementation Steps**:

1. **Room Service**
```typescript
// src/modules/rooms/services/room.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from '../entities/room.entity';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomStatus } from '../enums/room-status.enum';
import { DeviceService } from '../../devices/services/device.service';
import { RoomAccessService } from './room-access.service';
import { RoomCacheService } from './room-cache.service';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly deviceService: DeviceService,
    private readonly roomAccessService: RoomAccessService,
    private readonly roomCacheService: RoomCacheService,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto, user: any): Promise<Room> {
    // Validate access - only parents can create rooms
    const hasAccess = await this.roomAccessService.canCreateRoom(user);
    if (!hasAccess) {
      throw new ForbiddenException('Only parents can create rooms');
    }

    // Check if room name already exists in household
    const existingRoom = await this.roomRepository.findOne({
      where: {
        householdId: user.householdId,
        name: createRoomDto.name.trim(),
        isActive: true,
      },
    });

    if (existingRoom) {
      throw new BadRequestException('Room with this name already exists in your household');
    }

    // Create room
    const room = this.roomRepository.create({
      name: createRoomDto.name.trim(),
      description: createRoomDto.description?.trim(),
      householdId: user.householdId,
      status: RoomStatus.OFFLINE,
      deviceCount: 0,
      onlineDeviceCount: 0,
      settings: createRoomDto.settings || {},
    });

    const savedRoom = await this.roomRepository.save(room);

    // Cache room data
    await this.roomCacheService.cacheRoom(savedRoom);
    await this.roomCacheService.invalidateRoomList(user.householdId);

    return savedRoom;
  }

  async getRoomsForUser(user: any): Promise<Room[]> {
    // Try cache first
    const cachedRoomIds = await this.roomCacheService.getCachedRoomList(user.householdId);
    if (cachedRoomIds) {
      const rooms = await Promise.all(
        cachedRoomIds.map(roomId => this.roomCacheService.getCachedRoom(roomId))
      );
      return rooms.filter(room => room !== null) as Room[];
    }

    // Fallback to database
    const rooms = await this.roomRepository.find({
      where: {
        householdId: user.householdId,
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });

    // Cache results
    await this.roomCacheService.cacheRoomList(user.householdId, rooms);

    return rooms;
  }

  async getRoomById(roomId: string, user: any): Promise<Room> {
    // Validate access
    const hasAccess = await this.roomAccessService.canAccessRoom(user, roomId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this room');
    }

    // Try cache first
    const cachedRoom = await this.roomCacheService.getCachedRoom(roomId);
    if (cachedRoom) {
      return cachedRoom;
    }

    // Fallback to database
    const room = await this.roomRepository.findOne({
      where: {
        id: roomId,
        isActive: true,
      },
      relations: ['devices'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Verify household membership
    if (room.householdId !== user.householdId) {
      throw new ForbiddenException('Access denied to this room');
    }

    // Cache room data
    await this.roomCacheService.cacheRoom(room);

    return room;
  }

  async updateRoom(roomId: string, updateRoomDto: UpdateRoomDto, user: any): Promise<Room> {
    // Validate access
    const hasAccess = await this.roomAccessService.canModifyRoom(user, roomId);
    if (!hasAccess) {
      throw new ForbiddenException('Only parents can modify rooms');
    }

    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Verify household membership
    if (room.householdId !== user.householdId) {
      throw new ForbiddenException('Access denied to this room');
    }

    // Check name uniqueness if name is being changed
    if (updateRoomDto.name && updateRoomDto.name.trim() !== room.name) {
      const existingRoom = await this.roomRepository.findOne({
        where: {
          householdId: user.householdId,
          name: updateRoomDto.name.trim(),
          isActive: true,
          id: Not(roomId),
        },
      });

      if (existingRoom) {
        throw new BadRequestException('Room with this name already exists in your household');
      }
    }

    // Update room fields
    Object.assign(room, updateRoomDto);

    if (updateRoomDto.name) {
      room.name = updateRoomDto.name.trim();
    }

    if (updateRoomDto.description) {
      room.description = updateRoomDto.description.trim();
    }

    const updatedRoom = await this.roomRepository.save(room);

    // Update cache
    await this.roomCacheService.cacheRoom(updatedRoom);
    await this.roomCacheService.invalidateRoomList(user.householdId);

    return updatedRoom;
  }

  async deleteRoom(roomId: string, user: any): Promise<void> {
    // Validate access
    const hasAccess = await this.roomAccessService.canModifyRoom(user, roomId);
    if (!hasAccess) {
      throw new ForbiddenException('Only parents can delete rooms');
    }

    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
      relations: ['devices'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Verify household membership
    if (room.householdId !== user.householdId) {
      throw new ForbiddenException('Access denied to this room');
    }

    // Check if room has devices
    if (room.devices && room.devices.length > 0) {
      throw new BadRequestException('Cannot delete room with active devices. Please remove devices first.');
    }

    // Soft delete room
    room.isActive = false;
    await this.roomRepository.save(room);

    // Invalidate cache
    await this.roomCacheService.invalidateRoom(roomId, user.householdId);
    await this.roomCacheService.invalidateRoomList(user.householdId);
  }

  async updateRoomStatus(roomId: string): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
      relations: ['devices'],
    });

    if (!room) {
      return;
    }

    // Calculate device counts
    const totalDevices = room.devices?.filter(device => device.isActive).length || 0;
    const onlineDevices = room.devices?.filter(device => device.isActive && device.isOnline).length || 0;

    // Determine room status
    let status: RoomStatus;
    if (totalDevices === 0) {
      status = RoomStatus.OFFLINE;
    } else if (onlineDevices === totalDevices) {
      status = RoomStatus.ONLINE;
    } else {
      status = RoomStatus.MIXED;
    }

    // Update room if status changed
    if (room.status !== status || room.deviceCount !== totalDevices || room.onlineDeviceCount !== onlineDevices) {
      room.status = status;
      room.deviceCount = totalDevices;
      room.onlineDeviceCount = onlineDevices;
      await this.roomRepository.save(room);

      // Update cache
      await this.roomCacheService.cacheRoom(room);
    }
  }
}
```

2. **Room Access Control Service**
```typescript
// src/modules/rooms/services/room-access.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class RoomAccessService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async canCreateRoom(user: User): Promise<boolean> {
    // Only parents can create rooms
    return user.role === UserRole.PARENT;
  }

  async canAccessRoom(user: User, roomId: string): Promise<boolean> {
    // Check if user is active and has household
    if (!user.isActive || !user.householdId) {
      return false;
    }

    // Check if room exists and belongs to user's household
    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
      select: ['id', 'householdId'],
    });

    return room?.householdId === user.householdId;
  }

  async canModifyRoom(user: User, roomId: string): Promise<boolean> {
    // Only parents can modify rooms
    if (user.role !== UserRole.PARENT) {
      return false;
    }

    return this.canAccessRoom(user, roomId);
  }

  async canControlDevices(user: User, roomId: string): Promise<boolean> {
    // Check basic room access
    const hasAccess = await this.canAccessRoom(user, roomId);
    if (!hasAccess) {
      return false;
    }

    // Parents can control all household devices
    if (user.role === UserRole.PARENT) {
      return true;
    }

    // Children can control devices (assuming all children have access)
    // This can be extended with more granular permissions
    return user.role === UserRole.CHILD;
  }

  async getAccessibleRooms(user: User): Promise<string[]> {
    if (!user.isActive || !user.householdId) {
      return [];
    }

    const rooms = await this.roomRepository.find({
      where: {
        householdId: user.householdId,
        isActive: true,
      },
      select: ['id'],
    });

    return rooms.map(room => room.id);
  }
}
```

**Validation**:
- [ ] Room CRUD operations work correctly
- [ ] Access control is properly enforced
- [ ] Room status updates reflect device states
- [ ] Caching improves performance
- [ ] Error handling is comprehensive

### Task 3.3: MQTT Integration Service

**Objective**: Implement robust MQTT client for device communication

**Implementation Steps**:

1. **Enhanced MQTT Service**
```typescript
// src/modules/mqtt/services/mqtt.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { Subject, Observable } from 'rxjs';
import { DeviceMessageHandler } from '../handlers/device-message.handler';
import { ConnectionState } from '../enums/connection-state.enum';

@Injectable()
export class MQTTService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MQTTService.name);
  private client: mqtt.MqttClient;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageSubject = new Subject<MQTTMessage>();

  constructor(
    private readonly configService: ConfigService,
    private readonly messageHandler: DeviceMessageHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const brokerUrl = this.configService.get('mqtt.broker');
    const username = this.configService.get('mqtt.username');
    const password = this.configService.get('mqtt.password');

    if (!brokerUrl) {
      throw new Error('MQTT broker URL not configured');
    }

    return new Promise((resolve, reject) => {
      this.logger.log(`Connecting to MQTT broker: ${brokerUrl}`);

      this.client = mqtt.connect(brokerUrl, {
        username,
        password,
        reconnectPeriod: 0, // Manual reconnection handling
        connectTimeout: 30000,
        keepalive: 60,
        clean: true,
        clientId: `nest-backend-${Date.now()}`,
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to MQTT broker successfully');
        this.connectionState = ConnectionState.CONNECTED;
        this.reconnectAttempts = 0;
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('error', (error) => {
        this.logger.error('MQTT connection error', error);
        this.connectionState = ConnectionState.ERROR;
        reject(error);
      });

      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline');
        this.connectionState = ConnectionState.DISCONNECTED;
        this.scheduleReconnect();
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('close', () => {
        this.logger.warn('MQTT connection closed');
        this.connectionState = ConnectionState.DISCONNECTED;
      });
    });
  }

  private async disconnect(): Promise<void> {
    if (this.client && this.connectionState === ConnectionState.CONNECTED) {
      return new Promise((resolve) => {
        this.client.end(false, {}, () => {
          this.logger.log('Disconnected from MQTT broker');
          this.connectionState = ConnectionState.DISCONNECTED;
          resolve();
        });
      });
    }
  }

  private async subscribeToTopics(): Promise<void> {
    const topics = [
      { topic: 'mitsubishi2mqtt/+/+', qos: 1 }, // All mitsubishi2mqtt topics
    ];

    for (const { topic, qos } of topics) {
      await this.subscribe(topic, qos);
    }
  }

  private async subscribe(topic: string, qos: mqtt.QoS = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to topic: ${topic}`, error);
          reject(error);
        } else {
          this.logger.log(`Subscribed to topic: ${topic} with QoS: ${qos}`);
          resolve();
        }
      });
    });
  }

  async publish(topic: string, payload: string | Buffer, options?: mqtt.IClientPublishOptions): Promise<void> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('MQTT client not connected');
    }

    const publishOptions: mqtt.IClientPublishOptions = {
      qos: 1,
      retain: false,
      ...options,
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, publishOptions, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to topic: ${topic}`, error);
          reject(error);
        } else {
          this.logger.debug(`Published to topic: ${topic}`, { payload: payload.toString() });
          resolve();
        }
      });
    });
  }

  async publishCommand(roomId: string, command: string, value: any): Promise<void> {
    const topic = this.buildCommandTopic(roomId, command);
    const payload = this.buildCommandPayload(command, value);

    await this.publish(topic, JSON.stringify(payload), { retain: false });
  }

  private buildCommandTopic(roomId: string, command: string): string {
    return `mitsubishi2mqtt/${roomId}/${command}`;
  }

  private buildCommandPayload(command: string, value: any): any {
    const basePayload = { timestamp: new Date().toISOString() };

    switch (command) {
      case 'power/set':
        return { ...basePayload, power: value };
      case 'temp/set':
        return { ...basePayload, temperature: value };
      case 'mode/set':
        return { ...basePayload, mode: value };
      case 'fan/set':
        return { ...basePayload, fan: value };
      case 'vane/set':
        return { ...basePayload, vane: value };
      case 'wideVane/set':
        return { ...basePayload, wideVane: value };
      default:
        return { ...basePayload, [command]: value };
    }
  }

  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = this.parseMessage(topic, payload);
      this.messageSubject.next(message);
      this.messageHandler.handle(message);
    } catch (error) {
      this.logger.error(`Failed to handle message from topic: ${topic}`, error);
    }
  }

  private parseMessage(topic: string, payload: Buffer): MQTTMessage {
    const topicParts = topic.split('/');

    if (topicParts.length < 3) {
      throw new Error(`Invalid topic format: ${topic}`);
    }

    const roomId = topicParts[1];
    const messageType = topicParts[2];

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload.toString());
    } catch {
      // If JSON parsing fails, use raw string
      parsedPayload = payload.toString();
    }

    return {
      topic,
      roomId,
      messageType,
      payload: parsedPayload,
      rawPayload: payload.toString(),
      timestamp: new Date(),
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
    this.reconnectAttempts++;

    this.logger.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.connectionState === ConnectionState.DISCONNECTED) {
        this.connect().catch((error) => {
          this.logger.error('Reconnection failed', error);
        });
      }
    }, delay);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  getMessageStream(): Observable<MQTTMessage> {
    return this.messageSubject.asObservable();
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected();
  }
}

export interface MQTTMessage {
  topic: string;
  roomId: string;
  messageType: string;
  payload: any;
  rawPayload: string;
  timestamp: Date;
}

enum ConnectionState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}
```

2. **Device Message Handler**
```typescript
// src/modules/mqtt/handlers/device-message.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { DeviceMessageProcessor } from '../processors/device-message.processor';
import { MQTTMessage } from '../services/mqtt.service';

@Injectable()
export class DeviceMessageHandler {
  private readonly logger = new Logger(DeviceMessageHandler.name);

  constructor(private readonly messageProcessor: DeviceMessageProcessor) {}

  async handle(message: MQTTMessage): Promise<void> {
    try {
      this.logger.debug(`Processing message from topic: ${message.topic}`, {
        roomId: message.roomId,
        messageType: message.messageType,
      });

      switch (message.messageType) {
        case 'power':
        case 'temp':
        case 'mode':
        case 'fan':
        case 'vane':
        case 'wideVane':
          await this.handleStatusMessage(message);
          break;

        case 'status':
        case 'settings':
          await this.handleDeviceStateMessage(message);
          break;

        default:
          this.logger.warn(`Unknown message type: ${message.messageType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle message`, error, { message });
    }
  }

  private async handleStatusMessage(message: MQTTMessage): Promise<void> {
    // This is a status update for a specific device property
    await this.messageProcessor.processStatusUpdate(message);
  }

  private async handleDeviceStateMessage(message: MQTTMessage): Promise<void> {
    // This is a complete device state or settings update
    await this.messageProcessor.processDeviceState(message);
  }
}
```

3. **Device Message Processor**
```typescript
// src/modules/mqtt/processors/device-message.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../devices/entities/device.entity';
import { DeviceService } from '../../devices/services/device.service';
import { MQTTMessage } from '../services/mqtt.service';

@Injectable()
export class DeviceMessageProcessor {
  private readonly logger = new Logger(DeviceMessageProcessor.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly deviceService: DeviceService,
  ) {}

  async processStatusUpdate(message: MQTTMessage): Promise<void> {
    // Find device by room ID (assuming one device per room for now)
    const device = await this.findDeviceByRoomId(message.roomId);
    if (!device) {
      this.logger.warn(`No device found for room: ${message.roomId}`);
      return;
    }

    // Update device state
    const updatedState = await this.updateDeviceState(device, message);

    if (updatedState) {
      this.logger.debug(`Updated device state for ${device.id}`, { state: updatedState });
    }
  }

  async processDeviceState(message: MQTTMessage): Promise<void> {
    const device = await this.findDeviceByRoomId(message.roomId);
    if (!device) {
      this.logger.warn(`No device found for room: ${message.roomId}`);
      return;
    }

    // Update complete device state
    if (message.messageType === 'status') {
      await this.updateDeviceStatus(device, message.payload);
    } else if (message.messageType === 'settings') {
      await this.updateDeviceSettings(device, message.payload);
    }
  }

  private async findDeviceByRoomId(roomId: string): Promise<Device | null> {
    return this.deviceRepository.findOne({
      where: { roomId, isActive: true },
      order: { createdAt: 'ASC' }, // Get first device
    });
  }

  private async updateDeviceState(device: Device, message: MQTTMessage): Promise<boolean> {
    const currentState = device.currentState || {};
    let updated = false;

    // Update specific state based on message type
    switch (message.messageType) {
      case 'power':
        if (currentState.power !== message.payload.power) {
          currentState.power = message.payload.power;
          updated = true;
        }
        break;

      case 'temp':
        if (currentState.temperature !== message.payload.temperature) {
          currentState.temperature = message.payload.temperature;
          updated = true;
        }
        break;

      case 'mode':
        if (currentState.mode !== message.payload.mode) {
          currentState.mode = message.payload.mode;
          updated = true;
        }
        break;

      case 'fan':
        if (currentState.fanSpeed !== message.payload.fan) {
          currentState.fanSpeed = message.payload.fan;
          updated = true;
        }
        break;

      case 'vane':
        if (currentState.vane !== message.payload.vane) {
          currentState.vane = message.payload.vane;
          updated = true;
        }
        break;

      case 'wideVane':
        if (currentState.wideVane !== message.payload.wideVane) {
          currentState.wideVane = message.payload.wideVane;
          updated = true;
        }
        break;
    }

    if (updated) {
      currentState.lastUpdate = new Date();
      device.currentState = currentState;
      device.lastSeen = new Date();

      await this.deviceRepository.save(device);
      await this.deviceService.notifyStatusChange(device.id, device.currentState);
    }

    return updated;
  }

  private async updateDeviceStatus(device: Device, statusData: any): Promise<void> {
    // Update device with complete status information
    device.currentState = {
      ...device.currentState,
      ...statusData,
      lastUpdate: new Date(),
    };

    device.lastSeen = new Date();
    device.isOnline = true;

    await this.deviceRepository.save(device);
    await this.deviceService.notifyStatusChange(device.id, device.currentState);
  }

  private async updateDeviceSettings(device: Device, settingsData: any): Promise<void> {
    // Update device settings
    device.settings = {
      ...device.settings,
      ...settingsData,
    };

    device.lastSeen = new Date();
    device.isOnline = true;

    await this.deviceRepository.save(device);
    await this.deviceService.notifySettingsChange(device.id, device.settings);
  }
}
```

**Validation**:
- [ ] MQTT connection establishes successfully
- [ ] Topic subscription works correctly
- [ ] Message parsing handles various formats
- [ ] Connection resilience functions properly
- [ ] Error handling prevents crashes

### Task 3.4: Device Control Service

**Objective**: Implement device control with validation and command processing

**Implementation Steps**:

1. **Device Service**
```typescript
// src/modules/devices/services/device.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceCommandDto } from '../dto/device-command.dto';
import { DeviceStatus } from '../enums/device-type.enum';
import { MQTTService } from '../../mqtt/services/mqtt.service';
import { RoomAccessService } from '../../rooms/services/room-access.service';
import { DeviceCommandProcessor } from './device-command-processor.service';
import { DeviceStatusEmitter } from './device-status-emitter.service';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly mqttService: MQTTService,
    private readonly roomAccessService: RoomAccessService,
    private readonly commandProcessor: DeviceCommandProcessor,
    private readonly statusEmitter: DeviceStatusEmitter,
  ) {}

  async createDevice(createDeviceDto: CreateDeviceDto, user: any): Promise<Device> {
    // Validate room access
    const canAccess = await this.roomAccessService.canModifyRoom(user, createDeviceDto.roomId);
    if (!canAccess) {
      throw new ForbiddenException('Access denied to this room');
    }

    // Check if device name already exists in room
    const existingDevice = await this.deviceRepository.findOne({
      where: {
        roomId: createDeviceDto.roomId,
        name: createDeviceDto.name.trim(),
        isActive: true,
      },
    });

    if (existingDevice) {
      throw new BadRequestException('Device with this name already exists in this room');
    }

    // Create device
    const device = this.deviceRepository.create({
      name: createDeviceDto.name.trim(),
      type: createDeviceDto.type,
      roomId: createDeviceDto.roomId,
      status: DeviceStatus.OFFLINE,
      isActive: true,
      isOnline: false,
      settings: this.getDefaultSettings(createDeviceDto.type),
      currentState: this.getDefaultState(),
      capabilities: this.getDefaultCapabilities(createDeviceDto.type),
    });

    const savedDevice = await this.deviceRepository.save(device);

    // Update room device count
    await this.updateRoomDeviceCount(createDeviceDto.roomId);

    return savedDevice;
  }

  async getDevicesForRoom(roomId: string, user: any): Promise<Device[]> {
    // Validate room access
    const canAccess = await this.roomAccessService.canAccessRoom(user, roomId);
    if (!canAccess) {
      throw new ForbiddenException('Access denied to this room');
    }

    return this.deviceRepository.find({
      where: {
        roomId,
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  async getDeviceById(deviceId: string, user: any): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: {
        id: deviceId,
        isActive: true,
      },
      relations: ['room'],
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Validate room access
    const canAccess = await this.roomAccessService.canAccessRoom(user, device.roomId);
    if (!canAccess) {
      throw new ForbiddenException('Access denied to this device');
    }

    return device;
  }

  async controlDevice(deviceId: string, commandDto: DeviceCommandDto, user: any): Promise<any> {
    const device = await this.getDeviceById(deviceId, user);

    // Validate device can be controlled
    if (!device.isControllable) {
      throw new BadRequestException('Device is not currently controllable');
    }

    // Validate user can control devices in this room
    const canControl = await this.roomAccessService.canControlDevices(user, device.roomId);
    if (!canControl) {
      throw new ForbiddenException('You cannot control devices in this room');
    }

    // Process command
    return this.commandProcessor.processCommand(device, commandDto);
  }

  async updateDeviceSettings(deviceId: string, settings: any, user: any): Promise<Device> {
    const device = await this.getDeviceById(deviceId, user);

    // Validate user can modify devices in this room
    const canModify = await this.roomAccessService.canModifyRoom(user, device.roomId);
    if (!canModify) {
      throw new ForbiddenException('Only parents can modify device settings');
    }

    // Update device settings
    device.settings = { ...device.settings, ...settings };
    const updatedDevice = await this.deviceRepository.save(device);

    // Notify about settings change
    await this.notifySettingsChange(deviceId, device.settings);

    return updatedDevice;
  }

  async deleteDevice(deviceId: string, user: any): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, isActive: true },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Validate user can modify devices in this room
    const canModify = await this.roomAccessService.canModifyRoom(user, device.roomId);
    if (!canModify) {
      throw new ForbiddenException('Only parents can delete devices');
    }

    // Soft delete device
    device.isActive = false;
    await this.deviceRepository.save(device);

    // Update room device count
    await this.updateRoomDeviceCount(device.roomId);
  }

  async notifyStatusChange(deviceId: string, currentState: any): Promise<void> {
    this.statusEmitter.emitStatusChange(deviceId, currentState);
  }

  async notifySettingsChange(deviceId: string, settings: any): Promise<void> {
    this.statusEmitter.emitSettingsChange(deviceId, settings);
  }

  private getDefaultSettings(deviceType: string): any {
    switch (deviceType) {
      case 'airconditioner':
        return {
          temperature: 22,
          mode: 'off',
          fanSpeed: 'auto',
          vane: 'auto',
          wideVane: 'auto',
        };
      default:
        return {};
    }
  }

  private getDefaultState(): any {
    return {
      power: false,
      temperature: 22,
      mode: 'off',
      fanSpeed: 'auto',
      vane: 'auto',
      wideVane: 'auto',
      lastUpdate: new Date(),
    };
  }

  private getDefaultCapabilities(deviceType: string): any {
    switch (deviceType) {
      case 'airconditioner':
        return {
          supportedModes: ['off', 'heat_cool', 'cool', 'dry', 'heat', 'fan_only'],
          temperatureRange: { min: 16, max: 31 },
          supportedFanSpeeds: ['AUTO', '1', '2', '3', '4', 'QUIET'],
          supportedVanes: ['AUTO', '1', '2', '3', '4', '5', 'SWING'],
          supportedWideVanes: ['<<', '<', '||', '|', '>>', 'SWING'],
        };
      default:
        return {};
    }
  }

  private async updateRoomDeviceCount(roomId: string): Promise<void> {
    const deviceCount = await this.deviceRepository.count({
      where: { roomId, isActive: true },
    });

    await this.deviceRepository.manager.query(
      'UPDATE rooms SET device_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [deviceCount, roomId]
    );
  }
}
```

2. **Device Command Processor**
```typescript
// src/modules/devices/services/device-command-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Device } from '../entities/device.entity';
import { DeviceCommandDto } from '../dto/device-command.dto';
import { MQTTService } from '../../mqtt/services/mqtt.service';
import { DeviceCommand } from '../entities/device-command.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandStatus, CommandType } from '../enums/command.enum';

@Injectable()
export class DeviceCommandProcessor {
  private readonly logger = new Logger(DeviceCommandProcessor.name);

  constructor(
    private readonly mqttService: MQTTService,
    @InjectRepository(DeviceCommand)
    private readonly commandRepository: Repository<DeviceCommand>,
  ) {}

  async processCommand(device: Device, commandDto: DeviceCommandDto): Promise<any> {
    // Validate command
    const validationResult = this.validateCommand(device, commandDto);
    if (!validationResult.isValid) {
      throw new Error(`Invalid command: ${validationResult.errors.join(', ')}`);
    }

    // Create command record
    const command = this.commandRepository.create({
      deviceId: device.id,
      type: this.getCommandType(commandDto.command),
      payload: commandDto,
      status: CommandStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
    });

    const savedCommand = await this.commandRepository.save(command);

    // Execute command via MQTT
    try {
      await this.executeCommand(device, commandDto, savedCommand);

      // Update command status
      savedCommand.status = CommandStatus.EXECUTING;
      savedCommand.executedAt = new Date();
      await this.commandRepository.save(savedCommand);

      return {
        commandId: savedCommand.id,
        status: 'executed',
        message: 'Command sent to device',
      };
    } catch (error) {
      // Update command status to failed
      savedCommand.status = CommandStatus.FAILED;
      savedCommand.errorMessage = error.message;
      savedCommand.completedAt = new Date();
      await this.commandRepository.save(savedCommand);

      throw error;
    }
  }

  private validateCommand(device: Device, commandDto: DeviceCommandDto): ValidationResult {
    const errors: string[] = [];

    switch (commandDto.command) {
      case 'SET_TEMPERATURE':
        if (commandDto.value < 16 || commandDto.value > 31) {
          errors.push('Temperature must be between 16°C and 31°C');
        }
        break;

      case 'SET_MODE':
        const validModes = device.capabilities?.supportedModes || [];
        if (!validModes.includes(commandDto.value)) {
          errors.push(`Invalid mode. Supported modes: ${validModes.join(', ')}`);
        }
        break;

      case 'SET_FAN_SPEED':
        const validFanSpeeds = device.capabilities?.supportedFanSpeeds || [];
        if (!validFanSpeeds.includes(commandDto.value)) {
          errors.push(`Invalid fan speed. Supported speeds: ${validFanSpeeds.join(', ')}`);
        }
        break;

      case 'SET_VANE':
        const validVanes = device.capabilities?.supportedVanes || [];
        if (!validVanes.includes(commandDto.value)) {
          errors.push(`Invalid vane position. Supported positions: ${validVanes.join(', ')}`);
        }
        break;

      case 'SET_WIDEVANE':
        const validWideVanes = device.capabilities?.supportedWideVanes || [];
        if (!validWideVanes.includes(commandDto.value)) {
          errors.push(`Invalid wide vane position. Supported positions: ${validWideVanes.join(', ')}`);
        }
        break;

      case 'SET_POWER':
        if (typeof commandDto.value !== 'boolean') {
          errors.push('Power value must be boolean');
        }
        break;

      default:
        errors.push(`Unknown command: ${commandDto.command}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getCommandType(command: string): CommandType {
    switch (command) {
      case 'SET_POWER': return CommandType.SET_POWER;
      case 'SET_TEMPERATURE': return CommandType.SET_TEMPERATURE;
      case 'SET_MODE': return CommandType.SET_MODE;
      case 'SET_FAN_SPEED': return CommandType.SET_FAN;
      case 'SET_VANE': return CommandType.SET_VANE;
      case 'SET_WIDEVANE': return CommandType.SET_WIDEVANE;
      default: throw new Error(`Unknown command type: ${command}`);
    }
  }

  private async executeCommand(device: Device, commandDto: DeviceCommandDto, command: DeviceCommand): Promise<void> {
    const mqttCommand = this.mapToMQTTCommand(commandDto.command);

    await this.mqttService.publishCommand(
      device.roomId,
      mqttCommand,
      commandDto.value
    );

    this.logger.debug(`Command sent via MQTT`, {
      deviceId: device.id,
      command: commandDto.command,
      value: commandDto.value,
    });
  }

  private mapToMQTTCommand(command: string): string {
    const commandMap = {
      'SET_POWER': 'power/set',
      'SET_TEMPERATURE': 'temp/set',
      'SET_MODE': 'mode/set',
      'SET_FAN_SPEED': 'fan/set',
      'SET_VANE': 'vane/set',
      'SET_WIDEVANE': 'wideVane/set',
    };

    return commandMap[command] || command.toLowerCase();
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

**Validation**:
- [ ] Device control commands are validated properly
- [ ] MQTT commands are sent correctly
- [ ] Command history is maintained
- [ ] Error handling works for failed commands
- [ ] Access control is enforced

### Task 3.5: Controllers and DTOs

**Objective**: Implement REST endpoints for room and device management

**Implementation Steps**:

1. **Room Controllers**
```typescript
// src/modules/rooms/rooms.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoomService } from './services/room.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Room created successfully', type: Room })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Req() req: Request,
  ): Promise<Room> {
    return this.roomService.createRoom(createRoomDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rooms for authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rooms retrieved successfully', type: [Room] })
  async getRooms(@Req() req: Request): Promise<Room[]> {
    return this.roomService.getRoomsForUser(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Room retrieved successfully', type: Room })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Room not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getRoom(@Param('id') id: string, @Req() req: Request): Promise<Room> {
    return this.roomService.getRoomById(id, req.user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update room' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Room updated successfully', type: Room })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Room not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async updateRoom(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Req() req: Request,
  ): Promise<Room> {
    return this.roomService.updateRoom(id, updateRoomDto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete room' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Room deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Room not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Room has active devices' })
  async deleteRoom(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.roomService.deleteRoom(id, req.user);
  }
}
```

2. **Device Controllers**
```typescript
// src/modules/devices/devices.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DeviceService } from './services/device.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceCommandDto } from './dto/device-command.dto';
import { Device } from './entities/device.entity';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new device' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Device created successfully', type: Device })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async createDevice(
    @Body() createDeviceDto: CreateDeviceDto,
    @Req() req: Request,
  ): Promise<Device> {
    return this.deviceService.createDevice(createDeviceDto, req.user);
  }

  @Get('room/:roomId')
  @ApiOperation({ summary: 'Get devices for a specific room' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Devices retrieved successfully', type: [Device] })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getDevicesForRoom(
    @Param('roomId') roomId: string,
    @Req() req: Request,
  ): Promise<Device[]> {
    return this.deviceService.getDevicesForRoom(roomId, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Device retrieved successfully', type: Device })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Device not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getDevice(@Param('id') id: string, @Req() req: Request): Promise<Device> {
    return this.deviceService.getDeviceById(id, req.user);
  }

  @Post(':id/control')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Control device' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Command sent successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Device not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid command or device not controllable' })
  async controlDevice(
    @Param('id') id: string,
    @Body() commandDto: DeviceCommandDto,
    @Req() req: Request,
  ): Promise<any> {
    return this.deviceService.controlDevice(id, commandDto, req.user);
  }

  @Put(':id/settings')
  @ApiOperation({ summary: 'Update device settings' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Settings updated successfully', type: Device })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Device not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async updateDeviceSettings(
    @Param('id') id: string,
    @Body() settings: any,
    @Req() req: Request,
  ): Promise<Device> {
    return this.deviceService.updateDeviceSettings(id, settings, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete device' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Device deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Device not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async deleteDevice(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.deviceService.deleteDevice(id, req.user);
  }
}
```

**Validation**:
- [ ] All REST endpoints work correctly
- [ ] Input validation prevents invalid data
- [ ] API responses match Spring Boot format
- [ ] Access control is enforced on all endpoints
- [ ] Error responses are properly formatted

## Quality Gates and Validation Criteria

### Functional Validation
- [ ] Room management CRUD operations work correctly
- [ ] Device discovery and registration functions properly
- [ ] AC device control commands work within specifications
- [ ] Real-time status updates are accurate and timely
- [ ] Device settings management is reliable
- [ ] Room access control prevents unauthorized access
- [ ] MQTT communication is reliable and performant

### Performance Validation
- [ ] Room operations <100ms response time
- [ ] Device control commands <2s completion
- [ ] Status updates <1s latency
- [ ] MQTT message processing <50ms
- [ ] System handles target load without degradation

### Security Validation
- [ ] Room-based access control enforced
- [ ] Device control requires proper authorization
- [ ] Cross-household access prevented
- [ ] All access attempts are logged
- [ ] Security requirements are satisfied

### Integration Validation
- [ ] MQTT integration works correctly
- [ ] Database operations function properly
- [ ] Authentication integration works
- [ ] Real-time updates function correctly
- [ ] Frontend compatibility maintained

### Code Quality Validation
- [ ] TypeScript compilation succeeds without errors
- [ ] ESLint passes without warnings
- [ ] Test coverage >95%
- [ ] Code follows clean code principles
- [ ] Documentation is comprehensive

This Phase 3 implementation provides a robust, real-time room management and device control system that maintains complete functional equivalence with the Spring Boot backend while following NestJS best practices and clean code principles.