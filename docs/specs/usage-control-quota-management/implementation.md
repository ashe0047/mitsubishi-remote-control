# Usage Control & Quota Management - Implementation Plan

## 1. Executive Summary

### 1.1 Implementation Overview
This document provides a comprehensive, step-by-step implementation plan for the Usage Control & Quota Management MVP feature, building upon the existing Mitsubishi AC Remote Control system. The implementation follows a phased approach that preserves system stability while incrementally adding quota capabilities.

### 1.2 Current System Analysis
Based on codebase analysis, the current system architecture includes:

**Frontend (Next.js 15 + React 19)**:
- Zustand v5 state management with `api-aircon-store.ts`
- WebSocket client integration for real-time updates
- ShadcnUI component system with Tailwind CSS
- Room discovery through WebSocket streams
- Reactive AC control with optimistic UI patterns

**Backend (Spring Boot 3.5.5 + Java 21)**:
- Reactive WebFlux architecture with `ReactiveAirConService`
- MQTT integration via `ReactiveMqttService`
- WebSocket handling through `ReactiveWebSocketHandler`
- Functional routing with `AirConRouterConfig`
- Event-driven architecture with MQTT state/settings events

### 1.3 Implementation Strategy
- **Incremental Integration**: Add quota functionality alongside existing components
- **Feature Flag Control**: Gradual rollout with household-level enablement
- **Backward Compatibility**: Zero breaking changes to existing AC control flow
- **Performance First**: Quota validation optimized for <100ms response times
- **Fail-Safe Design**: System degrades gracefully when quota services are unavailable

---

## 2. Prerequisites & Dependencies

### 2.1 Required Package Additions

**Frontend Dependencies** (add to `frontend/package.json`):
```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-progress": "^1.1.1",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@tanstack/react-query": "^5.62.9",
    "date-fns": "^4.1.0",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^3.10.0",
    "sonner": "^1.7.1"
  }
}
```

**Backend Dependencies** (add to `backend/mitsubishi-controller/pom.xml`):
```xml
<dependencies>
    <!-- Spring Data R2DBC for reactive database access -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-r2dbc</artifactId>
    </dependency>
    
    <!-- PostgreSQL R2DBC driver -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>r2dbc-postgresql</artifactId>
    </dependency>
    
    <!-- Spring Security for authentication -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    
    <!-- Redis for caching -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
    </dependency>
    
    <!-- JWT token handling -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.12.6</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.12.6</version>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.12.6</version>
        <scope>runtime</scope>
    </dependency>
    
    <!-- Micrometer for metrics -->
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-registry-prometheus</artifactId>
    </dependency>
    
    <!-- FlywayDB for database migrations -->
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
    </dependency>
</dependencies>
```

### 2.2 Infrastructure Requirements

**Database Setup** (PostgreSQL):
```bash
# Create quota database and user
createdb turing
createuser postgres --password
psql turing -c "GRANT ALL PRIVILEGES ON DATABASE turing TO postgres;"
```

**Redis Setup** (for caching):
```bash
# Start Redis with quota-specific database
redis-server --port 6380 --databases 16
```

### 2.3 Environment Configuration

**Frontend Environment** (`.env.local`):
```bash
# Existing MQTT configuration (preserved)
NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:9001
NEXT_PUBLIC_MQTT_BROKER_PORT=9001
NEXT_PUBLIC_MQTT_BROKER_USERNAME=mqtt_user
NEXT_PUBLIC_MQTT_BROKER_PASSWORD=mqtt_password

# New quota-related configuration
NEXT_PUBLIC_QUOTA_API_URL=http://localhost:8080/api
NEXT_PUBLIC_QUOTA_WEBSOCKET_URL=ws://localhost:8080/ws
NEXT_PUBLIC_ENABLE_QUOTA_FEATURES=true
```

**Backend Environment** (`application-quota.yml`):
```yaml
spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/turing
    username: postgres
    password: ${QUOTA_DB_PASSWORD:postgres}
    
  redis:
    quota:
      host: localhost
      port: 6380
      database: 1
      
  security:
    jwt:
      secret: ${JWT_SECRET:your-256-bit-secret-key-here}
      expiration: 86400000 # 24 hours
      
quota:
  enabled: true
  validation:
    timeout: 100ms
    cache-ttl: 3600s
  households:
    enabled: # Comma-separated household IDs for gradual rollout
```

---

## 3. Implementation Phases

### 3.1 Phase 1: Database Foundation (Week 1)

#### 3.1.1 Database Schema Creation

**Migration V001: Core Tables** (`src/main/resources/db/migration/V001__Create_quota_tables.sql`):
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Households table for multi-tenancy
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(20) DEFAULT 'BASIC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced users table with quota roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CHILD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User room assignments
CREATE TABLE user_room_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(user_id, room_id)
);

-- Quotas table with flexible quota types
CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    quota_type VARCHAR(20) NOT NULL DEFAULT 'DAILY_TIME',
    daily_limit_seconds INTEGER NOT NULL,
    daily_used_seconds INTEGER DEFAULT 0,
    warning_threshold_percent INTEGER DEFAULT 75,
    is_active BOOLEAN DEFAULT true,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, room_id, quota_type)
);

-- Usage sessions for detailed tracking
CREATE TABLE usage_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    start_settings JSONB,
    end_settings JSONB,
    session_source VARCHAR(20) DEFAULT 'WEB_APP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quota violations and overrides
CREATE TABLE quota_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_id UUID NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    violation_type VARCHAR(20) NOT NULL,
    violated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    override_by UUID REFERENCES users(id),
    override_at TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    additional_seconds INTEGER DEFAULT 0
);

-- Performance indexes
CREATE INDEX idx_quotas_user_room_active ON quotas (user_id, room_id, is_active);
CREATE INDEX idx_usage_sessions_user_time ON usage_sessions (user_id, start_time DESC);
CREATE INDEX idx_user_room_assignments_user ON user_room_assignments (user_id);
CREATE INDEX idx_quota_violations_user_time ON quota_violations (user_id, violated_at DESC);
CREATE INDEX idx_users_household_role ON users (household_id, role);

-- Usage summary materialized view for dashboard performance
CREATE MATERIALIZED VIEW daily_usage_summaries AS
SELECT 
    us.user_id,
    u.name as user_name,
    u.household_id,
    us.room_id,
    DATE(us.start_time) as usage_date,
    SUM(us.duration_seconds) as total_duration_seconds,
    COUNT(*) as session_count,
    AVG(us.duration_seconds) as avg_session_duration_seconds,
    MIN(us.start_time) as first_session_start,
    MAX(us.end_time) as last_session_end
FROM usage_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.end_time IS NOT NULL
GROUP BY us.user_id, u.name, u.household_id, us.room_id, DATE(us.start_time);

-- Index for materialized view
CREATE UNIQUE INDEX idx_daily_usage_summaries_unique 
ON daily_usage_summaries (user_id, room_id, usage_date);
```

#### 3.1.2 Repository Layer Implementation

**Base Entity Classes** (`com.ashelabs.mitsubishicontroller.entity`):

```java
// BaseEntity.java
@MappedSuperclass
@Data
public abstract class BaseEntity {
    @Id
    private UUID id;
    
    @CreatedDate
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// Household.java
@Entity
@Table(name = "households")
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Household extends BaseEntity {
    @Column(nullable = false)
    private String name;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "plan_type")
    private PlanType planType = PlanType.BASIC;
    
    public enum PlanType {
        BASIC, FAMILY, PREMIUM
    }
}

// User.java
@Entity
@Table(name = "users")
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {
    @Column(name = "household_id", nullable = false)
    private UUID householdId;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    @Column(nullable = false)
    private String name;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.CHILD;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    public enum Role {
        PARENT, CHILD, ADMIN
    }
}

// Quota.java
@Entity
@Table(name = "quotas")
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Quota extends BaseEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    
    @Column(name = "room_id", nullable = false)
    private String roomId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "quota_type", nullable = false)
    private QuotaType quotaType = QuotaType.DAILY_TIME;
    
    @Column(name = "daily_limit_seconds", nullable = false)
    private Integer dailyLimitSeconds;
    
    @Column(name = "daily_used_seconds")
    private Integer dailyUsedSeconds = 0;
    
    @Column(name = "warning_threshold_percent")
    private Integer warningThresholdPercent = 75;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @Column(name = "start_date")
    private LocalDate startDate = LocalDate.now();
    
    @Column(name = "end_date")
    private LocalDate endDate;
    
    public enum QuotaType {
        DAILY_TIME, WEEKLY_TIME, MONTHLY_TIME
    }
}
```

**Repository Interfaces**:

```java
// QuotaRepository.java
@Repository
public interface QuotaRepository extends ReactiveCrudRepository<Quota, UUID> {
    
    @Query("""
        SELECT q FROM Quota q 
        WHERE q.userId = :userId AND q.roomId = :roomId 
        AND q.isActive = true AND (q.endDate IS NULL OR q.endDate >= :currentDate)
        """)
    Mono<Quota> findActiveQuotaByUserAndRoom(
        @Param("userId") UUID userId, 
        @Param("roomId") String roomId,
        @Param("currentDate") LocalDate currentDate
    );
    
    @Query("SELECT q FROM Quota q WHERE q.userId IN :userIds AND q.isActive = true")
    Flux<Quota> findActiveQuotasByUsers(@Param("userIds") List<UUID> userIds);
    
    @Modifying
    @Query("UPDATE Quota q SET q.dailyUsedSeconds = 0 WHERE q.quotaType = 'DAILY_TIME'")
    Mono<Integer> resetDailyUsage();
    
    @Query("""
        SELECT q FROM Quota q 
        JOIN User u ON q.userId = u.id 
        WHERE u.householdId = :householdId AND q.isActive = true
        """)
    Flux<Quota> findActiveQuotasByHousehold(@Param("householdId") UUID householdId);
}

// UsageSessionRepository.java  
@Repository
public interface UsageSessionRepository extends ReactiveCrudRepository<UsageSession, UUID> {
    
    @Query("""
        SELECT us FROM UsageSession us 
        WHERE us.userId = :userId AND us.roomId = :roomId 
        AND us.endTime IS NULL
        ORDER BY us.startTime DESC
        """)
    Mono<UsageSession> findActiveSession(
        @Param("userId") UUID userId, 
        @Param("roomId") String roomId
    );
    
    @Query("""
        SELECT COALESCE(SUM(us.durationSeconds), 0) 
        FROM UsageSession us 
        WHERE us.userId = :userId 
        AND DATE(us.startTime) = :date
        """)
    Mono<Long> calculateDailyUsage(
        @Param("userId") UUID userId, 
        @Param("date") LocalDate date
    );
    
    @Query("""
        SELECT us FROM UsageSession us 
        WHERE us.userId = :userId 
        AND us.startTime >= :startDate AND us.startTime < :endDate
        ORDER BY us.startTime DESC
        """)
    Flux<UsageSession> findSessionsByUserAndDateRange(
        @Param("userId") UUID userId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
}
```

### 3.2 Phase 2: Core Backend Services (Week 2)

#### 3.2.1 Quota Validation Service

**QuotaValidationService Implementation**:

```java
@Service
@Slf4j
public class QuotaValidationService {
    
    private final QuotaRepository quotaRepository;
    private final UsageSessionRepository usageSessionRepository;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final QuotaFeatureService featureService;
    
    private static final Duration VALIDATION_TIMEOUT = Duration.ofMillis(100);
    private static final Duration CACHE_TTL = Duration.ofHours(1);
    
    public QuotaValidationService(
        QuotaRepository quotaRepository,
        UsageSessionRepository usageSessionRepository,
        ReactiveRedisTemplate<String, Object> redisTemplate,
        QuotaFeatureService featureService
    ) {
        this.quotaRepository = quotaRepository;
        this.usageSessionRepository = usageSessionRepository;
        this.redisTemplate = redisTemplate;
        this.featureService = featureService;
    }
    
    /**
     * Validates if a command would exceed user's quota
     * Performance target: <100ms response time
     */
    public Mono<QuotaValidationResult> validateCommand(
        UUID userId, 
        String roomId, 
        AirConCommand command
    ) {
        // Skip validation if quota feature is disabled for this user
        return featureService.isQuotaEnabledForUser(userId)
            .flatMap(enabled -> {
                if (!enabled) {
                    return Mono.just(QuotaValidationResult.allow("Quota disabled"));
                }
                return performValidation(userId, roomId, command);
            })
            .timeout(VALIDATION_TIMEOUT)
            .onErrorResume(this::handleValidationError)
            .doOnNext(result -> recordValidationMetrics(userId, roomId, result));
    }
    
    private Mono<QuotaValidationResult> performValidation(
        UUID userId, 
        String roomId, 
        AirConCommand command
    ) {
        return getCurrentQuotaBalance(userId, roomId)
            .map(balance -> evaluateCommand(balance, command))
            .switchIfEmpty(Mono.just(QuotaValidationResult.allow("No quota configured")));
    }
    
    /**
     * Get real-time quota balance with cache optimization
     */
    public Mono<QuotaBalance> getCurrentQuotaBalance(UUID userId, String roomId) {
        String cacheKey = balanceKey(userId, roomId);
        
        return redisTemplate.opsForValue().get(cacheKey)
            .cast(QuotaBalance.class)
            .switchIfEmpty(loadBalanceFromDatabase(userId, roomId)
                .doOnNext(balance -> cacheBalance(cacheKey, balance)));
    }
    
    private Mono<QuotaBalance> loadBalanceFromDatabase(UUID userId, String roomId) {
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now())
            .flatMap(quota -> 
                usageSessionRepository.calculateDailyUsage(userId, LocalDate.now())
                    .map(dailyUsage -> QuotaBalance.builder()
                        .quotaId(quota.getId())
                        .userId(userId)
                        .roomId(roomId)
                        .totalSeconds(quota.getDailyLimitSeconds())
                        .usedSeconds(dailyUsage.intValue())
                        .remainingSeconds(quota.getDailyLimitSeconds() - dailyUsage.intValue())
                        .warningThreshold(quota.getWarningThresholdPercent())
                        .lastUpdated(Instant.now())
                        .build())
            );
    }
    
    private QuotaValidationResult evaluateCommand(QuotaBalance balance, AirConCommand command) {
        // If turning AC off, always allow
        if (command.getAction().equals("power") && command.getValue().equals("OFF")) {
            return QuotaValidationResult.allow("Power off command");
        }
        
        // If no quota remaining, block command
        if (balance.getRemainingSeconds() <= 0) {
            return QuotaValidationResult.block(
                "Daily AC time limit exceeded. Remaining: 0 minutes"
            );
        }
        
        // Check if approaching warning threshold
        double usagePercent = (double) balance.getUsedSeconds() / balance.getTotalSeconds() * 100;
        if (usagePercent >= balance.getWarningThreshold()) {
            int remainingMinutes = balance.getRemainingSeconds() / 60;
            return QuotaValidationResult.allowWithWarning(
                String.format("AC time running low. %d minutes remaining today.", remainingMinutes)
            );
        }
        
        return QuotaValidationResult.allow("Within quota limits");
    }
    
    private Mono<QuotaValidationResult> handleValidationError(Throwable error) {
        if (error instanceof TimeoutException) {
            log.warn("Quota validation timeout, failing open");
            return Mono.just(QuotaValidationResult.failOpen("Validation timeout"));
        }
        
        log.error("Quota validation error, failing open", error);
        return Mono.just(QuotaValidationResult.failOpen("Service error"));
    }
    
    // Helper methods
    private String balanceKey(UUID userId, String roomId) {
        return String.format("quota:balance:%s:%s", userId, roomId);
    }
    
    private void cacheBalance(String key, QuotaBalance balance) {
        redisTemplate.opsForValue()
            .set(key, balance, CACHE_TTL)
            .subscribe(
                result -> log.debug("Cached quota balance: {}", key),
                error -> log.warn("Failed to cache quota balance: {}", key, error)
            );
    }
}
```

**Supporting Classes**:

```java
// QuotaValidationResult.java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaValidationResult {
    private ValidationStatus status;
    private String message;
    private String reason;
    
    public enum ValidationStatus {
        ALLOW, ALLOW_WITH_WARNING, BLOCK, FAIL_OPEN
    }
    
    public boolean isBlocked() {
        return status == ValidationStatus.BLOCK;
    }
    
    public boolean hasWarning() {
        return status == ValidationStatus.ALLOW_WITH_WARNING;
    }
    
    public boolean isFailOpen() {
        return status == ValidationStatus.FAIL_OPEN;
    }
    
    public static QuotaValidationResult allow(String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.ALLOW)
            .reason(reason)
            .build();
    }
    
    public static QuotaValidationResult allowWithWarning(String message) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.ALLOW_WITH_WARNING)
            .message(message)
            .build();
    }
    
    public static QuotaValidationResult block(String message) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.BLOCK)
            .message(message)
            .build();
    }
    
    public static QuotaValidationResult failOpen(String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.FAIL_OPEN)
            .reason(reason)
            .build();
    }
}

// QuotaBalance.java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaBalance {
    private UUID quotaId;
    private UUID userId;
    private String roomId;
    private Integer totalSeconds;
    private Integer usedSeconds;
    private Integer remainingSeconds;
    private Integer warningThreshold;
    private Instant lastUpdated;
    
    public double getUsagePercentage() {
        if (totalSeconds == null || totalSeconds == 0) return 0.0;
        return (double) usedSeconds / totalSeconds * 100;
    }
    
    public boolean isExceeded() {
        return remainingSeconds != null && remainingSeconds <= 0;
    }
    
    public boolean isAtWarningThreshold() {
        return getUsagePercentage() >= warningThreshold;
    }
}

// AirConCommand.java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AirConCommand {
    private String action; // power, temperature, mode, fan, vane, widevane
    private Object value;
    private Instant timestamp = Instant.now();
}
```

#### 3.2.2 Usage Tracking Service

```java
@Service
@Slf4j
public class UsageTrackingService {
    
    private final UsageSessionRepository sessionRepository;
    private final QuotaRepository quotaRepository;
    private final QuotaNotificationService notificationService;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    
    /**
     * Handles AC state changes for usage tracking
     * Processes asynchronously to avoid blocking MQTT flow
     */
    @EventListener
    @Async("usageTrackingExecutor")
    public void handleAirConStateChange(MqttStateUpdateEvent event) {
        // Extract user context from event (will be added in integration phase)
        UUID userId = extractUserFromEvent(event);
        if (userId == null) {
            log.debug("No user context for state change, skipping usage tracking");
            return;
        }
        
        processUsageEvent(userId, event.getRoomId(), event.getState())
            .doOnNext(session -> updateQuotaBalances(session))
            .doOnNext(session -> checkQuotaThresholds(session))
            .doOnError(error -> log.error("Failed to track usage for event: {}", event, error))
            .subscribe();
    }
    
    /**
     * Start a new usage session when AC turns on
     */
    public Mono<UsageSession> startUsageSession(
        UUID userId, 
        String roomId, 
        AirConSettings startSettings
    ) {
        // Check if there's already an active session
        return sessionRepository.findActiveSession(userId, roomId)
            .flatMap(existing -> {
                log.warn("Active session found for user {} room {}, ending it first", 
                    userId, roomId);
                return endUsageSession(existing.getId());
            })
            .then(Mono.defer(() -> {
                UsageSession newSession = UsageSession.builder()
                    .userId(userId)
                    .roomId(roomId)
                    .startTime(LocalDateTime.now())
                    .startSettings(startSettings.toJson())
                    .sessionSource(UsageSession.SessionSource.WEB_APP)
                    .build();
                
                return sessionRepository.save(newSession)
                    .doOnNext(session -> {
                        log.info("Started usage session {} for user {} room {}", 
                            session.getId(), userId, roomId);
                        cacheActiveSession(userId, roomId, session);
                    });
            }));
    }
    
    /**
     * End an active usage session when AC turns off
     */
    public Mono<UsageSession> endUsageSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
            .flatMap(session -> {
                if (session.getEndTime() != null) {
                    log.warn("Attempting to end already completed session {}", sessionId);
                    return Mono.just(session);
                }
                
                LocalDateTime endTime = LocalDateTime.now();
                long durationSeconds = Duration.between(session.getStartTime(), endTime).getSeconds();
                
                session.setEndTime(endTime);
                session.setDurationSeconds((int) durationSeconds);
                
                return sessionRepository.save(session)
                    .doOnNext(updatedSession -> {
                        log.info("Ended usage session {} after {} seconds", 
                            sessionId, durationSeconds);
                        
                        // Update quota usage
                        updateQuotaUsage(session.getUserId(), session.getRoomId(), 
                            (int) durationSeconds).subscribe();
                        
                        // Clear cache
                        clearActiveSessionCache(session.getUserId(), session.getRoomId());
                    });
            });
    }
    
    private Mono<UsageSession> processUsageEvent(UUID userId, String roomId, AirConState state) {
        if ("ON".equals(state.getPower())) {
            AirConSettings settings = AirConSettings.builder()
                .power(state.getPower())
                .temperature(state.getTemperature())
                .mode(state.getMode())
                .fan(state.getFan())
                .vane(state.getVane())
                .wideVane(state.getWideVane())
                .build();
            return startUsageSession(userId, roomId, settings);
        } else {
            return sessionRepository.findActiveSession(userId, roomId)
                .flatMap(session -> endUsageSession(session.getId()))
                .switchIfEmpty(Mono.empty());
        }
    }
    
    private Mono<Void> updateQuotaUsage(UUID userId, String roomId, int additionalSeconds) {
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now())
            .flatMap(quota -> {
                quota.setDailyUsedSeconds(quota.getDailyUsedSeconds() + additionalSeconds);
                return quotaRepository.save(quota);
            })
            .then(Mono.fromRunnable(() -> {
                // Invalidate cache for this quota balance
                String cacheKey = String.format("quota:balance:%s:%s", userId, roomId);
                redisTemplate.delete(cacheKey).subscribe();
            }));
    }
    
    private Mono<Void> checkQuotaThresholds(UsageSession session) {
        return quotaRepository.findActiveQuotaByUserAndRoom(
            session.getUserId(), session.getRoomId(), LocalDate.now())
            .flatMap(quota -> {
                double usagePercent = (double) quota.getDailyUsedSeconds() / quota.getDailyLimitSeconds() * 100;
                
                if (usagePercent >= quota.getWarningThresholdPercent()) {
                    return notificationService.sendQuotaWarning(
                        session.getUserId(), 
                        quota, 
                        usagePercent >= 100 ? "EXCEEDED" : "WARNING"
                    );
                }
                return Mono.empty();
            })
            .then();
    }
    
    // Cache management
    private void cacheActiveSession(UUID userId, String roomId, UsageSession session) {
        String key = String.format("quota:session:%s:%s", userId, roomId);
        redisTemplate.opsForValue()
            .set(key, session, Duration.ofHours(24))
            .subscribe();
    }
    
    private void clearActiveSessionCache(UUID userId, String roomId) {
        String key = String.format("quota:session:%s:%s", userId, roomId);
        redisTemplate.delete(key).subscribe();
    }
    
    // Extract user from MQTT event (placeholder - will be implemented in integration phase)
    private UUID extractUserFromEvent(MqttStateUpdateEvent event) {
        // This will be implemented when we add user context to MQTT events
        // For now, return null to skip usage tracking
        return null;
    }
}
```

#### 3.2.3 Integration with Existing ReactiveAirConService

**Enhanced ReactiveAirConService with Quota Integration**:

```java
@Service
@Slf4j
public class ReactiveAirConService {
    
    private final ReactiveMqttService mqttService;
    private final QuotaValidationService quotaValidationService; // NEW
    private final UsageTrackingService usageTrackingService; // NEW
    private final QuotaFeatureService featureService; // NEW
    
    // Existing fields preserved
    private final ConcurrentMap<String, AirConState> roomStates = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AirConSettings> roomSettings = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, LocalDateTime> lastUpdated = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> roomNames = new ConcurrentHashMap<>();

    // Enhanced constructor with quota services
    public ReactiveAirConService(
        ReactiveMqttService mqttService,
        QuotaValidationService quotaValidationService,
        UsageTrackingService usageTrackingService,
        QuotaFeatureService featureService
    ) {
        this.mqttService = mqttService;
        this.quotaValidationService = quotaValidationService;
        this.usageTrackingService = usageTrackingService;
        this.featureService = featureService;
        initializeDefaultRooms();
    }
    
    // Existing initialization preserved
    @PostConstruct
    public void initialize() {
        log.info("Initializing Reactive AirCon Service with quota support");
        
        mqttService.getStateUpdates()
            .doOnNext(event -> log.debug("Received state update for room {}: {}", event.getRoomId(), event.getState()))
            .subscribe(this::handleStateUpdate,
                error -> log.error("Error processing MQTT state updates", error),
                () -> log.info("MQTT state updates stream completed"));
            
        mqttService.getSettingsUpdates()
            .doOnNext(event -> log.debug("Received settings update for room {}: {}", event.getRoomId(), event.getSettings()))
            .subscribe(this::handleSettingsUpdate,
                error -> log.error("Error processing MQTT settings updates", error),
                () -> log.info("MQTT settings updates stream completed"));
                
        mqttService.getConnectionEvents()
            .doOnNext(event -> log.debug("Received connection event: connected={}", event.isConnected()))
            .subscribe(this::handleConnectionEvent,
                error -> log.error("Error processing MQTT connection events", error),
                () -> log.info("MQTT connection events stream completed"));
    }
    
    // Enhanced command methods with quota validation
    public Mono<Void> setPower(String roomId, String power) {
        return getCurrentUser()
            .flatMap(user -> validateWithQuota(user.getId(), roomId, "power", power))
            .then(validateRoomId(roomId))
            .then(mqttService.publishCommand(roomId, "power", power))
            .doOnSuccess(v -> log.info("Power command sent for room {}: {}", roomId, power));
    }
    
    public Mono<Void> setTemperature(String roomId, int temperature) {
        return getCurrentUser()
            .flatMap(user -> validateWithQuota(user.getId(), roomId, "temperature", temperature))
            .then(validateRoomId(roomId))
            .then(validateTemperature(temperature))
            .then(mqttService.publishCommand(roomId, "temp", temperature))
            .doOnSuccess(v -> log.info("Temperature command sent for room {}: {}", roomId, temperature));
    }
    
    // Similar enhancements for other command methods...
    
    /**
     * NEW: Quota validation middleware - only active for users with quotas
     */
    private Mono<Void> validateWithQuota(UUID userId, String roomId, String action, Object value) {
        return featureService.isQuotaEnabledForUser(userId)
            .flatMap(enabled -> {
                if (!enabled) {
                    return Mono.empty(); // Skip quota validation
                }
                
                AirConCommand command = new AirConCommand(action, value);
                return quotaValidationService.validateCommand(userId, roomId, command)
                    .flatMap(result -> {
                        if (result.isBlocked()) {
                            return Mono.error(new QuotaExceededException(result.getMessage()));
                        }
                        
                        // Log warnings but don't block
                        if (result.hasWarning()) {
                            log.info("Quota warning for user {} room {}: {}", 
                                userId, roomId, result.getMessage());
                        }
                        
                        return Mono.empty();
                    });
            })
            .onErrorResume(QuotaServiceException.class, ex -> {
                log.warn("Quota validation failed, allowing command: {}", ex.getMessage());
                return Mono.empty(); // Fail open
            });
    }
    
    // Placeholder for user context - will be implemented with authentication
    private Mono<User> getCurrentUser() {
        // TODO: Implement user context extraction from security context
        return Mono.just(User.builder().id(UUID.randomUUID()).build());
    }
    
    // Existing methods preserved unchanged...
    // (handleStateUpdate, handleSettingsUpdate, validateRoomId, etc.)
}
```

### 3.3 Phase 3: Frontend Quota Stores (Week 3)

#### 3.3.1 Quota Store Implementation

**New Quota Store** (`frontend/src/stores/quota-store.ts`):

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export interface QuotaBalance {
  quotaId: string;
  userId: string;
  roomId: string;
  totalSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  warningThreshold: number;
  lastUpdated: string;
}

export interface QuotaViolation {
  id: string;
  userId: string;
  roomId: string;
  type: 'WARNING' | 'EXCEEDED' | 'BLOCKED';
  message: string;
  timestamp: string;
  overrideRequested?: boolean;
}

export interface QuotaOverride {
  userId: string;
  roomId: string;
  type: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';
  additionalSeconds?: number;
  reason?: string;
  grantedBy: string;
  grantedAt: string;
}

// Store State Interface
interface QuotaState {
  // Current quota balances per user/room
  balances: Record<string, Record<string, QuotaBalance>>;
  
  // Active violations and warnings
  violations: QuotaViolation[];
  
  // Override states and requests
  overrides: Record<string, QuotaOverride>;
  
  // Loading states
  isLoadingBalances: boolean;
  isRequestingOverride: boolean;
  
  // Error handling
  error: string | null;
  
  // Actions
  updateBalance: (userId: string, roomId: string, balance: QuotaBalance) => void;
  addViolation: (violation: QuotaViolation) => void;
  clearViolation: (violationId: string) => void;
  requestOverride: (userId: string, roomId: string, type: QuotaOverride['type'], additionalSeconds?: number) => Promise<void>;
  clearOverride: (userId: string, roomId: string) => void;
  setError: (error: string | null) => void;
  
  // Selectors
  getBalance: (userId: string, roomId: string) => QuotaBalance | null;
  hasActiveViolation: (userId: string, roomId: string) => boolean;
  getViolationsForUser: (userId: string) => QuotaViolation[];
  hasActiveOverride: (userId: string, roomId: string) => boolean;
  
  // Quota prediction for optimistic UI
  predictQuotaImpact: (userId: string, roomId: string, estimatedUsage: number) => QuotaBalance | null;
}

// Create store with middleware
export const useQuotaStore = create<QuotaState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      balances: {},
      violations: [],
      overrides: {},
      isLoadingBalances: false,
      isRequestingOverride: false,
      error: null,

      // Actions
      updateBalance: (userId, roomId, balance) => {
        set((state) => {
          if (!state.balances[userId]) {
            state.balances[userId] = {};
          }
          state.balances[userId][roomId] = balance;
        });
      },

      addViolation: (violation) => {
        set((state) => {
          // Remove any existing violation for the same user/room
          state.violations = state.violations.filter(
            v => !(v.userId === violation.userId && v.roomId === violation.roomId)
          );
          state.violations.push(violation);
        });
      },

      clearViolation: (violationId) => {
        set((state) => {
          state.violations = state.violations.filter(v => v.id !== violationId);
        });
      },

      requestOverride: async (userId, roomId, type, additionalSeconds) => {
        set((state) => {
          state.isRequestingOverride = true;
          state.error = null;
        });

        try {
          const response = await fetch('/api/quotas/override', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              roomId,
              type,
              additionalSeconds,
              reason: 'Parent override request'
            }),
          });

          if (!response.ok) {
            throw new Error(`Override request failed: ${response.statusText}`);
          }

          const override: QuotaOverride = await response.json();
          
          set((state) => {
            const key = `${userId}:${roomId}`;
            state.overrides[key] = override;
            state.isRequestingOverride = false;
            
            // Clear any related violations
            state.violations = state.violations.filter(
              v => !(v.userId === userId && v.roomId === roomId)
            );
          });

        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Override request failed';
            state.isRequestingOverride = false;
          });
          throw error;
        }
      },

      clearOverride: (userId, roomId) => {
        set((state) => {
          const key = `${userId}:${roomId}`;
          delete state.overrides[key];
        });
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },

      // Selectors
      getBalance: (userId, roomId) => {
        const state = get();
        return state.balances[userId]?.[roomId] || null;
      },

      hasActiveViolation: (userId, roomId) => {
        const state = get();
        return state.violations.some(v => v.userId === userId && v.roomId === roomId);
      },

      getViolationsForUser: (userId) => {
        const state = get();
        return state.violations.filter(v => v.userId === userId);
      },

      hasActiveOverride: (userId, roomId) => {
        const state = get();
        const key = `${userId}:${roomId}`;
        return !!state.overrides[key];
      },

      // Optimistic quota prediction for immediate UI feedback
      predictQuotaImpact: (userId, roomId, estimatedUsage) => {
        const state = get();
        const currentBalance = state.balances[userId]?.[roomId];
        
        if (!currentBalance) return null;

        return {
          ...currentBalance,
          usedSeconds: currentBalance.usedSeconds + estimatedUsage,
          remainingSeconds: currentBalance.remainingSeconds - estimatedUsage,
          lastUpdated: new Date().toISOString(),
        };
      },
    }))
  )
);

// Helper hooks for common use cases
export const useUserQuotaBalance = (userId: string, roomId: string) => {
  return useQuotaStore(state => state.getBalance(userId, roomId));
};

export const useUserViolations = (userId: string) => {
  return useQuotaStore(state => state.getViolationsForUser(userId));
};

export const useQuotaOverrideRequest = () => {
  return useQuotaStore(state => ({
    requestOverride: state.requestOverride,
    isRequesting: state.isRequestingOverride,
    error: state.error,
  }));
};

export default useQuotaStore;
```

#### 3.3.2 Auth Store Extension

**Enhanced Auth Store** (`frontend/src/stores/auth-store.ts`):

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'PARENT' | 'CHILD' | 'ADMIN';
  householdId: string;
  isActive: boolean;
}

export interface Household {
  id: string;
  name: string;
  planType: 'BASIC' | 'FAMILY' | 'PREMIUM';
  members: User[];
}

export interface UserRoomAssignment {
  userId: string;
  roomId: string;
  roomName: string;
  assignedAt: string;
}

// Store State
interface AuthState {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  
  // Household context for quota management
  household: Household | null;
  roomAssignments: UserRoomAssignment[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setHousehold: (household: Household) => void;
  updateRoomAssignments: (assignments: UserRoomAssignment[]) => void;
  
  // User management (for parents)
  addFamilyMember: (userData: Partial<User>) => Promise<User>;
  updateUserRoomAccess: (userId: string, roomIds: string[]) => Promise<void>;
  
  // Selectors
  canManageQuotas: () => boolean;
  canControlRoom: (roomId: string) => boolean;
  getAssignedRooms: (userId?: string) => string[];
  getFamilyMembers: () => User[];
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      token: null,
      household: null,
      roomAssignments: [],
      isLoading: false,
      isInitialized: false,

      // Authentication actions
      login: async (email, password) => {
        set({ isLoading: true });
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          
          if (!response.ok) {
            throw new Error('Login failed');
          }
          
          const { user, token, household, roomAssignments } = await response.json();
          
          set({
            user,
            token,
            household,
            roomAssignments,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
          
        } catch (error) {
          set({ 
            isLoading: false,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          household: null,
          roomAssignments: [],
          isAuthenticated: false,
          isInitialized: false,
        });
      },

      setUser: (user) => set({ user }),
      
      setHousehold: (household) => set({ household }),
      
      updateRoomAssignments: (assignments) => set({ roomAssignments: assignments }),

      // Family management
      addFamilyMember: async (userData) => {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${get().token}`,
          },
          body: JSON.stringify(userData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to add family member');
        }
        
        const newUser = await response.json();
        
        // Update household members
        set(state => ({
          household: state.household ? {
            ...state.household,
            members: [...state.household.members, newUser]
          } : null
        }));
        
        return newUser;
      },

      updateUserRoomAccess: async (userId, roomIds) => {
        const response = await fetch(`/api/users/${userId}/rooms`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${get().token}`,
          },
          body: JSON.stringify({ roomIds }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update room access');
        }
        
        // Refresh room assignments
        const assignments = await response.json();
        get().updateRoomAssignments(assignments);
      },

      // Selectors
      canManageQuotas: () => {
        const user = get().user;
        return user?.role === 'PARENT' || user?.role === 'ADMIN';
      },

      canControlRoom: (roomId) => {
        const state = get();
        if (!state.user) return false;
        
        // Parents can control all rooms in household
        if (state.user.role === 'PARENT' || state.user.role === 'ADMIN') {
          return true;
        }
        
        // Children can only control assigned rooms
        return state.roomAssignments.some(
          assignment => assignment.userId === state.user!.id && assignment.roomId === roomId
        );
      },

      getAssignedRooms: (userId) => {
        const state = get();
        const targetUserId = userId || state.user?.id;
        if (!targetUserId) return [];
        
        return state.roomAssignments
          .filter(assignment => assignment.userId === targetUserId)
          .map(assignment => assignment.roomId);
      },

      getFamilyMembers: () => {
        const state = get();
        return state.household?.members || [];
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        household: state.household,
        roomAssignments: state.roomAssignments,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

#### 3.3.3 WebSocket Integration for Real-time Updates

**Quota WebSocket Hook** (`frontend/src/hooks/useQuotaWebSocket.ts`):

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useQuotaStore } from '@/stores/quota-store';

interface QuotaWebSocketMessage {
  type: 'QUOTA_UPDATE' | 'QUOTA_VIOLATION' | 'QUOTA_OVERRIDE';
  payload: any;
}

export const useQuotaWebSocket = () => {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const updateBalance = useQuotaStore(state => state.updateBalance);
  const addViolation = useQuotaStore(state => state.addViolation);
  const clearViolation = useQuotaStore(state => state.clearViolation);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  
  const connect = useCallback(() => {
    if (!user || !isAuthenticated) return;
    
    const wsUrl = `${process.env.NEXT_PUBLIC_QUOTA_WEBSOCKET_URL}/quota/${user.id}/status`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Quota WebSocket connected');
      reconnectAttempts.current = 0;
      wsRef.current = ws;
    };
    
    ws.onmessage = (event) => {
      try {
        const message: QuotaWebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse quota WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Quota WebSocket disconnected');
      wsRef.current = null;
      
      // Exponential backoff reconnection
      if (reconnectAttempts.current < 5) {
        const delay = Math.pow(2, reconnectAttempts.current) * 1000;
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };
    
    ws.onerror = (error) => {
      console.error('Quota WebSocket error:', error);
    };
  }, [user, isAuthenticated]);
  
  const handleWebSocketMessage = (message: QuotaWebSocketMessage) => {
    switch (message.type) {
      case 'QUOTA_UPDATE':
        const { userId, roomId, balance } = message.payload;
        updateBalance(userId, roomId, balance);
        break;
        
      case 'QUOTA_VIOLATION':
        const violation = message.payload;
        addViolation(violation);
        
        // Show browser notification for quota violations
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('AC Quota Alert', {
            body: violation.message,
            icon: '/icons/quota-warning.png',
          });
        }
        break;
        
      case 'QUOTA_OVERRIDE':
        const { violationId } = message.payload;
        if (violationId) {
          clearViolation(violationId);
        }
        break;
        
      default:
        console.warn('Unknown quota WebSocket message type:', message.type);
    }
  };
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    if (user && isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
    
    return disconnect;
  }, [user, isAuthenticated, connect, disconnect]);
  
  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  return {
    isConnected: !!wsRef.current && wsRef.current.readyState === WebSocket.OPEN,
    reconnectAttempts: reconnectAttempts.current,
  };
};
```

### 3.4 Phase 4: Quota-Aware UI Components (Week 4)

#### 3.4.1 Quota Status Components

**Quota Status Badge** (`frontend/src/components/quota/QuotaStatusBadge.tsx`):

```typescript
"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useUserQuotaBalance } from '@/stores/quota-store';
import { cn } from '@/lib/utils';

interface QuotaStatusBadgeProps {
  userId: string;
  roomId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export const QuotaStatusBadge: React.FC<QuotaStatusBadgeProps> = ({
  userId,
  roomId,
  className,
  size = 'default'
}) => {
  const balance = useUserQuotaBalance(userId, roomId);
  
  if (!balance) return null;
  
  const remainingHours = Math.floor(balance.remainingSeconds / 3600);
  const remainingMinutes = Math.floor((balance.remainingSeconds % 3600) / 60);
  const usagePercentage = (balance.usedSeconds / balance.totalSeconds) * 100;
  
  const getVariant = () => {
    if (usagePercentage >= 100) return 'destructive';
    if (usagePercentage >= balance.warningThreshold) return 'warning';
    return 'default';
  };
  
  const getIcon = () => {
    if (usagePercentage >= 100) return <AlertTriangle className="h-3 w-3" />;
    if (usagePercentage >= balance.warningThreshold) return <Clock className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };
  
  const formatTimeRemaining = () => {
    if (balance.remainingSeconds <= 0) return 'No time left';
    if (remainingHours > 0) return `${remainingHours}h ${remainingMinutes}m left`;
    if (remainingMinutes > 0) return `${remainingMinutes}m left`;
    return 'Less than 1m left';
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={getVariant() as any}
          className={cn(
            "flex items-center gap-1 cursor-help",
            size === 'sm' && "text-xs px-2 py-1",
            size === 'lg' && "text-sm px-3 py-2",
            className
          )}
        >
          {getIcon()}
          <span>{formatTimeRemaining()}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p><strong>Daily AC Quota</strong></p>
          <p>Used: {Math.floor(balance.usedSeconds / 3600)}h {Math.floor((balance.usedSeconds % 3600) / 60)}m</p>
          <p>Total: {Math.floor(balance.totalSeconds / 3600)}h</p>
          <p>Usage: {Math.round(usagePercentage)}%</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default QuotaStatusBadge;
```

**Quota Warning Modal** (`frontend/src/components/quota/QuotaWarningModal.tsx`):

```typescript
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import { QuotaBalance } from '@/stores/quota-store';
import { useAuthStore } from '@/stores/auth-store';

interface QuotaWarningModalProps {
  open: boolean;
  onClose: () => void;
  quotaBalance: QuotaBalance;
  violationType: 'WARNING' | 'EXCEEDED';
}

export const QuotaWarningModal: React.FC<QuotaWarningModalProps> = ({
  open,
  onClose,
  quotaBalance,
  violationType
}) => {
  const user = useAuthStore(state => state.user);
  const canManageQuotas = useAuthStore(state => state.canManageQuotas());
  
  const usagePercentage = Math.round(
    (quotaBalance.usedSeconds / quotaBalance.totalSeconds) * 100
  );
  
  const remainingHours = Math.floor(quotaBalance.remainingSeconds / 3600);
  const remainingMinutes = Math.floor((quotaBalance.remainingSeconds % 3600) / 60);
  
  const handleRequestMoreTime = () => {
    // TODO: Implement parent notification system
    console.log('Requesting more AC time for user:', user?.id);
    onClose();
  };
  
  const isExceeded = violationType === 'EXCEEDED' || quotaBalance.remainingSeconds <= 0;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={cn(
              "h-5 w-5",
              isExceeded ? "text-red-500" : "text-yellow-500"
            )} />
            {isExceeded ? 'AC Time Limit Exceeded' : 'AC Time Running Low'}
          </DialogTitle>
          <DialogDescription>
            {isExceeded 
              ? "You've used all your daily AC time allowance."
              : "You're approaching your daily AC time limit."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Usage Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Daily Usage</span>
              <span>{usagePercentage}%</span>
            </div>
            <Progress 
              value={usagePercentage} 
              className="h-2"
            />
          </div>
          
          {/* Time Remaining */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Time Remaining Today
              </p>
              <p className="text-xs text-muted-foreground">
                {isExceeded 
                  ? '0 minutes' 
                  : `${remainingHours}h ${remainingMinutes}m`
                }
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <DialogFooter className="flex-col space-y-2">
            {!canManageQuotas && !isExceeded && (
              <Button 
                onClick={handleRequestMoreTime}
                className="w-full"
                variant="outline"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Ask for More Time
              </Button>
            )}
            
            <Button 
              onClick={onClose}
              className="w-full"
              variant={isExceeded ? "default" : "secondary"}
            >
              {isExceeded ? 'Understood' : 'Continue'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuotaWarningModal;
```

#### 3.4.2 Enhanced AC Remote Component

**Quota-Aware AC Remote** (`frontend/src/components/quota/QuotaAwareACRemote.tsx`):

```typescript
"use client";

import React, { useState, useCallback } from 'react';
import { AirConRemote } from '@/components/AirConRemote';
import { QuotaStatusBadge } from './QuotaStatusBadge';
import { QuotaWarningModal } from './QuotaWarningModal';
import { ParentOverrideDialog } from './ParentOverrideDialog';
import { useAuthStore } from '@/stores/auth-store';
import { useQuotaStore } from '@/stores/quota-store';
import { AirConSettings } from '@/lib/mqtt/mqtt-config';
import { toast } from 'sonner';

interface QuotaAwareACRemoteProps {
  roomId: string;
  className?: string;
}

export const QuotaAwareACRemote: React.FC<QuotaAwareACRemoteProps> = ({
  roomId,
  className
}) => {
  const user = useAuthStore(state => state.user);
  const canManageQuotas = useAuthStore(state => state.canManageQuotas());
  const quotaBalance = useQuotaStore(state => 
    user ? state.getBalance(user.id, roomId) : null
  );
  const hasActiveViolation = useQuotaStore(state => 
    user ? state.hasActiveViolation(user.id, roomId) : false
  );
  const predictQuotaImpact = useQuotaStore(state => state.predictQuotaImpact);
  
  const [quotaWarningOpen, setQuotaWarningOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [violationType, setViolationType] = useState<'WARNING' | 'EXCEEDED'>('WARNING');
  
  const checkQuotaBeforeCommand = useCallback((command: any) => {
    if (!user || !quotaBalance) return true;
    
    // Always allow turning AC off
    if (command.action === 'power' && command.value === 'OFF') {
      return true;
    }
    
    // Estimate impact of command (simplified for MVP)
    const estimatedUsage = command.action === 'power' && command.value === 'ON' ? 300 : 0; // 5 minutes
    const prediction = predictQuotaImpact(user.id, roomId, estimatedUsage);
    
    if (prediction && prediction.remainingSeconds <= 0) {
      setViolationType('EXCEEDED');
      setQuotaWarningOpen(true);
      return false;
    }
    
    if (prediction && (prediction.usedSeconds / prediction.totalSeconds) >= 0.9) {
      setViolationType('WARNING');
      setQuotaWarningOpen(true);
      return false;
    }
    
    return true;
  }, [user, quotaBalance, roomId, predictQuotaImpact]);
  
  const handleACCommand = useCallback(async (command: any) => {
    // Check quota before executing command
    if (!checkQuotaBeforeCommand(command)) {
      return; // Command blocked by quota
    }
    
    try {
      // Execute the original AC command
      // This will be handled by the existing AirConRemote component
      return command;
    } catch (error: any) {
      if (error.name === 'QuotaExceededException') {
        setViolationType('EXCEEDED');
        setQuotaWarningOpen(true);
      } else {
        toast.error(`Failed to control AC: ${error.message}`);
      }
      throw error;
    }
  }, [checkQuotaBeforeCommand]);
  
  const handleRequestOverride = () => {
    setQuotaWarningOpen(false);
    setOverrideDialogOpen(true);
  };
  
  return (
    <div className={className}>
      {/* Quota Status Display */}
      {user && quotaBalance && (
        <div className="mb-4 flex justify-between items-center">
          <QuotaStatusBadge userId={user.id} roomId={roomId} />
          {canManageQuotas && hasActiveViolation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverrideDialogOpen(true)}
            >
              Grant Override
            </Button>
          )}
        </div>
      )}
      
      {/* Original AC Remote Component */}
      <AirConRemote 
        roomId={roomId}
        onBeforeCommand={handleACCommand}
        className="w-full"
      />
      
      {/* Quota Warning Modal */}
      {quotaBalance && (
        <QuotaWarningModal
          open={quotaWarningOpen}
          onClose={() => setQuotaWarningOpen(false)}
          quotaBalance={quotaBalance}
          violationType={violationType}
        />
      )}
      
      {/* Parent Override Dialog */}
      {user && canManageQuotas && (
        <ParentOverrideDialog
          open={overrideDialogOpen}
          onClose={() => setOverrideDialogOpen(false)}
          childUserId={user.id}
          roomId={roomId}
        />
      )}
    </div>
  );
};

export default QuotaAwareACRemote;
```

---

## 4. Testing Strategy

### 4.1 Backend Testing

#### 4.1.1 Unit Tests for Quota Services

**QuotaValidationService Test** (`src/test/java/QuotaValidationServiceTest.java`):

```java
@ExtendWith(MockitoExtension.class)
class QuotaValidationServiceTest {
    
    @Mock
    private QuotaRepository quotaRepository;
    
    @Mock
    private UsageSessionRepository usageSessionRepository;
    
    @Mock
    private ReactiveRedisTemplate<String, Object> redisTemplate;
    
    @Mock
    private QuotaFeatureService featureService;
    
    @InjectMocks
    private QuotaValidationService quotaValidationService;
    
    @Test
    void validateCommand_ShouldAllowCommand_WhenWithinQuota() {
        // Arrange
        UUID userId = UUID.randomUUID();
        String roomId = "living-room";
        AirConCommand command = new AirConCommand("power", "ON");
        
        Quota quota = createQuota(userId, roomId, 14400, 3600); // 4h limit, 1h used
        QuotaBalance balance = createBalance(userId, roomId, 14400, 3600, 10800);
        
        when(featureService.isQuotaEnabledForUser(userId))
            .thenReturn(Mono.just(true));
        when(quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now()))
            .thenReturn(Mono.just(quota));
        when(usageSessionRepository.calculateDailyUsage(userId, LocalDate.now()))
            .thenReturn(Mono.just(3600L));
        
        // Act
        StepVerifier.create(quotaValidationService.validateCommand(userId, roomId, command))
            .expectNextMatches(result -> 
                result.getStatus() == QuotaValidationResult.ValidationStatus.ALLOW)
            .verifyComplete();
    }
    
    @Test
    void validateCommand_ShouldBlockCommand_WhenQuotaExceeded() {
        // Arrange
        UUID userId = UUID.randomUUID();
        String roomId = "living-room";
        AirConCommand command = new AirConCommand("power", "ON");
        
        Quota quota = createQuota(userId, roomId, 14400, 14400); // 4h limit, 4h used
        
        when(featureService.isQuotaEnabledForUser(userId))
            .thenReturn(Mono.just(true));
        when(quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now()))
            .thenReturn(Mono.just(quota));
        when(usageSessionRepository.calculateDailyUsage(userId, LocalDate.now()))
            .thenReturn(Mono.just(14400L));
        
        // Act & Assert
        StepVerifier.create(quotaValidationService.validateCommand(userId, roomId, command))
            .expectNextMatches(result -> 
                result.getStatus() == QuotaValidationResult.ValidationStatus.BLOCK)
            .verifyComplete();
    }
    
    @Test
    void validateCommand_ShouldFailOpen_WhenValidationTimesOut() {
        // Arrange
        UUID userId = UUID.randomUUID();
        String roomId = "living-room";
        AirConCommand command = new AirConCommand("power", "ON");
        
        when(featureService.isQuotaEnabledForUser(userId))
            .thenReturn(Mono.just(true));
        when(quotaRepository.findActiveQuotaByUserAndRoom(any(), any(), any()))
            .thenReturn(Mono.delay(Duration.ofSeconds(1)).then(Mono.empty())); // Timeout
        
        // Act & Assert
        StepVerifier.create(quotaValidationService.validateCommand(userId, roomId, command))
            .expectNextMatches(result -> result.isFailOpen())
            .verifyComplete();
    }
    
    private Quota createQuota(UUID userId, String roomId, int limitSeconds, int usedSeconds) {
        return Quota.builder()
            .userId(userId)
            .roomId(roomId)
            .dailyLimitSeconds(limitSeconds)
            .dailyUsedSeconds(usedSeconds)
            .warningThresholdPercent(75)
            .isActive(true)
            .build();
    }
    
    private QuotaBalance createBalance(UUID userId, String roomId, int total, int used, int remaining) {
        return QuotaBalance.builder()
            .userId(userId)
            .roomId(roomId)
            .totalSeconds(total)
            .usedSeconds(used)
            .remainingSeconds(remaining)
            .warningThreshold(75)
            .lastUpdated(Instant.now())
            .build();
    }
}
```

#### 4.1.2 Integration Tests

**Quota API Integration Test**:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class QuotaIntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
            .withDatabaseName("quota_test")
            .withUsername("test")
            .withPassword("test");
    
    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Autowired
    private QuotaRepository quotaRepository;
    
    @Test
    void shouldValidateQuotaBeforeACCommand() {
        // Setup test data
        UUID userId = UUID.randomUUID();
        String roomId = "test-room";
        
        Quota quota = createAndSaveQuota(userId, roomId, 3600, 3600); // 1h limit, 1h used
        
        // Attempt AC power on command
        String url = String.format("/api/rooms/%s/power", roomId);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", userId.toString()); // Simplified auth for testing
        
        HttpEntity<String> request = new HttpEntity<>("ON", headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        
        // Should be blocked due to quota exceeded
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("quota");
    }
    
    @Test
    void shouldAllowACCommandWhenWithinQuota() {
        // Setup test data
        UUID userId = UUID.randomUUID();
        String roomId = "test-room";
        
        Quota quota = createAndSaveQuota(userId, roomId, 7200, 1800); // 2h limit, 30m used
        
        // Attempt AC power on command
        String url = String.format("/api/rooms/%s/power", roomId);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", userId.toString());
        
        HttpEntity<String> request = new HttpEntity<>("ON", headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        
        // Should be allowed
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
    
    private Quota createAndSaveQuota(UUID userId, String roomId, int limitSeconds, int usedSeconds) {
        Quota quota = Quota.builder()
            .userId(userId)
            .roomId(roomId)
            .dailyLimitSeconds(limitSeconds)
            .dailyUsedSeconds(usedSeconds)
            .warningThresholdPercent(75)
            .isActive(true)
            .quotaType(Quota.QuotaType.DAILY_TIME)
            .startDate(LocalDate.now())
            .build();
        
        return quotaRepository.save(quota).block();
    }
}
```

### 4.2 Frontend Testing

#### 4.2.1 Quota Store Tests

**Quota Store Unit Tests** (`frontend/src/stores/__tests__/quota-store.test.ts`):

```typescript
import { act, renderHook } from '@testing-library/react';
import { useQuotaStore } from '../quota-store';

describe('QuotaStore', () => {
  beforeEach(() => {
    useQuotaStore.getState().balances = {};
    useQuotaStore.getState().violations = [];
    useQuotaStore.getState().overrides = {};
  });

  it('should update quota balance correctly', () => {
    const { result } = renderHook(() => useQuotaStore());
    
    const balance = {
      quotaId: 'quota-1',
      userId: 'user-1',
      roomId: 'living-room',
      totalSeconds: 14400, // 4 hours
      usedSeconds: 3600,   // 1 hour
      remainingSeconds: 10800, // 3 hours
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
    };

    act(() => {
      result.current.updateBalance('user-1', 'living-room', balance);
    });

    expect(result.current.getBalance('user-1', 'living-room')).toEqual(balance);
  });

  it('should predict quota impact correctly', () => {
    const { result } = renderHook(() => useQuotaStore());
    
    const initialBalance = {
      quotaId: 'quota-1',
      userId: 'user-1',
      roomId: 'living-room',
      totalSeconds: 14400,
      usedSeconds: 3600,
      remainingSeconds: 10800,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
    };

    act(() => {
      result.current.updateBalance('user-1', 'living-room', initialBalance);
    });

    const prediction = result.current.predictQuotaImpact('user-1', 'living-room', 1800); // 30 minutes

    expect(prediction).toEqual({
      ...initialBalance,
      usedSeconds: 5400,      // 1.5 hours
      remainingSeconds: 9000, // 2.5 hours
      lastUpdated: expect.any(String),
    });
  });

  it('should handle quota violations correctly', () => {
    const { result } = renderHook(() => useQuotaStore());
    
    const violation = {
      id: 'violation-1',
      userId: 'user-1',
      roomId: 'living-room',
      type: 'EXCEEDED' as const,
      message: 'Daily AC time limit exceeded',
      timestamp: new Date().toISOString(),
    };

    act(() => {
      result.current.addViolation(violation);
    });

    expect(result.current.hasActiveViolation('user-1', 'living-room')).toBe(true);
    expect(result.current.getViolationsForUser('user-1')).toContain(violation);

    act(() => {
      result.current.clearViolation('violation-1');
    });

    expect(result.current.hasActiveViolation('user-1', 'living-room')).toBe(false);
  });
});
```

#### 4.2.2 Component Tests

**Quota Status Badge Tests** (`frontend/src/components/quota/__tests__/QuotaStatusBadge.test.tsx`):

```typescript
import { render, screen } from '@testing-library/react';
import { QuotaStatusBadge } from '../QuotaStatusBadge';
import { useUserQuotaBalance } from '@/stores/quota-store';

// Mock the quota store
jest.mock('@/stores/quota-store', () => ({
  useUserQuotaBalance: jest.fn(),
}));

const mockUseUserQuotaBalance = useUserQuotaBalance as jest.MockedFunction<
  typeof useUserQuotaBalance
>;

describe('QuotaStatusBadge', () => {
  it('should display remaining time correctly', () => {
    mockUseUserQuotaBalance.mockReturnValue({
      quotaId: 'quota-1',
      userId: 'user-1',
      roomId: 'living-room',
      totalSeconds: 14400, // 4 hours
      usedSeconds: 3600,   // 1 hour
      remainingSeconds: 10800, // 3 hours
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
    });

    render(<QuotaStatusBadge userId="user-1" roomId="living-room" />);
    
    expect(screen.getByText('3h 0m left')).toBeInTheDocument();
  });

  it('should show warning variant when approaching limit', () => {
    mockUseUserQuotaBalance.mockReturnValue({
      quotaId: 'quota-1',
      userId: 'user-1',
      roomId: 'living-room',
      totalSeconds: 14400, // 4 hours
      usedSeconds: 12600,  // 3.5 hours (87.5%)
      remainingSeconds: 1800, // 30 minutes
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
    });

    render(<QuotaStatusBadge userId="user-1" roomId="living-room" />);
    
    const badge = screen.getByRole('button'); // Tooltip trigger
    expect(badge).toHaveClass('variant-warning'); // Adjust based on your CSS class naming
    expect(screen.getByText('30m left')).toBeInTheDocument();
  });

  it('should show destructive variant when quota exceeded', () => {
    mockUseUserQuotaBalance.mockReturnValue({
      quotaId: 'quota-1',
      userId: 'user-1',
      roomId: 'living-room',
      totalSeconds: 14400,
      usedSeconds: 14400,
      remainingSeconds: 0,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
    });

    render(<QuotaStatusBadge userId="user-1" roomId="living-room" />);
    
    expect(screen.getByText('No time left')).toBeInTheDocument();
  });

  it('should not render when no quota balance available', () => {
    mockUseUserQuotaBalance.mockReturnValue(null);
    
    const { container } = render(<QuotaStatusBadge userId="user-1" roomId="living-room" />);
    
    expect(container.firstChild).toBeNull();
  });
});
```

### 4.3 End-to-End Testing

**Quota E2E Tests** (`e2e/quota-management.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test.describe('Quota Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as child user with quota
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'child@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to room with quota
    await page.goto('/rooms/living-room');
  });

  test('should display quota status badge', async ({ page }) => {
    await expect(page.locator('[data-testid="quota-status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="quota-status-badge"]')).toContainText('left');
  });

  test('should show quota warning when approaching limit', async ({ page }) => {
    // Set up user with 90% quota usage via API
    await page.route('/api/quotas/user/*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          quotaId: 'quota-1',
          userId: 'user-1',
          roomId: 'living-room',
          totalSeconds: 14400,
          usedSeconds: 12960, // 90%
          remainingSeconds: 1440,
          warningThreshold: 75,
          lastUpdated: new Date().toISOString(),
        })
      });
    });

    await page.reload();
    
    // Try to turn on AC
    await page.click('[data-testid="power-button"]');
    
    // Should show warning modal
    await expect(page.locator('[data-testid="quota-warning-modal"]')).toBeVisible();
    await expect(page.getByText('AC Time Running Low')).toBeVisible();
  });

  test('should block AC command when quota exceeded', async ({ page }) => {
    // Set up user with exceeded quota
    await page.route('/api/quotas/user/*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          quotaId: 'quota-1',
          userId: 'user-1',
          roomId: 'living-room',
          totalSeconds: 14400,
          usedSeconds: 14400, // 100%
          remainingSeconds: 0,
          warningThreshold: 75,
          lastUpdated: new Date().toISOString(),
        })
      });
    });

    // Mock API to return quota exceeded error
    await page.route('/api/rooms/*/power', (route) => {
      route.fulfill({
        status: 403,
        body: JSON.stringify({ error: 'Daily AC time limit exceeded' })
      });
    });

    await page.reload();
    
    // Try to turn on AC
    await page.click('[data-testid="power-button"]');
    
    // Should show exceeded modal
    await expect(page.locator('[data-testid="quota-warning-modal"]')).toBeVisible();
    await expect(page.getByText('AC Time Limit Exceeded')).toBeVisible();
    
    // AC should remain off
    await expect(page.locator('[data-testid="ac-power-status"]')).toContainText('OFF');
  });

  test('should allow parent override', async ({ page }) => {
    // Switch to parent user
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'parent@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/rooms/living-room');
    
    // Open override dialog
    await page.click('[data-testid="grant-override-button"]');
    
    // Grant 1 hour override
    await page.click('[data-testid="add-1-hour-button"]');
    
    // Should close dialog and show success toast
    await expect(page.locator('[data-testid="override-dialog"]')).not.toBeVisible();
    await expect(page.getByText('Additional AC time granted')).toBeVisible();
  });
});
```

---

## 5. Deployment & Monitoring

### 5.1 Production Configuration

**Production Application Configuration**:

```yaml
# application-production.yml
spring:
  r2dbc:
    url: r2dbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    pool:
      initial-size: 5
      max-size: 20
      max-idle-time: 30m
      
  redis:
    quota:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}
      password: ${REDIS_PASSWORD}
      database: ${REDIS_DATABASE:1}
      timeout: 2s
      lettuce:
        pool:
          max-active: 8
          max-wait: -1ms
          
  security:
    jwt:
      secret: ${JWT_SECRET}
      expiration: ${JWT_EXPIRATION:86400000}
      
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    export:
      prometheus:
        enabled: true
        
logging:
  level:
    com.ashelabs.mitsubishicontroller: INFO
    org.springframework.r2dbc: WARN
    
quota:
  enabled: true
  validation:
    timeout: 100ms
    cache-ttl: 3600s
  usage-tracking:
    batch-size: 100
    flush-interval: 30s
```

### 5.2 Monitoring & Alerting

**Custom Metrics Configuration**:

```java
@Configuration
@EnableMetrics
public class QuotaMetricsConfig {
    
    @Bean
    public MeterRegistryCustomizer<MeterRegistry> quotaMetricsCustomizer() {
        return registry -> {
            registry.config()
                .commonTags("service", "mitsubishi-quota-management")
                .meterFilter(MeterFilter.deny(id -> {
                    String uri = id.getTag("uri");
                    return uri != null && uri.startsWith("/actuator");
                }));
        };
    }
    
    @EventListener
    public void handleQuotaValidation(QuotaValidationEvent event) {
        Timer.Sample sample = Timer.start(Metrics.globalRegistry);
        sample.stop(Timer.builder("quota.validation.duration")
            .description("Time taken for quota validation")
            .tag("result", event.getResult().getStatus().name())
            .register(Metrics.globalRegistry));
            
        Counter.builder("quota.validation.total")
            .description("Total quota validations")
            .tag("result", event.getResult().getStatus().name())
            .tag("room", event.getRoomId())
            .register(Metrics.globalRegistry)
            .increment();
    }
    
    @EventListener
    public void handleQuotaViolation(QuotaViolationEvent event) {
        Counter.builder("quota.violations.total")
            .description("Total quota violations")
            .tag("type", event.getViolationType())
            .tag("room", event.getRoomId())
            .register(Metrics.globalRegistry)
            .increment();
    }
}
```

**Prometheus Alert Rules** (`.prometheus/quota-alerts.yml`):

```yaml
groups:
  - name: quota-management
    rules:
      - alert: QuotaValidationHighLatency
        expr: histogram_quantile(0.95, quota_validation_duration_seconds) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Quota validation latency is high"
          description: "95th percentile quota validation latency is {{ $value }}s"
          
      - alert: QuotaValidationFailureRate
        expr: rate(quota_validation_total{result="FAIL_OPEN"}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High quota validation failure rate"
          description: "{{ $value }} quota validations per second are failing open"
          
      - alert: QuotaServiceDown
        expr: up{job="mitsubishi-quota-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Quota service is down"
          description: "The quota management service has been down for more than 1 minute"
```

### 5.3 Health Checks

**Comprehensive Health Indicators**:

```java
@Component
public class QuotaHealthIndicator implements ReactiveHealthIndicator {
    
    private final QuotaRepository quotaRepository;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final QuotaValidationService quotaValidationService;
    
    @Override
    public Mono<Health> health() {
        return Mono.zip(
            checkDatabase(),
            checkRedisConnection(),
            checkQuotaValidationPerformance()
        ).map(results -> {
            boolean dbHealthy = results.getT1();
            boolean redisHealthy = results.getT2();
            boolean performanceHealthy = results.getT3();
            
            if (dbHealthy && redisHealthy && performanceHealthy) {
                return Health.up()
                    .withDetail("database", "healthy")
                    .withDetail("redis", "healthy")
                    .withDetail("performance", "healthy")
                    .build();
            } else {
                return Health.down()
                    .withDetail("database", dbHealthy ? "healthy" : "unhealthy")
                    .withDetail("redis", redisHealthy ? "healthy" : "unhealthy")
                    .withDetail("performance", performanceHealthy ? "healthy" : "unhealthy")
                    .build();
            }
        });
    }
    
    private Mono<Boolean> checkDatabase() {
        return quotaRepository.count()
            .map(count -> true)
            .timeout(Duration.ofSeconds(5))
            .onErrorReturn(false);
    }
    
    private Mono<Boolean> checkRedisConnection() {
        return redisTemplate.hasKey("health-check")
            .timeout(Duration.ofSeconds(2))
            .onErrorReturn(false);
    }
    
    private Mono<Boolean> checkQuotaValidationPerformance() {
        // Test quota validation performance with dummy data
        UUID testUserId = UUID.randomUUID();
        AirConCommand testCommand = new AirConCommand("power", "ON");
        
        long startTime = System.currentTimeMillis();
        return quotaValidationService.validateCommand(testUserId, "test-room", testCommand)
            .map(result -> {
                long duration = System.currentTimeMillis() - startTime;
                return duration < 100; // Should complete in under 100ms
            })
            .onErrorReturn(false);
    }
}
```

---

## 6. Rollout Strategy

### 6.1 Feature Flag Implementation

**QuotaFeatureService with Gradual Rollout**:

```java
@Service
@ConfigurationProperties(prefix = "quota")
@Data
public class QuotaFeatureService {
    
    private boolean enabled = false;
    private Set<UUID> enabledHouseholds = new HashSet<>();
    private int rolloutPercentage = 0;
    
    private final UserRepository userRepository;
    
    public Mono<Boolean> isQuotaEnabledForUser(UUID userId) {
        if (!enabled) {
            return Mono.just(false);
        }
        
        return userRepository.findById(userId)
            .map(user -> isEnabledForHousehold(user.getHouseholdId()))
            .defaultIfEmpty(false);
    }
    
    public boolean isEnabledForHousehold(UUID householdId) {
        // Explicit household enablement takes precedence
        if (enabledHouseholds.contains(householdId)) {
            return true;
        }
        
        // Percentage-based rollout
        if (rolloutPercentage > 0) {
            int hash = Math.abs(householdId.hashCode() % 100);
            return hash < rolloutPercentage;
        }
        
        return false;
    }
    
    public void enableForHousehold(UUID householdId) {
        enabledHouseholds.add(householdId);
    }
    
    public void disableForHousehold(UUID householdId) {
        enabledHouseholds.remove(householdId);
    }
}
```

### 6.2 Phased Rollout Plan

**Phase 1: Internal Testing (Week 5)**
- Enable quota features for development and QA households only
- Monitor system performance and stability
- Validate all quota scenarios with synthetic data
- Test fail-safe mechanisms and error handling

**Phase 2: Beta Rollout (Week 6-7)**
- Enable for 5-10 volunteer families
- Collect user feedback and usage patterns
- Monitor quota accuracy and system performance
- Fix any identified issues before broader rollout

**Phase 3: Gradual Production Rollout (Week 8-12)**
- Week 8: 10% of households (estimated 10-20 families)
- Week 9: 25% of households 
- Week 10: 50% of households
- Week 11: 75% of households
- Week 12: 100% rollout (all eligible households)

**Rollback Triggers**:
- AC control response time degradation >200ms
- Quota validation failure rate >5%
- Database connection pool exhaustion
- Critical bugs affecting core AC functionality

---

## 7. Success Metrics & KPIs

### 7.1 Technical Performance Metrics

**Response Time Targets**:
- Quota validation: <100ms (95th percentile)
- AC command execution: No degradation from baseline
- WebSocket quota updates: <500ms from state change
- Dashboard page load: <2 seconds

**Reliability Metrics**:
- System uptime: >99.9%
- Quota validation accuracy: >99%
- Data consistency: <1% quota calculation discrepancies
- Error recovery time: <30 seconds for service failures

### 7.2 User Adoption Metrics

**Family Engagement**:
- Weekly active families using quota features: Target 70%
- Daily quota status checks by parents: Target 50%
- Quota configuration completion rate: Target 85%
- Parent override usage frequency: <10% of quota violations

**System Usage**:
- Average daily quota utilization: 60-80% of allocated time
- Quota warning effectiveness: 90% of users reduce usage after warning
- User satisfaction score: >4.0/5 for quota management features

---

## 8. Post-Implementation Checklist

### 8.1 System Validation

- [ ] Database migrations completed successfully
- [ ] All repository tests pass with real database
- [ ] Quota validation performance meets <100ms target
- [ ] MQTT integration preserves existing AC functionality
- [ ] WebSocket real-time updates functioning correctly
- [ ] Redis caching improves quota balance lookup performance
- [ ] Error handling gracefully degrades service when needed

### 8.2 User Experience Validation

- [ ] Quota status badges display correctly across different screen sizes
- [ ] AC control warnings appear at appropriate quota thresholds
- [ ] Parent override system works within 10 seconds
- [ ] Child user experience remains intuitive with quota constraints
- [ ] Real-time quota updates reflect in UI within 30 seconds
- [ ] Responsive design works on mobile devices

### 8.3 Production Readiness

- [ ] Health checks report system status accurately
- [ ] Prometheus metrics collection configured
- [ ] Alert rules trigger appropriately for performance degradation
- [ ] Logging provides sufficient debugging information
- [ ] Database performance optimized with proper indexing
- [ ] Security measures prevent quota circumvention
- [ ] Backup and recovery procedures tested

---

## 9. Conclusion

This comprehensive implementation plan provides a structured approach to adding Usage Control & Quota Management capabilities to the existing Mitsubishi AC Remote Control system. The phased implementation strategy ensures system stability while incrementally adding value for families seeking AC usage control.

**Key Implementation Highlights**:

1. **Preserves Existing Functionality**: All current AC control features remain unchanged
2. **High Performance**: Quota validation optimized for <100ms response times
3. **Fail-Safe Design**: System gracefully handles quota service failures
4. **Real-time Updates**: WebSocket integration provides immediate quota status feedback
5. **Scalable Architecture**: Clean service boundaries enable future feature expansion

**Next Steps**:
1. Begin Phase 1 implementation with database foundation
2. Set up development environment with PostgreSQL and Redis
3. Implement core quota validation service with comprehensive testing
4. Create frontend quota stores and integrate with existing components
5. Deploy to staging environment for internal testing

The implementation is designed to be completed within 8 weeks, with phased production rollout ensuring minimal risk to the existing user base while providing significant new value for families seeking AC usage control.

---

*This implementation document serves as the authoritative guide for building the Usage Control & Quota Management MVP feature. All development work should follow the patterns, architectures, and approaches outlined in this plan.*