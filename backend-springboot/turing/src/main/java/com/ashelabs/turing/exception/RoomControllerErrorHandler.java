package com.ashelabs.turing.exception;

import com.ashelabs.turing.dto.ApiErrorResponse;
import com.ashelabs.turing.dto.QuotaValidationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Centralized error handling and mapping strategy for room-related operations.
 * 
 * This class provides consistent error response generation with detailed
 * context information for different types of errors that can occur in
 * room and device control operations.
 */
@Slf4j
public class RoomControllerErrorHandler {



    /**
     * Maps service exceptions to appropriate HTTP responses with detailed error information.
     *
     * @param error The exception from service layer
     * @param path The request path
     * @return ResponseStatusException with appropriate HTTP status and ApiErrorResponse body
     */
    public static ResponseStatusException mapException(Throwable error, String path) {
        return mapException(error, path, generateCorrelationId());
    }

    /**
     * Maps service exceptions to appropriate HTTP responses with detailed error information.
     *
     * @param error The exception from service layer
     * @param path The request path
     * @param correlationId Correlation ID for tracking
     * @return ResponseStatusException with appropriate HTTP status and ApiErrorResponse body
     */
    public static ResponseStatusException mapException(Throwable error, String path, String correlationId) {
        // If already a ResponseStatusException, preserve it but enhance with ApiErrorResponse if needed
        if (error instanceof ResponseStatusException rse) {
            return enhanceResponseStatusException(rse, path, correlationId);
        }

        // Handle quota-related exceptions
        if (error instanceof QuotaExceededException qee) {
            return handleQuotaExceededException(qee, path, correlationId);
        }

        // Handle device communication exceptions
        if (error instanceof DeviceUnavailableException due) {
            return handleDeviceUnavailableException(due, path, correlationId);
        }

        // Handle room access exceptions
        if (error instanceof RoomAccessDeniedException rade) {
            return handleRoomAccessDeniedException(rade, path, correlationId);
        }

        // Handle standard Java exceptions
        if (error instanceof NoSuchElementException) {
            return handleNotFoundException(error, path, correlationId);
        }

        if (error instanceof IllegalArgumentException) {
            return handleBadRequestException(error, path, correlationId);
        }

        if (error instanceof IllegalStateException) {
            return handleConflictException(error, path, correlationId);
        }

        // Handle security exceptions
        if (error instanceof SecurityException) {
            return handleSecurityException(error, path, correlationId);
        }

        // Handle timeout exceptions
        if (error instanceof java.util.concurrent.TimeoutException) {
            return handleTimeoutException(error, path, correlationId);
        }

        // Check error message for specific patterns
        String errorMessage = error.getMessage();
        if (errorMessage != null) {
            if (errorMessage.toLowerCase().contains("quota")) {
                return handleQuotaRelatedError(error, path, correlationId);
            }
            
            if (errorMessage.toLowerCase().contains("device") || 
                errorMessage.toLowerCase().contains("mqtt")) {
                return handleDeviceRelatedError(error, path, correlationId);
            }
            
            if (errorMessage.toLowerCase().contains("unauthorized") || 
                errorMessage.toLowerCase().contains("forbidden")) {
                return handleAuthorizationError(error, path, correlationId);
            }
        }

        // Default to internal server error
        return handleInternalServerError(error, path, correlationId);
    }

    private static ResponseStatusException enhanceResponseStatusException(ResponseStatusException rse, 
                                                                        String path, String correlationId) {
        // If the exception already has a proper body, return as-is
        String reason = rse.getReason();
        if (reason != null && reason.startsWith("{")) {
            return rse;
        }

        // Create enhanced error response
        ApiErrorResponse errorResponse = createBasicErrorResponse(
            rse.getStatusCode().value(), 
            reason != null ? reason : "Request failed", 
            path, 
            correlationId
        );

        return new ResponseStatusException(rse.getStatusCode(), errorResponse.toString(), rse);
    }

    private static ResponseStatusException handleQuotaExceededException(QuotaExceededException qee, 
                                                                      String path, String correlationId) {
        log.warn("Quota exceeded for user {} in room {} for action {}: {}", 
                qee.getUserId(), qee.getRoomId(), qee.getAction(), qee.getMessage());

        Map<String, Object> quotaDetails = qee.getQuotaDetails();
        
        // Enhance quota details with additional context
        Map<String, Object> enhancedDetails = new java.util.HashMap<>(quotaDetails);
        enhancedDetails.put("userId", qee.getUserId().toString());
        if (qee.getRoomId() != null) {
            enhancedDetails.put("roomId", qee.getRoomId());
        }
        if (qee.getAction() != null) {
            enhancedDetails.put("attemptedAction", qee.getAction());
        }
        
        // Add quota-specific guidance
        if (qee.getValidationResult() != null) {
            QuotaValidationResult result = qee.getValidationResult();
            enhancedDetails.put("quotaStatus", result.getStatus().toString());
            if (result.getContext() != null) {
                enhancedDetails.put("quotaContext", result.getContext());
            }
        }

        ApiErrorResponse errorResponse = ApiErrorResponse.quotaExceeded(
            qee.getMessage(), path, enhancedDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.FORBIDDEN, errorResponse.toString(), qee);
    }

    private static ResponseStatusException handleDeviceUnavailableException(DeviceUnavailableException due, 
                                                                          String path, String correlationId) {
        log.warn("Device {} in room {} unavailable: {}", due.getDeviceId(), due.getRoomId(), due.getMessage());

        Map<String, Object> deviceDetails = due.getDeviceDetails();
        
        // Enhance device details with retry information
        Map<String, Object> enhancedDetails = new java.util.HashMap<>(deviceDetails);
        enhancedDetails.put("retryable", due.isRetryable());
        if (due.getSuggestedRetryDelayMs() != null) {
            enhancedDetails.put("suggestedRetryDelayMs", due.getSuggestedRetryDelayMs());
        }
        enhancedDetails.put("errorType", due.getErrorType());

        ApiErrorResponse errorResponse = ApiErrorResponse.deviceUnavailable(
            due.getMessage(), path, enhancedDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, errorResponse.toString(), due);
    }

    private static ResponseStatusException handleRoomAccessDeniedException(RoomAccessDeniedException rade, 
                                                                         String path, String correlationId) {
        log.warn("Room access denied for user {} to room {}: {}", 
                rade.getUserId(), rade.getRoomId(), rade.getMessage());

        Map<String, Object> authDetails = rade.getAuthDetails();
        
        // Enhance auth details with guidance
        Map<String, Object> enhancedDetails = new java.util.HashMap<>(authDetails);
        enhancedDetails.put("errorType", rade.getErrorType());
        
        // Add specific guidance based on error type
        if (rade.isRoleBasedDenial()) {
            enhancedDetails.put("guidance", "Contact a parent user to perform this operation");
        } else if (rade.isHouseholdBasedDenial()) {
            enhancedDetails.put("guidance", "This room is not accessible from your household");
        } else if (rade.isAssignmentBasedDenial()) {
            enhancedDetails.put("guidance", "You are not assigned to this room");
        }

        ApiErrorResponse errorResponse = ApiErrorResponse.forbidden(
            rade.getMessage(), path, enhancedDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.FORBIDDEN, errorResponse.toString(), rade);
    }

    private static ResponseStatusException handleNotFoundException(Throwable error, String path, String correlationId) {
        log.debug("Resource not found: {}", error.getMessage());

        Map<String, Object> resourceDetails = Map.of(
            "errorType", "RESOURCE_NOT_FOUND",
            "reason", error.getMessage() != null ? error.getMessage() : "Resource not found"
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.notFound(
            "The requested resource was not found", path, resourceDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.NOT_FOUND, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleBadRequestException(Throwable error, String path, String correlationId) {
        log.debug("Bad request: {}", error.getMessage());

        Map<String, Object> validationDetails = Map.of(
            "errorType", "INVALID_REQUEST",
            "reason", error.getMessage() != null ? error.getMessage() : "Invalid request parameters"
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.validationError(
            "The request contains invalid parameters", path, validationDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.BAD_REQUEST, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleConflictException(Throwable error, String path, String correlationId) {
        log.debug("Conflict: {}", error.getMessage());

        Map<String, Object> conflictDetails = Map.of(
            "errorType", "RESOURCE_CONFLICT",
            "reason", error.getMessage() != null ? error.getMessage() : "Resource conflict"
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.conflict(
            "The request conflicts with the current state of the resource", path, conflictDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.CONFLICT, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleSecurityException(Throwable error, String path, String correlationId) {
        log.warn("Security exception: {}", error.getMessage());

        ApiErrorResponse errorResponse = ApiErrorResponse.forbidden(
            "Access denied", path, Map.of("errorType", "SECURITY_VIOLATION")
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.FORBIDDEN, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleTimeoutException(Throwable error, String path, String correlationId) {
        log.warn("Operation timeout: {}", error.getMessage());

        Map<String, Object> timeoutDetails = Map.of(
            "errorType", "OPERATION_TIMEOUT",
            "retryable", true,
            "suggestedRetryDelayMs", 1000
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.serviceUnavailable(
            "The operation timed out. Please try again.", path, timeoutDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleQuotaRelatedError(Throwable error, String path, String correlationId) {
        log.warn("Quota-related error: {}", error.getMessage());

        Map<String, Object> quotaDetails = Map.of(
            "errorType", "QUOTA_ERROR",
            "reason", error.getMessage()
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.quotaExceeded(
            "Quota limit exceeded", path, quotaDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.FORBIDDEN, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleDeviceRelatedError(Throwable error, String path, String correlationId) {
        log.warn("Device-related error: {}", error.getMessage());

        Map<String, Object> deviceDetails = Map.of(
            "errorType", "DEVICE_ERROR",
            "reason", error.getMessage(),
            "retryable", true
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.deviceUnavailable(
            "Device communication error", path, deviceDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleAuthorizationError(Throwable error, String path, String correlationId) {
        log.warn("Authorization error: {}", error.getMessage());

        Map<String, Object> authDetails = Map.of(
            "errorType", "AUTHORIZATION_ERROR",
            "reason", error.getMessage()
        );

        ApiErrorResponse errorResponse = ApiErrorResponse.forbidden(
            "Access denied", path, authDetails
        ).withCorrelationId(correlationId);

        return new ResponseStatusException(HttpStatus.FORBIDDEN, errorResponse.toString(), error);
    }

    private static ResponseStatusException handleInternalServerError(Throwable error, String path, String correlationId) {
        log.error("Unexpected error in room controller", error);

        ApiErrorResponse errorResponse = ApiErrorResponse.internalServerError(
            "An unexpected error occurred. Please try again later.", path, correlationId
        );

        return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, errorResponse.toString(), error);
    }

    private static ApiErrorResponse createBasicErrorResponse(int status, String message, String path, String correlationId) {
        return ApiErrorResponse.builder()
            .error(getErrorTypeForStatus(status))
            .message(message)
            .status(status)
            .path(path)
            .timestamp(Instant.now())
            .correlationId(correlationId)
            .build();
    }

    private static String getErrorTypeForStatus(int status) {
        return switch (status) {
            case 400 -> "BadRequest";
            case 401 -> "Unauthorized";
            case 403 -> "Forbidden";
            case 404 -> "NotFound";
            case 409 -> "Conflict";
            case 500 -> "InternalServerError";
            case 503 -> "ServiceUnavailable";
            default -> "Error";
        };
    }

    private static String generateCorrelationId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}