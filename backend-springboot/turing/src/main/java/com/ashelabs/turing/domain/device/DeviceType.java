package com.ashelabs.turing.domain.device;

/**
 * Enum representing types of devices that can be registered and controlled.
 * Protocol-agnostic device type classification.
 */
public enum DeviceType {
    AIRCONDITIONER("airconditioner", "Air Conditioner"),
    THERMOSTAT("thermostat", "Thermostat"),
    HUMIDIFIER("humidifier", "Humidifier"),
    FAN("fan", "Fan");

    private final String code;
    private final String displayName;

    DeviceType(String code, String displayName) {
        this.code = code;
        this.displayName = displayName;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * Get DeviceType from code string.
     *
     * @param code Device type code (e.g., "airconditioner")
     * @return DeviceType enum
     * @throws IllegalArgumentException if code is unknown
     */
    public static DeviceType fromCode(String code) {
        for (DeviceType type : values()) {
            if (type.code.equalsIgnoreCase(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown device type: " + code);
    }
}
