package com.ashelabs.turing.health;

import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.service.QuotaValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.ReactiveHealthIndicator;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Development health indicator for the quota system.
 *
 * This component provides health information about quota system components
 * for development and testing purposes.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class QuotaHealthIndicator implements ReactiveHealthIndicator {

    private final QuotaValidationService quotaValidationService;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final QuotaRepository quotaRepository;
    private final UsageSessionRepository usageSessionRepository;

    private static final Duration HEALTH_CHECK_TIMEOUT = Duration.ofSeconds(5);

    @Override
    public Mono<Health> health() {
        Health.Builder builder = Health.up();
        return checkQuotaServices()
            .map(healthy -> healthy ? builder.up() : builder.down())
            .map(healthBuilder -> healthBuilder
                .withDetail("timestamp", Instant.now().toString())
                .withDetail("timeout_seconds", HEALTH_CHECK_TIMEOUT.getSeconds())
                .build())
            .onErrorReturn(
                builder.down()
                    .withDetail("error", "Health check failed with exception")
                    .withDetail("timestamp", Instant.now().toString())
                    .build()
            );
    }

    /**
     * Perform comprehensive health checks on quota system components.
     */
    private Mono<Boolean> checkQuotaServices() {
        return Mono.zip(
                checkRedisConnection(),
                checkDatabaseConnection(),
                checkQuotaServiceFunctionality()
            )
            .map(tuple -> {
                boolean redisHealthy = tuple.getT1();
                boolean dbHealthy = tuple.getT2();
                boolean serviceHealthy = tuple.getT3();

                log.debug("Health check results - Redis: {}, DB: {}, Service: {}",
                    redisHealthy, dbHealthy, serviceHealthy);

                return redisHealthy && dbHealthy && serviceHealthy;
            })
            .timeout(HEALTH_CHECK_TIMEOUT)
            .onErrorReturn(false);
    }

    /**
     * Check Redis connectivity and basic operations.
     */
    private Mono<Boolean> checkRedisConnection() {
        String testKey = "health:redis:" + System.currentTimeMillis();

        return redisTemplate.opsForValue()
            .set(testKey, "health-check", Duration.ofSeconds(5))
            .then(redisTemplate.opsForValue().get(testKey))
            .then(redisTemplate.delete(testKey))
            .map(deleted -> {
                log.debug("Redis health check completed successfully");
                return true;
            })
            .onErrorResume(error -> {
                log.warn("Redis health check failed: {}", error.getMessage());
                return Mono.just(false);
            });
    }

    /**
     * Check database connectivity and quota system tables.
     */
    private Mono<Boolean> checkDatabaseConnection() {
        return quotaRepository.count()
            .zipWith(usageSessionRepository.count())
            .map(counts -> {
                Long quotaCount = counts.getT1();
                Long sessionCount = counts.getT2();

                log.debug("Database health check completed - Quotas: {}, Sessions: {}",
                    quotaCount, sessionCount);

                return quotaCount != null && sessionCount != null;
            })
            .onErrorResume(error -> {
                log.warn("Database health check failed: {}", error.getMessage());
                return Mono.just(false);
            });
    }

    /**
     * Check quota service functionality with a lightweight validation test.
     */
    private Mono<Boolean> checkQuotaServiceFunctionality() {
        try {
            // Perform a lightweight validation test that should not fail
            String testUserId = "health-check-user";
            String testRoomId = "health-check-room";

            return quotaValidationService.healthCheck()
                .map(healthy -> {
                    log.debug("Quota service health check completed: {}", healthy);
                    return healthy;
                })
                .onErrorResume(error -> {
                    log.warn("Quota service health check failed: {}", error.getMessage());
                    return Mono.just(false);
                });

        } catch (Exception e) {
            log.warn("Quota service health check exception: {}", e.getMessage());
            return Mono.just(false);
        }
    }
}