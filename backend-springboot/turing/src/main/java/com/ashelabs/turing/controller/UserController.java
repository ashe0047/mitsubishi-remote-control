package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.entity.User;
import com.ashelabs.turing.entity.UserRoomAssignment;
import com.ashelabs.turing.repository.UserRepository;
import com.ashelabs.turing.repository.UserRoomAssignmentRepository;
import com.ashelabs.turing.repository.HouseholdRepository;
import com.ashelabs.turing.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller for user and family member management.
 * Handles user creation, room assignments, and family management.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class UserController {

    private final UserRepository userRepository;
    private final UserRoomAssignmentRepository roomAssignmentRepository;
    private final HouseholdRepository householdRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtAuthenticationContext jwtAuthContext;

    /**
     * Add family member to household (Parent only)
     * POST /api/users
     */
    @PostMapping
    public Mono<ResponseEntity<User>> addFamilyMember(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just((ResponseEntity<User>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Adding family member: {} by user {}", request.getEmail(), userInfo.getEmail());

                    return userRepository.findById(userInfo.getUserId())
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("Requesting user not found")))
                            .flatMap(requestingUser -> {
                                // Create new family member in same household
                                String hashedPassword = passwordEncoder.encode(
                                        request.getPassword() != null ? request.getPassword() : "default123");

                                User newUser = User.builder()
                                        .email(request.getEmail())
                                        .name(request.getFullName())
                                        .passwordHash(hashedPassword)
                                        .role(request.getRole() != null ? request.getRole()
                                                : com.ashelabs.turing.entity.UserRole.child)
                                        .householdId(userInfo.getHouseholdId())
                                        .status(com.ashelabs.turing.entity.UserStatus.active)
                                        .createdAt(Instant.now())
                                        .updatedAt(Instant.now())
                                        .build();

                                return userRepository.save(newUser);
                            })
                            .flatMap(savedUser -> {
                                // Assign to rooms if specified
                                if (request.getRoomIds() != null && !request.getRoomIds().isEmpty()) {
                                    return assignUserToRooms(savedUser.getId(), request.getRoomIds())
                                            .then(Mono.just(savedUser));
                                }
                                return Mono.just(savedUser);
                            })
                            .map(user -> ResponseEntity.status(HttpStatus.CREATED).body(user))
                            .doOnSuccess(response -> log.info("Successfully added family member: {}",
                                    response.getBody() != null ? response.getBody().getEmail() : "null"))
                            .onErrorResume(error -> {
                                log.error("Error adding family member", error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<User>build());
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<User>build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<User>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get all family members in household
     * GET /api/users
     */
    @GetMapping
    public Flux<User> getFamilyMembers(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null)
                .doOnNext(userInfo -> log.info("Getting family members for user {}", userInfo.getEmail()))
                .flatMap(userInfo -> userRepository.findByHouseholdId(userInfo.getHouseholdId()))
                .doOnNext(member -> log.debug("Found family member: {}", member.getEmail()))
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error))
                .onErrorResume(error -> {
                    log.error("Error getting family members", error);
                    return Flux.empty();
                });
    }

    /**
     * Update user room assignments (Parent only)
     * PUT /api/users/{userId}/rooms
     */
    @PutMapping("/{userId}/rooms")
    public Mono<ResponseEntity<Map<String, Object>>> updateUserRoomAccess(
            @PathVariable String userId,
            @Valid @RequestBody UpdateRoomAccessRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just((ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Updating room access for user {} by {}", userId, userInfo.getEmail());

                    UUID userUuid = UUID.fromString(userId);

                    return userRepository.findById(userUuid)
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                            .flatMap(user -> {
                                // Verify user is in same household
                                if (!user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(new IllegalArgumentException("User not in same household"));
                                }
                                // Remove existing room assignments
                                return roomAssignmentRepository.deactivateAllAssignmentsForUser(userUuid)
                                        .then(assignUserToRooms(userUuid, request.getRoomIds()))
                                        .then(Mono.just(user));
                            })
                            .map(user -> ResponseEntity.ok(Map.of(
                                    "message", "Room access updated successfully",
                                    "userId", userId,
                                    "roomIds", request.getRoomIds(),
                                    "updatedAt", java.time.Instant.now().toString())))
                            .doOnSuccess(response -> log.info("Room access updated for user {}", userId))
                            .onErrorResume(error -> {
                                log.error("Error updating room access for user {}", userId, error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest()
                                            .body(Map.of("error", error.getMessage())));
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("error", "Internal server error")));
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get user's room assignments
     * GET /api/users/{userId}/rooms
     */
    @GetMapping("/{userId}/rooms")
    public Flux<UserRoomAssignment> getUserRoomAssignments(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null)
                .doOnNext(
                        userInfo -> log.info("Getting room assignments for user {} by {}", userId, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    // Verify requesting user can access this user's room assignments
                    UUID targetUserId = UUID.fromString(userId);
                    if (!targetUserId.equals(userInfo.getUserId()) && !jwtAuthContext.isParent(userInfo)) {
                        return Flux.empty(); // Only allow self or parent to view room assignments
                    }
                    return roomAssignmentRepository.findByUserId(targetUserId);
                })
                .doOnNext(assignment -> log.debug("Found room assignment: {} -> {}",
                        assignment.getUserId(), assignment.getRoomId()))
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error))
                .onErrorResume(error -> {
                    log.error("Error getting room assignments for user {}", userId, error);
                    return Flux.empty();
                });
    }

    /**
     * Update user profile (name, role, etc.)
     * PUT /api/users/{userId}
     */
    @PutMapping("/{userId}")
    public Mono<ResponseEntity<User>> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    UUID targetUserId = UUID.fromString(userId);
                    boolean canUpdate = targetUserId.equals(userInfo.getUserId()) || jwtAuthContext.isParent(userInfo);

                    if (!canUpdate) {
                        return Mono.just((ResponseEntity<User>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Updating user {} by {}", userId, userInfo.getEmail());

                    return userRepository.findById(targetUserId)
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                            .flatMap(user -> {
                                // Verify user is in same household if updating someone else
                                if (!targetUserId.equals(userInfo.getUserId())
                                        && !user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(new IllegalArgumentException("User not in same household"));
                                }

                                // Update allowed fields
                                if (request.getFullName() != null) {
                                    user.setName(request.getFullName());
                                }
                                if (request.getRole() != null && jwtAuthContext.isParent(userInfo)) {
                                    // Only parents can change roles
                                    user.setRole(request.getRole());
                                }
                                if (request.getIsActive() != null && jwtAuthContext.isParent(userInfo)) {
                                    // Only parents can change active status
                                    user.setStatus(
                                            request.getIsActive() ? com.ashelabs.turing.entity.UserStatus.active
                                                    : com.ashelabs.turing.entity.UserStatus.archived);
                                }

                                user.setUpdatedAt(java.time.Instant.now());
                                return userRepository.save(user);
                            })
                            .map(user -> ResponseEntity.ok(user))
                            .doOnSuccess(response -> log.info("User {} updated successfully", userId))
                            .onErrorResume(error -> {
                                log.error("Error updating user {}", userId, error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<User>build());
                                }
                            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<User>build());
                        });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<User>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get specific family member details
     * GET /api/users/{userId}
     */
    @GetMapping("/{userId}")
    public Mono<ResponseEntity<User>> getFamilyMember(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting family member {} by user {}", userId, userInfo.getEmail());

                    return userRepository.findById(UUID.fromString(userId))
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                            .flatMap(user -> {
                                // Verify user is in same household
                                if (!user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(new IllegalArgumentException("User not in same household"));
                                }
                                return Mono.just(user);
                            })
                            .map(user -> ResponseEntity.ok(user))
                            .doOnSuccess(response -> log.info("Family member details retrieved: {}", userId))
                            .onErrorResume(error -> {
                                log.error("Error getting family member {}", userId, error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<User>build());
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<User>build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<User>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Deactivate user (soft delete)
     * DELETE /api/users/{userId}
     */
    @DeleteMapping("/{userId}")
    public Mono<ResponseEntity<Map<String, String>>> deactivateUser(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just((ResponseEntity<Map<String, String>>) (ResponseEntity<?>) ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Deactivating user {} by {}", userId, userInfo.getEmail());

                    return userRepository.findById(UUID.fromString(userId))
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                            .flatMap(user -> {
                                // Verify user is in same household
                                if (!user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(new IllegalArgumentException("User not in same household"));
                                }
                                user.setStatus(com.ashelabs.turing.entity.UserStatus.archived);
                                user.setUpdatedAt(java.time.Instant.now());
                                return userRepository.save(user);
                            })
                            .map(user -> ResponseEntity.ok(Map.of("message", "User deactivated successfully")))
                            .doOnSuccess(response -> log.info("User {} deactivated", userId))
                            .onErrorResume(error -> {
                                log.error("Error deactivating user {}", userId, error);
                                if (error instanceof IllegalArgumentException) {
                                return Mono.just(ResponseEntity.badRequest()
                                        .body(Map.of("error", error.getMessage())));
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("error", "Internal server error")));
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<Map<String, String>>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Bulk update multiple family members
     * PUT /api/users/bulk
     */
    @PutMapping("/bulk")
    public Flux<User> bulkUpdateFamilyMembers(
            @Valid @RequestBody BulkUpdateRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null)
                .filter(userInfo -> jwtAuthContext.isParent(userInfo))
                .doOnNext(userInfo -> log.info("Bulk updating {} users by {}", request.getUpdates().size(),
                        userInfo.getEmail()))
                .flatMap(userInfo -> Flux.fromIterable(request.getUpdates())
                        .flatMap(updateRequest -> {
                            return userRepository.findById(UUID.fromString(updateRequest.getUserId()))
                                    .switchIfEmpty(Mono.error(new IllegalArgumentException(
                                            "User not found: " + updateRequest.getUserId())))
                                    .flatMap(user -> {
                                        // Verify user is in same household
                                        if (!user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                            return Mono
                                                    .error(new IllegalArgumentException("User not in same household"));
                                        }

                                        // Apply updates
                                        if (updateRequest.getUpdates().getFullName() != null) {
                                            user.setName(updateRequest.getUpdates().getFullName());
                                        }
                                        if (updateRequest.getUpdates().getRole() != null) {
                                            user.setRole(updateRequest.getUpdates().getRole());
                                        }
                                        if (updateRequest.getUpdates().getIsActive() != null) {
                                            user.setStatus(updateRequest.getUpdates().getIsActive()
                                                    ? com.ashelabs.turing.entity.UserStatus.active
                                                    : com.ashelabs.turing.entity.UserStatus.archived);
                                        }

                                user.setUpdatedAt(java.time.Instant.now());
                                return userRepository.save(user);
                            });
                        }))
                .doOnNext(user -> log.debug("Updated user: {}", user.getEmail()))
                .doOnComplete(() -> log.info("Bulk update completed"))
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error))
                .onErrorResume(error -> {
                    log.error("Error in bulk update", error);
                    return Flux.empty();
                });
    }

    /**
     * Get family member activity log
     * GET /api/users/{userId}/activity
     */
    @GetMapping("/{userId}/activity")
    public Mono<ResponseEntity<List<Map<String, Object>>>> getFamilyMemberActivity(
            @PathVariable String userId,
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting activity for user {} (limit: {}) by {}", userId, limit, userInfo.getEmail());

                    return userRepository.findById(UUID.fromString(userId))
                            .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                            .flatMap(user -> {
                                // Verify user is in same household
                                if (!user.getHouseholdId().equals(userInfo.getHouseholdId())) {
                                    return Mono.error(new IllegalArgumentException("User not in same household"));
                                }

                                // TODO: Implement actual activity tracking
                                // For now, return mock activity data
                                List<Map<String, Object>> mockActivity = List.of(
                                        Map.of(
                                                "timestamp", java.time.Instant.now().toString(),
                                                "action", "AC_CONTROL",
                                                "room", "Living Room",
                                                "details", Map.of("temperature", 22, "mode", "cool")),
                                        Map.of(
                                                "timestamp", java.time.Instant.now().minusSeconds(3600).toString(),
                                                "action", "LOGIN",
                                                "details", Map.of("device", "Mobile App")));

                                return Mono.just(mockActivity);
                            })
                            .map(activity -> ResponseEntity.ok(activity))
                            .doOnSuccess(response -> log.info("Activity retrieved for user {}", userId))
                            .onErrorResume(error -> {
                                log.error("Error getting user activity", error);
                                if (error instanceof IllegalArgumentException) {
                                    return Mono.just(ResponseEntity.badRequest().<List<Map<String, Object>>>build());
                                }
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<List<Map<String, Object>>>build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<List<Map<String, Object>>>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
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

    private Mono<Void> assignUserToRooms(UUID userId, List<String> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return Mono.empty();
        }

        return Flux.fromIterable(roomIds)
                .flatMap(roomId -> {
                    UserRoomAssignment assignment = UserRoomAssignment.builder()
                            .userId(userId)
                            .roomId(roomId)
                            .accessLevel(com.ashelabs.turing.entity.AccessLevel.full)
                            .build();
                    return roomAssignmentRepository.save(assignment);
                })
                .then()
                .doOnSuccess(v -> log.debug("Assigned user {} to {} rooms", userId, roomIds.size()));
    }

    // Request/Response DTOs

    public static class CreateUserRequest {
        private String email;
        private String fullName;
        private String password;
        private com.ashelabs.turing.entity.UserRole role;
        private List<String> roomIds;

        // Getters and setters
        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getFullName() {
            return fullName;
        }

        public void setFullName(String fullName) {
            this.fullName = fullName;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public com.ashelabs.turing.entity.UserRole getRole() {
            return role;
        }

        public void setRole(com.ashelabs.turing.entity.UserRole role) {
            this.role = role;
        }

        public List<String> getRoomIds() {
            return roomIds;
        }

        public void setRoomIds(List<String> roomIds) {
            this.roomIds = roomIds;
        }
    }

    public static class UpdateRoomAccessRequest {
        private List<String> roomIds;

        // Getters and setters
        public List<String> getRoomIds() {
            return roomIds;
        }

        public void setRoomIds(List<String> roomIds) {
            this.roomIds = roomIds;
        }
    }

    public static class UpdateUserRequest {
        private String fullName;
        private com.ashelabs.turing.entity.UserRole role;
        private Boolean isActive;

        // Getters and setters
        public String getFullName() {
            return fullName;
        }

        public void setFullName(String fullName) {
            this.fullName = fullName;
        }

        public com.ashelabs.turing.entity.UserRole getRole() {
            return role;
        }

        public void setRole(com.ashelabs.turing.entity.UserRole role) {
            this.role = role;
        }

        public Boolean getIsActive() {
            return isActive;
        }

        public void setIsActive(Boolean isActive) {
            this.isActive = isActive;
        }
    }

    public static class BulkUpdateRequest {
        private List<UserUpdateRequest> updates;

        // Getters and setters
        public List<UserUpdateRequest> getUpdates() {
            return updates;
        }

        public void setUpdates(List<UserUpdateRequest> updates) {
            this.updates = updates;
        }
    }

    public static class UserUpdateRequest {
        private String userId;
        private UpdateUserRequest updates;

        // Getters and setters
        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public UpdateUserRequest getUpdates() {
            return updates;
        }

        public void setUpdates(UpdateUserRequest updates) {
            this.updates = updates;
        }
    }
}
