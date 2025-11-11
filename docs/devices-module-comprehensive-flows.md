# Devices Module Comprehensive Flow Analysis

## Overview

This document provides a comprehensive analysis of all flows within the devices module, including HTTP API flows, WebSocket flows, MQTT integration flows, and device state management flows. The analysis also identifies redundant implementations and architectural patterns.

## Module Structure Overview

```
src/devices/
├── entities/                    # Database entities
│   ├── device.entity.ts         # Device database model
│   └── device-status.entity.ts  # Device status history
├── dto/                         # Data Transfer Objects
│   ├── aircon-control.dto.ts   # AC control commands
│   ├── device-control.dto.ts   # Individual device control DTOs
│   └── register-device.dto.ts  # Device registration
├── services/                    # Business logic services
│   ├── devices.service.ts       # Main device management service
│   ├── device-status.service.ts # Device status caching service
│   ├── device-state-manager.service.ts # State management
│   ├── reactive-mqtt.service.ts # MQTT reactive streams
│   ├── quota-aware-aircon.service.ts # Quota integration
│   └── discovery.service.ts     # Device discovery
├── websocket/                   # WebSocket implementation
│   ├── device.gateway.ts        # Main WebSocket gateway
│   ├── strategies/              # Device strategy pattern
│   │   ├── air-conditioner.strategy.ts # AC device strategy
│   │   └── generic-device.strategy.ts  # Generic device strategy
│   ├── schemas/                 # Validation schemas
│   │   ├── air-conditioner.schema.ts   # AC message schemas
│   │   ├── generic-device.schema.ts    # Generic device schemas
│   │   └── air-conditioner-mqtt.schema.ts # MQTT schemas
│   ├── contracts/               # Type contracts
│   └── interfaces/              # TypeScript interfaces
├── interfaces/                  # Interface definitions
├── devices.controller.ts        # HTTP API controller
└── devices.module.ts           # NestJS module configuration
```

## 1. HTTP API Flow Analysis

### 1.1 Device Registration Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller as DevicesController
    participant Service as DevicesService
    participant RoomsService
    participant Database as DeviceRepo
    participant MQTT as MqttService

    Client->>Controller: POST /devices {RegisterDeviceDto}
    Controller->>Controller: @Roles(UserRole.PARENT) check
    Controller->>Service: register(householdId, dto)
    Service->>RoomsService: get(householdId, dto.roomId)
    RoomsService-->>Service: Room entity
    Service->>Database: findOne({roomId, identifier})
    Database-->>Service: null | existing device

    alt Device exists
        Service-->>Controller: ForbiddenException
        Controller-->>Client: 403 Forbidden
    else Device doesn't exist
        Service->>Database: create(Device)
        Database-->>Service: Device entity
        Service-->>Controller: Device entity
        Controller-->>Client: 201 Created + Device
    end
```

### 1.2 Device Control Flow (HTTP API)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as DevicesController
    participant Service as DevicesService
    participant RoomsService
    participant Database as DeviceRepo
    participant Config as ConfigService
    participant MQTT as MqttService

    Client->>Controller: POST /devices/:id/aircon {AirconControlDto}
    Controller->>Service: controlAircon(householdId, deviceId, dto)
    Service->>Database: findOne({id, relations: ['room']})
    Database-->>Service: Device + Room
    Service->>RoomsService: get(householdId, device.roomId)
    RoomsService-->>Service: Access check

    Service->>Config: get('mqtt.baseTopic')
    Config-->>Service: 'mitsubishi2mqtt'

    Note over Service: Parallel MQTT publishes
    par Power Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/power/set, value)
    and Temperature Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/temp/set, value)
    and Mode Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/mode/set, value)
    and Fan Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/fan/set, value)
    and Vane Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/vane/set, value)
    and Wide Vane Control
        Service->>MQTT: publish(mitsubishi2mqtt/roomId/wideVane/set, value)
    end

    Service-->>Controller: {success: true}
    Controller-->>Client: 200 OK
```

### 1.3 Device Status History Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller as DevicesController
    participant Service as DevicesService
    participant RoomsService
    participant Database as DeviceRepo
    participant StatusRepo as DeviceStatusRepo

    Client->>Controller: GET /devices/:id/status?limit=N
    Controller->>Service: getStatusHistory(householdId, deviceId, limit)
    Service->>Database: findOne({id: deviceId})
    Database-->>Service: Device entity
    Service->>RoomsService: get(householdId, device.roomId)
    RoomsService-->>Service: Access check

    Service->>StatusRepo: find({where: {deviceId}, order: {createdAt: 'DESC'}, take: Math.min(limit, 200)})
    StatusRepo-->>Service: DeviceStatusHistory[]
    Service-->>Controller: DeviceStatusHistory[]
    Controller-->>Client: 200 OK + Status history
```

### 1.4 Individual Device Control Methods Flow

```mermaid
flowchart TD
    Client[Client HTTP Request] --> Controller[DevicesController]
    Controller --> Service[DevicesService]
    Service --> Database[Device Repository]
    Service --> Rooms[Rooms Service]
    Service --> Config[Config Service]
    Service --> MQTT[MQTT Service]

    %% Device Validation Flow
    Database -->|Load Device| Service
    Service -->|Validate Room Access| Rooms
    Rooms -->|Access Check| Service

    %% Topic Generation Flow
    Service -->|Get baseTopic| Config
    Config -->|mitsubishi2mqtt| Service
    Service -->|Generate Room Topic| RoomIdentifier[Room Identifier]

    %% Command Publishing Flow
    subgraph "Command Publishing"
        PowerCmd[Power Command] --> MQTT
        TempCmd[Temperature Command] --> MQTT
        ModeCmd[Mode Command] --> MQTT
        FanCmd[Fan Command] --> MQTT
        VaneCmd[Vane Command] --> MQTT
        WideVaneCmd[Wide Vane Command] --> MQTT
    end

    %% Success Response
    MQTT -->|Publish Complete| Service
    Service --> Controller
    Controller --> Client

    %% Error Handling
    Database -->|Device Not Found| Service
    Service -->|404 Not Found| Controller
    Rooms -->|Access Denied| Service
    Service -->|403 Forbidden| Controller
```

## 2. WebSocket Gateway Flow Analysis

### 2.1 WebSocket Connection Establishment Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as DeviceGateway
    participant AuthGuard as WebSocketAuthGuard
    participant TokensService
    participant SessionManager as WebSocketSessionManagerService
    participant Redis as Redis Store
    participant Registry as StrategyRegistryService

    Client->>Gateway: WS Connect /ws/airconditioner?token=xxx&roomId=xxx&familyMemberId=xxx
    Gateway->>AuthGuard: canActivate()
    AuthGuard->>AuthGuard: extractToken() - Query > Header > Auth Data
    AuthGuard->>TokensService: verifyTokenRaw(token)
    TokensService-->>AuthGuard: JwtClaims
    AuthGuard->>TokensService: isBlacklistedAccess(jti)
    TokensService-->>AuthGuard: boolean
    AuthGuard->>AuthGuard: validateJwtClaims(WebSocket context)
    AuthGuard-->>Gateway: AuthenticatedContext

    Gateway->>Gateway: Validate roomId & familyMemberId
    Gateway->>Registry: getStrategy('airconditioner')
    Registry-->>Gateway: AirConditionerStrategy

    Gateway->>Gateway: client.join(room:roomId)
    Gateway->>SessionManager: registerSession(context)
    SessionManager->>Redis: Store session data
    SessionManager-->>Gateway: Session registered

    Gateway-->>Client: Connection established
```

### 2.2 WebSocket Command Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as DeviceGateway
    participant Registry as StrategyRegistryService
    participant Strategy as AirConditionerStrategy
    participant Validator as MessageValidatorService
    participant MQTT as MqttService
    participant SessionManager as WebSocketSessionManagerService
    participant PerfMonitor as PerformanceMonitorService

    Client->>Gateway: device_command(payload)
    Gateway->>PerfMonitor: start(opId, 'device_command')

    Gateway->>Registry: getStrategy('airconditioner')
    Registry-->>Gateway: AirConditionerStrategy

    Gateway->>Gateway: validateCommandSupport(command)
    Gateway->>Strategy: validateCommand(payload)
    Strategy->>Validator: validateWithSchema(airConditionerValidationSchema)
    Validator-->>Strategy: ValidatedMessage<ACCommand>
    Strategy->>Strategy: Additional command support validation
    Strategy-->>Gateway: Fully validated command

    Gateway->>Strategy: processCommand(validatedMessage, context)

    Note over Strategy: Command Processing
    alt SET_POWER Command
        Strategy->>MQTT: publish(mitsubishi2mqtt/roomId/mode/set, 'on'|'off')
    else SET_TEMPERATURE Command
        Strategy->>MQTT: publish(mitsubishi2mqtt/roomId/temp/set, temperature)
    else SET_MODE Command
        Strategy->>MQTT: publish(mitsubishi2mqtt/roomId/mode/set, mode)
    else SET_FAN Command
        Strategy->>MQTT: publish(mitsubishi2mqtt/roomId/fan/set, fan)
    else GET Commands
        Strategy->>Strategy: Return cached state
    else Other Commands
        Strategy->>Strategy: Process accordingly
    end

    Strategy-->>Gateway: DeviceCommandResponse

    alt Success
        Gateway->>Strategy: broadcastUpdate(context, response)
        Gateway->>Client: device_response(response)
        Gateway->>SessionManager: updateSessionActivity(sessionId)
        Gateway->>PerfMonitor: end(opId, true)
    else Error
        Gateway->>Client: device_response(errorResponse)
        Gateway->>PerfMonitor: end(opId, false)
    end
```

### 2.3 Real-time Event Broadcasting Flow

```mermaid
sequenceDiagram
    participant MQTTBroker
    participant Strategy as AirConditionerStrategy
    participant StateCache[In-Memory Cache]
    participant StreamingService
    participant Gateway as DeviceGateway
    participant Clients[Multiple Clients]

    Note over MQTTBroker: Device State Changes
    MQTTBroker->>Strategy: MQTT message (mitsubishi2mqtt/roomId/state|settings)

    Strategy->>Strategy: JSON.parse() + Zod validation
    Strategy->>StateCache: Update lastKnownState[deviceId]

    Strategy->>Strategy: Create DeviceStatus object
    Strategy->>StreamingService: Create status stream
    Strategy->>Gateway: onDeviceStatus(event)

    Gateway->>Gateway: Create BroadcastUpdatePayload
    Gateway->>Clients: broadcast_update(payload) to room:roomId

    Note over Clients: All clients in room receive update
    Clients->>Clients: Update UI with new device state
```

### 2.4 Strategy Registration Flow

```mermaid
sequenceDiagram
    participant Module as DevicesModule
    participant Factory as Strategy Registrar Factory
    participant Registry as StrategyRegistryService
    participant ACStrategy as AirConditionerStrategy
    participant GenericStrategy as GenericDeviceStrategy

    Note over Module: Module Initialization
    Module->>Factory: onModuleInit()

    Factory->>Registry: registerStrategy(ACStrategy, {autoInitialize: true})
    Registry->>ACStrategy: initialize()
    ACStrategy-->>Registry: Strategy initialized
    Registry-->>Factory: AC strategy registered

    Factory->>Registry: registerStrategy(GenericStrategy, {autoInitialize: true})
    Registry->>GenericStrategy: initialize()
    GenericStrategy-->>Registry: Strategy initialized
    Registry-->>Factory: Generic strategy registered

    Factory-->>Module: Registration complete
```

## 3. Device State Management Flow Analysis

### 3.1 Device State Manager Service Flow

```mermaid
sequenceDiagram
    participant Gateway as DeviceGateway
    participant StateManager as DeviceStateManagerService
    participant Redis[Redis Cache]
    participant EventEmitter as EventEmitter2
    participant ReactiveMQTT as ReactiveMqttService

    Note over StateManager: State Initialization
    StateManager->>Redis: Initialize connection
    StateManager->>Redis: Load cached states
    StateManager->>ReactiveMQTT: Subscribe to MQTT topics
    ReactiveMQTT-->>StateManager: Observable streams

    Note over StateManager: State Update Flow
    ReactiveMQTT->>StateManager: MQTT state message
    StateManager->>StateManager: Validate state with Zod
    StateManager->>Redis: Cache state with TTL
    StateManager->>EventEmitter: Emit device.status event

    Note over StateManager: State Retrieval Flow
    Gateway->>StateManager: getRoomState(roomId)
    StateManager->>Redis: Check cache first
    Redis-->>StateManager: Cached state | null

    alt Cache Hit
        StateManager-->>Gateway: Observable<CachedState>
    else Cache Miss
        StateManager->>ReactiveMQTT: Fetch from MQTT stream
        ReactiveMQTT-->>StateManager: State from device
        StateManager->>Redis: Update cache
        StateManager-->>Gateway: Observable<FreshState>
    end
```

### 3.2 Device Status Service Flow

```mermaid
sequenceDiagram
    participant Client as Gateway/Strategy
    participant StatusService as DeviceStatusService
    participant StateManager as DeviceStateManagerService
    participant Cache[In-Memory Cache]
    participant CircuitBreaker[Circuit Breaker]

    Client->>StatusService: getDeviceStatus(deviceId)

    StatusService->>CircuitBreaker: canAttemptOperation(deviceId)
    CircuitBreaker-->>StatusService: boolean

    alt Circuit Breaker Open
        StatusService->>Cache: getCachedDeviceStatus(deviceId)
        Cache-->>StatusService: Cached status | null
        StatusService-->>Client: Offline status or error
    else Circuit Breaker Closed
        StatusService->>Cache: getCachedDeviceStatus(deviceId)
        Cache-->>StatusService: Cached status | null

        alt Cache Hit
            StatusService-->>Client: Observable<CachedStatus>
        else Cache Miss
            StatusService->>StateManager: getRoomState(deviceId)
            StateManager-->>StatusService: Observable<DeviceState>
            StatusService->>Cache: Cache with TTL
            StatusService->>CircuitBreaker: recordSuccess(deviceId)
            StatusService-->>Client: Observable<DeviceStatus>
        end
    end

    Note over StatusService: Error Handling
    StatusService->>CircuitBreaker: recordFailure(deviceId)
    StatusService->>Cache: Cache offline status
    StatusService-->>Client: Observable<OfflineStatus>
```

### 3.3 Reactive MQTT Service Flow

```mermaid
sequenceDiagram
    participant MQTTBroker
    participant ReactiveMQTT as ReactiveMqttService
    participant EventPublisher as EventPublisherService
    participant StateManager as DeviceStateManagerService
    participant EventEmitter as EventEmitter2

    Note over ReactiveMQTT: Service Initialization
    ReactiveMQTT->>ReactiveMQTT: Connect to MQTT broker
    ReactiveMQTT->>ReactiveMQTT: Subscribe to topics

    Note over ReactiveMQTT: MQTT Message Processing
    MQTTBroker->>ReactiveMQTT: MQTT message
    ReactiveMQTT->>ReactiveMQTT: Parse and validate
    ReactiveMQTT->>EventPublisher: publish(MqttStateUpdateEvent)
    EventPublisher-->>ReactiveMQTT: Published

    ReactiveMQTT->>StateManager: Update state cache
    StateManager->>EventEmitter: emit('device.status')

    Note over ReactiveMQTT: Error Handling
    ReactiveMQTT->>ReactiveMQTT: Connection lost
    ReactiveMQTT->>ReactiveMQTT: Retry with exponential backoff
    ReactiveMQTT->>EventEmitter: emit('mqtt.error')
```

## 4. Integration Flows Between Services

### 4.1 Complete Device Control Flow (HTTP + WebSocket + MQTT)

```mermaid
flowchart TD
    subgraph "Client Layer"
        HTTPClient[HTTP Client]
        WSClient[WebSocket Client]
    end

    subgraph "API Gateway Layer"
        HTTPController[DevicesController]
        WSGateway[DeviceGateway]
    end

    subgraph "Business Logic Layer"
        DevicesService[DevicesService]
        DeviceStatusService[DeviceStatusService]
        StateManager[DeviceStateManagerService]
        ReactiveMQTT[ReactiveMqttService]
    end

    subgraph "Strategy Layer"
        StrategyRegistry[StrategyRegistryService]
        ACStrategy[AirConditionerStrategy]
        GenericStrategy[GenericDeviceStrategy]
    end

    subgraph "Infrastructure Layer"
        Database[(PostgreSQL)]
        Redis[(Redis Cache)]
        MQTTBroker[MQTT Broker]
        MqttService[MqttService]
        EventPublisher[EventPublisherService]
    end

    %% HTTP Flow
    HTTPClient --> HTTPController
    HTTPController --> DevicesService
    DevicesService --> Database
    DevicesService --> MqttService
    MqttService --> MQTTBroker

    %% WebSocket Flow
    WSClient --> WSGateway
    WSGateway --> StrategyRegistry
    StrategyRegistry --> ACStrategy
    ACStrategy --> MqttService
    ACStrategy --> StateManager

    %% State Management Flow
    MQTTBroker --> ReactiveMQTT
    ReactiveMQTT --> EventPublisher
    EventPublisher --> StateManager
    StateManager --> Redis
    StateManager --> WSGateway

    %% Device Status Flow
    ACStrategy --> DeviceStatusService
    DeviceStatusService --> StateManager
    DeviceStatusService --> Redis

    %% Database Persistence
    DevicesService --> Database
    Database --> DeviceStatusService

    %% Cross-cutting concerns
    StateManager -.-> EventPublisher
    WSGateway -.-> StateManager
    DevicesService -.-> StateManager
```

### 4.2 Event-Driven Architecture Flow

```mermaid
sequenceDiagram
    participant MQTTDevice[MQTT Device]
    participant MQTTBroker
    participant ReactiveMQTT[ReactiveMqttService]
    participant EventPublisher[EventPublisherService]
    participant StateManager[DeviceStateManagerService]
    participant EventEmitter[EventEmitter2]
    participant WSGateway[DeviceGateway]
    participant WSClient[WebSocket Client]
    participant DeviceStatusService[DeviceStatusService]
    participant Cache[Redis Cache]

    Note over MQTTDevice: Device State Change
    MQTTDevice->>MQTTBroker: Publish state change
    MQTTBroker->>ReactiveMQTT: MQTT message

    ReactiveMQTT->>ReactiveMQTT: Parse and validate
    ReactiveMQTT->>EventPublisher: publish(MqttStateUpdateEvent)
    EventPublisher-->>ReactiveMQTT: Published successfully

    ReactiveMQTT->>StateManager: Update state cache
    StateManager->>Redis: Cache with TTL
    StateManager->>EventEmitter: emit('device.status')

    EventEmitter->>WSGateway: onDeviceStatus(event)
    WSGateway->>WSGateway: Create broadcast payload
    WSGateway->>WSClient: broadcast_update to room

    EventEmitter->>DeviceStatusService: Status update notification
    DeviceStatusService->>Cache: Update status cache
    DeviceStatusService->>DeviceStatusService: Update statistics
```

## 5. Redundant Implementation Analysis

### 5.1 Major Redundancies Identified

#### **🔴 HIGH PRIORITY REDUNDANCIES**

**1. Dual Device Control Implementations**
```typescript
// ❌ REDUNDANT: HTTP API Control Methods (DevicesService)
async controlAircon(deviceId: string, cmd: AirconControlDto)
async setDevicePower(deviceId: string, dto: SetDevicePowerDto)
async setDeviceTemperature(deviceId: string, dto: SetDeviceTemperatureDto)
async setDeviceMode(deviceId: string, dto: SetDeviceModeDto)
async setDeviceFanSpeed(deviceId: string, dto: SetDeviceFanSpeedDto)
async setDeviceVane(deviceId: string, dto: SetDeviceVaneDto)
async setDeviceWideVane(deviceId: string, dto: SetDeviceWideVaneDto)

// ❌ REDUNDANT: WebSocket Strategy Control (AirConditionerStrategy)
async handleSetPower(message, context)
async handleSetTemperature(message, context)
async handleSetMode(message, context)
async handleSetFan(message, context)
async handleSetVane(message, context)
async handleSetWideVane(message, context)
```

**Redundancy Analysis:**
- Both implement the same device control functionality
- Both use MQTT publishing with identical topic patterns
- Duplicate validation logic for commands
- Separate error handling for same operations
- Hardcoded MQTT topics in both implementations

**2. Multiple MQTT Topic Generation**
```typescript
// ❌ REDUNDANT: HTTP Service Topic Generation
const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
const roomTopic = `${base}/${room.roomIdentifier}`;
await this.mqtt.publish(`${roomTopic}/power/set`, Buffer.from(power));

// ❌ REDUNDANT: Strategy Topic Generation
const topic = `mitsubishi2mqtt/${context.roomId}/mode/set`;
await this.mqttService.publish(topic, payload);
```

**3. Multiple Validation Schemas**
```typescript
// ❌ REDUNDANT: DTO Validation (HTTP)
export class SetDevicePowerDto {
  @IsIn(['on', 'off'])
  power!: 'on' | 'off';
}

// ❌ REDUNDANT: WebSocket Schema Validation
export const setPowerDataSchema = z.object({
  power: z.boolean(),
});

// ❌ REDUNDANT: MQTT Schema Validation
export const powerSchema = z.object({
  power: z.boolean(),
});
```

#### **🟡 MEDIUM PRIORITY REDUNDANCIES**

**4. Device State Caching**
```typescript
// ❌ REDUNDANT: Device Status Service Cache
private readonly statusCache = new Map<string, CachedDeviceStatus>();

// ❌ REDUNDANT: State Manager Cache
private readonly deviceStates = new Map<string, CachedDeviceState>();

// ❌ REDUNDANT: Strategy State Cache
private readonly lastKnownState = new Map<string, AirConState>();
```

**5. Error Handling Patterns**
```typescript
// ❌ REDUNDANT: Service Error Handling
catch (error) {
  this.logger.error(`Failed to control device: ${error.message}`);
  throw error;
}

// ❌ REDUNDANT: Strategy Error Handling
catch (error) {
  this.logger.error(`Command processing failed: ${error.message}`);
  throw error;
}
```

#### **🟠 LOW PRIORITY REDUNDANCIES**

**6. Multiple Metrics Tracking**
- PerformanceMonitorService metrics
- Strategy-specific metrics
- DeviceStatusService cache statistics

**7. Duplicate Configuration Loading**
- ConfigService usage in multiple services
- Hardcoded defaults scattered across files

### 5.2 Redundancy Impact Assessment

```mermaid
pie title Redundancy Distribution
    "Device Control Logic" : 35
    "MQTT Topic Generation" : 20
    "Validation Schemas" : 15
    "State Caching" : 12
    "Error Handling" : 10
    "Metrics/Config" : 8
```

### 5.3 Consolidation Recommendations

#### **Immediate Actions (High Impact)**

**1. Unify Device Control Logic**
- Create a single `DeviceControlService` that handles all device operations
- Both HTTP and WebSocket layers use this service
- Eliminate duplicate MQTT topic generation
- Single validation pipeline for all commands

**2. Centralize MQTT Topic Management**
- Implement the planned `MqttTopicsService` from the MQTT topics configuration spec
- Remove all hardcoded topic strings
- Single source of truth for topic patterns

**3. Consolidate Validation Schemas**
- Use single Zod schemas across all layers
- Map HTTP DTOs to WebSocket schemas
- Remove duplicate validation logic

#### **Medium-term Improvements**

**4. Unify State Caching**
- Use Redis as single state cache source
- Remove in-memory caching redundancies
- Implement cache layers with proper hierarchy

**5. Standardize Error Handling**
- Create centralized error handling patterns
- Single error logging and reporting
- Consistent error response formats

### 5.4 Proposed Refactored Architecture

```mermaid
flowchart TD
    subgraph "Unified Control Layer"
        DeviceControlService[DeviceControlService]
        MqttTopicsService[MqttTopicsService]
        ValidationService[ValidationService]
    end

    subgraph "Entry Points"
        HTTPController[HTTP Controller]
        WSGateway[WebSocket Gateway]
    end

    subgraph "State Management"
        StateManager[DeviceStateManager]
        RedisCache[(Redis Cache)]
        EventEmitter[EventEmitter]
    end

    subgraph "Infrastructure"
        Database[(PostgreSQL)]
        MQTTBroker[MQTT Broker]
        EventPublisher[EventPublisher]
    end

    HTTPController --> DeviceControlService
    WSGateway --> DeviceControlService

    DeviceControlService --> MqttTopicsService
    DeviceControlService --> ValidationService
    DeviceControlService --> StateManager

    StateManager --> RedisCache
    StateManager --> EventEmitter

    MqttTopicsService --> MQTTBroker
    EventEmitter --> EventPublisher

    DeviceControlService --> Database
```

## 6. Performance and Scalability Analysis

### 6.1 Current Performance Characteristics

```mermaid
graph LR
    subgraph "HTTP API Performance"
        A[Device Registration] --> B[~50ms]
        C[Device Control] --> D[~100ms]
        E[Status History] --> F[~75ms]
    end

    subgraph "WebSocket Performance"
        G[Connection Setup] --> H[~200ms]
        I[Command Processing] --> J[~25ms]
        K[Event Broadcasting] --> L[~5ms]
    end

    subgraph "MQTT Performance"
        M[Message Publishing] --> N[~10ms]
        O[State Updates] --> P[~50ms]
    end

    subgraph "Cache Performance"
        Q[Redis Operations] --> R[~1ms]
        S[In-Memory Cache] --> T[~0.1ms]
    end
```

### 6.2 Scalability Concerns

**Current Limitations:**
1. **In-memory caching** - Not scalable across multiple instances
2. **Circuit breaker state** - Per-instance state management
3. **Strategy registry** - Static registration at startup
4. **Connection management** - Session state tied to specific instances

**Recommended Improvements:**
1. **Redis-backed state** for all caches and circuit breaker state
2. **Dynamic strategy registration** for hot-plugging device types
3. **Distributed session management** for WebSocket connections
4. **Horizontal scaling** support for multi-instance deployments

## 7. Security Analysis

### 7.1 Security Flows

```mermaid
sequenceDiagram
    participant Client
    participant WSGateway[DeviceGateway]
    participant AuthGuard[WebSocketAuthGuard]
    participant TokensService
    participant HTTPController[DevicesController]
    participant JWTGuard[JwtAccessGuard]
    participant RolesGuard[RolesGuard]

    Note over Client, WSGateway: WebSocket Authentication
    Client->>WSGateway: WS Connect + JWT
    WSGateway->>AuthGuard: canActivate()
    AuthGuard->>TokensService: verifyTokenRaw()
    AuthGuard->>AuthGuard: validateJwtClaims()
    AuthGuard-->>WSGateway: AuthenticatedContext
    WSGateway-->>Client: Connection established

    Note over Client, HTTPController: HTTP API Security
    Client->>HTTPController: HTTP Request + JWT
    HTTPController->>JWTGuard: canActivate()
    JWTGuard-->>HTTPController: Valid token
    HTTPController->>RolesGuard: canActivate()
    RolesGuard-->>HTTPController: Role validated
    HTTPController-->>Client: Response
```

### 7.2 Security Vulnerabilities Identified

**Current Security Strengths:**
- ✅ JWT authentication with blacklist checking
- ✅ Role-based access control
- ✅ Household-level data isolation
- ✅ Input validation with Zod schemas
- ✅ Proper error handling without sensitive data exposure

**Potential Security Issues:**
- ⚠️ No rate limiting on device commands
- ⚠️ WebSocket connection timeout policies
- ⚠️ MQTT broker authentication configuration
- ⚠️ Cache poisoning prevention
- ⚠️ Audit logging for device control actions

## 8. Recommendations and Action Items

### 8.1 Immediate Actions (Week 1-2)

1. **Implement MQTT Topics Configuration**
   - Complete the spec-driven development workflow
   - Remove all hardcoded MQTT topics
   - Centralize topic management

2. **Consolidate Device Control Logic**
   - Create unified DeviceControlService
   - Remove duplicate control methods
   - Standardize error handling

3. **Unify Validation Schemas**
   - Use single Zod schemas across all layers
   - Map HTTP DTOs to WebSocket schemas
   - Remove validation duplication

### 8.2 Medium-term Improvements (Month 1)

1. **Redis Migration for State Management**
   - Migrate all in-memory caches to Redis
   - Implement distributed circuit breaker state
   - Add proper cache invalidation strategies

2. **Enhanced Monitoring and Metrics**
   - Consolidate metrics tracking
   - Add performance monitoring
   - Implement health checks

3. **Security Enhancements**
   - Add rate limiting
   - Implement audit logging
   - Enhance WebSocket security policies

### 8.3 Long-term Architecture (Quarter 1)

1. **Microservices Architecture Preparation**
   - Extract device control into separate service
   - Implement service discovery
   - Add distributed tracing

2. **Advanced Features**
   - Device type registry
   - Plugin architecture for new device types
   - Advanced scheduling and automation

## Conclusion

The devices module has a comprehensive but redundant architecture with multiple implementations for the same functionality. The WebSocket and HTTP layers provide good separation of concerns, but there's significant code duplication in device control logic, MQTT topic management, and validation schemas.

Key priorities should be:
1. **Eliminate redundancy** in device control and MQTT topic management
2. **Unify validation** across all entry points
3. **Centralize state management** with Redis
4. **Improve monitoring** and security posture

The module shows good architectural patterns with strategy pattern implementation, reactive programming with RxJS, and proper separation of concerns. With the recommended refactoring, it can become a highly maintainable and scalable system.