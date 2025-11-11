package com.ashelabs.turing.exception;

import lombok.Getter;

import java.time.Instant;
import java.util.Map;

/**
 * Exception thrown when a device is unavailable for control operations.
 * 
 * This exception carries device-specific information to help generate
 * comprehensive error responses and retry strategies.
 */
@Getter
public class DeviceUnavailableException extends RuntimeException {

    private final String deviceId;
    private final String roomId;
    private final String deviceType;
    private final Instant lastSeen;
    private final String unavailabilityReason;
    private final Map<String, Object> deviceDetails;

    public DeviceUnavailableException(String message, String deviceId, String roomId) {
        super(message);
        this.deviceId = deviceId;
        this.roomId = roomId;
        this.deviceType = null;
        this.lastSeen = null;
        this.unavailabilityReason = message;
        this.deviceDetails = null;
    }

    public DeviceUnavailableException(String message, String deviceId, String roomId, 
                                    String deviceType, Instant lastSeen) {
        super(message);
        this.deviceId = deviceId;
        this.roomId = roomId;
        this.deviceType = deviceType;
        this.lastSeen = lastSeen;
        this.unavailabilityReason = message;
        this.deviceDetails = null;
    }

    public DeviceUnavailableException(String message, String deviceId, String roomId, 
                                    Map<String, Object> deviceDetails) {
        super(message);
        this.deviceId = deviceId;
        this.roomId = roomId;
        this.deviceType = (String) (deviceDetails != null ? deviceDetails.get("deviceType") : null);
        this.lastSeen = (Instant) (deviceDetails != null ? deviceDetails.get("lastSeen") : null);
        this.unavailabilityReason = message;
        this.deviceDetails = deviceDetails;
    }

    /**
     * Creates a device unavailable exception for MQTT communication failure.
     * 
     * @param deviceId Device identifier
     * @param roomId Room identifier
     * @param cause Underlying MQTT exception
     * @return DeviceUnavailableException with MQTT details
     */
    public static DeviceUnavailableException mqttCommunicationFailure(String deviceId, String roomId, Throwable cause) {
        String message = String.format("Device %s in room %s is unavailable due to MQTT communication failure", 
                                      deviceId, roomId);
        Map<String, Object> details = Map.of(
            "communicationType", "MQTT",
            "errorType", "COMMUNICATION_FAILURE",
            "underlyingError", cause.getMessage(),
            "retryable", true
        );
        return new DeviceUnavailableException(message, deviceId, roomId, details);
    }

    /**
     * Creates a device unavailable exception for device timeout.
     * 
     * @param deviceId Device identifier
     * @param roomId Room identifier
     * @param timeoutMs Timeout duration in milliseconds
     * @return DeviceUnavailableException with timeout details
     */
    public static DeviceUnavailableException deviceTimeout(String deviceId, String roomId, long timeoutMs) {
        String message = String.format("Device %s in room %s did not respond within %dms", 
                                      deviceId, roomId, timeoutMs);
        Map<String, Object> details = Map.of(
            "errorType", "TIMEOUT",
            "timeoutMs", timeoutMs,
            "retryable", true,
            "suggestedRetryDelayMs", Math.min(timeoutMs * 2, 5000)
        );
        return new DeviceUnavailableException(message, deviceId, roomId, details);
    }

    /**
     * Creates a device unavailable exception for device offline status.
     * 
     * @param deviceId Device identifier
     * @param roomId Room identifier
     * @param lastSeen When the device was last seen online
     * @return DeviceUnavailableException with offline details
     */
    public static DeviceUnavailableException deviceOffline(String deviceId, String roomId, Instant lastSeen) {
        String message = String.format("Device %s in room %s is offline", deviceId, roomId);
        Map<String, Object> details = Map.of(
            "errorType", "DEVICE_OFFLINE",
            "lastSeen", lastSeen != null ? lastSeen.toString() : "unknown",
            "retryable", false
        );
        return new DeviceUnavailableException(message, deviceId, roomId, details);
    }

    /**
     * Gets device details for error response generation.
     * 
     * @return Map of device-specific details
     */
    public Map<String, Object> getDeviceDetails() {
        if (deviceDetails != null) {
            return deviceDetails;
        }
        
        // Build basic device details
        Map<String, Object> details = new java.util.HashMap<>();
        details.put("deviceId", deviceId);
        details.put("roomId", roomId);
        if (deviceType != null) {
            details.put("deviceType", deviceType);
        }
        if (lastSeen != null) {
            details.put("lastSeen", lastSeen.toString());
        }
        details.put("reason", unavailabilityReason);
        
        return details;
    }

    /**
     * Checks if this device error is retryable.
     * 
     * @return true if the operation can be retried
     */
    public boolean isRetryable() {
        if (deviceDetails != null) {
            Object retryable = deviceDetails.get("retryable");
            return retryable instanceof Boolean ? (Boolean) retryable : true;
        }
        return true; // Default to retryable
    }

    /**
     * Gets suggested retry delay in milliseconds.
     * 
     * @return Suggested delay before retry, or null if not specified
     */
    public Long getSuggestedRetryDelayMs() {
        if (deviceDetails != null) {
            Object delay = deviceDetails.get("suggestedRetryDelayMs");
            if (delay instanceof Number) {
                return ((Number) delay).longValue();
            }
        }
        return null;
    }

    /**
     * Gets the error type for this device unavailability.
     * 
     * @return Error type string
     */
    public String getErrorType() {
        if (deviceDetails != null) {
            Object errorType = deviceDetails.get("errorType");
            if (errorType instanceof String) {
                return (String) errorType;
            }
        }
        return "DEVICE_UNAVAILABLE";
    }

    /**
     * Gets the device identifier for consistency with other exceptions.
     * 
     * @return Device identifier
     */
    public String getDeviceIdentifier() {
        return deviceId;
    }
}