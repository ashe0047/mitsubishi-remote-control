package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Represents an air conditioning command that needs to be validated against quotas.
 * 
 * This class encapsulates all information about an AC control command, including
 * the user, room, action type, and any additional context needed for quota validation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AirConCommand {
    
    /**
     * ID of the user issuing the command.
     */
    private UUID userId;
    
    /**
     * Room where the AC command is being executed.
     */
    @NotBlank(message = "Room ID is required")
    private String roomId;
    
    /**
     * Type of AC action being performed.
     * Examples: "power", "temperature", "mode", "fan", "vane", "widevane"
     */
    @NotBlank(message = "Action type is required")
    private String action;
    
    /**
     * Value for the action being performed.
     * Examples: "ON"/"OFF" for power, temperature number, mode string, etc.
     */
    @NotNull(message = "Action value is required")
    private Object value;
    
    /**
     * Timestamp when the command was created.
     */
    @Builder.Default
    private Instant timestamp = Instant.now();
    
    /**
     * Additional command metadata and context.
     * May include previous AC state, environmental conditions, etc.
     */
    private Map<String, Object> metadata;
    
    /**
     * Estimated duration for this command in seconds.
     * Used for predictive quota calculations.
     */
    private Integer estimatedDurationSeconds;
    
    /**
     * Priority level of this command.
     * Higher priority commands may override quota limits in emergency situations.
     */
    @Builder.Default
    private CommandPriority priority = CommandPriority.NORMAL;
    
    /**
     * Whether this command should bypass quota validation.
     * Only used for emergency overrides or system commands.
     */
    @Builder.Default
    private Boolean bypassQuota = false;
    
    /**
     * Source of the command (web, mobile app, automation, etc.).
     */
    @Builder.Default
    private String source = "unknown";
    
    /**
     * Command priority levels for quota enforcement.
     */
    public enum CommandPriority {
        /**
         * Low priority - strict quota enforcement.
         */
        LOW(0),
        
        /**
         * Normal priority - standard quota enforcement.
         */
        NORMAL(1),
        
        /**
         * High priority - may allow small quota overruns.
         */
        HIGH(2),
        
        /**
         * Emergency priority - bypasses most quota restrictions.
         */
        EMERGENCY(3);
        
        private final int level;
        
        CommandPriority(int level) {
            this.level = level;
        }
        
        public int getLevel() {
            return level;
        }
    }
    
    // Convenience constructors for common command types
    
    /**
     * Creates a simple command with just action and value.
     * 
     * @param action the AC action type
     * @param value the action value
     */
    public AirConCommand(String action, Object value) {
        this.action = action;
        this.value = value;
        this.timestamp = Instant.now();
        this.priority = CommandPriority.NORMAL;
        this.bypassQuota = false;
        this.source = "api";
    }
    
    /**
     * Creates a command with user and room context.
     * 
     * @param userId ID of the user issuing the command
     * @param roomId room where command is executed
     * @param action the AC action type
     * @param value the action value
     */
    public AirConCommand(UUID userId, String roomId, String action, Object value) {
        this(action, value);
        this.userId = userId;
        this.roomId = roomId;
    }
    
    // Utility methods for command analysis
    
    /**
     * Checks if this is a power-on command.
     * 
     * @return true if this command turns the AC on
     */
    public boolean isPowerOnCommand() {
        return "power".equalsIgnoreCase(action) && 
               "ON".equalsIgnoreCase(String.valueOf(value));
    }
    
    /**
     * Checks if this is a power-off command.
     * 
     * @return true if this command turns the AC off
     */
    public boolean isPowerOffCommand() {
        return "power".equalsIgnoreCase(action) && 
               "OFF".equalsIgnoreCase(String.valueOf(value));
    }
    
    /**
     * Checks if this is a temperature adjustment command.
     * 
     * @return true if this command changes temperature
     */
    public boolean isTemperatureCommand() {
        return "temperature".equalsIgnoreCase(action) || "temp".equalsIgnoreCase(action);
    }
    
    /**
     * Checks if this is a mode change command.
     * 
     * @return true if this command changes AC mode
     */
    public boolean isModeCommand() {
        return "mode".equalsIgnoreCase(action);
    }
    
    /**
     * Checks if this command requires quota validation.
     * Some commands like turning off AC or getting status don't consume quota.
     * 
     * @return true if quota validation is needed
     */
    public boolean requiresQuotaValidation() {
        if (bypassQuota) {
            return false;
        }
        
        // Power off commands typically don't consume quota
        if (isPowerOffCommand()) {
            return false;
        }
        
        // Read-only commands don't consume quota
        if ("status".equalsIgnoreCase(action) || "get".equalsIgnoreCase(action)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Gets the estimated quota impact of this command.
     * 
     * @return estimated usage impact based on command type
     */
    public Integer getEstimatedQuotaImpact() {
        if (estimatedDurationSeconds != null) {
            return estimatedDurationSeconds;
        }
        
        // Default estimates based on command type
        if (isPowerOnCommand()) {
            return 300; // 5 minutes default for turning on AC
        } else if (isTemperatureCommand() || isModeCommand()) {
            return 60; // 1 minute for adjustments (may extend existing session)
        }
        
        return 0;
    }
    
    /**
     * Adds metadata to the command.
     * 
     * @param key metadata key
     * @param value metadata value
     * @return this command for method chaining
     */
    public AirConCommand withMetadata(String key, Object value) {
        if (this.metadata == null) {
            this.metadata = new java.util.HashMap<>();
        }
        this.metadata.put(key, value);
        return this;
    }
    
    /**
     * Sets the estimated duration for quota calculations.
     * 
     * @param seconds estimated duration in seconds
     * @return this command for method chaining
     */
    public AirConCommand withEstimatedDuration(Integer seconds) {
        this.estimatedDurationSeconds = seconds;
        return this;
    }
    
    /**
     * Sets the command priority.
     * 
     * @param priority command priority level
     * @return this command for method chaining
     */
    public AirConCommand withPriority(CommandPriority priority) {
        this.priority = priority;
        return this;
    }
    
    /**
     * Marks this command to bypass quota validation.
     * Should only be used for emergency or system commands.
     * 
     * @return this command for method chaining
     */
    public AirConCommand bypassQuota() {
        this.bypassQuota = true;
        return this;
    }
    
    /**
     * Sets the command source for tracking and analytics.
     *
     * @param source command source identifier
     * @return this command for method chaining
     */
    public AirConCommand withSource(String source) {
        this.source = source;
        return this;
    }

    /**
     * Gets a metadata value by key.
     *
     * @param key metadata key
     * @return metadata value or null if not found
     */
    public Object getMetadata(String key) {
        return metadata != null ? metadata.get(key) : null;
    }

    @Override
    public String toString() {
        return String.format("AirConCommand{user=%s, room=%s, action=%s, value=%s, priority=%s}",
                           userId, roomId, action, value, priority);
    }
}