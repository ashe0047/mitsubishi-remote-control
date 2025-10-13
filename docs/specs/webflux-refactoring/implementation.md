# WebFlux Refactoring - Implementation Plan

## Implementation Overview

This document outlines the step-by-step implementation plan for migrating from Spring Boot MVC + RSocket to Spring Boot WebFlux with WebSocket, following the technical design specifications.

## Phase 1: Dependencies and Configuration Setup

### 1.1 Maven Dependencies Update
**Task**: Update `pom.xml` to add WebFlux and remove RSocket dependencies

**Actions**:
- Add `spring-boot-starter-webflux` dependency
- Remove `spring-boot-starter-rsocket` dependency  
- Verify no dependency conflicts with existing libraries

**Files Modified**:
- `/backend/mitsubishi-controller/pom.xml`

**Success Criteria**:
- Clean Maven build with WebFlux dependencies
- No RSocket dependencies in dependency tree
- All existing dependencies compatible with WebFlux

### 1.2 Application Configuration
**Task**: Update application properties for WebFlux

**Actions**:
- Remove RSocket server configuration properties
- Keep existing MQTT and server configurations
- Add any required WebFlux-specific configuration

**Files Modified**:
- `/backend/mitsubishi-controller/src/main/resources/application.properties`

**Success Criteria**:
- Application starts successfully with WebFlux
- MQTT configuration preserved
- No RSocket configuration references

## Phase 2: Reactive MQTT Service Implementation

### 2.1 Create Reactive MQTT Service
**Task**: Implement `ReactiveMqttService` as adapter for existing MQTT service

**Actions**:
- Create `ReactiveMqttService` class with reactive streams
- Bridge existing MQTT callbacks to `Flux` streams using `Flux.create()`
- Implement reactive command publishing with proper scheduling
- Preserve all existing MQTT functionality

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/service/ReactiveMqttService.java`

**Context7 Documentation Required**:
- Spring WebFlux reactive streams patterns
- Project Reactor Flux.create() usage
- Schedulers.boundedElastic() for blocking operations

**Success Criteria**:
- Reactive streams properly bridge MQTT callbacks
- Commands published successfully through reactive interface
- All existing MQTT functionality preserved
- No memory leaks in stream subscriptions

### 2.2 Event Bridge Implementation
**Task**: Bridge Spring Application Events to reactive streams

**Actions**:
- Modify existing `MqttService` to work with reactive bridge
- Ensure proper event propagation to reactive streams
- Handle connection lifecycle events reactively

**Files Modified**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/service/MqttService.java` (minimal changes)

**Success Criteria**:
- MQTT events properly flow to reactive streams
- Connection state changes reflected in reactive streams
- Event ordering and timing preserved

## Phase 3: Reactive Service Layer

### 3.1 Create Reactive Air Conditioning Service  
**Task**: Implement `ReactiveAirConService` with reactive method signatures

**Actions**:
- Create reactive version of `AirConService`
- Replace `@EventListener` with reactive stream subscriptions
- Implement all CRUD operations returning `Mono<T>` or `Flux<T>`
- Add streaming methods for WebSocket subscriptions
- Preserve all existing business logic and validation

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/service/ReactiveAirConService.java`

**Context7 Documentation Required**:
- Project Reactor Mono and Flux usage patterns
- Reactive validation techniques
- Error handling in reactive streams

**Success Criteria**:
- All service methods return reactive types
- Business logic and validation preserved
- Proper error propagation in reactive chains
- Stream subscriptions work correctly

### 3.2 Service Integration Testing
**Task**: Verify reactive service integration with MQTT

**Actions**:
- Test state updates flow through reactive streams
- Verify command execution via reactive service
- Test error scenarios and recovery
- Performance testing under load

**Success Criteria**:
- State updates propagate correctly
- Commands execute successfully
- Error handling works as expected
- Performance metrics meet requirements

## Phase 4: WebFlux REST API Implementation

### 4.1 Create Router Configuration
**Task**: Implement functional WebFlux routers replacing MVC controllers

**Actions**:
- Create `AirConRouterConfig` with all REST endpoints
- Implement CORS filter for WebFlux
- Add validation and error handling filters
- Configure proper content type handling

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/config/AirConRouterConfig.java`

**Context7 Documentation Required**:
- Spring WebFlux RouterFunction configuration
- Functional filter chains in WebFlux
- WebFlux CORS configuration

**Success Criteria**:
- All REST endpoints accessible via functional routers
- CORS headers configured correctly  
- Validation and error handling working
- Content negotiation working properly

### 4.2 Create Request Handlers
**Task**: Implement `AirConHandler` with reactive request handling

**Actions**:
- Create handler methods for all REST endpoints
- Implement reactive validation
- Add proper error handling and status codes
- Ensure response format compatibility

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/handler/AirConHandler.java`

**Success Criteria**:
- All endpoints return expected response formats
- HTTP status codes match original implementation
- Error responses properly formatted
- Request validation working correctly

### 4.3 REST API Testing
**Task**: Comprehensive testing of WebFlux REST endpoints

**Actions**:
- Test all CRUD operations
- Verify error handling scenarios
- Load testing for concurrent requests
- Response time benchmarking

**Success Criteria**:
- All endpoints functionally equivalent to MVC version
- Performance improved under concurrent load
- Error scenarios handled gracefully

## Phase 5: WebSocket Implementation (RSocket Replacement)

### 5.1 WebSocket Configuration
**Task**: Configure WebFlux WebSocket support

**Actions**:
- Create `WebSocketConfig` with handler mapping
- Configure WebSocket endpoint at `/ws`
- Set up proper WebSocket handler registration

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/config/WebSocketConfig.java`

**Context7 Documentation Required**:
- Spring WebFlux WebSocket configuration
- WebSocketHandler implementation patterns
- WebSocket session management

**Success Criteria**:
- WebSocket endpoint accessible at `/ws`
- WebSocket connections established successfully
- Proper handler registration and routing

### 5.2 WebSocket Protocol Implementation
**Task**: Implement comprehensive WebSocket message handler

**Actions**:
- Create `ReactiveWebSocketHandler` with full protocol support
- Implement request/response pattern for single queries
- Implement subscription pattern for streaming data
- Implement command pattern for AC operations
- Add proper message parsing and validation
- Implement session management and cleanup

**Files Created**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/websocket/ReactiveWebSocketHandler.java`
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/websocket/WebSocketMessage.java`
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/websocket/WebSocketResponse.java`

**Success Criteria**:
- All RSocket functionality replicated in WebSocket
- Message protocol works for all interaction patterns
- Session lifecycle properly managed
- Error handling comprehensive

### 5.3 WebSocket Protocol Testing
**Task**: Test all WebSocket message patterns

**Actions**:
- Test request/response patterns (rooms.list, room.state, etc.)
- Test subscription patterns (state streams, settings streams)
- Test command patterns (power, temperature, mode, etc.)
- Test error scenarios and recovery
- Performance testing for streaming operations

**Success Criteria**:
- All message types work correctly
- Streaming subscriptions work with proper backpressure
- Command execution equivalent to RSocket version
- Error handling robust and informative

## Phase 6: RSocket Removal

### 6.1 Remove RSocket Controllers
**Task**: Delete all RSocket-related code

**Actions**:
- Remove `RSocketController` class
- Remove `RSocketConfig` class  
- Remove all RSocket-related imports
- Clean up unused DTO classes if any

**Files Removed**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/controller/RSocketController.java`
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/config/RSocketConfig.java`

**Success Criteria**:
- No RSocket references in codebase
- Clean compilation without RSocket dependencies
- No dead code remaining

### 6.2 Configuration Cleanup
**Task**: Remove RSocket configuration references

**Actions**:
- Remove RSocket properties from application.properties
- Clean up any RSocket-related Spring configurations
- Verify no RSocket auto-configuration triggers

**Files Modified**:
- `/backend/mitsubishi-controller/src/main/resources/application.properties`

**Success Criteria**:
- No RSocket configuration in properties
- Application starts cleanly without RSocket
- WebSocket is sole real-time protocol

## Phase 7: Legacy MVC Cleanup

### 7.1 Remove MVC Controllers
**Task**: Remove old Spring MVC controllers

**Actions**:
- Remove `AirConController` class
- Remove `CorsConfig` if no longer needed
- Clean up MVC-specific configurations

**Files Removed**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/controller/AirConController.java`
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/config/CorsConfig.java` (if unused)

**Success Criteria**:
- No MVC controller references
- WebFlux handles all HTTP requests
- Clean codebase without legacy code

### 7.2 Legacy Service Cleanup  
**Task**: Remove or refactor legacy service code

**Actions**:
- Keep original `AirConService` if used by reactive version
- Or remove if fully replaced by `ReactiveAirConService`
- Update `MqttService` to work only with reactive bridge
- Clean up unused event classes if needed

**Files Modified/Removed**:
- `/backend/mitsubishi-controller/src/main/java/com/ashelabs/mitsubishicontroller/service/AirConService.java` (remove or keep as needed)

**Success Criteria**:
- No duplicate or conflicting service implementations
- Clean service layer architecture
- Only reactive services in use

## Phase 8: Testing and Validation

### 8.1 Comprehensive Integration Testing
**Task**: End-to-end testing of complete system

**Actions**:
- Create WebSocket client test framework
- Test all REST endpoints with WebTestClient
- Test WebSocket functionality comprehensively
- MQTT integration testing
- Performance benchmarking against original system

**Files Created**:
- `/backend/mitsubishi-controller/src/test/java/com/ashelabs/mitsubishicontroller/integration/WebFluxIntegrationTests.java`
- `/backend/mitsubishi-controller/src/test/java/com/ashelabs/mitsubishicontroller/websocket/WebSocketIntegrationTests.java`

**Context7 Documentation Required**:
- Spring Boot WebFlux testing patterns
- WebTestClient usage
- WebSocket testing frameworks
- StepVerifier for reactive testing

**Success Criteria**:
- All functionality tests pass
- Performance metrics meet or exceed original system
- No regressions in MQTT functionality
- Error scenarios handled properly

### 8.2 Load Testing and Performance Validation
**Task**: Validate performance improvements

**Actions**:
- Concurrent connection testing
- High-frequency message testing
- Memory usage profiling
- CPU utilization analysis
- Response time measurement

**Success Criteria**:
- 10x improvement in concurrent connection handling
- Memory usage within 20% of original system  
- CPU efficiency improved under load
- Response times maintained or improved

## Implementation Checkpoints

### Checkpoint 1: Reactive Foundation (Phases 1-2)
**Validation**:
- WebFlux dependencies integrated successfully
- Reactive MQTT service operational
- MQTT events flowing through reactive streams

### Checkpoint 2: Service Layer (Phase 3)
**Validation**:
- Reactive service layer fully functional
- All business logic preserved
- Integration with MQTT working

### Checkpoint 3: REST API (Phase 4)  
**Validation**:
- WebFlux REST API fully operational
- All endpoints equivalent to original MVC
- Performance benchmarks met

### Checkpoint 4: WebSocket Implementation (Phase 5)
**Validation**:
- WebSocket protocol fully implemented
- All RSocket functionality replicated
- Streaming and command patterns working

### Checkpoint 5: Cleanup (Phases 6-7)
**Validation**:
- All legacy code removed
- Clean codebase with only WebFlux/WebSocket
- No dead code or unused configurations

### Checkpoint 6: Final Validation (Phase 8)
**Validation**:
- Comprehensive testing complete
- Performance goals achieved
- Ready for production deployment

## Risk Mitigation Strategies

### Technical Risks
1. **Reactive Learning Curve**: Use Context7 documentation extensively for WebFlux patterns
2. **WebSocket Complexity**: Implement comprehensive error handling and connection management
3. **Performance Regression**: Continuous benchmarking throughout implementation
4. **Message Protocol Issues**: Thorough testing of all WebSocket message patterns

### Implementation Risks
1. **Incomplete Migration**: Comprehensive checklist for RSocket functionality coverage
2. **Configuration Issues**: Step-by-step validation of each configuration change
3. **Integration Problems**: Early integration testing at each phase
4. **Rollback Complexity**: Maintain git branches for each major phase

## Feedback and Review Points

After each phase implementation, use the `mcp__mcp-feedback-enhanced__interactive_feedback` tool to:
1. Present phase completion summary
2. Demonstrate functionality working
3. Get approval before proceeding to next phase
4. Address any issues or concerns

## Success Metrics

### Functional Success
- [ ] All REST endpoints working identically to original
- [ ] All RSocket functionality replicated in WebSocket  
- [ ] MQTT integration preserved and working
- [ ] Error handling comprehensive and consistent

### Performance Success
- [ ] 10x concurrent connection improvement achieved
- [ ] Memory usage within acceptable limits
- [ ] CPU efficiency improved under load
- [ ] Response times maintained or improved

### Code Quality Success
- [ ] Clean architecture with no legacy code
- [ ] Comprehensive test coverage maintained
- [ ] Documentation updated for new architecture
- [ ] Code maintainability improved or maintained

This implementation plan provides a systematic approach to migrating from MVC + RSocket to WebFlux + WebSocket while maintaining all functionality and improving performance.