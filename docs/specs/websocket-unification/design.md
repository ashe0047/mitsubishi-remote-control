# WebSocket Endpoint Unification - Technical Design

## 1. Executive Summary

This design document outlines the technical architecture for unifying two WebSocket endpoints (`/ws` for air conditioner control and `/ws/quota` for quota management) using the Template Method pattern while maintaining reactive programming (Spring WebFlux).

**Key Design Decisions**:
- **Template Method Pattern**: Provides unified workflow with customization hooks
- **Command Pattern**: Isolates message handling logic (already proven in quota endpoint)
- **Factory Pattern**: Simplifies WebSocketContext creation
- **Reactive Programming**: Maintains Mono/Flux throughout entire architecture

**Clean Code Analysis Results**:
- **DRY Score**: 4/10 → 9/10 (eliminates ~55 lines of duplication)
- **SOLID Score**: 3/10 → 8.5/10 (significant improvements in SRP, OCP, DIP)
- **Cohesion**: 4/10 → 9/10 (clear single responsibilities)
- **Coupling**: 3/10 → 8/10 (delegation and interface-based design)

## 2. Clean Code Principles Analysis

### 2.1 DRY (Don't Repeat Yourself) - Score: 4/10 → 9/10

#### Current Violations

| Duplication | Lines | Location |
|-------------|-------|----------|
| Authentication flow | ~15 | Both handlers call `authHandler.authenticate()` |
| Session setup/cleanup | ~20 | SessionManager registration in both handlers |
| Stream merging pattern | ~10 | `session.send(outbound).and(inbound)` in both |
| Error handling | ~5 | `doOnError`, `onErrorResume` patterns duplicated |
| Context creation | ~5 | Extracting claims and creating context |
| **Total** | **~55** | Across 2 handlers |

#### Elimination Strategy

**BaseWebSocketHandler Template Method**:
```java
public abstract class BaseWebSocketHandler implements WebSocketHandler {

    @Override
    public final Mono<Void> handle(WebSocketSession session) {
        return authenticate(session)                    // Common: Authentication
            .flatMap(this::setupSession)                // Common: Session setup
            .flatMap(this::processSession)              // Hook: Custom processing
            .doFinally(signal -> cleanupSession(session)); // Common: Cleanup
    }

    // Common implementation (not duplicated)
    private Mono<WebSocketContext> authenticate(WebSocketSession session) {
        return authHandler.authenticate(session)
            .map(claims -> WebSocketContext.create(session, claims));
    }

    // Hook method (customized by subclasses)
    protected abstract Mono<Void> processSession(WebSocketContext context);
}
```

**Result**: Duplication reduced from ~55 lines to <10 lines (only subclass-specific variations)

### 2.2 SOLID Principles - Score: 3/10 → 8.5/10

#### Single Responsibility Principle (SRP): 3/10 → 9/10

**Current Violations**:
- `ReactiveWebSocketHandler` responsibilities:
  1. Authentication
  2. Message parsing
  3. Business logic (MQTT publishing)
  4. Session management
  5. WebSocket protocol handling

**After Refactoring**:
- `BaseWebSocketHandler`: WebSocket lifecycle management only
- `AirConditionerMessageParser`: Message parsing only
- `SetTemperatureCommand`: Handle temperature messages only
- `WebSocketSessionManager`: Session tracking only
- `CommandRegistry`: Command routing only

**Each class has exactly ONE reason to change.**

#### Open/Closed Principle (OCP): 2/10 → 9/10

**Current Violations**:
- Adding new message types requires modifying handler switch statements
- No extension mechanism for new endpoints

**After Refactoring**:
```java
// Adding new message type = add new command (NO modification to existing code)
@Component
public class NewFeatureCommand implements WebSocketCommand<NewFeatureMessage> {
    @Override
    public Mono<Void> execute(NewFeatureMessage msg, WebSocketContext ctx) { ... }
}

// Adding new endpoint = extend BaseWebSocketHandler (NO modification to base)
@Component
public class NewEndpointHandler extends BaseWebSocketHandler {
    @Override
    protected Mono<Void> processSession(WebSocketContext context) { ... }
}
```

**Open for extension, closed for modification.**

#### Liskov Substitution Principle (LSP): 7/10 → 8/10

**Current State**: Both handlers correctly implement `WebSocketHandler` interface

**After Refactoring**:
- All handlers extend `BaseWebSocketHandler`
- Can substitute any handler where `WebSocketHandler` is expected
- Contract maintained: `Mono<Void> handle(WebSocketSession)`

**LSP maintained and improved with stronger base class contract.**

#### Interface Segregation Principle (ISP): 8/10 → 8/10

**Already Good**:
- `WebSocketHandler` has single method: `handle()`
- `WebSocketCommand<T>` has focused interface: `execute()`, `canHandle()`
- No fat interfaces forcing unnecessary dependencies

**No changes needed - already compliant.**

#### Dependency Inversion Principle (DIP): 5/10 → 8/10

**Current Violations**:
- Handlers depend on concrete `MqttMessagePublisher`
- Handlers depend on concrete service classes

**Improvements**:
```java
// Commands depend on abstractions (injected via Spring)
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {
    private final MqttMessagePublisher mqttPublisher; // Could be interface

    @Override
    public Mono<Void> execute(SetTemperatureMessage msg, WebSocketContext ctx) {
        return Mono.fromRunnable(() -> mqttPublisher.publish(...));
    }
}
```

**Future Enhancement**: Extract `MqttPublisher` interface for full DIP compliance (deferred per YAGNI)

### 2.3 YAGNI (You Ain't Gonna Need It) - Compliance: 9/10

**Avoided Speculative Features**:
- ❌ Not adding: Metrics/monitoring infrastructure
- ❌ Not adding: Rate limiting framework
- ❌ Not adding: Message retry mechanisms
- ❌ Not adding: Advanced routing (Chain of Responsibility deferred)
- ❌ Not adding: WebSocket compression
- ❌ Not adding: Protocol versioning

**Only Implementing Current Needs**:
- ✅ Template Method for common workflow
- ✅ Command Pattern for message handling
- ✅ Message type extraction for type safety
- ✅ Session management for connection tracking

**Can add advanced features later when requirements emerge.**

## 3. Design Pattern Selection and Trade-off Analysis

### 3.1 Template Method Pattern (BaseWebSocketHandler)

#### Evaluation Matrix

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **Complexity** | 3/5 | Simple to understand, well-documented GoF pattern |
| **Maintainability** | 5/5 | Clear extension points, consistent structure across handlers |
| **Testability** | 4/5 | Can test base class and subclasses independently |
| **Performance** | 5/5 | Zero overhead - just method calls in reactive chain |
| **Flexibility** | 4/5 | Good for similar workflows, less flexible for radically different flows |
| **Team Knowledge** | 5/5 | Classic pattern, widely known and understood |
| **Overall Score** | **4.3/5** | **ADOPT** ✅ |

#### Pros and Cons

**Pros**:
- ✅ Eliminates duplication of common workflow (auth → setup → process → cleanup)
- ✅ Provides clear extension points via hook methods
- ✅ Enforces consistent structure across all WebSocket handlers
- ✅ Easy to understand and maintain
- ✅ Supports reactive programming naturally (Mono/Flux in template methods)

**Cons**:
- ⚠️ Tight coupling between base and subclasses (acceptable for unified architecture)
- ⚠️ Less flexible than Strategy pattern for radically different workflows (not needed here)
- ⚠️ Inheritance-based (composition alternative = more complexity for same benefit)

#### Implementation Strategy

```java
public abstract class BaseWebSocketHandler implements WebSocketHandler {

    @Autowired protected WebSocketJwtAuthHandler authHandler;
    @Autowired protected WebSocketSessionManager sessionManager;

    /**
     * Template Method - defines the WebSocket handling workflow
     */
    @Override
    public final Mono<Void> handle(WebSocketSession session) {
        return authenticate(session)
            .flatMap(this::setupSession)
            .flatMap(this::processSession)
            .doFinally(signal -> cleanupSession(session));
    }

    // ========== Invariant Steps (final methods) ==========

    private Mono<WebSocketContext> authenticate(WebSocketSession session) {
        return authHandler.authenticate(session)
            .map(claims -> createContext(session, claims));
    }

    private Mono<WebSocketContext> setupSession(WebSocketContext context) {
        return Mono.fromRunnable(() ->
            sessionManager.registerSession(context.session())
        ).thenReturn(context);
    }

    private void cleanupSession(WebSocketSession session) {
        sessionManager.cleanupSession(session.getId());
    }

    // ========== Hook Methods (customizable by subclasses) ==========

    /**
     * Process WebSocket session - custom implementation per endpoint
     */
    protected abstract Mono<Void> processSession(WebSocketContext context);

    /**
     * Create outbound message stream - custom per endpoint
     */
    protected abstract Flux<WebSocketMessage> createOutboundStream(WebSocketContext context);

    /**
     * Get command registry for message routing
     */
    protected abstract CommandRegistry getCommandRegistry();

    /**
     * Create WebSocket context from session and claims
     */
    protected abstract WebSocketContext createContext(WebSocketSession session, Claims claims);
}
```

### 3.2 Command Pattern (Message Processing)

#### Evaluation Matrix

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **Complexity** | 3/5 | Moderate - requires command registry and multiple classes |
| **Maintainability** | 5/5 | Each command is isolated, easy to modify |
| **Testability** | 5/5 | Commands are independently testable units |
| **Performance** | 4/5 | O(n) command lookup acceptable for small command sets (~6-10) |
| **Flexibility** | 5/5 | Very flexible - add/remove/modify commands without touching handler |
| **Team Knowledge** | 4/5 | Well-known pattern, proven success in quota endpoint |
| **Overall Score** | **4.4/5** | **ADOPT** ✅ (Already proven) |

#### Pros and Cons

**Pros**:
- ✅ Already successfully implemented in `QuotaWebSocketHandler`
- ✅ Isolates message handling logic (SRP compliance)
- ✅ Open for extension - add new commands without modifying existing code (OCP)
- ✅ Highly testable - mock dependencies easily
- ✅ Supports reactive programming - `execute()` returns `Mono<Void>`

**Cons**:
- ⚠️ More classes than inline switch statement (acceptable trade-off for maintainability)
- ⚠️ O(n) command lookup (acceptable for <10 commands, can optimize later if needed)

#### Command Interface

```java
public interface WebSocketCommand<T> {
    /**
     * Execute command with given message and context
     * @return Mono that completes when command execution finishes
     */
    Mono<Void> execute(T message, WebSocketContext context);

    /**
     * Check if this command can handle the given message
     */
    boolean canHandle(Object message);
}
```

#### Example Command Implementation

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {

    private final MqttMessagePublisher mqttPublisher;

    @Override
    public Mono<Void> execute(SetTemperatureMessage message, WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            log.debug("Setting temperature to {} for room {}",
                message.temperature(), context.roomId());
            mqttPublisher.publishTemperature(context.roomId(), message.temperature());
        }).then();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetTemperatureMessage;
    }
}
```

### 3.3 Chain of Responsibility Pattern (Deferred)

#### Evaluation Matrix

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **Complexity** | 4/5 | More complex than Command - chain management overhead |
| **Maintainability** | 4/5 | Chain can be harder to debug than flat command list |
| **Testability** | 3/5 | Testing chain interactions more complex |
| **Performance** | 4/5 | O(n) chain traversal |
| **Flexibility** | 5/5 | Very flexible - can add middleware, validators, transformers |
| **Team Knowledge** | 4/5 | Well-known but less commonly used than Command |
| **Overall Score** | **4.0/5** | **DEFER** ⏸️ |

#### Decision Rationale

**Why Defer**:
- Command Pattern sufficient for current message routing needs
- No middleware requirements identified (validation, transformation, logging)
- YAGNI principle - don't add until proven need
- Can add later without breaking existing architecture

**When to Reconsider**:
- If cross-cutting concerns emerge (auth validation, rate limiting, logging)
- If message preprocessing pipeline needed
- If dynamic routing rules required

### 3.4 Factory Pattern (WebSocketContext)

#### Evaluation Matrix

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **Complexity** | 2/5 | Very simple - static factory method |
| **Maintainability** | 5/5 | Isolates object creation logic |
| **Testability** | 5/5 | Easy to test and mock |
| **Performance** | 5/5 | Zero overhead - just object creation |
| **Flexibility** | 4/5 | Easy to extend with builder pattern if needed |
| **Team Knowledge** | 5/5 | Extremely common, universally known |
| **Overall Score** | **4.3/5** | **ADOPT** ✅ |

#### Implementation

```java
public record WebSocketContext(
    WebSocketSession session,
    String sessionId,
    String familyMemberId,
    String roomId,
    String quotaId // Nullable for air conditioner endpoint
) {
    /**
     * Factory method for quota endpoint context
     */
    public static WebSocketContext createForQuota(
        WebSocketSession session,
        String familyMemberId,
        String roomId,
        String quotaId
    ) {
        return new WebSocketContext(session, session.getId(), familyMemberId, roomId, quotaId);
    }

    /**
     * Factory method for air conditioner endpoint context
     */
    public static WebSocketContext createForAirConditioner(
        WebSocketSession session,
        String familyMemberId,
        String roomId
    ) {
        return new WebSocketContext(session, session.getId(), familyMemberId, roomId, null);
    }
}
```

## 4. Architecture Quality Assessment

### 4.1 Cohesion Analysis: 4/10 → 9/10

#### Current State (Low Cohesion)

**ReactiveWebSocketHandler** (Mixed Responsibilities):
- ❌ WebSocket protocol handling
- ❌ JWT authentication
- ❌ Message parsing and validation
- ❌ Business logic (MQTT publishing)
- ❌ Session lifecycle management
- **Cohesion Score: 3/10** - Too many unrelated responsibilities

**QuotaWebSocketHandler** (Before Refactor):
- Similar mixed responsibilities
- **Cohesion Score: 3/10**

#### After Refactoring (High Cohesion)

| Component | Single Responsibility | Cohesion Score |
|-----------|----------------------|----------------|
| **BaseWebSocketHandler** | WebSocket lifecycle management | 9/10 |
| **AirConditionerWebSocketHandler** | Air conditioner-specific session processing | 9/10 |
| **QuotaWebSocketHandler** | Quota-specific session processing | 9/10 |
| **AirConditionerMessageParser** | Parse air conditioner messages | 10/10 |
| **QuotaMessageParser** | Parse quota messages | 10/10 |
| **SetTemperatureCommand** | Handle temperature setting | 10/10 |
| **SubscribeQuotaCommand** | Handle quota subscription | 10/10 |
| **WebSocketSessionManager** | Session lifecycle tracking | 10/10 |
| **CommandRegistry** | Route messages to commands | 9/10 |

**Average Cohesion: 9.3/10** ✅

### 4.2 Coupling Analysis: 3/10 → 8/10

#### Current State (High Coupling)

**ReactiveWebSocketHandler Dependencies**:
```
ReactiveWebSocketHandler
├── WebSocketJwtAuthHandler (tight coupling)
├── MqttMessagePublisher (tight coupling)
├── WebSocketSessionManager (tight coupling)
├── Jackson ObjectMapper (tight coupling)
└── WebSocket session state (tight coupling)
```

**Issues**:
- Direct dependencies on concrete implementations
- Hard to test (requires mocking all dependencies)
- Changes in dependencies affect handler

**Coupling Score: 3/10** - High coupling

#### After Refactoring (Low Coupling)

**Dependency Structure**:
```
BaseWebSocketHandler (abstract)
├── WebSocketJwtAuthHandler (injected, could be interface)
└── WebSocketSessionManager (injected, could be interface)

AirConditionerWebSocketHandler extends BaseWebSocketHandler
├── CommandRegistry (injected, interface-based)
├── AirConditionerMessageParser (injected, focused responsibility)
└── Sinks (injected as Spring beans)

SetTemperatureCommand
└── MqttMessagePublisher (injected, could be interface)
```

**Improvements**:
- ✅ Delegation pattern reduces direct coupling
- ✅ Dependency injection enables loose coupling
- ✅ Interface-based dependencies (CommandRegistry, WebSocketCommand)
- ✅ Each component has minimal dependencies
- ✅ Easy to test with mocks

**Coupling Score: 8/10** ✅

### 4.3 Separation of Concerns

#### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: WebSocket Infrastructure                          │
│  - BaseWebSocketHandler (lifecycle)                         │
│  - WebSocketContext (session context)                       │
│  - WebSocketSessionManager (session tracking)               │
└─────────────────────────────────────────────────────────────┘
                            ↓ delegates to
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Message Processing                                 │
│  - AirConditionerMessageParser / QuotaMessageParser         │
│  - CommandRegistry (routing)                                │
└─────────────────────────────────────────────────────────────┘
                            ↓ delegates to
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Business Logic                                     │
│  - SetTemperatureCommand, SetModeCommand, etc.              │
│  - SubscribeQuotaCommand, OverrideRequestCommand, etc.      │
└─────────────────────────────────────────────────────────────┘
                            ↓ delegates to
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: External Integration                               │
│  - MqttMessagePublisher (MQTT broker)                       │
│  - QuotaService (database)                                  │
│  - ViolationService (database)                              │
└─────────────────────────────────────────────────────────────┘
```

#### Dependency Direction

**Follows Clean Architecture**:
- Dependencies flow **inward** (Infrastructure → Business Logic → Domain)
- Outer layers depend on inner layers, never reverse
- Business logic (commands) independent of infrastructure
- Can swap infrastructure without touching business logic

#### Cross-Cutting Concerns

| Concern | Implementation | Layer |
|---------|---------------|-------|
| **Authentication** | WebSocketJwtAuthHandler | Infrastructure |
| **Session Management** | WebSocketSessionManager | Infrastructure |
| **Error Handling** | Reactive error operators (onErrorResume) | All layers |
| **Logging** | SLF4J in each component | All layers |
| **Serialization** | Jackson ObjectMapper in parsers | Message Processing |

## 5. Component Design

### 5.1 BaseWebSocketHandler (Template Method)

#### Responsibilities
- Define standard WebSocket handling workflow
- Enforce authentication before message processing
- Ensure session registration and cleanup
- Provide hook methods for endpoint-specific behavior

#### Class Diagram

```
┌────────────────────────────────────────────────┐
│        BaseWebSocketHandler (abstract)         │
├────────────────────────────────────────────────┤
│ # authHandler: WebSocketJwtAuthHandler         │
│ # sessionManager: WebSocketSessionManager      │
├────────────────────────────────────────────────┤
│ + handle(session): Mono<Void>        [FINAL]   │
│ - authenticate(session): Mono<Context> [FINAL] │
│ - setupSession(context): Mono<Context> [FINAL] │
│ - cleanupSession(session): void       [FINAL]  │
│ # processSession(context): Mono<Void> [HOOK]   │
│ # createOutboundStream(ctx): Flux     [HOOK]   │
│ # getCommandRegistry(): Registry      [HOOK]   │
│ # createContext(...): Context         [HOOK]   │
└────────────────────────────────────────────────┘
                        △
                        │ extends
        ┌───────────────┴───────────────┐
        │                               │
┌──────────────────────┐   ┌────────────────────────┐
│ AirConditioner       │   │ QuotaWebSocket         │
│ WebSocketHandler     │   │ Handler                │
├──────────────────────┤   ├────────────────────────┤
│ - commandRegistry    │   │ - commandRegistry      │
│ - messageParser      │   │ - messageParser        │
│ - statusUpdateSink   │   │ - quotaUpdateSink      │
│ - tempUpdateSink     │   │ - violationAlertSink   │
├──────────────────────┤   ├────────────────────────┤
│ # processSession()   │   │ # processSession()     │
│ # createOutbound()   │   │ # createOutbound()     │
│ # getRegistry()      │   │ # getRegistry()        │
│ # createContext()    │   │ # createContext()      │
└──────────────────────┘   └────────────────────────┘
```

#### Key Methods

```java
/**
 * Template Method - defines invariant workflow
 * FINAL - subclasses cannot override
 */
@Override
public final Mono<Void> handle(WebSocketSession session) {
    return authenticate(session)
        .flatMap(this::setupSession)
        .flatMap(this::processSession)
        .doFinally(signal -> cleanupSession(session));
}

/**
 * Hook Method - subclasses provide custom processing
 * ABSTRACT - must be implemented
 */
protected abstract Mono<Void> processSession(WebSocketContext context);
```

### 5.2 Message Type Extraction

#### Air Conditioner Message Types

**Package Structure**:
```
websocket/airconditioner/messages/
├── AirConditionerInboundMessage.java (interface)
├── AirConditionerOutboundMessage.java (interface)
├── inbound/
│   ├── SetTemperatureMessage.java
│   ├── SetModeMessage.java
│   ├── SetFanSpeedMessage.java
│   ├── SetPowerMessage.java
│   ├── SetSwingMessage.java
│   └── GetStatusMessage.java
└── outbound/
    ├── StatusUpdateMessage.java
    ├── TemperatureUpdateMessage.java
    ├── ErrorMessage.java
    └── AckMessage.java
```

#### Message Type Definitions

**Inbound Messages** (Client → Server):

```java
// Base interface
public interface AirConditionerInboundMessage {}

// Concrete messages
public record SetTemperatureMessage(
    String type,
    double temperature
) implements AirConditionerInboundMessage {}

public record SetModeMessage(
    String type,
    String mode  // "cool", "heat", "fan", "dry", "auto"
) implements AirConditionerInboundMessage {}

public record SetFanSpeedMessage(
    String type,
    String fanSpeed  // "low", "medium", "high", "auto"
) implements AirConditionerInboundMessage {}

public record SetPowerMessage(
    String type,
    boolean power
) implements AirConditionerInboundMessage {}

public record SetSwingMessage(
    String type,
    String swing  // "auto", "1", "2", "3", "4", "5", "swing"
) implements AirConditionerInboundMessage {}

public record GetStatusMessage(
    String type
) implements AirConditionerInboundMessage {}
```

**Outbound Messages** (Server → Client):

```java
// Base interface
public interface AirConditionerOutboundMessage {}

// Status update with payload
public record StatusUpdateMessage(
    String type,
    StatusUpdatePayload payload
) implements AirConditionerOutboundMessage {}

public record StatusUpdatePayload(
    String roomId,
    String mode,
    double targetTemperature,
    String fanSpeed,
    boolean power,
    String swing
) {}

// Temperature update with payload
public record TemperatureUpdateMessage(
    String type,
    TemperatureUpdatePayload payload
) implements AirConditionerOutboundMessage {}

public record TemperatureUpdatePayload(
    String roomId,
    double currentTemperature,
    long timestamp
) {}

// Error message
public record ErrorMessage(
    String type,
    String error,
    String message
) implements AirConditionerOutboundMessage {}

// Acknowledgment
public record AckMessage(
    String type,
    String command,
    boolean success
) implements AirConditionerOutboundMessage {}
```

### 5.3 Air Conditioner Command Implementations

#### Command Structure

```
websocket/airconditioner/command/
├── SetTemperatureCommand.java
├── SetModeCommand.java
├── SetFanSpeedCommand.java
├── SetPowerCommand.java
├── SetSwingCommand.java
└── GetStatusCommand.java
```

#### Example Command: SetTemperatureCommand

```java
package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.mqtt.MqttMessagePublisher;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetTemperatureMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Command to handle temperature setting requests for air conditioners.
 * Publishes temperature changes to MQTT broker for device control.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {

    private final MqttMessagePublisher mqttPublisher;

    @Override
    public Mono<Void> execute(SetTemperatureMessage message, WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            double temperature = message.temperature();
            String roomId = context.roomId();

            log.debug("Setting temperature to {}°C for room {}", temperature, roomId);

            // Validate temperature range
            if (temperature < 16 || temperature > 30) {
                log.warn("Temperature {} out of range [16-30] for room {}", temperature, roomId);
                throw new IllegalArgumentException("Temperature must be between 16-30°C");
            }

            // Publish to MQTT
            mqttPublisher.publishTemperature(roomId, temperature);

            log.info("Temperature set to {}°C for room {}", temperature, roomId);
        }).then();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetTemperatureMessage;
    }
}
```

**Key Characteristics**:
- ✅ Single Responsibility: Only handles temperature setting
- ✅ ~70 lines (within target)
- ✅ Reactive: Returns `Mono<Void>`
- ✅ Validation included
- ✅ Logging for debugging
- ✅ Injected dependencies

#### Command Registry Integration

Commands are automatically discovered via Spring component scanning:

```java
@Slf4j
@Component
public class CommandRegistry {

    private final List<WebSocketCommand<?>> commands = new CopyOnWriteArrayList<>();

    @Autowired
    public CommandRegistry(List<WebSocketCommand<?>> commands) {
        this.commands.addAll(commands);
        log.info("Registered {} WebSocket commands", commands.size());
    }

    @SuppressWarnings("unchecked")
    public Mono<Void> executeCommand(Object message, WebSocketContext context) {
        return commands.stream()
            .filter(cmd -> cmd.canHandle(message))
            .findFirst()
            .map(cmd -> ((WebSocketCommand<Object>) cmd).execute(message, context))
            .orElseGet(() -> {
                log.warn("No command found for message type: {}", message.getClass().getSimpleName());
                return Mono.empty();
            });
    }
}
```

### 5.4 Message Parser Design

#### AirConditionerMessageParser

```java
package com.ashelabs.turing.websocket.airconditioner.parser;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Parser for air conditioner WebSocket messages.
 * Detects message type from "type" field and deserializes to appropriate message class.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AirConditionerMessageParser {

    private final ObjectMapper objectMapper;

    /**
     * Parse inbound message from JSON string
     * @param json JSON message from WebSocket client
     * @return Mono with typed message object
     */
    public Mono<AirConditionerInboundMessage> parseInboundMessage(String json) {
        return Mono.fromCallable(() -> {
            JsonNode node = objectMapper.readTree(json);
            String type = extractType(node);

            return switch (type) {
                case "SET_TEMPERATURE" -> parseSetTemperature(node);
                case "SET_MODE" -> parseSetMode(node);
                case "SET_FAN_SPEED" -> parseSetFanSpeed(node);
                case "SET_POWER" -> parseSetPower(node);
                case "SET_SWING" -> parseSetSwing(node);
                case "GET_STATUS" -> parseGetStatus(node);
                default -> throw new IllegalArgumentException("Unknown message type: " + type);
            };
        }).doOnError(e -> log.error("Failed to parse air conditioner message: {}", json, e));
    }

    private String extractType(JsonNode node) {
        if (!node.has("type")) {
            throw new IllegalArgumentException("Message missing 'type' field");
        }
        return node.get("type").asText();
    }

    private SetTemperatureMessage parseSetTemperature(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetTemperatureMessage.class);
    }

    private SetModeMessage parseSetMode(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetModeMessage.class);
    }

    private SetFanSpeedMessage parseSetFanSpeed(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetFanSpeedMessage.class);
    }

    private SetPowerMessage parseSetPower(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetPowerMessage.class);
    }

    private SetSwingMessage parseSetSwing(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetSwingMessage.class);
    }

    private GetStatusMessage parseGetStatus(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, GetStatusMessage.class);
    }
}
```

**Responsibilities**:
- Parse JSON to typed message objects
- Type detection via "type" field
- Validation (Jackson performs schema validation)
- Error handling for malformed messages

### 5.5 Handler Integration

#### AirConditionerWebSocketHandler

```java
package com.ashelabs.turing.websocket;

import com.ashelabs.turing.websocket.airconditioner.messages.outbound.*;
import com.ashelabs.turing.websocket.airconditioner.parser.AirConditionerMessageParser;
import com.ashelabs.turing.websocket.core.BaseWebSocketHandler;
import com.ashelabs.turing.websocket.core.CommandRegistry;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

/**
 * WebSocket handler for air conditioner control endpoint (/ws).
 * Extends BaseWebSocketHandler to inherit standard workflow.
 */
@Slf4j
@Component("airConditionerWebSocketHandler")
@RequiredArgsConstructor
public class AirConditionerWebSocketHandler extends BaseWebSocketHandler {

    private final CommandRegistry commandRegistry;
    private final AirConditionerMessageParser messageParser;
    private final Sinks.Many<StatusUpdateMessage> statusUpdateSink;
    private final Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink;

    @Override
    protected Mono<Void> processSession(WebSocketContext context) {
        Flux<WebSocketMessage> outbound = createOutboundStream(context);
        Flux<Void> inbound = createInboundStream(context);

        return context.session().send(outbound).and(inbound);
    }

    @Override
    protected Flux<WebSocketMessage> createOutboundStream(WebSocketContext context) {
        Flux<WebSocketMessage> statusUpdates = statusUpdateSink.asFlux()
            .filter(msg -> msg.payload().roomId().equals(context.roomId()))
            .map(this::toWebSocketMessage);

        Flux<WebSocketMessage> temperatureUpdates = temperatureUpdateSink.asFlux()
            .filter(msg -> msg.payload().roomId().equals(context.roomId()))
            .map(this::toWebSocketMessage);

        return Flux.merge(statusUpdates, temperatureUpdates);
    }

    private Flux<Void> createInboundStream(WebSocketContext context) {
        return context.session().receive()
            .map(WebSocketMessage::getPayloadAsText)
            .flatMap(messageParser::parseInboundMessage)
            .flatMap(msg -> commandRegistry.executeCommand(msg, context))
            .doOnError(e -> log.error("Error processing inbound message for room {}",
                context.roomId(), e))
            .onErrorResume(e -> Mono.empty());
    }

    @Override
    protected CommandRegistry getCommandRegistry() {
        return commandRegistry;
    }

    @Override
    protected WebSocketContext createContext(WebSocketSession session, Claims claims) {
        String familyMemberId = claims.getSubject();
        String roomId = extractRoomId(session);
        return WebSocketContext.createForAirConditioner(session, familyMemberId, roomId);
    }

    private String extractRoomId(WebSocketSession session) {
        // Extract from query parameters or path
        return session.getHandshakeInfo()
            .getUri()
            .getQuery()
            .split("roomId=")[1]
            .split("&")[0];
    }

    private WebSocketMessage toWebSocketMessage(Object message) {
        // Serialize message to JSON using Jackson
        // Implementation details...
    }
}
```

**Size**: ~120 lines (within target <200)

**Responsibilities**:
- Air conditioner-specific session processing
- Outbound stream creation (status and temperature updates)
- Inbound stream processing (delegates to commands)
- Context creation for air conditioner endpoint

## 6. Architecture Refactoring Opportunities

### 6.1 Extract MqttPublisher Interface (DIP Improvement)

**Current State**: Commands depend on concrete `MqttMessagePublisher`

**Proposed Refactoring**:

```java
// New interface
public interface MqttPublisher {
    void publishTemperature(String roomId, double temperature);
    void publishMode(String roomId, String mode);
    void publishFanSpeed(String roomId, String fanSpeed);
    void publishPower(String roomId, boolean power);
    void publishSwing(String roomId, String swing);
}

// Existing class implements interface
@Component
public class MitsubishiMqttPublisher implements MqttPublisher {
    // Existing implementation
}

// Commands depend on abstraction
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {
    private final MqttPublisher mqttPublisher; // Interface, not concrete class
    // ...
}
```

**Benefits**:
- ✅ Full DIP compliance
- ✅ Easier to test (mock interface)
- ✅ Can swap MQTT implementation

**Effort**: Low (1-2 hours)
**Priority**: Medium (improves testability)
**Decision**: **DEFER** per YAGNI - implement when testing infrastructure is set up

### 6.2 WebSocketContext Enhancement

**Current State**: Basic record with fields

**Potential Enhancement**:

```java
public record WebSocketContext(...) {

    /**
     * Send message to WebSocket client
     */
    public Mono<Void> sendMessage(WebSocketMessage message) {
        return session.send(Mono.just(message)).then();
    }

    /**
     * Send error message to client
     */
    public Mono<Void> sendError(String error, String message) {
        ErrorMessage errorMsg = new ErrorMessage("ERROR", error, message);
        return sendMessage(toWebSocketMessage(errorMsg));
    }
}
```

**YAGNI Analysis**:
- Only add if used in 2+ places
- Current design: Commands publish to MQTT, don't send direct WebSocket messages
- **Decision**: **DEFER** until proven need

### 6.3 Session Cleanup Hooks

**Current State**: `WebSocketSessionManager` handles cleanup

**Potential Enhancement**:

```java
public abstract class BaseWebSocketHandler {

    @Override
    public final Mono<Void> handle(WebSocketSession session) {
        return authenticate(session)
            .flatMap(this::setupSession)
            .flatMap(this::processSession)
            .doFinally(signal -> {
                cleanupSession(session);
                onSessionClosed(session); // Hook for subclasses
            });
    }

    /**
     * Hook called when session is closed
     * Default: no-op, subclasses can override
     */
    protected void onSessionClosed(WebSocketSession session) {
        // Default: do nothing
    }
}
```

**YAGNI Analysis**:
- No current use case for custom cleanup logic
- `WebSocketSessionManager` sufficient
- **Decision**: **DEFER** until proven need

### 6.4 Summary of Refactoring Decisions

| Refactoring | Benefit | Effort | YAGNI Check | Decision |
|-------------|---------|--------|-------------|----------|
| **MqttPublisher Interface** | Better testability, DIP compliance | Low | Will be needed for testing | **DEFER** (add with test infrastructure) |
| **WebSocketContext Helpers** | Convenience methods | Low | Not used yet | **DEFER** |
| **Session Cleanup Hooks** | Extensibility | Low | No use case identified | **DEFER** |
| **Chain of Responsibility** | Middleware support | Medium | No middleware requirements | **DEFER** |

**Focus**: Core unification (Template Method + Command Pattern). Add enhancements when proven necessary.

## 7. Data Flow Diagrams

### 7.1 Inbound Message Flow (Client → Server)

```
┌──────────────┐
│ WebSocket    │
│ Client       │
│ (Frontend)   │
└──────┬───────┘
       │ 1. Send JSON message
       ↓
┌──────────────────────────────────────────────────┐
│ WebSocketSession                                 │
│ (Spring WebFlux)                                 │
└──────┬───────────────────────────────────────────┘
       │ 2. Receive message
       ↓
┌──────────────────────────────────────────────────┐
│ BaseWebSocketHandler.handle()                    │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. authenticate(session)                   │   │
│ │    → JWT validation                        │   │
│ │ 2. setupSession(context)                   │   │
│ │    → Register in SessionManager            │   │
│ │ 3. processSession(context) [HOOK]          │   │
│ │    → Delegated to subclass                 │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 3. processSession() delegates
       ↓
┌──────────────────────────────────────────────────┐
│ AirConditionerWebSocketHandler.processSession()  │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. session.receive() - get raw message    │   │
│ │ 2. getPayloadAsText() - extract JSON      │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 4. Parse message
       ↓
┌──────────────────────────────────────────────────┐
│ AirConditionerMessageParser.parse()              │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. objectMapper.readTree(json)             │   │
│ │ 2. extract "type" field                    │   │
│ │ 3. switch(type) → deserialize to class     │   │
│ │ 4. return SetTemperatureMessage            │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 5. Typed message
       ↓
┌──────────────────────────────────────────────────┐
│ CommandRegistry.executeCommand()                 │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. Find command where canHandle(msg)       │   │
│ │ 2. Cast to WebSocketCommand<Object>        │   │
│ │ 3. command.execute(message, context)       │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 6. Route to command
       ↓
┌──────────────────────────────────────────────────┐
│ SetTemperatureCommand.execute()                  │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. Extract temperature and roomId          │   │
│ │ 2. Validate temperature range              │   │
│ │ 3. mqttPublisher.publish(roomId, temp)     │   │
│ │ 4. return Mono.empty()                     │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 7. Publish to MQTT
       ↓
┌──────────────────────────────────────────────────┐
│ MqttMessagePublisher                             │
│ → MQTT Broker                                    │
│ → Mitsubishi AC Unit                             │
└──────────────────────────────────────────────────┘
```

**Key Points**:
- Reactive chain maintained throughout (Mono/Flux)
- Clear separation of concerns at each layer
- Type safety via message classes
- Command isolation for business logic

### 7.2 Outbound Message Flow (Server → Client)

```
┌──────────────────────────────────────────────────┐
│ MQTT Broker                                      │
│ (Status updates from AC unit)                    │
└──────┬───────────────────────────────────────────┘
       │ 1. MQTT message received
       ↓
┌──────────────────────────────────────────────────┐
│ MqttSubscriber / External Service                │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. Parse MQTT message                      │   │
│ │ 2. Create StatusUpdateMessage              │   │
│ │ 3. statusUpdateSink.tryEmitNext(msg)       │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 2. Emit to sink
       ↓
┌──────────────────────────────────────────────────┐
│ Sinks.Many<StatusUpdateMessage>                  │
│ (Spring bean, shared across handlers)            │
└──────┬───────────────────────────────────────────┘
       │ 3. Flux subscription
       ↓
┌──────────────────────────────────────────────────┐
│ AirConditionerWebSocketHandler                   │
│   .createOutboundStream(context)                 │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. statusUpdateSink.asFlux()               │   │
│ │ 2. filter(msg.roomId == context.roomId)    │   │
│ │ 3. map(this::toWebSocketMessage)           │   │
│ └────────────────────────────────────────────┘   │
└──────┬───────────────────────────────────────────┘
       │ 4. Filtered stream
       ↓
┌──────────────────────────────────────────────────┐
│ session.send(outboundFlux)                       │
│ (Reactive WebSocket send)                        │
└──────┬───────────────────────────────────────────┘
       │ 5. Send to client
       ↓
┌──────────────────────────────────────────────────┐
│ WebSocket Client (Frontend)                      │
│ ┌────────────────────────────────────────────┐   │
│ │ 1. Receive WebSocket message               │   │
│ │ 2. Parse JSON                              │   │
│ │ 3. Update UI (Zustand store)               │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Key Points**:
- Sinks provide multicast streams (multiple sessions can subscribe)
- Filtering ensures messages only go to relevant rooms
- Reactive backpressure handled by Flux/Sinks
- Real-time updates without polling

### 7.3 Complete Request/Response Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WebSocket Lifecycle                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CLIENT CONNECTS                                                     │
│     ↓                                                                   │
│  2. BaseWebSocketHandler.handle()                                       │
│     ├─→ authenticate(session) - JWT validation                          │
│     ├─→ setupSession(context) - Register session                        │
│     └─→ processSession(context) - Start bidirectional stream            │
│                                                                         │
│  3. BIDIRECTIONAL STREAMING ACTIVE                                      │
│                                                                         │
│     ┌────────────────────┐          ┌────────────────────┐             │
│     │  INBOUND STREAM    │          │  OUTBOUND STREAM   │             │
│     │  (Client → Server) │          │  (Server → Client) │             │
│     └────────┬───────────┘          └────────┬───────────┘             │
│              │                               │                         │
│              ↓                               ↓                         │
│     session.receive()                statusUpdateSink.asFlux()         │
│              ↓                               ↓                         │
│     messageParser.parse()            filter(roomId matches)            │
│              ↓                               ↓                         │
│     commandRegistry.execute()        map(toWebSocketMessage)           │
│              ↓                               ↓                         │
│     command.execute()                session.send()                    │
│              ↓                               ↓                         │
│     mqttPublisher.publish()          WebSocket Client receives         │
│                                                                         │
│  4. CLIENT DISCONNECTS / ERROR OCCURS                                   │
│     ↓                                                                   │
│  5. doFinally(cleanupSession)                                           │
│     └─→ sessionManager.cleanupSession() - Remove session                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8. Configuration and Dependency Injection

### 8.1 Spring Bean Configuration

#### WebSocket Endpoint Registration

```java
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping(
        AirConditionerWebSocketHandler airConditionerHandler,
        QuotaWebSocketHandler quotaHandler
    ) {
        Map<String, WebSocketHandler> handlerMap = Map.of(
            "/ws", airConditionerHandler,
            "/ws/quota", quotaHandler
        );

        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(handlerMap);
        mapping.setOrder(1);
        return mapping;
    }
}
```

#### Sink Bean Configuration

```java
@Configuration
public class AirConditionerWebSocketConfig {

    @Bean
    public Sinks.Many<StatusUpdateMessage> statusUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    @Bean
    public Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }
}
```

**Rationale**: Sinks as beans allow sharing across components (publisher and handler)

### 8.2 Command Auto-Discovery

Commands are automatically discovered via Spring component scanning:

```java
@Component
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> { }

@Component
public class SetModeCommand implements WebSocketCommand<SetModeMessage> { }

// CommandRegistry receives all commands via constructor injection
@Component
public class CommandRegistry {
    @Autowired
    public CommandRegistry(List<WebSocketCommand<?>> commands) {
        this.commands.addAll(commands);
    }
}
```

**Benefits**:
- No manual registration required
- Adding new command = create @Component class
- Type-safe dependency injection

## 9. Error Handling Strategy

### 9.1 Error Handling Layers

| Layer | Error Type | Handling Strategy |
|-------|-----------|-------------------|
| **Authentication** | JWT validation failure | Return `Mono.error()` → closes connection |
| **Message Parsing** | Malformed JSON | Log error, emit `Mono.empty()` → skip message |
| **Command Execution** | Business logic error | Log error, return `Mono.empty()` → skip message |
| **MQTT Publishing** | Connection failure | Log error, retry logic in publisher |
| **WebSocket Send** | Connection closed | Spring handles, cleanup triggered |

### 9.2 Error Handling Implementation

#### BaseWebSocketHandler

```java
@Override
public final Mono<Void> handle(WebSocketSession session) {
    return authenticate(session)
        .flatMap(this::setupSession)
        .flatMap(this::processSession)
        .doOnError(e -> log.error("WebSocket error for session {}", session.getId(), e))
        .onErrorResume(e -> {
            log.error("Fatal error, closing session {}", session.getId(), e);
            return Mono.empty();
        })
        .doFinally(signal -> cleanupSession(session));
}
```

#### Command Error Handling

```java
@Override
public Mono<Void> execute(SetTemperatureMessage message, WebSocketContext context) {
    return Mono.fromRunnable(() -> {
        // Validation
        if (temperature < 16 || temperature > 30) {
            throw new IllegalArgumentException("Temperature out of range");
        }

        // Business logic
        mqttPublisher.publishTemperature(roomId, temperature);
    })
    .doOnError(e -> log.error("Failed to set temperature for room {}", context.roomId(), e))
    .onErrorResume(e -> {
        // Could send error message to client here
        return Mono.empty();
    });
}
```

#### Message Parser Error Handling

```java
public Mono<AirConditionerInboundMessage> parseInboundMessage(String json) {
    return Mono.fromCallable(() -> {
        // Parsing logic
    })
    .doOnError(e -> log.error("Failed to parse message: {}", json, e))
    .onErrorResume(e -> Mono.empty()); // Skip malformed messages
}
```

### 9.3 Error Propagation Strategy

**Philosophy**: Fail gracefully, don't crash the WebSocket connection

- **Recoverable Errors** (malformed message, validation failure):
  - Log error
  - Emit `Mono.empty()` to skip
  - Connection stays alive

- **Fatal Errors** (authentication failure):
  - Return `Mono.error()`
  - Connection closes
  - Client must reconnect

## 10. Testing Strategy

### 10.1 Unit Testing

#### Command Unit Test Example

```java
@ExtendWith(MockitoExtension.class)
class SetTemperatureCommandTest {

    @Mock
    private MqttMessagePublisher mqttPublisher;

    @InjectMocks
    private SetTemperatureCommand command;

    @Test
    void execute_validTemperature_publishesToMqtt() {
        // Given
        SetTemperatureMessage message = new SetTemperatureMessage("SET_TEMPERATURE", 22.5);
        WebSocketContext context = createContext("room123");

        // When
        Mono<Void> result = command.execute(message, context);

        // Then
        StepVerifier.create(result)
            .verifyComplete();

        verify(mqttPublisher).publishTemperature("room123", 22.5);
    }

    @Test
    void execute_temperatureOutOfRange_throwsException() {
        // Given
        SetTemperatureMessage message = new SetTemperatureMessage("SET_TEMPERATURE", 35.0);
        WebSocketContext context = createContext("room123");

        // When/Then
        StepVerifier.create(command.execute(message, context))
            .expectError(IllegalArgumentException.class)
            .verify();

        verify(mqttPublisher, never()).publishTemperature(any(), anyDouble());
    }
}
```

#### Message Parser Unit Test

```java
@ExtendWith(MockitoExtension.class)
class AirConditionerMessageParserTest {

    private AirConditionerMessageParser parser;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        parser = new AirConditionerMessageParser(objectMapper);
    }

    @Test
    void parse_setTemperatureMessage_returnsCorrectType() {
        // Given
        String json = """
            {
                "type": "SET_TEMPERATURE",
                "temperature": 23.5
            }
            """;

        // When
        Mono<AirConditionerInboundMessage> result = parser.parseInboundMessage(json);

        // Then
        StepVerifier.create(result)
            .assertNext(msg -> {
                assertInstanceOf(SetTemperatureMessage.class, msg);
                SetTemperatureMessage tempMsg = (SetTemperatureMessage) msg;
                assertEquals(23.5, tempMsg.temperature());
            })
            .verifyComplete();
    }
}
```

### 10.2 Integration Testing

#### WebSocket Handler Integration Test

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
class AirConditionerWebSocketHandlerIntegrationTest {

    @Autowired
    private WebSocketClient webSocketClient;

    @Autowired
    private Sinks.Many<StatusUpdateMessage> statusUpdateSink;

    @Test
    void websocket_sendsMessage_commandExecuted() {
        // Test full WebSocket flow
        // 1. Connect to /ws
        // 2. Send SetTemperatureMessage
        // 3. Verify MQTT publish called
    }
}
```

### 10.3 Test Coverage Goals

| Component | Target Coverage | Focus Areas |
|-----------|----------------|-------------|
| **Commands** | 90%+ | Business logic, validation, error handling |
| **Parsers** | 95%+ | All message types, malformed input |
| **BaseWebSocketHandler** | 85%+ | Template workflow, error handling |
| **CommandRegistry** | 90%+ | Command routing, no-handler case |

## 11. Migration Strategy

### 11.1 Incremental Migration Plan

**Phase 1: Extract Air Conditioner Message Types** (No breaking changes)
- Create message type files
- Old handler still uses inline records
- New code ready for Phase 2

**Phase 2: Implement Air Conditioner Commands** (No breaking changes)
- Create command classes
- CommandRegistry discovers them
- Old handler still uses switch statement

**Phase 3: Create BaseWebSocketHandler** (Breaking change - controlled)
- Implement Template Method base class
- No handlers using it yet

**Phase 4: Migrate QuotaWebSocketHandler** (Breaking change - isolated)
- Extend BaseWebSocketHandler
- Remove duplicated code
- Test quota endpoint thoroughly

**Phase 5: Migrate AirConditionerWebSocketHandler** (Breaking change - isolated)
- Extend BaseWebSocketHandler
- Remove switch statement, use CommandRegistry
- Test air conditioner endpoint thoroughly

**Phase 6: Cleanup** (Code quality)
- Delete unused code
- Update documentation
- Performance validation

### 11.2 Rollback Strategy

Since codebase is in development:
- **No production concerns** - can delete and rewrite
- **Git branches** for each phase
- **Testing** after each phase before proceeding

## 12. Appendix

### 12.1 Key Metrics Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **DRY Score** | 4/10 | 9/10 | +125% |
| **SOLID Score** | 3/10 | 8.5/10 | +183% |
| **Cohesion** | 4/10 | 9/10 | +125% |
| **Coupling** | 3/10 | 8/10 | +167% |
| **Avg Handler Size** | 380 lines | <150 lines | -60% |
| **Code Duplication** | ~55 lines | <10 lines | -82% |

### 12.2 Package Structure Overview

```
com.ashelabs.turing.websocket/
├── core/                                    # Shared abstractions
│   ├── BaseWebSocketHandler.java           # Template Method base class
│   ├── WebSocketCommand.java               # Command interface
│   ├── WebSocketContext.java               # Session context record
│   ├── CommandRegistry.java                # Command routing
│   └── MessageProcessor.java               # Optional Chain of Responsibility
│
├── airconditioner/                          # Air conditioner feature
│   ├── AirConditionerWebSocketHandler.java # Endpoint handler
│   ├── messages/
│   │   ├── AirConditionerInboundMessage.java
│   │   ├── AirConditionerOutboundMessage.java
│   │   ├── inbound/                        # 6 message types
│   │   └── outbound/                       # 4 message types
│   ├── command/                            # 6 command implementations
│   └── parser/
│       └── AirConditionerMessageParser.java
│
├── quota/                                   # Quota feature
│   ├── QuotaWebSocketHandler.java          # Endpoint handler
│   ├── messages/                           # 13 message types (existing)
│   ├── command/                            # 5 command implementations (existing)
│   └── parser/
│       └── QuotaMessageParser.java         # Existing
│
├── session/
│   └── WebSocketSessionManager.java        # Session lifecycle (existing)
│
├── ReactiveWebSocketHandler.java           # TO BE REPLACED
└── QuotaWebSocketHandler.java              # TO BE REFACTORED
```

### 12.3 Design Decision Log

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Use Template Method** | Eliminates 55 lines of duplication, enforces consistent workflow | Inheritance coupling (acceptable for unified architecture) |
| **Use Command Pattern** | Already proven in quota endpoint, excellent SRP/OCP | More classes (acceptable for maintainability) |
| **Defer Chain of Responsibility** | No middleware requirements, YAGNI principle | Less flexibility (can add later if needed) |
| **Defer MqttPublisher Interface** | No testing infrastructure yet, YAGNI | Less testable now (add with test setup) |
| **Java Records for Messages** | Immutable, concise, perfect for data transfer | Less flexibility than classes (not needed) |
| **Sinks as Spring Beans** | Shared state across components | Global state (acceptable for pub/sub pattern) |

### 12.4 Future Enhancements (Deferred)

1. **MqttPublisher Interface** - When setting up test infrastructure
2. **WebSocketContext Helper Methods** - If proven useful in 2+ places
3. **Chain of Responsibility** - If middleware requirements emerge
4. **Monitoring/Metrics** - When observability infrastructure added
5. **Rate Limiting** - If abuse becomes a concern
6. **Message Compression** - If bandwidth becomes an issue
7. **Protocol Versioning** - If breaking message changes needed

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Status**: Approved for Implementation
