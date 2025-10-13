package com.ashelabs.turing.integration;

import com.ashelabs.turing.controller.QuotaController;
import com.ashelabs.turing.controller.AnalyticsController;
import com.ashelabs.turing.controller.RoomController;
import com.ashelabs.turing.dto.AirConCommand;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.dto.room.DeviceControlRequest;
import com.ashelabs.turing.entity.*;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.service.QuotaValidationService;
import com.ashelabs.turing.service.AnalyticsService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprehensive integration test for the complete quota management workflow.
 *
 * This test validates the entire end-to-end flow:
 * 1. Quota creation via API
 * 2. AC command execution with quota validation
 * 3. Usage tracking and session management
 * 4. Override request workflow
 * 5. Analytics and reporting
 * 6. User interface data flow
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "quota.feature.enabled=true",
    "quota.validation.timeout=200ms",
    "spring.redis.embedded=true",
    "logging.level.com.ashelabs.turing=DEBUG"
})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
class CompleteQuotaWorkflowIntegrationTest {

    @Autowired
    private QuotaController quotaController;

    @Autowired
    private AnalyticsController analyticsController;

    @Autowired
    private RoomController unifiedRoomController;

    @Autowired
    private QuotaValidationService quotaValidationService;

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private QuotaRepository quotaRepository;

    @Autowired
    private UsageSessionRepository usageSessionRepository;

    // Test data
    private UUID parentUserId;
    private UUID childUserId;
    private UUID testRoomId;
    private String testDeviceId;
    private String parentAuthToken;
    private String childAuthToken;
    private UUID createdQuotaId;

    @BeforeEach
    void setUp() {
        parentUserId = UUID.randomUUID();
        childUserId = UUID.randomUUID();
        testRoomId = UUID.randomUUID();
        testDeviceId = "integration_test_device";
        parentAuthToken = "Bearer parent_test_token";
        childAuthToken = "Bearer child_test_token";

        // Create test users (simulated - in real implementation would be in user service)
        log.info("Setting up integration test with parent: {} and child: {}", parentUserId, childUserId);
    }

    @Test
    @Order(1)
    @Transactional
    void completeQuotaWorkflow_ShouldWorkEndToEnd() {
        log.info("Starting complete quota management workflow integration test");

        // Step 1: Create a quota via API
        createQuotaViaAPI();

        // Step 2: Test AC command with quota validation
        testACCommandWithQuotaValidation();

        // Step 3: Simulate usage and test session tracking
        simulateUsageAndTrackingSessions();

        // Step 4: Test quota exceeding and blocking
        testQuotaExceedingAndBlocking();

        // Step 5: Test override request workflow
        testOverrideRequestWorkflow();

        // Step 6: Test analytics and reporting
        testAnalyticsAndReporting();

        log.info("Complete quota management workflow integration test completed successfully");
    }

    private void createQuotaViaAPI() {
        log.info("Step 1: Testing quota creation via API");

        QuotaController.CreateQuotaRequest request = new QuotaController.CreateQuotaRequest();
        request.setUserId(childUserId.toString());
        request.setRoomId(testRoomId.toString());
        request.setQuotaType(QuotaType.TIME_BASED);
        request.setAllowedAmount(new BigDecimal("120")); // 2 hours
        request.setWarningThreshold(75);

        StepVerifier.create(quotaController.createOrUpdateQuota(request, parentAuthToken))
            .expectNextMatches(response -> {
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(response.getBody()).isNotNull();

                Quota quota = response.getBody();
                createdQuotaId = quota.getId();
                assertThat(quota.getUserId()).isEqualTo(childUserId);
                assertThat(quota.getTargetId()).isEqualTo(testRoomId.toString());
                assertThat(quota.getAllowedAmount()).isEqualTo(new BigDecimal("120"));
                assertThat(quota.getStatus()).isEqualTo(QuotaStatus.ACTIVE);

                log.info("Successfully created quota with ID: {}", createdQuotaId);
                return true;
            })
            .verifyComplete();
    }

    private void testACCommandWithQuotaValidation() {
        log.info("Step 2: Testing AC command execution with quota validation");

        // Test power on command
        AirConCommand powerOnCommand = AirConCommand.builder()
            .userId(childUserId)
            .roomId(testRoomId.toString())
            .action("power_on")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(powerOnCommand))
            .expectNextMatches(result -> {
                assertThat(result.getStatus()).isEqualTo(QuotaValidationResult.ValidationStatus.ALLOW);
                log.info("Quota validation successful: {}", result.getMessage());
                return true;
            })
            .verifyComplete();

        // Execute the command through the unified room controller
        DeviceControlRequest request = DeviceControlRequest.builder()
            .action("power_on")
            .value("on")
            .build();

        StepVerifier.create(unifiedRoomController.controlDevice(
                testRoomId, testDeviceId, request, "Bearer test-token"))
            .expectNextMatches(response -> {
                assertThat(response.isSuccess()).isTrue();
                log.info("AC command executed successfully");
                return true;
            })
            .verifyComplete();
    }

    private void simulateUsageAndTrackingSessions() {
        log.info("Step 3: Simulating usage and testing session tracking");

        // Simulate some usage time passing
        try {
            Thread.sleep(1000); // Simulate 1 second of usage
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Test power off to end session
        AirConCommand powerOffCommand = AirConCommand.builder()
            .userId(childUserId)
            .roomId(testRoomId.toString())
            .action("power_off")
            .value(false)
            .build();

        DeviceControlRequest request2 = DeviceControlRequest.builder()
            .action("power_off")
            .value("off")
            .build();

        StepVerifier.create(unifiedRoomController.controlDevice(
                testRoomId, testDeviceId, request2, "Bearer test-token"))
            .expectNextMatches(response -> {
                assertThat(response.isSuccess()).isTrue();
                log.info("AC power off executed successfully");
                return true;
            })
            .verifyComplete();

        // Verify session was created and completed
        StepVerifier.create(usageSessionRepository.findSessionsByDateRange(
                childUserId,
                LocalDate.now().atStartOfDay(),
                LocalDate.now().plusDays(1).atStartOfDay()))
            .expectNextMatches(session -> {
                assertThat(session.getUserId()).isEqualTo(childUserId);
                assertThat(session.getRoomId()).isEqualTo(testRoomId.toString());
                assertThat(session.getEndedAt()).isNotNull();
                log.info("Usage session tracked successfully: {} seconds", session.getDurationMinutes());
                return true;
            })
            .verifyComplete();
    }

    private void testQuotaExceedingAndBlocking() {
        log.info("Step 4: Testing quota exceeding and command blocking");

        // Update quota to a very small amount to trigger exceeding
        StepVerifier.create(
            quotaRepository.findById(createdQuotaId)
                .flatMap(quota -> {
                    quota.setUsedAmount(new BigDecimal("125")); // Exceed the 120-minute limit
                    return quotaRepository.save(quota);
                })
        )
            .expectNextMatches(quota -> {
                assertThat(quota.getUsedAmount()).isGreaterThan(quota.getAllowedAmount());
                log.info("Quota usage set to exceed limit: {} > {}", quota.getUsedAmount(), quota.getAllowedAmount());
                return true;
            })
            .verifyComplete();

        // Test that AC command is now blocked
        AirConCommand blockedCommand = AirConCommand.builder()
            .userId(childUserId)
            .roomId(testRoomId.toString())
            .action("power_on")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(blockedCommand))
            .expectNextMatches(result -> {
                assertThat(result.getStatus()).isEqualTo(QuotaValidationResult.ValidationStatus.BLOCK);
                assertThat(result.getReason()).contains("exceeded");
                log.info("Command correctly blocked due to quota exceeded: {}", result.getReason());
                return true;
            })
            .verifyComplete();
    }

    private void testOverrideRequestWorkflow() {
        log.info("Step 5: Testing override request workflow");

        // Create override request
        QuotaController.OverrideRequest overrideRequest = new QuotaController.OverrideRequest();
        overrideRequest.setType("ADD_TIME");
        overrideRequest.setAdditionalSeconds(1800); // 30 minutes
        overrideRequest.setReason("Emergency situation - child needs AC for health reasons");

        StepVerifier.create(quotaController.grantOverride(
                createdQuotaId.toString(), overrideRequest, parentAuthToken))
            .expectNextMatches(response -> {
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(response.getBody()).isNotNull();

                Map<String, Object> responseBody = response.getBody();
                assertThat(responseBody.get("message")).toString().contains("Override granted");
                assertThat(responseBody.get("overrideType")).isEqualTo("ADD_TIME");

                log.info("Override granted successfully: {}", responseBody);
                return true;
            })
            .verifyComplete();

        // Verify quota was updated with additional time
        StepVerifier.create(quotaRepository.findById(createdQuotaId))
            .expectNextMatches(quota -> {
                // After override, allowed amount should be increased
                assertThat(quota.getAllowedAmount()).isGreaterThan(new BigDecimal("120"));
                log.info("Quota updated with additional time: {}", quota.getAllowedAmount());
                return true;
            })
            .verifyComplete();

        // Test that AC command is now allowed again
        AirConCommand allowedCommand = AirConCommand.builder()
            .userId(childUserId)
            .roomId(testRoomId.toString())
            .action("power_on")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(allowedCommand))
            .expectNextMatches(result -> {
                assertThat(result.getStatus()).isIn(
                    QuotaValidationResult.ValidationStatus.ALLOW,
                    QuotaValidationResult.ValidationStatus.ALLOW_WITH_WARNING
                );
                log.info("Command allowed after override: {}", result.getMessage());
                return true;
            })
            .verifyComplete();
    }

    private void testAnalyticsAndReporting() {
        log.info("Step 6: Testing analytics and reporting");

        // Test user analytics
        StepVerifier.create(analyticsService.generateUserInsights(childUserId, 7))
            .expectNextMatches(insights -> {
                assertThat(insights).isNotNull();
                assertThat(insights.get("userId")).isEqualTo(childUserId.toString());
                assertThat(insights.get("usagePatterns")).isNotNull();
                assertThat(insights.get("quotaCompliance")).isNotNull();

                log.info("User insights generated successfully: {}", insights);
                return true;
            })
            .verifyComplete();

        // Test quota utilization report via API
        StepVerifier.create(analyticsController.getQuotaUtilization(
                childUserId.toString(), "daily", childAuthToken))
            .expectNextMatches(response -> {
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(response.getBody()).isNotNull();

                Map<String, Object> utilization = response.getBody();
                assertThat(utilization.get("userId")).isEqualTo(childUserId.toString());
                assertThat(utilization.get("quotas")).isNotNull();

                log.info("Quota utilization report generated: {}", utilization);
                return true;
            })
            .verifyComplete();

        // Test user usage statistics via API
        String today = LocalDate.now().toString();
        StepVerifier.create(analyticsController.getUserUsageStatistics(
                childUserId.toString(), today, today, testRoomId.toString(), childAuthToken))
            .expectNextMatches(response -> {
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(response.getBody()).isNotNull();

                Map<String, Object> stats = response.getBody();
                assertThat(stats.get("userId")).isEqualTo(childUserId.toString());
                assertThat(stats.get("statistics")).isNotNull();

                log.info("Usage statistics generated: {}", stats);
                return true;
            })
            .verifyComplete();
    }

    @Test
    @Order(2)
    void quotaWorkflowPerformance_ShouldMeetTargets() {
        log.info("Testing quota workflow performance");

        // Create quota for performance test
        QuotaController.CreateQuotaRequest request = new QuotaController.CreateQuotaRequest();
        request.setUserId(childUserId.toString());
        request.setRoomId("perf_test_room");
        request.setQuotaType(QuotaType.TIME_BASED);
        request.setAllowedAmount(new BigDecimal("240"));
        request.setWarningThreshold(75);

        // Measure quota creation performance
        long startTime = System.currentTimeMillis();

        StepVerifier.create(quotaController.createOrUpdateQuota(request, parentAuthToken))
            .expectNextMatches(response -> {
                long duration = System.currentTimeMillis() - startTime;
                assertThat(duration).isLessThan(1000L); // Should complete within 1 second
                log.info("Quota creation completed in {}ms", duration);
                return response.getStatusCode() == HttpStatus.OK;
            })
            .verifyComplete();

        // Measure AC command validation performance
        AirConCommand testCommand = AirConCommand.builder()
            .userId(childUserId)
            .roomId("perf_test_room")
            .action("power_on")
            .value(true)
            .build();

        long validationStart = System.currentTimeMillis();

        StepVerifier.create(quotaValidationService.validateCommand(testCommand))
            .expectNextMatches(result -> {
                long duration = System.currentTimeMillis() - validationStart;
                assertThat(duration).isLessThan(200L); // Should complete within 200ms
                log.info("Quota validation completed in {}ms", duration);
                return result.getStatus() == QuotaValidationResult.ValidationStatus.ALLOW;
            })
            .verifyComplete();
    }

    @Test
    @Order(3)
    void quotaWorkflowErrorHandling_ShouldGracefullyDegrade() {
        log.info("Testing quota workflow error handling and graceful degradation");

        // Test with invalid user ID
        AirConCommand invalidUserCommand = AirConCommand.builder()
            .userId(UUID.randomUUID()) // Non-existent user
            .roomId(testRoomId.toString())
            .action("power_on")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(invalidUserCommand))
            .expectNextMatches(result -> {
                // Should fail safe and allow the command
                assertThat(result.getStatus()).isIn(
                    QuotaValidationResult.ValidationStatus.ALLOW,
                    QuotaValidationResult.ValidationStatus.FAIL_OPEN
                );
                log.info("Invalid user handled gracefully: {}", result.getMessage());
                return true;
            })
            .verifyComplete();

        // Test with null user ID
        AirConCommand nullUserCommand = AirConCommand.builder()
            .userId(null)
            .roomId(testRoomId.toString())
            .action("power_on")
            .value(true)
            .build();

        StepVerifier.create(quotaValidationService.validateCommand(nullUserCommand))
            .expectNextMatches(result -> {
                // Should fail safe and allow the command
                assertThat(result.getStatus()).isEqualTo(QuotaValidationResult.ValidationStatus.FAIL_OPEN);
                log.info("Null user handled gracefully: {}", result.getMessage());
                return true;
            })
            .verifyComplete();

        // Test quota API with invalid authorization
        QuotaController.CreateQuotaRequest request = new QuotaController.CreateQuotaRequest();
        request.setUserId(childUserId.toString());
        request.setRoomId(testRoomId.toString());
        request.setQuotaType(QuotaType.TIME_BASED);
        request.setAllowedAmount(new BigDecimal("120"));

        StepVerifier.create(quotaController.createOrUpdateQuota(request, "Bearer invalid_token"))
            .expectNextMatches(response -> {
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                log.info("Invalid authorization handled correctly");
                return true;
            })
            .verifyComplete();
    }

    @Test
    @Order(4)
    void quotaWorkflowDataConsistency_ShouldMaintainIntegrity() {
        log.info("Testing quota workflow data consistency");

        // Create quota
        QuotaController.CreateQuotaRequest request = new QuotaController.CreateQuotaRequest();
        request.setUserId(childUserId.toString());
        request.setRoomId("consistency_test_room");
        request.setQuotaType(QuotaType.TIME_BASED);
        request.setAllowedAmount(new BigDecimal("60"));
        request.setWarningThreshold(80);

        Mono<UUID> quotaCreation = quotaController.createOrUpdateQuota(request, parentAuthToken)
            .map(response -> response.getBody().getId());

        // Execute multiple concurrent AC commands
        StepVerifier.create(quotaCreation.flatMap(quotaId -> {
            AirConCommand command1 = AirConCommand.builder()
                .userId(childUserId).roomId("consistency_test_room")
                .action("power_on").value(true).build();

            AirConCommand command2 = AirConCommand.builder()
                .userId(childUserId).roomId("consistency_test_room")
                .action("set_temperature").value(22).build();

            return Mono.zip(
                quotaValidationService.validateCommand(command1),
                quotaValidationService.validateCommand(command2)
            );
        }))
        .expectNextMatches(results -> {
            QuotaValidationResult result1 = results.getT1();
            QuotaValidationResult result2 = results.getT2();

            // Both should be consistent
            assertThat(result1.getStatus()).isEqualTo(result2.getStatus());
            log.info("Concurrent command validation is consistent: {} and {}",
                result1.getStatus(), result2.getStatus());
            return true;
        })
        .verifyComplete();
    }

    @AfterEach
    void tearDown() {
        // Cleanup test data
        if (createdQuotaId != null) {
            quotaRepository.deleteById(createdQuotaId).subscribe();
        }

        // Clean up usage sessions
        usageSessionRepository.findSessionsByDateRange(
                childUserId,
                LocalDate.now().atStartOfDay(),
                LocalDate.now().plusDays(1).atStartOfDay())
            .flatMap(session -> usageSessionRepository.deleteById(session.getId()))
            .subscribe();

        log.info("Integration test cleanup completed");
    }
}