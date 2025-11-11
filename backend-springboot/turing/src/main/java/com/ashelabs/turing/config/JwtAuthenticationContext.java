package com.ashelabs.turing.config;

import com.ashelabs.turing.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Utility class for extracting JWT user information in controllers.
 * Provides a centralized way to validate and extract user context from Authorization headers.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationContext {
    
    private final JwtService jwtService;
    
    /**
     * Extract user information from Authorization header
     * @param authorization The Authorization header value (Bearer token)
     * @return Mono containing user information or error if invalid
     */
    public Mono<JwtService.JwtUserInfo> extractUserFromToken(String authorization) {
        return resolveFromSecurityContext()
                .switchIfEmpty(Mono.defer(() -> decodeAuthorizationHeader(authorization)));
    }

    /**
     * Resolve the currently authenticated user from the reactive security context.
     *
     * @return Mono with user info or empty if security context not populated
     */
    public Mono<JwtService.JwtUserInfo> currentUser() {
        return resolveFromSecurityContext();
    }

    private Mono<JwtService.JwtUserInfo> resolveFromSecurityContext() {
        return ReactiveSecurityContextHolder.getContext()
                .map(SecurityContext::getAuthentication)
                .flatMap(this::fromAuthentication)
                .switchIfEmpty(Mono.empty());
    }

    private Mono<JwtService.JwtUserInfo> fromAuthentication(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return Mono.empty();
        }

        Object details = authentication.getDetails();
        if (details instanceof JwtService.JwtUserInfo userInfo) {
            return Mono.just(userInfo);
        }

        return Mono.empty();
    }

    private Mono<JwtService.JwtUserInfo> decodeAuthorizationHeader(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Mono.error(new IllegalArgumentException("Missing or invalid Authorization header"));
        }

        String token = authorization.substring(7); // Remove "Bearer " prefix
        
        try {
            if (!jwtService.validateToken(token)) {
                return Mono.error(new IllegalArgumentException("Invalid or expired token"));
            }
            
            JwtService.JwtUserInfo userInfo = jwtService.extractUserInfo(token);
            return Mono.just(userInfo);
            
        } catch (Exception e) {
            log.warn("Failed to extract user from JWT token: {}", e.getMessage());
            return Mono.error(new IllegalArgumentException("Invalid token", e));
        }
    }
    
    /**
     * Extract user ID from Authorization header
     * @param authorization The Authorization header value (Bearer token)
     * @return Mono containing user ID or error if invalid
     */
    public Mono<UUID> extractUserIdFromToken(String authorization) {
        return extractUserFromToken(authorization)
                .map(JwtService.JwtUserInfo::getUserId);
    }
    
    /**
     * Extract household ID from Authorization header
     * @param authorization The Authorization header value (Bearer token)
     * @return Mono containing household ID or error if invalid
     */
    public Mono<UUID> extractHouseholdIdFromToken(String authorization) {
        return extractUserFromToken(authorization)
                .map(JwtService.JwtUserInfo::getHouseholdId);
    }
    
    /**
     * Validate that the requesting user matches the expected user ID
     * @param authorization The Authorization header value (Bearer token)
     * @param expectedUserId The expected user ID
     * @return Mono containing user info if valid, error otherwise
     */
    public Mono<JwtService.JwtUserInfo> validateUserAccess(String authorization, UUID expectedUserId) {
        return extractUserFromToken(authorization)
                .filter(userInfo -> userInfo.getUserId().equals(expectedUserId))
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Access denied: User ID mismatch")));
    }
    
    /**
     * Validate that the requesting user belongs to the expected household
     * @param authorization The Authorization header value (Bearer token)
     * @param expectedHouseholdId The expected household ID
     * @return Mono containing user info if valid, error otherwise
     */
    public Mono<JwtService.JwtUserInfo> validateHouseholdAccess(String authorization, UUID expectedHouseholdId) {
        return extractUserFromToken(authorization)
                .filter(userInfo -> userInfo.getHouseholdId().equals(expectedHouseholdId))
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Access denied: Household ID mismatch")));
    }
    
    /**
     * Check if the user has parent role
     * @param userInfo User information from JWT
     * @return true if user is a parent, false otherwise
     */
    public boolean isParent(JwtService.JwtUserInfo userInfo) {
        return "parent".equalsIgnoreCase(userInfo.getRole());
    }
    
    /**
     * Check if the user has child role
     * @param userInfo User information from JWT
     * @return true if user is a child, false otherwise
     */
    public boolean isChild(JwtService.JwtUserInfo userInfo) {
        return "child".equalsIgnoreCase(userInfo.getRole());
    }
}
