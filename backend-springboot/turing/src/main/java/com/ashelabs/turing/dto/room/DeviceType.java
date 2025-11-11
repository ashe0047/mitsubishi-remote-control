package com.ashelabs.turing.dto.room;

/**
 * Enumeration of supported device types.
 * 
 * This enum defines the types of devices that can be managed
 * by the unified room API system.
 * 
 * @since 1.0.0
 */
public enum DeviceType {
    
    /**
     * Air conditioning unit.
     * Supports temperature, mode, fan, and vane control.
     */
    AIR_CONDITIONER("Air Conditioner"),
    
    /**
     * Lighting device.
     * Future support for smart lighting control.
     */
    LIGHTING("Lighting"),
    
    /**
     * Sensor device.
     * Future support for temperature, humidity sensors.
     */
    SENSOR("Sensor");

    private final String displayName;

    DeviceType(String displayName) {
        this.displayName = displayName;
    }

    /**
     * Get human-readable display name for the device type.
     * 
     * @return Display name
     */
    public String getDisplayName() {
        return displayName;
    }
}