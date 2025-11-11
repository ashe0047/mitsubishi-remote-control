package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.service.JwtService;
import com.ashelabs.turing.service.QuotaValidationService;
import com.ashelabs.turing.entity.Quota;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller for quota management operations.
 * Handles quota creation, validation, status retrieval, and parent overrides.
 */
@RestController
@RequestMapping("/api/quotas")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"}) // Allow frontend origins
public class QuotaController {

    private final QuotaValidationService quotaValidationService;
    private final QuotaRepository quotaRepository;
    private final UserRepository userRepository;
    private final JwtAuthenticationContext jwtAuthContext;

    /**
     * Create or update a user quota (Parent only)
     * POST /api/quotas
     */
    @PostMapping
    public Mono<ResponseEntity<Quota>> createOrUpdateQuota(
            @Valid @RequestBody CreateQuotaRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).<Quota>build());
                    }

                    log.info("Creating/updating quota for user {} in room {} requested by {}",
                        request.getUserId(), request.getRoomId(), userInfo.getEmail());
                    
                    return quotaRepository.findActiveQuotaByUserAndRoom(
                            UUID.fromString(request.getUserId()), 
                            request.getRoomId(), 
                            LocalDate.now())
                        .flatMap(existingQuota -> {
                            // Update existing quota
                            existingQuota.setAllowedAmount(request.getAllowedAmount());
                            existingQuota.setQuotaType(request.getQuotaType());
                            existingQuota.setWarningThresholds(java.util.List.of(request.getWarningThreshold()));
                            existingQuota.setUpdatedAt(java.time.Instant.now());
                            return quotaRepository.save(existingQuota);
                        })
                        .switchIfEmpty(
                            // Create new quota
                            createNewQuota(request)
                        )
                        .map(quota -> ResponseEntity.ok(quota))
                        .doOnSuccess(response -> log.info("Successfully created/updated quota: {}", 
                            response.getBody() != null ? response.getBody().getId() : "null"))
                        .onErrorResume(error -> {
                            log.error("Error creating/updating quota", error);
                            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                        });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get current quota status for a user
     * GET /api/quotas/user/{userId}?roomId={roomId}
     */
    @GetMapping("/user/{userId}")
    public Mono<ResponseEntity<com.ashelabs.turing.dto.QuotaBalance>> getQuotaStatus(
            @PathVariable String userId,
            @RequestParam String roomId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    log.info("Getting quota status for user {} in room {} requested by {}",
                        userId, roomId, userInfo.getEmail());
                    
                    return quotaValidationService.getCurrentQuotaBalance(
                            UUID.fromString(userId), 
                            roomId
                        )
                        .map(result -> ResponseEntity.ok(result))
                        .defaultIfEmpty(ResponseEntity.notFound().build())
                        .doOnSuccess(response -> log.debug("Quota status retrieved for user {}", userId))
                        .onErrorResume(error -> {
                            log.error("Error getting quota status for user {}", userId, error);
                            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                        });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Grant parent override (add time/unlock AC)
     * POST /api/quotas/{quotaId}/override
     */
    @PostMapping("/{quotaId}/override")
    public Mono<ResponseEntity<Map<String, Object>>> grantOverride(
            @PathVariable String quotaId,
            @Valid @RequestBody OverrideRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        Map<String, Object> errorBody = new java.util.HashMap<>();
                        errorBody.put("error", "Parent privileges required");
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorBody));
                    }

                    log.info("Processing override request for quota {} by user {}", quotaId, userInfo.getEmail());
                    
                    return quotaRepository.findById(UUID.fromString(quotaId))
                        .flatMap(quota -> {
                            // Apply override based on type
                            switch (request.getType()) {
                                case "ADD_TIME":
                                    return addTimeOverride(quota, request.getAdditionalSeconds(), request.getReason());
                                case "UNLOCK_DAY":
                                    return unlockDayOverride(quota, request.getReason());
                                case "EMERGENCY_OVERRIDE":
                                    return emergencyOverride(quota, request.getReason());
                                default:
                                    return Mono.error(new IllegalArgumentException("Unknown override type: " + request.getType()));
                            }
                        })
                        .map(quota -> {
                            Map<String, Object> response = new java.util.HashMap<>();
                            response.put("message", "Override granted successfully");
                            response.put("quotaId", quota.getId());
                            response.put("overrideType", request.getType());
                            response.put("grantedAt", java.time.Instant.now().toString());
                            return ResponseEntity.ok(response);
                        })
                        .switchIfEmpty(Mono.just(ResponseEntity.notFound().build()))
                        .doOnSuccess(response -> log.info("Override granted for quota {}", quotaId))
                        .onErrorResume(error -> {
                            log.error("Error granting override for quota {}", quotaId, error);
                            if (error instanceof IllegalArgumentException) {
                                Map<String, Object> errorResponse = new java.util.HashMap<>();
                                errorResponse.put("error", error.getMessage());
                                return Mono.just(ResponseEntity.badRequest().body(errorResponse));
                            }
                            Map<String, Object> errorResponse = new java.util.HashMap<>();
                            errorResponse.put("error", "Internal server error");
                            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse));
                        });
                })
                .onErrorResume(ResponseStatusException.class, error -> {
                    Map<String, Object> errorBody = new java.util.HashMap<>();
                    errorBody.put("error", error.getReason() != null ? error.getReason() : "Authorization required");
                    return Mono.just(ResponseEntity.status(error.getStatusCode()).body(errorBody));
                });
    }

    /**
     * Get all quotas for a user (for parents to manage children)
     * GET /api/quotas/user/{userId}/all
     */
    @GetMapping("/user/{userId}/all")
    public Flux<Quota> getAllUserQuotas(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .doOnNext(userInfo -> log.info("Getting all quotas for user {} requested by {}", 
                    userId, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    return quotaRepository.findQuotasByUser(UUID.fromString(userId))
                        .doOnNext(quota -> log.debug("Found quota: {} for room {}", quota.getId(), quota.getTargetId()))
                        .onErrorResume(error -> {
                            log.error("Error getting quotas for user {}", userId, error);
                            return Flux.empty();
                        });
                })
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error));
    }

    /**
     * Delete a quota (Parent only)
     * DELETE /api/quotas/{quotaId}
     */
    @DeleteMapping("/{quotaId}")
    public Mono<ResponseEntity<Map<String, String>>> deleteQuota(
            @PathVariable String quotaId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        Map<String, String> errorBody = new java.util.HashMap<>();
                        errorBody.put("error", "Parent privileges required");
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorBody));
                    }

                    log.info("Deleting quota {} by user {}", quotaId, userInfo.getEmail());
                    
                    return quotaRepository.findById(UUID.fromString(quotaId))
                        .flatMap(quota -> {
                            quota.setStatus(com.ashelabs.turing.entity.QuotaStatus.PAUSED);
                            quota.setUpdatedAt(java.time.Instant.now());
                            return quotaRepository.save(quota);
                        })
                        .map(quota -> {
                            Map<String, String> response = new java.util.HashMap<>();
                            response.put("message", "Quota deleted successfully");
                            return ResponseEntity.ok(response);
                        })
                        .switchIfEmpty(Mono.just(ResponseEntity.notFound().build()))
                        .doOnSuccess(response -> log.info("Quota {} deleted", quotaId))
                        .onErrorResume(error -> {
                            log.error("Error deleting quota {}", quotaId, error);
                            Map<String, String> errorResponse = new java.util.HashMap<>();
                            errorResponse.put("error", "Internal server error");
                            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse));
                        });
                })
                .onErrorResume(ResponseStatusException.class, error -> {
                    Map<String, String> errorBody = new java.util.HashMap<>();
                    errorBody.put("error", error.getReason() != null ? error.getReason() : "Authorization required");
                    return Mono.just(ResponseEntity.status(error.getStatusCode()).body(errorBody));
                });
    }

    private Mono<JwtService.JwtUserInfo> requireAuthenticatedUser(String authorization) {
        Mono<JwtService.JwtUserInfo> fromContext = jwtAuthContext.currentUser();

        if (StringUtils.hasText(authorization)) {
            return fromContext.switchIfEmpty(jwtAuthContext.extractUserFromToken(authorization));
        }

        return fromContext.switchIfEmpty(
                Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization required")));
    }

    // Helper methods for override operations

    private Mono<Quota> addTimeOverride(Quota quota, Integer additionalSeconds, String reason) {
        log.info("Adding {} seconds to quota {}: {}", additionalSeconds, quota.getId(), reason);
        
        // Add time to daily allowance (temporary override)
        java.math.BigDecimal additionalTime = java.math.BigDecimal.valueOf(additionalSeconds);
        java.math.BigDecimal currentAllowed = quota.getAllowedAmount();
        quota.setAllowedAmount(currentAllowed.add(additionalTime));
        quota.setUpdatedAt(java.time.Instant.now());
        
        return quotaRepository.save(quota);
    }

    private Mono<Quota> unlockDayOverride(Quota quota, String reason) {
        log.info("Unlocking day for quota {}: {}", quota.getId(), reason);
        
        // Reset daily usage to allow continued use
        quota.setUsedAmount(java.math.BigDecimal.ZERO);
        quota.setUpdatedAt(java.time.Instant.now());
        
        return quotaRepository.save(quota);
    }

    private Mono<Quota> emergencyOverride(Quota quota, String reason) {
        log.info("Emergency override for quota {}: {}", quota.getId(), reason);
        
        // Temporarily disable quota enforcement (mark as inactive for today)
        quota.setStatus(com.ashelabs.turing.entity.QuotaStatus.PAUSED);
        quota.setUpdatedAt(java.time.Instant.now());
        
        return quotaRepository.save(quota)
            .doOnSuccess(savedQuota -> {
                // Schedule reactivation for tomorrow (simplified approach)
                log.info("Emergency override applied to quota {}, will need manual reactivation", savedQuota.getId());
            });
    }

    private Mono<Quota> createNewQuota(CreateQuotaRequest request) {
        return userRepository.findById(UUID.fromString(request.getUserId()))
            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
            .flatMap(user -> {
                Quota newQuota = Quota.builder()
                    .userId(UUID.fromString(request.getUserId()))
                    .name("Daily " + request.getQuotaType().name().toLowerCase() + " quota")
                    .description("Auto-generated daily quota for room " + request.getRoomId())
                    .quotaType(request.getQuotaType())
                    .scope(com.ashelabs.turing.entity.QuotaScope.ROOM)
                    .targetId(request.getRoomId())
                    .allowedAmount(request.getAllowedAmount())
                    .usedAmount(java.math.BigDecimal.ZERO)
                    .period(com.ashelabs.turing.entity.QuotaPeriod.DAILY)
                    .warningThresholds(java.util.List.of(request.getWarningThreshold() != null ? request.getWarningThreshold() : 75))
                    .status(com.ashelabs.turing.entity.QuotaStatus.ACTIVE)
                    .createdBy(user.getId())
                    .build();
                
                return quotaRepository.save(newQuota);
            });
    }

    // Request/Response DTOs

    public static class CreateQuotaRequest {
        private String userId;
        private String roomId;
        private com.ashelabs.turing.entity.QuotaType quotaType;
        private java.math.BigDecimal allowedAmount;
        private Integer warningThreshold;

        // Getters and setters
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getRoomId() { return roomId; }
        public void setRoomId(String roomId) { this.roomId = roomId; }
        public com.ashelabs.turing.entity.QuotaType getQuotaType() { return quotaType; }
        public void setQuotaType(com.ashelabs.turing.entity.QuotaType quotaType) { this.quotaType = quotaType; }
        public java.math.BigDecimal getAllowedAmount() { return allowedAmount; }
        public void setAllowedAmount(java.math.BigDecimal allowedAmount) { this.allowedAmount = allowedAmount; }
        public Integer getWarningThreshold() { return warningThreshold; }
        public void setWarningThreshold(Integer warningThreshold) { this.warningThreshold = warningThreshold; }
    }

    public static class OverrideRequest {
        private String type; // ADD_TIME, UNLOCK_DAY, EMERGENCY_OVERRIDE
        private Integer additionalSeconds;
        private String reason;

        // Getters and setters
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Integer getAdditionalSeconds() { return additionalSeconds; }
        public void setAdditionalSeconds(Integer additionalSeconds) { this.additionalSeconds = additionalSeconds; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}
