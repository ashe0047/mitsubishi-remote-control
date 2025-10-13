# Quota Management Feature Completion - Implementation Plan

## 1. Executive Summary

### 1.1 Implementation Approach
This implementation plan provides a **step-by-step completion strategy** for the quota management system, focusing on **safe integration** with the existing Turing backend. The plan prioritizes **zero-risk integration** by implementing changes incrementally with comprehensive testing and rollback capabilities at each step.

### 1.2 Safety-First Principles
- **Feature Flag Control**: All quota functionality can be disabled instantly
- **Backward Compatibility**: No changes to existing API contracts or behaviors
- **Fail-Safe Defaults**: System always allows AC control if quota services fail
- **Incremental Rollout**: Each phase can be independently tested and rolled back
- **Comprehensive Testing**: Integration tests before any production deployment

### 1.3 Implementation Timeline
- **Phase 1**: Core Integration (Week 1-2) - 2 weeks
- **Phase 2**: Testing & Validation (Week 3) - 1 week
- **Phase 3**: Production Rollout (Week 4) - 1 week
- **Total Duration**: 4 weeks with built-in safety margins

---

## 2. Pre-Implementation Analysis & Preparation

### 2.1 Current Backend Assessment

Before starting implementation, let's verify what's already functional:

**✅ CONFIRMED IMPLEMENTED:**
- Database schema (V001__Create_quota_tables.sql)
- Repository layer (QuotaRepository, UsageSessionRepository, etc.)
- Service layer structure (QuotaValidationService, ReactiveAirConService)
- Controller layer (QuotaController, AuthController, etc.)
- JWT authentication integration
- Redis caching infrastructure

**❓ NEEDS VERIFICATION:**
- QuotaValidationService implementation completeness
- ReactiveAirConService quota integration
- WebSocket quota message broadcasting
- Feature flag integration
- MQTT event handling for usage tracking

**📋 PREPARATION CHECKLIST:**
- [ ] Backup current database
- [ ] Create feature branch: `feature/quota-completion`
- [ ] Set up test environment with quota feature disabled
- [ ] Verify all existing integration tests pass
- [ ] Document current system behavior baselines

### 2.2 Development Environment Setup

```bash
# Create implementation branch
git checkout -b feature/quota-completion
git push -u origin feature/quota-completion

# Verify current tests pass
cd backend/turing
./mvnw test
cd ../../frontend
pnpm test

# Set up quota feature flag (disabled by default)
echo "quota.feature.enabled=false" >> backend/turing/src/main/resources/application.properties
```

---

## 3. Phase 1: Core Integration Implementation (Week 1-2)

### 3.1 Step 1: Complete QuotaValidationService (Day 1-2)

**Current State Assessment:**
First, examine and complete the existing QuotaValidationService implementation.

**Implementation Tasks:**

**Task 1.1: Complete Core Validation Logic**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/QuotaValidationService.java

@Service
@Slf4j
public class QuotaValidationService {

    // IMPLEMENTATION: Complete validateCommand method
    public Mono<QuotaValidationResult> validateCommand(String userId, String roomId,
                                                      String command, Object value) {

        // Feature flag check first
        if (!featureService.isQuotaEnabled()) {
            return Mono.just(QuotaValidationResult.allowed("Feature disabled"));
        }

        // Only validate power-on commands for MVP
        if (!"power".equals(command) || !Boolean.TRUE.equals(value)) {
            return Mono.just(QuotaValidationResult.allowed("Non-power-on command"));
        }

        // Circuit breaker check
        if (!circuitBreaker.shouldAllowValidation()) {
            return Mono.just(QuotaValidationResult.allowed("Circuit breaker open"));
        }

        return validateWithCache(userId, roomId)
            .timeout(VALIDATION_TIMEOUT)
            .doOnError(circuitBreaker::recordFailure)
            .doOnSuccess(result -> circuitBreaker.recordSuccess())
            .onErrorReturn(QuotaValidationResult.allowed("Validation failed - fail-safe mode"));
    }

    // IMPLEMENTATION: Cache-aware validation
    private Mono<QuotaValidationResult> validateWithCache(String userId, String roomId) {
        String cacheKey = QUOTA_BALANCE_KEY_PREFIX + userId + ":" + roomId;

        return redisTemplate.opsForValue().get(cacheKey)
            .cast(QuotaBalance.class)
            .switchIfEmpty(loadAndCacheQuotaBalance(userId, roomId))
            .map(this::validateAgainstQuotaBalance);
    }

    // IMPLEMENTATION: Database query with caching
    private Mono<QuotaBalance> loadAndCacheQuotaBalance(String userId, String roomId) {
        UUID userUuid = UUID.fromString(userId);
        LocalDate today = LocalDate.now();

        return quotaRepository.findActiveQuotaByUserAndRoom(userUuid, roomId, today)
            .flatMap(quota -> calculateCurrentUsageBalance(quota))
            .doOnNext(balance -> cacheQuotaBalance(userId, roomId, balance))
            .switchIfEmpty(Mono.just(QuotaBalance.noQuotaConfigured()));
    }

    // IMPLEMENTATION: Calculate current usage including active sessions
    private Mono<QuotaBalance> calculateCurrentUsageBalance(Quota quota) {
        LocalDate today = LocalDate.now();

        return usageSessionRepository.findTodayUsageForUserAndRoom(
                quota.getUserId(), quota.getTargetId(), today)
            .collectList()
            .map(sessions -> buildQuotaBalance(quota, sessions));
    }
}
```

**Task 1.2: Add Circuit Breaker Implementation**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/QuotaCircuitBreaker.java

@Component
@Slf4j
public class QuotaCircuitBreaker {
    // Implementation from technical design document
    // ... (complete implementation)
}
```

**Task 1.3: Unit Tests for QuotaValidationService**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/service/QuotaValidationServiceTest.java

@ExtendWith(MockitoExtension.class)
class QuotaValidationServiceTest {

    @Test
    void validateCommand_FeatureDisabled_ShouldAllow() {
        // Test feature flag bypass
    }

    @Test
    void validateCommand_NonPowerCommand_ShouldAllow() {
        // Test non-power commands bypass
    }

    @Test
    void validateCommand_ExceededQuota_ShouldDeny() {
        // Test quota enforcement
    }

    @Test
    void validateCommand_ServiceTimeout_ShouldFailSafe() {
        // Test timeout handling
    }

    @Test
    void validateCommand_DatabaseError_ShouldFailSafe() {
        // Test error handling
    }
}
```

**Verification Checklist:**
- [ ] All unit tests pass
- [ ] Service handles all error scenarios gracefully
- [ ] Performance meets <100ms target
- [ ] Circuit breaker functionality works
- [ ] Feature flag properly disables functionality

### 3.2 Step 2: Integrate Quota Validation into ReactiveAirConService (Day 3-4)

**Current State Assessment:**
Examine the existing ReactiveAirConService and safely add quota validation.

**Implementation Tasks:**

**Task 2.1: Add Quota Integration Points**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/ReactiveAirConService.java

@Slf4j
@Service
public class ReactiveAirConService {

    private final QuotaValidationService quotaValidationService;
    private final QuotaFeatureService quotaFeatureService;

    // MODIFICATION: Update existing setPower method to include userId parameter (optional)
    public Mono<Void> setPower(String roomId, boolean power) {
        // Existing behavior - no user context, no quota validation
        return executePowerCommandDirectly(roomId, power);
    }

    // NEW METHOD: Power control with user context and quota validation
    public Mono<Void> setPower(String roomId, boolean power, @Nullable String userId) {
        if (userId == null) {
            // No user context - use existing behavior
            return setPower(roomId, power);
        }

        return setPowerWithQuotaValidation(roomId, power, userId);
    }

    // NEW METHOD: Quota-aware power control
    private Mono<Void> setPowerWithQuotaValidation(String roomId, boolean power, String userId) {
        if (!quotaFeatureService.isQuotaEnabled()) {
            return executePowerCommandDirectly(roomId, power);
        }

        return quotaValidationService.validateCommand(userId, roomId, "power", power)
            .flatMap(result -> {
                if (result.isAllowed()) {
                    return executePowerCommandWithTracking(roomId, power, userId)
                        .then(publishQuotaUpdateIfNeeded(userId, roomId, result));
                } else {
                    return Mono.error(new QuotaExceededException(result.getReason(), result));
                }
            })
            .onErrorResume(QuotaServiceException.class, error -> {
                log.warn("Quota service failed for user {} room {}: {}, allowing command",
                    userId, roomId, error.getMessage());
                return executePowerCommandDirectly(roomId, power);
            });
    }

    // EXISTING METHOD: Preserve original behavior
    private Mono<Void> executePowerCommandDirectly(String roomId, boolean power) {
        return Mono.fromRunnable(() -> {
            mqttService.publishCommand(roomId, "power", power);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    // NEW METHOD: Power command with usage tracking
    private Mono<Void> executePowerCommandWithTracking(String roomId, boolean power, String userId) {
        return executePowerCommandDirectly(roomId, power)
            .then(trackUsageSessionChange(userId, roomId, power));
    }

    // NEW METHOD: Asynchronous usage tracking
    private Mono<Void> trackUsageSessionChange(String userId, String roomId, boolean power) {
        return Mono.fromRunnable(() -> {
            // Publish event for async processing
            eventPublisher.publishEvent(new UsageTrackingEvent(userId, roomId, power, Instant.now()));
        })
        .subscribeOn(Schedulers.boundedElastic())
        .onErrorResume(error -> {
            log.warn("Failed to publish usage tracking event: {}", error.getMessage());
            return Mono.empty(); // Don't fail the AC command
        })
        .then();
    }
}
```

**Task 2.2: Create Usage Tracking Event Handler**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/UsageTrackingEventHandler.java

@Service
@Slf4j
public class UsageTrackingEventHandler {

    @Async("quotaTaskExecutor")
    @EventListener
    public void handleUsageTrackingEvent(UsageTrackingEvent event) {
        try {
            if (event.isPowerOn()) {
                startUsageSession(event.getUserId(), event.getRoomId(), event.getTimestamp());
            } else {
                endUsageSession(event.getUserId(), event.getRoomId(), event.getTimestamp());
            }
        } catch (Exception e) {
            log.error("Failed to process usage tracking event: {}", e.getMessage());
        }
    }

    private void startUsageSession(String userId, String roomId, Instant timestamp) {
        // Implementation for starting usage session
    }

    private void endUsageSession(String userId, String roomId, Instant timestamp) {
        // Implementation for ending usage session
    }
}
```

**Task 2.3: Integration Tests for ReactiveAirConService**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/service/ReactiveAirConServiceIntegrationTest.java

@SpringBootTest
@TestMethodOrder(OrderAnnotation.class)
class ReactiveAirConServiceIntegrationTest {

    @Test
    @Order(1)
    void setPower_NoUserContext_ShouldWorkAsOriginal() {
        // Test backward compatibility
        StepVerifier.create(airConService.setPower("room_001", true))
            .verifyComplete();

        verify(mqttService).publishCommand("room_001", "power", true);
    }

    @Test
    @Order(2)
    void setPower_WithUserAndQuotaDisabled_ShouldWorkNormally() {
        when(quotaFeatureService.isQuotaEnabled()).thenReturn(false);

        StepVerifier.create(airConService.setPower("room_001", true, "user_001"))
            .verifyComplete();

        verify(mqttService).publishCommand("room_001", "power", true);
        verifyNoInteractions(quotaValidationService);
    }

    @Test
    @Order(3)
    void setPower_WithQuotaExceeded_ShouldBlockCommand() {
        when(quotaFeatureService.isQuotaEnabled()).thenReturn(true);
        when(quotaValidationService.validateCommand("user_001", "room_001", "power", true))
            .thenReturn(Mono.just(QuotaValidationResult.denied("Quota exceeded")));

        StepVerifier.create(airConService.setPower("room_001", true, "user_001"))
            .expectError(QuotaExceededException.class)
            .verify();

        verify(mqttService, never()).publishCommand(anyString(), anyString(), any());
    }

    @Test
    @Order(4)
    void setPower_WithQuotaServiceError_ShouldFailSafe() {
        when(quotaFeatureService.isQuotaEnabled()).thenReturn(true);
        when(quotaValidationService.validateCommand("user_001", "room_001", "power", true))
            .thenReturn(Mono.error(new RuntimeException("Service error")));

        StepVerifier.create(airConService.setPower("room_001", true, "user_001"))
            .verifyComplete();

        verify(mqttService).publishCommand("room_001", "power", true);
    }
}
```

**Verification Checklist:**
- [ ] Existing AC functionality unchanged
- [ ] Quota validation properly integrated
- [ ] Error handling works correctly
- [ ] Usage tracking events are published
- [ ] All integration tests pass

### 3.3 Step 3: Complete Usage Session Tracking (Day 5-6)

**Implementation Tasks:**

**Task 3.1: Complete Usage Session Repository Methods**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/repository/UsageSessionRepository.java

@Repository
public interface UsageSessionRepository extends ReactiveCrudRepository<UsageSession, UUID> {

    @Query("""
        SELECT * FROM usage_sessions
        WHERE user_id = :userId AND room_id = :roomId
        AND status = 'ACTIVE'
        ORDER BY started_at DESC
        LIMIT 1
    """)
    Mono<UsageSession> findActiveSessionByUserAndRoom(UUID userId, String roomId);

    @Query("""
        SELECT * FROM usage_sessions
        WHERE user_id = :userId AND room_id = :roomId
        AND DATE(started_at) = :date
        ORDER BY started_at ASC
    """)
    Flux<UsageSession> findTodayUsageForUserAndRoom(UUID userId, String roomId, LocalDate date);

    @Query("""
        UPDATE usage_sessions
        SET ended_at = :endTime, status = 'COMPLETED',
            duration_minutes = EXTRACT(EPOCH FROM (:endTime - started_at)) / 60
        WHERE user_id = :userId AND room_id = :roomId AND status = 'ACTIVE'
    """)
    Mono<Integer> endActiveSessionsForUserAndRoom(UUID userId, String roomId, Instant endTime);
}
```

**Task 3.2: Complete Usage Session Service**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/UsageSessionService.java

@Service
@Slf4j
@Transactional
public class UsageSessionService {

    private final UsageSessionRepository sessionRepository;
    private final ApplicationEventPublisher eventPublisher;

    public Mono<UsageSession> startSession(String userId, String roomId, Instant timestamp) {
        UUID userUuid = UUID.fromString(userId);

        return sessionRepository.findActiveSessionByUserAndRoom(userUuid, roomId)
            .flatMap(existingSession -> {
                log.info("Ending existing active session before starting new one");
                return endSession(existingSession, timestamp);
            })
            .then(createNewSession(userId, roomId, timestamp))
            .doOnSuccess(session -> {
                log.info("Started usage session {} for user {} in room {}",
                    session.getId(), userId, roomId);

                eventPublisher.publishEvent(new SessionStartedEvent(session));
            });
    }

    public Mono<UsageSession> endSession(String userId, String roomId, Instant timestamp) {
        UUID userUuid = UUID.fromString(userId);

        return sessionRepository.findActiveSessionByUserAndRoom(userUuid, roomId)
            .flatMap(session -> endSession(session, timestamp))
            .doOnSuccess(session -> {
                if (session != null) {
                    log.info("Ended usage session {} for user {} in room {} (duration: {} minutes)",
                        session.getId(), userId, roomId, session.getDurationMinutes());

                    eventPublisher.publishEvent(new SessionEndedEvent(session));
                }
            });
    }

    private Mono<UsageSession> createNewSession(String userId, String roomId, Instant timestamp) {
        UsageSession session = UsageSession.builder()
            .id(UUID.randomUUID())
            .userId(UUID.fromString(userId))
            .roomId(roomId)
            .deviceType("ac")
            .startedAt(timestamp)
            .status(SessionStatus.ACTIVE)
            .build();

        return sessionRepository.save(session);
    }

    private Mono<UsageSession> endSession(UsageSession session, Instant endTime) {
        session.setEndedAt(endTime);
        session.setStatus(SessionStatus.COMPLETED);

        // Calculate duration
        long durationMinutes = Duration.between(session.getStartedAt(), endTime).toMinutes();
        session.setDurationMinutes((int) durationMinutes);

        return sessionRepository.save(session);
    }
}
```

**Task 3.3: Integration with Event Handler**
```java
// Update UsageTrackingEventHandler to use UsageSessionService
@Service
@Slf4j
public class UsageTrackingEventHandler {

    private final UsageSessionService sessionService;

    @Async("quotaTaskExecutor")
    @EventListener
    public void handleUsageTrackingEvent(UsageTrackingEvent event) {
        try {
            if (event.isPowerOn()) {
                sessionService.startSession(event.getUserId(), event.getRoomId(), event.getTimestamp())
                    .subscribe(
                        session -> log.debug("Session started: {}", session.getId()),
                        error -> log.error("Failed to start session: {}", error.getMessage())
                    );
            } else {
                sessionService.endSession(event.getUserId(), event.getRoomId(), event.getTimestamp())
                    .subscribe(
                        session -> log.debug("Session ended: {}", session != null ? session.getId() : "none"),
                        error -> log.error("Failed to end session: {}", error.getMessage())
                    );
            }
        } catch (Exception e) {
            log.error("Exception in usage tracking: {}", e.getMessage());
        }
    }
}
```

**Verification Checklist:**
- [ ] Sessions start correctly on power-on
- [ ] Sessions end correctly on power-off
- [ ] Duration calculations are accurate
- [ ] Database transactions work correctly
- [ ] Events are published properly

### 3.4 Step 4: WebSocket Integration for Real-time Updates (Day 7-8)

**Implementation Tasks:**

**Task 4.1: Create Quota WebSocket Message Types**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/dto/QuotaWebSocketMessage.java

@Data
@Builder
public class QuotaWebSocketMessage {
    private String type; // "QUOTA_UPDATE", "QUOTA_VIOLATION", "OVERRIDE_GRANTED"
    private String messageId;
    private QuotaWebSocketPayload payload;
    private Instant timestamp;

    @Data
    @Builder
    public static class QuotaWebSocketPayload {
        private String quotaId;
        private String familyMemberId;
        private String roomId;
        private BigDecimal currentUsage;
        private BigDecimal dailyLimit;
        private String status;
        private Boolean isCurrentlyActive;
        private BigDecimal estimatedSessionUsage;
        private String lastUpdated;
    }
}
```

**Task 4.2: Enhance WebSocket Handler**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/websocket/ReactiveWebSocketHandler.java

@Component
@Slf4j
public class ReactiveWebSocketHandler implements WebSocketHandler {

    private final Map<String, Set<WebSocketSession>> householdSessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    // ADD: Method to broadcast quota messages to household
    public void broadcastQuotaMessage(String householdId, QuotaWebSocketMessage message) {
        try {
            String messageJson = objectMapper.writeValueAsString(message);
            broadcastToHousehold(householdId, messageJson);
        } catch (Exception e) {
            log.error("Failed to broadcast quota message: {}", e.getMessage());
        }
    }

    private void broadcastToHousehold(String householdId, String message) {
        Set<WebSocketSession> sessions = householdSessions.get(householdId);
        if (sessions != null && !sessions.isEmpty()) {
            sessions.removeIf(session -> !session.isOpen());

            sessions.forEach(session -> {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    log.warn("Failed to send message to WebSocket session: {}", e.getMessage());
                }
            });
        }
    }

    // MODIFY: Enhanced connection handling to track household membership
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String householdId = extractHouseholdIdFromSession(session);
        if (householdId != null) {
            householdSessions.computeIfAbsent(householdId, k -> ConcurrentHashMap.newKeySet())
                .add(session);
            log.info("WebSocket connected for household: {}", householdId);
        }
    }

    private String extractHouseholdIdFromSession(WebSocketSession session) {
        // Extract from JWT token in session attributes or query parameters
        // Implementation depends on how authentication is handled in WebSocket
        return session.getAttributes().get("householdId").toString();
    }
}
```

**Task 4.3: Create Quota Notification Service**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/QuotaNotificationService.java

@Service
@Slf4j
public class QuotaNotificationService {

    private final ReactiveWebSocketHandler webSocketHandler;
    private final UserRepository userRepository;

    @EventListener
    public void handleSessionStarted(SessionStartedEvent event) {
        UsageSession session = event.getSession();

        // Get user's household for broadcasting
        userRepository.findById(session.getUserId())
            .doOnNext(user -> {
                QuotaWebSocketMessage message = QuotaWebSocketMessage.builder()
                    .type("USAGE_SESSION_STARTED")
                    .messageId(UUID.randomUUID().toString())
                    .timestamp(Instant.now())
                    .payload(QuotaWebSocketMessage.QuotaWebSocketPayload.builder()
                        .familyMemberId(session.getUserId().toString())
                        .roomId(session.getRoomId())
                        .isCurrentlyActive(true)
                        .lastUpdated(session.getStartedAt().toString())
                        .build())
                    .build();

                webSocketHandler.broadcastQuotaMessage(
                    user.getHouseholdId().toString(),
                    message
                );
            })
            .subscribe();
    }

    @EventListener
    public void handleSessionEnded(SessionEndedEvent event) {
        UsageSession session = event.getSession();

        userRepository.findById(session.getUserId())
            .doOnNext(user -> {
                QuotaWebSocketMessage message = QuotaWebSocketMessage.builder()
                    .type("USAGE_SESSION_ENDED")
                    .messageId(UUID.randomUUID().toString())
                    .timestamp(Instant.now())
                    .payload(QuotaWebSocketMessage.QuotaWebSocketPayload.builder()
                        .familyMemberId(session.getUserId().toString())
                        .roomId(session.getRoomId())
                        .isCurrentlyActive(false)
                        .currentUsage(BigDecimal.valueOf(session.getDurationMinutes()))
                        .lastUpdated(session.getEndedAt().toString())
                        .build())
                    .build();

                webSocketHandler.broadcastQuotaMessage(
                    user.getHouseholdId().toString(),
                    message
                );
            })
            .subscribe();
    }
}
```

**Verification Checklist:**
- [ ] WebSocket messages are properly formatted
- [ ] Messages reach all household members
- [ ] Session start/end events trigger notifications
- [ ] JSON serialization works correctly
- [ ] Connection management handles failures gracefully

### 3.5 Step 5: Feature Flag Integration (Day 9)

**Implementation Tasks:**

**Task 5.1: Complete QuotaFeatureService**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/service/QuotaFeatureService.java

@Service
@Slf4j
public class QuotaFeatureService {

    @Value("${quota.feature.enabled:false}")
    private boolean quotaFeatureEnabled;

    @Value("${quota.feature.rollout.percentage:0}")
    private int rolloutPercentage;

    public boolean isQuotaEnabled() {
        return quotaFeatureEnabled;
    }

    public boolean isQuotaEnabledForHousehold(String householdId) {
        if (!quotaFeatureEnabled) {
            return false;
        }

        // Percentage-based rollout
        if (rolloutPercentage < 100) {
            int hash = Math.abs(householdId.hashCode());
            int bucket = hash % 100;
            return bucket < rolloutPercentage;
        }

        return true;
    }

    public void enableQuotaFeature() {
        quotaFeatureEnabled = true;
        log.info("Quota feature enabled globally");
    }

    public void disableQuotaFeature() {
        quotaFeatureEnabled = false;
        log.info("Quota feature disabled globally");
    }
}
```

**Task 5.2: Add Feature Toggle Endpoints**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/controller/AdminController.java

@RestController
@RequestMapping("/admin/quota")
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminController {

    private final QuotaFeatureService featureService;

    @PostMapping("/enable")
    public ResponseEntity<String> enableQuotaFeature() {
        featureService.enableQuotaFeature();
        return ResponseEntity.ok("Quota feature enabled");
    }

    @PostMapping("/disable")
    public ResponseEntity<String> disableQuotaFeature() {
        featureService.disableQuotaFeature();
        return ResponseEntity.ok("Quota feature disabled");
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getQuotaFeatureStatus() {
        Map<String, Object> status = Map.of(
            "enabled", featureService.isQuotaEnabled(),
            "timestamp", Instant.now()
        );
        return ResponseEntity.ok(status);
    }
}
```

**Verification Checklist:**
- [ ] Feature can be enabled/disabled via API
- [ ] Feature flag is respected throughout the system
- [ ] Rollout percentage works correctly
- [ ] Admin endpoints are secured

### 3.6 Step 6: Configuration and Error Handling (Day 10)

**Implementation Tasks:**

**Task 6.1: Application Configuration**
```properties
# File: backend/turing/src/main/resources/application.properties

# Quota Feature Configuration
quota.feature.enabled=false
quota.feature.rollout.percentage=0

# Performance Configuration
quota.validation.timeout.ms=100
quota.cache.ttl.hours=1
quota.circuit.breaker.threshold=5
quota.circuit.breaker.recovery.minutes=2

# Async Processing Configuration
quota.tracking.thread.pool.size=5
quota.tracking.queue.capacity=1000
```

**Task 6.2: Error Handling Configuration**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/config/QuotaErrorHandlingConfig.java

@Configuration
@EnableConfigurationProperties(QuotaProperties.class)
public class QuotaErrorHandlingConfig {

    @Bean
    @Primary
    public ReactiveRedisTemplate<String, Object> quotaRedisTemplate(LettuceConnectionFactory connectionFactory) {
        ReactiveRedisTemplate<String, Object> template = new ReactiveRedisTemplate<>(connectionFactory, RedisSerializationContext.java());

        // Add connection error handling
        template.getConnectionFactory().getConnection()
            .doOnError(error -> log.warn("Redis connection error: {}", error.getMessage()))
            .retry(3)
            .subscribe();

        return template;
    }

    @Bean("quotaTaskExecutor")
    public TaskExecutor quotaTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("quota-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

**Task 6.3: Monitoring and Health Checks**
```java
// File: backend/turing/src/main/java/com/ashelabs/turing/health/QuotaHealthIndicator.java

@Component
public class QuotaHealthIndicator implements ReactiveHealthIndicator {

    private final QuotaValidationService quotaService;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;

    @Override
    public Mono<Health> doHealthCheck(Health.Builder builder) {
        return checkQuotaServices()
            .map(healthy -> healthy ? builder.up() : builder.down())
            .map(Health.Builder::build)
            .onErrorReturn(builder.down().build());
    }

    private Mono<Boolean> checkQuotaServices() {
        return checkRedisConnection()
            .zipWith(checkDatabaseConnection())
            .map(tuple -> tuple.getT1() && tuple.getT2());
    }

    private Mono<Boolean> checkRedisConnection() {
        return redisTemplate.hasKey("health:check")
            .map(result -> true)
            .onErrorReturn(false);
    }

    private Mono<Boolean> checkDatabaseConnection() {
        // Simple database connectivity check
        return quotaService.healthCheck()
            .onErrorReturn(false);
    }
}
```

**Verification Checklist:**
- [ ] Configuration properties are loaded correctly
- [ ] Error handling works for all failure scenarios
- [ ] Health checks provide accurate status
- [ ] Monitoring metrics are collected
- [ ] Async processing is configured properly

---

## 4. Phase 2: Testing & Validation (Week 3)

### 4.1 Integration Test Suite (Day 11-12)

**Task 4.1.1: End-to-End Integration Tests**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/integration/QuotaSystemIntegrationTest.java

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "quota.feature.enabled=true",
    "spring.redis.embedded=true"
})
class QuotaSystemIntegrationTest {

    @Test
    @Transactional
    void completeQuotaWorkflow_ShouldWorkEndToEnd() {
        // 1. Create user with quota
        User testUser = createTestUser();
        Quota testQuota = createTestQuota(testUser, "room_001", 240); // 4 hours

        // 2. Start AC (should succeed)
        StepVerifier.create(
            airConService.setPower("room_001", true, testUser.getId().toString())
        ).verifyComplete();

        // 3. Verify session started
        StepVerifier.create(
            sessionRepository.findActiveSessionByUserAndRoom(testUser.getId(), "room_001")
        ).expectNextMatches(session -> session.getStatus() == SessionStatus.ACTIVE)
         .verifyComplete();

        // 4. Simulate time passage (3.5 hours)
        simulateTimePassage(testUser.getId(), "room_001", 210); // 3.5 hours in minutes

        // 5. Start AC again (should trigger warning)
        StepVerifier.create(
            airConService.setPower("room_001", true, testUser.getId().toString())
        ).verifyComplete();

        // 6. Simulate time passage to exceed quota
        simulateTimePassage(testUser.getId(), "room_001", 60); // 1 more hour

        // 7. Try to start AC (should be blocked)
        StepVerifier.create(
            airConService.setPower("room_001", true, testUser.getId().toString())
        ).expectError(QuotaExceededException.class)
         .verify();

        // 8. Grant parent override
        StepVerifier.create(
            quotaService.grantOverride(testQuota.getId().toString(), createOverrideRequest())
        ).verifyComplete();

        // 9. Start AC after override (should succeed)
        StepVerifier.create(
            airConService.setPower("room_001", true, testUser.getId().toString())
        ).verifyComplete();
    }

    @Test
    void quotaServiceFailure_ShouldFailSafe() {
        // Simulate database failure
        when(quotaRepository.findActiveQuotaByUserAndRoom(any(), any(), any()))
            .thenReturn(Mono.error(new DataAccessException("Database down") {}));

        // AC command should still work (fail-safe)
        StepVerifier.create(
            airConService.setPower("room_001", true, "user_001")
        ).verifyComplete();

        verify(mqttService).publishCommand("room_001", "power", true);
    }

    @Test
    void redisFailure_ShouldFallbackToDatabase() {
        // Test cache failure fallback
    }

    @Test
    void concurrentUsage_ShouldMaintainConsistency() {
        // Test concurrent AC commands
    }
}
```

**Task 4.1.2: Performance Integration Tests**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/performance/QuotaPerformanceTest.java

@SpringBootTest
class QuotaPerformanceTest {

    @Test
    void quotaValidation_ShouldMeetPerformanceTarget() {
        List<Long> responseTimes = new ArrayList<>();
        String userId = "perf_test_user";
        String roomId = "room_001";

        // Warm up
        for (int i = 0; i < 10; i++) {
            quotaValidationService.validateCommand(userId, roomId, "power", true).block();
        }

        // Measure performance
        for (int i = 0; i < 100; i++) {
            long startTime = System.nanoTime();
            quotaValidationService.validateCommand(userId, roomId, "power", true).block();
            long endTime = System.nanoTime();

            responseTimes.add((endTime - startTime) / 1_000_000); // Convert to milliseconds
        }

        // Calculate statistics
        responseTimes.sort(null);
        long p50 = responseTimes.get(50);
        long p95 = responseTimes.get(95);
        long p99 = responseTimes.get(99);

        // Verify performance targets
        assertThat(p95).isLessThan(100); // 95th percentile < 100ms
        assertThat(p50).isLessThan(50);  // 50th percentile < 50ms

        log.info("Performance results - P50: {}ms, P95: {}ms, P99: {}ms", p50, p95, p99);
    }
}
```

### 4.2 Safety and Regression Testing (Day 13-14)

**Task 4.2.1: Regression Test Suite**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/regression/QuotaRegressionTest.java

@SpringBootTest
@TestMethodOrder(OrderAnnotation.class)
class QuotaRegressionTest {

    @Test
    @Order(1)
    void existingAPICompatibility_ShouldBePreserved() {
        // Test all existing API endpoints work unchanged
        testOriginalAirConEndpoints();
        testOriginalWebSocketEndpoints();
        testOriginalAuthEndpoints();
    }

    @Test
    @Order(2)
    void existingMQTTFlow_ShouldBeUnchanged() {
        // Test MQTT publishing still works
        airConService.setPower("room_001", true).block();
        verify(mqttService).publishCommand("room_001", "power", true);
    }

    @Test
    @Order(3)
    void featureDisabled_ShouldHaveZeroImpact() {
        // Disable quota feature
        System.setProperty("quota.feature.enabled", "false");

        // Test identical behavior to pre-quota system
        testCompleteACWorkflowWithoutQuotas();
    }

    @Test
    @Order(4)
    void errorScenarios_ShouldNotBreakExistingFunctionality() {
        // Test various failure modes don't impact AC control
        testDatabaseFailureImpact();
        testRedisFailureImpact();
        testNetworkTimeoutImpact();
    }
}
```

**Task 4.2.2: Load Testing**
```java
// File: backend/turing/src/test/java/com/ashelabs/turing/load/QuotaLoadTest.java

@SpringBootTest
class QuotaLoadTest {

    @Test
    void highLoadACCommands_ShouldMaintainPerformance() {
        int numberOfThreads = 50;
        int commandsPerThread = 20;
        CountDownLatch latch = new CountDownLatch(numberOfThreads);
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());

        ExecutorService executor = Executors.newFixedThreadPool(numberOfThreads);

        for (int i = 0; i < numberOfThreads; i++) {
            final String userId = "load_test_user_" + i;

            executor.submit(() -> {
                try {
                    for (int j = 0; j < commandsPerThread; j++) {
                        long startTime = System.currentTimeMillis();

                        airConService.setPower("room_001", true, userId).block();

                        long endTime = System.currentTimeMillis();
                        responseTimes.add(endTime - startTime);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        // Wait for completion with timeout
        assertThat(latch.await(60, TimeUnit.SECONDS)).isTrue();

        // Verify performance under load
        long averageResponseTime = responseTimes.stream()
            .mapToLong(Long::longValue)
            .summaryStatistics()
            .getAverage();

        assertThat(averageResponseTime).isLessThan(200); // Still reasonable under load

        log.info("Load test completed: {} commands, average response time: {}ms",
            responseTimes.size(), averageResponseTime);
    }
}
```

### 4.3 Manual Testing Procedures (Day 15)

**Task 4.3.1: Create Manual Test Scripts**

Create comprehensive manual testing procedures:

```bash
#!/bin/bash
# File: scripts/manual-quota-testing.sh

echo "=== Quota System Manual Testing ==="

echo "1. Testing feature flag disable safety..."
curl -X POST http://localhost:8080/admin/quota/disable
echo "AC should work normally..."
curl -X POST http://localhost:8080/api/rooms/room_001/power -d '{"power": true}'

echo "2. Testing feature flag enable..."
curl -X POST http://localhost:8080/admin/quota/enable
echo "Quota validation should now be active..."

echo "3. Testing quota enforcement..."
# Create test quota
curl -X POST http://localhost:8080/api/quotas -d '{
    "userId": "test_user_001",
    "roomId": "room_001",
    "allowedAmount": 120,
    "quotaType": "TIME_BASED"
}'

echo "4. Testing WebSocket notifications..."
# Connect WebSocket client and monitor for quota messages

echo "5. Testing parent override..."
curl -X POST http://localhost:8080/api/quotas/quota_001/override -d '{
    "duration": 60,
    "reason": "Emergency override"
}'

echo "=== Manual testing complete ==="
```

**Task 4.3.2: Frontend Integration Testing**

Test frontend integration with the completed backend:

```javascript
// File: frontend/tests/integration/quota-backend-integration.test.js

describe('Quota Backend Integration', () => {
    test('WebSocket quota messages are received correctly', async () => {
        // Connect to WebSocket
        // Send AC command via API
        // Verify quota update message received
    });

    test('Quota exceeded error is handled properly', async () => {
        // Set up exceeded quota scenario
        // Attempt AC command
        // Verify error handling and UI update
    });

    test('Parent override works end-to-end', async () => {
        // Request override as child
        // Approve override as parent
        // Verify AC control is restored
    });
});
```

**Verification Checklist:**
- [ ] All automated tests pass
- [ ] Manual testing procedures complete successfully
- [ ] Performance benchmarks met under load
- [ ] Regression tests confirm no breaking changes
- [ ] Frontend integration working properly

---

## 5. Phase 3: Production Rollout (Week 4)

### 5.1 Production Deployment Preparation (Day 16-17)

**Task 5.1.1: Production Configuration**

```properties
# File: backend/turing/src/main/resources/application-prod.properties

# Production Quota Configuration
quota.feature.enabled=false  # Start disabled
quota.feature.rollout.percentage=0

# Production Performance Settings
quota.validation.timeout.ms=100
quota.cache.ttl.hours=4
quota.circuit.breaker.threshold=10
quota.circuit.breaker.recovery.minutes=5

# Production Database Settings
spring.r2dbc.pool.initial-size=10
spring.r2dbc.pool.max-size=50
spring.r2dbc.pool.max-idle-time=30m

# Production Redis Settings
spring.redis.timeout=100ms
spring.redis.lettuce.pool.max-active=20
spring.redis.lettuce.pool.max-idle=10

# Monitoring and Logging
management.endpoints.web.exposure.include=health,metrics,prometheus
management.endpoint.health.show-details=always
logging.level.com.ashelabs.turing.service.QuotaValidationService=INFO
logging.level.com.ashelabs.turing.service.ReactiveAirConService=INFO
```

**Task 5.1.2: Database Migration Verification**

```bash
#!/bin/bash
# File: scripts/production-migration-check.sh

echo "=== Production Database Migration Check ==="

# Check if migration has run
psql -c "SELECT version, description, success FROM flyway_schema_history WHERE version = '001';"

# Verify tables exist
psql -c "\dt" | grep -E "(quotas|usage_sessions|quota_violations)"

# Check indexes
psql -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('quotas', 'usage_sessions');"

# Verify materialized view
psql -c "SELECT count(*) FROM daily_usage_summaries;"

echo "=== Migration check complete ==="
```

**Task 5.1.3: Production Health Checks**

```java
// File: backend/turing/src/main/java/com/ashelabs/turing/health/ProductionReadinessProbe.java

@Component
public class ProductionReadinessProbe implements HealthIndicator {

    @Override
    public Health health() {
        Health.Builder builder = Health.up();

        // Check quota feature flag state
        builder.withDetail("quota.feature.enabled", quotaFeatureService.isQuotaEnabled());

        // Check database connectivity
        try {
            quotaRepository.count().block(Duration.ofSeconds(5));
            builder.withDetail("database.connectivity", "OK");
        } catch (Exception e) {
            builder.withDetail("database.connectivity", "FAILED: " + e.getMessage());
        }

        // Check Redis connectivity
        try {
            redisTemplate.hasKey("health.check").block(Duration.ofSeconds(5));
            builder.withDetail("redis.connectivity", "OK");
        } catch (Exception e) {
            builder.withDetail("redis.connectivity", "FAILED: " + e.getMessage());
        }

        return builder.build();
    }
}
```

### 5.2 Staged Rollout Plan (Day 18-19)

**Stage 1: Deployment with Feature Disabled (Day 18)**
```bash
# Deploy code with feature flag OFF
kubectl set env deployment/turing-backend QUOTA_FEATURE_ENABLED=false

# Verify deployment
kubectl rollout status deployment/turing-backend

# Run smoke tests
curl http://api.domain.com/health | grep quota
```

**Stage 2: Internal Testing (Day 19 Morning)**
```bash
# Enable for internal test household only
curl -X POST http://api.domain.com/admin/quota/enable
curl -X PUT http://api.domain.com/admin/quota/household/internal-test-001/enable

# Monitor metrics
kubectl logs -f deployment/turing-backend | grep -i quota
```

**Stage 3: Limited Rollout (Day 19 Afternoon)**
```bash
# Enable for 10% of households
curl -X PUT http://api.domain.com/admin/quota/rollout-percentage -d '{"percentage": 10}'

# Monitor error rates and performance
curl http://api.domain.com/metrics | grep quota_validation_duration
```

### 5.3 Monitoring and Rollback Procedures (Day 20-21)

**Task 5.3.1: Production Monitoring**

```yaml
# File: monitoring/quota-alerts.yml
groups:
  - name: quota_system
    rules:
      - alert: QuotaValidationLatencyHigh
        expr: quota_validation_duration_seconds{quantile="0.95"} > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Quota validation latency too high"

      - alert: QuotaServiceErrorRateHigh
        expr: rate(quota_validation_errors_total[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Quota service error rate above threshold"

      - alert: ACCommandFailures
        expr: rate(aircon_command_failures_total[5m]) > 0.001
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "AC command failures detected - possible quota system issue"
```

**Task 5.3.2: Automated Rollback Script**

```bash
#!/bin/bash
# File: scripts/emergency-quota-rollback.sh

echo "=== EMERGENCY QUOTA ROLLBACK ==="

# Disable quota feature immediately
curl -X POST http://api.domain.com/admin/quota/disable

# Verify AC functionality
TEST_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://api.domain.com/api/rooms/test/power)
if [ $TEST_RESULT -eq 200 ]; then
    echo "AC functionality verified - rollback successful"
else
    echo "ERROR: AC functionality still impaired - manual intervention required"
    exit 1
fi

# Roll back deployment if necessary
read -p "Roll back to previous deployment? (y/n): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl rollout undo deployment/turing-backend
    kubectl rollout status deployment/turing-backend
fi

echo "=== Rollback complete ==="
```

**Task 5.3.3: Success Metrics Dashboard**

Create monitoring dashboard tracking:
- Quota validation response times
- AC command success rates
- WebSocket message delivery rates
- Database query performance
- Redis cache hit ratios
- Error rates and types
- Feature flag status

### 5.4 Full Production Enablement (Day 22)

**Task 5.4.1: Gradual Rollout Schedule**

```bash
# Week 4 - Gradual rollout schedule
# Day 22: 25% rollout
curl -X PUT http://api.domain.com/admin/quota/rollout-percentage -d '{"percentage": 25}'

# Day 23: 50% rollout (if metrics good)
curl -X PUT http://api.domain.com/admin/quota/rollout-percentage -d '{"percentage": 50}'

# Day 24: 75% rollout (if metrics good)
curl -X PUT http://api.domain.com/admin/quota/rollout-percentage -d '{"percentage": 75}'

# Day 25: 100% rollout (if metrics good)
curl -X PUT http://api.domain.com/admin/quota/rollout-percentage -d '{"percentage": 100}'
```

**Task 5.4.2: Post-Deployment Validation**

```java
// File: backend/turing/src/test/java/com/ashelabs/turing/production/ProductionValidationTest.java

@SpringBootTest
@ActiveProfiles("prod-test")
class ProductionValidationTest {

    @Test
    void productionQuotaWorkflow_ShouldWorkEndToEnd() {
        // Test complete quota workflow in production environment
        // Verify all integrations work correctly
        // Check performance metrics
        // Validate error handling
    }

    @Test
    void productionFailover_ShouldMaintainACFunctionality() {
        // Test production failover scenarios
        // Verify AC continues working during quota service issues
    }
}
```

**Final Verification Checklist:**
- [ ] All production health checks pass
- [ ] Performance metrics within targets
- [ ] Error rates below thresholds
- [ ] AC functionality 100% preserved
- [ ] WebSocket notifications working
- [ ] Quota enforcement working correctly
- [ ] Parent overrides functioning
- [ ] Monitoring and alerts active
- [ ] Rollback procedures tested and ready

---

## 6. Risk Mitigation & Safety Measures

### 6.1 Technical Safeguards

**Circuit Breaker Protection:**
- Automatic quota service disable on consecutive failures
- Configurable failure thresholds and recovery timeouts
- Immediate fallback to pre-quota behavior

**Feature Flag Safety:**
- Instant disable capability via API
- Percentage-based rollout control
- Per-household granular control
- Emergency rollback procedures

**Error Boundary Isolation:**
- Quota errors never propagate to AC control
- Comprehensive exception handling
- Graceful degradation modes
- Service health monitoring

### 6.2 Operational Safeguards

**Monitoring & Alerting:**
- Real-time performance metrics
- Error rate monitoring
- AC command success tracking
- Automated alert thresholds

**Rollback Procedures:**
- One-click feature disable
- Automated deployment rollback
- Database rollback scripts
- Configuration rollback procedures

**Testing Requirements:**
- Full regression test suite
- Performance benchmarking
- Load testing validation
- Manual testing verification

### 6.3 Business Continuity

**Zero Downtime Deployment:**
- Rolling deployment strategy
- Health check validation
- Gradual traffic migration
- Instant rollback capability

**User Impact Minimization:**
- Fail-safe defaults always allow AC control
- Clear error messaging
- Graceful service degradation
- Transparent fallback behavior

---

## 7. Success Criteria & Acceptance Tests

### 7.1 Functional Success Criteria

**✅ Core Functionality:**
- [ ] Quotas are enforced correctly when configured
- [ ] Usage tracking is accurate to the minute
- [ ] WebSocket notifications are delivered in real-time
- [ ] Parent overrides work immediately
- [ ] Daily quota resets function automatically

**✅ Integration Success:**
- [ ] Zero regression in existing AC functionality
- [ ] MQTT integration preserves all existing behaviors
- [ ] WebSocket API maintains backward compatibility
- [ ] Authentication flow unchanged
- [ ] Database performance within acceptable ranges

**✅ Safety Success:**
- [ ] System fails safely when quota services are down
- [ ] Feature flag instantly disables quota functionality
- [ ] Error scenarios don't break AC control
- [ ] Performance targets met under load
- [ ] Recovery procedures work correctly

### 7.2 Performance Success Criteria

- **Quota Validation**: <100ms (95th percentile)
- **AC Command Processing**: No degradation from baseline
- **WebSocket Notifications**: <1 second delivery
- **Database Queries**: <50ms average
- **Cache Hit Ratio**: >80%

### 7.3 Business Success Criteria

- **Zero AC Control Failures**: Due to quota system issues
- **User Satisfaction**: No complaints about AC reliability
- **Parent Adoption**: Successful quota configuration and usage
- **System Reliability**: 99.9% uptime during rollout period

---

This implementation plan provides a comprehensive, step-by-step approach to safely completing the quota management system while preserving all existing functionality and maintaining the highest levels of system reliability. The phased approach with extensive testing and safety measures ensures a successful integration with minimal risk.