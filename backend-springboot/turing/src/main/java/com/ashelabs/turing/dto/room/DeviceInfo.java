package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.AirConSettings;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO representing device information with current status integration.
 * 
 * This DTO combines device metadata with real-time status information,
 * providing a unified view of device state for room responses.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceInfo {

    /**
     * Unique device identifier (UUID).
     * This is the internal database ID for the device.
     */
    private UUID id;

    /**
     * Device identifier used for MQTT communication.
     * This is the stable business identifier used in MQTT topics.
     * Example: "living-room", "master-bedroom"
     */
    private String deviceIdentifier;

    /**
     * Type of device.
     * Currently supports: AIR_CONDITIONER
     */
    private DeviceType type;

    /**
     * Human-readable device name.
     * Example: "Living Room AC", "Master Bedroom Air Conditioner"
     */
    private String name;

    /**
     * Device manufacturer.
     * Example: "Mitsubishi Electric"
     */
    private String manufacturer;

    /**
     * Device model.
     * Example: "MSZ-FH25VE"
     */
    private String model;

    /**
     * Whether the device is enabled for use.
     * Disabled devices cannot be controlled.
     */
    private boolean enabled;

    /**
     * Whether the device is currently online and responding.
     * Based on recent MQTT communication.
     */
    private boolean online;

    /**
     * Current device status information.
     * Null if device is offline or status unavailable.
     */
    private DeviceStatus currentStatus;

    /**
     * Timestamp when device status was last updated.
     * Null if no status has been received.
     */
    private Instant lastStatusUpdate;

    /**
     * Active usage session for this device.
     * Present when a user has an active session with this device.
     * Null if no active session exists.
     */
    private com.ashelabs.turing.entity.UsageSession activeSession;

    /**
     * Factory method to create DeviceInfo from device identifier and status.
     * 
     * This method handles the case where we only have MQTT-based device information
     * without a formal Device entity, which is the current system state.
     * 
     * @param deviceIdentifier The device identifier used in MQTT
     * @param name The device name (can be same as identifier if not available)
     * @param state Current AC state from MQTT
     * @param settings Current AC settings from MQTT
     * @param online Whether device is online
     * @return DeviceInfo instance
     */
    public static DeviceInfo fromMqttDevice(String deviceIdentifier, String name, 
                                          AirConState state, AirConSettings settings, boolean online) {
        return fromMqttDevice(deviceIdentifier, name, state, settings, online, null);
    }

    /**
     * Factory method to create DeviceInfo from device identifier, status, and session information.
     * 
     * This method handles the case where we have MQTT-based device information
     * along with active session data.
     * 
     * @param deviceIdentifier The device identifier used in MQTT
     * @param name The device name (can be same as identifier if not available)
     * @param state Current AC state from MQTT
     * @param settings Current AC settings from MQTT
     * @param online Whether device is online
     * @param activeSession Active usage session (if any)
     * @return DeviceInfo instance
     */
    public static DeviceInfo fromMqttDevice(String deviceIdentifier, String name, 
                                          AirConState state, AirConSettings settings, boolean online,
                                          com.ashelabs.turing.entity.UsageSession activeSession) {
        DeviceStatus status = null;
        Instant lastUpdate = null;
        
        if (state != null || settings != null) {
            status = DeviceStatus.fromAirConData(state, settings);
            lastUpdate = Instant.now();
        }
        
        return DeviceInfo.builder()
            .id(null) // No UUID available for MQTT-only devices
            .deviceIdentifier(deviceIdentifier)
            .type(DeviceType.AIR_CONDITIONER)
            .name(name != null ? name : deviceIdentifier)
            .manufacturer("Mitsubishi Electric") // Default for current system
            .model("Unknown") // Model not available from MQTT
            .enabled(true) // Assume enabled if present in MQTT
            .online(online)
            .currentStatus(status)
            .lastStatusUpdate(lastUpdate)
            .activeSession(activeSession)
            .build();
    }

    /**
     * Factory method to create DeviceInfo when device is offline.
     * 
     * @param deviceIdentifier The device identifier
     * @param name The device name
     * @return DeviceInfo instance with offline status
     */
    public static DeviceInfo offline(String deviceIdentifier, String name) {
        return offline(deviceIdentifier, name, null);
    }

    /**
     * Factory method to create DeviceInfo when device is offline with session information.
     * 
     * @param deviceIdentifier The device identifier
     * @param name The device name
     * @param activeSession Active usage session (if any)
     * @return DeviceInfo instance with offline status
     */
    public static DeviceInfo offline(String deviceIdentifier, String name, 
                                   com.ashelabs.turing.entity.UsageSession activeSession) {
        return DeviceInfo.builder()
            .id(null)
            .deviceIdentifier(deviceIdentifier)
            .type(DeviceType.AIR_CONDITIONER)
            .name(name != null ? name : deviceIdentifier)
            .manufacturer("Mitsubishi Electric")
            .model("Unknown")
            .enabled(true)
            .online(false)
            .currentStatus(null)
            .lastStatusUpdate(null)
            .activeSession(activeSession)
            .build();
    }

    /**
     * Check if device has active status (powered on and in active mode).
     * 
     * @return true if device is online and actively running
     */
    public boolean hasActiveStatus() {
        if (!online || currentStatus == null) {
            return false;
        }
        
        String power = currentStatus.getPower();
        String mode = currentStatus.getMode();
        
        return "ON".equalsIgnoreCase(power) && 
               mode != null && 
               !"off".equalsIgnoreCase(mode);
    }

    /**
     * Get current room temperature if available.
     * 
     * @return Room temperature or null if not available
     */
    public Double getCurrentRoomTemperature() {
        if (currentStatus == null) {
            return null;
        }
        return currentStatus.getRoomTemperature();
    }

    /**
     * Check if device has an active usage session.
     * 
     * @return true if device has an active session
     */
    public boolean hasActiveSession() {
        return activeSession != null && activeSession.getEndedAt() == null;
    }

    /**
     * Get the user ID of the active session if available.
     * 
     * @return User ID or null if no active session
     */
    public java.util.UUID getActiveSessionUserId() {
        return hasActiveSession() ? activeSession.getUserId() : null;
    }

    /**
     * Get the duration of the active session in minutes.
     * 
     * @return Session duration in minutes or null if no active session
     */
    public Long getActiveSessionDurationMinutes() {
        if (!hasActiveSession()) {
            return null;
        }
        
        java.time.Duration duration = java.time.Duration.between(
            activeSession.getStartedAt(), 
            java.time.Instant.now()
        );
        return duration.toMinutes();
    }

    /**
     * Check if device is in use (has active status and active session).
     * 
     * @return true if device is actively being used
     */
    public boolean isInUse() {
        return hasActiveStatus() && hasActiveSession();
    }

    /**
     * Add or update active session information.
     * 
     * @param session Active usage session
     * @return This DeviceInfo for method chaining
     */
    public DeviceInfo withActiveSession(com.ashelabs.turing.entity.UsageSession session) {
        this.activeSession = session;
        return this;
    }

    /**
     * Clear active session information.
     * 
     * @return This DeviceInfo for method chaining
     */
    public DeviceInfo clearActiveSession() {
        this.activeSession = null;
        return this;
    }
}