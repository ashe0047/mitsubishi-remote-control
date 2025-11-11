package com.ashelabs.turing.domain.device.discovery;

import com.ashelabs.turing.domain.device.DeviceType;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Domain representation of a discovered device detected via MQTT but not yet registered.
 * Immutable record to support clean domain operations and safe sharing across layers.
 */
public record DiscoveredDevice(
    String deviceIdentifier,
    UUID roomId,
    DeviceType deviceType,
    Map<String, Object> payload,
    Map<String, Object> metadata,
    Instant firstSeenAt,
    Instant lastSeenAt,
    boolean requiresRegistration
) {
    public DiscoveredDevice {
        if (deviceIdentifier == null || deviceIdentifier.isBlank()) {
            throw new IllegalArgumentException("deviceIdentifier must not be null or blank");
        }
        payload = payload == null ? Map.of() : Map.copyOf(payload);
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
        firstSeenAt = Objects.requireNonNull(firstSeenAt, "firstSeenAt must not be null");
        lastSeenAt = Objects.requireNonNull(lastSeenAt, "lastSeenAt must not be null");
    }

    /**
     * Create a new instance with updated last-seen timestamp and optional overrides.
     *
     * @param newLastSeenAt Updated last seen timestamp
     * @param updatedPayload Optional updated payload (falls back to existing payload when null)
     * @param updatedMetadata Optional updated metadata (merged with existing when provided)
     * @param overrideDeviceType Optional device type override (falls back when null)
     * @param overrideRoomId Optional room override (falls back when null)
     * @return Updated discovered device instance
     */
    public DiscoveredDevice refresh(
        Instant newLastSeenAt,
        Map<String, Object> updatedPayload,
        Map<String, Object> updatedMetadata,
        DeviceType overrideDeviceType,
        UUID overrideRoomId
    ) {
        Map<String, Object> mergedMetadata = metadata;
        if (updatedMetadata != null && !updatedMetadata.isEmpty()) {
            LinkedHashMap<String, Object> combined = new LinkedHashMap<>(metadata);
            combined.putAll(updatedMetadata);
            mergedMetadata = Map.copyOf(combined);
        }

        Map<String, Object> effectivePayload = updatedPayload != null
            ? Map.copyOf(updatedPayload)
            : payload;

        return new DiscoveredDevice(
            deviceIdentifier,
            overrideRoomId != null ? overrideRoomId : roomId,
            overrideDeviceType != null ? overrideDeviceType : deviceType,
            effectivePayload,
            mergedMetadata,
            firstSeenAt,
            Objects.requireNonNull(newLastSeenAt, "newLastSeenAt must not be null"),
            requiresRegistration
        );
    }

    /**
     * Convenience method to mark discovery as resolved (no longer requiring registration).
     *
     * @return Updated instance with requiresRegistration = false
     */
    public DiscoveredDevice markResolved() {
        return new DiscoveredDevice(
            deviceIdentifier,
            roomId,
            deviceType,
            payload,
            metadata,
            firstSeenAt,
            lastSeenAt,
            false
        );
    }
}
