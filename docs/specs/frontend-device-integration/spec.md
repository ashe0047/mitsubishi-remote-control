# Frontend Device-Room Integration - Requirements Specification

## 1. Overview

### 1.1 Purpose
Integrate the Next.js frontend application with the new backend device-room architecture that supports protocol-agnostic device management, dynamic device discovery, and bidirectional communication via WebSocket.

### 1.2 Background
The backend has been refactored to introduce a device abstraction layer that decouples room IDs from device identifiers. The new architecture supports:
- Protocol-agnostic device management (MQTT, HTTP, future protocols)
- Dynamic device discovery via MQTT messages
- Bidirectional communication (device → MQTT → WebSocket clients)
- Device registration and management REST API

The frontend currently assumes a 1:1 mapping between room IDs and MQTT topics. This needs to be updated to work with the new device-centric architecture.

### 1.3 Scope
**In Scope**:
- REST API client for device management (discovery, registration, commands)
- WebSocket message format updates to handle device-based updates
- Store updates to support device discovery and selection
- UI components for device discovery and registration
- Device selection per room (supporting multiple devices per room)
- Backward compatibility with existing room-based UI

**Out of Scope**:
- MQTT client changes (remains server-side only)
- Multi-protocol device support beyond MQTT (future enhancement)
- Device firmware updates or diagnostics
- Advanced device analytics or telemetry visualization

## 2. Business Requirements

### 2.1 User Stories

**US-1: As a user, I want to see discovered devices in my rooms so I can register them for control**
- **Acceptance Criteria**:
  - AC1.1: Discovered devices appear with device identifier, type, and discovery timestamp
  - AC1.2: Devices show "unregistered" status until explicitly registered
  - AC1.3: Discovery notifications are non-intrusive (toast/banner, not modal)
  - AC1.4: Discovery messages persist until dismissed or device is registered

**US-2: As a user, I want to register discovered devices to my rooms so they can be controlled via the UI**
- **Acceptance Criteria**:
  - AC2.1: Device registration form includes: room selection, device name (optional), manufacturer/model (optional)
  - AC2.2: Registration succeeds and device immediately becomes available for control
  - AC2.3: Validation prevents duplicate registrations (same room + device type + identifier)
  - AC2.4: Success/error feedback provided after registration attempt

**US-3: As a user, I want to select which device to control when a room has multiple devices of the same type**
- **Acceptance Criteria**:
  - AC3.1: Device selector appears when room has >1 device of the same type
  - AC3.2: Selected device persists during the session
  - AC3.3: Control commands route to the selected device only
  - AC3.4: Device status updates (temperature, mode, etc.) show for selected device

**US-4: As a user, I want to receive real-time updates from my devices so I see current device state**
- **Acceptance Criteria**:
  - AC4.1: Device state updates (temperature, mode, fan, etc.) push from device → WebSocket → UI
  - AC4.2: Updates apply to the correct room and device
  - AC4.3: UI reflects updates within 1 second of device state change
  - AC4.4: No unnecessary re-renders (only affected components update)

**US-5: As a user, I want to manage registered devices (enable/disable, remove) so I can control which devices are active**
- **Acceptance Criteria**:
  - AC5.1: Device list shows all registered devices with enable/disable toggle
  - AC5.2: Disabled devices do not receive commands but still show in the list
  - AC5.3: Device removal requires confirmation (destructive action)
  - AC5.4: Removed devices can be re-discovered and re-registered

### 2.2 Functional Requirements

**FR-1: Device Discovery**
- FR-1.1: Frontend subscribes to device discovery WebSocket messages (type: DEVICE_DISCOVERED)
- FR-1.2: Discovery messages contain: deviceIdentifier, deviceType, messageType, payload, timestamp, requiresRegistration
- FR-1.3: Discovered devices stored in Zustand store with discovery metadata
- FR-1.4: Discovery notifications display in UI with registration action

**FR-2: Device Registration**
- FR-2.1: REST API client implements POST /api/devices/discovery/register
- FR-2.2: Registration request payload: { discoveredDeviceId, roomId, deviceName?, manufacturer?, model?, metadata? }
- FR-2.3: Successful registration returns Device entity with UUID
- FR-2.4: Frontend updates store to mark device as registered and enabled

**FR-3: Device Management**
- FR-3.1: REST API client implements GET /api/devices/room/{roomId}
- FR-3.2: REST API client implements PATCH /api/devices/{deviceId} (enable/disable, update metadata)
- FR-3.3: REST API client implements DELETE /api/devices/{deviceId}
- FR-3.4: Frontend updates store after management operations

**FR-4: Device Selection**
- FR-4.1: Zustand store tracks selected device per room (roomId → deviceIdentifier mapping)
- FR-4.2: Device selector component renders when room.devices.length > 1
- FR-4.3: Selected device preference persists in localStorage
- FR-4.4: Fallback: select first enabled device if no preference exists

**FR-5: Bidirectional Communication**
- FR-5.1: WebSocket messages include device identifier and device type
- FR-5.2: Inbound messages (STATE, SETTINGS) routed to correct room and device
- FR-5.3: Outbound commands include device context from selected device
- FR-5.4: Message format: { type, deviceIdentifier, deviceType, data, timestamp }

**FR-6: Control Commands**
- FR-6.1: Control commands route through selected device identifier
- FR-6.2: Backend maps device identifier to protocol publisher (MQTT, HTTP, etc.)
- FR-6.3: Commands fail gracefully if device is disabled or not found
- FR-6.4: Error messages distinguish between network, quota, and device errors

### 2.3 Non-Functional Requirements

**NFR-1: Performance**
- NFR-1.1: WebSocket message processing latency < 100ms
- NFR-1.2: Device discovery notification appears within 500ms
- NFR-1.3: Device registration completes within 2 seconds
- NFR-1.4: No UI freezing during device operations

**NFR-2: Reliability**
- NFR-2.1: WebSocket reconnection preserves device state
- NFR-2.2: Discovery messages not lost during temporary disconnections
- NFR-2.3: Command failures trigger retry with exponential backoff (max 3 retries)
- NFR-2.4: Stale device state highlighted in UI (>30 seconds since last update)

**NFR-3: Usability**
- NFR-3.1: Device discovery notifications are non-modal and dismissible
- NFR-3.2: Device registration form auto-populates known fields
- NFR-3.3: Device selector uses clear labels (device name or identifier)
- NFR-3.4: Consistent ShadcnUI component styling and animations

**NFR-4: Maintainability**
- NFR-4.1: Clean separation: API client → Store → Components
- NFR-4.2: Zustand v5 patterns: specific selectors, no infinite loops
- NFR-4.3: TypeScript strict mode compliance
- NFR-4.4: Comprehensive JSDoc for public APIs

**NFR-5: Backward Compatibility**
- NFR-5.1: Existing room-based UI continues to work for single-device rooms
- NFR-5.2: Migration path for rooms with unregistered devices
- NFR-5.3: Graceful degradation if backend device API unavailable

## 3. Acceptance Criteria

### 3.1 Feature Acceptance
- All user stories (US-1 through US-5) acceptance criteria met
- All functional requirements (FR-1 through FR-6) implemented
- All non-functional requirements (NFR-1 through NFR-5) verified

### 3.2 Technical Acceptance
- TypeScript compilation succeeds with strict mode
- ESLint passes with no warnings
- No console errors during normal operation
- WebSocket connection stable for >5 minutes
- Device commands succeed with <1% failure rate

### 3.3 User Experience Acceptance
- Device discovery flow requires ≤3 clicks to register device
- Device state updates visible within 1 second
- No UI layout shifts during device updates
- Mobile-responsive design (min 44px touch targets)
- Dark/light theme support for all new components

## 4. Constraints and Assumptions

### 4.1 Constraints
- **Backend Dependency**: Frontend depends on backend device API (REST + WebSocket)
- **Protocol Limitation**: Initial release supports MQTT devices only
- **Authentication**: WebSocket requires JWT token authentication
- **Browser Support**: Modern browsers with WebSocket and ES2022 support

### 4.2 Assumptions
- **Device Uniqueness**: Device identifiers are unique per protocol type
- **Room Assignment**: Devices belong to exactly one room at a time
- **Discovery Timing**: Device discovery happens when device sends MQTT message
- **Network Reliability**: WebSocket connection is generally stable (reconnects handled)
- **User Behavior**: Users register devices promptly after discovery

## 5. Dependencies and Integration Points

### 5.1 Backend Dependencies
- **REST API Endpoints**:
  - `POST /api/devices/discovery/register` - Register discovered device
  - `GET /api/devices/room/{roomId}` - Get devices for room
  - `GET /api/devices/discovery/room/{roomId}` - Get discovered devices for room
  - `PATCH /api/devices/{deviceId}` - Update device (enable/disable, metadata)
  - `DELETE /api/devices/{deviceId}` - Remove device

- **WebSocket Messages (Inbound)**:
  - `DEVICE_DISCOVERED` - New device detected via MQTT
  - `STATE` - Device state update (temperature, power, etc.)
  - `SETTINGS` - Device settings update
  - `COMMAND_ACK` - Command acknowledgment
  - `ERROR` - Error message from backend

- **WebSocket Messages (Outbound)**:
  - `SET_TEMPERATURE` - Set device temperature
  - `SET_MODE` - Set device mode (heat, cool, etc.)
  - `SET_FAN_SPEED` - Set fan speed
  - `SET_POWER` - Power on/off
  - `SET_SWING` - Set swing/vane position

### 5.2 Frontend Dependencies
- **Existing Components**: AirConRemote, RoomList, RoomCard
- **Existing Hooks**: useAircon, useAirconStore, useConnectionStatus
- **Existing Stores**: api-aircon-store.ts (requires updates)
- **Existing Clients**: websocket-client.ts (requires message format updates)

### 5.3 External Dependencies
- **Libraries**: axios (HTTP), rxjs (streams), zustand (state), zod (validation)
- **UI Components**: ShadcnUI (Button, Card, Badge, Dialog, Select, Toast)

## 6. Success Metrics

### 6.1 Functional Metrics
- **Device Discovery Success Rate**: >95% of MQTT messages trigger discovery
- **Device Registration Success Rate**: >98% of registration attempts succeed
- **Command Success Rate**: >99% of control commands reach device
- **State Update Latency**: <1 second from device → UI

### 6.2 User Experience Metrics
- **Discovery Time**: <30 seconds from device power-on to discovery notification
- **Registration Time**: <10 seconds from discovery to registered and controllable
- **Control Responsiveness**: <500ms from UI interaction to command sent

### 6.3 Quality Metrics
- **Zero Runtime Errors**: No uncaught exceptions during normal operation
- **Zero Memory Leaks**: No observable memory growth over 30-minute session
- **Zero Infinite Loops**: Proper Zustand v5 selector usage prevents loops

## 7. Risks and Mitigation Strategies

### 7.1 Technical Risks

**Risk 1: WebSocket Message Format Breaking Changes**
- **Impact**: High - Breaks bidirectional communication
- **Probability**: Medium - Backend and frontend developed in parallel
- **Mitigation**:
  - Coordinate message format changes via shared TypeScript types
  - Version WebSocket protocol if breaking changes needed
  - Implement fallback for unrecognized message types

**Risk 2: Zustand v5 Infinite Loop Regression**
- **Impact**: High - UI freezes, poor user experience
- **Probability**: Medium - Easy to accidentally introduce
- **Mitigation**:
  - Mandatory code review for store selectors
  - ESLint rule to detect store object access in useEffect deps
  - Testing with React DevTools Profiler

**Risk 3: Device Discovery Message Loss**
- **Impact**: Medium - Devices not discovered, manual intervention needed
- **Probability**: Low - WebSocket reconnection buffering
- **Mitigation**:
  - Periodic polling for discovered devices (fallback mechanism)
  - Backend persists discovery messages for recent timeframe
  - Manual device registration form (bypass discovery)

### 7.2 User Experience Risks

**Risk 4: Discovery Notification Overload**
- **Impact**: Medium - Annoying for users with many devices
- **Probability**: High - Initial setup, device restarts
- **Mitigation**:
  - Batch discovery notifications (group by room or time window)
  - "Dismiss all" action for multiple discoveries
  - Auto-dismiss after device registration

**Risk 5: Device Selection Confusion**
- **Impact**: Medium - Users control wrong device
- **Probability**: Medium - Multiple devices of same type in room
- **Mitigation**:
  - Clear device labels (name or identifier)
  - Visual confirmation after command (device icon highlights)
  - Persistent device selection per room

## 8. Future Enhancements (Out of Scope)

- **Multi-Protocol Support**: HTTP, WebSocket-native devices
- **Device Grouping**: Control multiple devices as a single entity
- **Device Automation**: Triggers and schedules per device
- **Device Analytics**: Usage patterns, energy consumption estimates
- **Device Firmware Updates**: OTA updates via UI
- **Device Diagnostics**: Health checks, error logs, connectivity tests

---

**Document Status**: Draft
**Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: Claude (AI Assistant)
**Approval Required**: User confirmation before proceeding to design phase
