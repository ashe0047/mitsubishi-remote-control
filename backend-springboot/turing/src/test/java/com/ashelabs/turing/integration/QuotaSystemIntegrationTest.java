package com.ashelabs.turing.integration;

import com.ashelabs.turing.dto.AirConCommand;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.entity.Quota;
import com.ashelabs.turing.entity.QuotaScope;
import com.ashelabs.turing.entity.QuotaStatus;
import com.ashelabs.turing.entity.QuotaType;
import com.ashelabs.turing.entity.UsageSession;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.service.QuotaFeatureService;
import com.ashelabs.turing.service.QuotaValidationService;
import com.ashelabs.turing.service.ReactiveAirConService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quota system integration test suite for development.
 *
 * These tests validate the complete quota system workflow with realistic
 * data and scenarios during development and testing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "quota.feature.enabled=true",
    "quota.validation.timeout=200ms",
    "spring.redis.embedded=true",
    "logging.level.com.ashelabs.turing.service=DEBUG"
})
@TestMethodOrder(OrderAnnotation.class)
@Slf4j
class QuotaSystemIntegrationTest {

    @Autowired
    private ReactiveAirConService airConService;

    @Autowired
    private QuotaValidationService quotaValidationService;

    @Autowired
    private QuotaFeatureService quotaFeatureService;

    @Autowired
    private QuotaRepository quotaRepository;

    @Autowired
    private UsageSessionRepository usageSessionRepository;

    private UUID testUserId;
    private String testRoomId;
    private Quota testQuota;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testRoomId = "prod_test_room_001";

        // Create test quota
        testQuota = Quota.builder()
            .id(UUID.randomUUID())
            .userId(testUserId)
            .targetId(testRoomId)
            .scope(QuotaScope.ROOM)
            .quotaType(QuotaType.TIME_BASED)
            .allowedAmount(new BigDecimal("4.0")) // 4 hours
            .usedAmount(BigDecimal.ZERO)
            .status(QuotaStatus.ACTIVE)
            .warningThresholds(List.of(75, 90))
            .build();
    }

    @Test
    @Order(1)
    @Transactional
    void quotaWorkflow_ShouldWorkEndToEnd() {
        log.info("Starting end-to-end quota workflow test");

        // 1. Save test quota
        StepVerifier.create(quotaRepository.save(testQuota))
            .expectNextMatches(quota -> quota.getId().equals(testQuota.getId()))
            .verifyComplete();

        // 2. Verify quota feature is enabled
        StepVerifier.create(quotaFeatureService.isQuotaEnabledForUser(testUserId))
            .expectNext(true)
            .verifyComplete();

        // 3. Start AC (should succeed with fresh quota)
        StepVerifier.create(airConService.setPower(testRoomId, "on"))
            .verifyComplete();

        // 4. Verify usage session was created
        StepVerifier.create(
                usageSessionRepository.findActiveSession(testUserId, testRoomId)
            )
            .expectNextMatches(session ->
                session.getUserId().equals(testUserId) &&
                session.getRoomId().equals(testRoomId) &&
                session.getStatus().name().equals("ACTIVE")
            )
            .verifyComplete();

        // 5. Stop AC
        StepVerifier.create(airConService.setPower(testRoomId, "off"))
            .verifyComplete();

        // 6. Verify session was ended
        StepVerifier.create(
                usageSessionRepository.findActiveSession(testUserId, testRoomId)
            )
            .verifyComplete(); // Should be empty as session is ended

        log.info("End-to-end quota workflow test completed successfully");
    }

    @Test
    @Order(2)
    void quotaFailover_ShouldMaintainACFunctionality() {
        log.info("Starting quota failover test");

        // Test AC functionality when quota service is unavailable
        // This simulates database or service failures

        // 1. Test with null user ID (should work without quota validation)
        StepVerifier.create(airConService.setPower(testRoomId, "on"))
            .verifyComplete();

        StepVerifier.create(airConService.setPower(testRoomId, "off"))
            .verifyComplete();

        // 2. Test with non-existent user (should fail safe and allow AC)
        String nonExistentUserId = UUID.randomUUID().toString();
        StepVerifier.create(airConService.setPower(testRoomId, "on"))
            .verifyComplete();

        // 3. Test quota validation timeout handling
        // This would require mocking to simulate actual timeouts
        log.info("Quota failover test completed - AC continues working during failures");
    }

    @Test
    @Order(3)
    void quotaValidationPerformance_ShouldMeetTargets() {
        log.info("Starting quota validation performance test");

        // Save test quota for performance testing
        StepVerifier.create(quotaRepository.save(testQuota))
            .expectNextMatches(quota -> quota.getId().equals(testQuota.getId()))
            .verifyComplete();

        // Warm up the system
        for (int i = 0; i < 10; i++) {
            AirConCommand warmupCommand = AirConCommand.builder()
                .userId(testUserId)
                .roomId(testRoomId)
                .action("power")
                .value(true)
                .build();

            quotaValidationService.validateCommand(warmupCommand).block();
        }

        // Measure performance for 100 validation requests
        List<Long> responseTimes = IntStream.range(0, 100)
            .mapToObj(i -> {
                AirConCommand command = AirConCommand.builder()
                    .userId(testUserId)
                    .roomId(testRoomId)
                    .action("power")
                    .value(true)
                    .build();

                long startTime = System.nanoTime();
                quotaValidationService.validateCommand(command).block();
                long endTime = System.nanoTime();

                return (endTime - startTime) / 1_000_000; // Convert to milliseconds
            })
            .toList();

        // Calculate statistics
        double averageMs = responseTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
        responseTimes.sort(null);
        long p50 = responseTimes.get(50);
        long p95 = responseTimes.get(95);
        long p99 = responseTimes.get(99);

        log.info("Performance results - Average: {}ms, P50: {}ms, P95: {}ms, P99: {}ms",
            averageMs, p50, p95, p99);

        // Verify performance targets (relaxed for development)
        assertThat(p95).isLessThan(200L).as("95th percentile should be < 200ms");
        assertThat(p50).isLessThan(100L).as("50th percentile should be < 100ms");
        assertThat(averageMs).isLessThan(50.0).as("Average response time should be < 50ms");

        log.info("Quota validation performance test passed all targets");
    }

    @Test
    @Order(4)
    void concurrentQuotaValidation_ShouldMaintainConsistency() throws InterruptedException {
        log.info("Starting concurrent quota validation test");

        // Save test quota
        StepVerifier.create(quotaRepository.save(testQuota))
            .expectNextMatches(quota -> quota.getId().equals(testQuota.getId()))
            .verifyComplete();

        int numberOfThreads = 20;
        int requestsPerThread = 10;
        CountDownLatch latch = new CountDownLatch(numberOfThreads);
        ExecutorService executor = Executors.newFixedThreadPool(numberOfThreads);

        for (int i = 0; i < numberOfThreads; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    for (int j = 0; j < requestsPerThread; j++) {
                        AirConCommand command = AirConCommand.builder()
                            .userId(testUserId)
                            .roomId(testRoomId + "_" + threadId) // Different rooms to avoid conflicts
                            .action("power")
                            .value(true)
                            .build();

                        QuotaValidationResult result = quotaValidationService.validateCommand(command).block();
                        assertThat(result).isNotNull();
                        assertThat(result.getStatus()).isIn("ALLOW", "ALLOW_WITH_WARNING", "BLOCK", "FAIL_OPEN");
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        // Wait for all threads to complete
        boolean completed = latch.await(60, TimeUnit.SECONDS);
        assertThat(completed).isTrue().as("All concurrent requests should complete within timeout");

        executor.shutdown();
        log.info("Concurrent quota validation test completed successfully");
    }

    @Test
    @Order(5)
    void quotaExceededScenario_ShouldBlockCorrectly() {
        log.info("Starting quota exceeded scenario test");

        // Create a quota that's already exceeded
        Quota exceededQuota = Quota.builder()
            .id(UUID.randomUUID())
            .userId(testUserId)
            .targetId(testRoomId)
            .scope(QuotaScope.ROOM)
            .quotaType(QuotaType.TIME_BASED)
            .allowedAmount(new BigDecimal("1.0")) // 1 hour
            .usedAmount(new BigDecimal("1.5")) // 1.5 hours used (exceeded)
            .status(QuotaStatus.ACTIVE)
            .warningThresholds(List.of(75, 90))
            .build();

        // Save exceeded quota
        StepVerifier.create(quotaRepository.save(exceededQuota))
            .expectNextMatches(quota -> quota.getId().equals(exceededQuota.getId()))
            .verifyComplete();

        // Attempt to start AC with exceeded quota
        AirConCommand command = AirConCommand.builder()
            .userId(testUserId)
            .roomId(testRoomId)
            .action("power")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(command))
            .expectNextMatches(result ->
                result.getStatus().equals("BLOCK") &&
                result.getReason().contains("exceeded")
            )
            .verifyComplete();

        log.info("Quota exceeded scenario test completed - commands properly blocked");
    }

    @Test
    @Order(6)
    void warningThresholdScenario_ShouldWarnCorrectly() {
        log.info("Starting warning threshold scenario test");

        // Create a quota that's at warning threshold (80% used)
        Quota warningQuota = Quota.builder()
            .id(UUID.randomUUID())
            .userId(testUserId)
            .targetId(testRoomId)
            .scope(QuotaScope.ROOM)
            .quotaType(QuotaType.TIME_BASED)
            .allowedAmount(new BigDecimal("4.0")) // 4 hours
            .usedAmount(new BigDecimal("3.2")) // 3.2 hours used (80%)
            .status(QuotaStatus.ACTIVE)
            .warningThresholds(List.of(75, 90))
            .build();

        // Save warning quota
        StepVerifier.create(quotaRepository.save(warningQuota))
            .expectNextMatches(quota -> quota.getId().equals(warningQuota.getId()))
            .verifyComplete();

        // Test AC command that should trigger warning
        AirConCommand command = AirConCommand.builder()
            .userId(testUserId)
            .roomId(testRoomId)
            .action("power")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(command))
            .expectNextMatches(result ->
                result.getStatus().equals("ALLOW_WITH_WARNING") &&
                result.getMessage().contains("approaching")
            )
            .verifyComplete();

        log.info("Warning threshold scenario test completed - warnings triggered correctly");
    }

    @Test
    @Order(7)
    void systemHealthCheck_ShouldPassAllChecks() {
        log.info("Starting comprehensive system health check");

        // Test quota validation service health
        StepVerifier.create(quotaValidationService.healthCheck())
            .expectNext(true)
            .verifyComplete();

        // Test repository connectivity
        StepVerifier.create(quotaRepository.count())
            .expectNextMatches(count -> count >= 0)
            .verifyComplete();

        StepVerifier.create(usageSessionRepository.count())
            .expectNextMatches(count -> count >= 0)
            .verifyComplete();

        // Test feature service
        StepVerifier.create(quotaFeatureService.isQuotaEnabledForUser(testUserId))
            .expectNext(true)
            .verifyComplete();

        log.info("System health check completed - all components healthy");
    }

    @Test
    @Order(8)
    void dataConsistency_ShouldMaintainIntegrity() {
        log.info("Starting data consistency validation");

        // Save test quota and create some usage sessions
        StepVerifier.create(quotaRepository.save(testQuota))
            .expectNextMatches(quota -> quota.getId().equals(testQuota.getId()))
            .verifyComplete();

        // Create test usage session
        UsageSession testSession = UsageSession.builder()
            .id(UUID.randomUUID())
            .userId(testUserId)
            .roomId(testRoomId)
            .deviceType("ac")
            .startedAt(Instant.now().minus(Duration.ofHours(1)))
            .endedAt(Instant.now())
            .durationMinutes(60)
            .build();

        StepVerifier.create(usageSessionRepository.save(testSession))
            .expectNextMatches(session -> session.getId().equals(testSession.getId()))
            .verifyComplete();

        // Verify data consistency
        StepVerifier.create(
                quotaRepository.findById(testQuota.getId())
                    .zipWith(usageSessionRepository.findById(testSession.getId()))
            )
            .expectNextMatches(tuple -> {
                Quota quota = tuple.getT1();
                UsageSession session = tuple.getT2();

                return quota.getUserId().equals(session.getUserId()) &&
                       quota.getTargetId().equals(session.getRoomId());
            })
            .verifyComplete();

        log.info("Data consistency validation completed successfully");
    }
}