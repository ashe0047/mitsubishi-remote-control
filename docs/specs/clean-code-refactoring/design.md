# Clean Code Refactoring - Technical Design Document

**Document Version:** 1.0  
**Date:** September 2025  
**Feature:** Clean Code Principles Implementation  
**Dependencies:** [spec.md](./spec.md)

---

## 📐 Architecture Overview

This document defines the technical architecture for refactoring the backend to eliminate SOLID, DRY, and YAGNI violations while implementing proper layered architecture patterns. The design follows a phased approach to ensure zero downtime and backward compatibility.

### **Design Principles Applied**
- **Single Responsibility Principle (SRP)**: Each service has one clear purpose
- **Open-Closed Principle (OCP)**: Components extensible without modification
- **Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions
- **Don't Repeat Yourself (DRY)**: Eliminate code duplication through centralization
- **Separation of Concerns**: Clear boundaries between layers and responsibilities

---

## 🎯 Component Architecture Design

### **1. Authentication Centralization Architecture**

#### **Problem Analysis**
- **Current Issue**: 25+ instances of duplicate JWT authentication code
- **Code Duplication**: 600+ lines of repeated authentication logic
- **Maintenance Risk**: Changes require updates in 25+ locations

#### **Solution: Spring AOP Authentication Aspect**

```java
// ============================================================================
// AUTHENTICATION ASPECT - Centralized Security Handling
// ============================================================================

@Aspect
@Component
@Slf4j
public class AuthenticationAspect {
    
    private final JwtAuthenticationContext jwtAuthContext;
    
    /**
     * Intercepts methods annotated with @RequireAuthentication
     * Extracts and validates JWT tokens, injects UserInfo into method context
     */
    @Around("@annotation(requireAuth)")
    public Object authenticate(ProceedingJoinPoint joinPoint, RequireAuthentication requireAuth) throws Throwable {
        HttpServletRequest request = getCurrentRequest();
        String authorization = request.getHeader("Authorization");
        
        if (authorization == null) {
            return createUnauthorizedResponse();
        }
        
        return jwtAuthContext.extractUserFromToken(authorization)
            .onErrorReturn(null)
            .flatMap(userInfo -> {
                if (userInfo == null) {
                    return Mono.just(createUnauthorizedResponse());
                }
                
                // Validate role requirements if specified
                if (!validateRoleRequirements(userInfo, requireAuth.roles())) {
                    return Mono.just(createForbiddenResponse());
                }
                
                // Inject UserInfo into method context
                UserContextHolder.setCurrentUser(userInfo);
                
                try {
                    Object result = joinPoint.proceed();
                    return result instanceof Mono ? (Mono<?>) result : Mono.just(result);
                } catch (Throwable e) {
                    return Mono.error(e);
                } finally {
                    UserContextHolder.clear();
                }
            })
            .doOnError(error -> log.error("Authentication error in {}", 
                joinPoint.getSignature().getName(), error));
    }
    
    private boolean validateRoleRequirements(UserInfo userInfo, UserRole[] requiredRoles) {
        if (requiredRoles.length == 0) return true;
        return Arrays.stream(requiredRoles)
            .anyMatch(role -> userInfo.hasRole(role));
    }
}

// ============================================================================
// AUTHENTICATION ANNOTATIONS
// ============================================================================

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireAuthentication {
    UserRole[] roles() default {}; // Optional role requirements
    boolean allowAnonymous() default false; // For public endpoints
}

@Target(ElementType.METHOD)  
@Retention(RetentionPolicy.RUNTIME)
@RequireAuthentication(roles = UserRole.PARENT)
public @interface RequireParentRole {
}

// ============================================================================
// USER CONTEXT MANAGEMENT
// ============================================================================

public class UserContextHolder {
    private static final ThreadLocal<UserInfo> userContext = new ThreadLocal<>();
    
    public static void setCurrentUser(UserInfo userInfo) {
        userContext.set(userInfo);
    }
    
    public static UserInfo getCurrentUser() {
        return userContext.get();
    }
    
    public static void clear() {
        userContext.remove();
    }
}
```

#### **Controller Refactoring Pattern**

```java
// BEFORE - Duplicated authentication code
@PostMapping
public Mono<ResponseEntity<Quota>> createQuota(@RequestBody CreateQuotaRequest request,
        @RequestHeader(value = "Authorization", required = false) String authorization) {
    
    if (authorization == null) {
        return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    
    return jwtAuthContext.extractUserFromToken(authorization)
        .onErrorReturn(null)
        .flatMap(userInfo -> {
            if (userInfo == null || !jwtAuthContext.isParent(userInfo)) {
                return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
            }
            // Business logic...
        });
}

// AFTER - Clean controller with centralized authentication
@PostMapping
@RequireParentRole
public Mono<ResponseEntity<Quota>> createQuota(@RequestBody CreateQuotaRequest request) {
    // UserInfo automatically available via UserContextHolder.getCurrentUser()
    UserInfo currentUser = UserContextHolder.getCurrentUser();
    return quotaManagementService.createOrUpdateQuota(request, currentUser.getId());
}
```

### **2. Service Decomposition Architecture**

#### **Problem Analysis**
- **QuotaValidationService**: 6+ responsibilities mixed together
- **UsageTrackingService**: Multiple concerns violating SRP
- **Testing Complexity**: Cannot test business logic independently

#### **Solution: Single-Responsibility Services**

```java
// ============================================================================
// QUOTA VALIDATION - Pure Business Logic
// ============================================================================

@Service
@Slf4j
public class QuotaValidationService {
    
    private final QuotaCacheService cacheService;
    private final QuotaFeatureFlagService featureFlagService;
    
    /**
     * Pure validation logic - easily unit testable
     * Depends only on abstractions for caching and feature flags
     */
    public Mono<QuotaValidationResult> validateCommand(AirConCommand command) {
        if (!command.requiresQuotaValidation()) {
            return Mono.just(QuotaValidationResult.allow("No validation required"));
        }
        
        return featureFlagService.isQuotaEnabledForUser(command.getUserId())
            .flatMap(enabled -> {
                if (!enabled) {
                    return Mono.just(QuotaValidationResult.allow("Quota disabled"));
                }
                return performValidation(command);
            });
    }
    
    private Mono<QuotaValidationResult> performValidation(AirConCommand command) {
        return cacheService.getQuotaBalance(command.getUserId(), command.getRoomId())
            .map(balance -> evaluateCommand(balance, command))
            .switchIfEmpty(Mono.just(QuotaValidationResult.allow("No quota configured")));
    }
    
    private QuotaValidationResult evaluateCommand(QuotaBalance balance, AirConCommand command) {
        if (command.isPowerOffCommand()) {
            return QuotaValidationResult.allow("Power off allowed");
        }
        
        if (balance.isExceeded()) {
            return QuotaValidationResult.block("Daily quota exceeded", balance.getOverageInfo());
        }
        
        if (balance.isNearingLimit()) {
            return QuotaValidationResult.allowWithWarning("Approaching limit", balance.getRemainingTime());
        }
        
        return QuotaValidationResult.allow("Within limits");
    }
}

// ============================================================================
// QUOTA CACHE - Infrastructure Abstraction
// ============================================================================

@Service
@Slf4j
public class QuotaCacheService {
    
    private final CacheService cacheService;
    private final QuotaRepository quotaRepository;
    
    public Mono<QuotaBalance> getQuotaBalance(UUID userId, String roomId) {
        String cacheKey = generateBalanceKey(userId, roomId);
        
        return cacheService.get(cacheKey, QuotaBalance.class)
            .switchIfEmpty(loadBalanceFromDatabase(userId, roomId)
                .doOnNext(balance -> cacheBalance(cacheKey, balance)));
    }
    
    public Mono<Void> invalidateQuotaBalance(UUID userId, String roomId) {
        String cacheKey = generateBalanceKey(userId, roomId);
        return cacheService.evict(cacheKey);
    }
    
    private Mono<QuotaBalance> loadBalanceFromDatabase(UUID userId, String roomId) {
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now())
            .flatMap(this::calculateCurrentBalance);
    }
    
    private void cacheBalance(String key, QuotaBalance balance) {
        cacheService.put(key, balance, Duration.ofHours(1))
            .subscribe(
                result -> log.debug("Cached quota balance: {}", key),
                error -> log.warn("Failed to cache balance: {}", key, error)
            );
    }
}

// ============================================================================
// QUOTA METRICS - Performance Monitoring
// ============================================================================

@Service
@Slf4j
public class QuotaMetricsService {
    
    private final MeterRegistry meterRegistry;
    private final Counter validationCounter;
    private final Timer validationTimer;
    
    public QuotaMetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.validationCounter = Counter.builder("quota.validation.count")
            .description("Number of quota validations performed")
            .register(meterRegistry);
        this.validationTimer = Timer.builder("quota.validation.duration")
            .description("Time taken for quota validation")
            .register(meterRegistry);
    }
    
    public void recordValidation(QuotaValidationResult result, Duration duration) {
        validationCounter.increment(
            Tags.of(
                "result", result.getStatus().toString(),
                "user_type", result.getUserType(),
                "room_type", result.getRoomType()
            )
        );
        
        validationTimer.record(duration);
        
        if (duration.toMillis() > 100) {
            log.warn("Slow quota validation: {}ms for user {} room {}", 
                duration.toMillis(), result.getUserId(), result.getRoomId());
        }
    }
}
```

#### **Usage Service Decomposition**

```java
// ============================================================================
// USAGE SESSION - Session Lifecycle Management
// ============================================================================

@Service
@Slf4j
public class UsageSessionService {
    
    private final UsageSessionRepository sessionRepository;
    private final CacheService cacheService;
    
    public Mono<UsageSession> startSession(UUID userId, String roomId, AirConSettings settings) {
        return sessionRepository.findActiveSession(userId, roomId)
            .flatMap(existingSession -> endSession(existingSession.getId()))
            .then(createNewSession(userId, roomId, settings))
            .doOnNext(session -> cacheActiveSession(userId, roomId, session));
    }
    
    public Mono<UsageSession> endSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
            .filter(session -> session.getStatus() == SessionStatus.ACTIVE)
            .flatMap(this::completeSession)
            .doOnNext(session -> clearSessionCache(session.getUserId(), session.getRoomId()));
    }
}

// ============================================================================
// QUOTA UPDATE - Business Logic for Quota Consumption
// ============================================================================

@Service
@Slf4j
public class QuotaUpdateService {
    
    private final QuotaRepository quotaRepository;
    private final QuotaCacheService cacheService;
    
    public Mono<QuotaBalance> updateUsage(UUID userId, String roomId, Duration usageDuration) {
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now())
            .flatMap(quota -> incrementQuotaUsage(quota, usageDuration))
            .doOnNext(quota -> invalidateCache(userId, roomId))
            .map(this::buildQuotaBalance);
    }
    
    private Mono<Quota> incrementQuotaUsage(Quota quota, Duration usage) {
        BigDecimal additionalHours = BigDecimal.valueOf(usage.toMinutes()).divide(BigDecimal.valueOf(60));
        BigDecimal newUsage = quota.getUsedAmount().add(additionalHours);
        quota.setUsedAmount(newUsage);
        quota.setUpdatedAt(Instant.now());
        
        return quotaRepository.save(quota);
    }
}

// ============================================================================
// USAGE EVENT - Event Publishing and WebSocket Broadcasting
// ============================================================================

@Service
@Slf4j
public class UsageEventService {
    
    private final EventPublisher eventPublisher;
    
    public void publishSessionStarted(UsageSession session) {
        SessionStartedEvent event = new SessionStartedEvent(
            session.getUserId(),
            session.getRoomId(),
            session.getStartedAt(),
            session.getInitialSettings()
        );
        eventPublisher.publish(event);
    }
    
    public void publishQuotaUpdated(QuotaBalance balance) {
        QuotaUpdateEvent event = new QuotaUpdateEvent(
            balance.getQuotaId().toString(),
            balance.getUserId().toString(),
            balance.getRoomId(),
            balance.getCurrentUsageHours(),
            balance.getDailyLimitHours(),
            balance.getStatus(),
            balance.isActive(),
            0.0 // estimated session usage
        );
        eventPublisher.publish(event);
    }
}
```

### **3. Infrastructure Abstraction Design**

#### **Problem Analysis**
- Services depend directly on `ReactiveRedisTemplate`
- Direct coupling to `ApplicationEventPublisher`
- Difficult to test with external dependencies

#### **Solution: Abstraction Layer**

```java
// ============================================================================
// CACHE SERVICE ABSTRACTION
// ============================================================================

public interface CacheService {
    <T> Mono<T> get(String key, Class<T> type);
    <T> Mono<Void> put(String key, T value, Duration ttl);
    Mono<Void> evict(String key);
    Mono<Boolean> exists(String key);
    Mono<Void> evictPattern(String pattern);
}

@Service
@Primary
public class RedisCacheService implements CacheService {
    
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    
    @Override
    public <T> Mono<T> get(String key, Class<T> type) {
        return redisTemplate.opsForValue()
            .get(key)
            .cast(String.class)
            .map(json -> deserialize(json, type))
            .onErrorResume(error -> {
                log.warn("Cache get error for key: {}", key, error);
                return Mono.empty();
            });
    }
    
    @Override
    public <T> Mono<Void> put(String key, T value, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(value);
            return redisTemplate.opsForValue()
                .set(key, json, ttl)
                .then();
        } catch (Exception e) {
            log.warn("Cache put error for key: {}", key, e);
            return Mono.empty(); // Graceful degradation
        }
    }
    
    @Override
    public Mono<Void> evict(String key) {
        return redisTemplate.delete(key).then();
    }
}

// Test implementation for unit testing
@TestComponent
public class InMemoryCacheService implements CacheService {
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    
    // Implementation using in-memory map for testing
}

// ============================================================================
// EVENT PUBLISHER ABSTRACTION
// ============================================================================

public interface EventPublisher {
    void publish(DomainEvent event);
    <T extends DomainEvent> Flux<T> subscribe(Class<T> eventType);
}

@Service
@Primary
public class SpringEventPublisher implements EventPublisher {
    
    private final ApplicationEventPublisher applicationEventPublisher;
    private final ApplicationEventMulticaster eventMulticaster;
    
    @Override
    public void publish(DomainEvent event) {
        applicationEventPublisher.publishEvent(event);
    }
    
    @Override
    public <T extends DomainEvent> Flux<T> subscribe(Class<T> eventType) {
        return Flux.create(sink -> {
            ApplicationListener<T> listener = event -> sink.next(event);
            eventMulticaster.addApplicationListener(listener);
            sink.onDispose(() -> eventMulticaster.removeApplicationListener(listener));
        });
    }
}
```

### **4. Layered Architecture Design**

#### **Problem Analysis**
- Controllers access repositories directly
- Business logic mixed in controllers
- Violation of Controller > Service > Repository pattern

#### **Solution: Proper Layer Separation**

```java
// ============================================================================
// CONTROLLER LAYER - HTTP Request/Response Only
// ============================================================================

@RestController
@RequestMapping("/api/quotas")
@RequiredArgsConstructor
@Slf4j
public class QuotaController {
    
    private final QuotaManagementService quotaManagementService;
    
    @PostMapping
    @RequireParentRole
    public Mono<ResponseEntity<QuotaResponse>> createQuota(@Valid @RequestBody CreateQuotaRequest request) {
        UserInfo currentUser = UserContextHolder.getCurrentUser();
        
        return quotaManagementService.createOrUpdateQuota(request, currentUser.getId())
            .map(quota -> ResponseEntity.ok(QuotaResponse.from(quota)))
            .onErrorResume(QuotaException.class, ex -> 
                Mono.just(ResponseEntity.badRequest().body(QuotaResponse.error(ex.getMessage()))));
    }
    
    @GetMapping("/user/{userId}")
    @RequireAuthentication
    public Mono<ResponseEntity<QuotaBalanceResponse>> getQuotaStatus(
            @PathVariable String userId,
            @RequestParam String roomId) {
        
        UserInfo currentUser = UserContextHolder.getCurrentUser();
        
        return quotaManagementService.getQuotaBalance(UUID.fromString(userId), roomId, currentUser)
            .map(balance -> ResponseEntity.ok(QuotaBalanceResponse.from(balance)))
            .defaultIfEmpty(ResponseEntity.notFound().build());
    }
}

// ============================================================================
// SERVICE LAYER - Business Logic and Orchestration
// ============================================================================

@Service
@RequiredArgsConstructor
@Slf4j
public class QuotaManagementService {
    
    private final QuotaRepository quotaRepository;
    private final UserRepository userRepository;
    private final QuotaCacheService cacheService;
    private final EventPublisher eventPublisher;
    
    public Mono<Quota> createOrUpdateQuota(CreateQuotaRequest request, UUID createdBy) {
        return validateQuotaRequest(request)
            .then(findExistingQuota(request))
            .flatMap(existingQuota -> updateExistingQuota(existingQuota, request))
            .switchIfEmpty(createNewQuota(request, createdBy))
            .doOnNext(quota -> publishQuotaEvent(quota, "CREATED_OR_UPDATED"));
    }
    
    public Mono<QuotaBalance> getQuotaBalance(UUID userId, String roomId, UserInfo requestingUser) {
        return validateAccessPermissions(userId, requestingUser)
            .then(cacheService.getQuotaBalance(userId, roomId));
    }
    
    private Mono<Void> validateQuotaRequest(CreateQuotaRequest request) {
        if (request.getAllowedAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return Mono.error(new QuotaValidationException("Allowed amount must be positive"));
        }
        return Mono.empty();
    }
    
    private Mono<Quota> findExistingQuota(CreateQuotaRequest request) {
        return quotaRepository.findActiveQuotaByUserAndRoom(
            UUID.fromString(request.getUserId()), 
            request.getRoomId(), 
            LocalDate.now()
        );
    }
}

// ============================================================================
// REPOSITORY LAYER - Data Access Only
// ============================================================================

@Repository
public interface QuotaRepository extends ReactiveCrudRepository<Quota, UUID> {
    
    @Query("SELECT q.* FROM quotas q WHERE q.user_id = :userId AND q.room_id = :roomId " +
           "AND q.is_active = true AND (q.end_date IS NULL OR q.end_date >= :currentDate)")
    Mono<Quota> findActiveQuotaByUserAndRoom(
        @Param("userId") UUID userId,
        @Param("roomId") String roomId,
        @Param("currentDate") LocalDate currentDate
    );
    
    // Only data access methods - no business logic
}
```

### **5. Error Handling Standardization**

#### **Problem Analysis**
- Duplicate error handling patterns across services
- Inconsistent error responses
- No centralized exception management

#### **Solution: Centralized Exception Handling**

```java
// ============================================================================
// GLOBAL EXCEPTION HANDLER
// ============================================================================

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(QuotaValidationException.class)
    public ResponseEntity<ErrorResponse> handleQuotaValidation(QuotaValidationException ex) {
        log.warn("Quota validation error: {}", ex.getMessage());
        return ResponseEntity.badRequest()
            .body(ErrorResponse.builder()
                .error("QUOTA_VALIDATION_ERROR")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .build());
    }
    
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication error: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.builder()
                .error("AUTHENTICATION_ERROR")
                .message("Invalid or expired authentication token")
                .timestamp(Instant.now())
                .build());
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.builder()
                .error("INTERNAL_SERVER_ERROR")
                .message("An unexpected error occurred")
                .timestamp(Instant.now())
                .build());
    }
}

// ============================================================================
// STANDARDIZED ERROR RESPONSE
// ============================================================================

@Data
@Builder
public class ErrorResponse {
    private String error;
    private String message;
    private Instant timestamp;
    private Map<String, Object> details;
    
    public static ErrorResponse validation(String field, String message) {
        return ErrorResponse.builder()
            .error("VALIDATION_ERROR")
            .message(message)
            .details(Map.of("field", field))
            .timestamp(Instant.now())
            .build();
    }
}
```

---

## 🔄 Migration Strategy

### **Phase 1: Authentication Centralization**
1. **Create Authentication Aspect** with feature flag
2. **Implement User Context Management** 
3. **Add Authentication Annotations**
4. **Migrate Controllers Gradually** (one at a time)
5. **Remove Duplicated Code** after migration complete

### **Phase 2: Service Decomposition**
1. **Create New Service Interfaces** 
2. **Implement New Services** alongside existing ones
3. **Add Feature Flags** to switch between implementations
4. **Migrate Callers Gradually**
5. **Remove Old Services** after migration complete

### **Phase 3: Infrastructure Abstraction**
1. **Create Abstraction Interfaces**
2. **Implement Abstractions** with current concrete dependencies
3. **Update Services** to use abstractions
4. **Add Test Implementations** for unit testing

### **Phase 4: Layer Enforcement**
1. **Create Service Layer Methods** for controller business logic
2. **Update Controllers** to call services only
3. **Remove Direct Repository Access** from controllers
4. **Add Architecture Tests** to prevent regression

---

## 🧪 Testing Strategy

### **Unit Testing Approach**
```java
// ============================================================================
// SERVICE TESTING WITH MOCKED DEPENDENCIES
// ============================================================================

@ExtendWith(MockitoExtension.class)
class QuotaValidationServiceTest {
    
    @Mock
    private QuotaCacheService cacheService;
    
    @Mock
    private QuotaFeatureFlagService featureFlagService;
    
    @InjectMocks
    private QuotaValidationService quotaValidationService;
    
    @Test
    void shouldAllowCommandWhenQuotaNotExceeded() {
        // Given
        AirConCommand command = createValidCommand();
        QuotaBalance balance = createBalanceWithinLimits();
        
        when(featureFlagService.isQuotaEnabledForUser(any())).thenReturn(Mono.just(true));
        when(cacheService.getQuotaBalance(any(), any())).thenReturn(Mono.just(balance));
        
        // When
        StepVerifier.create(quotaValidationService.validateCommand(command))
            // Then
            .expectNextMatches(result -> result.isAllowed())
            .verifyComplete();
    }
}
```

### **Integration Testing Approach**
```java
@SpringBootTest
@TestMethodOrder(OrderAnnotation.class)
class QuotaManagementIntegrationTest {
    
    @Autowired
    private QuotaManagementService quotaManagementService;
    
    @Autowired
    private TestContainers testContainers;
    
    @Test
    @Order(1)
    void shouldCreateQuotaAndCacheBalance() {
        // Test full flow with real dependencies
    }
}
```

---

## ⚡ Performance Considerations

### **Authentication Aspect Overhead**
- **Target**: <5ms additional latency per request
- **Optimization**: Cache user context during request processing
- **Monitoring**: Track authentication timing with metrics

### **Service Decomposition Impact**  
- **Target**: Maintain <100ms quota validation requirement
- **Optimization**: Use reactive composition to minimize blocking
- **Monitoring**: Compare performance before/after decomposition

### **Cache Abstraction Performance**
- **Target**: No performance degradation from Redis abstraction
- **Optimization**: Direct delegation to Redis operations
- **Monitoring**: Cache hit rates and response times

---

## 🔒 Security Considerations

### **Authentication Aspect Security**
- **Token Validation**: Maintain existing JWT validation logic
- **Thread Safety**: Use ThreadLocal for user context management
- **Access Control**: Support fine-grained role-based permissions

### **Service Boundaries**
- **Data Access**: Services cannot bypass authentication
- **Authorization**: Business logic enforces user permissions
- **Audit Logging**: Track all quota modifications with user context

---

## 📊 Success Metrics

### **Code Quality Metrics**
- **Duplication Reduction**: From 600+ lines to <60 lines (90%)
- **Service Responsibilities**: From 6+ per service to 1-2 per service  
- **Controller Business Logic**: 0% business logic in controllers
- **Test Coverage**: 80%+ for all new services

### **Performance Metrics**
- **Authentication Overhead**: <5ms per request
- **Quota Validation**: Maintain <100ms requirement
- **Cache Performance**: Maintain current Redis performance
- **Memory Usage**: <10% increase due to abstraction layers

### **Maintainability Metrics**
- **Cyclomatic Complexity**: 40% reduction in complex services
- **Dependency Count**: <3 dependencies per service
- **Test Isolation**: 100% unit tests with mocked dependencies
- **Architecture Compliance**: 100% adherence to layered architecture

---

This technical design provides a comprehensive architecture for eliminating clean code violations while maintaining system performance and reliability. The phased approach ensures zero downtime during migration, and the extensive testing strategy validates correctness throughout the refactoring process.