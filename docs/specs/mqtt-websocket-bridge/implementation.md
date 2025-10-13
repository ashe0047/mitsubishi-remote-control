# MQTT-WebSocket Bridge Implementation Plan

## 1. Implementation Overview

### 1.1 Objective
Implement `MqttWebSocketBroadcaster` service that bridges MQTT device events to WebSocket client broadcasts in a phased, safe manner that preserves existing functionality.

### 1.2 Implementation Strategy
**Approach**: **Incremental, Test-Driven, Safe**
- Build in phases with verification at each step
- NO changes to existing services (ReactiveMqttService, DeviceService, RoomService)
- NO changes to existing WebSocket handlers
- Additive only - new service that plugs into existing architecture

### 1.3 Risk Mitigation
- Each phase has **verification checkpoint** before proceeding
- Existing functionality tested after each phase
- Feature flag support for easy rollback
- Comprehensive logging for debugging

---

## 2. Prerequisites Check

### 2.1 Verify Existing Components

**Before Starting**:
```bash
# Verify ReactiveMqttService exists and compiles
grep -r "class ReactiveMqttService" backend/turing/src

# Verify WebSocket sinks are configured
grep -r "roomStatusUpdateSink" backend/turing/src

# Verify DeviceService.getDeviceByIdentifier exists
grep -r "getDeviceByIdentifier" backend/turing/src

# Verify RoomService.getRoomByIdWithDevices exists
grep -r "getRoomByIdWithDevices" backend/turing/src
```

**Expected Results**:
- ✅ ReactiveMqttService class found
- ✅ Sinks configured in AirConditionerWebSocketConfig
- ✅ DeviceService method exists (confirmed at line 107)
- ✅ RoomService method exists

### 2.2 Documentation Requirements

**Fetch Latest Documentation**:
```
Context7 queries needed:
1. Spring Boot 3.5 WebFlux reactive programming
2. Project Reactor Flux subscription patterns
3. Project Reactor error handling (onErrorContinue, onErrorResume)
4. Reactor Sinks.Many usage and tryEmitNext
5. Spring @PostConstruct and @PreDestroy lifecycle
```

---

## 3. Phase-by-Phase Implementation

### **PHASE 1: Service Skeleton Creation**
**Duration**: 30 minutes
**Risk**: Low (no logic, just structure)

#### 1.1 Create Service File
**File**: `/backend/turing/src/main/java/com/ashelabs/turing/service/MqttWebSocketBroadcaster.java`

**Content**:
```java
package com.ashelabs.turing.service;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdateMessage;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.Disposable;
import reactor.core.publisher.Sinks;

import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
@RequiredArgsConstructor
public class MqttWebSocketBroadcaster {

    // Dependencies (injected by Spring)
    private final ReactiveMqttService reactiveMqttService;
    private final DeviceService deviceService;
    private final RoomService roomService;
    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;

    // Subscription lifecycle management
    private Disposable stateSubscription;
    private Disposable settingsSubscription;

    // Metrics
    private final AtomicLong messagesProcessed = new AtomicLong(0);
    private final AtomicLong transformationErrors = new AtomicLong(0);
    private final AtomicLong publishErrors = new AtomicLong(0);

    @PostConstruct
    public void initialize() {
        log.info("[MqttWebSocketBroadcaster] Initializing MQTT-WebSocket bridge");
        // TODO: Phase 2 - Add subscriptions
        log.info("[MqttWebSocketBroadcaster] Initialization complete (Phase 1 - skeleton only)");
    }

    @PreDestroy
    public void cleanup() {
        log.info("[MqttWebSocketBroadcaster] Cleaning up MQTT-WebSocket bridge");

        if (stateSubscription != null && !stateSubscription.isDisposed()) {
            stateSubscription.dispose();
            log.info("[MqttWebSocketBroadcaster] State subscription disposed");
        }

        if (settingsSubscription != null && !settingsSubscription.isDisposed()) {
            settingsSubscription.dispose();
            log.info("[MqttWebSocketBroadcaster] Settings subscription disposed");
        }

        log.info("[MqttWebSocketBroadcaster] Cleanup complete");
    }

    // Metrics accessors for health checks
    public long getMessagesProcessed() {
        return messagesProcessed.get();
    }

    public long getTransformationErrors() {
        return transformationErrors.get();
    }

    public long getPublishErrors() {
        return publishErrors.get();
    }

    public boolean areSubscriptionsActive() {
        return stateSubscription != null && !stateSubscription.isDisposed();
    }
}
```

#### 1.2 Verification Checkpoint

**Compile and Run**:
```bash
cd backend/turing
./mvnw clean compile
```

**Expected Output**:
- ✅ Compilation succeeds
- ✅ No dependency errors
- ✅ Spring Boot starts successfully
- ✅ Log shows: `[MqttWebSocketBroadcaster] Initializing...`
- ✅ Log shows: `[MqttWebSocketBroadcaster] Initialization complete (Phase 1 - skeleton only)`

**Existing Functionality Check**:
- ✅ MQTT messages still processed by ReactiveMqttService
- ✅ WebSocket connections still work
- ✅ No errors in application logs

**Phase 1 Success Criteria**: Service bean created, lifecycle methods called, NO side effects

---

### **PHASE 2: Helper Methods Implementation**
**Duration**: 45 minutes
**Risk**: Low (pure transformation logic, no subscriptions yet)

#### 2.1 Add Helper Methods

**Add to `MqttWebSocketBroadcaster.java`**:
```java
import com.ashelabs.turing.domain.device.Device;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdatePayload;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomUpdateType;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

// Add after metrics fields, before @PostConstruct

/**
 * Lookup room information by device identifier.
 *
 * This method performs the deviceIdentifier → Device → Room mapping.
 *
 * @param deviceIdentifier The device identifier from MQTT message
 * @return Mono of RoomResponse, or Mono.empty() if device/room not found
 */
private Mono<RoomResponse> lookupRoomByDeviceIdentifier(String deviceIdentifier) {
    return deviceService.getDeviceByIdentifier(deviceIdentifier)
        .flatMap(device -> {
            UUID roomId = device.roomId();
            UUID householdId = device.householdId();

            log.debug("[MqttWebSocketBroadcaster] Device '{}' found, roomId={}, householdId={}",
                deviceIdentifier, roomId, householdId);

            return roomService.getRoomByIdWithDevices(householdId, roomId);
        })
        .doOnSuccess(room -> {
            if (room != null) {
                log.debug("[MqttWebSocketBroadcaster] Room lookup success for device '{}': room='{}'",
                    deviceIdentifier, room.getName());
            }
        })
        .onErrorResume(error -> {
            log.warn("[MqttWebSocketBroadcaster] Failed to lookup room for device '{}': {}",
                deviceIdentifier, error.getMessage());
            return Mono.empty(); // Skip message if lookup fails
        });
}

/**
 * Create RoomStatusUpdateMessage from room data.
 *
 * @param room The room response with device information
 * @param updateType The type of update (DEVICE_STATE_UPDATE, DEVICE_SETTINGS_UPDATE, etc.)
 * @return RoomStatusUpdateMessage ready for WebSocket broadcast
 */
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

    log.debug("[MqttWebSocketBroadcaster] Created room status message: roomId={}, updateType={}",
        room.getId(), updateType);

    return RoomStatusUpdateMessage.create(payload);
}

/**
 * Publish message to WebSocket sink.
 *
 * Uses tryEmitNext() for non-blocking publish with backpressure handling.
 *
 * @param message The message to publish
 */
private void publishToWebSocket(RoomStatusUpdateMessage message) {
    Sinks.EmitResult result = roomStatusUpdateSink.tryEmitNext(message);

    switch (result) {
        case OK -> {
            messagesProcessed.incrementAndGet();
            log.debug("[MqttWebSocketBroadcaster] Published message for room '{}' (total processed: {})",
                message.payload().roomId(), messagesProcessed.get());
        }
        case FAIL_OVERFLOW -> {
            publishErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] WebSocket sink overflow for room '{}', message dropped",
                message.payload().roomId());
        }
        case FAIL_TERMINATED -> {
            publishErrors.incrementAndGet();
            log.error("[MqttWebSocketBroadcaster] WebSocket sink terminated, cannot publish for room '{}'",
                message.payload().roomId());
        }
        case FAIL_CANCELLED -> {
            publishErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] WebSocket sink cancelled for room '{}'",
                message.payload().roomId());
        }
        default -> {
            publishErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] Unknown emit result '{}' for room '{}'",
                result, message.payload().roomId());
        }
    }
}
```

#### 2.2 Add Transformation Methods

**Add to `MqttWebSocketBroadcaster.java`**:
```java
/**
 * Transform MQTT state update event to WebSocket message.
 *
 * @param event The MQTT state update event
 * @return Mono of RoomStatusUpdateMessage, or Mono.empty() if transformation fails
 */
private Mono<RoomStatusUpdateMessage> transformStateUpdate(MqttStateUpdateEvent event) {
    String deviceIdentifier = event.getRoomId(); // MQTT uses "roomId" field for deviceIdentifier

    log.debug("[MqttWebSocketBroadcaster] Transforming state update for device '{}'", deviceIdentifier);

    return lookupRoomByDeviceIdentifier(deviceIdentifier)
        .map(room -> createRoomStatusMessage(room, RoomUpdateType.DEVICE_STATE_UPDATE))
        .doOnSuccess(message -> {
            if (message != null) {
                log.debug("[MqttWebSocketBroadcaster] State update transformation complete for device '{}'",
                    deviceIdentifier);
            }
        })
        .onErrorResume(error -> {
            transformationErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] State update transformation failed for device '{}': {}",
                deviceIdentifier, error.getMessage());
            return Mono.empty();
        });
}

/**
 * Transform MQTT settings update event to WebSocket message.
 *
 * @param event The MQTT settings update event
 * @return Mono of RoomStatusUpdateMessage, or Mono.empty() if transformation fails
 */
private Mono<RoomStatusUpdateMessage> transformSettingsUpdate(MqttSettingsUpdateEvent event) {
    String deviceIdentifier = event.getRoomId(); // MQTT uses "roomId" field for deviceIdentifier

    log.debug("[MqttWebSocketBroadcaster] Transforming settings update for device '{}'", deviceIdentifier);

    return lookupRoomByDeviceIdentifier(deviceIdentifier)
        .map(room -> createRoomStatusMessage(room, RoomUpdateType.DEVICE_SETTINGS_UPDATE))
        .doOnSuccess(message -> {
            if (message != null) {
                log.debug("[MqttWebSocketBroadcaster] Settings update transformation complete for device '{}'",
                    deviceIdentifier);
            }
        })
        .onErrorResume(error -> {
            transformationErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] Settings update transformation failed for device '{}': {}",
                deviceIdentifier, error.getMessage());
            return Mono.empty();
        });
}
```

#### 2.3 Verification Checkpoint

**Unit Test** (create test file):
```java
// File: /backend/turing/src/test/java/com/ashelabs/turing/service/MqttWebSocketBroadcasterTest.java

@ExtendWith(MockitoExtension.class)
class MqttWebSocketBroadcasterTest {

    @Mock private ReactiveMqttService reactiveMqttService;
    @Mock private DeviceService deviceService;
    @Mock private RoomService roomService;
    @Mock private Sinks.Many<RoomStatusUpdateMessage> sink;

    @InjectMocks
    private MqttWebSocketBroadcaster broadcaster;

    private Device mockDevice;
    private RoomResponse mockRoom;

    @BeforeEach
    void setUp() {
        mockDevice = /* create mock device */;
        mockRoom = /* create mock room */;
    }

    @Test
    void lookupRoomByDeviceIdentifier_Success() {
        when(deviceService.getDeviceByIdentifier("test-device"))
            .thenReturn(Mono.just(mockDevice));
        when(roomService.getRoomByIdWithDevices(any(), any()))
            .thenReturn(Mono.just(mockRoom));

        StepVerifier.create(broadcaster.lookupRoomByDeviceIdentifier("test-device"))
            .expectNext(mockRoom)
            .verifyComplete();
    }

    @Test
    void lookupRoomByDeviceIdentifier_DeviceNotFound() {
        when(deviceService.getDeviceByIdentifier("unknown"))
            .thenReturn(Mono.empty());

        StepVerifier.create(broadcaster.lookupRoomByDeviceIdentifier("unknown"))
            .verifyComplete(); // Should return empty, not error
    }

    // Additional tests for transformation methods...
}
```

**Run Tests**:
```bash
./mvnw test -Dtest=MqttWebSocketBroadcasterTest
```

**Expected Output**:
- ✅ All unit tests pass
- ✅ Transformation logic works correctly
- ✅ Error handling returns Mono.empty() as expected

**Phase 2 Success Criteria**: Helper methods implemented and tested, NO runtime changes yet

---

### **PHASE 3: Subscription Integration**
**Duration**: 45 minutes
**Risk**: Medium (introduces active subscriptions)

#### 3.1 Update @PostConstruct

**Replace `initialize()` method**:
```java
@PostConstruct
public void initialize() {
    log.info("[MqttWebSocketBroadcaster] Initializing MQTT-WebSocket bridge");

    // Subscribe to MQTT state updates stream
    stateSubscription = reactiveMqttService.getStateUpdates()
        .flatMap(this::transformStateUpdate, 8) // Parallel processing, concurrency=8
        .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] State update ready for broadcast"))
        .subscribe(
            this::publishToWebSocket,
            error -> log.error("[MqttWebSocketBroadcaster] CRITICAL: State update stream error", error),
            () -> log.info("[MqttWebSocketBroadcaster] State update stream completed")
        );

    log.info("[MqttWebSocketBroadcaster] State update subscription active");

    // Subscribe to MQTT settings updates stream
    settingsSubscription = reactiveMqttService.getSettingsUpdates()
        .flatMap(this::transformSettingsUpdate, 8) // Parallel processing
        .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] Settings update ready for broadcast"))
        .subscribe(
            this::publishToWebSocket,
            error -> log.error("[MqttWebSocketBroadcaster] CRITICAL: Settings update stream error", error),
            () -> log.info("[MqttWebSocketBroadcaster] Settings update stream completed")
        );

    log.info("[MqttWebSocketBroadcaster] Settings update subscription active");
    log.info("[MqttWebSocketBroadcaster] MQTT-WebSocket bridge fully initialized and active");
}
```

#### 3.2 Verification Checkpoint

**Manual Testing Steps**:

1. **Start Backend**:
   ```bash
   ./mvnw spring-boot:run
   ```

2. **Check Logs**:
   ```
   [MqttWebSocketBroadcaster] Initializing MQTT-WebSocket bridge
   [MqttWebSocketBroadcaster] State update subscription active
   [MqttWebSocketBroadcaster] Settings update subscription active
   [MqttWebSocketBroadcaster] MQTT-WebSocket bridge fully initialized and active
   ```

3. **Trigger MQTT Message** (if MQTT broker available):
   ```bash
   # Publish test message to MQTT broker
   mosquitto_pub -t "mitsubishi2mqtt/test-device/state" -m '{"power":"on","temperature":22}'
   ```

4. **Verify Logs Show**:
   ```
   [MqttWebSocketBroadcaster] Transforming state update for device 'test-device'
   [MqttWebSocketBroadcaster] Device 'test-device' found, roomId=..., householdId=...
   [MqttWebSocketBroadcaster] Room lookup success for device 'test-device': room='...'
   [MqttWebSocketBroadcaster] Published message for room '...' (total processed: 1)
   ```

5. **Frontend WebSocket Client Check**:
   - Connect WebSocket client to room
   - Verify client receives JSON message
   - Message should contain device state update

**Phase 3 Success Criteria**:
- ✅ Subscriptions created and active
- ✅ MQTT messages trigger transformations
- ✅ WebSocket messages published to sinks
- ✅ Frontend clients receive updates
- ✅ NO errors in logs
- ✅ Existing functionality still works

---

### **PHASE 4: Error Handling Enhancement**
**Duration**: 30 minutes
**Risk**: Low (defensive improvements)

#### 4.1 Add Robust Error Handling

**Update subscription with `.onErrorContinue()`**:
```java
@PostConstruct
public void initialize() {
    log.info("[MqttWebSocketBroadcaster] Initializing MQTT-WebSocket bridge");

    // State updates with error continuation
    stateSubscription = reactiveMqttService.getStateUpdates()
        .flatMap(this::transformStateUpdate, 8)
        .onErrorContinue((error, event) -> {
            transformationErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] Skipping event due to transformation error: {}, event: {}",
                error.getMessage(), event);
        })
        .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] State update ready for broadcast"))
        .subscribe(
            this::publishToWebSocket,
            error -> {
                log.error("[MqttWebSocketBroadcaster] CRITICAL: State update stream terminated", error);
                // Attempt to reconnect (future enhancement)
            },
            () -> log.info("[MqttWebSocketBroadcaster] State update stream completed")
        );

    log.info("[MqttWebSocketBroadcaster] State update subscription active with error handling");

    // Settings updates with error continuation
    settingsSubscription = reactiveMqttService.getSettingsUpdates()
        .flatMap(this::transformSettingsUpdate, 8)
        .onErrorContinue((error, event) -> {
            transformationErrors.incrementAndGet();
            log.warn("[MqttWebSocketBroadcaster] Skipping event due to transformation error: {}, event: {}",
                error.getMessage(), event);
        })
        .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] Settings update ready for broadcast"))
        .subscribe(
            this::publishToWebSocket,
            error -> {
                log.error("[MqttWebSocketBroadcaster] CRITICAL: Settings update stream terminated", error);
            },
            () -> log.info("[MqttWebSocketBroadcaster] Settings update stream completed")
        );

    log.info("[MqttWebSocketBroadcaster] Settings update subscription active with error handling");
    log.info("[MqttWebSocketBroadcaster] MQTT-WebSocket bridge fully initialized with fault isolation");
}
```

#### 4.2 Verification Checkpoint

**Error Injection Test**:
1. Temporarily break device lookup (comment out device in database)
2. Trigger MQTT message for non-existent device
3. Verify:
   - ✅ Warning logged: "Skipping event due to transformation error"
   - ✅ transformationErrors counter incremented
   - ✅ Stream continues processing next message
   - ✅ Application doesn't crash

**Phase 4 Success Criteria**:
- ✅ Errors logged but don't crash stream
- ✅ Metrics track error counts
- ✅ Subsequent messages processed correctly

---

### **PHASE 5: Integration Testing & Monitoring**
**Duration**: 1 hour
**Risk**: Low (verification only)

#### 5.1 End-to-End Test Scenarios

**Test 1: Happy Path**
```
Trigger: Physical AC device changes state
Expected:
1. MQTT broker receives message
2. MqttService publishes event
3. ReactiveMqttService emits to Flux
4. MqttWebSocketBroadcaster transforms and publishes
5. WebSocket client receives JSON message within 500ms
6. Frontend UI updates
```

**Test 2: Device Not Found**
```
Trigger: MQTT message for unknown device
Expected:
1. lookupRoomByDeviceIdentifier returns Mono.empty()
2. Warning logged
3. transformationErrors metric incremented
4. Stream continues processing
5. No WebSocket message sent
```

**Test 3: Multiple Devices Simultaneously**
```
Trigger: 3 devices in 3 rooms update simultaneously
Expected:
1. All 3 messages processed in parallel
2. Correct room mapping for each
3. Each room's WebSocket clients receive only their update
4. messagesProcessed = 3
```

**Test 4: WebSocket Sink Backpressure**
```
Trigger: Slow WebSocket consumer + rapid MQTT messages
Expected:
1. tryEmitNext() returns FAIL_OVERFLOW
2. publishErrors metric incremented
3. Warning logged
4. MQTT processing continues
5. No application crash
```

#### 5.2 Metrics Monitoring

**Add Metrics Endpoint** (optional):
```java
@RestController
@RequestMapping("/actuator/mqtt-websocket-bridge")
public class MqttWebSocketBridgeMetricsController {

    private final MqttWebSocketBroadcaster broadcaster;

    @GetMapping("/metrics")
    public Map<String, Object> getMetrics() {
        return Map.of(
            "messagesProcessed", broadcaster.getMessagesProcessed(),
            "transformationErrors", broadcaster.getTransformationErrors(),
            "publishErrors", broadcaster.getPublishErrors(),
            "subscriptionsActive", broadcaster.areSubscriptionsActive()
        );
    }
}
```

**Monitor via**:
```bash
curl http://localhost:8081/actuator/mqtt-websocket-bridge/metrics
```

#### 5.3 Performance Verification

**Latency Test**:
```bash
# Measure time from MQTT publish to WebSocket receive
# Expected: < 500ms P95
```

**Load Test**:
```bash
# Send 100 MQTT messages/second
# Verify: No errors, all messages processed
```

**Phase 5 Success Criteria**:
- ✅ All test scenarios pass
- ✅ Latency < 500ms P95
- ✅ Throughput > 100 msg/sec
- ✅ Error handling works as designed
- ✅ Existing features unaffected

---

## 4. Rollback Plan

### If Issues Detected:

**Option 1: Disable Bridge**
```java
// Add to application.properties
mqtt.websocket.bridge.enabled=false
```

**Option 2: Comment Out Subscriptions**
```java
@PostConstruct
public void initialize() {
    if (!bridgeEnabled) {
        log.info("[MqttWebSocketBroadcaster] Bridge disabled by configuration");
        return;
    }
    // ... rest of initialization
}
```

**Option 3: Full Rollback**
- Delete `MqttWebSocketBroadcaster.java`
- Revert commit
- Restart application

---

## 5. Post-Implementation Checklist

### Code Quality:
- [ ] All unit tests passing (target: 85% coverage)
- [ ] Integration tests passing
- [ ] No compiler warnings
- [ ] Code follows existing style/patterns
- [ ] Javadoc added for all public methods
- [ ] Logging at appropriate levels

### Functionality:
- [ ] MQTT messages trigger WebSocket broadcasts
- [ ] Device-to-room mapping works correctly
- [ ] Error handling prevents crashes
- [ ] Metrics track processing and errors
- [ ] Existing features still work

### Performance:
- [ ] Latency < 500ms P95
- [ ] No memory leaks (check with profiler)
- [ ] CPU usage acceptable (< 20% increase)
- [ ] Database connection pool not exhausted

### Documentation:
- [ ] Implementation matches design document
- [ ] README updated (if needed)
- [ ] Troubleshooting guide added
- [ ] Metrics documented

---

## 6. Next Steps After Implementation

### Monitoring (Week 1):
- Monitor error metrics daily
- Check latency percentiles
- Verify no memory leaks
- Review logs for unexpected warnings

### Optimization (Week 2):
- If latency > 500ms: Add device-to-room caching
- If throughput issues: Tune concurrency parameter
- If memory issues: Tune Reactor buffer sizes

### Future Enhancements:
- Add connection status broadcasting (FR-4 - Medium priority)
- Add stream auto-reconnection on failure
- Add distributed tracing (OpenTelemetry)
- Add Grafana dashboard for metrics

---

## 7. Implementation Time Estimate

| Phase | Duration | Risk | Dependencies |
|-------|----------|------|--------------|
| Phase 1: Skeleton | 30 min | Low | None |
| Phase 2: Helpers | 45 min | Low | Phase 1 |
| Phase 3: Subscriptions | 45 min | Medium | Phase 1, 2 |
| Phase 4: Error Handling | 30 min | Low | Phase 3 |
| Phase 5: Testing | 1 hour | Low | Phase 4 |
| **Total** | **3.5 hours** | - | - |

**Buffer for unknowns**: +1 hour
**Total estimated time**: **4-5 hours**

---

## 8. Success Criteria Summary

**Implementation Complete When**:
1. ✅ All 5 phases completed with verification
2. ✅ Unit tests at 85%+ coverage
3. ✅ Integration tests passing
4. ✅ End-to-end flow verified with real MQTT messages
5. ✅ Performance targets met (< 500ms latency)
6. ✅ Error handling prevents failures
7. ✅ Existing functionality unaffected
8. ✅ Code reviewed and approved
9. ✅ Documentation updated
10. ✅ Deployed to development environment

**Status**: Ready to Begin Phase 1
**Next Action**: Create MqttWebSocketBroadcaster.java skeleton
