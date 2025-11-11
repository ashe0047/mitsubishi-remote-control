package com.ashelabs.turing.service;

import com.ashelabs.turing.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Service for JWT token generation, validation and user information extraction.
 * Provides secure token-based authentication with embedded user context.
 */
@Service
@Slf4j
public class JwtService {

    // Use a secure secret key for JWT signing
    private final SecretKey key = Keys.hmacShaKeyFor(
        "MySecureJwtSigningKeyForMitsubishiRemoteControlAppThatIs256BitsLong".getBytes()
    );
    
    @Value("${jwt.expiration-hours:24}")
    private int jwtExpirationHours;
    
    @Value("${jwt.refresh-expiration-days:7}")
    private int refreshExpirationDays;

    /**
     * Generate access token for user
     */
    public String generateAccessToken(User user) {
        return generateToken(user, jwtExpirationHours, ChronoUnit.HOURS);
    }

    /**
     * Generate refresh token for user (longer expiration)
     */
    public String generateRefreshToken(User user) {
        return generateToken(user, refreshExpirationDays, ChronoUnit.DAYS);
    }

    /**
     * Generate token with custom expiration
     */
    private String generateToken(User user, int expirationAmount, ChronoUnit unit) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId().toString());
        claims.put("email", user.getEmail());
        claims.put("name", user.getName());
        claims.put("role", user.getRole().getValue());
        claims.put("householdId", user.getHouseholdId().toString());
        claims.put("status", user.getStatus().getValue());
        
        Instant now = Instant.now();
        Instant expiration = now.plus(expirationAmount, unit);
        
        return Jwts.builder()
                .claims(claims)
                .subject(user.getEmail())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(key)
                .compact();
    }

    /**
     * Extract user information from JWT token
     */
    public JwtUserInfo extractUserInfo(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return JwtUserInfo.builder()
                    .userId(UUID.fromString(claims.get("userId", String.class)))
                    .email(claims.get("email", String.class))
                    .name(claims.get("name", String.class))
                    .role(claims.get("role", String.class))
                    .householdId(UUID.fromString(claims.get("householdId", String.class)))
                    .status(claims.get("status", String.class))
                    .subject(claims.getSubject())
                    .issuedAt(claims.getIssuedAt().toInstant())
                    .expiresAt(claims.getExpiration().toInstant())
                    .build();
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Failed to extract user info from JWT token: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid JWT token", e);
        }
    }

    /**
     * Validate JWT token
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT token validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Check if token is expired
     */
    public boolean isTokenExpired(String token) {
        try {
            Date expiration = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getExpiration();
            return expiration.before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return true; // Consider invalid tokens as expired
        }
    }

    /**
     * Extract subject (email) from token
     */
    public String extractSubject(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid JWT token", e);
        }
    }

    /**
     * Data class to hold user information extracted from JWT
     */
    @lombok.Data
    @lombok.Builder
    public static class JwtUserInfo {
        private UUID userId;
        private String email;
        private String name;
        private String role;
        private UUID householdId;
        private String status;
        private String subject;
        private Instant issuedAt;
        private Instant expiresAt;
    }
}