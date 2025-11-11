package com.ashelabs.turing.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.time.Instant;
import java.util.Map;

/**
 * Global exception handler for device-related exceptions.
 * Maps domain exceptions to appropriate HTTP status codes and error responses.
 */
@RestControllerAdvice
public class DeviceExceptionHandler {

    /**
     * Handle device already exists exceptions.
     * Maps to HTTP 409 Conflict with structured error response.
     */
    @ExceptionHandler(DeviceAlreadyExistsException.class)
    public ResponseEntity<Map<String, Object>> handleDeviceAlreadyExists(
            DeviceAlreadyExistsException ex, 
            WebRequest request) {
        
        Map<String, Object> errorResponse = Map.of(
            "error", "DEVICE_ALREADY_EXISTS",
            "message", "A device with this identifier already exists in the specified room",
            "status", HttpStatus.CONFLICT.value(),
            "timestamp", Instant.now().toString(),
            "path", request.getDescription(false).replace("uri=", ""),
            "details", Map.of(
                "deviceIdentifier", ex.getDeviceIdentifier(),
                "roomId", ex.getRoomId(),
                "userMessage", String.format("Device '%s' is already registered in this room. Please use a different identifier or update the existing device.", ex.getDeviceIdentifier()),
                "suggestion", "Use a different device identifier or update the existing device",
                "errorCode", "DEVICE_DUPLICATE"
            )
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
    }

    /**
     * Handle device unavailable exceptions.
     * Maps to HTTP 503 Service Unavailable.
     */
    @ExceptionHandler(DeviceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleDeviceUnavailable(
            DeviceUnavailableException ex, 
            WebRequest request) {
        
        Map<String, Object> errorResponse = Map.of(
            "error", "DEVICE_UNAVAILABLE",
            "message", "Device is currently unavailable for communication",
            "status", HttpStatus.SERVICE_UNAVAILABLE.value(),
            "timestamp", Instant.now().toString(),
            "path", request.getDescription(false).replace("uri=", ""),
            "details", Map.of(
                "deviceIdentifier", ex.getDeviceIdentifier() != null ? ex.getDeviceIdentifier() : "unknown",
                "userMessage", "The device is currently offline or not responding. Please check the device connection and try again.",
                "suggestion", "Check device power and network connection, then retry",
                "errorCode", "DEVICE_OFFLINE",
                "retryable", true
            )
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errorResponse);
    }

    /**
     * Handle missing discovered device entries.
     */
    @ExceptionHandler(DiscoveredDeviceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleDiscoveredDeviceNotFound(
            DiscoveredDeviceNotFoundException ex,
            WebRequest request) {

        Map<String, Object> errorResponse = Map.of(
            "error", "DISCOVERED_DEVICE_NOT_FOUND",
            "message", "Discovered device entry was not found",
            "status", HttpStatus.NOT_FOUND.value(),
            "timestamp", Instant.now().toString(),
            "path", request.getDescription(false).replace("uri=", ""),
            "details", Map.of(
                "deviceIdentifier", ex.getDeviceIdentifier(),
                "userMessage", String.format("Discovered device '%s' is no longer available for registration. Please rescan or wait for the device to broadcast again.", ex.getDeviceIdentifier()),
                "suggestion", "Trigger discovery again by toggling the device or wait for the next MQTT broadcast",
                "errorCode", "DISCOVERY_NOT_FOUND"
            )
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * Handle invalid discovery registration attempts.
     */
    @ExceptionHandler(InvalidDeviceDiscoveryRequestException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidDiscoveryRequest(
            InvalidDeviceDiscoveryRequestException ex,
            WebRequest request) {

        Map<String, Object> errorResponse = Map.of(
            "error", "INVALID_DEVICE_DISCOVERY_REQUEST",
            "message", ex.getMessage(),
            "status", HttpStatus.BAD_REQUEST.value(),
            "timestamp", Instant.now().toString(),
            "path", request.getDescription(false).replace("uri=", ""),
            "details", Map.of(
                "userMessage", ex.getMessage(),
                "suggestion", "Ensure roomId and deviceType are provided when registering a discovered device",
                "errorCode", "DISCOVERY_INVALID_REQUEST"
            )
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

}
