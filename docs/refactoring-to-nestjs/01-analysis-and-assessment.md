# Spring Boot Backend Analysis & Assessment

## Overview

This document provides a comprehensive analysis of the current Spring Boot backend system that will be migrated to NestJS. The analysis covers all components, features, and technical details to ensure complete understanding before refactoring.

## System Architecture

### Technology Stack
- **Framework**: Spring Boot 3.5.5 with Java 21
- **Database**: PostgreSQL with R2DBC reactive driver
- **WebSocket**: Spring WebSocket with Sinks.Many
- **Messaging**: Eclipse Paho MQTT v1.2.5
- **Caching**: Redis with reactive client
- **Authentication**: JWT with Spring Security
- **Testing**: Spring Boot Test with Testcontainers

### Module Structure
```
backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/
├── api/device/dto/              # Device API DTOs
├── application/device/          # Device application layer
├── config/                      # Configuration classes
├── controller/                  # REST API controllers
├── dto/                         # Data Transfer Objects
├── entity/                      # JPA entities
├── exception/                   # Exception handling
├── handler/                     # Request/response handlers
├── health/                      # Health check implementations
├── infrastructure/              # Infrastructure layer
├── repository/                  # Data access layer
├── service/                     # Business logic layer
├── util/                        # Utility functions
├── validation/                  # Validation logic
└── websocket/                   # WebSocket handlers
```

## REST API Endpoints

### Authentication Controller (`/api/auth`)

| Method | Endpoint | Purpose | Key Features |
|--------|----------|---------|--------------|
| POST | `/register` | User registration with household creation | BCrypt password hashing, JWT generation |
| POST | `/login` | User authentication with refresh tokens | Remember me option, token refresh |
| GET | `/me` | Current user information | Role-based access control |
| POST | `/refresh` | Token refresh without re-authentication | Secure token rotation |
| POST | `/logout` | Client-side logout | Token invalidation |

**Request/Response Structures:**
```typescript
// Registration Request
{
  email: string;
  name: string;
  password: string;
  familyName?: string;
}

// Authentication Response
{
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "parent" | "child";
    familyId: string;
    createdAt: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

### Room Controller (`/api/rooms`)

| Method | Endpoint | Purpose | Key Features |
|--------|----------|---------|--------------|
| GET | `/` | List all rooms with status | Real-time status, MQTT integration |
| GET | `/{roomId}` | Get specific room details | Detailed state information |
| POST | `/` | Create new room (admin only) | Room management |

**Response Structure:**
```typescript
{
  id: string;
  name: string;
  online: boolean;
  state: {
    roomTemperature: number | null;
    temperature: number;
    fan: string;
    vane: string;
    wideVane: string;
    mode: string;
    action: string;
  };
  settings: {
    power: string;
    temperature: number;
    mode: string;
    fan: string;
    vane: string;
    wideVane: string;
  };
}
```

### Quota Controller (`/api/quotas`)

| Method | Endpoint | Purpose | Key Features |
|--------|----------|---------|--------------|
| POST | `/` | Create/update quota (parent only) | Multiple quota types, thresholds |
| GET | `/user/{userId}` | Get current quota status | Real-time balance calculation |
| POST | `/{quotaId}/override` | Parent override system | Emergency access, time extensions |
| GET | `/user/{userId}/all` | Get all user quotas | Management interface |
| DELETE | `/{quotaId}` | Delete quota (parent only) | Quota lifecycle management |

**Quota Types:**
- **TIME_BASED**: Daily time limit (hours converted to seconds)
- **USAGE_COUNT**: Daily usage count limit
- **ENERGY_BASED**: Daily energy consumption (kWh)
- **COST_BASED**: Daily cost budget

## WebSocket Architecture

### AirConditionerWebSocketHandler (`/ws/airconditioner`)

**URL Pattern**: `ws://localhost:8080/ws/airconditioner?roomId={uuid}&familyMemberId={user-id}&token={jwt}`

**Query Parameters:**
- `roomId` (required): Room UUID for AC control
- `familyMemberId` (required): User/family member ID
- `token` (required): JWT authentication token

**Supported Commands:**
```typescript
interface AirConditionerInboundMessage {
  type: "SET_POWER" | "SET_MODE" | "SET_TEMPERATURE" | "SET_FAN" | "SET_VANE" | "SET_WIDEVANE";
  payload: {
    roomId: string;
    action: string;
    value: string | number;
    userId?: string;
    timestamp?: string;
  }
}

// Command Examples
SetPowerCommand { action: "power", value: "ON|OFF" }
SetModeCommand { action: "mode", value: "off|heat_cool|cool|dry|heat|fan_only" }
SetTemperatureCommand { action: "temp", value: number(16-31) }
SetFanSpeedCommand { action: "fan", value: "AUTO|1|2|3|4|QUIET|auto|low|middle|medium|high|diffuse" }
SetVaneCommand { action: "vane", value: "AUTO|1|2|3|4|5|SWING" }
SetWideVaneCommand { action: "widevane", value: "<<|<||||>|>>|SWING" }
```

**Outbound Messages:**
```typescript
interface StatusUpdateMessage {
  type: "STATUS_UPDATE";
  payload: {
    roomId: string;
    temperature: number;
    fan: string;
    vane: string;
    wideVane: string;
    mode: string;
    action?: string;
  }
}

interface TemperatureUpdateMessage {
  type: "TEMPERATURE_UPDATE";
  payload: {
    roomId: string;
    roomTemperature: number | null;
  }
}

interface RoomStatusUpdateMessage {
  type: "ROOM_STATUS_UPDATE";
  payload: {
    roomId: string;
    online: boolean;
    lastUpdated: string;
  }
}
```

### QuotaWebSocketHandler (`/ws/quota`)

**URL Pattern**: `ws://localhost:8080/ws/quota?quotaId={uuid}&roomId={room-id}&familyMemberId={user-id}&token={jwt}`

**Query Parameters:**
- `quotaId` (required): Quota UUID
- `roomId` (required): Room ID
- `familyMemberId` (required): User ID
- `token` (required): JWT authentication token

**Supported Commands:**
```typescript
interface QuotaInboundMessage {
  type: "SUBSCRIBE" | "UNSUBSCRIBE" | "OVERRIDE_REQUEST" | "OVERRIDE_APPROVAL" | "HEALTH_CHECK";
  payload: {
    quotaId: string;
    roomId?: string;
    userId?: string;
    reason?: string;
    overrideType?: "ADD_TIME" | "UNLOCK_DAY" | "EMERGENCY_OVERRIDE";
    additionalSeconds?: number;
    approved?: boolean;
  }
}
```

**Outbound Messages:**
```typescript
interface QuotaUpdateMessage {
  type: "QUOTA_UPDATE";
  payload: {
    quotaId: string;
    familyMemberId: string;
    roomId: string;
    currentUsage: number;
    dailyLimit: number;
    status: "ACTIVE" | "WARNING" | "EXCEEDED" | "PAUSED";
    isActive: boolean;
    lastUpdated?: string;
    estimatedSessionUsage?: number;
  }
}

interface ViolationAlertMessage {
  type: "QUOTA_VIOLATION_ALERT";
  payload: {
    quotaId: string;
    familyMemberId: string;
    familyMemberName: string;
    roomId: string;
    roomName: string;
    violationType: "TIME_EXCEEDED" | "COUNT_EXCEEDED" | "ENERGY_EXCEEDED" | "COST_EXCEEDED";
    currentUsage: number;
    limit: number;
    timestamp: string;
  }
}
```

## Business Logic Services

### QuotaValidationService

**Performance Target**: <100ms response time

**Core Business Rules:**
1. **Power OFF commands** always bypass quotas
2. **Read-only commands** (status, get) don't consume quota
3. **Emergency overrides** bypass quota validation
4. **Warning threshold** at 75% usage
5. **Fail-open strategy** on service errors/timeouts

**Validation Flow:**
1. Check if command requires quota validation
2. Verify quota feature is enabled for user
3. Check cached quota balance from Redis
4. If cache miss, load from database and calculate current usage
5. Evaluate business rules (exceeded/warning/within limits)
6. Return validation result with context

**Cache Strategy:**
- **TTL**: 1 hour for quota balances
- **Key Pattern**: `quota:balance:{userId}:{roomId}`
- **Fallback**: Database lookup on cache miss

### ReactiveAirConService

**Reactive Streams:**
- `Flux<AirConState>`: Room state updates
- `Flux<AirConSettings>`: Room settings updates
- `Mono<List<RoomInfo>>`: All rooms with status

**Command Methods:**
```java
setPower(String roomId, String power)        // ON|OFF
setTemperature(String roomId, int temperature) // 16-31°C
setMode(String roomId, String mode)          // heat_cool|cool|dry|heat|fan_only
setFan(String roomId, String fan)            // AUTO|1|2|3|4|QUIET
setVane(String roomId, String vane)         // AUTO|1|2|3|4|5|SWING
setWideVane(String roomId, String wideVane) // <<|<|||>|>>|SWING
```

**Session Management:**
- In-memory storage of room states with thread-safe maps
- Real-time updates via MQTT streams
- WebSocket broadcasting through Sinks.Many

### MqttService

**Configuration:**
- **Broker**: `tcp://{host}:{port}`
- **Topics**: `mitsubishi2mqtt/{roomId}/state`, `mitsubishi2mqtt/{roomId}/settings`
- **Commands**: `mitsubishi2mqtt/{roomId}/{command}/set`

**Connection Management:**
- Exponential backoff reconnection strategy
- Automatic resubscription to topics on reconnect
- Connection event publishing for WebSocket clients

**Message Processing:**
- JSON parsing with Jackson ObjectMapper
- Event-driven updates via ApplicationEventPublisher
- Room ID extraction from topic patterns

### JwtService

**Token Structure:**
```json
{
  "userId": "uuid",
  "householdId": "uuid",
  "role": "parent|child",
  "iat": timestamp,
  "exp": timestamp,
  "iss": "mitsubishi-controller"
}
```

**Token Management:**
- Access tokens: 24 hour expiration
- Refresh tokens: 7 day expiration
- Rotation strategy on refresh
- Secure signature verification

## Data Models

### Core Entities

**User Entity:**
```java
@Entity
@Table("users")
public class User extends BaseEntity {
    UUID householdId;               // Family unit
    String email;                   // Unique email
    String passwordHash;            // BCrypt hashed
    String name;                    // Full name
    UserRole role;                  // parent|child
    UserStatus status;              // active|inactive|suspended
    String preferences;             // JSONB
    String emergencyContacts;       // JSONB
    LocalDate dateOfBirth;
    String avatarUrl, phone, employeeId;
}
```

**Quota Entity:**
```java
@Entity
@Table("quotas")
public class Quota {
    UUID userId;
    String name, description;
    QuotaType quotaType;           // TIME_BASED|USAGE_COUNT|ENERGY_BASED|COST_BASED
    QuotaScope scope;               // ROOM|HOUSEHOLD|USER
    String targetId;                // Room/Household/User ID
    BigDecimal allowedAmount;      // Time(hours), Count, Energy(kWh), Cost(currency)
    BigDecimal usedAmount;
    QuotaPeriod period;             // DAILY|WEEKLY|MONTHLY
    List<Integer> warningThresholds; // Percentage-based warnings
    QuotaStatus status;             // ACTIVE|PAUSED|EXPIRED
}
```

**UsageSession Entity:**
```java
@Entity
@Table("usage_sessions")
public class UsageSession {
    UUID quotaId;
    UUID userId;
    String roomId;
    Instant startTime, endTime;
    SessionStatus status;           // ACTIVE|COMPLETED|CANCELLED
    Long durationSeconds;
    BigDecimal usageAmount;
}
```

**Household Entity:**
```java
@Entity
@Table("households")
public class Household extends BaseEntity {
    String familyName;
    String address;
    String city, state, country;
    String postalCode;
    String phone;
    String timezone;
    HouseholdSettings settings;    // JSONB configuration
}
```

### Key DTOs

**AirConCommand:**
```java
public class AirConCommand {
    UUID userId;
    String roomId;
    String action;                 // power|temp|mode|fan|vane|widevane
    Object value;                  // Command-specific value
    Instant timestamp;
    CommandPriority priority;       // LOW|NORMAL|HIGH|EMERGENCY
    Boolean bypassQuota;           // Override quota validation
    Map<String, Object> metadata;   // Additional context
}
```

**QuotaBalance:**
```java
public class QuotaBalance {
    UUID quotaId, userId;
    String roomId;
    Integer warningThreshold;
    boolean isActive;
    // Type-specific fields:
    Integer totalSeconds, usedSeconds, remainingSeconds;        // TIME_BASED
    Integer totalUsageCount, usedUsageCount, remainingUsageCount; // USAGE_COUNT
    BigDecimal totalEnergyKwh, usedEnergyKwh, remainingEnergyKwh; // ENERGY_BASED
    BigDecimal totalCostAmount, usedCostAmount, remainingCostAmount; // COST_BASED
    boolean isExceeded, isAtWarningThreshold;
}
```

## External Integrations

### MQTT Integration

**Protocol**: Eclipse Paho MQTT v1.2.5
**Configuration**: Broker host, port, credentials, client ID
**Reconnection**: Exponential backoff with max attempts
**Topics**: State updates, settings, commands
**Message Format**: JSON with standardized schemas

### Database Integration

**Database**: PostgreSQL with R2DBC reactive driver
**Migration**: Flyway DB with automatic schema management
**Entities**: JPA entities with reactive repositories
**Performance**: Connection pooling, reactive streams

### Redis Integration

**Purpose**: High-performance quota balance caching
**TTL Strategy**: 1 hour for balances, 5 minutes for short-term data
**Key Patterns**: `quota:balance:{userId}:{roomId}`
**Fallback**: Database lookup on cache miss

## Configuration

### application.properties
```properties
# Server Configuration
server.port=8080
spring.application.name=turing-server

# Database Configuration
spring.r2dbc.url=r2dbc:postgresql://localhost:5432/turing
spring.r2dbc.username=${DB_USERNAME}
spring.r2dbc.password=${DB_PASSWORD}
spring.flyway.enabled=true

# MQTT Configuration
mqtt.broker-url=${MQTT_BROKER_HOST}
mqtt.broker-port=1883
mqtt.username=${MQTT_USERNAME}
mqtt.password=${MQTT_PASSWORD}
mqtt.base-topic=mitsubishi2mqtt

# Redis Configuration
spring.redis.host=${REDIS_HOST}
spring.redis.port=6379

# JWT Configuration
jwt.secret=${JWT_SECRET}
jwt.expiration=86400000  # 24 hours
jwt.refresh-expiration=604800000  # 7 days

# CORS Configuration
cors.allowed-origins=http://localhost:3000,http://localhost:3001
```

## Testing Architecture

### Test Structure
- **Unit Tests**: Controllers, services, repositories in isolation
- **Integration Tests**: Full HTTP request/response testing
- **WebSocket Tests**: Message flow and session management
- **Database Tests**: Repository operations with test containers
- **MQTT Tests**: Message publishing and subscription

### Test Dependencies
- Spring Boot Test framework
- Reactor Test for reactive streams
- Testcontainers for database testing
- MockMvc for HTTP testing
- Mockito for mocking

## Performance Requirements

### Response Time Targets
- **Quota Validation**: <100ms with fail-open timeout
- **API Endpoints**: <200ms average response time
- **WebSocket Latency**: Real-time updates within 2 seconds
- **Database Queries**: Optimized with proper indexing

### Scalability Requirements
- **Concurrent Users**: Support 100+ simultaneous WebSocket connections
- **Message Throughput**: Handle 1000+ MQTT messages per minute
- **Database Connections**: Pool sizing for concurrent access
- **Memory Usage**: Efficient in-memory state management

## Security Requirements

### Authentication & Authorization
- JWT-based authentication with access/refresh tokens
- Role-based access control (parent/child roles)
- Secure password hashing with BCrypt
- Token rotation and secure storage

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration
- Secure WebSocket connections

## Key Technical Challenges

### Reactive Programming Model
- Spring WebFlux uses RxJava (Project Reactor)
- Requires understanding of reactive streams and backpressure
- Complex state management with concurrent access

### Real-time Communication
- WebSocket session management and broadcasting
- MQTT integration with connection resilience
- Event-driven architecture across multiple services

### Performance Optimization
- In-memory state management for AC devices
- Efficient caching strategies for quota validation
- Database query optimization and connection pooling

This comprehensive analysis provides the foundation for planning the NestJS migration while ensuring all functionality, business rules, and technical requirements are preserved.