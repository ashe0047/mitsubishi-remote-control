# WebSocket Architecture Refactoring - Requirements Specification

**Document Version**: 1.0
**Created**: 2025-01-04
**Status**: Draft
**Priority**: High
**Estimated Effort**: 6-10 days

---

## 1. Executive Summary

### 1.1 Purpose

This specification defines the requirements for refactoring the current WebSocket architecture to comply with clean code principles (DRY, SOLID, YAGNI) and improve maintainability, testability, and extensibility.

### 1.2 Problem Statement

The current WebSocket implementation suffers from:
- **Code duplication**: ~80 lines of duplicate session management, ~40 lines of duplicate serialization
- **SOLID violations**: Single Responsibility (handlers have 7-9 responsibilities), Open/Closed (switch statements throughout), Interface Segregation (no interfaces for components)
- **Oversized components**: QuotaWebSocketHandler (437 lines, 218% over 200-line limit), ReactiveWebSocketHandler (321 lines, 160% over limit)
- **Low testability**: Tight coupling to Spring WebSocketSession, cannot test routing logic independently
- **Limited extensibility**: Adding new message types requires modifying existing switch statements

### 1.3 Goals

**Primary Goals**:
1. **DRY Compliance**: Eliminate all code duplication (target: 9/10 score)
2. **SOLID Compliance**: All components follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles (target: 9/10 score)
3. **Component Size**: All files ≤200 lines (target: 100% compliance)
4. **Testability**: Enable 90%+ unit test coverage with isolated unit tests (target: 9/10 score)
5. **Maintainability**: Clear structure, easy to find and modify code (target: 9/10 score)
6. **Extensibility**: Add new features without modifying existing code (target: 10/10 score)

**Secondary Goals**:
- Zero breaking changes to existing functionality
- Maintain or improve performance (reactive, non-blocking)
- Enable future transport layer replacements (gRPC, HTTP/2)

---

## 2. Business Requirements

### 2.1 Functional Requirements

**FR-1: Preserve Existing Functionality**
- **Priority**: CRITICAL
- **Description**: All existing WebSocket endpoints must function identically after refactoring
- **Acceptance Criteria**:
  - `/ws` endpoint supports all current message types (request, subscribe, unsubscribe, command)
  - `/ws/quota` endpoint supports all current quota messages
  - JWT authentication works without changes
  - All MQTT integration continues to work
  - All quota tracking and alerts continue to work

**FR-2: Message Handling**
- **Priority**: HIGH
- **Description**: Support all current message patterns with improved architecture
- **Message Types**:
  - Request/Response (get rooms, get state, get settings, mqtt status)
  - Streaming subscriptions (room state stream, room settings stream)
  - Commands (power, temperature, mode, fan, vane, wideVane, settings)
  - Quota management (subscribe, unsubscribe, override requests, approvals)
  - Health checks (ping, mqtt status)

**FR-3: Session Management**
- **Priority**: HIGH
- **Description**: Track active WebSocket sessions and their subscriptions
- **Requirements**:
  - Register/unregister sessions on connect/disconnect
  - Track subscriptions per session (quota subscriptions, room subscriptions)
  - Clean up all subscriptions when session disconnects
  - Support concurrent sessions from multiple users

**FR-4: Authentication & Authorization**
- **Priority**: CRITICAL
- **Description**: Maintain JWT authentication for all WebSocket connections
- **Requirements**:
  - Support token in query parameter (`?token=<jwt>`)
  - Support token in Authorization header (`Bearer <jwt>`)
  - Support token in WebSocket subprotocol (`Bearer.<jwt>`)
  - Extract user info (userId, householdId, userRole) from token
  - Store user info in session attributes
  - Reject connections with invalid/missing tokens

**FR-5: Error Handling**
- **Priority**: HIGH
- **Description**: Graceful error handling with proper client feedback
- **Requirements**:
  - JSON parsing errors return error response (not crash)
  - Unknown message types return error response
  - Service errors return error response with details
  - Stream errors log and attempt recovery
  - All errors include correlation ID for debugging

---

### 2.2 Non-Functional Requirements

**NFR-1: Performance**
- **Requirement**: Maintain or improve current performance
- **Metrics**:
  - Message processing latency: <50ms (p95)
  - Concurrent connections: Support 1000+ simultaneous connections
  - Memory usage: No memory leaks, proper cleanup on disconnect
  - CPU usage: Non-blocking, reactive processing (no thread blocking)

**NFR-2: Scalability**
- **Requirement**: Support horizontal scaling in the future
- **Metrics**:
  - Session management designed for distributed deployment
  - No server-local state (or abstracted for Redis/distributed cache)
  - Reactive streams support backpressure

**NFR-3: Maintainability**
- **Requirement**: Easy to understand and modify
- **Metrics**:
  - All components ≤200 lines
  - Clear naming conventions
  - Comprehensive JavaDoc for all public APIs
  - New developer can understand architecture in <1 hour

**NFR-4: Testability**
- **Requirement**: High unit test coverage
- **Metrics**:
  - 90%+ line coverage for all new code
  - All business logic testable without Spring WebSocket infrastructure
  - All commands testable independently
  - All processors testable independently

**NFR-5: Extensibility**
- **Requirement**: Add new features without modifying existing code
- **Metrics**:
  - New message types added via registration, not switch statements
  - New processors added via pipeline configuration
  - New authentication methods added via strategy pattern

---

## 3. Technical Requirements

### 3.1 Architecture Requirements

**TR-1: Layered Architecture**
- **Layer 1: Transport** - WebSocket-specific code (<100 lines per handler)
- **Layer 2: Protocol** - Message parsing, validation, routing (framework-agnostic)
- **Layer 3: Application** - Business logic (commands, queries, subscriptions)
- **Layer 4: Domain** - Services and domain models (existing)

**TR-2: Design Patterns**
- **Command Pattern**: All message types implemented as command objects
- **Chain of Responsibility**: Message processing pipeline (validation → authorization → routing → error handling)
- **Factory Pattern**: Command creation based on message type
- **Template Method**: Common WebSocket handling flow in base class
- **Decorator Pattern**: JWT authentication (existing, preserve)
- **Strategy Pattern**: Message parsing, session management

**TR-3: Dependency Injection**
- All components use constructor injection
- Dependencies on interfaces, not concrete classes
- Spring-managed beans for all services
- No static methods or singletons (except registry)

**TR-4: Clean Code Principles**
- **DRY**: Zero code duplication
- **SOLID**: All principles followed
  - **SRP**: Each class has one responsibility
  - **OCP**: Open for extension, closed for modification
  - **LSP**: Subtypes substitutable for base types
  - **ISP**: Client-specific interfaces
  - **DIP**: Depend on abstractions
- **YAGNI**: Implement only current requirements

---

### 3.2 Component Requirements

**TR-5: Session Manager**
```java
interface WebSocketSessionManager {
    void registerSession(String sessionId, WebSocketSession session);
    void unregisterSession(String sessionId);
    Optional<WebSocketSession> getSession(String sessionId);
    void addSubscription(String sessionId, String key, Disposable subscription);
    void removeSubscription(String sessionId, String key);
    void cleanupSession(String sessionId);
}
```
- **Size**: <150 lines
- **Testability**: Unit testable without WebSocketSession
- **Thread-safety**: Concurrent access safe

**TR-6: Command Pattern**
```java
interface WebSocketCommand<T> {
    Mono<T> execute(WebSocketContext context);
    String getCommandType();
}
```
- **Size**: Each command <100 lines
- **Testability**: Each command unit testable independently
- **Examples**: GetRoomsCommand, SetTemperatureCommand, SubscribeRoomStateCommand

**TR-7: Message Processing Pipeline**
```java
interface MessageProcessor {
    Mono<WebSocketResponse> process(WebSocketMessage message, WebSocketContext context);
    MessageProcessor setNext(MessageProcessor next);
}
```
- **Size**: Each processor <100 lines
- **Processors**: Validation, Authorization, Routing, Error Handling, Logging
- **Configurability**: Pipeline order configurable via Spring

**TR-8: Message Types Extraction**
- Extract all inline sealed interfaces to separate files
- Package structure: `websocket/quota/messages/inbound/`, `websocket/quota/messages/outbound/`
- Each message type in separate file (<100 lines)

**TR-9: Base WebSocket Handler**
```java
abstract class BaseWebSocketHandler implements WebSocketHandler {
    public final Mono<Void> handle(WebSocketSession session);
    protected abstract Mono<Void> onConnect(WebSocketSession session);
    protected abstract Mono<Void> onDisconnect(WebSocketSession session);
}
```
- **Size**: <200 lines
- **Purpose**: Eliminate duplication between handlers

---

### 3.3 Testing Requirements

**TR-10: Unit Tests**
- All commands have unit tests (90%+ coverage)
- All processors have unit tests (100% coverage)
- Session manager has unit tests (100% coverage)
- Message parsers have unit tests (100% coverage)

**TR-11: Integration Tests**
- Full message flow tested (connect → authenticate → send → receive → disconnect)
- All message types tested end-to-end
- Error scenarios tested (invalid JSON, auth failures, service errors)

**TR-12: Load Tests**
- 1000+ concurrent connections
- 100+ messages per second per connection
- Memory leak detection (long-running test)

---

## 4. Success Metrics

### 4.1 Code Quality Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| DRY Score | 4/10 | 9/10 | Code duplication analysis |
| SOLID Compliance | 3/10 | 9/10 | Architecture review |
| Max Component Size | 437 lines | ≤200 lines | Line count |
| Testability Score | 3/10 | 9/10 | Unit test coverage, mocking requirements |
| Maintainability | 4/10 | 9/10 | Developer survey, onboarding time |
| Extensibility | 3/10 | 10/10 | Ease of adding new message types |

### 4.2 Performance Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Message Latency (p95) | TBD | <50ms | Performance tests |
| Concurrent Connections | TBD | 1000+ | Load tests |
| Memory Usage | TBD | No leaks | Memory profiling |
| CPU Usage | TBD | <50% at 1000 connections | Load tests |

### 4.3 Test Coverage Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit Test Coverage | 90%+ | JaCoCo report |
| Integration Test Coverage | 100% of message types | Test execution |
| Load Test Success | Pass 1000 concurrent connections | Load test results |

---

## 5. Constraints and Assumptions

### 5.1 Constraints

**C-1: Zero Breaking Changes**
- All existing functionality must work identically
- No changes to message formats
- No changes to authentication mechanism
- No changes to endpoint paths (`/ws`, `/ws/quota`)

**C-2: Technology Stack**
- Spring Boot 3.5.5
- Java 21
- Project Reactor (reactive streams)
- Jackson for JSON (can abstract, but keep for now)
- JUnit 5 + Mockito for testing

**C-3: Timeline**
- 6-10 days for full implementation
- Phased rollout (Phase 1 → Phase 2 → Phase 3)
- Feature flag for gradual migration

### 5.2 Assumptions

**A-1: Existing Services**
- `ReactiveAirConService` and `QuotaNotificationService` are stable and well-tested
- No changes required to domain services
- Domain models are correct

**A-2: Current Functionality**
- Current WebSocket implementation is functionally correct
- All bugs in current implementation will be preserved (to be fixed separately)

**A-3: Deployment**
- Refactored code will be deployed alongside existing code
- Feature flag controls which implementation is active
- Gradual rollout: 10% → 50% → 100%

---

## 6. Dependencies and Integration Points

### 6.1 Internal Dependencies

- **ReactiveAirConService**: Air conditioner control operations
- **QuotaNotificationService**: Quota update notifications
- **JwtService**: JWT token validation
- **Spring ApplicationEventPublisher**: Quota events (QuotaUpdateEvent, QuotaViolationEvent)

### 6.2 External Dependencies

- **Spring WebFlux**: Reactive WebSocket support
- **Project Reactor**: Reactive streams (Mono, Flux)
- **Jackson**: JSON serialization/deserialization
- **MQTT Broker**: (via services, not direct dependency)

---

## 7. Risk Analysis

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance regression | Medium | High | Performance testing before rollout, feature flag for rollback |
| Breaking changes | Low | Critical | Comprehensive integration tests, parallel implementation |
| Memory leaks | Low | High | Load testing, memory profiling, gradual rollout |
| Complex refactoring | High | Medium | Phased approach, code reviews, pair programming |

### 7.2 Organizational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Timeline overrun | Medium | Medium | Phased approach, Phase 1 delivers value quickly |
| Lack of testing resources | Low | High | Automate testing, CI/CD integration |
| Knowledge transfer | Medium | Medium | Comprehensive documentation, code reviews |

---

## 8. Rollout Plan

### 8.1 Phased Implementation

**Phase 1: Quick Wins** (1-2 days)
- Extract message types to separate files
- Extract WebSocketSessionManager
- Extract message parsers
- **Risk**: LOW, **Value**: HIGH

**Phase 2: Architecture** (3-5 days)
- Implement Command Pattern
- Implement Chain of Responsibility
- **Risk**: MEDIUM, **Value**: VERY HIGH

**Phase 3: Template Method** (2-3 days)
- Create BaseWebSocketHandler
- Refactor both handlers to extend base
- **Risk**: HIGH, **Value**: MEDIUM

### 8.2 Deployment Strategy

1. **Parallel Implementation**: New code alongside old code
2. **Feature Flag**: `websocket.use-refactored-implementation=false` (default)
3. **Gradual Rollout**:
   - Day 1-2: 10% of traffic
   - Day 3-5: 50% of traffic
   - Day 6+: 100% of traffic
4. **Monitoring**: Error rates, latency, memory usage
5. **Rollback Plan**: Disable feature flag if issues detected

---

## 9. Acceptance Criteria

### 9.1 Functional Acceptance

- ✅ All existing WebSocket endpoints work identically
- ✅ All message types handled correctly
- ✅ JWT authentication works
- ✅ Session management works (subscriptions, cleanup)
- ✅ Error handling works (graceful errors, not crashes)

### 9.2 Non-Functional Acceptance

- ✅ All components ≤200 lines
- ✅ 90%+ unit test coverage
- ✅ Zero code duplication (DRY score 9/10)
- ✅ All SOLID principles followed (score 9/10)
- ✅ Performance maintained or improved (p95 <50ms)
- ✅ 1000+ concurrent connections supported

### 9.3 Documentation Acceptance

- ✅ All public APIs have JavaDoc
- ✅ Architecture diagram created
- ✅ Onboarding guide for new developers
- ✅ Migration guide for future refactoring

---

## 10. Future Enhancements

**Post-Refactoring Opportunities** (NOT in scope):
- Replace in-memory session manager with Redis (for clustering)
- Add rate limiting processor to pipeline
- Add caching processor to pipeline
- Add metrics/observability processor
- Replace WebSocket with gRPC (enabled by layered architecture)
- Add GraphQL subscription support (enabled by command pattern)

---

## Appendix A: Current Component Sizes

| Component | Lines | Status |
|-----------|-------|--------|
| QuotaWebSocketHandler | 437 | ❌ 218% over limit |
| ReactiveWebSocketHandler | 321 | ❌ 160% over limit |
| WebSocketJwtAuthHandler | 135 | ✅ Within limit |
| WebSocketConfig | 44 | ✅ Within limit |
| WebSocketMessage | 79 | ✅ Within limit |
| WebSocketResponse | 82 | ✅ Within limit |

---

## Appendix B: Code Duplication Examples

**Session Management** (~80 lines duplicated):
- Both handlers have `ConcurrentMap<String, WebSocketSession> activeSessions`
- Both handlers have `ConcurrentMap<String, ConcurrentMap<String, Disposable>> sessionSubscriptions`
- Both handlers have identical `cleanupSession()` methods

**Message Serialization** (~40 lines duplicated):
- Both handlers serialize/deserialize JSON similarly
- Error handling for JSON processing repeated

**Response Sending** (ReactiveWebSocketHandler - 4 similar methods):
- `sendResponse()`, `sendAck()`, `sendError()`, `sendStreamData()`
- All use similar FluxSink patterns with @SuppressWarnings("unchecked")
