# Quota Management Feature Completion - Technical Design Document

## 1. Executive Summary

### 1.1 Design Overview
This document provides the technical design for safely completing the quota management system integration with the existing Turing backend. The design focuses on **non-breaking integration** of quota validation into the existing reactive architecture while maintaining all existing functionality and performance characteristics.

### 1.2 Architecture Principles
- **Fail-Safe First**: AC control never fails due to quota services
- **Non-Breaking Integration**: Existing APIs and behaviors remain unchanged
- **Performance Preservation**: <100ms quota validation without impacting existing operations
- **Reactive Consistency**: Maintain existing reactive patterns and error handling
- **Feature Flag Control**: Complete quota functionality can be disabled instantly

### 1.3 Integration Points
The design integrates quota functionality at these key points:
1. **ReactiveAirConService**: Command validation before MQTT publishing
2. **MQTT Event Handlers**: Usage session tracking on state changes
3. **WebSocket Service**: Quota notification broadcasting
4. **Database Layer**: Efficient quota and usage queries
5. **Security Layer**: Authorization checks for quota operations

---

## 2. Current System Architecture Analysis

### 2.1 Existing Components Assessment

**ReactiveAirConService** ✅ **Solid Foundation**
```java
// Current reactive command processing pattern
public Mono<Void> setPower(String roomId, boolean power) {
    return Mono.fromRunnable(() -> {
        // Current: Direct MQTT publishing
        mqttService.publishCommand(roomId, "power", power);
    }).subscribeOn(Schedulers.boundedElastic());
}
```
**Integration Point**: Add quota validation before `mqttService.publishCommand()`

**QuotaValidationService** ✅ **Good Structure, Needs Completion**
```java
// Existing infrastructure present
private static final Duration VALIDATION_TIMEOUT = Duration.ofMillis(100);
private final ReactiveRedisTemplate<String, Object> redisTemplate;
```
**Completion Need**: Implement actual validation logic and caching strategies

**Database Layer** ✅ **Complete Schema, Repositories Exist**
- All required repositories are present
- Database schema is production-ready
- R2DBC integration configured

**WebSocket Infrastructure** ✅ **Functional, Needs Extension**
- Existing room-based broadcasting
- JWT authentication integrated
- Ready for quota message types

### 2.2 Integration Challenges

**Challenge 1: Non-Breaking Command Pipeline**
- **Issue**: Must add quota validation without changing existing method signatures
- **Solution**: Internal middleware pattern with transparent fail-over

**Challenge 2: Performance Preservation**
- **Issue**: Quota validation could slow down AC commands
- **Solution**: Asynchronous validation with Redis caching and timeouts

**Challenge 3: Error Boundary Management**
- **Issue**: Quota service failures must not break AC control
- **Solution**: Comprehensive try-catch with fail-safe defaults

---

## 3. Quota Integration Architecture

### 3.1 Command Validation Pipeline

#### 3.1.1 Enhanced ReactiveAirConService Design

**Current Flow:**
```
User Command → ReactiveAirConService → MQTT Service → AC Unit
```

**New Flow:**
```
User Command → ReactiveAirConService → Quota Validation → MQTT Service → AC Unit
                                   ↓
                            Usage Session Tracking
                                   ↓
                            WebSocket Notifications
```

#### 3.1.2 Safe Integration Pattern

```java
@Service
public class ReactiveAirConService {

    private final QuotaValidationService quotaValidationService;
    private final QuotaFeatureService featureService;

    /**
     * Enhanced power control with quota validation
     * Maintains existing method signature and behavior
     */
    public Mono<Void> setPower(String roomId, boolean power,
                               @Nullable String userId) {

        // Feature flag check - instant bypass if quotas disabled
        if (!featureService.isQuotaEnabled()) {
            return executePowerCommandDirectly(roomId, power);
        }

        // If no userId provided, execute directly (backward compatibility)
        if (userId == null) {
            return executePowerCommandDirectly(roomId, power);
        }

        // Quota validation with fail-safe timeout
        return validateQuotaWithFailSafe(userId, roomId, "power", power)
            .flatMap(validationResult -> {
                if (validationResult.isAllowed()) {
                    return executePowerCommandWithTracking(roomId, power, userId)
                        .then(sendQuotaUpdateNotifications(userId, roomId));
                } else {
                    return Mono.error(new QuotaExceededException(
                        validationResult.getReason(),
                        validationResult.getQuotaBalance()));
                }
            })
            .onErrorResume(QuotaServiceException.class, error -> {
                log.warn("Quota service unavailable for user {} room {}: {}",
                    userId, roomId, error.getMessage());
                // Fail-safe: execute command anyway
                return executePowerCommandDirectly(roomId, power);
            });
    }

    /**
     * Fail-safe quota validation with timeout protection
     */
    private Mono<QuotaValidationResult> validateQuotaWithFailSafe(
            String userId, String roomId, String command, Object value) {

        return quotaValidationService.validateCommand(userId, roomId, command, value)
            .timeout(Duration.ofMillis(100))  // Hard timeout
            .onErrorReturn(
                // Any error (timeout, service failure, etc.) → allow command
                QuotaValidationResult.allowed("Fail-safe mode: validation failed")
            );
    }

    /**
     * Execute command with usage session tracking
     */
    private Mono<Void> executePowerCommandWithTracking(
            String roomId, boolean power, String userId) {

        return Mono.fromRunnable(() -> {
            // Execute original MQTT command
            mqttService.publishCommand(roomId, "power", power);
        })
        .subscribeOn(Schedulers.boundedElastic())
        .then(
            // Track usage session asynchronously (non-blocking)
            trackUsageSession(userId, roomId, power)
                .onErrorResume(error -> {
                    log.warn("Usage tracking failed for user {} room {}: {}",
                        userId, roomId, error.getMessage());
                    return Mono.empty(); // Don't fail the command
                })
        );
    }

    /**
     * Original direct execution (preserves existing behavior)
     */
    private Mono<Void> executePowerCommandDirectly(String roomId, boolean power) {
        return Mono.fromRunnable(() -> {
            mqttService.publishCommand(roomId, "power", power);
        }).subscribeOn(Schedulers.boundedElastic());
    }
}
```

### 3.2 Quota Validation Service Implementation

#### 3.2.1 Complete Validation Logic

```java
@Service
public class QuotaValidationService {

    /**
     * Core validation method with Redis caching and database fallback
     */
    public Mono<QuotaValidationResult> validateCommand(
            String userId, String roomId, String command, Object value) {

        // Only validate power-on commands for MVP
        if (!"power".equals(command) || !Boolean.TRUE.equals(value)) {
            return Mono.just(QuotaValidationResult.allowed("Non-power-on command"));
        }

        String cacheKey = buildQuotaBalanceKey(userId, roomId);

        return redisTemplate.opsForValue().get(cacheKey)
            .cast(QuotaBalance.class)
            .switchIfEmpty(loadQuotaBalanceFromDatabase(userId, roomId))
            .map(this::validateAgainstBalance)
            .doOnNext(result -> cacheValidationResult(cacheKey, result))
            .timeout(VALIDATION_TIMEOUT)
            .onErrorReturn(QuotaValidationResult.allowed("Validation timeout"));
    }

    /**
     * Load quota balance from database with error handling
     */
    private Mono<QuotaBalance> loadQuotaBalanceFromDatabase(String userId, String roomId) {
        UUID userUuid = UUID.fromString(userId);
        LocalDate today = LocalDate.now();

        return quotaRepository.findActiveQuotaByUserAndRoom(userUuid, roomId, today)
            .flatMap(quota -> calculateCurrentBalance(quota))
            .doOnNext(balance -> cacheQuotaBalance(userId, roomId, balance))
            .switchIfEmpty(Mono.just(QuotaBalance.noQuotaConfigured()));
    }

    /**
     * Calculate current balance including active sessions
     */
    private Mono<QuotaBalance> calculateCurrentBalance(Quota quota) {
        LocalDate today = LocalDate.now();

        return usageSessionRepository
            .findTodayUsageForUserAndRoom(quota.getUserId(), quota.getTargetId(), today)
            .collectList()
            .map(sessions -> {
                BigDecimal usedAmount = sessions.stream()
                    .filter(session -> session.getEndedAt() != null)
                    .map(session -> BigDecimal.valueOf(session.getDurationMinutes()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

                // Add active session time
                sessions.stream()
                    .filter(session -> session.getEndedAt() == null)
                    .findFirst()
                    .ifPresent(activeSession -> {
                        long activeMinutes = Duration.between(
                            activeSession.getStartedAt(),
                            Instant.now()
                        ).toMinutes();
                        usedAmount.add(BigDecimal.valueOf(activeMinutes));
                    });

                return QuotaBalance.builder()
                    .quotaId(quota.getId().toString())
                    .userId(quota.getUserId().toString())
                    .roomId(quota.getTargetId())
                    .totalAmount(quota.getAllowedAmount())
                    .usedAmount(usedAmount)
                    .remainingAmount(quota.getAllowedAmount().subtract(usedAmount))
                    .warningThreshold(getWarningThreshold(quota))
                    .build();
            });
    }

    /**
     * Validate command against quota balance
     */
    private QuotaValidationResult validateAgainstBalance(QuotaBalance balance) {
        if (balance.isNoQuotaConfigured()) {
            return QuotaValidationResult.allowed("No quota configured");
        }

        if (balance.getRemainingAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return QuotaValidationResult.denied(
                "Daily quota exceeded",
                balance,
                QuotaViolationType.LIMIT_EXCEEDED
            );
        }

        // Check warning thresholds
        BigDecimal usagePercentage = balance.getUsedAmount()
            .divide(balance.getTotalAmount(), 2, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));

        if (usagePercentage.compareTo(BigDecimal.valueOf(balance.getWarningThreshold())) >= 0) {
            return QuotaValidationResult.allowedWithWarning(
                "Approaching quota limit",
                balance,
                QuotaViolationType.WARNING_THRESHOLD
            );
        }

        return QuotaValidationResult.allowed("Within quota limits");
    }
}
```

### 3.3 Usage Session Tracking Integration

#### 3.3.1 MQTT Event-Driven Session Management

```java
@Service
public class UsageSessionTracker {

    private final UsageSessionRepository sessionRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Handle MQTT state updates for session tracking
     */
    @EventListener
    public void handleMqttStateUpdate(MqttStateUpdateEvent event) {
        if (!"power".equals(event.getProperty()) || event.getUserId() == null) {
            return; // Only track power changes for authenticated users
        }

        String userId = event.getUserId();
        String roomId = event.getRoomId();
        boolean powerOn = Boolean.TRUE.equals(event.getValue());

        if (powerOn) {
            startUsageSession(userId, roomId, event.getSettings())
                .doOnError(error -> log.warn("Failed to start usage session: {}", error.getMessage()))
                .subscribe();
        } else {
            endUsageSession(userId, roomId)
                .doOnError(error -> log.warn("Failed to end usage session: {}", error.getMessage()))
                .subscribe();
        }
    }

    /**
     * Start a new usage session
     */
    private Mono<UsageSession> startUsageSession(String userId, String roomId,
                                                AirConSettings settings) {
        return sessionRepository
            .findActiveSessionByUserAndRoom(UUID.fromString(userId), roomId)
            .flatMap(existingSession -> {
                // End any existing active session first
                log.info("Ending previous active session before starting new one");
                return endActiveSession(existingSession);
            })
            .then(createNewUsageSession(userId, roomId, settings))
            .doOnSuccess(session -> {
                log.info("Started usage session {} for user {} in room {}",
                    session.getId(), userId, roomId);

                // Publish session started event for quota updates
                eventPublisher.publishEvent(new UsageSessionStartedEvent(
                    session.getId().toString(), userId, roomId
                ));
            });
    }

    /**
     * End current usage session
     */
    private Mono<UsageSession> endUsageSession(String userId, String roomId) {
        return sessionRepository
            .findActiveSessionByUserAndRoom(UUID.fromString(userId), roomId)
            .flatMap(this::endActiveSession)
            .doOnSuccess(session -> {
                if (session != null) {
                    log.info("Ended usage session {} for user {} in room {} (duration: {} minutes)",
                        session.getId(), userId, roomId, session.getDurationMinutes());

                    // Publish session ended event for quota updates
                    eventPublisher.publishEvent(new UsageSessionEndedEvent(
                        session.getId().toString(), userId, roomId, session.getDurationMinutes()
                    ));
                }
            });
    }

    /**
     * End an active session by setting end time and calculating duration
     */
    private Mono<UsageSession> endActiveSession(UsageSession session) {
        Instant now = Instant.now();
        session.setEndedAt(now);
        session.setStatus(SessionStatus.COMPLETED);

        // Calculate duration in minutes
        long durationMinutes = Duration.between(session.getStartedAt(), now).toMinutes();
        session.setDurationMinutes((int) durationMinutes);

        return sessionRepository.save(session);
    }
}
```

### 3.4 WebSocket Integration for Real-time Updates

#### 3.4.1 Quota Notification Service

```java
@Service
public class ReactiveQuotaNotificationService {

    private final ReactiveWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;

    /**
     * Send quota update to all household members
     */
    @EventListener
    public void handleQuotaUpdate(QuotaUpdateEvent event) {
        try {
            QuotaWebSocketMessage message = QuotaWebSocketMessage.builder()
                .type("QUOTA_UPDATE")
                .payload(QuotaUpdatePayload.builder()
                    .quotaId(event.getQuotaId())
                    .familyMemberId(event.getUserId())
                    .roomId(event.getRoomId())
                    .currentUsage(event.getCurrentUsage())
                    .dailyLimit(event.getDailyLimit())
                    .status(event.getStatus().toString())
                    .isCurrentlyActive(event.isCurrentlyActive())
                    .estimatedSessionUsage(event.getEstimatedSessionUsage())
                    .lastUpdated(Instant.now().toString())
                    .build())
                .build();

            String messageJson = objectMapper.writeValueAsString(message);

            // Send to all clients in the household
            webSocketHandler.broadcastToHousehold(
                event.getHouseholdId(),
                messageJson
            );

        } catch (Exception e) {
            log.error("Failed to send quota update notification: {}", e.getMessage());
        }
    }

    /**
     * Send quota violation alert
     */
    @EventListener
    public void handleQuotaViolation(QuotaViolationEvent event) {
        try {
            QuotaWebSocketMessage message = QuotaWebSocketMessage.builder()
                .type("QUOTA_VIOLATION_ALERT")
                .payload(QuotaViolationPayload.builder()
                    .quotaId(event.getQuotaId())
                    .familyMemberId(event.getUserId())
                    .roomId(event.getRoomId())
                    .violationType(event.getViolationType().toString())
                    .currentUsage(event.getCurrentUsage())
                    .limit(event.getLimit())
                    .timestamp(Instant.now().toString())
                    .build())
                .build();

            String messageJson = objectMapper.writeValueAsString(message);

            // Send to all clients in the household
            webSocketHandler.broadcastToHousehold(
                event.getHouseholdId(),
                messageJson
            );

        } catch (Exception e) {
            log.error("Failed to send quota violation notification: {}", e.getMessage());
        }
    }
}
```

#### 3.4.2 Enhanced WebSocket Handler

```java
@Component
public class ReactiveWebSocketHandler {

    private final Map<String, Set<WebSocketSession>> householdSessions = new ConcurrentHashMap<>();

    /**
     * Broadcast message to all clients in a household
     */
    public void broadcastToHousehold(String householdId, String message) {
        Set<WebSocketSession> sessions = householdSessions.get(householdId);
        if (sessions != null) {
            sessions.removeIf(session -> !session.isOpen());

            List<Mono<Void>> sendOperations = sessions.stream()
                .map(session -> {
                    try {
                        return session.send(Mono.just(session.textMessage(message)));
                    } catch (Exception e) {
                        log.warn("Failed to send message to WebSocket session: {}", e.getMessage());
                        return Mono.empty();
                    }
                })
                .collect(Collectors.toList());

            Mono.when(sendOperations)
                .doOnError(error -> log.error("Error broadcasting to household {}: {}",
                    householdId, error.getMessage()))
                .subscribe();
        }
    }

    /**
     * Enhanced connection handling with household association
     */
    @Override
    public Mono<Void> handle(WebSocketSession session) {
        // Extract household ID from JWT token in connection
        String householdId = extractHouseholdIdFromSession(session);
        if (householdId != null) {
            addSessionToHousehold(householdId, session);
        }

        // Handle quota-specific messages
        return session.receive()
            .map(WebSocketMessage::getPayloadAsText)
            .flatMap(message -> handleIncomingMessage(session, message))
            .then()
            .doFinally(signal -> removeSessionFromHousehold(householdId, session));
    }
}
```

---

## 4. Database Optimization Strategy

### 4.1 Query Performance Optimization

#### 4.1.1 Critical Query Patterns

**Daily Quota Balance Query** (Most Frequent - <50ms target):
```sql
-- Optimized with existing indexes
SELECT q.*,
       COALESCE(SUM(us.duration_minutes), 0) as used_minutes,
       COUNT(us.id) as session_count
FROM quotas q
LEFT JOIN usage_sessions us ON (
    us.user_id = q.user_id
    AND us.room_id = q.target_id
    AND DATE(us.started_at) = CURRENT_DATE
    AND us.status IN ('completed', 'active')
)
WHERE q.user_id = ? AND q.target_id = ? AND q.status = 'active'
GROUP BY q.id;
```

**Active Session Check** (Real-time - <20ms target):
```sql
-- Single query for session state
SELECT id, started_at, initial_settings
FROM usage_sessions
WHERE user_id = ? AND room_id = ? AND status = 'active'
LIMIT 1;
```

#### 4.1.2 Redis Caching Strategy

**Cache Structure:**
```
quota:balance:{userId}:{roomId} → QuotaBalance object (TTL: 1 hour)
quota:config:{userId}:{roomId} → Quota configuration (TTL: 4 hours)
quota:sessions:{userId}:{roomId} → Active session ID (TTL: 24 hours)
quota:violations:{userId} → Recent violations list (TTL: 1 hour)
```

**Cache Warming Strategy:**
```java
@Scheduled(fixedRate = 300000) // Every 5 minutes
public void warmQuotaCaches() {
    // Warm caches for active users only
    usageSessionRepository.findActiveUsers()
        .flatMap(this::preloadQuotaBalance)
        .doOnError(error -> log.warn("Cache warming failed: {}", error.getMessage()))
        .subscribe();
}
```

### 4.2 Database Transaction Management

#### 4.2.1 Session Lifecycle Transactions

```java
/**
 * Atomic session end with quota balance update
 */
@Transactional
public Mono<Void> endSessionWithBalanceUpdate(String sessionId) {
    return sessionRepository.findById(UUID.fromString(sessionId))
        .flatMap(session -> {
            // End session atomically
            return endSession(session)
                .then(updateQuotaBalance(session))
                .then(invalidateCache(session.getUserId(), session.getRoomId()));
        });
}
```

---

## 5. Error Handling & Resilience Patterns

### 5.1 Comprehensive Error Handling Strategy

#### 5.1.1 Error Classification and Responses

```java
public enum QuotaErrorType {
    VALIDATION_TIMEOUT,     // Allow command, log warning
    DATABASE_UNAVAILABLE,   // Allow command, cache miss
    REDIS_UNAVAILABLE,     // Skip caching, use database
    QUOTA_SERVICE_ERROR,   // Allow command, alert ops
    CONFIGURATION_ERROR,   // Allow command, alert ops
    AUTHENTICATION_ERROR   // Deny command, proper error
}

/**
 * Centralized error handling for quota operations
 */
@Component
public class QuotaErrorHandler {

    public QuotaValidationResult handleValidationError(Throwable error) {
        if (error instanceof TimeoutException) {
            return QuotaValidationResult.allowed("Validation timeout - fail-safe mode");
        } else if (error instanceof DataAccessException) {
            return QuotaValidationResult.allowed("Database unavailable - fail-safe mode");
        } else if (error instanceof RedisConnectionException) {
            // Continue with database-only validation
            return QuotaValidationResult.retryWithoutCache();
        } else {
            log.error("Unexpected quota validation error", error);
            return QuotaValidationResult.allowed("Service error - fail-safe mode");
        }
    }
}
```

#### 5.1.2 Circuit Breaker Pattern

```java
@Component
public class QuotaCircuitBreaker {

    private final AtomicInteger failureCount = new AtomicInteger(0);
    private volatile boolean circuitOpen = false;
    private volatile Instant lastFailure = Instant.now();

    private static final int FAILURE_THRESHOLD = 5;
    private static final Duration RECOVERY_TIMEOUT = Duration.ofMinutes(2);

    public boolean shouldAllowValidation() {
        if (!circuitOpen) {
            return true;
        }

        // Check if recovery period has passed
        if (Duration.between(lastFailure, Instant.now()).compareTo(RECOVERY_TIMEOUT) > 0) {
            log.info("Quota circuit breaker attempting recovery");
            circuitOpen = false;
            failureCount.set(0);
            return true;
        }

        return false;
    }

    public void recordFailure() {
        int failures = failureCount.incrementAndGet();
        lastFailure = Instant.now();

        if (failures >= FAILURE_THRESHOLD && !circuitOpen) {
            circuitOpen = true;
            log.error("Quota circuit breaker OPENED after {} failures", failures);
        }
    }

    public void recordSuccess() {
        failureCount.set(0);
        if (circuitOpen) {
            circuitOpen = false;
            log.info("Quota circuit breaker CLOSED after successful operation");
        }
    }
}
```

### 5.2 Graceful Degradation Modes

#### 5.2.1 Degradation Levels

**Level 0: Full Functionality**
- All quota validation active
- Real-time usage tracking
- WebSocket notifications
- Redis caching operational

**Level 1: Database-Only Mode**
- Redis cache unavailable
- Quota validation from database only
- Increased response times acceptable
- All enforcement still active

**Level 2: Warning-Only Mode**
- Database queries timing out
- Quota warnings only, no blocking
- Usage tracking best-effort
- AC commands always allowed

**Level 3: Fail-Safe Mode**
- All quota services unavailable
- No quota enforcement
- AC operates as if no quotas exist
- Clear logging and alerts

#### 5.2.2 Degradation Detection and Recovery

```java
@Service
public class QuotaDegradationManager {

    private volatile DegradationLevel currentLevel = DegradationLevel.FULL_FUNCTIONALITY;

    @EventListener
    public void handleDatabaseFailure(DatabaseConnectionEvent event) {
        if (!event.isConnected()) {
            degradeTo(DegradationLevel.WARNING_ONLY);
        } else {
            recoverTo(DegradationLevel.FULL_FUNCTIONALITY);
        }
    }

    @EventListener
    public void handleRedisFailure(RedisConnectionEvent event) {
        if (!event.isConnected() && currentLevel == DegradationLevel.FULL_FUNCTIONALITY) {
            degradeTo(DegradationLevel.DATABASE_ONLY);
        }
    }

    private void degradeTo(DegradationLevel level) {
        DegradationLevel previous = currentLevel;
        currentLevel = level;

        log.warn("Quota system degraded from {} to {}", previous, level);

        // Publish degradation event for monitoring
        eventPublisher.publishEvent(new QuotaDegradationEvent(previous, level));
    }
}
```

---

## 6. Performance Architecture

### 6.1 Performance Targets and Monitoring

#### 6.1.1 Service Level Objectives (SLOs)

| Operation | Target | Measurement |
|-----------|---------|-------------|
| Quota Validation | <100ms (95th percentile) | Command processing time |
| Usage Session Start/End | <50ms (99th percentile) | MQTT event to DB commit |
| WebSocket Notifications | <1 second (99th percentile) | Event to message delivery |
| Cache Hit Ratio | >80% | Redis cache effectiveness |
| Database Query Time | <20ms (95th percentile) | Individual query execution |

#### 6.1.2 Performance Monitoring Integration

```java
@Component
public class QuotaPerformanceMonitor {

    private final MeterRegistry meterRegistry;

    public QuotaPerformanceMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;

        // Register custom metrics
        Gauge.builder("quota.cache.hit.ratio")
            .register(meterRegistry, this, QuotaPerformanceMonitor::getCacheHitRatio);
    }

    public void recordValidationTime(Duration duration) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("quota.validation.duration")
            .tag("operation", "validate_command")
            .register(meterRegistry));
    }

    public void recordCacheHit(boolean hit) {
        Counter.builder("quota.cache.access")
            .tag("result", hit ? "hit" : "miss")
            .register(meterRegistry)
            .increment();
    }
}
```

### 6.2 Asynchronous Processing Architecture

#### 6.2.1 Non-Blocking Usage Tracking

```java
/**
 * Usage tracking that doesn't block AC commands
 */
@Service
public class AsyncUsageTracker {

    private final Scheduler trackingScheduler = Schedulers.newBoundedElastic(10, 1000, "quota-tracking");

    public Mono<Void> trackUsageAsync(UsageEvent event) {
        return Mono.fromRunnable(() -> processUsageEvent(event))
            .subscribeOn(trackingScheduler)
            .onErrorResume(error -> {
                log.warn("Async usage tracking failed: {}", error.getMessage());
                return Mono.empty(); // Don't propagate errors
            })
            .then();
    }

    private void processUsageEvent(UsageEvent event) {
        // Database operations
        // Cache updates
        // WebSocket notifications
        // All executed asynchronously without blocking AC commands
    }
}
```

---

## 7. Integration Testing Strategy

### 7.1 Non-Breaking Integration Tests

#### 7.1.1 Regression Test Suite

```java
@SpringBootTest
@TestMethodOrder(OrderAnnotation.class)
class QuotaIntegrationRegressionTests {

    /**
     * Ensure all existing AC functionality works unchanged
     */
    @Test
    @Order(1)
    void existingACFunctionalityRemainsIntact() {
        // Test all existing AC commands without user context
        // Verify identical behavior to pre-quota system

        String roomId = "room_001";

        // Power commands
        StepVerifier.create(airConService.setPower(roomId, true))
            .verifyComplete();

        StepVerifier.create(airConService.setPower(roomId, false))
            .verifyComplete();

        // Temperature commands
        StepVerifier.create(airConService.setTemperature(roomId, 22.0))
            .verifyComplete();

        // Verify MQTT messages sent correctly
        verify(mqttService, times(3)).publishCommand(eq(roomId), anyString(), any());
    }

    /**
     * Test quota functionality doesn't interfere with non-quota users
     */
    @Test
    @Order(2)
    void quotaDisabledUsersUnaffected() {
        // Disable quota feature
        when(featureService.isQuotaEnabled()).thenReturn(false);

        // Verify identical behavior for all users
        testAllACCommands("room_001", null); // No user context
        testAllACCommands("room_001", "user_with_quota");
        testAllACCommands("room_001", "user_without_quota");
    }

    /**
     * Test quota enforcement for users with quotas
     */
    @Test
    @Order(3)
    void quotaEnforcementWorksCorrectly() {
        // Enable quota feature
        when(featureService.isQuotaEnabled()).thenReturn(true);

        String userId = "user_with_exceeded_quota";
        String roomId = "room_001";

        // Mock exceeded quota
        when(quotaValidationService.validateCommand(userId, roomId, "power", true))
            .thenReturn(Mono.just(QuotaValidationResult.denied("Quota exceeded")));

        // Verify command is blocked
        StepVerifier.create(airConService.setPower(roomId, true, userId))
            .expectError(QuotaExceededException.class)
            .verify();

        // Verify MQTT command was NOT sent
        verify(mqttService, never()).publishCommand(eq(roomId), eq("power"), eq(true));
    }

    /**
     * Test fail-safe behavior when quota services fail
     */
    @Test
    @Order(4)
    void failSafeBehaviorOnQuotaServiceFailure() {
        when(featureService.isQuotaEnabled()).thenReturn(true);

        String userId = "user_with_quota";
        String roomId = "room_001";

        // Mock quota service failure
        when(quotaValidationService.validateCommand(userId, roomId, "power", true))
            .thenReturn(Mono.error(new RuntimeException("Database connection failed")));

        // Verify command is allowed (fail-safe)
        StepVerifier.create(airConService.setPower(roomId, true, userId))
            .verifyComplete();

        // Verify MQTT command WAS sent despite quota service failure
        verify(mqttService).publishCommand(eq(roomId), eq("power"), eq(true));
    }
}
```

### 7.2 Performance Integration Tests

```java
@SpringBootTest
class QuotaPerformanceIntegrationTests {

    @Test
    void quotaValidationMeetsPerformanceTarget() {
        String userId = "performance_test_user";
        String roomId = "room_001";

        // Measure quota validation performance
        List<Long> validationTimes = new ArrayList<>();

        for (int i = 0; i < 100; i++) {
            long startTime = System.nanoTime();

            StepVerifier.create(
                quotaValidationService.validateCommand(userId, roomId, "power", true)
            ).expectNextMatches(result -> result.isAllowed())
             .verifyComplete();

            long endTime = System.nanoTime();
            validationTimes.add((endTime - startTime) / 1_000_000); // Convert to milliseconds
        }

        // Calculate 95th percentile
        Collections.sort(validationTimes);
        long p95 = validationTimes.get((int) (validationTimes.size() * 0.95));

        // Assert performance target met
        assertThat(p95).isLessThan(100); // <100ms target
    }
}
```

---

## 8. Security Integration Considerations

### 8.1 Authentication Integration

The quota system integrates with the existing JWT authentication without modification:

```java
/**
 * Quota operations respect existing security model
 */
@RestController
@RequestMapping("/api/quotas")
public class QuotaController {

    @PostMapping("/{quotaId}/override")
    @PreAuthorize("hasRole('PARENT')")  // Existing authorization
    public Mono<ResponseEntity<Override>> grantOverride(
            @PathVariable String quotaId,
            @Valid @RequestBody OverrideRequest request,
            Authentication authentication) {

        // Extract user from existing JWT token
        UserInfo userInfo = (UserInfo) authentication.getPrincipal();

        // Verify user has permission for this quota's household
        return quotaService.verifyHouseholdAccess(quotaId, userInfo.getHouseholdId())
            .then(quotaService.grantOverride(quotaId, request, userInfo))
            .map(ResponseEntity::ok);
    }
}
```

### 8.2 Data Access Security

All quota operations respect existing row-level security:

```java
/**
 * Repository operations maintain household isolation
 */
@Repository
public class QuotaRepository {

    @Query("""
        SELECT q.* FROM quotas q
        JOIN users u ON q.user_id = u.id
        WHERE u.household_id = :householdId
        AND q.id = :quotaId
    """)
    public Mono<Quota> findByIdAndHousehold(UUID quotaId, UUID householdId);
}
```

---

This technical design ensures that quota functionality integrates seamlessly with the existing system while maintaining all performance, security, and reliability characteristics. The fail-safe approach guarantees that AC control never fails due to quota system issues, while the comprehensive error handling and monitoring ensure operational visibility and quick recovery from any issues.