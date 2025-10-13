package com.ashelabs.turing.api.device.dto;

import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDevice;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * DTO for discovered device responses exposed to API clients.
 */
public record DiscoveredDeviceDto(
    String deviceIdentifier,
    String deviceType,
    UUID roomId,
    Map<String, Object> payload,
    Map<String, Object> metadata,
    Instant firstSeenAt,
    Instant lastSeenAt,
    boolean requiresRegistration
) {
    public static DiscoveredDeviceDto from(DiscoveredDevice discovery) {
        DeviceType type = discovery.deviceType();
        return new DiscoveredDeviceDto(
            discovery.deviceIdentifier(),
            type != null ? type.getCode() : null,
            discovery.roomId(),
            discovery.payload(),
            discovery.metadata(),
            discovery.firstSeenAt(),
            discovery.lastSeenAt(),
            discovery.requiresRegistration()
        );
    }
}
