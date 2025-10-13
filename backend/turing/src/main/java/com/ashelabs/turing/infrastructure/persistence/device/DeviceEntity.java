package com.ashelabs.turing.infrastructure.persistence.device;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import io.r2dbc.postgresql.codec.Json;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * R2DBC entity for devices table.
 * Maps to database schema defined in V003__Create_devices_table.sql
 */
@Table("devices")
public record DeviceEntity(
    @Id
    UUID id,

    @Column("room_id")
    UUID roomId,

    @Column("device_type")
    String deviceType,

    @Column("device_identifier")
    String deviceIdentifier,

    String manufacturer,

    String model,

    Boolean enabled,

    @Column("metadata")
    Json metadata,  // R2DBC PostgreSQL JSONB support

    @Column("created_at")
    OffsetDateTime createdAt,

    @Column("updated_at")
    OffsetDateTime updatedAt
) implements Persistable<UUID> {

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return id == null;
    }

    /**
     * Create a new entity (for inserts).
     */
    public static DeviceEntity newEntity(
        UUID roomId,
        String deviceType,
        String deviceIdentifier,
        String manufacturer,
        String model,
        Boolean enabled,
        Json metadata,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
        return new DeviceEntity(
            null, // null ID indicates new entity
            roomId,
            deviceType,
            deviceIdentifier,
            manufacturer,
            model,
            enabled,
            metadata,
            createdAt,
            updatedAt
        );
    }

    /**
     * Create an existing entity (for updates).
     */
    public static DeviceEntity existingEntity(
        UUID id,
        UUID roomId,
        String deviceType,
        String deviceIdentifier,
        String manufacturer,
        String model,
        Boolean enabled,
        Json metadata,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
        return new DeviceEntity(
            id,
            roomId,
            deviceType,
            deviceIdentifier,
            manufacturer,
            model,
            enabled,
            metadata,
            createdAt,
            updatedAt
        );
    }
}
