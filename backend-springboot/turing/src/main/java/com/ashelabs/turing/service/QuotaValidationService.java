package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConCommand;
import com.ashelabs.turing.dto.QuotaBalance;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.entity.Quota;
import com.ashelabs.turing.entity.QuotaType;
import com.ashelabs.turing.entity.QuotaStatus;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.repository.UsageSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

/**
 * Service for validating AC commands against user quotas.
 * 
 * This service provides high-performance quota validation with Redis caching,
 * fail-safe operation, and comprehensive quota management capabilities.
 * 
 * Performance target: <100ms response time for quota validation
 */
@Service
@Slf4j
public class QuotaValidationService {
    
    private final QuotaRepository quotaRepository;
    private final UsageSessionRepository usageSessionRepository;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final QuotaFeatureService featureService;
    
    // Performance and caching configuration
    private static final Duration VALIDATION_TIMEOUT = Duration.ofMillis(100);
    private static final Duration CACHE_TTL = Duration.ofHours(1);
    private static final Duration SHORT_CACHE_TTL = Duration.ofMinutes(5);
    
    // Cache key prefixes
    private static final String QUOTA_BALANCE_KEY_PREFIX = "quota:balance:";
    private static final String QUOTA_CONFIG_KEY_PREFIX = "quota:config:";
    private static final String USER_SESSIONS_KEY_PREFIX = "quota:sessions:";
    
    @Autowired
    public QuotaValidationService(
            QuotaRepository quotaRepository,
            UsageSessionRepository usageSessionRepository,
            ReactiveRedisTemplate<String, Object> redisTemplate,
            QuotaFeatureService featureService) {
        this.quotaRepository = quotaRepository;
        this.usageSessionRepository = usageSessionRepository;
        this.redisTemplate = redisTemplate;
        this.featureService = featureService;
    }
    
    /**
     * Validates if a command would exceed user's quota.
     * 
     * This is the main entry point for quota validation with performance optimization
     * and fail-safe behavior.
     * 
     * @param command the AC command to validate
     * @return validation result indicating if command should be allowed
     */
    public Mono<QuotaValidationResult> validateCommand(AirConCommand command) {
        if (command.getUserId() == null) {
            log.debug("No user ID provided for command validation");
            return Mono.just(QuotaValidationResult.allow("No user context"));
        }
        
        return validateCommand(command.getUserId(), command.getRoomId(), command);
    }
    
    /**
     * Validates if a command would exceed user's quota for a specific room.
     * 
     * Performance target: <100ms response time
     * 
     * @param userId ID of the user issuing the command
     * @param roomId room where command is executed
     * @param command the AC command to validate
     * @return validation result indicating if command should be allowed
     */
    public Mono<QuotaValidationResult> validateCommand(
            UUID userId, 
            String roomId, 
            AirConCommand command) {
        
        long startTime = System.currentTimeMillis();
        
        // Skip validation if command doesn't require it
        if (!command.requiresQuotaValidation()) {
            return Mono.just(QuotaValidationResult.allow("Command does not require quota validation")
                .withDuration(System.currentTimeMillis() - startTime));
        }
        
        // Skip validation if quota feature is disabled for this user
        return featureService.isQuotaEnabledForUser(userId)
            .flatMap(enabled -> {
                if (!enabled) {
                    return Mono.just(QuotaValidationResult.allow("Quota feature disabled")
                        .withDuration(System.currentTimeMillis() - startTime));
                }
                return performValidation(userId, roomId, command, startTime);
            })
            .timeout(VALIDATION_TIMEOUT)
            .onErrorResume(throwable -> handleValidationError(throwable, userId, roomId, startTime))
            .doOnNext(result -> recordValidationMetrics(userId, roomId, result));
    }
    
    /**
     * Gets the current quota balance for a user in a specific room.
     * 
     * @param userId ID of the user
     * @param roomId room ID
     * @return current quota balance with usage information
     */
    public Mono<QuotaBalance> getCurrentQuotaBalance(UUID userId, String roomId) {
        String cacheKey = balanceKey(userId, roomId);
        
        return redisTemplate.opsForValue().get(cacheKey)
            .cast(QuotaBalance.class)
            .doOnNext(balance -> log.debug("Cache hit for balance: {}", cacheKey))
            .switchIfEmpty(loadBalanceFromDatabase(userId, roomId)
                .doOnNext(balance -> cacheBalance(cacheKey, balance))
                .doOnNext(balance -> log.debug("Cache miss, loaded from database: {}", cacheKey)))
            .onErrorResume(error -> {
                log.warn("Error getting quota balance for user {} room {}, returning empty", 
                    userId, roomId, error);
                return Mono.empty();
            });
    }
    
    /**
     * Invalidates cached quota balance for a user/room combination.
     * Should be called when quota usage is updated.
     *
     * @param userId ID of the user
     * @param roomId room ID
     * @return completion signal
     */
    public Mono<Void> invalidateQuotaBalance(UUID userId, String roomId) {
        String cacheKey = balanceKey(userId, roomId);
        return redisTemplate.delete(cacheKey)
            .doOnNext(deleted -> log.debug("Invalidated {} cache entries for: {}", deleted, cacheKey))
            .then();
    }

    /**
     * Health check method for quota validation service.
     * Performs a lightweight check to verify service functionality.
     *
     * @return true if service is healthy, false otherwise
     */
    public Mono<Boolean> healthCheck() {
        try {
            // Perform a simple quota repository count to verify database connectivity
            return quotaRepository.count()
                .map(count -> {
                    log.debug("Quota service health check passed, found {} quotas", count);
                    return true;
                })
                .timeout(Duration.ofSeconds(2))
                .onErrorResume(error -> {
                    log.warn("Quota service health check failed: {}", error.getMessage());
                    return Mono.just(false);
                });
        } catch (Exception e) {
            log.warn("Quota service health check exception: {}", e.getMessage());
            return Mono.just(false);
        }
    }
    
    // Private methods for implementation details
    
    private Mono<QuotaValidationResult> performValidation(
            UUID userId, 
            String roomId, 
            AirConCommand command,
            long startTime) {
        
        return getCurrentQuotaBalance(userId, roomId)
            .map(balance -> evaluateCommand(balance, command))
            .switchIfEmpty(Mono.just(QuotaValidationResult.allow("No quota configured")))
            .map(result -> result.withDuration(System.currentTimeMillis() - startTime));
    }
    
    private Mono<QuotaBalance> loadBalanceFromDatabase(UUID userId, String roomId) {
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, LocalDate.now())
            .flatMap(quota -> calculateCurrentBalance(quota))
            .switchIfEmpty(Mono.empty());
    }
    
    private Mono<QuotaBalance> calculateCurrentBalance(Quota quota) {
        UUID userId = quota.getUserId();
        String roomId = quota.getTargetId(); // Room ID is stored in targetId field
        LocalDate today = LocalDate.now();
        
        return usageSessionRepository.calculateDailyUsage(userId, today)
            .map(dailyUsage -> buildQuotaBalance(quota, dailyUsage))
            .defaultIfEmpty(buildQuotaBalance(quota, 0L));
    }
    
    private QuotaBalance buildQuotaBalance(Quota quota, Long dailyUsage) {
        QuotaBalance.QuotaBalanceBuilder builder = QuotaBalance.builder()
            .quotaId(quota.getId())
            .userId(quota.getUserId())
            .roomId(quota.getTargetId())
            .warningThreshold(quota.getWarningThresholds() != null && !quota.getWarningThresholds().isEmpty() 
                ? quota.getWarningThresholds().get(0) : 75) // Use first warning threshold or default to 75%
            .isActive(quota.getStatus() == QuotaStatus.ACTIVE)
            .lastUpdated(java.time.Instant.now());
        
        // Build balance based on quota type
        BigDecimal allowedAmount = quota.getAllowedAmount();
        BigDecimal usedAmount = quota.getUsedAmount();
        
        switch (quota.getQuotaType()) {
            case TIME_BASED:
                // Convert BigDecimal hours to seconds
                int totalSeconds = allowedAmount.multiply(new BigDecimal(3600)).intValue();
                int usedSeconds = usedAmount.multiply(new BigDecimal(3600)).intValue();
                int remainingSeconds = Math.max(0, totalSeconds - usedSeconds);
                
                builder
                    .totalSeconds(totalSeconds)
                    .usedSeconds(usedSeconds)
                    .remainingSeconds(remainingSeconds)
                    .isExceeded(remainingSeconds <= 0);
                break;
                
            case USAGE_COUNT:
                int totalCount = allowedAmount.intValue();
                int usedCount = usedAmount.intValue();
                int remainingCount = Math.max(0, totalCount - usedCount);
                
                builder
                    .totalUsageCount(totalCount)
                    .usedUsageCount(usedCount)
                    .remainingUsageCount(remainingCount)
                    .isExceeded(remainingCount <= 0);
                break;
                
            case ENERGY_BASED:
                BigDecimal totalEnergy = allowedAmount;
                BigDecimal usedEnergy = usedAmount;
                BigDecimal remainingEnergy = totalEnergy.subtract(usedEnergy).max(BigDecimal.ZERO);
                
                builder
                    .totalEnergyKwh(totalEnergy)
                    .usedEnergyKwh(usedEnergy)
                    .remainingEnergyKwh(remainingEnergy)
                    .isExceeded(remainingEnergy.compareTo(BigDecimal.ZERO) <= 0);
                break;
                
            case COST_BASED:
                BigDecimal totalCost = allowedAmount;
                BigDecimal usedCost = usedAmount;
                BigDecimal remainingCost = totalCost.subtract(usedCost).max(BigDecimal.ZERO);
                
                builder
                    .totalCostAmount(totalCost)
                    .usedCostAmount(usedCost)
                    .remainingCostAmount(remainingCost)
                    .isExceeded(remainingCost.compareTo(BigDecimal.ZERO) <= 0);
                break;
        }
        
        return builder.build();
    }
    
    private QuotaValidationResult evaluateCommand(QuotaBalance balance, AirConCommand command) {
        // If turning AC off, always allow
        if (command.isPowerOffCommand()) {
            return QuotaValidationResult.allow("Power off command")
                .withContext("action", "power_off");
        }
        
        // Check if any quota type is exceeded
        if (balance.isAnyQuotaExceeded()) {
            String message = buildExceededMessage(balance);
            return QuotaValidationResult.block(message, "Quota exceeded")
                .withContext("usage_percentage", balance.getMaxUsagePercentage());
        }
        
        // Check if approaching warning threshold
        if (balance.isAtWarningThreshold()) {
            String message = buildWarningMessage(balance);
            return QuotaValidationResult.allowWithWarning(message, "Approaching quota limit")
                .withContext("usage_percentage", balance.getMaxUsagePercentage())
                .withContext("remaining_time", balance.getFormattedRemainingTime());
        }
        
        return QuotaValidationResult.allow("Within quota limits")
            .withContext("usage_percentage", balance.getMaxUsagePercentage())
            .withContext("remaining_time", balance.getFormattedRemainingTime());
    }
    
    private String buildExceededMessage(QuotaBalance balance) {
        if (balance.isTimeQuotaExceeded()) {
            return "Daily AC time limit exceeded. No time remaining today.";
        } else if (balance.isCountQuotaExceeded()) {
            return "Daily AC usage limit exceeded. No uses remaining today.";
        } else if (balance.isEnergyQuotaExceeded()) {
            return "Daily energy budget exceeded. No energy allowance remaining today.";
        } else if (balance.isCostQuotaExceeded()) {
            return "Daily cost budget exceeded. No cost allowance remaining today.";
        }
        return "Daily quota limit exceeded.";
    }
    
    private String buildWarningMessage(QuotaBalance balance) {
        StringBuilder message = new StringBuilder("AC usage approaching daily limit. ");
        
        if (balance.getRemainingSeconds() != null && balance.getRemainingSeconds() > 0) {
            message.append(balance.getFormattedRemainingTime()).append(" remaining today.");
        } else if (balance.getRemainingUsageCount() != null && balance.getRemainingUsageCount() > 0) {
            message.append(balance.getRemainingUsageCount()).append(" uses remaining today.");
        } else {
            message.append("Please monitor your usage.");
        }
        
        return message.toString();
    }
    
    private Mono<QuotaValidationResult> handleValidationError(
            Throwable error, 
            UUID userId, 
            String roomId, 
            long startTime) {
        
        if (error instanceof TimeoutException) {
            log.warn("Quota validation timeout for user {} room {}, failing open", userId, roomId);
            return Mono.just(QuotaValidationResult.failOpen("Validation timeout")
                .withDuration(System.currentTimeMillis() - startTime));
        }
        
        log.error("Quota validation error for user {} room {}, failing open", userId, roomId, error);
        return Mono.just(QuotaValidationResult.failOpen("Service error: " + error.getMessage())
            .withDuration(System.currentTimeMillis() - startTime));
    }
    
    private void cacheBalance(String key, QuotaBalance balance) {
        redisTemplate.opsForValue()
            .set(key, balance.snapshot(), CACHE_TTL)
            .subscribe(
                result -> log.debug("Cached quota balance: {}", key),
                error -> log.warn("Failed to cache quota balance: {}", key, error)
            );
    }
    
    private void recordValidationMetrics(UUID userId, String roomId, QuotaValidationResult result) {
        // TODO: Implement metrics recording for monitoring
        // This will be integrated with Micrometer metrics
        log.debug("Quota validation completed for user {} room {} in {}ms: {}", 
            userId, roomId, result.getValidationDurationMs(), result.getStatus());
    }
    
    // Cache key generation helpers
    
    private String balanceKey(UUID userId, String roomId) {
        return QUOTA_BALANCE_KEY_PREFIX + userId + ":" + roomId;
    }
    
    private String configKey(UUID userId) {
        return QUOTA_CONFIG_KEY_PREFIX + userId;
    }
    
    private String sessionsKey(UUID userId, String roomId) {
        return USER_SESSIONS_KEY_PREFIX + userId + ":" + roomId;
    }
}