package com.ashelabs.turing.exception;

import com.ashelabs.turing.dto.QuotaValidationResult;
import lombok.Getter;

import java.util.Map;
import java.util.UUID;

/**
 * Exception thrown when a user's quota limits are exceeded.
 * 
 * This exception carries detailed quota information to help generate
 * comprehensive error responses for clients.
 */
@Getter
public class QuotaExceededException extends RuntimeException {

    private final UUID userId;
    private final String roomId;
    private final String action;
    private final QuotaValidationResult validationResult;
    private final Map<String, Object> quotaDetails;

    public QuotaExceededException(String message, UUID userId, String roomId, String action, 
                                 QuotaValidationResult validationResult) {
        super(message);
        this.userId = userId;
        this.roomId = roomId;
        this.action = action;
        this.validationResult = validationResult;
        this.quotaDetails = validationResult != null ? validationResult.getContext() : null;
    }

    public QuotaExceededException(String message, UUID userId, String roomId, String action, 
                                 Map<String, Object> quotaDetails) {
        super(message);
        this.userId = userId;
        this.roomId = roomId;
        this.action = action;
        this.validationResult = null;
        this.quotaDetails = quotaDetails;
    }

    public QuotaExceededException(String message, UUID userId, String roomId) {
        this(message, userId, roomId, null, (Map<String, Object>) null);
    }

    /**
     * Creates a quota exceeded exception from a validation result.
     * 
     * @param validationResult The quota validation result that was blocked
     * @param userId User ID
     * @param roomId Room ID
     * @param action Action that was attempted
     * @return QuotaExceededException with validation details
     */
    public static QuotaExceededException fromValidationResult(QuotaValidationResult validationResult, 
                                                            UUID userId, String roomId, String action) {
        String message = validationResult.getMessage() != null ? 
            validationResult.getMessage() : "Quota limit exceeded";
        return new QuotaExceededException(message, userId, roomId, action, validationResult);
    }

    /**
     * Gets quota details for error response generation.
     * 
     * @return Map of quota-specific details
     */
    public Map<String, Object> getQuotaDetails() {
        if (quotaDetails != null) {
            return quotaDetails;
        }
        
        // Build basic quota details if validation result is available
        if (validationResult != null) {
            Map<String, Object> details = new java.util.HashMap<>();
            details.put("quotaStatus", validationResult.getStatus().toString());
            details.put("reason", validationResult.getReason());
            if (validationResult.getContext() != null) {
                details.putAll(validationResult.getContext());
            }
            return details;
        }
        
        return Map.of();
    }

    /**
     * Checks if this exception has detailed quota information.
     * 
     * @return true if quota details are available
     */
    public boolean hasQuotaDetails() {
        return (quotaDetails != null && !quotaDetails.isEmpty()) || validationResult != null;
    }
}