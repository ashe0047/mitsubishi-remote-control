# WebSocket Endpoint Unification - Implementation Plan

## 1. Overview

This document provides a detailed, phase-by-phase implementation plan for unifying WebSocket endpoints using Template Method and Command patterns while maintaining reactive programming.

**Implementation Approach**: Incremental migration with validation after each phase

**Total Estimated Time**: 6 days

## 2. Prerequisites

### 2.1 Required Tools and Environment

- **Java 21** with Maven
- **Spring Boot 3.5.5** with WebFlux
- **IDE**: IntelliJ IDEA or VS Code with Java extensions
- **Context7 Integration**: For fetching latest Spring WebFlux and Reactor documentation
- **Git**: For version control and rollback

### 2.2 Required Documentation (Context7 Queries)

Before implementation, fetch latest documentation for:

| Package | Context7 Query | Purpose |
|---------|---------------|---------|
| Spring WebFlux WebSocket | `/spring/spring-framework/v6.x` topic: "websocket reactive" | WebSocket handler patterns |
| Project Reactor | `/projectreactor/reactor-core` topic: "mono flux sinks" | Reactive programming patterns |
| Jackson | `/fasterxml/jackson` topic: "databind objectmapper" | JSON serialization/deserialization |
| Spring Boot Testing | `/spring/spring-boot` topic: "webflux testing websocket" | WebSocket testing strategies |

### 2.3 Baseline Validation

Before starting, validate current system:

```bash
# Run all tests
cd backend/turing
./mvnw test

# Verify compilation
./mvnw clean compile

# Check WebSocket endpoints are accessible
# Manual test: Connect to ws://localhost:8080/ws and ws://localhost:8080/ws/quota
```

## 3. Implementation Phases

### Phase 1: Extract Air Conditioner Message Types

**Goal**: Create typed message classes to replace inline record definitions

**Estimated Time**: 1 day

**Status**: Non-breaking (old code still works)

#### Task 1.1: Create Message Base Interfaces

**File**: `websocket/airconditioner/messages/AirConditionerInboundMessage.java`

```java
package com.ashelabs.turing.websocket.airconditioner.messages;

/**
 * Base interface for all client-to-server air conditioner messages.
 * Implementations represent specific commands (set temperature, mode, etc.).
 */
public interface AirConditionerInboundMessage {
}
```

**File**: `websocket/airconditioner/messages/AirConditionerOutboundMessage.java`

```java
package com.ashelabs.turing.websocket.airconditioner.messages;

/**
 * Base interface for all server-to-client air conditioner messages.
 * Implementations represent status updates and notifications.
 */
public interface AirConditionerOutboundMessage {
}
```

**Validation**:
```bash
./mvnw compile
# Should compile successfully
```

#### Task 1.2: Create Inbound Message Types

**Directory**: `websocket/airconditioner/messages/inbound/`

**Files to Create** (6 total):

1. **SetTemperatureMessage.java**
```java
package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to set target temperature for air conditioner.
 *
 * @param type Message type identifier ("SET_TEMPERATURE")
 * @param temperature Target temperature in Celsius (16-30°C)
 */
public record SetTemperatureMessage(
    String type,
    double temperature
) implements AirConditionerInboundMessage {
}
```

2. **SetModeMessage.java**
```java
public record SetModeMessage(
    String type,
    String mode  // "cool", "heat", "fan", "dry", "auto"
) implements AirConditionerInboundMessage {
}
```

3. **SetFanSpeedMessage.java**
```java
public record SetFanSpeedMessage(
    String type,
    String fanSpeed  // "low", "medium", "high", "auto"
) implements AirConditionerInboundMessage {
}
```

4. **SetPowerMessage.java**
```java
public record SetPowerMessage(
    String type,
    boolean power
) implements AirConditionerInboundMessage {
}
```

5. **SetSwingMessage.java**
```java
public record SetSwingMessage(
    String type,
    String swing  // "auto", "1", "2", "3", "4", "5", "swing"
) implements AirConditionerInboundMessage {
}
```

6. **GetStatusMessage.java**
```java
public record GetStatusMessage(
    String type
) implements AirConditionerInboundMessage {
}
```

**Validation**:
```bash
./mvnw compile
# Check: 6 inbound message files created and compiled
```

#### Task 1.3: Create Outbound Message Types and Payloads

**Directory**: `websocket/airconditioner/messages/outbound/`

**Files to Create** (8 total):

1. **StatusUpdateMessage.java & StatusUpdatePayload.java**
```java
package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Current air conditioner status update
 */
public record StatusUpdateMessage(
    String type,
    StatusUpdatePayload payload
) implements AirConditionerOutboundMessage {
}

public record StatusUpdatePayload(
    String roomId,
    String mode,
    double targetTemperature,
    String fanSpeed,
    boolean power,
    String swing
) {
}
```

2. **TemperatureUpdateMessage.java & TemperatureUpdatePayload.java**
```java
/**
 * Room temperature reading update
 */
public record TemperatureUpdateMessage(
    String type,
    TemperatureUpdatePayload payload
) implements AirConditionerOutboundMessage {
}

public record TemperatureUpdatePayload(
    String roomId,
    double currentTemperature,
    long timestamp
) {
}
```

3. **ErrorMessage.java**
```java
/**
 * Error notification to client
 */
public record ErrorMessage(
    String type,
    String error,
    String message
) implements AirConditionerOutboundMessage {
}
```

4. **AckMessage.java**
```java
/**
 * Command acknowledgment
 */
public record AckMessage(
    String type,
    String command,
    boolean success
) implements AirConditionerOutboundMessage {
}
```

**Validation**:
```bash
./mvnw compile
# Check: 8 outbound message files (4 messages + 2 payload records) created and compiled
```

#### Task 1.4: Phase 1 Completion Checklist

- [ ] 2 base interfaces created (AirConditionerInboundMessage, AirConditionerOutboundMessage)
- [ ] 6 inbound message types created
- [ ] 4 outbound message types created
- [ ] 2 payload records created
- [ ] All files compile successfully
- [ ] Package structure follows: `websocket/airconditioner/messages/inbound/` and `.../outbound/`

**Feedback Checkpoint**: Use `mcp__mcp-feedback-enhanced__interactive_feedback` to report Phase 1 completion and wait for approval.

---

### Phase 2: Implement Air Conditioner Commands

**Goal**: Create command classes for each message type

**Estimated Time**: 2 days

**Status**: Non-breaking (commands exist but not used yet)

#### Task 2.1: Read Existing ReactiveWebSocketHandler

Before creating commands, understand the current business logic:

```bash
# Read the handler to understand MQTT publishing patterns
cat backend/turing/src/main/java/com/ashelabs/turing/websocket/ReactiveWebSocketHandler.java
```

**Extract**:
- How MQTT messages are published
- What parameters are needed
- Error handling patterns
- Validation logic

#### Task 2.2: Create Command Implementations

**Directory**: `websocket/airconditioner/command/`

**Files to Create** (6 total):

##### 1. SetTemperatureCommand.java

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
 *
 * <p>Validates temperature range (16-30°C) and publishes to MQTT broker.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_TEMPERATURE messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {

    private static final double MIN_TEMPERATURE = 16.0;
    private static final double MAX_TEMPERATURE = 30.0;

    private final MqttMessagePublisher mqttPublisher;

    @Override
    public Mono<Void> execute(SetTemperatureMessage message, WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            double temperature = message.temperature();
            String roomId = context.roomId();

            log.debug("Setting temperature to {}°C for room {}", temperature, roomId);

            // Validate temperature range
            validateTemperature(temperature);

            // Publish to MQTT broker
            mqttPublisher.publishTemperature(roomId, temperature);

            log.info("Successfully set temperature to {}°C for room {}", temperature, roomId);
        })
        .doOnError(e -> log.error("Failed to set temperature for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty()); // Don't crash connection on error
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetTemperatureMessage;
    }

    private void validateTemperature(double temperature) {
        if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
            throw new IllegalArgumentException(
                String.format("Temperature %.1f°C out of range [%.1f-%.1f]",
                    temperature, MIN_TEMPERATURE, MAX_TEMPERATURE)
            );
        }
    }
}
```

##### 2. SetModeCommand.java

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class SetModeCommand implements WebSocketCommand<SetModeMessage> {

    private static final Set<String> VALID_MODES = Set.of(
        "cool", "heat", "fan", "dry", "auto"
    );

    private final MqttMessagePublisher mqttPublisher;

    @Override
    public Mono<Void> execute(SetModeMessage message, WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            String mode = message.mode();
            String roomId = context.roomId();

            log.debug("Setting mode to {} for room {}", mode, roomId);

            // Validate mode
            validateMode(mode);

            // Publish to MQTT
            mqttPublisher.publishMode(roomId, mode);

            log.info("Successfully set mode to {} for room {}", mode, roomId);
        })
        .doOnError(e -> log.error("Failed to set mode for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetModeMessage;
    }

    private void validateMode(String mode) {
        if (!VALID_MODES.contains(mode.toLowerCase())) {
            throw new IllegalArgumentException(
                String.format("Invalid mode '%s'. Valid modes: %s", mode, VALID_MODES)
            );
        }
    }
}
```

##### 3-6. Similar pattern for remaining commands

Create similar implementations for:
- **SetFanSpeedCommand.java** - Validate against {"low", "medium", "high", "auto"}
- **SetPowerCommand.java** - Simple boolean, no validation needed
- **SetSwingCommand.java** - Validate against {"auto", "1", "2", "3", "4", "5", "swing"}
- **GetStatusCommand.java** - No MQTT publish, just trigger status update from sink

**Key Patterns**:
- All use `@Component` for Spring auto-discovery
- All use `@RequiredArgsConstructor` for DI
- All implement validation before MQTT publish
- All use reactive error handling (doOnError, onErrorResume)
- All ~60-80 lines (within target <100)

#### Task 2.3: Validate Commands

**Validation**:
```bash
./mvnw compile
# Check: 6 command files created and compiled
# Check: Commands registered with CommandRegistry automatically (Spring DI)
```

**Manual Test** (after Phase 3):
```bash
# Start application
./mvnw spring-boot:run

# Check logs for command registration
grep "Registered.*WebSocket commands" logs/application.log
# Should show: "Registered 11 WebSocket commands" (5 quota + 6 airconditioner)
```

#### Task 2.4: Phase 2 Completion Checklist

- [ ] 6 command classes created
- [ ] All commands implement `WebSocketCommand<T>`
- [ ] All commands annotated with `@Component`
- [ ] Validation logic extracted from old handler
- [ ] MQTT publishing logic matches old handler
- [ ] Error handling consistent across commands
- [ ] All files compile successfully
- [ ] Each command ~60-80 lines

**Feedback Checkpoint**: Report Phase 2 completion with command count and wait for approval.

---

### Phase 3: Create BaseWebSocketHandler (Template Method)

**Goal**: Create abstract base class with Template Method pattern

**Estimated Time**: 1 day

**Status**: Non-breaking (no handlers using it yet)

#### Task 3.1: Create BaseWebSocketHandler

**File**: `websocket/core/BaseWebSocketHandler.java`

```java
package com.ashelabs.turing.websocket.core;

import com.ashelabs.turing.websocket.WebSocketJwtAuthHandler;
import com.ashelabs.turing.websocket.session.WebSocketSessionManager;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;

/**
 * Base WebSocket handler implementing Template Method pattern.
 *
 * <p>Defines standard WebSocket handling workflow:
 * <ol>
 *   <li>Authenticate - JWT validation (invariant)</li>
 *   <li>Setup Session - Register in session manager (invariant)</li>
 *   <li>Process Session - Custom message processing (hook method)</li>
 *   <li>Cleanup - Remove session on disconnect (invariant)</li>
 * </ol>
 *
 * <p><strong>Subclasses</strong> must implement:
 * <ul>
 *   <li>{@link #processSession(WebSocketContext)} - Custom processing logic</li>
 *   <li>{@link #createContext(WebSocketSession, Claims)} - Context creation</li>
 * </ul>
 *
 * <p><strong>Design Pattern</strong>: Template Method
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Only manages WebSocket lifecycle</li>
 *   <li>OCP: Open for extension (hook methods), closed for modification (final methods)</li>
 *   <li>LSP: All subclasses can substitute this base class</li>
 * </ul>
 */
@Slf4j
public abstract class BaseWebSocketHandler implements WebSocketHandler {

    @Autowired
    protected WebSocketJwtAuthHandler authHandler;

    @Autowired
    protected WebSocketSessionManager sessionManager;

    /**
     * Template Method - defines the WebSocket handling workflow.
     *
     * <p>This method is FINAL - subclasses cannot override the workflow.
     *
     * @param session WebSocket session from Spring WebFlux
     * @return Mono that completes when session ends
     */
    @Override
    public final Mono<Void> handle(WebSocketSession session) {
        log.debug("WebSocket connection initiated: {}", session.getId());

        return authenticate(session)
            .flatMap(this::setupSession)
            .flatMap(this::processSession)
            .doOnError(e -> log.error("WebSocket error for session {}", session.getId(), e))
            .onErrorResume(e -> {
                log.error("Fatal WebSocket error, closing session {}", session.getId(), e);
                return Mono.empty();
            })
            .doFinally(signal -> {
                log.debug("WebSocket connection terminated: {} (signal: {})", session.getId(), signal);
                cleanupSession(session);
            });
    }

    // ========== Invariant Steps (FINAL methods - cannot be overridden) ==========

    /**
     * Authenticate WebSocket connection using JWT token.
     *
     * @param session WebSocket session
     * @return Mono with authenticated context
     */
    private Mono<WebSocketContext> authenticate(WebSocketSession session) {
        return authHandler.authenticate(session)
            .map(claims -> createContext(session, claims))
            .doOnSuccess(context ->
                log.info("Authenticated WebSocket session {} for user {}",
                    session.getId(), context.familyMemberId())
            );
    }

    /**
     * Setup session - register in session manager.
     *
     * @param context WebSocket context
     * @return Mono with same context (pass-through)
     */
    private Mono<WebSocketContext> setupSession(WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            sessionManager.registerSession(context.session());
            log.debug("Registered session {} in session manager", context.sessionId());
        }).thenReturn(context);
    }

    /**
     * Cleanup session - remove from session manager.
     *
     * @param session WebSocket session
     */
    private void cleanupSession(WebSocketSession session) {
        sessionManager.cleanupSession(session.getId());
        log.debug("Cleaned up session {}", session.getId());
    }

    // ========== Hook Methods (ABSTRACT - must be implemented by subclasses) ==========

    /**
     * Process WebSocket session - custom implementation per endpoint.
     *
     * <p>This is the main hook method where subclasses implement:
     * <ul>
     *   <li>Inbound message processing</li>
     *   <li>Outbound message streaming</li>
     *   <li>Bidirectional communication setup</li>
     * </ul>
     *
     * @param context WebSocket context with session and authentication info
     * @return Mono that completes when processing ends
     */
    protected abstract Mono<Void> processSession(WebSocketContext context);

    /**
     * Create WebSocket context from session and JWT claims.
     *
     * <p>Different endpoints may extract different fields from claims.
     *
     * @param session WebSocket session
     * @param claims JWT claims from authentication
     * @return WebSocket context for this endpoint
     */
    protected abstract WebSocketContext createContext(WebSocketSession session, Claims claims);
}
```

**Key Design Decisions**:
- `handle()` is **FINAL** - enforces workflow, prevents bypassing auth/cleanup
- Authentication, setup, cleanup are **PRIVATE** - invariant behavior
- `processSession()` and `createContext()` are **ABSTRACT** - customization points
- Comprehensive JavaDoc explains pattern and SOLID compliance

#### Task 3.2: Update WebSocketContext

**File**: `websocket/core/WebSocketContext.java`

Add factory methods for different endpoint types:

```java
package com.ashelabs.turing.websocket.core;

import org.springframework.web.reactive.socket.WebSocketSession;

/**
 * WebSocket session context record.
 *
 * <p>Encapsulates session information and authentication details.
 * Uses Factory Pattern for construction.
 *
 * @param session WebSocket session from Spring WebFlux
 * @param sessionId Session identifier (same as session.getId())
 * @param familyMemberId Authenticated user ID from JWT
 * @param roomId Room identifier (from query params)
 * @param quotaId Quota identifier (nullable - only for quota endpoint)
 */
public record WebSocketContext(
    WebSocketSession session,
    String sessionId,
    String familyMemberId,
    String roomId,
    String quotaId
) {
    /**
     * Factory method for quota endpoint context.
     *
     * @param session WebSocket session
     * @param familyMemberId User ID from JWT
     * @param roomId Room identifier
     * @param quotaId Quota identifier
     * @return Context for quota endpoint
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
     * Factory method for air conditioner endpoint context.
     *
     * @param session WebSocket session
     * @param familyMemberId User ID from JWT
     * @param roomId Room identifier
     * @return Context for air conditioner endpoint
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

#### Task 3.3: Validation

```bash
./mvnw compile
# Check: BaseWebSocketHandler compiles
# Check: WebSocketContext factory methods added
```

#### Task 3.4: Phase 3 Completion Checklist

- [ ] BaseWebSocketHandler created with Template Method pattern
- [ ] handle() method is final
- [ ] Authentication, setup, cleanup are private
- [ ] processSession() and createContext() are abstract hooks
- [ ] WebSocketContext factory methods added
- [ ] Comprehensive JavaDoc for all public/protected methods
- [ ] All files compile successfully

**Feedback Checkpoint**: Report Phase 3 completion and wait for approval.

---

### Phase 4: Integrate QuotaWebSocketHandler with BaseWebSocketHandler

**Goal**: Refactor existing QuotaWebSocketHandler to extend BaseWebSocketHandler

**Estimated Time**: 0.5 days

**Status**: **BREAKING CHANGE** - Must test thoroughly after

#### Task 4.1: Read Current QuotaWebSocketHandler

```bash
cat backend/turing/src/main/java/com/ashelabs/turing/websocket/QuotaWebSocketHandler.java
```

**Identify**:
- Lines 1-50: Authentication and setup (will be removed - handled by base)
- Lines 51-100: processSession logic (will be kept - hook method)
- Lines 101-150: Outbound stream creation (will be kept - helper method)
- Lines 151-200: Inbound stream processing (will be kept - helper method)
- Lines 201-250: Cleanup (will be removed - handled by base)

#### Task 4.2: Refactor QuotaWebSocketHandler

**Changes**:

1. **Extend BaseWebSocketHandler**:
```java
@Component("quotaWebSocketHandler")
public class QuotaWebSocketHandler extends BaseWebSocketHandler {
```

2. **Remove fields now in base class**:
```java
// REMOVE these (now in BaseWebSocketHandler):
// @Autowired private WebSocketJwtAuthHandler authHandler;
// @Autowired private WebSocketSessionManager sessionManager;
```

3. **Remove handle() method** (now provided by base class)

4. **Implement processSession() hook**:
```java
@Override
protected Mono<Void> processSession(WebSocketContext context) {
    Flux<WebSocketMessage> outbound = createOutboundStream(context);
    Flux<Void> inbound = createInboundStream(context);

    return context.session().send(outbound).and(inbound);
}
```

5. **Implement createContext() hook**:
```java
@Override
protected WebSocketContext createContext(WebSocketSession session, Claims claims) {
    String familyMemberId = claims.getSubject();
    String roomId = extractRoomId(session);
    String quotaId = extractQuotaId(session);

    return WebSocketContext.createForQuota(session, familyMemberId, roomId, quotaId);
}

private String extractRoomId(WebSocketSession session) {
    // Extract from query parameters
    return session.getHandshakeInfo()
        .getUri()
        .getQuery()
        .split("roomId=")[1]
        .split("&")[0];
}

private String extractQuotaId(WebSocketSession session) {
    // Extract from query parameters
    return session.getHandshakeInfo()
        .getUri()
        .getQuery()
        .split("quotaId=")[1]
        .split("&")[0];
}
```

6. **Keep existing helper methods**:
- `createOutboundStream(WebSocketContext context)` - as-is
- `createInboundStream(WebSocketContext context)` - update to use context parameter
- `toWebSocketMessage()` - as-is

**Expected Line Reduction**: 347 lines → ~120 lines (-65%)

#### Task 4.3: Validation

```bash
# Compile
./mvnw compile

# Run tests if available
./mvnw test

# Start application
./mvnw spring-boot:run

# Manual WebSocket test - connect to ws://localhost:8080/ws/quota
# Send test messages, verify functionality unchanged
```

#### Task 4.4: Phase 4 Completion Checklist

- [ ] QuotaWebSocketHandler extends BaseWebSocketHandler
- [ ] handle() method removed (inherited from base)
- [ ] Authentication/setup/cleanup logic removed (handled by base)
- [ ] processSession() implemented
- [ ] createContext() implemented
- [ ] Existing functionality preserved
- [ ] Code compiles successfully
- [ ] Manual WebSocket test passes
- [ ] Handler size reduced to ~120 lines

**Feedback Checkpoint**: Report Phase 4 completion with line count reduction and wait for approval.

---

### Phase 5: Integrate AirConditionerWebSocketHandler with BaseWebSocketHandler

**Goal**: Create new AirConditionerWebSocketHandler extending BaseWebSocketHandler

**Estimated Time**: 0.5 days

**Status**: **BREAKING CHANGE** - Must test thoroughly after

#### Task 5.1: Create AirConditionerMessageParser

**File**: `websocket/airconditioner/parser/AirConditionerMessageParser.java`

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
 *
 * <p>Detects message type from "type" field and deserializes to appropriate message class.
 *
 * <p><strong>Single Responsibility</strong>: Parse air conditioner messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AirConditionerMessageParser {

    private final ObjectMapper objectMapper;

    /**
     * Parse inbound message from JSON string.
     *
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
        })
        .doOnError(e -> log.error("Failed to parse air conditioner message: {}", json, e))
        .onErrorResume(e -> Mono.empty()); // Skip malformed messages
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

#### Task 5.2: Create Sink Configuration

**File**: `config/AirConditionerWebSocketConfig.java`

```java
package com.ashelabs.turing.config;

import com.ashelabs.turing.websocket.airconditioner.messages.outbound.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Sinks;

/**
 * Configuration for air conditioner WebSocket sinks.
 *
 * <p>Provides sinks as Spring beans for dependency injection.
 * Sinks are shared between MQTT subscribers and WebSocket handlers.
 */
@Configuration
public class AirConditionerWebSocketConfig {

    /**
     * Sink for status update messages (AC mode, settings).
     */
    @Bean
    public Sinks.Many<StatusUpdateMessage> statusUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    /**
     * Sink for temperature update messages (room temperature readings).
     */
    @Bean
    public Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }
}
```

#### Task 5.3: Create AirConditionerWebSocketHandler

**File**: `websocket/AirConditionerWebSocketHandler.java`

```java
package com.ashelabs.turing.websocket;

import com.ashelabs.turing.websocket.airconditioner.messages.outbound.*;
import com.ashelabs.turing.websocket.airconditioner.parser.AirConditionerMessageParser;
import com.ashelabs.turing.websocket.core.BaseWebSocketHandler;
import com.ashelabs.turing.websocket.core.CommandRegistry;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 *
 * <p>Extends BaseWebSocketHandler to inherit standard workflow:
 * authentication → session setup → message processing → cleanup.
 *
 * <p><strong>Responsibilities</strong>:
 * <ul>
 *   <li>Air conditioner-specific session processing</li>
 *   <li>Outbound stream creation (status and temperature updates)</li>
 *   <li>Inbound stream processing (delegates to commands)</li>
 *   <li>Context creation for air conditioner endpoint</li>
 * </ul>
 *
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Only handles air conditioner WebSocket sessions</li>
 *   <li>OCP: Extensible via command pattern (add commands without modifying handler)</li>
 *   <li>DIP: Depends on abstractions (CommandRegistry, MessageParser)</li>
 * </ul>
 */
@Slf4j
@Component("airConditionerWebSocketHandler")
@RequiredArgsConstructor
public class AirConditionerWebSocketHandler extends BaseWebSocketHandler {

    private final CommandRegistry commandRegistry;
    private final AirConditionerMessageParser messageParser;
    private final ObjectMapper objectMapper;
    private final Sinks.Many<StatusUpdateMessage> statusUpdateSink;
    private final Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink;

    @Override
    protected Mono<Void> processSession(WebSocketContext context) {
        log.debug("Processing air conditioner session for room {}", context.roomId());

        Flux<WebSocketMessage> outbound = createOutboundStream(context);
        Flux<Void> inbound = createInboundStream(context);

        return context.session().send(outbound).and(inbound);
    }

    @Override
    protected WebSocketContext createContext(WebSocketSession session, Claims claims) {
        String familyMemberId = claims.getSubject();
        String roomId = extractRoomId(session);

        log.debug("Created air conditioner context for room {}", roomId);

        return WebSocketContext.createForAirConditioner(session, familyMemberId, roomId);
    }

    /**
     * Create outbound message stream (server → client).
     *
     * <p>Merges status updates and temperature updates, filtered by room ID.
     */
    private Flux<WebSocketMessage> createOutboundStream(WebSocketContext context) {
        String roomId = context.roomId();

        Flux<WebSocketMessage> statusUpdates = statusUpdateSink.asFlux()
            .filter(msg -> msg.payload().roomId().equals(roomId))
            .map(this::toWebSocketMessage)
            .doOnNext(msg -> log.debug("Sending status update to room {}", roomId));

        Flux<WebSocketMessage> temperatureUpdates = temperatureUpdateSink.asFlux()
            .filter(msg -> msg.payload().roomId().equals(roomId))
            .map(this::toWebSocketMessage)
            .doOnNext(msg -> log.debug("Sending temperature update to room {}", roomId));

        return Flux.merge(statusUpdates, temperatureUpdates);
    }

    /**
     * Create inbound message stream (client → server).
     *
     * <p>Parses JSON messages and delegates to commands via CommandRegistry.
     */
    private Flux<Void> createInboundStream(WebSocketContext context) {
        return context.session().receive()
            .map(WebSocketMessage::getPayloadAsText)
            .doOnNext(json -> log.debug("Received air conditioner message: {}", json))
            .flatMap(messageParser::parseInboundMessage)
            .flatMap(msg -> commandRegistry.executeCommand(msg, context))
            .doOnError(e -> log.error("Error processing inbound message for room {}",
                context.roomId(), e))
            .onErrorResume(e -> Mono.empty()); // Don't crash connection on error
    }

    /**
     * Extract room ID from WebSocket query parameters.
     */
    private String extractRoomId(WebSocketSession session) {
        String query = session.getHandshakeInfo().getUri().getQuery();
        if (query == null || !query.contains("roomId=")) {
            throw new IllegalArgumentException("Missing roomId parameter");
        }

        return query.split("roomId=")[1].split("&")[0];
    }

    /**
     * Convert message object to WebSocket text message.
     */
    private WebSocketMessage toWebSocketMessage(Object message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            return new org.springframework.web.reactive.socket.WebSocketMessage(
                org.springframework.web.reactive.socket.WebSocketMessage.Type.TEXT,
                context.session().bufferFactory().wrap(json.getBytes())
            );
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message to JSON", e);
            throw new RuntimeException("Message serialization failed", e);
        }
    }
}
```

**Expected Size**: ~120 lines (within target <200)

#### Task 5.4: Update WebSocket Endpoint Mapping

**File**: `config/WebSocketConfig.java`

```java
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping(
        @Qualifier("airConditionerWebSocketHandler") WebSocketHandler airConditionerHandler,
        @Qualifier("quotaWebSocketHandler") WebSocketHandler quotaHandler
    ) {
        Map<String, WebSocketHandler> handlerMap = Map.of(
            "/ws", airConditionerHandler,           // Air conditioner endpoint
            "/ws/quota", quotaHandler               // Quota endpoint
        );

        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(handlerMap);
        mapping.setOrder(1);
        return mapping;
    }
}
```

#### Task 5.5: Delete Old ReactiveWebSocketHandler

```bash
# Backup first
cp backend/turing/src/main/java/com/ashelabs/turing/websocket/ReactiveWebSocketHandler.java /tmp/

# Delete old handler
rm backend/turing/src/main/java/com/ashelabs/turing/websocket/ReactiveWebSocketHandler.java
```

#### Task 5.6: Validation

```bash
# Compile
./mvnw compile

# Run tests
./mvnw test

# Start application
./mvnw spring-boot:run

# Check command registration
grep "Registered.*commands" logs/application.log
# Should show: "Registered 11 WebSocket commands"

# Manual WebSocket test
# Connect to ws://localhost:8080/ws?roomId=living-room
# Send: {"type": "SET_TEMPERATURE", "temperature": 22.5}
# Verify: Command executed, MQTT message published
```

#### Task 5.7: Phase 5 Completion Checklist

- [ ] AirConditionerMessageParser created (~80 lines)
- [ ] AirConditionerWebSocketConfig created (sink beans)
- [ ] AirConditionerWebSocketHandler created (~120 lines)
- [ ] WebSocketConfig updated with both endpoints
- [ ] ReactiveWebSocketHandler deleted
- [ ] All code compiles successfully
- [ ] All 11 commands registered (5 quota + 6 airconditioner)
- [ ] Manual WebSocket test passes
- [ ] MQTT publishing verified

**Feedback Checkpoint**: Report Phase 5 completion with handler comparison (old vs new) and wait for approval.

---

### Phase 6: Final Validation and Documentation

**Goal**: Comprehensive testing and documentation update

**Estimated Time**: 1 day

**Status**: Validation and cleanup

#### Task 6.1: Code Quality Validation

**DRY Check**:
```bash
# Count duplicate code blocks
# Use tool like: jscpd or manual inspection
# Target: <10 lines of duplication
```

**SOLID Check**:
- Review each class for Single Responsibility
- Verify Open/Closed (can add commands without modifying handlers)
- Verify Liskov Substitution (all handlers interchangeable)
- Verify Interface Segregation (focused interfaces)
- Verify Dependency Inversion (depend on abstractions)

**Size Check**:
```bash
# Count lines per file
wc -l websocket/core/BaseWebSocketHandler.java
# Target: ~150 lines

wc -l websocket/AirConditionerWebSocketHandler.java
# Target: ~120 lines

wc -l websocket/QuotaWebSocketHandler.java
# Target: ~120 lines

wc -l websocket/airconditioner/command/*.java
# Target: ~70 lines each
```

#### Task 6.2: Functional Testing

**Test Plan**:

1. **Quota Endpoint** (`/ws/quota`):
   - Connect with valid JWT
   - Send SUBSCRIBE_QUOTA message
   - Verify quota updates received
   - Send UNSUBSCRIBE_QUOTA message
   - Test override request flow
   - Disconnect and verify cleanup

2. **Air Conditioner Endpoint** (`/ws`):
   - Connect with valid JWT
   - Send SET_TEMPERATURE (valid range)
   - Verify MQTT publish
   - Send SET_TEMPERATURE (invalid range)
   - Verify error handling
   - Send SET_MODE, SET_FAN_SPEED, SET_POWER, SET_SWING
   - Verify all MQTT publishes
   - Test GET_STATUS
   - Disconnect and verify cleanup

3. **Error Cases**:
   - Invalid JWT (should reject connection)
   - Malformed JSON (should skip message, not crash)
   - Unknown message type (should log warning, skip)
   - Missing roomId parameter (should reject connection)

**Manual Test Script**:
```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Test air conditioner endpoint
wscat -c "ws://localhost:8080/ws?roomId=living-room" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Send test message
> {"type": "SET_TEMPERATURE", "temperature": 22.5}

# Expected response: Status update or acknowledgment
```

#### Task 6.3: Performance Validation

**Metrics to Collect**:
- Connection establishment time
- Message processing latency
- Memory usage (heap size)
- CPU usage under load

**Benchmark**:
```bash
# Use JMeter or similar tool
# Connect 10 clients simultaneously
# Send 100 messages per client
# Measure: avg latency, p95, p99, errors
```

**Target Performance** (should match or exceed old implementation):
- Connection establishment: <100ms
- Message processing: <10ms
- Memory: No leaks (stable heap)
- CPU: <50% under moderate load

#### Task 6.4: Documentation Updates

**Files to Update**:

1. **Architecture Documentation**:
```markdown
# docs/architecture/websocket-architecture.md

## Overview
All WebSocket endpoints now extend `BaseWebSocketHandler` with Template Method pattern.

## Endpoints
- `/ws` - Air conditioner control (AirConditionerWebSocketHandler)
- `/ws/quota` - Quota management (QuotaWebSocketHandler)

## Adding New Endpoint
1. Extend BaseWebSocketHandler
2. Implement processSession() and createContext()
3. Create message types and commands
4. Register endpoint in WebSocketConfig
```

2. **Developer Guide**:
```markdown
# docs/guides/websocket-development.md

## Adding New Command

1. Create message type:
```java
public record NewFeatureMessage(String type, String data)
    implements AirConditionerInboundMessage {}
```

2. Create command:
```java
@Component
public class NewFeatureCommand implements WebSocketCommand<NewFeatureMessage> {
    @Override
    public Mono<Void> execute(NewFeatureMessage msg, WebSocketContext ctx) {
        // Implementation
    }
}
```

3. That's it! Command automatically discovered by CommandRegistry.
```

3. **CLAUDE.md Project Instructions**:
```markdown
## WebSocket Architecture

All WebSocket endpoints use unified architecture:
- BaseWebSocketHandler (Template Method pattern)
- Command Pattern for message handling
- Reactive programming (Spring WebFlux, Project Reactor)

Key files:
- websocket/core/BaseWebSocketHandler.java - Base handler
- websocket/core/WebSocketCommand.java - Command interface
- websocket/core/CommandRegistry.java - Command routing
```

#### Task 6.5: Clean Code Metrics Report

**Generate Report**:

```markdown
# WebSocket Unification - Final Metrics

## Code Quality Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **DRY Score** | 4/10 | 9/10 | +125% |
| **SOLID Score** | 3/10 | 8.5/10 | +183% |
| **Cohesion** | 4/10 | 9/10 | +125% |
| **Coupling** | 3/10 | 8/10 | +167% |
| **Avg Handler Size** | 380 lines | 120 lines | -68% |
| **Code Duplication** | 55 lines | 8 lines | -85% |

## Component Sizes

| Component | Lines | Target | Status |
|-----------|-------|--------|--------|
| BaseWebSocketHandler | 152 | <200 | ✅ Pass |
| AirConditionerWebSocketHandler | 118 | <200 | ✅ Pass |
| QuotaWebSocketHandler | 125 | <200 | ✅ Pass |
| SetTemperatureCommand | 68 | <100 | ✅ Pass |
| SetModeCommand | 65 | <100 | ✅ Pass |

## Architecture Compliance

- ✅ Template Method Pattern implemented
- ✅ Command Pattern implemented
- ✅ All handlers extend BaseWebSocketHandler
- ✅ All messages use typed classes
- ✅ All commands auto-discovered via Spring DI
- ✅ Reactive programming maintained throughout
- ✅ Error handling consistent
- ✅ Logging comprehensive

## Testing Results

- ✅ Quota endpoint: All tests pass
- ✅ Air conditioner endpoint: All tests pass
- ✅ Error handling: Graceful degradation
- ✅ Performance: No degradation vs. old implementation
- ✅ Memory: No leaks detected
```

#### Task 6.6: Phase 6 Completion Checklist

- [ ] DRY score ≥8/10 validated
- [ ] SOLID score ≥8/10 validated
- [ ] All handlers <200 lines
- [ ] All commands <100 lines
- [ ] Functional tests pass (quota and airconditioner)
- [ ] Error handling tests pass
- [ ] Performance benchmarks meet targets
- [ ] Architecture documentation updated
- [ ] Developer guide created
- [ ] CLAUDE.md updated
- [ ] Final metrics report generated

**Feedback Checkpoint**: Report Phase 6 completion with final metrics and wait for approval.

---

## 4. Package Documentation Requirements (Context7)

Throughout implementation, use Context7 to fetch latest documentation:

### Phase 1-2: Message Types and Commands
```
# Spring WebFlux WebSocket patterns
mcp__context7__resolve-library-id: "spring-framework"
mcp__context7__get-library-docs: "/spring/spring-framework" topic: "websocket reactive handler"

# Project Reactor Mono/Flux patterns
mcp__context7__resolve-library-id: "reactor-core"
mcp__context7__get-library-docs: "/projectreactor/reactor-core" topic: "mono fromRunnable error handling"
```

### Phase 3: Template Method
```
# Jackson JSON processing
mcp__context7__resolve-library-id: "jackson-databind"
mcp__context7__get-library-docs: "/fasterxml/jackson-databind" topic: "objectmapper treeToValue"
```

### Phase 4-5: Handler Integration
```
# Spring WebSocket configuration
mcp__context7__get-library-docs: "/spring/spring-framework" topic: "websocket handshake uri query parameters"

# Reactor Sinks for backpressure
mcp__context7__get-library-docs: "/projectreactor/reactor-core" topic: "sinks many multicast"
```

## 5. Feedback Checkpoints

After EACH phase, use feedback tool:

```java
mcp__mcp-feedback-enhanced__interactive_feedback(
    project_directory: "/mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing",
    summary: "Phase X completed: [summary of what was done, files created, metrics achieved]",
    timeout: 600
)
```

**Wait for user approval before proceeding to next phase.**

## 6. Clean Code Compliance Checklist

Throughout implementation, ensure:

### DRY (Don't Repeat Yourself)
- [ ] No duplicate authentication logic (extracted to BaseWebSocketHandler)
- [ ] No duplicate session management (extracted to BaseWebSocketHandler)
- [ ] No duplicate message parsing (extracted to parsers)
- [ ] No duplicate error handling (consistent patterns via base class)

### SOLID Principles
- [ ] **SRP**: Each command handles one message type only
- [ ] **SRP**: BaseWebSocketHandler manages lifecycle only
- [ ] **SRP**: Parsers parse messages only
- [ ] **OCP**: Can add new commands without modifying handlers
- [ ] **OCP**: Can add new handlers by extending base
- [ ] **LSP**: All handlers can substitute WebSocketHandler
- [ ] **ISP**: WebSocketCommand interface is focused
- [ ] **DIP**: Commands depend on injected dependencies

### YAGNI (You Ain't Gonna Need It)
- [ ] No speculative features (metrics, rate limiting, etc.)
- [ ] No unused abstractions
- [ ] No over-engineering (Chain of Responsibility deferred)

### Code Organization
- [ ] Functions <20 lines (most commands ~60-70 lines total)
- [ ] Classes <200 lines (handlers ~120 lines)
- [ ] Clear package structure (core, airconditioner, quota)
- [ ] Comprehensive JavaDoc for all public APIs

## 7. Rollback Plan

If any phase fails validation:

1. **Git Revert**:
```bash
git log --oneline -10
git revert <commit-hash>
```

2. **Analyze Failure**:
- Read error logs
- Identify root cause
- Update implementation plan
- Retry phase with corrections

3. **No Production Concerns**:
- Codebase in development
- Can delete and rewrite freely
- No backward compatibility required

## 8. Success Criteria

Implementation is complete when:

- [ ] All 6 phases completed
- [ ] All validation tests pass
- [ ] All clean code metrics meet targets
- [ ] Documentation updated
- [ ] User approval received via feedback tool

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Status**: Ready for Implementation
