# Phase 3: Room Management and Device Control - Technical Design Document

## System Architecture Overview

### Room and Device Management Architecture
The room and device management system follows a real-time event-driven architecture with clear separation of concerns:

```
Room and Device Management Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Controllers Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ RoomController  │  │ DeviceController │  │ StatusCtrl   │ │
│  │ - room CRUD     │  │ - device ctrl    │  │ - status API │ │
│  │ - listing       │  │ - discovery      │  │ - monitoring │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ RoomService     │  │ DeviceService   │  │ StatusSvc    │ │
│  │ - room mgmt     │  │ - device ctrl    │  │ - state sync │ │
│  │ - access ctrl   │  │ - MQTT comm     │  │ - events     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                 MQTT & Real-time Layer                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ MQTTClient      │  │ DeviceManager   │  │ EventBroker  │ │
│  │ - connection    │  │ - discovery     │  │ - broadcast   │ │
│  │ - topics        │  │ - registration  │  │ - routing    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  Repository Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ RoomRepository  │  │ DeviceRepo      │  │ StatusRepo   │ │
│  │ - room CRUD     │  │ - device CRUD   │  │ - status data│ │
│  │ - queries       │  │ - state mgmt    │  │ - history    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Clean Code Principles Analysis

### DRY (Don't Repeat Yourself) Implementation

**Current Duplication Risks Identified**:
- MQTT message parsing across different device types
- Device validation logic in multiple services
- Room access control patterns repeated
- Error handling for device operations
- Status update broadcasting patterns

**DRY Solutions Design**:

1. **Shared MQTT Operations**
```typescript
// Common MQTT message handling patterns
export class MQTTOperations {
  static parseDeviceMessage(topic: string, payload: Buffer): DeviceMessage {
    // Standardized message parsing
  }

  static validateDeviceCommand(command: DeviceCommand): ValidationResult {
    // Common validation logic
  }

  static formatTopic(roomId: string, deviceType: string, command: string): string {
    // Standardized topic formatting
  }
}
```

2. **Common Device Validation**
```typescript
// Centralized device validation factory
export class DeviceValidationFactory {
  static getValidator(deviceType: DeviceType): DeviceValidator {
    switch (deviceType) {
      case 'airconditioner': return new AirConditionerValidator();
      // Future device types
      default: throw new Error(`Unsupported device type: ${deviceType}`);
    }
  }
}
```

3. **Standardized Room Access Control**
```typescript
// Reusable room access control logic
export class RoomAccessControl {
  static async validateAccess(user: User, roomId: string, operation: RoomOperation): Promise<boolean> {
    // Centralized access validation logic
  }

  static async checkOwnership(user: User, roomId: string): Promise<boolean> {
    // Ownership validation logic
  }
}
```

### SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
**Module Separation**:
- **RoomModule**: Room CRUD operations and access control
- **DeviceModule**: Device discovery, registration, and control
- **MQTTModule**: MQTT communication and topic management
- **StatusModule**: Real-time status management and event broadcasting

#### Open/Closed Principle (OCP)
**Extension Strategy**:
- **Device Strategies**: Different control strategies for device types
- **Room Validators**: Extensible room validation rules
- **Status Providers**: Multiple status update mechanisms
- **Command Processors**: Extensible command processing

#### Liskov Substitution Principle (LSP)
**Inheritance Design**:
- **BaseDevice**: Common device properties and methods
- **AirConditionerDevice**: Extended device with AC-specific functionality
- **DeviceController**: Interchangeable device control implementations

#### Interface Segregation Principle (ISP)
**Focused Interfaces**:
- **IRoomService**: Room operations only
- **IDeviceService**: Device operations only
- **IMQTTService**: MQTT operations only
- **IStatusService**: Status management only

#### Dependency Inversion Principle (DIP)
**Dependency Management**:
- Services depend on interfaces, not concrete implementations
- Repository pattern for data access abstraction
- MQTT client abstraction for testing
- Provider pattern for service instantiation

### YAGNI (You Ain't Gonna Need It) Implementation

**Implementation Boundaries**:
- Implement only AC device control (current requirement)
- Skip other device types (lights, sensors, etc.) unless specified
- Basic room management without advanced features
- MQTT integration only for mitsubishi2mqtt compatibility
- Simple status management without complex analytics

## Design Pattern Analysis and Selection

### Room and Device Pattern Selection Matrix

| Pattern | Complexity | Performance | Maintainability | Scalability | Extensibility | Score | Decision |
|---------|------------|-------------|-----------------|-------------|---------------|-------|----------|
| Observer | 3 | 5 | 4 | 4 | 5 | 4.2 | ✅ Adopt |
| Strategy | 3 | 4 | 5 | 4 | 5 | 4.2 | ✅ Adopt |
| Repository | 2 | 5 | 5 | 5 | 3 | 4.0 | ✅ Adopt |
| Factory | 3 | 4 | 4 | 4 | 5 | 4.0 | ✅ Adopt |
| Command | 4 | 3 | 4 | 3 | 4 | 3.6 | ✅ Adopt |
| Facade | 2 | 4 | 5 | 4 | 3 | 3.6 | ✅ Adopt |
| Adapter | 3 | 4 | 3 | 3 | 4 | 3.4 | ✅ Adopt |
| Proxy | 3 | 3 | 4 | 4 | 4 | 3.6 | ✅ Adopt |

### Selected Design Patterns Implementation

#### 1. Observer Pattern - Real-time Status Updates
**Purpose**: Real-time device status change notifications
**Implementation**:
```typescript
interface DeviceStatusObserver {
  onStatusChange(deviceId: string, status: DeviceStatus): void;
  onConnectionChange(deviceId: string, isConnected: boolean): void;
  onSettingsChange(deviceId: string, settings: DeviceSettings): void;
}

export class DeviceStatusEmitter {
  private observers: DeviceStatusObserver[] = [];

  subscribe(observer: DeviceStatusObserver): void {
    this.observers.push(observer);
  }

  unsubscribe(observer: DeviceStatusObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  emitStatusChange(deviceId: string, status: DeviceStatus): void {
    this.observers.forEach(observer => observer.onStatusChange(deviceId, status));
  }

  emitConnectionChange(deviceId: string, isConnected: boolean): void {
    this.observers.forEach(observer => observer.onConnectionChange(deviceId, isConnected));
  }
}
```

#### 2. Strategy Pattern - Device Control Strategies
**Purpose**: Different control strategies for various device types
**Implementation**:
```typescript
interface DeviceControlStrategy {
  validateCommand(command: DeviceCommand): ValidationResult;
  executeCommand(device: Device, command: DeviceCommand): Promise<CommandResult>;
  getSupportedCommands(): string[];
}

class AirConditionerControlStrategy implements DeviceControlStrategy {
  validateCommand(command: DeviceCommand): ValidationResult {
    // AC-specific command validation
    switch (command.type) {
      case 'SET_TEMPERATURE':
        return this.validateTemperature(command.value);
      case 'SET_MODE':
        return this.validateMode(command.value);
      // Other command types
    }
  }

  async executeCommand(device: Device, command: DeviceCommand): Promise<CommandResult> {
    // AC-specific command execution via MQTT
    const topic = this.buildTopic(device.roomId, device.id, command.type);
    const payload = this.buildPayload(command);

    return this.mqttService.publish(topic, payload);
  }

  private validateTemperature(temp: number): ValidationResult {
    if (temp < 16 || temp > 31) {
      return { isValid: false, errors: ['Temperature must be between 16°C and 31°C'] };
    }
    return { isValid: true };
  }
}
```

#### 3. Repository Pattern - Data Access Abstraction
**Purpose**: Clean separation between business logic and data access
**Implementation**:
```typescript
interface IRoomRepository {
  findById(id: string): Promise<Room | null>;
  findByHousehold(householdId: string): Promise<Room[]>;
  create(roomData: CreateRoomDto): Promise<Room>;
  update(id: string, updates: UpdateRoomDto): Promise<Room>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: RoomStatus): Promise<void>;
}

interface IDeviceRepository {
  findById(id: string): Promise<Device | null>;
  findByRoom(roomId: string): Promise<Device[]>;
  create(deviceData: CreateDeviceDto): Promise<Device>;
  update(id: string, updates: UpdateDeviceDto): Promise<Device>;
  updateStatus(id: string, status: DeviceStatus): Promise<void>;
  updateSettings(id: string, settings: DeviceSettings): Promise<void>;
}
```

#### 4. Factory Pattern - Device Creation and Configuration
**Purpose**: Centralized device object creation with proper initialization
**Implementation**:
```typescript
export class DeviceFactory {
  static createDevice(deviceData: CreateDeviceDto, roomId: string): Device {
    const device = new Device();
    device.id = uuidv4();
    device.roomId = roomId;
    device.type = deviceData.type;
    device.name = deviceData.name;
    device.isActive = true;
    device.status = DeviceStatus.OFFLINE;
    device.settings = this.getDefaultSettings(deviceData.type);
    device.createdAt = new Date();
    device.updatedAt = new Date();
    return device;
  }

  static getDefaultSettings(deviceType: DeviceType): DeviceSettings {
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
        throw new Error(`Unknown device type: ${deviceType}`);
    }
  }
}
```

#### 5. Command Pattern - Device Command Processing
**Purpose**: Encapsulate device commands with queuing and retry logic
**Implementation**:
```typescript
interface DeviceCommand {
  id: string;
  deviceId: string;
  type: CommandType;
  value: any;
  timestamp: Date;
  retryCount?: number;
  maxRetries?: number;
}

export class DeviceCommandProcessor {
  private commandQueue: DeviceCommand[] = [];
  private processing = false;

  async enqueueCommand(command: DeviceCommand): Promise<void> {
    this.commandQueue.push(command);
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()!;

      try {
        await this.executeCommand(command);
      } catch (error) {
        await this.handleCommandError(command, error);
      }
    }

    this.processing = false;
  }

  private async executeCommand(command: DeviceCommand): Promise<void> {
    const device = await this.deviceService.findById(command.deviceId);
    if (!device) {
      throw new Error(`Device not found: ${command.deviceId}`);
    }

    const strategy = this.deviceStrategyFactory.getStrategy(device.type);
    const result = await strategy.executeCommand(device, command);

    if (!result.success) {
      throw new Error(`Command execution failed: ${result.error}`);
    }
  }

  private async handleCommandError(command: DeviceCommand, error: Error): Promise<void> {
    command.retryCount = (command.retryCount || 0) + 1;

    if (command.retryCount < (command.maxRetries || 3)) {
      // Retry after delay
      setTimeout(() => {
        this.commandQueue.unshift(command);
        if (!this.processing) {
          this.processQueue();
        }
      }, 1000 * command.retryCount);
    } else {
      // Log failed command
      this.logger.error(`Command failed after retries`, { command, error });
    }
  }
}
```

## Module Architecture Design

### Room Management Module Structure

```
src/modules/rooms/
├── rooms.module.ts                # Room management module
├── rooms.controller.ts            # Room management endpoints
├── rooms.service.ts               # Room management business logic
├── entities/                      # Database entities
│   ├── room.entity.ts            # Room entity definition
│   └── room-settings.entity.ts   # Room settings entity
├── repositories/                  # Data access layer
│   ├── room.repository.ts        # Room repository
│   └── room-settings.repository.ts # Settings repository
├── dto/                          # Data transfer objects
│   ├── create-room.dto.ts       # Room creation
│   ├── update-room.dto.ts       # Room updates
│   ├── room.dto.ts              # Room response
│   └── room-list.dto.ts         # Room listing response
├── guards/                       # Authorization guards
│   ├── room-access.guard.ts     # Room access control
│   └── room-ownership.guard.ts  # Room ownership validation
├── services/                     # Specialized services
│   ├── room-access.service.ts   # Access control logic
│   └── room-status.service.ts   # Room status management
└── events/                       # Room events
    ├── room-created.event.ts    # Room creation events
    ├── room-updated.event.ts    # Room update events
    └── room-deleted.event.ts    # Room deletion events
```

### Device Management Module Structure

```
src/modules/devices/
├── devices.module.ts              # Device management module
├── devices.controller.ts          # Device management endpoints
├── devices.service.ts             # Device management business logic
├── entities/                      # Database entities
│   ├── device.entity.ts          # Device entity definition
│   ├── device-settings.entity.ts # Device settings entity
│   └── device-status.entity.ts   # Device status entity
├── repositories/                  # Data access layer
│   ├── device.repository.ts      # Device repository
│   ├── device-settings.repository.ts # Settings repository
│   └── device-status.repository.ts # Status repository
├── dto/                          # Data transfer objects
│   ├── create-device.dto.ts     # Device creation
│   ├── update-device.dto.ts     # Device updates
│   ├── device-command.dto.ts    # Device commands
│   └── device.dto.ts            # Device response
├── strategies/                    # Device control strategies
│   ├── device-strategy.interface.ts # Strategy interface
│   ├── airconditioner.strategy.ts # AC control strategy
│   └── device-strategy.factory.ts # Strategy factory
├── services/                     # Specialized services
│   ├── device-discovery.service.ts # Device discovery
│   ├── device-control.service.ts  # Device control
│   └── device-status.service.ts   # Status management
└── observers/                    # Status observers
    ├── device-status.observer.ts # Status change observer
    └── mqtt-status.observer.ts   # MQTT status observer
```

### MQTT Integration Module Structure

```
src/modules/mqtt/
├── mqtt.module.ts                 # MQTT integration module
├── mqtt.service.ts                # MQTT client and communication
├── mqtt-client.service.ts         # Low-level MQTT client
├── topics/                        # Topic management
│   ├── topic-manager.service.ts  # Topic subscription/management
│   ├── topic-formatter.service.ts # Topic formatting utilities
│   └── topic-validator.service.ts # Topic validation
├── handlers/                      # Message handlers
│   ├── device-message.handler.ts # Device message handling
│   ├── status-message.handler.ts # Status message handling
│   └── command-message.handler.ts # Command message handling
├── serializers/                   # Message serialization
│   ├── message-serializer.interface.ts # Serializer interface
│   ├── json-serializer.ts        # JSON message serializer
│   └── protobuf-serializer.ts    # Protobuf serializer (future)
├── observers/                     # MQTT event observers
│   ├── connection.observer.ts    # Connection events
│   ├── message.observer.ts       # Message events
│   └── error.observer.ts         # Error events
└── types/                        # Type definitions
    ├── mqtt-message.types.ts     # Message types
    ├── topic.types.ts            # Topic types
    └── connection.types.ts       # Connection types
```

## MQTT Architecture Design

### Topic Structure Design
Following the existing mitsubishi2mqtt topic patterns:

```
Topic Structure:
mitsubishi2mqtt/{room_id}/{command_type}

Command Types:
- power/set          - Power control (on/off)
- temp/set           - Temperature control
- mode/set           - Mode control
- fan/set            - Fan speed control
- vane/set           - Vane control
- wideVane/set       - Wide vane control

Status Types:
- power              - Current power state
- temp               - Current temperature
- mode               - Current mode
- fan                - Current fan speed
- vane               - Current vane position
- wideVane           - Current wide vane position
- status             - Overall device status
- settings           - Complete device settings
```

### MQTT Client Implementation
```typescript
@Injectable()
export class MQTTClientService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor(
    private configService: ConfigService,
    private logger: Logger,
    private messageHandler: DeviceMessageHandler,
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

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(brokerUrl, {
        username,
        password,
        reconnectPeriod: 0, // Manual reconnection handling
        connectTimeout: 30000,
        keepalive: 60,
        clean: true,
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to MQTT broker');
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
      'mitsubishi2mqtt/+/power',
      'mitsubishi2mqtt/+/temp',
      'mitsubishi2mqtt/+/mode',
      'mitsubishi2mqtt/+/fan',
      'mitsubishi2mqtt/+/vane',
      'mitsubishi2mqtt/+/wideVane',
      'mitsubishi2mqtt/+/status',
      'mitsubishi2mqtt/+/settings',
    ];

    for (const topic of topics) {
      await this.subscribe(topic);
    }
  }

  private async subscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to topic: ${topic}`, error);
          reject(error);
        } else {
          this.logger.log(`Subscribed to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async publish(topic: string, payload: string | Buffer, options?: mqtt.IClientPublishOptions): Promise<void> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, options, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to topic: ${topic}`, error);
          reject(error);
        } else {
          this.logger.debug(`Published to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = this.parseMessage(topic, payload);
      this.messageHandler.handle(message);
    } catch (error) {
      this.logger.error(`Failed to handle message from topic: ${topic}`, error);
    }
  }

  private parseMessage(topic: string, payload: Buffer): MQTTMessage {
    const topicParts = topic.split('/');
    const roomId = topicParts[1];
    const messageType = topicParts[2];

    return {
      topic,
      roomId,
      messageType,
      payload: payload.toString(),
      timestamp: new Date(),
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
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
}

enum ConnectionState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}
```

## Data Architecture Design

### Database Schema Design

#### Room Entity
```typescript
@Entity('rooms')
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

  @OneToMany(() => Device, device => device.room)
  devices: Device[];

  // Computed properties
  get isOnline(): boolean {
    return this.onlineDeviceCount > 0;
  }

  get deviceStatus(): 'online' | 'offline' | 'mixed' {
    if (this.deviceCount === 0) return 'offline';
    return this.onlineDeviceCount === this.deviceCount ? 'online' : 'mixed';
  }
}

export enum RoomStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MIXED = 'mixed',
}

export interface RoomSettings {
  defaultTemperature?: number;
  defaultMode?: string;
  energySaving?: boolean;
  scheduleEnabled?: boolean;
}
```

#### Device Entity
```typescript
@Entity('devices')
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
}

export enum DeviceType {
  AIRCONDITIONER = 'airconditioner',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
}

export interface DeviceSettings {
  // Air Conditioner specific settings
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
  // Additional state properties
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

## Real-time Architecture Design

### Status Management System
```typescript
@Injectable()
export class DeviceStatusService implements DeviceStatusObserver {
  private statusCache = new Map<string, DeviceStatus>();
  private statusEmitter = new EventEmitter();

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly cacheService: CacheService,
    private readonly mqttService: MQTTClientService,
  ) {
    this.mqttService.subscribe(this);
  }

  async onStatusChange(deviceId: string, status: DeviceStatus): Promise<void> {
    // Update cache
    this.statusCache.set(deviceId, status);

    // Update database
    await this.deviceRepository.update(deviceId, {
      status,
      lastSeen: new Date(),
      isOnline: status === DeviceStatus.ONLINE,
    });

    // Update room status
    await this.updateRoomStatus(deviceId);

    // Broadcast to clients
    this.statusEmitter.emit('device:status:change', { deviceId, status });

    // Update cache
    await this.cacheService.setDeviceStatus(deviceId, status);
  }

  async onConnectionChange(deviceId: string, isConnected: boolean): Promise<void> {
    const status = isConnected ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
    await this.onStatusChange(deviceId, status);
  }

  async onSettingsChange(deviceId: string, settings: DeviceSettings): Promise<void> {
    // Update device settings in database
    await this.deviceRepository.update(deviceId, { settings });

    // Update cache
    await this.cacheService.setDeviceSettings(deviceId, settings);

    // Broadcast to clients
    this.statusEmitter.emit('device:settings:change', { deviceId, settings });
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    // Try cache first
    const cached = this.statusCache.get(deviceId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
      select: ['status', 'isOnline', 'lastSeen'],
    });

    if (device) {
      const status = device.isOnline ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
      this.statusCache.set(deviceId, status);
      return status;
    }

    return null;
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const devices = await this.deviceRepository.find({
      where: { roomId, isActive: true },
      select: ['id', 'isOnline', 'status'],
    });

    if (devices.length === 0) {
      return RoomStatus.OFFLINE;
    }

    const onlineCount = devices.filter(device => device.isOnline).length;

    if (onlineCount === 0) {
      return RoomStatus.OFFLINE;
    } else if (onlineCount === devices.length) {
      return RoomStatus.ONLINE;
    } else {
      return RoomStatus.MIXED;
    }
  }

  private async updateRoomStatus(deviceId: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });

    if (device?.room) {
      const roomStatus = await this.getRoomStatus(device.roomId);
      await this.deviceRepository.manager.update(Room, device.roomId, {
        status: roomStatus,
        onlineDeviceCount: await this.getOnlineDeviceCount(device.roomId),
      });
    }
  }

  private async getOnlineDeviceCount(roomId: string): Promise<number> {
    return this.deviceRepository.count({
      where: { roomId, isActive: true, isOnline: true },
    });
  }
}
```

### Event Broadcasting System
```typescript
@Injectable()
export class RoomEventBroadcaster implements DeviceStatusObserver {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async onStatusChange(deviceId: string, status: DeviceStatus): Promise<void> {
    const event = {
      type: 'device:status:change',
      deviceId,
      status,
      timestamp: new Date().toISOString(),
    };

    await this.broadcastEvent(event);
  }

  async onSettingsChange(deviceId: string, settings: DeviceSettings): Promise<void> {
    const event = {
      type: 'device:settings:change',
      deviceId,
      settings,
      timestamp: new Date().toISOString(),
    };

    await this.broadcastEvent(event);
  }

  private async broadcastEvent(event: RoomEvent): Promise<void> {
    try {
      // Publish to Redis for WebSocket clients
      await this.redis.publish('room:events', JSON.stringify(event));

      // Store recent events for recovery
      await this.redis.lpush('room:events:recent', JSON.stringify(event));
      await this.redis.ltrim('room:events:recent', 0, 99); // Keep last 100 events

      this.logger.debug(`Broadcasted event: ${event.type}`, { event });
    } catch (error) {
      this.logger.error('Failed to broadcast event', error);
    }
  }

  async getRecentEvents(limit: number = 50): Promise<RoomEvent[]> {
    try {
      const events = await this.redis.lrange('room:events:recent', 0, limit - 1);
      return events.map(event => JSON.parse(event));
    } catch (error) {
      this.logger.error('Failed to get recent events', error);
      return [];
    }
  }
}

interface RoomEvent {
  type: string;
  deviceId?: string;
  roomId?: string;
  status?: DeviceStatus;
  settings?: DeviceSettings;
  timestamp: string;
}
```

## Performance Architecture Design

### Caching Strategy
```typescript
@Injectable()
export class RoomCacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private getRoomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private getDeviceKey(deviceId: string): string {
    return `device:${deviceId}`;
  }

  private getRoomListKey(householdId: string): string {
    return `household:${householdId}:rooms`;
  }

  async cacheRoom(room: Room, ttl: number = 300): Promise<void> {
    const roomKey = this.getRoomKey(room.id);
    const roomJson = JSON.stringify(room);

    await Promise.all([
      this.redis.setex(roomKey, ttl, roomJson),
      this.updateRoomList(room.householdId, room.id),
    ]);
  }

  async getCachedRoom(roomId: string): Promise<Room | null> {
    const roomKey = this.getRoomKey(roomId);
    const roomJson = await this.redis.get(roomKey);

    if (!roomJson) {
      return null;
    }

    return JSON.parse(roomJson) as Room;
  }

  async cacheRoomList(householdId: string, rooms: Room[], ttl: number = 300): Promise<void> {
    const listKey = this.getRoomListKey(householdId);
    const roomIds = rooms.map(room => room.id);

    await Promise.all([
      this.redis.setex(listKey, ttl, JSON.stringify(roomIds)),
      ...rooms.map(room => this.cacheRoom(room, ttl)),
    ]);
  }

  async getCachedRoomList(householdId: string): Promise<string[] | null> {
    const listKey = this.getRoomListKey(householdId);
    const roomIdsJson = await this.redis.get(listKey);

    if (!roomIdsJson) {
      return null;
    }

    return JSON.parse(roomIdsJson) as string[];
  }

  async invalidateRoom(roomId: string, householdId: string): Promise<void> {
    const roomKey = this.getRoomKey(roomId);
    const listKey = this.getRoomListKey(householdId);

    await Promise.all([
      this.redis.del(roomKey),
      this.redis.del(listKey),
    ]);
  }

  private async updateRoomList(householdId: string, roomId: string): Promise<void> {
    const listKey = this.getRoomListKey(householdId);
    const currentList = await this.redis.lrange(listKey, 0, -1);

    if (!currentList.includes(roomId)) {
      await this.redis.lpush(listKey, roomId);
      await this.redis.expire(listKey, 300); // 5 minutes
    }
  }
}
```

### Database Query Optimization
```typescript
@Injectable()
export class RoomRepository extends Repository<Room> {
  async findWithDevices(roomId: string): Promise<Room | null> {
    return this.createQueryBuilder('room')
      .leftJoinAndSelect('room.devices', 'device')
      .where('room.id = :roomId', { roomId })
      .cache(300) // Cache for 5 minutes
      .getOne();
  }

  async findByHouseholdWithStats(householdId: string): Promise<RoomWithStats[]> {
    return this.createQueryBuilder('room')
      .leftJoin('room.devices', 'device')
      .select([
        'room.id',
        'room.name',
        'room.description',
        'room.status',
        'room.createdAt',
        'room.updatedAt',
        'COUNT(device.id) as deviceCount',
        'SUM(CASE WHEN device.isOnline = true THEN 1 ELSE 0 END) as onlineDeviceCount',
      ])
      .where('room.householdId = :householdId', { householdId })
      .andWhere('room.isActive = true')
      .groupBy('room.id')
      .cache(300)
      .getRawMany();
  }

  async updateDeviceCounts(roomId: string): Promise<void> {
    const subQuery = this.createQueryBuilder()
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN isOnline = true THEN 1 ELSE 0 END)', 'online')
      .from(Device, 'device')
      .where('device.roomId = :roomId', { roomId })
      .andWhere('device.isActive = true');

    const result = await subQuery.getRawOne();

    await this.createQueryBuilder()
      .update(Room)
      .set({
        deviceCount: parseInt(result.total),
        onlineDeviceCount: parseInt(result.online),
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :roomId', { roomId })
      .execute();
  }
}
```

This comprehensive technical design for Phase 3 provides a robust, scalable, and real-time room management and device control system that follows clean code principles and NestJS best practices while ensuring complete functional equivalence with the Spring Boot backend.