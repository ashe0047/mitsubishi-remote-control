# MQTT-WebSocket Bridge Technical Design

## 1. Design Overview

### 1.1 Architecture Pattern
**Primary Pattern**: **Adapter Pattern**
- Adapts MQTT event format (Spring ApplicationEvent) to WebSocket message format (JSON)
- Bridges two incompatible interfaces without modifying existing code

**Supporting Patterns**:
- **Observer Pattern**: Via Project Reactor Flux subscriptions
- **Mediator Pattern**: Bridge mediates between MQTT and WebSocket layers

### 1.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐         ┌──────────────────────┐           │
│  │   MqttService  │────────>│ ReactiveMqttService  │           │
│  │  (Protocol)    │ Events  │   (Reactive Bridge)  │           │
│  └────────────────┘         └──────────┬───────────┘           │
│                                         │ Flux<Events>          │
│                                         ↓                        │
│                          ┌─────────────────────────────┐        │
│                          │ MqttWebSocketBroadcaster    │ ← NEW  │
│                          │   (Adapter/Bridge Layer)    │        │
│                          └──────────┬─────────┬────────┘        │
│                                     │         │                 │
│                   Device/Room Lookup│         │WebSocket Publish│
│                                     ↓         ↓                 │
│                    ┌──────────────┐   ┌─────────────────┐      │
│                    │ DeviceService│   │ WebSocket Sinks │      │
│                    │ RoomService  │   │  (Multicast)    │      │
│                    └──────────────┘   └────────┬────────┘      │
│                                                  │              │
│                                                  ↓              │
│                                  ┌───────────────────────────┐ │
│                                  │ AirConditionerWSHandler   │ │
│                                  │  (Session Management)     │ │
│                                  └───────────┬───────────────┘ │
│                                               │                 │
│                                               ↓                 │
│                                        [WebSocket Clients]      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Sequence Diagram: State Update Flow

```
Physical Device   MQTT Broker   MqttService   ReactiveMqttService   MqttWebSocketBroadcaster   DeviceService   RoomService   WebSocket Sink   WebSocket Client
      │                │             │                 │                      │                      │               │                │                │
      │──State Update─>│             │                 │                      │                      │               │                │                │
      │                │─Subscribe──>│                 │                      │                      │               │                │                │
      │                │             │─publishEvent──>│                      │                      │               │                │                │
      │                │             │   (MqttStateUpdateEvent)               │                      │               │                │                │
      │                │             │                 │─stateSink.next()───>│                      │               │                │                │
      │                │             │                 │                      │                      │               │                │                │
      │                │             │                 │<────Flux<Event>─────│                      │               │                │                │
      │                │             │                 │                      │─getDeviceByIdentifier()────>│        │                │                │
      │                │             │                 │                      │<─────Device────────────────│        │                │                │
      │                │             │                 │                      │─getRoomByIdWithDevices()──────────>│                │                │
      │                │             │                 │                      │<─────RoomResponse──────────────────│                │                │
      │                │             │                 │                      │─transform()────────>│               │                │                │
      │                │             │                 │                      │<─RoomStatusUpdateMessage────│        │                │                │
      │                │             │                 │                      │─tryEmitNext()─────────────────────────────────>│                │
      │                │             │                 │                      │                      │               │                │─broadcast()──>│
      │                │             │                 │                      │                      │               │                │<─JSON Message─│
```

---

## 2. Clean Code Principles Application

### 2.1 DRY (Don't Repeat Yourself)

**Identified Duplication**:
- Device lookup + Room retrieval pattern repeated for state AND settings updates
- Message creation pattern repeated for different update types

**Refactoring Solution**:
```java
// Extract common lookup pattern
private Mono<RoomResponse> lookupRoomByDeviceIdentifier(String deviceIdentifier) {
    return deviceService.getDeviceByIdentifier(deviceIdentifier)
        .flatMap(device -> roomService.getRoomByIdWithDevices(device.householdId(), device.roomId()))
        .onErrorResume(DeviceNotFoundException.class, error -> {
            log.warn("Device not found for identifier: {}", deviceIdentifier);
            return Mono.empty(); // Skip message
        });
}

// Extract common message creation
private RoomStatusUpdateMessage createRoomStatusMessage(
    RoomResponse room,
    RoomUpdateType updateType
) {
    RoomStatusUpdatePayload payload = new RoomStatusUpdatePayload(
        room.getId().toString(),
        room.getName(),
        room.getAggregateStatus(),
        room.getDevices(),
        Instant.now(),
        updateType
    );
    return RoomStatusUpdateMessage.create(payload);
}
```

### 2.2 SOLID Principles

#### Single Responsibility Principle (SRP)
**Component**: `MqttWebSocketBroadcaster`
**Single Responsibility**: Transform MQTT events to WebSocket messages and publish

**Does NOT**:
- ❌ Manage MQTT subscriptions (ReactiveMqttService responsibility)
- ❌ Manage WebSocket sessions (AirConditionerWebSocketHandler responsibility)
- ❌ Validate devices (DeviceService responsibility)
- ❌ Manage room data (RoomService responsibility)

#### Open/Closed Principle (OCP)
**Open for Extension**: Can add new message type handlers without modifying existing code
```java
// Future extension point (if needed)
private Mono<RoomStatusUpdateMessage> handleEvent(Object event) {
    return switch (event) {
        case MqttStateUpdateEvent e -> transformStateUpdate(e);
        case MqttSettingsUpdateEvent e -> transformSettingsUpdate(e);
        case NewEventType e -> transformNewEvent(e); // Extension point
        default -> Mono.empty();
    };
}
```

**Closed for Modification**: Core bridging logic remains unchanged when adding new features

#### Liskov Substitution Principle (LSP)
**Not Applicable**: No inheritance hierarchy in this design

#### Interface Segregation Principle (ISP)
**Application**: Component depends only on methods it actually uses
- `ReactiveMqttService.getStateUpdates()` - only state stream
- `ReactiveMqttService.getSettingsUpdates()` - only settings stream
- Does NOT depend on entire interface if not needed

#### Dependency Inversion Principle (DIP)
**High-level module**: MqttWebSocketBroadcaster
**Low-level modules**: DeviceService, RoomService, WebSocket Sinks
**Abstractions**: All injected via constructor, using Spring interfaces

```java
@Service
@RequiredArgsConstructor
public class MqttWebSocketBroadcaster {
    // Depend on abstractions, not concretions
    private final ReactiveMqttService reactiveMqttService;
    private final DeviceService deviceService;
    private final RoomService roomService;
    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;
    // ...
}
```

### 2.3 YAGNI (You Aren't Gonna Need It)

**Avoided Over-Engineering**:
- ✅ NO Strategy Pattern for transformations (only 2 types, not worth abstraction)
- ✅ NO separate WebSocketPublisher interface (only one implementation)
- ✅ NO caching layer for device lookups (premature optimization)
- ✅ NO custom backpressure strategy (Reactor defaults sufficient)
- ✅ NO batch processing logic (process messages as they arrive)

**Kept Simple**:
- Direct method calls for transformations
- Standard Reactor operators for error handling
- Existing Sinks infrastructure for publishing

---

## 3. Component Design

### 3.1 Class Structure

```java
@Service
@Slf4j
@RequiredArgsConstructor
public class MqttWebSocketBroadcaster {

    // Dependencies (injected)
    private final ReactiveMqttService reactiveMqttService;
    private final DeviceService deviceService;
    private final RoomService roomService;
    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;
    private final Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink;

    // Lifecycle management
    private Disposable stateSubscription;
    private Disposable settingsSubscription;
    private Disposable connectionSubscription;

    // Metrics (optional)
    private final AtomicLong messagesProcessed = new AtomicLong(0);
    private final AtomicLong transformationErrors = new AtomicLong(0);
    private final AtomicLong publishErrors = new AtomicLong(0);

    @PostConstruct
    public void initialize() { /* Subscribe to streams */ }

    @PreDestroy
    public void cleanup() { /* Dispose subscriptions */ }

    // Private transformation methods
    private Mono<RoomStatusUpdateMessage> transformStateUpdate(MqttStateUpdateEvent event) { }
    private Mono<RoomStatusUpdateMessage> transformSettingsUpdate(MqttSettingsUpdateEvent event) { }
    private Mono<RoomResponse> lookupRoomByDeviceIdentifier(String deviceIdentifier) { }
    private void publishToWebSocket(RoomStatusUpdateMessage message) { }
}
```

### 3.2 Method Responsibilities

| Method | Responsibility | Returns | Error Handling |
|--------|---------------|---------|----------------|
| `initialize()` | Subscribe to MQTT reactive streams | void | Log subscription errors |
| `cleanup()` | Dispose subscriptions, prevent leaks | void | Safe disposal |
| `transformStateUpdate()` | Transform state event → WebSocket message | Mono<Message> | onErrorResume(empty) |
| `transformSettingsUpdate()` | Transform settings event → WebSocket message | Mono<Message> | onErrorResume(empty) |
| `lookupRoomByDeviceIdentifier()` | Device → Room lookup | Mono<RoomResponse> | onErrorResume(empty) |
| `publishToWebSocket()` | Publish to sink | void | tryEmitNext + log |

### 3.3 Error Handling Strategy

**Principle**: **Fail-Safe, Continue Processing**

```java
@PostConstruct
public void initialize() {
    // State updates stream
    stateSubscription = reactiveMqttService.getStateUpdates()
        .flatMap(this::transformStateUpdate)
        .onErrorContinue((error, event) -> {
            log.warn("Failed to transform state update: {}, error: {}", event, error.getMessage());
            transformationErrors.incrementAndGet();
        })
        .subscribe(
            this::publishToWebSocket,
            error -> log.error("Critical error in state update stream", error),
            () -> log.info("State update stream completed")
        );

    // Settings updates stream (similar pattern)
    settingsSubscription = reactiveMqttService.getSettingsUpdates()
        .flatMap(this::transformSettingsUpdate)
        .onErrorContinue((error, event) -> {
            log.warn("Failed to transform settings update: {}, error: {}", event, error.getMessage());
            transformationErrors.incrementAndGet();
        })
        .subscribe(
            this::publishToWebSocket,
            error -> log.error("Critical error in settings update stream", error)
        );
}

private void publishToWebSocket(RoomStatusUpdateMessage message) {
    Sinks.EmitResult result = roomStatusUpdateSink.tryEmitNext(message);

    if (result.isFailure()) {
        log.warn("Failed to emit WebSocket message for room {}: {}",
            message.payload().roomId(), result);
        publishErrors.incrementAndGet();
    } else {
        messagesProcessed.incrementAndGet();
        log.debug("Published WebSocket message for room {}", message.payload().roomId());
    }
}
```

**Error Categories**:
1. **Transformation Errors**: Device not found, invalid data → Skip message, log warning
2. **Publish Errors**: Sink full (backpressure) → Log warning, increment metric
3. **Stream Errors**: Reactive stream failure → Log error, attempt reconnection

---

## 4. Data Flow Design

### 4.1 deviceIdentifier → roomId Mapping

**Challenge**: MQTT messages use `deviceIdentifier` (String), WebSocket clients filter by `roomId` (UUID)

**Solution Flow**:
```
MqttStateUpdateEvent.roomId = "bedroom-ac" (deviceIdentifier)
              ↓
DeviceService.getDeviceByIdentifier("bedroom-ac")
              ↓
Device { id: UUID, deviceIdentifier: "bedroom-ac", roomId: UUID }
              ↓
RoomService.getRoomByIdWithDevices(householdId, roomId)
              ↓
RoomResponse { id: UUID, name: "Master Bedroom", devices: [...] }
              ↓
RoomStatusUpdateMessage { roomId: "uuid-string", ... }
```

**Edge Case Handling**:
- Device not found → `Mono.empty()` → Skip message
- Room not found → `Mono.empty()` → Skip message
- Multiple lookups → Cached by R2DBC (database query cache)

### 4.2 Message Transformation Logic

**Input**: `MqttStateUpdateEvent`
```java
{
    "roomId": "bedroom-ac",  // Actually deviceIdentifier
    "state": {
        "power": "on",
        "temperature": 22.0,
        "mode": "cool",
        "fan": "auto",
        "vane": "auto",
        "roomTemp": 24.5
    }
}
```

**Output**: `RoomStatusUpdateMessage`
```json
{
    "type": "room_status_update",
    "messageId": "uuid",
    "timestamp": "2025-10-12T14:30:00Z",
    "payload": {
        "roomId": "550e8400-e29b-41d4-a716-446655440000",
        "roomName": "Master Bedroom",
        "updateType": "DEVICE_STATE_UPDATE",
        "aggregateStatus": {
            "totalDevices": 1,
            "activeDevices": 1,
            "averageTemperature": 24.5
        },
        "devices": [
            {
                "deviceId": "uuid",
                "deviceIdentifier": "bedroom-ac",
                "type": "AIR_CONDITIONER",
                "state": {
                    "power": "on",
                    "temperature": 22.0,
                    "mode": "cool",
                    "fan": "auto",
                    "vane": "auto",
                    "roomTemp": 24.5
                }
            }
        ],
        "timestamp": "2025-10-12T14:30:00Z"
    }
}
```

**Transformation Steps**:
1. Extract `deviceIdentifier` from event.getRoomId()
2. Lookup Device → get roomId (UUID)
3. Lookup Room with devices → get RoomResponse
4. Create RoomStatusUpdatePayload with DEVICE_STATE_UPDATE type
5. Wrap in RoomStatusUpdateMessage

---

## 5. Reactive Streams Design

### 5.1 Subscription Lifecycle

```java
@PostConstruct
public void initialize() {
    log.info("Initializing MQTT-WebSocket Bridge");

    // Hot stream - starts immediately, processes all events
    stateSubscription = reactiveMqttService.getStateUpdates()
        .subscribeOn(Schedulers.boundedElastic()) // Use elastic scheduler for I/O ops
        .flatMap(this::transformStateUpdate, 8) // Parallel processing, concurrency=8
        .onErrorContinue(this::logTransformationError)
        .subscribe(
            this::publishToWebSocket,
            this::handleCriticalError,
            this::handleStreamCompletion
        );

    log.info("MQTT-WebSocket Bridge initialized successfully");
}

@PreDestroy
public void cleanup() {
    log.info("Cleaning up MQTT-WebSocket Bridge");

    if (stateSubscription != null && !stateSubscription.isDisposed()) {
        stateSubscription.dispose();
    }

    if (settingsSubscription != null && !settingsSubscription.isDisposed()) {
        settingsSubscription.dispose();
    }

    log.info("MQTT-WebSocket Bridge cleaned up successfully");
}
```

### 5.2 Backpressure Strategy

**Current Sinks Configuration**: `Sinks.many().multicast().onBackpressureBuffer()`
- Buffer size: Default 256 (configurable via Reactor)
- Overflow strategy: Buffer (blocks publisher if full)

**Bridge Strategy**: Use `tryEmitNext()` (non-blocking)
```java
private void publishToWebSocket(RoomStatusUpdateMessage message) {
    Sinks.EmitResult result = roomStatusUpdateSink.tryEmitNext(message);

    switch (result) {
        case OK -> messagesProcessed.incrementAndGet();
        case FAIL_OVERFLOW -> {
            log.warn("WebSocket sink overflow for room {}", message.payload().roomId());
            publishErrors.incrementAndGet();
            // Message dropped - acceptable for real-time system
        }
        case FAIL_TERMINATED -> {
            log.error("WebSocket sink terminated, cannot publish");
            publishErrors.incrementAndGet();
        }
        case FAIL_CANCELLED -> {
            log.warn("WebSocket sink cancelled");
            publishErrors.incrementAndGet();
        }
        default -> {
            log.warn("Unknown emit result: {}", result);
            publishErrors.incrementAndGet();
        }
    }
}
```

**Rationale**: For real-time device state, dropping occasional messages during overflow is acceptable. Client will receive next update.

---

## 6. Performance Considerations

### 6.1 Concurrency

**Parallel Processing**: Use `flatMap` with concurrency parameter
```java
.flatMap(this::transformStateUpdate, 8) // Process up to 8 events concurrently
```

**Rationale**:
- Device/room lookups are I/O-bound (database queries)
- Parallel processing improves throughput
- Bounded concurrency prevents resource exhaustion

### 6.2 Scheduler Selection

| Operation | Scheduler | Rationale |
|-----------|-----------|-----------|
| MQTT event subscription | `Schedulers.boundedElastic()` | I/O-bound operations (DB lookups) |
| Transformation | Same thread (reactive chain) | CPU-bound, no blocking |
| WebSocket publish | Same thread | Non-blocking Sink operation |

### 6.3 Database Query Optimization

**Existing Optimization**: R2DBC connection pooling
**Additional Optimization** (future): Cache device → room mapping in memory
```java
// Future enhancement (only if performance metrics show need)
private final LoadingCache<String, UUID> deviceToRoomCache = Caffeine.newBuilder()
    .maximumSize(1000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .build(deviceIdentifier -> /* lookup and cache */);
```

**Decision**: Start without caching (YAGNI), add only if latency > 500ms P95

---

## 7. Observability Design

### 7.1 Logging Strategy

**Log Levels**:
- **DEBUG**: Every message transformation, WebSocket publish
- **INFO**: Lifecycle events (initialize, cleanup), subscription status
- **WARN**: Transformation failures, device not found, WebSocket overflow
- **ERROR**: Critical stream failures, unexpected exceptions

**Log Format**:
```
[MqttWebSocketBroadcaster] Transformed state update for device 'bedroom-ac' → room 'uuid'
[MqttWebSocketBroadcaster] Published WebSocket message for room 'uuid' (messages processed: 1234)
[MqttWebSocketBroadcaster] WARN: Device not found for identifier 'unknown-device', skipping message
```

### 7.2 Metrics

**Counters**:
- `mqtt_websocket.messages.processed` - Total messages successfully published
- `mqtt_websocket.errors.transformation` - Transformation failures
- `mqtt_websocket.errors.publish` - WebSocket publish failures
- `mqtt_websocket.devices.not_found` - Device lookup failures

**Gauges**:
- `mqtt_websocket.subscriptions.active` - Number of active subscriptions

**Histograms** (future):
- `mqtt_websocket.latency` - End-to-end latency (MQTT → WebSocket)

### 7.3 Health Checks

```java
@Component
public class MqttWebSocketBridgeHealthIndicator implements HealthIndicator {

    private final MqttWebSocketBroadcaster broadcaster;

    @Override
    public Health health() {
        boolean subscriptionsActive = broadcaster.areSubscriptionsActive();
        long errorRate = broadcaster.getRecentErrorRate();

        if (!subscriptionsActive) {
            return Health.down()
                .withDetail("reason", "Subscriptions not active")
                .build();
        }

        if (errorRate > 0.1) { // > 10% error rate
            return Health.degraded()
                .withDetail("errorRate", errorRate)
                .build();
        }

        return Health.up()
            .withDetail("messagesProcessed", broadcaster.getMessagesProcessed())
            .build();
    }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test Cases**:
1. **transformStateUpdate_Success**: Valid event → Valid message
2. **transformStateUpdate_DeviceNotFound**: Returns Mono.empty()
3. **transformStateUpdate_RoomNotFound**: Returns Mono.empty()
4. **transformSettingsUpdate_Success**: Valid event → Valid message
5. **publishToWebSocket_Success**: tryEmitNext returns OK
6. **publishToWebSocket_Overflow**: tryEmitNext returns FAIL_OVERFLOW, logs warning
7. **lookupRoomByDeviceIdentifier_Success**: Returns RoomResponse
8. **lookupRoomByDeviceIdentifier_Error**: Returns Mono.empty()

**Test Setup**:
```java
@ExtendWith(MockitoExtension.class)
class MqttWebSocketBroadcasterTest {

    @Mock private ReactiveMqttService reactiveMqttService;
    @Mock private DeviceService deviceService;
    @Mock private RoomService roomService;
    @Mock private Sinks.Many<RoomStatusUpdateMessage> sink;

    @InjectMocks
    private MqttWebSocketBroadcaster broadcaster;

    @Test
    void transformStateUpdate_Success() {
        // Given: MQTT event with deviceIdentifier
        MqttStateUpdateEvent event = new MqttStateUpdateEvent(this, "bedroom-ac", state);

        // When: Device found, room found
        when(deviceService.getDeviceByIdentifier("bedroom-ac"))
            .thenReturn(Mono.just(device));
        when(roomService.getRoomByIdWithDevices(householdId, roomId))
            .thenReturn(Mono.just(roomResponse));

        // Then: Message created
        StepVerifier.create(broadcaster.transformStateUpdate(event))
            .assertNext(message -> {
                assertThat(message.payload().roomId()).isEqualTo(roomId.toString());
                assertThat(message.payload().updateType()).isEqualTo(DEVICE_STATE_UPDATE);
            })
            .verifyComplete();
    }
}
```

### 8.2 Integration Tests

**Test Scenario**: End-to-End Message Flow
```java
@SpringBootTest
@AutoConfigureMockMvc
class MqttWebSocketBridgeIntegrationTest {

    @Autowired private ApplicationEventPublisher eventPublisher;
    @Autowired private MqttWebSocketBroadcaster broadcaster;

    @Test
    void mqttEventTriggersWebSocketBroadcast() {
        // Given: Device and room exist in database
        // When: MQTT state update event published
        eventPublisher.publishEvent(new MqttStateUpdateEvent(this, "bedroom-ac", state));

        // Then: WebSocket message broadcast (verify via test subscriber)
        // Use reactor-test StepVerifier
    }
}
```

### 8.3 Test Coverage Target

- **Unit Tests**: 85%+ coverage
- **Integration Tests**: Critical paths (happy path + device not found)
- **Manual Testing**: End-to-end with real MQTT broker

---

## 9. Deployment Considerations

### 9.1 Configuration

**Application Properties**:
```yaml
mqtt:
  websocket:
    bridge:
      enabled: true
      concurrency: 8  # Parallel transformation threads
      log-debug: false  # Enable debug logging

spring:
  r2dbc:
    pool:
      initial-size: 10
      max-size: 50  # Sufficient for concurrent device lookups
```

### 9.2 Rollout Strategy

**Phase 1**: Deploy with debug logging enabled
**Phase 2**: Monitor metrics for 24 hours
**Phase 3**: Disable debug logging, scale as needed
**Phase 4**: Add caching if P95 latency > 500ms

### 9.3 Rollback Plan

**If Issues Detected**:
1. Set `mqtt.websocket.bridge.enabled=false` via config
2. Service gracefully disposes subscriptions (@PreDestroy)
3. WebSocket clients continue to work (no messages, but no crashes)
4. Roll back code deployment

---

## 10. Alternative Design Considered

### Alternative 1: Direct MQTT Subscription in Bridge
**Approach**: Bridge subscribes directly to MQTT broker, bypassing ReactiveMqttService

**Pros**:
- One less layer
- Direct control over MQTT subscription

**Cons**:
- Violates DRY (duplicates MQTT subscription logic)
- Breaks existing architecture (ReactiveMqttService unused)
- Harder to test (tight coupling to MQTT broker)

**Decision**: ❌ Rejected - Violates existing architecture, breaks DRY

### Alternative 2: WebSocket Handler Subscribes Directly to ReactiveMqttService
**Approach**: Each WebSocket handler subscribes to MQTT streams

**Pros**:
- No new component needed

**Cons**:
- Violates SRP (handlers manage sessions AND subscribe to MQTT)
- Duplicates subscription logic across handlers
- Harder to maintain (logic scattered)

**Decision**: ❌ Rejected - Violates SRP, poor cohesion

### Alternative 3: Event-Driven with Spring @EventListener (No Reactive Streams)
**Approach**: Bridge uses @EventListener instead of reactive streams

**Pros**:
- Simpler code (no Reactor complexity)

**Cons**:
- Loses backpressure management
- Synchronous processing (blocks event thread)
- Doesn't fit reactive architecture

**Decision**: ❌ Rejected - Blocks event thread, no backpressure

---

## 11. Design Approval

**Design Compliant With**:
- ✅ SOLID Principles (SRP, OCP, DIP)
- ✅ Clean Code (DRY, YAGNI, proper cohesion)
- ✅ Adapter Pattern (correct pattern application)
- ✅ Reactive Programming (non-blocking, backpressure-aware)
- ✅ Fault Isolation (WebSocket failures don't crash MQTT)
- ✅ Testable Architecture (clear inputs/outputs, mockable dependencies)

**Design Reviewed**: Claude (AI Assistant) with sequential thinking analysis
**Status**: Ready for Implementation
**Next Step**: Create implementation plan document
