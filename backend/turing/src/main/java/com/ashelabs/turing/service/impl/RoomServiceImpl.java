package com.ashelabs.turing.service.impl;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.dto.room.CreateRoomRequest;
import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.dto.room.UpdateRoomRequest;
import com.ashelabs.turing.entity.Room;
import com.ashelabs.turing.repository.RoomRepository;
import com.ashelabs.turing.service.DeviceStatusService;
import com.ashelabs.turing.service.RoomService;
import com.ashelabs.turing.util.RoomIdentifierGenerator;
import com.ashelabs.turing.validation.RoomValidator;
import com.ashelabs.turing.validation.ValidationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Implementation of RoomService.
 *
 * Follows Single Responsibility Principle (SRP) - only handles room business
 * logic.
 * Follows Dependency Inversion Principle (DIP) - depends on RoomRepository
 * abstraction.
 * Follows DRY principle - validation logic centralized in RoomValidator.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final DeviceService deviceService;
    private final DeviceStatusService deviceStatusService;

    @Override
    public Mono<RoomResponse> createRoom(UUID householdId, CreateRoomRequest request) {
        log.debug("Creating room '{}' for household {}", request.getName(), householdId);

        // Validate request
        ValidationResult validation = RoomValidator.validateForCreate(request);
        if (!validation.isValid()) {
            log.warn("Room creation validation failed: {}", validation.getErrors());
            return Mono.error(new IllegalArgumentException(validation.getFirstError()));
        }

        // Generate room identifier from name
        String roomIdentifier = RoomIdentifierGenerator.generateFromName(request.getName());

        // Check for name uniqueness
        return roomRepository.countByHouseholdIdAndName(householdId, request.getName())
                .flatMap(count -> {
                    if (count > 0) {
                        return Mono.error(new IllegalStateException(
                                "Room with name '" + request.getName() + "' already exists in this household"));
                    }

                    // Check for identifier uniqueness
                    return roomRepository.countByHouseholdIdAndRoomIdentifier(householdId, roomIdentifier)
                            .flatMap(identifierCount -> {
                                if (identifierCount > 0) {
                                    return Mono.error(new IllegalStateException(
                                            "Room with identifier '" + roomIdentifier
                                                    + "' already exists in this household"));
                                }

                                // Create room entity
                                Room room = Room.builder()
                                        .householdId(householdId)
                                        .name(request.getName())
                                        .roomIdentifier(roomIdentifier)
                                        .location(request.getLocation())
                                        .description(request.getDescription())
                                        .build();

                                // Save and return response
                                return roomRepository.save(room)
                                        .doOnSuccess(saved -> log.info("Created room '{}' with ID {} for household {}",
                                                saved.getName(), saved.getId(), householdId))
                                        .map(saved -> RoomResponse.from(saved, List.of()));
                            });
                });
    }

    @Override
    public Flux<RoomResponse> getRoomsByHousehold(UUID householdId) {
        log.debug("Fetching all rooms for household {}", householdId);
        return roomRepository.findByHouseholdId(householdId)
                .map(room -> RoomResponse.from(room, List.of()))
                .doOnComplete(() -> log.debug("Completed fetching rooms for household {}", householdId));
    }

    @Override
    public Mono<RoomResponse> getRoomById(UUID householdId, UUID roomId) {
        log.debug("Fetching room {} for household {}", roomId, householdId);
        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with ID " + roomId + " not found in household " + householdId)))
                .map(room -> RoomResponse.from(room, List.of()));
    }

    @Override
    public Mono<RoomResponse> getRoomByIdentifier(UUID householdId, String roomIdentifier) {
        log.debug("Fetching room with identifier '{}' for household {}", roomIdentifier, householdId);
        return roomRepository.findByHouseholdIdAndRoomIdentifier(householdId, roomIdentifier)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with identifier '" + roomIdentifier + "' not found in household " + householdId)))
                .map(room -> RoomResponse.from(room, List.of()));
    }

    @Override
    public Mono<RoomResponse> updateRoom(UUID householdId, UUID roomId, UpdateRoomRequest request) {
        log.debug("Updating room {} for household {}", roomId, householdId);

        // Validate request
        ValidationResult validation = RoomValidator.validateForUpdate(request);
        if (!validation.isValid()) {
            log.warn("Room update validation failed: {}", validation.getErrors());
            return Mono.error(new IllegalArgumentException(validation.getFirstError()));
        }

        // Fetch existing room
        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with ID " + roomId + " not found in household " + householdId)))
                .flatMap(existingRoom -> {
                    // Check if name is being updated and validate uniqueness
                    if (request.getName() != null && !request.getName().equals(existingRoom.getName())) {
                        return roomRepository.countByHouseholdIdAndName(householdId, request.getName())
                                .flatMap(count -> {
                                    if (count > 0) {
                                        return Mono.error(new IllegalStateException(
                                                "Room with name '" + request.getName()
                                                        + "' already exists in this household"));
                                    }
                                    return Mono.just(existingRoom);
                                });
                    }
                    return Mono.just(existingRoom);
                })
                .flatMap(existingRoom -> {
                    // Apply updates (partial update pattern)
                    boolean hasChanges = false;

                    if (request.getName() != null && !request.getName().equals(existingRoom.getName())) {
                        existingRoom.setName(request.getName());
                        // Regenerate room identifier from new name
                        String newIdentifier = RoomIdentifierGenerator.generateFromName(request.getName());
                        existingRoom.setRoomIdentifier(newIdentifier);
                        hasChanges = true;
                    }

                    if (request.getLocation() != null && !request.getLocation().equals(existingRoom.getLocation())) {
                        existingRoom.setLocation(request.getLocation());
                        hasChanges = true;
                    }

                    if (request.getDescription() != null
                            && !request.getDescription().equals(existingRoom.getDescription())) {
                        existingRoom.setDescription(request.getDescription());
                        hasChanges = true;
                    }

                    // Only save if there are changes
                    if (!hasChanges) {
                        log.debug("No changes detected for room {}", roomId);
                        return Mono.just(RoomResponse.from(existingRoom, List.of()));
                    }

                    // Save and return updated room
                    return roomRepository.save(existingRoom)
                            .doOnSuccess(updated -> log.info("Updated room {} for household {}", roomId, householdId))
                            .map(updated -> RoomResponse.from(updated, List.of()));
                });
    }

    @Override
    public Mono<Void> deleteRoom(UUID householdId, UUID roomId) {
        log.debug("Deleting room {} from household {}", roomId, householdId);

        // Verify room exists before deleting
        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with ID " + roomId + " not found in household " + householdId)))
                .flatMap(room -> roomRepository.deleteByHouseholdIdAndId(householdId, roomId))
                .doOnSuccess(v -> log.info("Deleted room {} from household {}", roomId, householdId));
    }

    @Override
    public Flux<RoomResponse> getRoomsByHouseholdWithDevices(UUID householdId) {
        log.debug("Fetching all rooms with devices for household {}", householdId);
        return roomRepository.findByHouseholdId(householdId)
                .flatMap(this::enrichRoomWithDevices)
                .doOnComplete(() -> log.debug("Completed fetching rooms with devices for household {}", householdId));
    }

    @Override
    public Mono<RoomResponse> getRoomByIdWithDevices(UUID householdId, UUID roomId) {
        log.debug("Fetching room {} with devices for household {}", roomId, householdId);
        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with ID " + roomId + " not found in household " + householdId)))
                .flatMap(this::enrichRoomWithDevices);
    }

    @Override
    public Mono<RoomResponse> getRoomByIdentifierWithDevices(UUID householdId, String roomIdentifier) {
        log.debug("Fetching room with identifier '{}' and devices for household {}", roomIdentifier, householdId);
        return roomRepository.findByHouseholdIdAndRoomIdentifier(householdId, roomIdentifier)
                .switchIfEmpty(Mono.error(new NoSuchElementException(
                        "Room with identifier '" + roomIdentifier + "' not found in household " + householdId)))
                .flatMap(this::enrichRoomWithDevices);
    }

    private Mono<RoomResponse> enrichRoomWithDevices(Room room) {
        log.info("============= START: Enriching room {} ({}) with devices =============", room.getId(), room.getName());
        log.info("DeviceService instance: {}", deviceService != null ? deviceService.getClass().getName() : "NULL");

        return deviceService.getDevicesByRoom(room.getId())
                .doOnSubscribe(s -> log.info("Subscribed to deviceService.getDevicesByRoom() for room {}", room.getId()))
                .doOnNext(device -> log.info("Found device: id={}, identifier={}, roomId={}",
                    device.id(), device.deviceIdentifier().value(), device.roomId()))
                .doOnComplete(() -> log.info("Completed fetching devices from deviceService for room {}", room.getId()))
                .map(device -> {
                    String identifier = device.deviceIdentifier().value();
                    log.info("Mapping device {} to identifier string", identifier);
                    return identifier;
                })
                .collectList()
                .doOnNext(deviceIdentifiers -> log.info("Room {} collected {} device identifiers: {}",
                    room.getId(), deviceIdentifiers.size(), deviceIdentifiers))
                .flatMap(deviceIdentifiers -> {
                    if (deviceIdentifiers.isEmpty()) {
                        log.warn("No devices found for room {}, returning empty device list", room.getId());
                        return Mono.just(RoomResponse.from(room, List.of()));
                    }

                    log.info("Fetching device info for {} device identifiers from deviceStatusService", deviceIdentifiers.size());
                    return deviceStatusService.getDeviceInfos(deviceIdentifiers)
                            .doOnNext(deviceInfo -> log.info("Got device info: identifier={}, online={}, enabled={}",
                                deviceInfo.getDeviceIdentifier(), deviceInfo.isOnline(), deviceInfo.isEnabled()))
                            .collectList()
                            .doOnNext(deviceInfos -> log.info("Got {} device infos for room {}", deviceInfos.size(), room.getId()))
                            .map(deviceInfos -> {
                                RoomResponse response = RoomResponse.from(room, deviceInfos);
                                log.info("Created RoomResponse with {} devices", response.getDevices().size());
                                return response;
                            });
                })
                .doOnSuccess(response -> log.info("============= END: Successfully enriched room {} with {} devices =============",
                    room.getId(), response.getDevices().size()))
                .onErrorResume(error -> {
                    log.error("============= ERROR: Failed to enrich room {} with devices: {} =============",
                        room.getId(), error.getMessage(), error);
                    return Mono.just(RoomResponse.from(room, List.of()));
                });
    }
}
