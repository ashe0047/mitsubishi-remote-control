package com.ashelabs.turing.exception;

/**
 * Exception thrown when attempting to register a device that already exists.
 * Results in HTTP 409 Conflict response.
 */
public class DeviceAlreadyExistsException extends RuntimeException {
    
    private final String deviceIdentifier;
    private final String roomId;

    public DeviceAlreadyExistsException(String deviceIdentifier, String roomId) {
        super(String.format("Device '%s' already exists in room '%s'", deviceIdentifier, roomId));
        this.deviceIdentifier = deviceIdentifier;
        this.roomId = roomId;
    }

    public String getDeviceIdentifier() {
        return deviceIdentifier;
    }

    public String getRoomId() {
        return roomId;
    }
}