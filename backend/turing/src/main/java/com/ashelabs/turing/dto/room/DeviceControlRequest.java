package com.ashelabs.turing.dto.room;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Base DTO for device control requests through the unified room API.
 * 
 * This DTO provides a unified interface for all device control operations,
 * allowing different types of device commands to be handled consistently
 * through the room-scoped endpoints.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceControlRequest {

    /**
     * The action to perform on the device.
     * Examples: "power_on", "power_off", "set_temperature", "set_mode", "set_fan", etc.
     */
    @NotBlank(message = "Action is required")
    private String action;

    /**
     * Primary value for the action (e.g., temperature value, mode name).
     * The interpretation depends on the action type.
     */
    private Object value;

    /**
     * Additional parameters for the device control operation.
     * This allows for flexible parameter passing without creating
     * separate DTOs for each device control type.
     */
    private Map<String, Object> parameters;

    /**
     * Estimated duration for the operation in minutes.
     * Used for quota validation and usage tracking.
     */
    private Integer estimatedDurationMinutes;

    /**
     * Get a parameter value as a specific type.
     * 
     * @param key Parameter key
     * @param type Expected type
     * @param <T> Type parameter
     * @return Parameter value cast to the specified type, or null if not found
     */
    @SuppressWarnings("unchecked")
    public <T> T getParameter(String key, Class<T> type) {
        if (parameters == null) {
            return null;
        }
        
        Object value = parameters.get(key);
        if (value == null || !type.isInstance(value)) {
            return null;
        }
        
        return (T) value;
    }

    /**
     * Get a string parameter.
     * 
     * @param key Parameter key
     * @return String value or null
     */
    public String getStringParameter(String key) {
        return getParameter(key, String.class);
    }

    /**
     * Get a double parameter.
     * 
     * @param key Parameter key
     * @return Double value or null
     */
    public Double getDoubleParameter(String key) {
        Object value = parameters != null ? parameters.get(key) : null;
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }

    /**
     * Get an integer parameter.
     * 
     * @param key Parameter key
     * @return Integer value or null
     */
    public Integer getIntegerParameter(String key) {
        Object value = parameters != null ? parameters.get(key) : null;
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return null;
    }

    /**
     * Check if a parameter exists.
     * 
     * @param key Parameter key
     * @return true if parameter exists
     */
    public boolean hasParameter(String key) {
        return parameters != null && parameters.containsKey(key);
    }
}