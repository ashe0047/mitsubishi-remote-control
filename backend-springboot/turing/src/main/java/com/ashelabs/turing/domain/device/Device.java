package com.ashelabs.turing.domain.device;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Device domain entity representing a protocol-agnostic device in a room.
 * Immutable record with factory methods for creation and updates.
 *
 * This follows the Rich Domain Model pattern with behavior encapsulated
 * in the domain entity itself.
 */
public record Device(
    UUID id,
    UUID roomId,
    DeviceType deviceType,
    DeviceIdentifier deviceIdentifier,
    String manufacturer,
    String model,
    boolean enabled,
    Map<String, Object> metadata,
    Timestamp createdAt,
    Timestamp updatedAt
) {

    /**
     * Create a new device with minimal required fields.
     *
     * @param roomId Room UUID
     * @param deviceType Type of device
     * @param identifier Device identifier string
     * @return New Device instance
     */
    public static Device create(UUID roomId, DeviceType deviceType, String identifier) {
        return new Device(
            null, // Let the database generate the ID
            roomId,
            deviceType,
            new DeviceIdentifier(identifier),  // Validates format
            null,
            null,
            true,
            new HashMap<>(),
            Timestamp.from(Instant.now()),
            Timestamp.from(Instant.now())
        );
    }

    /**
     * Create a new device with full details.
     *
     * @param roomId Room UUID
     * @param deviceType Type of device
     * @param identifier Device identifier string
     * @param manufacturer Device manufacturer
     * @param model Device model
     * @param metadata Custom metadata
     * @return New Device instance
     */
    public static Device create(
        UUID roomId,
        DeviceType deviceType,
        String identifier,
        String manufacturer,
        String model,
        Map<String, Object> metadata
    ) {
        return new Device(
            null, // Let the database generate the ID
            roomId,
            deviceType,
            new DeviceIdentifier(identifier),
            manufacturer,
            model,
            true,
            metadata != null ? new HashMap<>(metadata) : new HashMap<>(),
            Timestamp.from(Instant.now()),
            Timestamp.from(Instant.now())
        );
    }

    /**
     * Update device metadata.
     *
     * @param newMetadata New metadata map
     * @return Updated Device instance
     */
    public Device withMetadata(Map<String, Object> newMetadata) {
        return new Device(
            id, roomId, deviceType, deviceIdentifier, manufacturer, model, enabled,
            new HashMap<>(newMetadata),
            createdAt, Timestamp.from(Instant.now())
        );
    }

    /**
     * Enable or disable the device.
     *
     * @param newEnabled New enabled status
     * @return Updated Device instance
     */
    public Device withEnabled(boolean newEnabled) {
        return new Device(
            id, roomId, deviceType, deviceIdentifier, manufacturer, model, newEnabled,
            metadata, createdAt, Timestamp.from(Instant.now())
        );
    }

    /**
     * Update manufacturer and model information.
     *
     * @param newManufacturer New manufacturer
     * @param newModel New model
     * @return Updated Device instance
     */
    public Device withManufacturerAndModel(String newManufacturer, String newModel) {
        return new Device(
            id, roomId, deviceType, deviceIdentifier, newManufacturer, newModel, enabled,
            metadata, createdAt, Timestamp.from(Instant.now())
        );
    }
}
