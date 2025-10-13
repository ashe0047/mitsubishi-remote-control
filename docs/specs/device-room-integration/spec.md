# Device-Room Integration - Requirements Specification

**Feature**: Protocol-Agnostic Device-Room Integration
**Status**: Draft
**Created**: 2025-10-05
**Author**: Development Team

---

## 1. Executive Summary

Implement a database-driven device registration system that associates IoT devices (air conditioners, thermostats, lights) with rooms using protocol-agnostic device identifiers. This enables the application to control devices through any messaging protocol (MQTT, HTTP, WebSocket) without coupling room logic to specific protocol implementations.

---

## 2. Business Requirements

### 2.1 Problem Statement

**Current Challenges**:
1. **No device abstraction**: App directly uses roomId as MQTT topic identifier
2. **Protocol coupling**: MQTT-specific logic embedded in room management
3. **Limited flexibility**: Cannot support multiple devices per room or multiple protocols
4. **No device management**: No way to register, configure, or manage devices independently
5. **Scalability issues**: Adding new device types or protocols requires code changes

**Business Impact**:
- Cannot easily integrate non-MQTT devices (HTTP APIs, proprietary protocols)
- Difficult to support smart homes with mixed device ecosystems
- Manual configuration required for each device-room relationship
- No audit trail or device lifecycle management

### 2.2 Objectives

**Primary Goals**:
1. **Device Abstraction**: Decouple device identifiers from specific messaging protocols
2. **Flexible Association**: Support multiple devices per room and multiple device types
3. **Protocol Agnostic**: Enable device control via MQTT, HTTP, WebSocket, or future protocols
4. **Lifecycle Management**: Provide CRUD operations for device registration and configuration
5. **Scalability**: Easy to add new device types and protocols without core logic changes

**Success Criteria**:
- All devices registered in database with protocol-agnostic identifiers
- Room control works with any configured messaging protocol
- Admin UI can manage device-room associations
- Multiple device types (AC, thermostat, lights) supported per room
- Zero downtime migration from current roomId-based system

---

## 3. Functional Requirements

### FR1: Device Registration

**Requirements**:
- System shall store devices in database with following attributes:
  - Unique device ID (UUID)
  - Room association (roomId FK)
  - Device type (AIRCONDITIONER, THERMOSTAT, LIGHT, etc.)
  - Protocol-agnostic device identifier (string)
  - Manufacturer and model (optional metadata)
  - Enabled/disabled status
  - Custom metadata (JSONB for flexibility)
  - Audit timestamps (created_at, updated_at)

- System shall enforce unique constraint: (roomId, deviceType, deviceIdentifier)
- System shall support soft delete via enabled flag

### FR2: Device-Room Association

**Requirements**:
- System shall allow multiple devices per room
- System shall allow multiple device types per room
- System shall support one-to-one or one-to-many room-device relationships
- System shall provide default device selection for rooms with multiple devices of same type

### FR3: Protocol-Agnostic Device Identification

**Requirements**:
- Device identifier shall be protocol-independent string (e.g., "ac_bedroom_main")
- Protocol adapters shall translate device identifier to protocol-specific format:
  - MQTT: `mitsubishi2mqtt/{deviceIdentifier}/command`
  - HTTP: `/devices/{deviceIdentifier}/control`
  - WebSocket: `/ws/devices/{deviceIdentifier}`
- Device metadata shall optionally store preferred protocol
- System shall support protocol fallback if preferred protocol unavailable

### FR4: Device Control Service

**Requirements**:
- Service shall accept roomId + deviceType to locate device
- Service shall retrieve device from repository
- Service shall delegate to appropriate protocol publisher based on device configuration
- Service shall handle missing device gracefully with clear error messages
- Service shall support disabled devices (skip control, return appropriate status)

### FR5: Device Management REST API

**Requirements**:
- `GET /api/rooms/{roomId}/devices` - List all devices in room
- `POST /api/rooms/{roomId}/devices` - Register new device
- `GET /api/rooms/{roomId}/devices/{deviceId}` - Get device details
- `PUT /api/rooms/{roomId}/devices/{deviceId}` - Update device configuration
- `DELETE /api/rooms/{roomId}/devices/{deviceId}` - Delete device (or disable)
- `GET /api/devices` - List all devices (admin view)
- `GET /api/devices?type={deviceType}` - Filter by device type
- All endpoints require authentication and appropriate permissions

### FR6: Device Discovery (Future-Ready)

**Requirements**:
- System design shall accommodate future auto-discovery features
- Database schema shall support tracking discovered vs manually-registered devices
- API shall support marking devices as "pending registration" from discovery

---

## 4. Non-Functional Requirements

### NFR1: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Device lookup time | <10ms | 95th percentile |
| REST API response time | <100ms | 95th percentile |
| Database query time | <5ms | Average |
| Protocol adapter overhead | <5ms | Per device command |

**Optimization Requirements**:
- Index on (roomId, deviceType) for fast lookup
- Index on deviceIdentifier for reverse lookup
- Caching layer for frequently accessed devices
- Reactive/non-blocking repository operations

### NFR2: Scalability

**Requirements**:
- Support up to 1000 devices per family
- Support up to 50 devices per room
- Support at least 5 device types initially
- Support concurrent device control requests
- Database design shall accommodate 1M+ devices (multi-tenant future)

### NFR3: Reliability

**Requirements**:
- 99.9% device lookup success rate
- Zero data loss on device registration
- Transaction support for device updates
- Graceful degradation if protocol adapter fails
- Audit trail for all device lifecycle events

### NFR4: Maintainability

**Requirements**:
- Clear separation between domain logic and protocol adapters
- Device types defined as enum (easy to extend)
- Protocol publishers implement common interface
- Repository pattern for data access abstraction
- Comprehensive logging for device operations

### NFR5: Security

**Requirements**:
- Device management API requires authentication
- Role-based access control (Admin can manage, User can view/control)
- Audit log for device registration/deletion
- Validation of device identifier format
- Prevent SQL injection via parameterized queries

---

## 5. Data Model Requirements

### 5.1 Database Schema

**Devices Table**:
```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    device_identifier VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_room_device UNIQUE(room_id, device_type, device_identifier)
);

CREATE INDEX idx_devices_room_type ON devices(room_id, device_type);
CREATE INDEX idx_devices_identifier ON devices(device_identifier);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_enabled ON devices(enabled);
```

**Rooms Table** (Existing, No Changes):
```sql
-- Existing rooms table remains unchanged
-- Devices reference rooms via room_id FK
```

### 5.2 Domain Model

**Device Entity**:
```java
public record Device(
    UUID id,
    UUID roomId,
    DeviceType deviceType,
    String deviceIdentifier,     // Protocol-agnostic
    String manufacturer,
    String model,
    boolean enabled,
    Map<String, Object> metadata,  // JSONB storage
    Timestamp createdAt,
    Timestamp updatedAt
) {}

public enum DeviceType {
    AIRCONDITIONER,
    THERMOSTAT,
    LIGHT,
    SECURITY_CAMERA,
    DOOR_LOCK,
    SMART_PLUG
}
```

---

## 6. API Specifications

### 6.1 REST API Endpoints

#### List Devices in Room
```
GET /api/rooms/{roomId}/devices
Response: 200 OK
[
  {
    "id": "uuid",
    "roomId": "uuid",
    "deviceType": "AIRCONDITIONER",
    "deviceIdentifier": "ac_bedroom_main",
    "manufacturer": "Mitsubishi",
    "model": "MSZ-AP35VG",
    "enabled": true,
    "metadata": {},
    "createdAt": "2025-10-05T10:00:00Z",
    "updatedAt": "2025-10-05T10:00:00Z"
  }
]
```

#### Register Device
```
POST /api/rooms/{roomId}/devices
Request:
{
  "deviceType": "AIRCONDITIONER",
  "deviceIdentifier": "ac_bedroom_main",
  "manufacturer": "Mitsubishi",
  "model": "MSZ-AP35VG",
  "metadata": {
    "protocol": "mqtt",
    "capabilities": ["temperature", "mode", "fanSpeed"]
  }
}
Response: 201 Created
{
  "id": "generated-uuid",
  "roomId": "room-uuid",
  "deviceType": "AIRCONDITIONER",
  ...
}
```

#### Update Device
```
PUT /api/rooms/{roomId}/devices/{deviceId}
Request:
{
  "enabled": false,
  "manufacturer": "Updated Manufacturer"
}
Response: 200 OK
{
  "id": "uuid",
  ...updated fields
}
```

#### Delete Device
```
DELETE /api/rooms/{roomId}/devices/{deviceId}
Response: 204 No Content
```

### 6.2 Service API

```java
public interface DeviceControlService {
    Mono<Void> setTemperature(UUID roomId, int temperature);
    Mono<Void> setMode(UUID roomId, String mode);
    Mono<DeviceStatus> getStatus(UUID roomId);
}

public interface DeviceRepository {
    Mono<Device> findById(UUID id);
    Flux<Device> findByRoom(UUID roomId);
    Mono<Device> findByRoomAndType(UUID roomId, DeviceType type);
    Flux<Device> findByDeviceIdentifier(String identifier);
    Mono<Device> save(Device device);
    Mono<Void> delete(UUID id);
}
```

---

## 7. Constraints

### 7.1 Technical Constraints

1. **Database**: PostgreSQL 13+ (JSONB support required)
2. **Framework**: Spring Boot 3.x with WebFlux (reactive)
3. **Java**: JDK 21 with Records support
4. **Compatibility**: Must work with existing room management system
5. **Migration**: Zero-downtime migration from current implementation

### 7.2 Business Constraints

1. **Scope**: Initial support for AIRCONDITIONER, THERMOSTAT, LIGHT types
2. **Protocol**: MQTT implementation first, HTTP/WebSocket as adapters
3. **Timeline**: 2-week implementation window
4. **Team**: Development team implements, Admin configures devices
5. **Budget**: No additional infrastructure costs (use existing database)

---

## 8. Assumptions

1. Database supports JSONB data type (PostgreSQL)
2. Each room can have at most one primary device of each type
3. Device identifiers are globally unique across all families
4. MQTT broker identifiers match device identifiers (1:1 mapping)
5. Existing rooms table has proper foreign key constraints
6. Admin users will manually register devices initially
7. Auto-discovery can be added later without schema changes

---

## 9. Dependencies

### 9.1 Internal Dependencies

**Database**:
- Existing rooms table with UUID primary key
- Database migration tool (Flyway/Liquibase)
- JSONB support for metadata storage

**Backend Services**:
- ReactiveAirConService (will be refactored to use DeviceRepository)
- Room management service (existing)
- WebSocket handlers (will use DeviceControlService)

**Security**:
- JWT authentication system (existing)
- Role-based access control (existing)

### 9.2 External Dependencies

**MQTT Integration**:
- mitsubishi2mqtt broker and its topic structure
- MQTT client library (existing)

**Future Protocols**:
- HTTP client library (WebClient)
- Additional protocol libraries as needed

---

## 10. Success Metrics

### 10.1 Functional Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Devices managed via DB | 0% | 100% | Device count in devices table |
| Protocol-agnostic control | No | Yes | Multiple protocols supported |
| Multi-device rooms | No | Yes | Rooms with >1 device |
| API coverage | 0% | 100% | CRUD endpoints implemented |

### 10.2 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code coverage | >80% | Unit + Integration tests |
| API response time | <100ms | 95th percentile |
| Zero breaking changes | Yes | Existing functionality preserved |
| Device lookup performance | <10ms | Database query time |

### 10.3 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Device registration time | <2 minutes | Admin workflow timing |
| Setup errors | <5% | Failed device registrations |
| User satisfaction | >90% | Device control reliability |

---

## 11. Acceptance Criteria

### 11.1 Database Acceptance Criteria

- [ ] Devices table created with all required columns
- [ ] Indexes created for performance (roomId, deviceType, deviceIdentifier)
- [ ] Foreign key constraint from devices to rooms enforced
- [ ] Unique constraint on (roomId, deviceType, deviceIdentifier) enforced
- [ ] JSONB metadata column supports flexible storage
- [ ] Migration script runs without errors
- [ ] Rollback script available and tested

### 11.2 Repository Acceptance Criteria

- [ ] DeviceRepository interface defined with all CRUD operations
- [ ] R2DBC repository implementation created
- [ ] Reactive operations return Mono/Flux appropriately
- [ ] Database queries optimized with proper indexes
- [ ] Repository unit tests achieve >90% coverage
- [ ] Integration tests verify database operations

### 11.3 Service Acceptance Criteria

- [ ] DeviceControlService implemented with protocol abstraction
- [ ] Service locates devices by roomId + deviceType
- [ ] Service delegates to protocol adapters (MQTT first)
- [ ] Missing device scenarios handled with clear errors
- [ ] Disabled devices respected (no control sent)
- [ ] Service unit tests achieve >85% coverage

### 11.4 API Acceptance Criteria

- [ ] All 6 REST endpoints implemented and documented
- [ ] Request/response DTOs defined with validation
- [ ] Authentication required for all endpoints
- [ ] Role-based access control enforced
- [ ] Error responses follow consistent format
- [ ] API integration tests cover happy + error paths
- [ ] OpenAPI/Swagger documentation generated

### 11.5 Protocol Adapter Acceptance Criteria

- [ ] ProtocolPublisher interface defined
- [ ] MqttProtocolPublisher implements interface
- [ ] Device identifier correctly translated to MQTT topics
- [ ] MQTT publish operations use device identifier
- [ ] Future HTTP/WebSocket adapters can be added easily
- [ ] Protocol selection based on device metadata

### 11.6 Migration Acceptance Criteria

- [ ] Existing room control functionality preserved
- [ ] No breaking changes to WebSocket API
- [ ] Legacy roomId-based control still works (fallback)
- [ ] Database migration completes without downtime
- [ ] Admin can register devices via REST API
- [ ] Documentation updated with migration guide

---

## 12. Out of Scope

The following items are **explicitly out of scope** for this specification:

1. ❌ Auto-discovery of devices (future enhancement)
2. ❌ Device grouping or zones (future enhancement)
3. ❌ Multi-protocol simultaneous control (one protocol per device for now)
4. ❌ Device firmware updates or OTA management
5. ❌ Historical device status tracking or analytics
6. ❌ Device scheduling or automation rules
7. ❌ Mobile app changes (API-only, UI uses existing controls)
8. ❌ Device health monitoring or diagnostics
9. ❌ Device sharing across families (single family ownership)
10. ❌ Real-time device sync across multiple app instances

---

## 13. Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Specification** | 1 day | This document + design + implementation plan |
| **Database Schema** | 1 day | Create migration, entities, repositories |
| **Domain Layer** | 2 days | Device model, repository, service layer |
| **Protocol Adapters** | 2 days | MQTT adapter, protocol abstraction |
| **REST API** | 2 days | Controllers, DTOs, validation |
| **Testing** | 3 days | Unit, integration, API tests |
| **Documentation** | 1 day | API docs, migration guide, CLAUDE.md |
| **Migration & Deployment** | 1 day | Migrate data, deploy, verify |
| **Total** | **13 days** | ~2.5 weeks |

---

## 14. Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Device identifier conflicts | Medium | High | Enforce unique constraints, validation |
| MQTT topic structure mismatch | Medium | High | Verify mitsubishi2mqtt topic format |
| Performance degradation | Low | Medium | Index optimization, caching |
| Migration data loss | Low | Critical | Backup database, test migration thoroughly |
| Complex room-device relationships | Medium | Medium | Start with 1:1, extend to 1:N gradually |
| Protocol adapter complexity | Low | Medium | Start with MQTT only, add others incrementally |

---

## 15. Stakeholder Sign-off

| Stakeholder | Role | Approval | Date |
|-------------|------|----------|------|
| Development Team | Implementer | ✅ Approved | 2025-10-05 |
| User | Product Owner | Pending | - |
| Database Admin | Infrastructure | Pending | - |

---

## 16. Appendix

### 16.1 Example Device Registration Flow

**Step 1: Admin creates room**
```
POST /api/rooms
{
  "familyId": "family-uuid",
  "name": "Master Bedroom"
}
Response: { "id": "room-uuid", ... }
```

**Step 2: Admin registers AC device**
```
POST /api/rooms/room-uuid/devices
{
  "deviceType": "AIRCONDITIONER",
  "deviceIdentifier": "ac_bedroom_main",
  "manufacturer": "Mitsubishi",
  "model": "MSZ-AP35VG"
}
Response: { "id": "device-uuid", ... }
```

**Step 3: User controls AC via existing WebSocket**
```
WebSocket: /ws/airconditioner?roomId=room-uuid&...
Message: { "type": "SET_TEMPERATURE", "temperature": 24 }
```

**Step 4: Backend flow**
```
1. AirConditionerWebSocketHandler receives message with roomId
2. SetTemperatureCommand → DeviceControlService.setTemperature(roomId, 24)
3. DeviceControlService → DeviceRepository.findByRoomAndType(roomId, AIRCONDITIONER)
4. Retrieved device has deviceIdentifier "ac_bedroom_main"
5. DeviceControlService → MqttProtocolPublisher.setTemperature("ac_bedroom_main", 24)
6. MqttProtocolPublisher → mqttClient.publish("mitsubishi2mqtt/ac_bedroom_main/temp/set", "24")
```

### 16.2 Database Migration Script

```sql
-- V2__create_devices_table.sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    device_identifier VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_room_device UNIQUE(room_id, device_type, device_identifier)
);

CREATE INDEX idx_devices_room_type ON devices(room_id, device_type);
CREATE INDEX idx_devices_identifier ON devices(device_identifier);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_enabled ON devices(enabled) WHERE enabled = true;

-- Insert trigger for updated_at
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 16.3 References

- [Room Management Specification](../room-management/spec.md)
- [WebSocket Unification Specification](../websocket-unification/spec.md)
- [WebSocket Endpoint Restructuring](../websocket-endpoint-restructuring/spec.md)
- [CLAUDE.md Project Guidelines](../../../CLAUDE.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Next Review**: After design document approval
