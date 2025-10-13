package com.ashelabs.turing.controller;

import com.ashelabs.turing.entity.Household;
import com.ashelabs.turing.entity.User;
import com.ashelabs.turing.entity.UserRole;
import com.ashelabs.turing.entity.UserStatus;
import com.ashelabs.turing.repository.HouseholdRepository;
import com.ashelabs.turing.repository.UserRepository;
import com.ashelabs.turing.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Authentication controller for user registration, login, and session management.
 * Uses JWT tokens for secure authentication with embedded user information.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class AuthController {

    private final UserRepository userRepository;
    private final HouseholdRepository householdRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * Register a new user and optionally create a household
     * POST /api/auth/register
     */
    @PostMapping("/register")
    public Mono<ResponseEntity<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Attempting to register user: {}", request.getEmail());

        // Check if user already exists
        return userRepository.findByEmail(request.getEmail())
                .hasElement()
                .flatMap(userExists -> {
                    if (userExists) {
                        log.warn("User already exists: {}", request.getEmail());
                        return Mono.just(ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(RegisterResponse.builder()
                                        .success(false)
                                        .message("User already exists with this email")
                                        .build()));
                    }

                    // Create or find household
                    return createOrFindHousehold(request.getFamilyName())
                            .flatMap(household -> createUser(request, household.getId()))
                            .map(user -> {
                                log.info("Successfully registered user: {} in household: {}", 
                                    user.getEmail(), user.getHouseholdId());
                                
                                // Generate JWT tokens
                                String accessToken = jwtService.generateAccessToken(user);
                                String refreshToken = jwtService.generateRefreshToken(user);
                                
                                return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(RegisterResponse.builder()
                                                .success(true)
                                                .message("User registered successfully")
                                                .user(convertToUserResponse(user))
                                                .accessToken(accessToken)
                                                .refreshToken(refreshToken)
                                                .expiresIn(86400) // 24 hours
                                                .build());
                            })
                            .onErrorResume(error -> {
                                log.error("Registration failed for user: {}", request.getEmail(), error);
                                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(RegisterResponse.builder()
                                                .success(false)
                                                .message("Registration failed: " + error.getMessage())
                                                .build()));
                            });
                });
    }

    /**
     * Login user
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public Mono<ResponseEntity<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        log.info("Attempting login for user: {}", request.getEmail());

        return userRepository.findByEmail(request.getEmail())
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Invalid credentials")))
                .flatMap(user -> {
                    // Check if user is active
                    if (user.getStatus() != UserStatus.active) {
                        return Mono.error(new IllegalArgumentException("Account is not active"));
                    }
                    
                    // Verify password using BCrypt
                    if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                        return Mono.error(new IllegalArgumentException("Invalid credentials"));
                    }

                    log.info("Successfully logged in user: {}", user.getEmail());
                    
                    // Generate JWT tokens
                    String accessToken = jwtService.generateAccessToken(user);
                    String refreshToken = jwtService.generateRefreshToken(user);
                    
                    return Mono.just(ResponseEntity.ok(
                            LoginResponse.builder()
                                    .success(true)
                                    .message("Login successful")
                                    .user(convertToUserResponse(user))
                                    .accessToken(accessToken)
                                    .refreshToken(refreshToken)
                                    .expiresIn(86400) // 24 hours
                                    .build()));
                })
                .onErrorResume(error -> {
                    log.warn("Login failed for user: {}", request.getEmail(), error);
                    return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(LoginResponse.builder()
                                    .success(false)
                                    .message("Invalid credentials")
                                    .build()));
                });
    }

    /**
     * Get current user info (validate session)
     * GET /api/auth/me
     */
    @GetMapping("/me")
    public Mono<ResponseEntity<UserResponse>> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }

        String token = authorization.substring(7); // Remove "Bearer " prefix
        
        try {
            // Validate and extract user info from JWT
            if (!jwtService.validateToken(token)) {
                return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
            }
            
            JwtService.JwtUserInfo userInfo = jwtService.extractUserInfo(token);
            
            return userRepository.findById(userInfo.getUserId())
                    .map(user -> ResponseEntity.ok(convertToUserResponse(user)))
                    .switchIfEmpty(Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()))
                    .onErrorResume(error -> {
                        log.warn("Session validation failed", error);
                        return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
                    });
        } catch (IllegalArgumentException e) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }
    }

    /**
     * Refresh token (MVP implementation)
     * POST /api/auth/refresh
     */
    @PostMapping("/refresh")
    public Mono<ResponseEntity<LoginResponse>> refreshToken(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(LoginResponse.builder()
                            .success(false)
                            .message("Invalid refresh token")
                            .build()));
        }

        String refreshToken = authorization.substring(7);
        
        try {
            // Validate refresh token
            if (!jwtService.validateToken(refreshToken)) {
                return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(LoginResponse.builder()
                                .success(false)
                                .message("Invalid refresh token")
                                .build()));
            }
            
            // Extract user info from refresh token
            JwtService.JwtUserInfo userInfo = jwtService.extractUserInfo(refreshToken);
            
            return userRepository.findById(userInfo.getUserId())
                    .map(user -> {
                        // Generate new tokens
                        String newAccessToken = jwtService.generateAccessToken(user);
                        String newRefreshToken = jwtService.generateRefreshToken(user);
                        
                        return ResponseEntity.ok(
                                LoginResponse.builder()
                                        .success(true)
                                        .message("Token refreshed")
                                        .user(convertToUserResponse(user))
                                        .accessToken(newAccessToken)
                                        .refreshToken(newRefreshToken)
                                        .expiresIn(86400)
                                        .build());
                    })
                    .switchIfEmpty(Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(LoginResponse.builder()
                                    .success(false)
                                    .message("Invalid refresh token")
                                    .build())));
        } catch (IllegalArgumentException e) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(LoginResponse.builder()
                            .success(false)
                            .message("Invalid refresh token")
                            .build()));
        }
    }

    /**
     * Logout user
     * POST /api/auth/logout
     */
    @PostMapping("/logout")
    public Mono<ResponseEntity<Map<String, Object>>> logout() {
        // For MVP, logout is just a client-side operation
        return Mono.just(ResponseEntity.ok(Map.of("message", "Logged out successfully")));
    }

    // Helper methods

    private Mono<Household> createOrFindHousehold(String familyName) {
        if (familyName == null || familyName.trim().isEmpty()) {
            // Create a default household name based on timestamp
            familyName = "Family_" + Instant.now().getEpochSecond();
        }

        final String householdName = familyName.trim();
        
        return householdRepository.findByName(householdName)
                .switchIfEmpty(
                    Mono.defer(() -> {
                        Household newHousehold = Household.builder()
                                .name(householdName)
                                .createdAt(Instant.now())
                                .build();
                        return householdRepository.save(newHousehold);
                    })
                );
    }

    private Mono<User> createUser(RegisterRequest request, UUID householdId) {
        String hashedPassword = passwordEncoder.encode(request.getPassword());
        
        User user = User.builder()
                .email(request.getEmail())
                .name(request.getName())
                .householdId(householdId)
                .role(UserRole.parent) // First user in household is always parent
                .status(UserStatus.active)
                .passwordHash(hashedPassword)
                .preferences(null) // Set to null for JSONB field - can be updated later
                .emergencyContacts(null) // Will be null in database
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        return userRepository.save(user);
    }

    private UserResponse convertToUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().toString())
                .familyId(user.getHouseholdId().toString())
                .createdAt(user.getCreatedAt().toString())
                .updatedAt(user.getUpdatedAt().toString())
                .build();
    }

    // Request/Response DTOs

    @lombok.Data
    public static class RegisterRequest {
        private String email;
        private String name;
        private String password; // Not used in MVP but kept for frontend compatibility
        private String familyName;
    }

    @lombok.Data
    public static class LoginRequest {
        private String email;
        private String password; // Not used in MVP but kept for frontend compatibility
        private Boolean rememberMe;
    }

    @lombok.Data
    @lombok.Builder
    public static class RegisterResponse {
        private boolean success;
        private String message;
        private UserResponse user;
        private String accessToken;
        private String refreshToken;
        private Integer expiresIn;
    }

    @lombok.Data
    @lombok.Builder
    public static class LoginResponse {
        private boolean success;
        private String message;
        private UserResponse user;
        private String accessToken;
        private String refreshToken;
        private Integer expiresIn;
    }

    @lombok.Data
    @lombok.Builder
    public static class UserResponse {
        private String id;
        private String email;
        private String name;
        private String role;
        private String familyId;
        private String createdAt;
        private String updatedAt;
    }
}