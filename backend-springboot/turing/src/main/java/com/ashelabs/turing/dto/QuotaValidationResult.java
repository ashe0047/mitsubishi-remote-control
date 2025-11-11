package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Result of a quota validation operation.
 * 
 * This class encapsulates the outcome of validating an AC command against a user's quota,
 * providing detailed information about whether the command should be allowed, blocked,
 * or allowed with warnings.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaValidationResult {
    
    /**
     * The validation status determining if the command should proceed.
     */
    private ValidationStatus status;
    
    /**
     * Human-readable message explaining the validation result.
     * Used for user notifications and logging.
     */
    private String message;
    
    /**
     * Internal reason for the validation decision.
     * Used for debugging and monitoring.
     */
    private String reason;
    
    /**
     * Additional context data for the validation result.
     * May include remaining time, usage percentages, etc.
     */
    private Map<String, Object> context;
    
    /**
     * Timestamp when the validation was performed.
     */
    @Builder.Default
    private Instant validatedAt = Instant.now();
    
    /**
     * Time taken to perform the validation in milliseconds.
     * Used for performance monitoring.
     */
    private Long validationDurationMs;
    
    /**
     * Enumeration of possible validation outcomes.
     */
    public enum ValidationStatus {
        /**
         * Command is allowed without restrictions.
         */
        ALLOW,
        
        /**
         * Command is allowed but user should be warned (approaching limits).
         */
        ALLOW_WITH_WARNING,
        
        /**
         * Command is blocked due to quota violation.
         */
        BLOCK,
        
        /**
         * Command is allowed due to service failure (fail-safe mode).
         * The quota system is temporarily unavailable.
         */
        FAIL_OPEN
    }
    
    // Convenience methods for checking validation results
    
    /**
     * @return true if the command should be blocked
     */
    public boolean isBlocked() {
        return status == ValidationStatus.BLOCK;
    }
    
    /**
     * @return true if the command has warnings but should proceed
     */
    public boolean hasWarning() {
        return status == ValidationStatus.ALLOW_WITH_WARNING;
    }
    
    /**
     * @return true if the validation failed and command is allowed by fail-safe logic
     */
    public boolean isFailOpen() {
        return status == ValidationStatus.FAIL_OPEN;
    }
    
    /**
     * @return true if the command should be allowed (with or without warnings)
     */
    public boolean isAllowed() {
        return status == ValidationStatus.ALLOW || 
               status == ValidationStatus.ALLOW_WITH_WARNING || 
               status == ValidationStatus.FAIL_OPEN;
    }
    
    // Static factory methods for common validation results
    
    /**
     * Creates a result allowing the command without restrictions.
     * 
     * @param reason internal reason for allowing the command
     * @return validation result with ALLOW status
     */
    public static QuotaValidationResult allow(String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.ALLOW)
            .reason(reason)
            .build();
    }
    
    /**
     * Creates a result allowing the command with a user warning.
     * 
     * @param message warning message to display to user
     * @param reason internal reason for the warning
     * @return validation result with ALLOW_WITH_WARNING status
     */
    public static QuotaValidationResult allowWithWarning(String message, String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.ALLOW_WITH_WARNING)
            .message(message)
            .reason(reason)
            .build();
    }
    
    /**
     * Creates a result allowing the command with a user warning.
     * 
     * @param message warning message to display to user
     * @return validation result with ALLOW_WITH_WARNING status
     */
    public static QuotaValidationResult allowWithWarning(String message) {
        return allowWithWarning(message, message);
    }
    
    /**
     * Creates a result blocking the command due to quota violation.
     * 
     * @param message error message to display to user
     * @param reason internal reason for blocking
     * @return validation result with BLOCK status
     */
    public static QuotaValidationResult block(String message, String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.BLOCK)
            .message(message)
            .reason(reason)
            .build();
    }
    
    /**
     * Creates a result blocking the command due to quota violation.
     * 
     * @param message error message to display to user
     * @return validation result with BLOCK status
     */
    public static QuotaValidationResult block(String message) {
        return block(message, message);
    }
    
    /**
     * Creates a fail-safe result allowing the command when quota service is unavailable.
     * 
     * @param reason internal reason for the service failure
     * @return validation result with FAIL_OPEN status
     */
    public static QuotaValidationResult failOpen(String reason) {
        return QuotaValidationResult.builder()
            .status(ValidationStatus.FAIL_OPEN)
            .message("Quota service temporarily unavailable - command allowed")
            .reason(reason)
            .build();
    }
    
    /**
     * Adds context data to the validation result.
     * 
     * @param key context key
     * @param value context value
     * @return this validation result for method chaining
     */
    public QuotaValidationResult withContext(String key, Object value) {
        if (this.context == null) {
            this.context = new java.util.HashMap<>();
        }
        this.context.put(key, value);
        return this;
    }
    
    /**
     * Sets the validation duration for performance monitoring.
     * 
     * @param durationMs validation time in milliseconds
     * @return this validation result for method chaining
     */
    public QuotaValidationResult withDuration(Long durationMs) {
        this.validationDurationMs = durationMs;
        return this;
    }
}