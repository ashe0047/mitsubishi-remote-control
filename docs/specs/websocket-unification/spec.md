# WebSocket Endpoint Unification - Requirements Specification

## 1. Overview

### 1.1 Purpose
Unify the architecture of two WebSocket endpoints (`/ws` for air conditioner control and `/ws/quota` for quota management) by creating a common base handler using the Template Method pattern while maintaining their reactive programming model.

### 1.2 Background
Currently, the application has two WebSocket endpoints with different architectural patterns:
- **`/ws` (Air Conditioner)**: Uses `ReactiveWebSocketHandler` with inline message processing
- **`/ws/quota` (Quota Management)**: Uses `QuotaWebSocketHandler` with Command Pattern (recently refactored)

Both endpoints are reactive (Spring WebFlux) but lack architectural consistency, making maintenance and extension difficult.

### 1.3 Goals
1. **Architectural Consistency**: Establish unified patterns across all WebSocket endpoints
2. **Code Reusability**: Extract common functionality into reusable base components
3. **Maintainability**: Simplify handler logic by delegating to command objects
4. **Extensibility**: Make it easy to add new WebSocket endpoints in the future
5. **Clean Code Compliance**: Eliminate DRY violations and improve SOLID adherence

## 2. Business Requirements

### 2.1 Functional Requirements

#### FR1: Template Method Pattern Implementation
- **FR1.1**: Create `BaseWebSocketHandler` abstract class with Template Method pattern
- **FR1.2**: Define standard lifecycle methods: `authenticate()`, `processSession()`, `handleInbound()`, `handleOutbound()`
- **FR1.3**: Allow subclasses to customize behavior through hook methods

#### FR2: Air Conditioner Endpoint Migration
- **FR2.1**: Migrate `ReactiveWebSocketHandler` to use Command Pattern
- **FR2.2**: Extract message types from inline definitions
- **FR2.3**: Create command implementations for all air conditioner operations
- **FR2.4**: Integrate with `BaseWebSocketHandler`
- **FR2.5**: Maintain all existing functionality without breaking changes

#### FR3: Quota Endpoint Integration
- **FR3.1**: Refactor `QuotaWebSocketHandler` to extend `BaseWebSocketHandler`
- **FR3.2**: Reuse existing Command Pattern implementation
- **FR3.3**: Maintain all existing quota management functionality

#### FR4: Shared Infrastructure
- **FR4.1**: Centralize WebSocket session management
- **FR4.2**: Unify message parsing logic
- **FR4.3**: Standardize error handling patterns
- **FR4.4**: Create shared WebSocketContext abstraction

### 2.2 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Maintain reactive (non-blocking) I/O for all WebSocket operations
- **NFR1.2**: No performance degradation compared to current implementation
- **NFR1.3**: Efficient message routing with O(n) command lookup (acceptable for small command sets)

#### NFR2: Maintainability
- **NFR2.1**: Reduce code duplication by at least 30%
- **NFR2.2**: Keep handler classes under 200 lines
- **NFR2.3**: Keep command classes under 100 lines
- **NFR2.4**: Comprehensive JavaDoc for all public APIs

#### NFR3: Reliability
- **NFR3.1**: Preserve existing error handling behavior
- **NFR3.2**: Maintain WebSocket connection stability
- **NFR3.3**: Graceful session cleanup on disconnect

#### NFR4: Code Quality
- **NFR4.1**: DRY score improvement: 4/10 → 8/10
- **NFR4.2**: SOLID score improvement: 3/10 → 8/10
- **NFR4.3**: Single Responsibility: Each class has one clear purpose
- **NFR4.4**: Open/Closed: Extensible without modifying existing code

## 3. User Stories

### US1: As a Developer
**Story**: As a developer adding a new WebSocket endpoint, I want a clear template to follow so that I can implement it quickly and consistently.

**Acceptance Criteria**:
- [ ] BaseWebSocketHandler provides clear extension points
- [ ] Documentation explains how to create new endpoints
- [ ] Example implementations available for reference
- [ ] Less than 1 day to implement a new basic endpoint

### US2: As a Developer
**Story**: As a developer maintaining WebSocket code, I want consistent patterns across endpoints so that I can understand and modify them easily.

**Acceptance Criteria**:
- [ ] All handlers extend BaseWebSocketHandler
- [ ] All handlers use Command Pattern for message processing
- [ ] Consistent error handling across endpoints
- [ ] Uniform logging patterns

### US3: As a Developer
**Story**: As a developer debugging WebSocket issues, I want clear separation of concerns so that I can quickly identify which component is responsible for specific behavior.

**Acceptance Criteria**:
- [ ] Authentication logic isolated in one place
- [ ] Message parsing isolated in dedicated parsers
- [ ] Business logic isolated in command objects
- [ ] Session management isolated in WebSocketSessionManager

### US4: As a System
**Story**: As the application, I want to maintain reactive programming for all WebSocket operations so that I can handle high concurrency efficiently.

**Acceptance Criteria**:
- [ ] All handlers return Mono<Void> from handle() method
- [ ] All command execute() methods return Mono<Void>
- [ ] No blocking operations in WebSocket pipeline
- [ ] Backpressure properly handled with Flux/Sinks

## 4. Success Metrics

### 4.1 Code Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **DRY Score** | 4/10 | 8/10 | Code duplication analysis |
| **SOLID Score** | 3/10 | 8/10 | Architecture review |
| **Avg Handler Size** | 380 lines | <200 lines | Line count |
| **Avg Command Size** | N/A | <100 lines | Line count |
| **Code Duplication** | ~80 lines | <30 lines | Duplicate code detector |

### 4.2 Architecture Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Handler Coupling** | High | Low | Dependency analysis |
| **Component Cohesion** | Low | High | Responsibility analysis |
| **Extension Points** | 0 | 3+ | Hook method count |
| **Shared Components** | 2 | 5+ | Reusable class count |

### 4.3 Developer Experience
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to Add Endpoint** | <1 day | Developer survey |
| **Code Understanding** | High | Code review feedback |
| **Bug Fix Time** | -30% | Issue tracking |

## 5. Constraints and Assumptions

### 5.1 Technical Constraints
- **TC1**: Must use Spring WebFlux (reactive programming)
- **TC2**: Must maintain Java 21 compatibility
- **TC3**: Must use existing Spring Boot 3.5.5 infrastructure
- **TC4**: Must not break existing WebSocket connections during deployment
- **TC5**: Must maintain backward compatibility with MQTT message formats

### 5.2 Business Constraints
- **BC1**: Codebase is in active development - no production deployment concerns
- **BC2**: No backward compatibility required for internal APIs
- **BC3**: Can delete old code completely - no deprecation needed
- **BC4**: No feature flags or gradual rollout required

### 5.3 Assumptions
- **A1**: Authentication mechanism (JWT) remains unchanged
- **A2**: MQTT integration patterns remain unchanged
- **A3**: Message schemas (Zod validation in frontend) remain unchanged
- **A4**: WebSocket endpoint URLs remain unchanged
- **A5**: Session management requirements remain unchanged

## 6. Dependencies and Integration Points

### 6.1 Internal Dependencies
- **Spring WebFlux**: WebSocket support, reactive streams
- **Project Reactor**: Mono, Flux, Sinks for reactive programming
- **Jackson**: JSON serialization/deserialization
- **Lombok**: Boilerplate reduction
- **WebSocketJwtAuthHandler**: JWT authentication
- **WebSocketSessionManager**: Session lifecycle management
- **CommandRegistry**: Command routing (quota endpoint)

### 6.2 External Dependencies
- **MQTT Broker**: Air conditioner state synchronization
- **Frontend Application**: WebSocket client (React/Next.js)
- **Database**: Quota tracking and persistence

### 6.3 Integration Patterns
- **Inbound**: WebSocket → Parser → Command → Business Logic → MQTT/Database
- **Outbound**: MQTT/Database → Flux/Sink → WebSocket
- **Authentication**: WebSocket → JWT Validation → Session Creation
- **Session Management**: Connection → Registration → Subscription → Cleanup

## 7. Out of Scope

The following items are explicitly **NOT** included in this specification:

- **OS1**: Changes to frontend WebSocket client implementation
- **OS2**: Changes to MQTT broker configuration or message formats
- **OS3**: Changes to JWT authentication mechanism
- **OS4**: Performance optimization beyond maintaining current levels
- **OS5**: Load testing or stress testing
- **OS6**: Migration of existing WebSocket sessions (requires reconnection)
- **OS7**: Multi-tenancy or authorization beyond current implementation
- **OS8**: WebSocket compression or protocol upgrades
- **OS9**: Monitoring, metrics, or observability enhancements

## 8. Acceptance Criteria

### 8.1 Functional Acceptance
- [ ] All air conditioner operations work correctly after migration
- [ ] All quota management operations work correctly after refactoring
- [ ] No regression in existing functionality
- [ ] WebSocket connections establish successfully for both endpoints
- [ ] Messages are processed correctly in both directions
- [ ] Session cleanup works properly on disconnect

### 8.2 Architectural Acceptance
- [ ] BaseWebSocketHandler implements Template Method pattern
- [ ] Both handlers extend BaseWebSocketHandler
- [ ] All message processing uses Command Pattern
- [ ] Shared infrastructure (session manager, context, registry) used by both
- [ ] DRY violations reduced to <30 lines
- [ ] SOLID principles score ≥8/10

### 8.3 Code Quality Acceptance
- [ ] All classes have comprehensive JavaDoc
- [ ] All handlers <200 lines
- [ ] All commands <100 lines
- [ ] No code duplication for common operations
- [ ] Consistent error handling patterns
- [ ] Consistent logging patterns

### 8.4 Documentation Acceptance
- [ ] Architecture diagram showing unified structure
- [ ] Developer guide for adding new endpoints
- [ ] Migration guide documenting changes
- [ ] Code examples for common patterns

## 9. Risks and Mitigation

### 9.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Breaking air conditioner functionality** | Medium | High | Incremental migration, thorough testing |
| **Performance degradation** | Low | Medium | Maintain reactive patterns, benchmark before/after |
| **Increased complexity** | Low | Medium | Clear abstractions, comprehensive documentation |
| **Command Pattern overhead** | Low | Low | Acceptable for small command sets, benefits outweigh costs |

### 9.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Extended development time** | Low | Low | Clear implementation plan, incremental approach |
| **Developer learning curve** | Medium | Low | Documentation, code examples, pair programming |

## 10. Timeline Estimate

Based on previous quota refactoring experience:

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1** | Extract air conditioner message types | 1 day |
| **Phase 2** | Implement air conditioner commands | 2 days |
| **Phase 3** | Create BaseWebSocketHandler | 1 day |
| **Phase 4** | Integrate quota handler with base | 0.5 days |
| **Phase 5** | Integrate air conditioner handler with base | 0.5 days |
| **Phase 6** | Testing and validation | 1 day |
| **Total** | | **6 days** |

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-04 | Claude | Initial specification |
