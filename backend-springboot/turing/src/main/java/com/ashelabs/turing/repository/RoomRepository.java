package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.Room;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Repository for Room entity operations.
 *
 * Provides reactive database operations using Spring Data R2DBC.
 * All queries are scoped to household_id for multi-tenant isolation.
 */
@Repository
public interface RoomRepository extends R2dbcRepository<Room, UUID> {

    /**
     * Find all rooms for a specific household.
     *
     * @param householdId The household ID
     * @return Flux of rooms belonging to the household
     */
    Flux<Room> findByHouseholdId(UUID householdId);

    /**
     * Find a room by household and room identifier.
     * Room identifier is the business key (slug) used for stable references.
     *
     * @param householdId The household ID
     * @param roomIdentifier The room identifier (e.g., "living-room")
     * @return Mono of room if found, empty otherwise
     */
    Mono<Room> findByHouseholdIdAndRoomIdentifier(UUID householdId, String roomIdentifier);

    /**
     * Find a room by identifier irrespective of household.
     * Helpful for resolving MQTT events that carry only the slug.
     */
    Mono<Room> findByRoomIdentifier(String roomIdentifier);

    /**
     * Find a room by household and room ID.
     * Ensures household isolation - room must belong to specified household.
     *
     * @param householdId The household ID
     * @param id The room ID
     * @return Mono of room if found, empty otherwise
     */
    Mono<Room> findByHouseholdIdAndId(UUID householdId, UUID id);

    /**
     * Count rooms with the same name in a household.
     * Used for uniqueness validation.
     *
     * @param householdId The household ID
     * @param name The room name
     * @return Mono with count of matching rooms
     */
    Mono<Long> countByHouseholdIdAndName(UUID householdId, String name);

    /**
     * Count rooms with the same identifier in a household.
     * Used for uniqueness validation.
     *
     * @param householdId The household ID
     * @param roomIdentifier The room identifier
     * @return Mono with count of matching rooms
     */
    Mono<Long> countByHouseholdIdAndRoomIdentifier(UUID householdId, String roomIdentifier);

    /**
     * Delete a room by household and room ID.
     * Ensures household isolation - can only delete rooms in own household.
     *
     * @param householdId The household ID
     * @param id The room ID
     * @return Mono that completes when deletion is done
     */
    Mono<Void> deleteByHouseholdIdAndId(UUID householdId, UUID id);
}
