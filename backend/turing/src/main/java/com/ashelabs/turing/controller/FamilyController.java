package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.service.JwtService;
import com.ashelabs.turing.entity.*;
import com.ashelabs.turing.repository.*;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * REST Controller for family and invitation management.
 * Handles family invitations, room assignments, and family statistics.
 */
@RestController
@RequestMapping("/api/family")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class FamilyController {

    private final FamilyInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final UserRoomAssignmentRepository roomAssignmentRepository;
    private final HouseholdRepository householdRepository;
    private final JwtAuthenticationContext jwtAuthContext;
    private SecureRandom secureRandom = new SecureRandom();

    /**
     * Send a family invitation
     * POST /api/family/invitations
     */
    @PostMapping("/invitations")
    public Mono<ResponseEntity<FamilyInvitation>> sendInvitation(
            @Valid @RequestBody SendInvitationRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just((ResponseEntity<FamilyInvitation>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Sending family invitation to {} by user {}", request.getEmail(), userInfo.getEmail());

                    return userRepository.findById(userInfo.getUserId())
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("Requesting user not found")))
                            .flatMap(requestingUser -> {
                                // Check for existing pending invitation
                                return invitationRepository.findPendingInvitationByEmailAndHousehold(
                                        request.getEmail(), userInfo.getHouseholdId())
                                        .flatMap(existing -> {
                                            log.warn("Pending invitation already exists for {}", request.getEmail());
                                            return Mono.<FamilyInvitation>error(
                                                    new IllegalArgumentException(
                                                            "Invitation already pending for this email"));
                                        })
                                        .switchIfEmpty(Mono.defer(() -> {
                                            // Create new invitation
                                            String token = generateInvitationToken();
                                            Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS); // 7 days expiry

                                            FamilyInvitation invitation = FamilyInvitation.builder()
                                                    .householdId(userInfo.getHouseholdId())
                                                    .invitedByUserId(userInfo.getUserId())
                                                    .email(request.getEmail())
                                                    .name(request.getName())
                                                    .role(request.getRole() != null ? request.getRole()
                                                            : UserRole.child)
                                                    .token(token)
                                                    .status(InvitationStatus.pending)
                                                    .expiresAt(expiresAt)
                                                    .message(request.getMessage())
                                                    .build();

                                            invitation.markAsSent();
                                            return invitationRepository.save(invitation);
                                        }));
                            })
                            .map(invitation -> ResponseEntity.status(HttpStatus.CREATED).body(invitation))
                            .doOnSuccess(response -> log.info("Family invitation sent successfully"))
                            .onErrorResume(error -> {
                                log.error("Error sending family invitation", error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<FamilyInvitation>build());
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<FamilyInvitation>build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<FamilyInvitation>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error sending family invitation", error);
                    return Mono.just((ResponseEntity<FamilyInvitation>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                });
    }

    /**
     * Get all family invitations
     * GET /api/family/invitations
     */
    @GetMapping("/invitations")
    public Flux<FamilyInvitation> getFamilyInvitations(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null && jwtAuthContext.isParent(userInfo))
                .doOnNext(userInfo -> log.info("Getting family invitations for user {}", userInfo.getEmail()))
                .flatMap(userInfo -> invitationRepository.findByHouseholdId(userInfo.getHouseholdId()))
                .doOnNext(invitation -> log.debug("Found invitation: {}", invitation.getEmail()))
                .onErrorResume(error -> {
                    log.error("Error getting family invitations", error);
                    return Flux.empty();
                });
    }

    /**
     * Resend a family invitation
     * POST /api/family/invitations/{invitationId}/resend
     */
    @PostMapping("/invitations/{invitationId}/resend")
    public Mono<ResponseEntity<FamilyInvitation>> resendInvitation(
            @PathVariable String invitationId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just((ResponseEntity<FamilyInvitation>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Resending invitation {} by user {}", invitationId, userInfo.getEmail());

                    return invitationRepository.findById(UUID.fromString(invitationId))
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("Invitation not found")))
                            .flatMap(invitation -> {
                                // Verify invitation belongs to user's household
                                if (!invitation.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(
                                            new IllegalArgumentException("Invitation not found in your household"));
                                }

                                if (invitation.getStatus() != InvitationStatus.pending) {
                                    return Mono
                                            .error(new IllegalArgumentException("Can only resend pending invitations"));
                                }

                                // Update expiry and resend count
                                invitation.setExpiresAt(Instant.now().plus(7, ChronoUnit.DAYS));
                                invitation.incrementResendCount();

                                return invitationRepository.save(invitation);
                            })
                            .map(invitation -> ResponseEntity.ok(invitation))
                            .doOnSuccess(response -> log.info("Invitation resent successfully"))
                            .onErrorResume(error -> {
                                log.error("Error resending invitation", error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<FamilyInvitation>build());
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<FamilyInvitation>build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<FamilyInvitation>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Cancel a family invitation
     * DELETE /api/family/invitations/{invitationId}
     */
    @DeleteMapping("/invitations/{invitationId}")
    public Mono<ResponseEntity<Map<String, String>>> cancelInvitation(
            @PathVariable String invitationId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("error", "Parent privileges required")));
                    }

                    log.info("Cancelling invitation {} by user {}", invitationId, userInfo.getEmail());

                    return invitationRepository.findById(UUID.fromString(invitationId))
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("Invitation not found")))
                            .flatMap(invitation -> {
                                if (invitation.getStatus() != InvitationStatus.pending) {
                                    return Mono
                                            .error(new IllegalArgumentException("Can only cancel pending invitations"));
                                }

                                invitation.setStatus(InvitationStatus.cancelled);
                                invitation.setUpdatedAt(Instant.now());

                                return invitationRepository.save(invitation);
                            })
                            .map(invitation -> ResponseEntity
                                    .ok(Map.of("message", "Invitation cancelled successfully")))
                            .doOnSuccess(response -> log.info("Invitation cancelled successfully"))
                            .onErrorResume(error -> {
                                log.error("Error cancelling invitation", error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest()
                                            .body(Map.of("error", error.getMessage())));
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("error", "Internal server error")));
                            });
                })
                .onErrorResume(ResponseStatusException.class, error -> Mono.just(ResponseEntity
                        .status(error.getStatusCode())
                        .body(Map.of("error", error.getReason() != null ? error.getReason() : "Authorization required"))));
    }

    /**
     * Accept a family invitation
     * POST /api/family/invitations/accept
     */
    @PostMapping("/invitations/accept")
    public Mono<ResponseEntity<User>> acceptInvitation(
            @Valid @RequestBody AcceptInvitationRequest request) {

        log.info("Accepting invitation with token for email: {}", request.getEmail());

        return invitationRepository.findByToken(request.getToken())
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Invalid invitation token")))
                .flatMap(invitation -> {
                    if (!invitation.isValid()) {
                        return Mono.error(new IllegalArgumentException("Invitation is expired or invalid"));
                    }

                    // Create new user account
                    User newUser = User.builder()
                            .email(invitation.getEmail())
                            .name(request.getName())
                            .role(invitation.getRole())
                            .householdId(invitation.getHouseholdId())
                            .status(UserStatus.active)
                            .build();

                    return userRepository.save(newUser)
                            .flatMap(savedUser -> {
                                // Mark invitation as accepted
                                invitation.markAsAccepted(savedUser.getId());
                                return invitationRepository.save(invitation)
                                        .then(Mono.just(savedUser));
                            });
                })
                .map(user -> ResponseEntity.status(HttpStatus.CREATED).body(user))
                .doOnSuccess(response -> log.info("Invitation accepted successfully"))
                .onErrorResume(error -> {
                    log.error("Error accepting invitation", error);
                    if (error instanceof IllegalArgumentException) {
                        return Mono.just(ResponseEntity.badRequest().build());
                    }
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                });
    }

    /**
     * Decline a family invitation
     * POST /api/family/invitations/decline
     */
    @PostMapping("/invitations/decline")
    public Mono<ResponseEntity<Map<String, String>>> declineInvitation(
            @Valid @RequestBody DeclineInvitationRequest request) {

        log.info("Declining invitation with token");

        return invitationRepository.findByToken(request.getToken())
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Invalid invitation token")))
                .flatMap(invitation -> {
                    if (invitation.getStatus() != InvitationStatus.pending) {
                        return Mono.error(new IllegalArgumentException("Invitation is not pending"));
                    }

                    invitation.markAsDeclined();
                    return invitationRepository.save(invitation);
                })
                .map(invitation -> ResponseEntity.ok(Map.of("message", "Invitation declined")))
                .doOnSuccess(response -> log.info("Invitation declined successfully"))
                .onErrorResume(error -> {
                    log.error("Error declining invitation", error);
                    if (error instanceof IllegalArgumentException) {
                        return Mono.just(ResponseEntity.badRequest()
                                .body(Map.of("error", error.getMessage())));
                    }
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Internal server error")));
                });
    }

    /**
     * Validate invitation token
     * POST /api/family/invitations/validate
     */
    @PostMapping("/invitations/validate")
    public Mono<ResponseEntity<FamilyInvitation>> validateInvitationToken(
            @Valid @RequestBody ValidateTokenRequest request) {

        log.info("Validating invitation token");

        return invitationRepository.findByToken(request.getToken())
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Invalid invitation token")))
                .flatMap(invitation -> {
                    if (!invitation.isValid()) {
                        if (invitation.isExpired()) {
                            invitation.markAsExpired();
                            return invitationRepository.save(invitation)
                                    .then(Mono.error(new IllegalArgumentException("Invitation has expired")));
                        }
                        return Mono.error(new IllegalArgumentException("Invitation is not valid"));
                    }
                    return Mono.just(invitation);
                })
                .map(invitation -> ResponseEntity.ok(invitation))
                .onErrorResume(error -> {
                    log.error("Error validating invitation token", error);
                    if (error instanceof IllegalArgumentException) {
                        return Mono.just(ResponseEntity.badRequest().build());
                    }
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                });
    }

    /**
     * Get all room assignments for the family
     * GET /api/family/room-assignments
     */
    @GetMapping("/room-assignments")
    public Mono<ResponseEntity<Map<String, List<UserRoomAssignment>>>> getAllRoomAssignments(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting all family room assignments for user {}", userInfo.getEmail());

                    return roomAssignmentRepository.findByHouseholdId(userInfo.getHouseholdId())
                            .onErrorResume(error -> {
                                log.warn("Error fetching room assignments for household {}: {}",
                                        userInfo.getHouseholdId(),
                                        error.getMessage());
                                return Flux.empty();
                            })
                            .collectList()
                            .map(assignments -> {
                                Map<String, List<UserRoomAssignment>> groupedAssignments;
                                if (assignments.isEmpty()) {
                                    // Return empty map for empty assignments
                                    groupedAssignments = new java.util.HashMap<>();
                                } else {
                                    // Group by user ID
                                    groupedAssignments = assignments.stream()
                                            .collect(java.util.stream.Collectors.groupingBy(
                                                    assignment -> assignment.getUserId().toString()));
                                }

                                return ResponseEntity.ok(groupedAssignments);
                            })
                            .onErrorResume(error -> {
                                log.error("Error getting family room assignments", error);
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get family statistics
     * GET /api/family/stats
     */
    @GetMapping("/stats")
    public Mono<ResponseEntity<FamilyStats>> getFamilyStats(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .flatMap(userInfo -> {
                    log.info("Getting family stats for user {}", userInfo.getEmail());

                    Mono<Long> memberCount = userRepository.countByHouseholdId(userInfo.getHouseholdId())
                            .defaultIfEmpty(0L)
                            .onErrorReturn(0L);
                    Mono<Long> pendingInvitations = invitationRepository
                            .countPendingInvitationsByHousehold(userInfo.getHouseholdId())
                            .defaultIfEmpty(0L)
                            .onErrorReturn(0L);
                    Mono<Long> roomAssignmentCount = roomAssignmentRepository
                            .countByHouseholdId(userInfo.getHouseholdId())
                            .defaultIfEmpty(0L)
                            .onErrorReturn(0L);

                    return Mono.zip(memberCount, pendingInvitations, roomAssignmentCount)
                            .map(tuple -> {
                                FamilyStats stats = FamilyStats.builder()
                                        .totalMembers(tuple.getT1().intValue())
                                        .pendingInvitations(tuple.getT2().intValue())
                                        .totalRoomAssignments(tuple.getT3().intValue())
                                        .build();
                                return ResponseEntity.ok(stats);
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting family stats", error);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                });
    }

    /**
     * Get family usage summary
     * GET /api/family/usage
     */
    @GetMapping("/usage")
    public Mono<ResponseEntity<Map<String, Object>>> getFamilyUsageSummary(
            @RequestParam(defaultValue = "daily") String period,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting family usage summary for period {} by user {}", period, userInfo.getEmail());

                    // TODO: Implement actual usage tracking integration
                    // For now, return mock data structure
                    Map<String, Object> mockUsage = Map.of(
                            "period", period,
                            "totalUsageHours", 0,
                            "averageTemperature", 22.0,
                            "mostUsedRoom", "Living Room",
                            "energyEstimate", Map.of("kwh", 0, "cost", 0.0));

                    return Mono.just(ResponseEntity.ok(mockUsage));
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()));
    }

    private Mono<JwtService.JwtUserInfo> requireAuthenticatedUser(String authorization) {
        Mono<JwtService.JwtUserInfo> fromContext = jwtAuthContext.currentUser();

        if (StringUtils.hasText(authorization)) {
            return fromContext.switchIfEmpty(jwtAuthContext.extractUserFromToken(authorization));
        }

        return fromContext.switchIfEmpty(
                Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization required")));
    }

    // Helper methods

    private String generateInvitationToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // Request/Response DTOs

    public static class SendInvitationRequest {
        private String email;
        private String name;
        private UserRole role;
        private String message;

        // Getters and setters
        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public UserRole getRole() {
            return role;
        }

        public void setRole(UserRole role) {
            this.role = role;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }

    public static class AcceptInvitationRequest {
        private String token;
        private String name;
        private String email;
        private String password;

        // Getters and setters
        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class DeclineInvitationRequest {
        private String token;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }
    }

    public static class ValidateTokenRequest {
        private String token;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }
    }

    public static class FamilyStats {
        private Integer totalMembers;
        private Integer pendingInvitations;
        private Integer totalRoomAssignments;

        public static FamilyStatsBuilder builder() {
            return new FamilyStatsBuilder();
        }

        // Getters and setters
        public Integer getTotalMembers() {
            return totalMembers;
        }

        public void setTotalMembers(Integer totalMembers) {
            this.totalMembers = totalMembers;
        }

        public Integer getPendingInvitations() {
            return pendingInvitations;
        }

        public void setPendingInvitations(Integer pendingInvitations) {
            this.pendingInvitations = pendingInvitations;
        }

        public Integer getTotalRoomAssignments() {
            return totalRoomAssignments;
        }

        public void setTotalRoomAssignments(Integer totalRoomAssignments) {
            this.totalRoomAssignments = totalRoomAssignments;
        }

        public static class FamilyStatsBuilder {
            private Integer totalMembers;
            private Integer pendingInvitations;
            private Integer totalRoomAssignments;

            public FamilyStatsBuilder totalMembers(Integer totalMembers) {
                this.totalMembers = totalMembers;
                return this;
            }

            public FamilyStatsBuilder pendingInvitations(Integer pendingInvitations) {
                this.pendingInvitations = pendingInvitations;
                return this;
            }

            public FamilyStatsBuilder totalRoomAssignments(Integer totalRoomAssignments) {
                this.totalRoomAssignments = totalRoomAssignments;
                return this;
            }

            public FamilyStats build() {
                FamilyStats stats = new FamilyStats();
                stats.totalMembers = this.totalMembers;
                stats.pendingInvitations = this.pendingInvitations;
                stats.totalRoomAssignments = this.totalRoomAssignments;
                return stats;
            }
        }
    }
}
