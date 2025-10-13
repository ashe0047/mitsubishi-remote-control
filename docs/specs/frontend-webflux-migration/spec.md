# Frontend WebFlux Migration - Requirements Specification

## Overview

Refactor the frontend Next.js application to work with the newly migrated Spring WebFlux backend that replaced RSocket with WebSocket communication. The frontend currently has dual support for MQTT-direct and RSocket-based API modes, with RSocket being the primary API integration method.

## Business Requirements

### BR-1: Seamless Backend Migration Support
- **Requirement**: Frontend must work with the new WebFlux backend without any breaking changes to user experience
- **Rationale**: Users should not notice any difference in functionality after the backend migration
- **Success Criteria**: All existing functionality works identically with the new WebSocket protocol

### BR-2: Real-time Communication Preservation  
- **Requirement**: Maintain real-time bidirectional communication between frontend and backend
- **Rationale**: The application requires instant updates for AC state changes and settings
- **Success Criteria**: State updates appear in UI within 100ms of backend changes

### BR-3: Unified Communication Protocol
- **Requirement**: Replace RSocket communication with WebSocket-based protocol
- **Rationale**: Backend no longer supports RSocket; WebSocket provides equivalent real-time capabilities
- **Success Criteria**: All RSocket functionality replicated using WebSocket messages

## Functional Requirements

### FR-1: WebSocket Protocol Implementation
- **Description**: Implement WebSocket client that communicates using the backend's JSON message protocol
- **Messages Types**:
  - Request/Response: `rooms.list`, `room.state`, `room.settings`, `mqtt.status`
  - Subscriptions: `room.state.stream`, `room.settings.stream`  
  - Commands: `power`, `temperature`, `mode`, `fan`, `vane`, `wideVane`, `settings`
- **Message Format**:
  ```typescript
  // Client to Server
  interface WebSocketMessage {
    id: string;
    type: "request" | "subscribe" | "unsubscribe" | "command";
    request?: string;
    subscription?: string; 
    command?: string;
    roomId?: string;
    value?: string;
    timestamp?: number;
  }
  
  // Server to Client  
  interface WebSocketResponse {
    id?: string;
    type: "response" | "stream" | "ack" | "error";
    source: string;
    roomId?: string;
    data?: any;
    error?: string;
    timestamp: number;
  }
  ```

### FR-2: API Mode Complete Migration
- **Description**: Completely replace RSocket with WebSocket implementation
- **Components to Update**:
  - `ApiAirconProvider` - Replace RSocket connection with WebSocket
  - `api-aircon-store` - Update to use WebSocket client methods
  - `rsocket-client.ts` - Delete and replace with `websocket-client.ts`
- **Migration Approach**: Complete removal of RSocket with no fallback or compatibility layers

### FR-3: State Management Consistency
- **Description**: Ensure state management works identically with WebSocket as it did with RSocket
- **Requirements**:
  - Room state updates via WebSocket streams
  - Command acknowledgments and error handling
  - Connection status management
  - MQTT status monitoring
- **State Structure**: Maintain current room-based state organization

### FR-4: Environment Configuration
- **Description**: Update environment variables for WebSocket connection
- **New Variables**:
  - `NEXT_PUBLIC_BACKEND_WEBSOCKET_URL` (replaces `NEXT_PUBLIC_BACKEND_RSOCKET_URL`)
  - Default: `ws://localhost:8080/ws`
- **Migration**: Remove RSocket configuration, add WebSocket configuration

### FR-5: Error Handling and Reconnection
- **Description**: Implement robust WebSocket error handling and reconnection logic
- **Requirements**:
  - Automatic reconnection on connection loss
  - Exponential backoff for failed connections
  - Graceful handling of WebSocket errors
  - User feedback for connection issues
- **Timeout Handling**: 30-second connection timeout, 5-second reconnection attempts

## Non-Functional Requirements

### NFR-1: Performance
- **Latency**: WebSocket message round-trip time < 50ms
- **Memory**: No memory leaks from WebSocket connections or subscriptions
- **CPU**: Minimal impact on browser performance during normal operation

### NFR-2: Reliability
- **Connection Stability**: Auto-reconnect within 5 seconds of disconnection
- **Data Integrity**: All state updates must be delivered reliably
- **Error Recovery**: Graceful degradation when WebSocket unavailable

### NFR-3: Compatibility
- **Browser Support**: Modern browsers with WebSocket support
- **Mobile**: Progressive Web App functionality maintained
- **Offline**: Graceful handling of offline scenarios

### NFR-4: Security
- **Protocol Security**: Use WSS (WebSocket Secure) in production
- **Authentication**: Support future authentication mechanisms
- **Input Validation**: Validate all incoming WebSocket messages

## Technical Requirements

### TR-1: Dependency Management
- **Remove**: RSocket dependencies (`rsocket-core`, `rsocket-websocket-client`) 
- **Add**: Native WebSocket API usage (no additional dependencies needed)
- **Update**: TypeScript definitions for new WebSocket protocol
- **Clean Up**: Remove all RSocket-related files and references

### TR-2: Code Organization
- **Structure**: Maintain current modular architecture
- **Naming**: Replace "rsocket" with "websocket" in file names and references  
- **Interfaces**: Update interfaces to reflect WebSocket message structure

### TR-3: Testing Strategy
- **Unit Tests**: WebSocket client message handling
- **Integration Tests**: End-to-end WebSocket communication
- **Error Scenarios**: Connection failures, message errors, timeouts

## User Stories

### US-1: As a user controlling AC units
**Given** I am using the air conditioning remote control app  
**When** the backend has been migrated to WebFlux with WebSocket  
**Then** I should experience identical functionality without any disruption

### US-2: As a user monitoring real-time data
**Given** I have the app open with room monitoring  
**When** AC settings or state change (via MQTT or other clients)  
**Then** I should see updates in the UI immediately via WebSocket streams

### US-3: As a user with connection issues
**Given** my WebSocket connection is interrupted  
**When** the connection is restored  
**Then** the app should automatically reconnect and resume real-time updates

## Acceptance Criteria

### AC-1: Protocol Migration
- [ ] All RSocket functionality replicated with WebSocket messages
- [ ] Request/response pattern working for data fetching
- [ ] Streaming subscriptions working for real-time updates  
- [ ] Command execution with proper acknowledgments
- [ ] Error handling with meaningful error messages

### AC-2: State Management
- [ ] Room state updates work identically to RSocket implementation
- [ ] Command execution provides same user feedback
- [ ] Connection status accurately reflects WebSocket state
- [ ] MQTT status monitoring works via WebSocket requests

### AC-3: User Experience
- [ ] No breaking changes to existing UI components
- [ ] Same response times as RSocket implementation
- [ ] Proper error feedback to users
- [ ] Seamless reconnection experience

### AC-4: Code Quality
- [ ] All RSocket code completely removed from codebase
- [ ] No RSocket references in any files
- [ ] TypeScript compilation without errors
- [ ] ESLint passes without violations
- [ ] No memory leaks in WebSocket connections

## Dependencies

### Internal Dependencies
- **Backend WebSocket Handler**: Must be fully implemented and tested
- **WebSocket Message Protocol**: Backend JSON message format specification  
- **Environment Configuration**: Updated deployment configurations

### External Dependencies
- **WebSocket Browser API**: Native browser WebSocket support
- **RxJS**: Continue using for reactive stream handling
- **Zustand**: Existing state management maintained

## Constraints

### Technical Constraints
- **Browser Support**: Limited to browsers with WebSocket support
- **Protocol Lock-in**: Must match exact backend WebSocket message format
- **State Structure**: Cannot change existing state management interfaces

### Business Constraints  
- **Zero Downtime**: Must be deployable without service interruption
- **Clean Migration**: Complete removal of RSocket without compatibility layers
- **Performance**: Must maintain or improve current performance levels

## Risk Analysis

### High Risk
- **Protocol Mismatch**: WebSocket message format incompatibility with backend
- **Connection Stability**: WebSocket connections more fragile than RSocket
- **State Synchronization**: Risk of state inconsistencies during migration

### Medium Risk
- **Performance Impact**: Potential WebSocket overhead vs RSocket efficiency
- **Error Handling**: Different error patterns requiring UI updates
- **Testing Coverage**: Need comprehensive WebSocket integration testing

### Low Risk  
- **Dependency Updates**: Minimal risk from removing RSocket dependencies
- **Configuration Changes**: Simple environment variable updates

## Success Metrics

### Functional Metrics
- **Feature Parity**: 100% of RSocket features working with WebSocket
- **Error Rate**: < 1% WebSocket communication errors
- **Response Time**: < 100ms average for command acknowledgments

### Technical Metrics  
- **Connection Uptime**: > 99% WebSocket connection stability
- **Reconnection Time**: < 5 seconds average reconnection time
- **Memory Usage**: No increase in browser memory usage

### User Experience Metrics
- **User Satisfaction**: No user complaints about changed functionality
- **Performance**: No measurable degradation in UI responsiveness
- **Reliability**: Zero data loss during state updates