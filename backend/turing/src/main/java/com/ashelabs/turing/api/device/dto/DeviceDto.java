package com.ashelabs.turing.api.device.dto;

import com.ashelabs.turing.domain.device.Device;

import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

/**
 * Device Data Transfer Object for REST API responses.
 * Converts domain Device entities to API-friendly format.
 */
public record DeviceDto(
    UUID id,

    UUID roomId,

    String deviceType,

    String deviceIdentifier,

    String manufacturer,

    String model,

    Boolean enabled,

    Map<String, Object> metadata,

    Timestamp createdAt,

    Timestamp updatedAt
) {
    /**
     * Convert domain Device to DTO.
     *
     * @param device Domain device entity
     * @return DeviceDto
     */
    public static DeviceDto from(Device device) {
        return new DeviceDto(
            device.id(),
            device.roomId(),
            device.deviceType().getCode(),
            device.deviceIdentifier().value(),
            device.manufacturer(),
            device.model(),
            device.enabled(),
            device.metadata(),
            device.createdAt(),
            device.updatedAt()
        );
    }
}
