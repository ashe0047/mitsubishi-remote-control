# MQTT-WebSocket Bridge Requirements Specification

## 1. Overview

### 1.1 Purpose
Enable real-time, bidirectional communication between physical IoT devices (air conditioners) and frontend WebSocket clients by bridging MQTT protocol messages to WebSocket broadcasts.

### 1.2 Problem Statement
**Current Issue**: Frontend WebSocket clients connect successfully but receive NO messages from physical devices because there is no component that:
1. Subscribes to MQTT message events from physical devices
2. Transforms MQTT payloads into WebSocket message format
3. Publishes messages to WebSocket broadcasting sinks

### 1.3 Success Criteria
- ✅ Frontend receives device state updates within 500ms of MQTT message arrival
- ✅ Frontend receives device settings updates in real-time
- ✅ WebSocket clients are notified of MQTT connection status changes
- ✅ System handles MQTT message bursts without dropping messages (backpressure)
- ✅ Failed WebSocket broadcasts do NOT crash MQTT message processing (fault isolation)

---

## 2. Functional Requirements

### FR-1: MQTT State Update Broadcasting
**Priority**: Critical
**Description**: When a physical device publishes state changes to MQTT, all WebSocket clients subscribed to that device's room must receive the update.

**Acceptance Criteria**:
- AC-1.1: System subscribes to `ReactiveMqttService.getStateUpdates()` reactive stream
- AC-1.2: On receiving `MqttStateUpdateEvent`, system looks up device by `deviceIdentifier`
- AC-1.3: System retrieves associated room information
- AC-1.4: System transforms `AirConState` → `RoomStatusUpdateMessage`
- AC-1.5: System publishes message to `roomStatusUpdateSink`
- AC-1.6: All WebSocket sessions subscribed to the room receive the message
- AC-1.7: Message delivery happens within 500ms of MQTT event

**Dependencies**:
- Device lookup by `deviceIdentifier` (DeviceService.getDeviceByIdentifier) ✅ EXISTS
- Room information retrieval ✅ EXISTS
- WebSocket sink infrastructure ✅ EXISTS

---

### FR-2: MQTT Settings Update Broadcasting
**Priority**: High
**Description**: When device settings change (temperature set point, mode, fan speed, etc.), WebSocket clients must be notified.

**Acceptance Criteria**:
- AC-2.1: System subscribes to `ReactiveMqttService.getSettingsUpdates()` reactive stream
- AC-2.2: On receiving `MqttSettingsUpdateEvent`, system looks up device and room
- AC-2.3: System transforms `AirConSettings` → `RoomStatusUpdateMessage`
- AC-2.4: System publishes to appropriate WebSocket sink
- AC-2.5: Settings updates include complete device configuration state

---

### FR-3: Device-to-Room Mapping
**Priority**: Critical
**Description**: MQTT messages contain `deviceIdentifier` (String), but WebSocket clients are organized by `roomId` (UUID). System must map between these.

**Acceptance Criteria**:
- AC-3.1: System uses `DeviceService.getDeviceByIdentifier(deviceIdentifier)` to retrieve Device
- AC-3.2: System extracts `roomId` from retrieved Device
- AC-3.3: If device not found, system logs warning and skips message (graceful degradation)
- AC-3.4: Mapping operations are cached for performance (optional optimization)

**Edge Cases**:
- Device identifier not found in database → Skip message, log warning
- Device disabled → Forward message anyway (device state is informational)
- Multiple devices with same identifier → Should not happen (DB constraint), but handle gracefully

---

### FR-4: MQTT Connection Status Broadcasting
**Priority**: Medium
**Description**: When MQTT broker connection state changes, WebSocket clients should be notified.

**Acceptance Criteria**:
- AC-4.1: System subscribes to `ReactiveMqttService.getConnectionEvents()` stream
- AC-4.2: On connection/disconnection, system creates system-level WebSocket message
- AC-4.3: Message is broadcast to ALL active WebSocket sessions (not filtered by room)
- AC-4.4: Frontend displays connection status indicator

---

### FR-5: Message Transformation
**Priority**: Critical
**Description**: Convert MQTT domain events into WebSocket message protocol format.

**Acceptance Criteria**:
- AC-5.1: `MqttStateUpdateEvent` → `RoomStatusUpdateMessage` with type `RoomUpdateType.DEVICE_STATE_UPDATE`
- AC-5.2: `MqttSettingsUpdateEvent` → `RoomStatusUpdateMessage` with type `RoomUpdateType.DEVICE_SETTINGS_UPDATE`
- AC-5.3: Message includes complete room context: roomId, roomName, devices, aggregateStatus
- AC-5.4: Timestamp added to every message
- AC-5.5: Original MQTT payload preserved in message metadata (for debugging)

---

## 3. Non-Functional Requirements

### NFR-1: Performance
- **Latency**: MQTT-to-WebSocket latency < 500ms (P95)
- **Throughput**: Handle 100 MQTT messages/second without backpressure
- **Memory**: Reactive streams should use bounded buffers (no memory leaks)

### NFR-2: Reliability
- **Fault Isolation**: WebSocket publishing failures MUST NOT crash MQTT processing
- **Error Handling**: All errors logged with context (deviceId, roomId, error type)
- **Graceful Degradation**: Missing device mapping → skip message, continue processing

### NFR-3: Observability
- **Logging**: Debug logs for every message transformation
- **Metrics**: Count of messages processed, transformation failures, WebSocket publish failures
- **Tracing**: Correlation ID from MQTT message to WebSocket delivery

### NFR-4: Maintainability
- **SOLID Principles**: Single Responsibility, Dependency Inversion
- **Testability**: Unit tests for transformation logic, integration tests for end-to-end flow
- **Documentation**: Javadoc for all public methods

---

## 4. Architecture Constraints

### AC-1: Existing Infrastructure
**MUST USE**:
- `ReactiveMqttService` for MQTT event streams (DO NOT create new MQTT subscriber)
- Existing WebSocket `Sinks.Many<T>` for broadcasting (DO NOT create new sinks)
- `DeviceService.getDeviceByIdentifier()` for device lookup (DO NOT bypass)
- Existing `RoomService` for room data retrieval

### AC-2: Technology Stack
- Spring Boot 3.5.5 + WebFlux reactive stack
- Project Reactor (Flux, Mono, Sinks)
- Spring Application Events (@EventListener) - already in use by ReactiveMqttService

### AC-3: Design Patterns
- **Event-Driven Architecture**: Subscribe to reactive streams, don't poll
- **Publish-Subscribe**: Use Reactor Sinks for fan-out to multiple WebSocket sessions
- **Fail-Safe**: Use `.onErrorResume()` to prevent error propagation

---

## 5. Out of Scope

### What This Feature Does NOT Include:
- ❌ New MQTT subscription logic (use existing `ReactiveMqttService`)
- ❌ WebSocket session management (handled by `AirConditionerWebSocketHandler`)
- ❌ Device command validation (handled by `DeviceService` and quota system)
- ❌ Authentication/authorization (handled by JWT filters)
- ❌ Database schema changes (use existing Device and Room entities)

---

## 6. Dependencies

### Internal Dependencies:
1. **ReactiveMqttService** (MQTT event streams) - ✅ Exists
2. **DeviceService** (device lookup by identifier) - ✅ Exists
3. **RoomService** (room data retrieval) - ✅ Exists
4. **WebSocket Sinks** (RoomStatusUpdateMessage, etc.) - ✅ Exists
5. **DTOs**: `AirConState`, `AirConSettings`, `RoomResponse` - ✅ Exist

### External Dependencies:
- MQTT broker (mitsubishi2mqtt) running and publishing messages
- Physical air conditioner devices connected to MQTT

---

## 7. Assumptions

1. **Device Identifier Uniqueness**: Each `deviceIdentifier` is unique across the system (enforced by DB)
2. **MQTT Message Format**: MQTT messages conform to expected `AirConState` / `AirConSettings` schemas
3. **Reactive Stream Lifecycle**: `ReactiveMqttService` streams are hot and remain active during application lifetime
4. **Room Existence**: Every device has an associated room (foreign key constraint)

---

## 8. Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MQTT message burst overwhelms WebSocket | High | Medium | Use backpressure-aware Reactor operators, buffering |
| Device not found during lookup | Medium | Low | Log warning, skip message, continue processing |
| WebSocket sink full (slow consumer) | Medium | Low | Use `tryEmitNext()` with FAIL_FAST, log dropped messages |
| Memory leak in reactive streams | High | Low | Use bounded buffers, proper lifecycle management |
| Incorrect deviceIdentifier in MQTT | Medium | Medium | Validate in transformation, log errors |

---

## 9. Acceptance Testing Scenarios

### Scenario 1: Happy Path - State Update
**Given**: Physical AC unit publishes state change to MQTT topic
**When**: MQTT message arrives with deviceIdentifier="bedroom-ac"
**Then**:
- Device lookup succeeds
- Room information retrieved
- WebSocket message created
- All clients subscribed to room receive message within 500ms

### Scenario 2: Device Not Found
**Given**: MQTT message arrives with deviceIdentifier="unknown-device"
**When**: Device lookup returns empty
**Then**:
- Warning logged with deviceIdentifier
- Message skipped
- MQTT processing continues for next message
- No WebSocket broadcast attempted

### Scenario 3: WebSocket Sink Failure
**Given**: WebSocket sink is full (backpressure)
**When**: System attempts to publish message
**Then**:
- `tryEmitNext()` returns `FAIL_FAST`
- Error logged with context
- MQTT processing continues
- Metric incremented for dropped WebSocket messages

### Scenario 4: Multiple Rooms
**Given**: 3 devices in 3 different rooms all publish state updates simultaneously
**When**: All 3 MQTT messages arrive
**Then**:
- Each message processed independently
- Correct room mapping for each
- WebSocket clients in each room receive only their room's updates
- No cross-contamination between rooms

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **deviceIdentifier** | String identifier for physical device, used in MQTT topics (e.g., "bedroom-ac") |
| **roomId** | UUID identifier for room in database, used for WebSocket filtering |
| **Reactor Sink** | Project Reactor multicast publisher for broadcasting messages |
| **Hot Stream** | Reactive stream that emits values regardless of subscribers (vs cold stream) |
| **Backpressure** | Flow control mechanism when consumer can't keep up with producer |
| **Fault Isolation** | Design principle where failures in one component don't propagate to others |

---

## 11. Approvals

**Spec Author**: Claude (AI Assistant)
**Date**: 2025-10-12
**Status**: DRAFT - Awaiting Review

**Reviewers**:
- [ ] Backend Lead - Architecture review
- [ ] DevOps - Performance and observability review
- [ ] Frontend Lead - WebSocket message format review
- [ ] QA Lead - Test scenarios review

**Approval Required Before**: Design document creation
