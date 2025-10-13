package com.ashelabs.turing.domain.device;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Repository port for device persistence.
 * Domain-level abstraction following hexagonal architecture.
 * No R2DBC coupling - pure domain interface.
 */
public interface DeviceRepository {

    /**
     * Save a device (create or update).
     *
     * @param device Device to save
     * @return Saved device
     */
    Mono<Device> save(Device device);

    /**
     * Find device by ID.
     *
     * @param id Device ID
     * @return Device if found, empty Mono otherwise
     */
    Mono<Device> findById(UUID id);

    /**
     * Find device by device identifier.
     *
     * @param deviceIdentifier Device identifier string
     * @return Device if found, empty Mono otherwise
     */
    Mono<Device> findByDeviceIdentifier(String deviceIdentifier);

    /**
     * Find all devices in a room.
     *
     * @param roomId Room ID
     * @return Flux of devices
     */
    Flux<Device> findByRoomId(UUID roomId);

    /**
     * Find all devices of a specific type.
     *
     * @param deviceType Device type
     * @return Flux of devices
     */
    Flux<Device> findByDeviceType(DeviceType deviceType);

    /**
     * Find enabled devices in a room.
     *
     * @param roomId Room ID
     * @return Flux of enabled devices
     */
    Flux<Device> findEnabledByRoomId(UUID roomId);

    /**
     * Check if device exists with given room and identifier.
     *
     * @param roomId Room ID
     * @param deviceIdentifier Device identifier string
     * @return True if exists, false otherwise
     */
    Mono<Boolean> existsByRoomIdAndDeviceIdentifier(UUID roomId, String deviceIdentifier);

    /**
     * Delete device by ID.
     *
     * @param id Device ID
     * @return Void Mono
     */
    Mono<Void> deleteById(UUID id);

    /**
     * Find all devices.
     *
     * @return Flux of all devices
     */
    Flux<Device> findAll();
}
