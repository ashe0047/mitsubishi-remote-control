package com.ashelabs.turing.exception;

/**
 * Exception thrown when a requested discovered device entry cannot be found.
 */
public class DiscoveredDeviceNotFoundException extends RuntimeException {

    private final String deviceIdentifier;

    public DiscoveredDeviceNotFoundException(String deviceIdentifier) {
        super("Discovered device not found: " + deviceIdentifier);
        this.deviceIdentifier = deviceIdentifier;
    }

    public String getDeviceIdentifier() {
        return deviceIdentifier;
    }
}
