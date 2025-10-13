package com.ashelabs.turing.infrastructure.persistence.device;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Spring Data R2DBC repository interface for devices.
 * Provides reactive database access with PostgreSQL.
 */
public interface R2dbcDeviceRepository extends R2dbcRepository<DeviceEntity, UUID> {

    /**
     * Find device by device identifier.
     */
    Mono<DeviceEntity> findByDeviceIdentifier(String deviceIdentifier);

    /**
     * Find all devices in a room.
     */
    Flux<DeviceEntity> findByRoomId(UUID roomId);

    /**
     * Find all devices of a specific type.
     */
    Flux<DeviceEntity> findByDeviceType(String deviceType);

    /**
     * Find enabled devices in a room.
     */
    @Query("SELECT * FROM devices WHERE room_id = :roomId AND enabled = true")
    Flux<DeviceEntity> findEnabledByRoomId(UUID roomId);

    /**
     * Check if device exists with given room and identifier.
     */
    Mono<Boolean> existsByRoomIdAndDeviceIdentifier(UUID roomId, String deviceIdentifier);
}
