# WebFlux Refactoring - Requirements Specification

## Overview

This specification defines the requirements for refactoring the existing Spring Boot REST API endpoints and RSocket implementation to use Spring WebFlux, while maintaining Spring Boot as the application foundation for future compatibility.

## Business Requirements

### BR-1: Reactive Architecture Migration
**Requirement**: Migrate from traditional blocking I/O to reactive non-blocking I/O architecture
**Rationale**: 
- Improve application scalability and resource utilization
- Enable better handling of concurrent MQTT streams and client connections
- Prepare infrastructure for high-throughput real-time AC control scenarios

### BR-2: Maintain API Compatibility
**Requirement**: Preserve existing API contracts and functionality during refactoring
**Rationale**: 
- Ensure seamless frontend integration without breaking changes
- Maintain backward compatibility with existing clients
- Minimize deployment risks and rollback requirements

### BR-3: Spring Boot Foundation Preservation
**Requirement**: Keep Spring Boot as the application foundation while migrating to WebFlux
**Rationale**: 
- Maintain access to Spring Boot ecosystem and tooling
- Preserve future extensibility options
- Keep familiar development and deployment patterns

## Functional Requirements

### FR-1: REST API Endpoints (WebFlux)
**Current State**: Traditional Spring MVC REST controllers with blocking operations
**Required State**: WebFlux-based reactive REST endpoints

**Endpoints to Migrate**:
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/{roomId}/state` - Get room state
- `GET /api/rooms/{roomId}/settings` - Get room settings  
- `POST /api/rooms/{roomId}/power` - Set power state
- `POST /api/rooms/{roomId}/temperature` - Set temperature
- `POST /api/rooms/{roomId}/mode` - Set AC mode
- `POST /api/rooms/{roomId}/fan` - Set fan speed
- `POST /api/rooms/{roomId}/vane` - Set vane position
- `POST /api/rooms/{roomId}/widevane` - Set wide vane position
- `PUT /api/rooms/{roomId}/settings` - Update all settings
- `GET /api/rooms/mqtt/status` - Get MQTT connection status

**Acceptance Criteria**:
- All endpoints return `Mono<T>` or `Flux<T>` reactive types
- HTTP status codes and error handling preserved
- Response times improve under concurrent load
- Validation annotations continue to work
- CORS configuration remains functional

### FR-2: RSocket to WebSocket Migration
**Current State**: RSocket controllers using Spring Boot RSocket starter
**Required State**: Complete replacement with WebFlux WebSocket implementation

**RSocket Functionality to Migrate to WebSocket**:
- `rooms.list` - Stream room information → WebSocket subscription pattern
- `room.{roomId}.state` - Get room state reactively → WebSocket request/response pattern
- `room.{roomId}.settings` - Get room settings reactively → WebSocket request/response pattern
- `rooms.state.stream` - Stream room state updates → WebSocket streaming pattern
- `rooms.settings.stream` - Stream room settings updates → WebSocket streaming pattern
- `rooms.power` - Set power via RSocket → WebSocket command pattern
- `rooms.temperature` - Set temperature via RSocket → WebSocket command pattern
- `rooms.mode` - Set mode via RSocket → WebSocket command pattern
- `rooms.fan` - Set fan via RSocket → WebSocket command pattern
- `rooms.vane` - Set vane via RSocket → WebSocket command pattern
- `rooms.wideVane` - Set wide vane via RSocket → WebSocket command pattern
- `rooms.settings` - Update settings via RSocket → WebSocket command pattern
- `mqtt.status` - Get MQTT status via RSocket → WebSocket request/response pattern

**Acceptance Criteria**:
- All RSocket functionality completely migrated to WebSocket protocols
- RSocket dependencies and controllers completely removed from codebase
- WebSocket handlers provide identical functionality with improved performance
- Streaming operations work with proper backpressure handling via WebSocket
- Error handling and logging preserved in WebSocket implementation

### FR-3: WebSocket Implementation (WebFlux)
**Current State**: No existing WebSocket implementation (RSocket currently provides real-time communication)
**Required State**: Comprehensive WebFlux WebSocket implementation replacing all RSocket functionality

**WebSocket Features Required**:
- Real-time room state updates via WebSocket streaming
- Real-time room settings updates via WebSocket streaming  
- Real-time MQTT connection status updates
- Command execution via WebSocket (power, temperature, mode, fan, vane, widevane, settings)
- Room information retrieval via WebSocket request/response
- Room-based subscription management and filtering
- Connection lifecycle management
- Request/response pattern for single queries
- Streaming pattern for continuous updates
- Command pattern for AC control operations

**Acceptance Criteria**:
- WebSocket connections established via `/ws` endpoint
- JSON message format for commands, requests, and updates
- Support for multiple message types: `command`, `request`, `subscribe`, `unsubscribe`
- Proper connection cleanup and error handling
- Support for multiple concurrent client connections
- Message routing based on room subscriptions and message types
- Complete functional replacement of all RSocket capabilities
- Performance equivalent or better than current RSocket implementation

### FR-4: MQTT Integration Preservation
**Current State**: MQTT service using Eclipse Paho client with Spring Events
**Required State**: MQTT service integrated with reactive streams

**Integration Requirements**:
- MQTT message processing converted to reactive streams
- Spring Application Events replaced with reactive publishers
- Backpressure handling for high-frequency MQTT messages
- Connection state management preserved

**Acceptance Criteria**:
- MQTT messages processed as `Flux<T>` streams
- Service maintains all current MQTT functionality
- Error handling and reconnection logic preserved
- Performance improves under high message volume

## Non-Functional Requirements

### NFR-1: Performance
**Requirement**: Application must handle increased concurrent load
**Metrics**:
- Support 10x more concurrent connections than current implementation
- Response time degradation <10% under 100 concurrent requests
- Memory usage increase <20% compared to current implementation
- CPU utilization improved under high concurrency

### NFR-2: Compatibility
**Requirement**: Maintain backward compatibility
**Constraints**:
- No breaking changes to API contracts
- Frontend requires no modifications
- Docker deployment process unchanged
- Configuration properties preserved

### NFR-3: Maintainability  
**Requirement**: Code maintainability must be preserved or improved
**Metrics**:
- Code complexity does not increase
- Test coverage maintained at current levels
- Documentation updated to reflect reactive patterns
- Error messages remain clear and actionable

### NFR-4: Deployment
**Requirement**: Deployment process remains unchanged
**Constraints**:
- Same Docker container structure
- Same environment variable configuration
- Same health check endpoints
- Same logging output format

## Success Metrics

### Primary Success Criteria
1. **Functional Parity**: All existing API endpoints work identically and all RSocket functionality migrated to WebSocket
2. **Performance Improvement**: Measurable performance gains under concurrent load
3. **Zero Downtime Migration**: Deployment causes no service interruption
4. **Frontend Compatibility**: Frontend application continues to work without changes

### Secondary Success Criteria  
1. **Resource Efficiency**: Improved CPU and memory utilization patterns
2. **Scalability**: Enhanced ability to handle traffic spikes
3. **Observability**: Reactive streams provide better monitoring capabilities
4. **Developer Experience**: Code remains readable and maintainable

## Constraints and Assumptions

### Technical Constraints
- Must maintain Spring Boot framework as foundation
- Cannot modify frontend application during migration
- Must preserve existing MQTT broker integration
- Docker container size cannot exceed current size by >50%

### Business Constraints
- Migration must complete within single development cycle
- No budget for additional infrastructure requirements
- Must maintain development team's ability to support application

### Assumptions
- Current test coverage provides adequate regression protection
- Development team has sufficient Spring WebFlux knowledge
- MQTT message patterns remain consistent during migration
- No major version upgrades of Spring Boot required

## Dependencies and Integration Points

### Internal Dependencies
- `AirConService` - Core business logic service
- `MqttService` - MQTT broker integration
- All DTO classes - Data transfer objects
- Configuration classes - Application configuration

### External Dependencies
- Spring Boot 3.5.5 - Application framework (preserved)
- Spring WebFlux - New reactive web framework
- Project Reactor - Reactive streams implementation
- Eclipse Paho MQTT Client - MQTT integration (preserved)
- Jackson - JSON serialization (preserved)
- Lombok - Code generation (preserved)

### Integration Points
- MQTT Broker - External message broker
- Frontend Application - React-based web interface
- Container Runtime - Docker deployment environment
- Monitoring Systems - Application observability

## Acceptance Criteria Summary

The WebFlux refactoring will be considered successful when:

1. **All API endpoints migrated** to reactive WebFlux handlers with identical contracts
2. **All RSocket functionality migrated** to WebFlux WebSocket implementation with RSocket completely removed
3. **WebSocket support implemented** replacing RSocket for all real-time communication capabilities
4. **MQTT integration preserved** with reactive stream processing
5. **Performance benchmarks met** showing improved concurrency handling
6. **No breaking changes** introduced to existing client applications
7. **Test suite passes** with maintained or improved coverage
8. **Documentation updated** to reflect new reactive architecture patterns

## Out of Scope

The following items are explicitly out of scope for this refactoring:

- Frontend application modifications
- MQTT broker configuration changes  
- Database integration (none currently exists)
- Authentication/authorization implementation
- API versioning strategy
- Load balancer configuration
- Monitoring and alerting setup changes
- Performance testing infrastructure setup

This specification focuses solely on the backend architecture migration while preserving all existing functionality and integration points.