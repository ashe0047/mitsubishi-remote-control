package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.entity.UsageSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Enhanced DTO for device control operation responses with integrated quota and session information.
 * 
 * This DTO provides a comprehensive response format for all device control operations
 * performed through the unified room API, including success status, updated room information,
 * quota validation results, and session management information.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceControlResponse {

    /**
     * Whether the device control operation was successful.
     */
    private boolean success;

    /**
     * Human-readable message describing the operation result.
     */
    private String message;

    /**
     * The room ID where the operation was performed.
     */
    private UUID roomId;

    /**
     * The device identifier that was controlled.
     */
    private String deviceId;

    /**
     * The action that was performed.
     */
    private String action;

    /**
     * Updated room information after the device control operation.
     * This allows clients to immediately see the effects of the operation
     * without requiring a separate API call.
     */
    private RoomResponse updatedRoom;

    /**
     * Quota validation results for this device control operation.
     * Contains information about whether the operation was allowed,
     * blocked, or allowed with warnings due to quota constraints.
     */
    private QuotaValidationResult quotaResult;

    /**
     * Usage session information when applicable.
     * Present when the operation starts or ends a usage session
     * (e.g., turning device on/off).
     */
    private UsageSession session;

    /**
     * Timestamp when the operation was completed.
     */
    private Instant timestamp;

    /**
     * Additional metadata about the operation.
     * May include performance metrics, retry information, etc.
     */
    private Map<String, Object> metadata;

    /**
     * Factory method for successful device control operation with quota and session information.
     * 
     * @param roomId Room ID
     * @param deviceId Device ID
     * @param action Action performed
     * @param message Success message
     * @param updatedRoom Updated room data
     * @param quotaResult Quota validation result
     * @param session Usage session (if applicable)
     * @return DeviceControlResponse for successful operation
     */
    public static DeviceControlResponse success(UUID roomId, String deviceId, String action, 
                                              String message, RoomResponse updatedRoom,
                                              QuotaValidationResult quotaResult, UsageSession session) {
        return DeviceControlResponse.builder()
            .success(true)
            .message(message)
            .roomId(roomId)
            .deviceId(deviceId)
            .action(action)
            .updatedRoom(updatedRoom)
            .quotaResult(quotaResult)
            .session(session)
            .timestamp(Instant.now())
            .build();
    }

    /**
     * Factory method for successful device control operation (backward compatibility).
     * 
     * @param roomId Room ID
     * @param deviceId Device ID
     * @param action Action performed
     * @param message Success message
     * @param updatedRoom Updated room data
     * @return DeviceControlResponse for successful operation
     */
    public static DeviceControlResponse success(UUID roomId, String deviceId, String action, 
                                              String message, RoomResponse updatedRoom) {
        return success(roomId, deviceId, action, message, updatedRoom, null, null);
    }

    /**
     * Factory method for quota-blocked device control operation.
     * 
     * @param roomId Room ID
     * @param deviceId Device ID
     * @param action Action attempted
     * @param quotaResult Quota validation result with block status
     * @return DeviceControlResponse for quota-blocked operation
     */
    public static DeviceControlResponse quotaBlocked(UUID roomId, String deviceId, String action, 
                                                   QuotaValidationResult quotaResult) {
        return DeviceControlResponse.builder()
            .success(false)
            .message(quotaResult.getMessage() != null ? quotaResult.getMessage() : "Operation blocked by quota limits")
            .roomId(roomId)
            .deviceId(deviceId)
            .action(action)
            .quotaResult(quotaResult)
            .timestamp(Instant.now())
            .build();
    }

    /**
     * Factory method for failed device control operation with quota information.
     * 
     * @param roomId Room ID
     * @param deviceId Device ID
     * @param action Action attempted
     * @param message Error message
     * @param quotaResult Quota validation result (if available)
     * @return DeviceControlResponse for failed operation
     */
    public static DeviceControlResponse failure(UUID roomId, String deviceId, String action, 
                                              String message, QuotaValidationResult quotaResult) {
        return DeviceControlResponse.builder()
            .success(false)
            .message(message)
            .roomId(roomId)
            .deviceId(deviceId)
            .action(action)
            .quotaResult(quotaResult)
            .timestamp(Instant.now())
            .build();
    }

    /**
     * Factory method for failed device control operation (backward compatibility).
     * 
     * @param roomId Room ID
     * @param deviceId Device ID
     * @param action Action attempted
     * @param message Error message
     * @return DeviceControlResponse for failed operation
     */
    public static DeviceControlResponse failure(UUID roomId, String deviceId, String action, String message) {
        return failure(roomId, deviceId, action, message, null);
    }

    /**
     * Add metadata to the response.
     * 
     * @param key Metadata key
     * @param value Metadata value
     * @return This response for method chaining
     */
    public DeviceControlResponse withMetadata(String key, Object value) {
        if (this.metadata == null) {
            this.metadata = new java.util.HashMap<>();
        }
        this.metadata.put(key, value);
        return this;
    }

    /**
     * Check if the operation was successful.
     * 
     * @return true if successful
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * Check if the operation failed.
     * 
     * @return true if failed
     */
    public boolean isFailure() {
        return !success;
    }

    /**
     * Check if the operation was blocked by quota limits.
     * 
     * @return true if blocked by quota
     */
    public boolean isQuotaBlocked() {
        return quotaResult != null && quotaResult.isBlocked();
    }

    /**
     * Check if the operation has quota warnings.
     * 
     * @return true if quota warnings are present
     */
    public boolean hasQuotaWarning() {
        return quotaResult != null && quotaResult.hasWarning();
    }

    /**
     * Check if a usage session was started by this operation.
     * 
     * @return true if session was started
     */
    public boolean hasSessionStarted() {
        return session != null && session.getEndedAt() == null;
    }

    /**
     * Check if a usage session was ended by this operation.
     * 
     * @return true if session was ended
     */
    public boolean hasSessionEnded() {
        return session != null && session.getEndedAt() != null;
    }

    /**
     * Get quota validation status if available.
     * 
     * @return Quota validation status or null
     */
    public QuotaValidationResult.ValidationStatus getQuotaStatus() {
        return quotaResult != null ? quotaResult.getStatus() : null;
    }

    /**
     * Add quota validation result to the response.
     * 
     * @param quotaResult Quota validation result
     * @return This response for method chaining
     */
    public DeviceControlResponse withQuotaResult(QuotaValidationResult quotaResult) {
        this.quotaResult = quotaResult;
        return this;
    }

    /**
     * Add session information to the response.
     * 
     * @param session Usage session
     * @return This response for method chaining
     */
    public DeviceControlResponse withSession(UsageSession session) {
        this.session = session;
        return this;
    }
}