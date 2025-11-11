package com.ashelabs.turing.domain.device.discovery;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Repository port for discovered device persistence/caching.
 * Allows different storage implementations (in-memory, Redis, database, etc.).
 */
public interface DiscoveredDeviceRepository {

    /**
     * Persist or update a discovered device entry.
     *
     * @param device Discovered device to store
     * @return Persisted device instance
     */
    Mono<DiscoveredDevice> save(DiscoveredDevice device);

    /**
     * Find discovery by device identifier.
     *
     * @param deviceIdentifier Device identifier (business key)
     * @return Matching discovery if present
     */
    Mono<DiscoveredDevice> findByDeviceIdentifier(String deviceIdentifier);

    /**
     * Retrieve all discovery entries.
     *
     * @return Flux of discoveries ordered by storage implementation
     */
    Flux<DiscoveredDevice> findAll();

    /**
     * Retrieve discovery entries scoped to a room.
     *
     * @param roomId Room identifier
     * @return Flux of discoveries for the room
     */
    Flux<DiscoveredDevice> findByRoomId(UUID roomId);

    /**
     * Remove discovery by device identifier.
     *
     * @param deviceIdentifier Device identifier to remove
     * @return Completion signal
     */
    Mono<Void> deleteByDeviceIdentifier(String deviceIdentifier);

    /**
     * Clear all discovery entries.
     *
     * @return Completion signal
     */
    Mono<Void> deleteAll();
}
