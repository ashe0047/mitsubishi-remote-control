package com.ashelabs.turing.domain.device;

import java.util.regex.Pattern;

/**
 * Value object representing a protocol-agnostic device identifier.
 * Format: lowercase alphanumeric with hyphens and underscores only.
 * Examples: "ac_bedroom_main", "thermostat-living-01"
 *
 * This identifier is used across all protocols (MQTT, HTTP, WebSocket, etc.)
 * to uniquely identify a device without being tied to any specific protocol.
 */
public record DeviceIdentifier(String value) {

    private static final Pattern VALID_PATTERN = Pattern.compile("^[a-z0-9_-]+$");
    private static final int MAX_LENGTH = 255;

    /**
     * Compact constructor for validation.
     * Validates device identifier format on construction.
     *
     * @throws IllegalArgumentException if identifier is invalid
     */
    public DeviceIdentifier {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Device identifier cannot be null or blank");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                String.format("Device identifier exceeds maximum length of %d characters", MAX_LENGTH)
            );
        }
        if (!VALID_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(
                "Device identifier must be lowercase alphanumeric with hyphens or underscores only. Got: " + value
            );
        }
    }

    @Override
    public String toString() {
        return value;
    }
}
