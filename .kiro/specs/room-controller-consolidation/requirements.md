# Room Controller Consolidation Requirements

## Introduction

This specification defines the consolidation of room-related API endpoints into a single, unified RoomController under the `/api/rooms` path. Previously, room operations were split between the UnifiedRoomController (`/api/rooms`) and AirConController (`/api/aircon`), creating inconsistent API patterns and requiring multiple client integrations. This consolidation has provided a single, cohesive API for all room and device operations by fully replacing the old AirConController with enhanced UnifiedRoomController functionality.

## Requirements

### Requirement 1: Single Room API Endpoint

**User Story:** As a developer, I want all room-related operations consolidated under `/api/rooms`, so that I have a single, predictable API pattern to work with.

#### Acceptance Criteria

1. WHEN I need to perform room CRUD operations THEN I SHALL use `/api/rooms` endpoints
2. WHEN I need to control devices in a room THEN I SHALL use `/api/rooms/{roomId}/devices/{deviceId}/*` endpoints
3. WHEN I need to get room status THEN I SHALL use `/api/rooms/{roomId}/status` endpoint
4. WHEN I need to validate commands THEN I SHALL use `/api/rooms/{roomId}/devices/{deviceId}/validate` endpoint

### Requirement 2: Device Control Integration

**User Story:** As a user, I want device control operations to be scoped to rooms, so that the API reflects the logical relationship between rooms and devices.

#### Acceptance Criteria

1. WHEN I control a device THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/control`
2. WHEN I set device power THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/power`
3. WHEN I set device temperature THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/temperature`
4. WHEN I set device mode THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/mode`
5. WHEN I set device fan speed THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/fan`
6. WHEN I set device vane position THEN the endpoint SHALL be `/api/rooms/{roomId}/devices/{deviceId}/vane`

### Requirement 3: Quota Management Integration

**User Story:** As a user, I want quota validation and usage tracking to be seamlessly integrated with device control, so that I don't exceed my usage limits.

#### Acceptance Criteria

1. WHEN I execute a device control command THEN the system SHALL validate against my quotas
2. WHEN quota validation fails THEN the system SHALL return a 403 Forbidden status with quota details
3. WHEN I start using a device THEN the system SHALL automatically start a usage session
4. WHEN I stop using a device THEN the system SHALL automatically end the usage session

### Requirement 4: Session Management Integration

**User Story:** As a user, I want usage sessions to be managed automatically through device control operations, so that I don't need to manually manage sessions.

#### Acceptance Criteria

1. WHEN I turn on a device THEN the system SHALL automatically start a usage session
2. WHEN I turn off a device THEN the system SHALL automatically end the usage session
3. WHEN I get room status THEN the response SHALL include current session information
4. WHEN session operations fail THEN device control SHALL still succeed with appropriate logging

### Requirement 5: Consistent Response Format

**User Story:** As a developer, I want consistent response formats across all room-related endpoints, so that I can handle responses uniformly.

#### Acceptance Criteria

1. WHEN any room endpoint returns data THEN it SHALL use the RoomResponse format with embedded device information
2. WHEN device control operations complete THEN they SHALL return DeviceControlResponse with updated room data
3. WHEN errors occur THEN they SHALL follow consistent error response format
4. WHEN validation fails THEN the response SHALL include detailed validation information

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want existing API clients to continue working during the transition, so that I can migrate gradually without breaking changes.

#### Acceptance Criteria

1. WHEN old `/api/aircon` endpoints are called THEN they SHALL continue to work with deprecation warnings
2. WHEN migration is complete THEN old endpoints SHALL return 410 Gone status with migration instructions
3. WHEN response formats change THEN they SHALL maintain backward compatibility for existing fields
4. WHEN new fields are added THEN they SHALL be optional and not break existing clients

### Requirement 7: Real-time Status Updates

**User Story:** As a user, I want real-time updates when device status changes, so that I see immediate feedback from my actions.

#### Acceptance Criteria

1. WHEN device status changes THEN WebSocket subscribers SHALL receive real-time updates
2. WHEN device control operations complete THEN the room's aggregate status SHALL update immediately
3. WHEN multiple devices in a room change status THEN updates SHALL be batched efficiently
4. WHEN WebSocket connection is lost THEN the system SHALL gracefully degrade to polling

### Requirement 8: Security and Authorization

**User Story:** As a user, I want my room and device access to be properly secured, so that only authorized users can control devices.

#### Acceptance Criteria

1. WHEN I access any room endpoint THEN I SHALL be authenticated via JWT token
2. WHEN I control devices THEN the system SHALL verify I have access to the specific room
3. WHEN I perform parent-only operations THEN the system SHALL verify my PARENT role
4. WHEN authorization fails THEN the system SHALL return 401 Unauthorized or 403 Forbidden as appropriate

### Requirement 9: Error Handling and Resilience

**User Story:** As a user, I want the system to handle errors gracefully and provide clear feedback, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN device communication fails THEN the system SHALL return 503 Service Unavailable with retry information
2. WHEN validation errors occur THEN the system SHALL return 400 Bad Request with field-level details
3. WHEN quota limits are exceeded THEN the system SHALL return 403 Forbidden with quota information
4. WHEN internal errors occur THEN the system SHALL return 500 Internal Server Error with correlation IDs

### Requirement 10: Performance Optimization

**User Story:** As a user, I want fast response times for device control operations, so that the system feels responsive and immediate.

#### Acceptance Criteria

1. WHEN I control a device THEN the response time SHALL be under 500ms for local operations
2. WHEN I get room status THEN cached data SHALL be used when appropriate
3. WHEN multiple operations are performed THEN they SHALL be batched efficiently
4. WHEN quota validation is performed THEN it SHALL not significantly impact response time