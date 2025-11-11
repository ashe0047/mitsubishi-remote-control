package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Unified error response format for all room-related API operations.
 * 
 * This DTO provides a consistent error response structure across all endpoints,
 * including context-specific error details, HTTP status information, and
 * request tracking data for debugging and monitoring.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiErrorResponse {

    /**
     * High-level error category or type.
     * Examples: "ValidationError", "QuotaExceeded", "DeviceUnavailable", "NotFound"
     */
    private String error;

    /**
     * Human-readable error message for display to users.
     * Should be clear and actionable when possible.
     */
    private String message;

    /**
     * HTTP status code associated with this error.
     */
    private int status;

    /**
     * The request path that generated this error.
     * Useful for debugging and request correlation.
     */
    private String path;

    /**
     * Timestamp when the error occurred.
     */
    @Builder.Default
    private Instant timestamp = Instant.now();

    /**
     * Context-specific error details.
     * May include validation errors, quota information, device status, etc.
     */
    private Map<String, Object> details;

    /**
     * Unique correlation ID for tracking this error across logs and systems.
     * Optional but recommended for production debugging.
     */
    private String correlationId;

    /**
     * Internal error code for specific error conditions.
     * Used for programmatic error handling by clients.
     */
    private String errorCode;

    // Static factory methods for common error types

    /**
     * Creates a validation error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param validationDetails Map of field-level validation errors
     * @return ApiErrorResponse for validation errors
     */
    public static ApiErrorResponse validationError(String message, String path, Map<String, Object> validationDetails) {
        return ApiErrorResponse.builder()
            .error("ValidationError")
            .message(message)
            .status(400)
            .path(path)
            .details(validationDetails)
            .errorCode("VALIDATION_FAILED")
            .build();
    }

    /**
     * Creates a quota exceeded error response with detailed quota information.
     * 
     * @param message Error message
     * @param path Request path
     * @param quotaDetails Quota-specific information (current usage, limits, reset time, etc.)
     * @return ApiErrorResponse for quota violations
     */
    public static ApiErrorResponse quotaExceeded(String message, String path, Map<String, Object> quotaDetails) {
        return ApiErrorResponse.builder()
            .error("QuotaExceeded")
            .message(message)
            .status(403)
            .path(path)
            .details(quotaDetails)
            .errorCode("QUOTA_EXCEEDED")
            .build();
    }

    /**
     * Creates a device unavailable error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param deviceDetails Device-specific information (device ID, last seen, etc.)
     * @return ApiErrorResponse for device communication errors
     */
    public static ApiErrorResponse deviceUnavailable(String message, String path, Map<String, Object> deviceDetails) {
        return ApiErrorResponse.builder()
            .error("DeviceUnavailable")
            .message(message)
            .status(503)
            .path(path)
            .details(deviceDetails)
            .errorCode("DEVICE_UNAVAILABLE")
            .build();
    }

    /**
     * Creates a not found error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param resourceDetails Information about the requested resource
     * @return ApiErrorResponse for not found errors
     */
    public static ApiErrorResponse notFound(String message, String path, Map<String, Object> resourceDetails) {
        return ApiErrorResponse.builder()
            .error("NotFound")
            .message(message)
            .status(404)
            .path(path)
            .details(resourceDetails)
            .errorCode("RESOURCE_NOT_FOUND")
            .build();
    }

    /**
     * Creates an unauthorized error response.
     * 
     * @param message Error message
     * @param path Request path
     * @return ApiErrorResponse for authentication errors
     */
    public static ApiErrorResponse unauthorized(String message, String path) {
        return ApiErrorResponse.builder()
            .error("Unauthorized")
            .message(message)
            .status(401)
            .path(path)
            .errorCode("AUTHENTICATION_REQUIRED")
            .build();
    }

    /**
     * Creates a forbidden error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param authDetails Authorization-specific information
     * @return ApiErrorResponse for authorization errors
     */
    public static ApiErrorResponse forbidden(String message, String path, Map<String, Object> authDetails) {
        return ApiErrorResponse.builder()
            .error("Forbidden")
            .message(message)
            .status(403)
            .path(path)
            .details(authDetails)
            .errorCode("AUTHORIZATION_FAILED")
            .build();
    }

    /**
     * Creates a conflict error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param conflictDetails Information about the conflict
     * @return ApiErrorResponse for conflict errors
     */
    public static ApiErrorResponse conflict(String message, String path, Map<String, Object> conflictDetails) {
        return ApiErrorResponse.builder()
            .error("Conflict")
            .message(message)
            .status(409)
            .path(path)
            .details(conflictDetails)
            .errorCode("RESOURCE_CONFLICT")
            .build();
    }

    /**
     * Creates an internal server error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param correlationId Correlation ID for tracking
     * @return ApiErrorResponse for internal server errors
     */
    public static ApiErrorResponse internalServerError(String message, String path, String correlationId) {
        return ApiErrorResponse.builder()
            .error("InternalServerError")
            .message(message)
            .status(500)
            .path(path)
            .correlationId(correlationId)
            .errorCode("INTERNAL_ERROR")
            .build();
    }

    /**
     * Creates a service unavailable error response.
     * 
     * @param message Error message
     * @param path Request path
     * @param serviceDetails Information about the unavailable service
     * @return ApiErrorResponse for service unavailable errors
     */
    public static ApiErrorResponse serviceUnavailable(String message, String path, Map<String, Object> serviceDetails) {
        return ApiErrorResponse.builder()
            .error("ServiceUnavailable")
            .message(message)
            .status(503)
            .path(path)
            .details(serviceDetails)
            .errorCode("SERVICE_UNAVAILABLE")
            .build();
    }

    /**
     * Adds detail information to the error response.
     * 
     * @param key Detail key
     * @param value Detail value
     * @return This error response for method chaining
     */
    public ApiErrorResponse withDetail(String key, Object value) {
        if (this.details == null) {
            this.details = new java.util.HashMap<>();
        }
        this.details.put(key, value);
        return this;
    }

    /**
     * Sets the correlation ID for this error.
     * 
     * @param correlationId Correlation ID
     * @return This error response for method chaining
     */
    public ApiErrorResponse withCorrelationId(String correlationId) {
        this.correlationId = correlationId;
        return this;
    }

    /**
     * Sets the error code for this error.
     * 
     * @param errorCode Error code
     * @return This error response for method chaining
     */
    public ApiErrorResponse withErrorCode(String errorCode) {
        this.errorCode = errorCode;
        return this;
    }

    /**
     * Checks if this error has detail information.
     * 
     * @return true if details are present
     */
    public boolean hasDetails() {
        return details != null && !details.isEmpty();
    }

    /**
     * Gets a specific detail value.
     * 
     * @param key Detail key
     * @return Detail value or null if not present
     */
    public Object getDetail(String key) {
        return details != null ? details.get(key) : null;
    }

    /**
     * Checks if this is a client error (4xx status codes).
     * 
     * @return true if status is in 400-499 range
     */
    public boolean isClientError() {
        return status >= 400 && status < 500;
    }

    /**
     * Checks if this is a server error (5xx status codes).
     * 
     * @return true if status is in 500-599 range
     */
    public boolean isServerError() {
        return status >= 500 && status < 600;
    }

    /**
     * Checks if this is a quota-related error.
     * 
     * @return true if this is a quota error
     */
    public boolean isQuotaError() {
        return "QuotaExceeded".equals(error) || "QUOTA_EXCEEDED".equals(errorCode);
    }

    /**
     * Checks if this is a device-related error.
     * 
     * @return true if this is a device error
     */
    public boolean isDeviceError() {
        return "DeviceUnavailable".equals(error) || "DEVICE_UNAVAILABLE".equals(errorCode);
    }

    /**
     * Checks if this is an authentication/authorization error.
     * 
     * @return true if this is an auth error
     */
    public boolean isAuthError() {
        return "Unauthorized".equals(error) || "Forbidden".equals(error) ||
               "AUTHENTICATION_REQUIRED".equals(errorCode) || "AUTHORIZATION_FAILED".equals(errorCode);
    }
}