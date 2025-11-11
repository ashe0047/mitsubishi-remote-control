package com.ashelabs.turing.infrastructure.persistence.device;

import com.ashelabs.turing.domain.device.Device;
import com.ashelabs.turing.domain.device.DeviceIdentifier;
import com.ashelabs.turing.domain.device.DeviceType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Mapper for converting between Device domain entities and DeviceEntity database entities.
 * Handles JSONB metadata serialization/deserialization.
 */
@Component
public class DeviceMapper {

    private final ObjectMapper objectMapper;

    public DeviceMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Convert database entity to domain entity.
     *
     * @param entity Database entity
     * @return Domain entity
     */
    public Device toDomain(DeviceEntity entity) {
        Map<String, Object> metadata = parseMetadata(entity.metadata());

        return new Device(
            entity.id(),
            entity.roomId(),
            DeviceType.fromCode(entity.deviceType()),
            new DeviceIdentifier(entity.deviceIdentifier()),
            entity.manufacturer(),
            entity.model(),
            entity.enabled() != null ? entity.enabled() : true,
            metadata,
            convertToTimestamp(entity.createdAt()),
            convertToTimestamp(entity.updatedAt())
        );
    }

    /**
     * Convert domain entity to database entity.
     *
     * @param domain Domain entity
     * @return Database entity
     */
    public DeviceEntity toEntity(Device domain) {
        Json metadataJson = serializeMetadata(domain.metadata());

        // Use factory methods based on whether ID is null
        if (domain.id() == null) {
            return DeviceEntity.newEntity(
                domain.roomId(),
                domain.deviceType().getCode(),
                domain.deviceIdentifier().value(),
                domain.manufacturer(),
                domain.model(),
                domain.enabled(),
                metadataJson,
                convertToOffsetDateTime(domain.createdAt()),
                convertToOffsetDateTime(domain.updatedAt())
            );
        } else {
            return DeviceEntity.existingEntity(
                domain.id(),
                domain.roomId(),
                domain.deviceType().getCode(),
                domain.deviceIdentifier().value(),
                domain.manufacturer(),
                domain.model(),
                domain.enabled(),
                metadataJson,
                convertToOffsetDateTime(domain.createdAt()),
                convertToOffsetDateTime(domain.updatedAt())
            );
        }
    }

    /**
     * Parse JSONB metadata from database.
     *
     * @param json JSONB data
     * @return Map of metadata
     */
    private Map<String, Object> parseMetadata(Json json) {
        if (json == null) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(
                json.asString(),
                new TypeReference<Map<String, Object>>() {}
            );
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    /**
     * Serialize metadata to JSONB.
     *
     * @param metadata Metadata map
     * @return JSONB Json object
     */
    private Json serializeMetadata(Map<String, Object> metadata) {
        try {
            String json = objectMapper.writeValueAsString(metadata);
            return Json.of(json);
        } catch (Exception e) {
            return Json.of("{}");
        }
    }

    /**
     * Convert OffsetDateTime from database to Timestamp for domain.
     *
     * @param offsetDateTime OffsetDateTime from database
     * @return Timestamp for domain entity
     */
    private Timestamp convertToTimestamp(OffsetDateTime offsetDateTime) {
        if (offsetDateTime == null) {
            return null;
        }
        return Timestamp.from(offsetDateTime.toInstant());
    }

    /**
     * Convert Timestamp from domain to OffsetDateTime for database.
     *
     * @param timestamp Timestamp from domain entity
     * @return OffsetDateTime for database entity
     */
    private OffsetDateTime convertToOffsetDateTime(Timestamp timestamp) {
        if (timestamp == null) {
            return null;
        }
        return timestamp.toInstant().atOffset(java.time.ZoneOffset.UTC);
    }
}
