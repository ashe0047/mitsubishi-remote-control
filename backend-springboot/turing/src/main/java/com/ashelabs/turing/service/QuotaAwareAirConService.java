package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConCommand;
import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.dto.RoomInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

/**
 * Service that wraps ReactiveAirConService with quota validation.
 *
 * This service provides quota-aware AC control methods that validate commands
 * against user quotas before executing them through the existing MQTT infrastructure.
 *
 * Design Pattern: Decorator Pattern - adds quota behavior to existing service without modification.
 */
@Slf4j
@Service
public class QuotaAwareAirConService {

    private final ReactiveAirConService reactiveAirConService;
    private final QuotaValidationService quotaValidationService;
    private final QuotaFeatureService quotaFeatureService;

    @Autowired
    public QuotaAwareAirConService(
            ReactiveAirConService reactiveAirConService,
            QuotaValidationService quotaValidationService,
            QuotaFeatureService quotaFeatureService) {
        this.reactiveAirConService = reactiveAirConService;
        this.quotaValidationService = quotaValidationService;
        this.quotaFeatureService = quotaFeatureService;
    }

    // Read-only methods - pass through without quota validation

    /**
     * Get all rooms - no quota validation needed for read operations
     */
    public Mono<List<RoomInfo>> getRooms() {
        return reactiveAirConService.getRooms();
    }

    /**
     * Get room state - no quota validation needed for read operations
     */
    public Mono<AirConState> getRoomState(String roomId) {
        return reactiveAirConService.getRoomState(roomId);
    }

    /**
     * Get room settings - no quota validation needed for read operations
     */
    public Mono<AirConSettings> getRoomSettings(String roomId) {
        return reactiveAirConService.getRoomSettings(roomId);
    }

    /**
     * Get state stream - no quota validation needed for read operations
     */
    public Flux<AirConState> getStateStream(String roomId) {
        return reactiveAirConService.getStateStream(roomId);
    }

    /**
     * Get settings stream - no quota validation needed for read operations
     */
    public Flux<AirConSettings> getSettingsStream(String roomId) {
        return reactiveAirConService.getSettingsStream(roomId);
    }

    /**
     * Get all state updates stream - no quota validation needed for read operations
     */
    public Flux<ReactiveAirConService.RoomStateUpdate> getAllStateUpdates() {
        return reactiveAirConService.getAllStateUpdates();
    }

    /**
     * Get all settings updates stream - no quota validation needed for read operations
     */
    public Flux<ReactiveAirConService.RoomSettingsUpdate> getAllSettingsUpdates() {
        return reactiveAirConService.getAllSettingsUpdates();
    }

    /**
     * Check MQTT connection - no quota validation needed
     */
    public Mono<Boolean> isMqttConnected() {
        return reactiveAirConService.isMqttConnected();
    }

    // Command methods - require quota validation

    /**
     * Set power with quota validation
     */
    public Mono<Void> setPower(UUID userId, String roomId, String power) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("power")
            .value(power)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setPower(roomId, power));
    }

    /**
     * Set power without user context (existing API compatibility)
     *
     * This method provides backward compatibility for existing callers that don't
     * have user context. Quota validation is skipped in this case.
     */
    public Mono<Void> setPower(String roomId, String power) {
        log.debug("Setting power for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setPower(roomId, power);
    }

    /**
     * Set temperature with quota validation
     */
    public Mono<Void> setTemperature(UUID userId, String roomId, int temperature) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("temperature")
            .value(temperature)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setTemperature(roomId, temperature));
    }

    /**
     * Set temperature without user context (existing API compatibility)
     */
    public Mono<Void> setTemperature(String roomId, int temperature) {
        log.debug("Setting temperature for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setTemperature(roomId, temperature);
    }

    /**
     * Set mode with quota validation
     */
    public Mono<Void> setMode(UUID userId, String roomId, String mode) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("mode")
            .value(mode)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setMode(roomId, mode));
    }

    /**
     * Set mode without user context (existing API compatibility)
     */
    public Mono<Void> setMode(String roomId, String mode) {
        log.debug("Setting mode for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setMode(roomId, mode);
    }

    /**
     * Set fan speed with quota validation
     */
    public Mono<Void> setFan(UUID userId, String roomId, String fan) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("fan")
            .value(fan)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setFan(roomId, fan));
    }

    /**
     * Set fan speed without user context (existing API compatibility)
     */
    public Mono<Void> setFan(String roomId, String fan) {
        log.debug("Setting fan for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setFan(roomId, fan);
    }

    /**
     * Set vane position with quota validation
     */
    public Mono<Void> setVane(UUID userId, String roomId, String vane) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("vane")
            .value(vane)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setVane(roomId, vane));
    }

    /**
     * Set vane position without user context (existing API compatibility)
     */
    public Mono<Void> setVane(String roomId, String vane) {
        log.debug("Setting vane for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setVane(roomId, vane);
    }

    /**
     * Set wide vane position with quota validation
     */
    public Mono<Void> setWideVane(UUID userId, String roomId, String wideVane) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("wideVane")
            .value(wideVane)
            .source("quota-aware-service")
            .build();

        return validateAndExecute(command, () -> reactiveAirConService.setWideVane(roomId, wideVane));
    }

    /**
     * Set wide vane position without user context (existing API compatibility)
     */
    public Mono<Void> setWideVane(String roomId, String wideVane) {
        log.debug("Setting wide vane for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.setWideVane(roomId, wideVane);
    }

    /**
     * Update all settings with quota validation
     */
    public Mono<Void> updateSettings(UUID userId, String roomId, AirConSettings settings) {
        AirConCommand command = AirConCommand.builder()
            .userId(userId)
            .roomId(roomId)
            .action("updateSettings")
            .value(settings)
            .source("quota-aware-service")
            .build()
            .withMetadata("power", settings.getPower())
            .withMetadata("temperature", settings.getTemperature())
            .withMetadata("mode", settings.getMode())
            .withMetadata("fan", settings.getFan())
            .withMetadata("vane", settings.getVane())
            .withMetadata("wideVane", settings.getWideVane());

        return validateAndExecute(command, () -> reactiveAirConService.updateSettings(roomId, settings));
    }

    /**
     * Update settings without user context (existing API compatibility)
     */
    public Mono<Void> updateSettings(String roomId, AirConSettings settings) {
        log.debug("Updating settings for room {} without user context - skipping quota validation", roomId);
        return reactiveAirConService.updateSettings(roomId, settings);
    }

    // Private helper methods

    /**
     * Generic method to validate command and execute if allowed.
     *
     * This method implements the core quota validation pattern:
     * 1. Check if quota feature is enabled for user
     * 2. Validate command against quotas if enabled
     * 3. Execute command if validation passes or feature is disabled
     * 4. Handle failures gracefully with fail-safe behavior
     */
    private Mono<Void> validateAndExecute(AirConCommand command, java.util.function.Supplier<Mono<Void>> executionSupplier) {
        UUID userId = command.getUserId();
        String roomId = command.getRoomId();

        // Skip validation if no user context
        if (userId == null) {
            log.debug("No user context for command {} in room {} - executing without validation",
                command.getAction(), roomId);
            return executionSupplier.get();
        }

        // Check if quota feature is enabled for this user
        return quotaFeatureService.isQuotaEnabledForUser(userId)
            .flatMap(quotaEnabled -> {
                if (!quotaEnabled) {
                    log.debug("Quota feature disabled for user {} in room {} - executing command",
                        userId, roomId);
                    return executionSupplier.get();
                }

                // Perform quota validation
                return quotaValidationService.validateCommand(command)
                    .flatMap(validationResult -> {
                        QuotaValidationResult.ValidationStatus status = validationResult.getStatus();

                        if (status == QuotaValidationResult.ValidationStatus.BLOCK) {
                            log.warn("Command {} blocked for user {} in room {} - quota exceeded: {}",
                                command.getAction(), userId, roomId, validationResult.getReason());
                            return Mono.error(new QuotaExceededException(
                                "Command blocked by quota: " + validationResult.getReason()
                            ));
                        }

                        if (status == QuotaValidationResult.ValidationStatus.ALLOW_WITH_WARNING) {
                            log.info("Command {} allowed with warning for user {} in room {} - approaching quota limit: {}",
                                command.getAction(), userId, roomId, validationResult.getReason());
                        } else {
                            log.debug("Command {} validated successfully for user {} in room {}",
                                command.getAction(), userId, roomId);
                        }

                        // Execute the command
                        return executionSupplier.get();
                    })
                    .onErrorResume(error -> {
                        if (error instanceof QuotaExceededException) {
                            // Don't execute if quota is exceeded
                            return Mono.error(error);
                        }

                        // For validation service errors, log and continue (fail-safe)
                        log.error("Quota validation error for user {} in room {} - executing command anyway (fail-safe)",
                            userId, roomId, error);
                        return executionSupplier.get();
                    });
            })
            .onErrorResume(featureError -> {
                // If we can't determine feature enablement, fail safe and execute
                log.error("Error checking quota feature status for user {} in room {} - executing command (fail-safe)",
                    userId, roomId, featureError);
                return executionSupplier.get();
            });
    }

    /**
     * Custom exception for quota-related failures.
     */
    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String message) {
            super(message);
        }
    }
}