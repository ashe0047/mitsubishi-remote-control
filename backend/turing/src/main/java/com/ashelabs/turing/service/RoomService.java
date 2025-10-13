package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.room.CreateRoomRequest;
import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.dto.room.UpdateRoomRequest;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Service interface for room management operations.
 *
 * Follows Interface Segregation Principle (ISP) by providing focused contract.
 * Follows Dependency Inversion Principle (DIP) by allowing implementations to vary.
 */
public interface RoomService {

    /**
     * Create a new room in a household.
     *
     * @param householdId Household ID
     * @param request Room creation request
     * @return Created room response
     * @throws IllegalArgumentException if validation fails
     * @throws IllegalStateException if room name/identifier already exists
     */
    Mono<RoomResponse> createRoom(UUID householdId, CreateRoomRequest request);

    /**
     * Get all rooms for a household.
     *
     * @param householdId Household ID
     * @return Flux of room responses
     */
    Flux<RoomResponse> getRoomsByHousehold(UUID householdId);

    /**
     * Get a specific room by ID within a household.
     *
     * @param householdId Household ID (for security isolation)
     * @param roomId Room ID
     * @return Room response
     * @throws java.util.NoSuchElementException if room not found
     */
    Mono<RoomResponse> getRoomById(UUID householdId, UUID roomId);

    /**
     * Get a specific room by identifier within a household.
     *
     * @param householdId Household ID (for security isolation)
     * @param roomIdentifier Room identifier (slug)
     * @return Room response
     * @throws java.util.NoSuchElementException if room not found
     */
    Mono<RoomResponse> getRoomByIdentifier(UUID householdId, String roomIdentifier);

    /**
     * Update an existing room.
     *
     * @param householdId Household ID (for security isolation)
     * @param roomId Room ID
     * @param request Update request (partial updates supported)
     * @return Updated room response
     * @throws IllegalArgumentException if validation fails
     * @throws IllegalStateException if updated name/identifier conflicts
     * @throws java.util.NoSuchElementException if room not found
     */
    Mono<RoomResponse> updateRoom(UUID householdId, UUID roomId, UpdateRoomRequest request);

    /**
     * Delete a room from a household.
     *
     * @param householdId Household ID (for security isolation)
     * @param roomId Room ID
     * @return Void
     * @throws java.util.NoSuchElementException if room not found
     */
    Mono<Void> deleteRoom(UUID householdId, UUID roomId);

    /**
     * Get all rooms for a household with device information.
     *
     * @param householdId Household ID
     * @return Flux of room responses with device data
     */
    Flux<RoomResponse> getRoomsByHouseholdWithDevices(UUID householdId);

    /**
     * Get a specific room by ID with device information.
     *
     * @param householdId Household ID
     * @param roomId Room ID
     * @return Room response with device data
     */
    Mono<RoomResponse> getRoomByIdWithDevices(UUID householdId, UUID roomId);

    /**
     * Get a specific room by identifier with device information.
     *
     * @param householdId Household ID
     * @param roomIdentifier Room identifier
     * @return Room response with device data
     */
    Mono<RoomResponse> getRoomByIdentifierWithDevices(UUID householdId, String roomIdentifier);
}
