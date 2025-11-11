package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.dto.AirConCommand;
import com.ashelabs.turing.dto.QuotaValidationResult;
import com.ashelabs.turing.dto.room.CreateRoomRequest;
import com.ashelabs.turing.dto.room.DeviceControlRequest;
import com.ashelabs.turing.dto.room.DeviceControlResponse;
import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.dto.room.UpdateRoomRequest;
import com.ashelabs.turing.exception.RoomControllerErrorHandler;
import com.ashelabs.turing.exception.QuotaExceededException;
import com.ashelabs.turing.exception.DeviceUnavailableException;
import com.ashelabs.turing.service.JwtService;
import com.ashelabs.turing.service.QuotaValidationService;
import com.ashelabs.turing.service.RoomService;
import com.ashelabs.turing.service.ReactiveAirConService;
import com.ashelabs.turing.service.UsageTrackingService;
import com.ashelabs.turing.service.RoomWebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

/**
 * Unified REST Controller for room management with integrated device control.
 * 
 * This controller consolidates room CRUD operations and device control into a
 * single
 * unified API under /api/rooms. It provides complete room information including
 * device status and aggregate statistics in a single response.
 * 
 * Key Features:
 * - Complete room data with embedded device information
 * - Device control operations scoped to rooms
 * - Real-time status integration
 * - Consistent error handling and security
 * 
 * Authorization:
 * - All operations require authentication
 * - CREATE/UPDATE/DELETE require PARENT role
 * - GET operations available to all authenticated users
 * - Device control operations follow existing AC controller permissions
 * 
 * @since 1.0.0
 */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class RoomController {

    private final RoomService roomService;
    private final ReactiveAirConService reactiveAirConService;
    private final QuotaValidationService quotaValidationService;
    private final UsageTrackingService usageTrackingService;
    private final JwtAuthenticationContext jwtAuthContext;
    private final RoomWebSocketService roomWebSocketService;

    /**
     * Get all rooms for the authenticated user's household with device information.
     * GET /api/rooms
     *
     * @param authorization JWT token in Authorization header
     * @return Flux of RoomResponse with embedded device data
     */
    @GetMapping
    public Flux<RoomResponse> getAllRooms(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Fetching all rooms with devices for household {}",
                        userInfo.getHouseholdId()))
                .flatMapMany(userInfo -> roomService.getRoomsByHouseholdWithDevices(userInfo.getHouseholdId()))
                .doOnError(error -> log.error("Error fetching rooms with devices", error))
                .onErrorMap(this::mapException);
    }

    /**
     * Get a specific room by ID with complete device information.
     * GET /api/rooms/{roomId}
     *
     * @param roomId        Room ID
     * @param authorization JWT token
     * @return Mono of RoomResponse with embedded device data
     */
    @GetMapping("/{roomId}")
    public Mono<RoomResponse> getRoomById(
            @PathVariable UUID roomId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Fetching room {} with devices for household {}", roomId,
                        userInfo.getHouseholdId()))
                .flatMap(userInfo -> roomService.getRoomByIdWithDevices(userInfo.getHouseholdId(), roomId))
                .doOnError(error -> log.error("Error fetching room {} with devices", roomId, error))
                .onErrorMap(this::mapException);
    }

    /**
     * Get a specific room by identifier with complete device information.
     * GET /api/rooms/identifier/{roomIdentifier}
     *
     * @param roomIdentifier Room identifier (slug)
     * @param authorization  JWT token
     * @return Mono of RoomResponse with embedded device data
     */
    @GetMapping("/identifier/{roomIdentifier}")
    public Mono<RoomResponse> getRoomByIdentifier(
            @PathVariable String roomIdentifier,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Fetching room '{}' with devices for household {}", roomIdentifier,
                        userInfo.getHouseholdId()))
                .flatMap(userInfo -> roomService.getRoomByIdentifierWithDevices(userInfo.getHouseholdId(),
                        roomIdentifier))
                .doOnError(error -> log.error("Error fetching room by identifier '{}' with devices", roomIdentifier,
                        error))
                .onErrorMap(this::mapException);
    }

    /**
     * Create a new room (parent-only).
     * POST /api/rooms
     *
     * @param request       CreateRoomRequest
     * @param authorization JWT token
     * @return Mono of RoomResponse with device data
     */
    @PostMapping
    @PreAuthorize("hasRole('PARENT')")
    public Mono<RoomResponse> createRoom(
            @Valid @RequestBody CreateRoomRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Creating room '{}' for household {}", request.getName(),
                        userInfo.getHouseholdId()))
                .flatMap(userInfo -> roomService.createRoom(userInfo.getHouseholdId(), request))
                .doOnSuccess(room -> log.info("Created room '{}' with ID {}", room.getName(), room.getId()))
                .doOnError(error -> log.error("Error creating room '{}'", request.getName(), error))
                .onErrorMap(this::mapException);
    }

    /**
     * Update an existing room (parent-only).
     * PUT /api/rooms/{roomId}
     *
     * @param roomId        Room ID
     * @param request       UpdateRoomRequest
     * @param authorization JWT token
     * @return Mono of RoomResponse with updated device data
     */
    @PutMapping("/{roomId}")
    @PreAuthorize("hasRole('PARENT')")
    public Mono<RoomResponse> updateRoom(
            @PathVariable UUID roomId,
            @Valid @RequestBody UpdateRoomRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Updating room {} for household {}", roomId, userInfo.getHouseholdId()))
                .flatMap(userInfo -> roomService.updateRoom(userInfo.getHouseholdId(), roomId, request))
                .doOnSuccess(room -> log.info("Updated room {} to '{}'", roomId, room.getName()))
                .doOnError(error -> log.error("Error updating room {}", roomId, error))
                .onErrorMap(this::mapException);
    }

    /**
     * Delete a room (parent-only).
     * DELETE /api/rooms/{roomId}
     *
     * @param roomId        Room ID
     * @param authorization JWT token
     * @return Mono of Void
     */
    @DeleteMapping("/{roomId}")
    @PreAuthorize("hasRole('PARENT')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteRoom(
            @PathVariable UUID roomId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Deleting room {} from household {}", roomId, userInfo.getHouseholdId()))
                .flatMap(userInfo -> roomService.deleteRoom(userInfo.getHouseholdId(), roomId))
                .doOnSuccess(v -> log.info("Deleted room {}", roomId))
                .doOnError(error -> log.error("Error deleting room {}", roomId, error))
                .onErrorMap(this::mapException);
    }

    // ========================================
    // Device Control Endpoints
    // ========================================

    /**
     * Control a device within a room.
     * POST /api/rooms/{roomId}/devices/{deviceId}/control
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Device control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse with updated room data
     */
    @PostMapping("/{roomId}/devices/{deviceId}/control")
    public Mono<DeviceControlResponse> controlDevice(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @Valid @RequestBody DeviceControlRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.info("Controlling device {} in room {} for user {}: {}",
                        deviceId, roomId, userInfo.getEmail(), request.getAction()))
                .flatMap(userInfo -> {
                    // Verify room belongs to user's household
                    return roomService.getRoomById(userInfo.getHouseholdId(), roomId)
                            .flatMap(room -> {
                                // Create AirConCommand for quota validation
                                AirConCommand command = buildAirConCommand(userInfo.getUserId(), roomId.toString(),
                                        request);

                                // Validate against quotas first
                                return quotaValidationService.validateCommand(command)
                                        .flatMap(validationResult -> {
                                            if (validationResult
                                                    .getStatus() == QuotaValidationResult.ValidationStatus.BLOCK) {
                                                // Throw quota exceeded exception for proper error handling
                                                return Mono.error(QuotaExceededException.fromValidationResult(
                                                        validationResult, userInfo.getUserId(), roomId.toString(), request.getAction()));
                                            }

                                            // Execute device control if quota validation passes
                                            return executeDeviceControl(roomId, deviceId, request)
                                                    .flatMap(success -> {
                                                        // Handle automatic session management based on power state changes
                                                        return handleSessionManagement(userInfo.getUserId(), roomId, request)
                                                                .flatMap(sessionResult -> {
                                                                    // Fetch updated room data to return in response
                                                                    return roomService.getRoomByIdWithDevices(
                                                                            userInfo.getHouseholdId(), roomId)
                                                                            .flatMap(updatedRoom -> {
                                                                                DeviceControlResponse response = DeviceControlResponse
                                                                                        .success(
                                                                                                roomId, deviceId,
                                                                                                request.getAction(),
                                                                                                "Device control operation completed successfully",
                                                                                                updatedRoom);

                                                                                // Add quota validation metadata
                                                                                response.withMetadata(
                                                                                        "quotaValidation",
                                                                                        validationResult);
                                                                                response.withMetadata("quotaStatus",
                                                                                        validationResult.getStatus()
                                                                                                .toString());

                                                                                // Add warning if quota validation
                                                                                // returned warning
                                                                                if (validationResult
                                                                                        .getStatus() == QuotaValidationResult.ValidationStatus.ALLOW_WITH_WARNING) {
                                                                                    response.withMetadata(
                                                                                            "quotaWarning",
                                                                                            validationResult
                                                                                                    .getReason());
                                                                                }

                                                                                // Add session management metadata
                                                                                if (sessionResult != null) {
                                                                                    response.withMetadata(
                                                                                            "sessionManagement",
                                                                                            sessionResult);
                                                                                    if (sessionResult.containsKey(
                                                                                            "sessionId")) {
                                                                                        response.withMetadata(
                                                                                                "sessionId",
                                                                                                sessionResult.get(
                                                                                                        "sessionId"));
                                                                                    }
                                                                                    if (sessionResult.containsKey(
                                                                                            "sessionAction")) {
                                                                                        response.withMetadata(
                                                                                                "sessionAction",
                                                                                                sessionResult.get(
                                                                                                        "sessionAction"));
                                                                                    }
                                                                                }

                                                                                // Publish WebSocket update after successful device control
                                                                                return roomWebSocketService.publishDeviceControlUpdate(
                                                                                        updatedRoom, deviceId, request.getAction())
                                                                                        .thenReturn(response)
                                                                                        .onErrorResume(wsError -> {
                                                                                            log.warn("WebSocket update failed for device {} in room {}: {}", 
                                                                                                deviceId, roomId, wsError.getMessage());
                                                                                            // Don't fail the main operation if WebSocket fails
                                                                                            return Mono.just(response);
                                                                                        });
                                                                            });
                                                                });
                                                    });
                                        })
                                        .onErrorResume(quotaError -> {
                                            log.warn(
                                                    "Quota validation error for device {} in room {}, proceeding with fail-safe",
                                                    deviceId, roomId, quotaError);

                                            // Fail-safe: proceed with device control on quota validation error
                                            return executeDeviceControl(roomId, deviceId, request)
                                                    .flatMap(success -> {
                                                        return roomService
                                                                .getRoomByIdWithDevices(userInfo.getHouseholdId(), roomId)
                                                                .flatMap(updatedRoom -> {
                                                                    DeviceControlResponse response = DeviceControlResponse.success(
                                                                            roomId, deviceId, request.getAction(),
                                                                            "Device control operation completed successfully (quota validation failed)",
                                                                            updatedRoom)
                                                                            .withMetadata("quotaValidationError",
                                                                                    quotaError.getMessage())
                                                                            .withMetadata("quotaStatus",
                                                                                    "VALIDATION_ERROR");
                                                                    
                                                                    // Publish WebSocket update even in fail-safe mode
                                                                    return roomWebSocketService.publishDeviceControlUpdate(
                                                                            updatedRoom, deviceId, request.getAction())
                                                                            .thenReturn(response)
                                                                            .onErrorResume(wsError -> {
                                                                                log.warn("WebSocket update failed in fail-safe mode for device {} in room {}: {}", 
                                                                                    deviceId, roomId, wsError.getMessage());
                                                                                return Mono.just(response);
                                                                            });
                                                                });
                                                    });
                                        });
                            });
                })
                .doOnSuccess(response -> {
                    if (response.isSuccess()) {
                        log.info("Device control successful: {} on device {} in room {}",
                                request.getAction(), deviceId, roomId);
                    } else {
                        log.warn("Device control failed: {} on device {} in room {}: {}",
                                request.getAction(), deviceId, roomId, response.getMessage());
                    }
                })
                .doOnError(error -> log.error("Error controlling device {} in room {}", deviceId, roomId, error))
                .onErrorMap(this::mapException);
    }

    /**
     * Set device power state.
     * POST /api/rooms/{roomId}/devices/{deviceId}/power
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Power control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/power")
    public Mono<DeviceControlResponse> setDevicePower(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String power = (String) request.get("power");
        if (power == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Power state is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("power_on".equals(power.toLowerCase()) ? "power_on" : "power_off")
                .value(power)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Set device temperature.
     * POST /api/rooms/{roomId}/devices/{deviceId}/temperature
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Temperature control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/temperature")
    public Mono<DeviceControlResponse> setDeviceTemperature(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        Object temperature = request.get("temperature");
        if (temperature == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Temperature is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("set_temperature")
                .value(temperature)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Set device mode.
     * POST /api/rooms/{roomId}/devices/{deviceId}/mode
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Mode control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/mode")
    public Mono<DeviceControlResponse> setDeviceMode(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String mode = (String) request.get("mode");
        if (mode == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mode is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("set_mode")
                .value(mode)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Set device fan speed.
     * POST /api/rooms/{roomId}/devices/{deviceId}/fan
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Fan control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/fan")
    public Mono<DeviceControlResponse> setDeviceFan(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String fan = (String) request.get("fan");
        if (fan == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fan speed is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("set_fan")
                .value(fan)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Set device vane position.
     * POST /api/rooms/{roomId}/devices/{deviceId}/vane
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Vane control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/vane")
    public Mono<DeviceControlResponse> setDeviceVane(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String vane = (String) request.get("vane");
        if (vane == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vane position is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("set_vane")
                .value(vane)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Set device wide vane position.
     * POST /api/rooms/{roomId}/devices/{deviceId}/wide-vane
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Wide vane control request
     * @param authorization JWT token
     * @return Mono of DeviceControlResponse
     */
    @PostMapping("/{roomId}/devices/{deviceId}/wide-vane")
    public Mono<DeviceControlResponse> setDeviceWideVane(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String wideVane = (String) request.get("wideVane");
        if (wideVane == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wide vane position is required"));
        }

        DeviceControlRequest controlRequest = DeviceControlRequest.builder()
                .action("set_wide_vane")
                .value(wideVane)
                .build();

        return controlDevice(roomId, deviceId, controlRequest, authorization);
    }

    /**
     * Validate a device control command without executing it.
     * POST /api/rooms/{roomId}/devices/{deviceId}/validate
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param request       Device control request to validate
     * @param authorization JWT token
     * @return Mono of validation result
     */
    @PostMapping("/{roomId}/devices/{deviceId}/validate")
    public Mono<Map<String, Object>> validateDeviceCommand(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @Valid @RequestBody DeviceControlRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.debug("Validating device command {} for device {} in room {} for user {}",
                        request.getAction(), deviceId, roomId, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    // Verify room belongs to user's household
                    return roomService.getRoomById(userInfo.getHouseholdId(), roomId)
                            .flatMap(room -> {
                                // Create AirConCommand for quota validation
                                AirConCommand command = buildAirConCommand(userInfo.getUserId(), roomId.toString(),
                                        request);

                                // Validate against quotas
                                return quotaValidationService.validateCommand(command)
                                        .map(validationResult -> {
                                            Map<String, Object> response = new java.util.HashMap<>();
                                            response.put("valid", validationResult
                                                    .getStatus() != QuotaValidationResult.ValidationStatus.BLOCK);
                                            response.put("roomId", roomId.toString());
                                            response.put("deviceId", deviceId);
                                            response.put("action", request.getAction());
                                            response.put("quotaValidation", validationResult);
                                            response.put("quotaStatus", validationResult.getStatus().toString());
                                            response.put("message", validationResult.getReason());
                                            response.put("timestamp", java.time.Instant.now().toString());

                                            // Add warning if quota validation returned warning
                                            if (validationResult
                                                    .getStatus() == QuotaValidationResult.ValidationStatus.ALLOW_WITH_WARNING) {
                                                response.put("warning", validationResult.getReason());
                                            }

                                            // Add blocking reason if command is blocked
                                            if (validationResult
                                                    .getStatus() == QuotaValidationResult.ValidationStatus.BLOCK) {
                                                response.put("blockReason", validationResult.getReason());
                                            }

                                            return response;
                                        })
                                        .onErrorResume(quotaError -> {
                                            log.warn(
                                                    "Quota validation error for device {} in room {}, returning fail-safe validation",
                                                    deviceId, roomId, quotaError);

                                            // Fail-safe: allow command on quota validation error
                                            Map<String, Object> response = new java.util.HashMap<>();
                                            response.put("valid", true);
                                            response.put("roomId", roomId.toString());
                                            response.put("deviceId", deviceId);
                                            response.put("action", request.getAction());
                                            response.put("quotaValidationError", quotaError.getMessage());
                                            response.put("quotaStatus", "VALIDATION_ERROR");
                                            response.put("message",
                                                    "Validation service error, command allowed as fail-safe");
                                            response.put("timestamp", java.time.Instant.now().toString());
                                            return Mono.just(response);
                                        });
                            });
                })
                .doOnSuccess(response -> {
                    Boolean valid = (Boolean) response.get("valid");
                    if (valid) {
                        log.debug("Device command validation passed: {} on device {} in room {}",
                                request.getAction(), deviceId, roomId);
                    } else {
                        log.debug("Device command validation failed: {} on device {} in room {}: {}",
                                request.getAction(), deviceId, roomId, response.get("message"));
                    }
                })
                .doOnError(error -> log.error("Error validating device command {} for device {} in room {}",
                        request.getAction(), deviceId, roomId, error))
                .onErrorMap(this::mapException);
    }

    /**
     * Get device status within a room.
     * GET /api/rooms/{roomId}/devices/{deviceId}/status
     *
     * @param roomId        Room ID
     * @param deviceId      Device identifier
     * @param authorization JWT token
     * @return Mono of device status
     */
    @GetMapping("/{roomId}/devices/{deviceId}/status")
    public Mono<Map<String, Object>> getDeviceStatus(
            @PathVariable UUID roomId,
            @PathVariable String deviceId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnNext(userInfo -> log.debug("Getting device status for device {} in room {} for user {}",
                        deviceId, roomId, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    // Verify room belongs to user's household
                    return roomService.getRoomById(userInfo.getHouseholdId(), roomId)
                            .flatMap(room -> {
                                // Get device status from ReactiveAirConService
                                return Mono.zip(
                                        reactiveAirConService.getRoomState(deviceId).defaultIfEmpty(null),
                                        reactiveAirConService.getRoomSettings(deviceId).defaultIfEmpty(null),
                                        reactiveAirConService.isMqttConnected())
                                        .map(tuple -> {
                                            var state = tuple.getT1();
                                            var settings = tuple.getT2();
                                            var mqttConnected = tuple.getT3();

                                            return Map.of(
                                                    "roomId", roomId.toString(),
                                                    "deviceId", deviceId,
                                                    "status", state != null ? "available" : "unavailable",
                                                    "state", state != null ? state : Map.of(),
                                                    "settings", settings != null ? settings : Map.of(),
                                                    "mqttConnected", mqttConnected,
                                                    "lastUpdate", java.time.Instant.now().toString());
                                        });
                            });
                })
                .doOnError(error -> log.error("Error getting device status for device {} in room {}", deviceId, roomId,
                        error))
                .onErrorMap(this::mapException);
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    /**
     * Build AirConCommand from DeviceControlRequest for quota validation.
     * 
     * @param userId  User ID
     * @param roomId  Room ID
     * @param request Device control request
     * @return AirConCommand for quota validation
     */
    private AirConCommand buildAirConCommand(UUID userId, String roomId, DeviceControlRequest request) {
        AirConCommand command = AirConCommand.builder()
                .userId(userId)
                .roomId(roomId)
                .action(request.getAction())
                .value(request.getValue())
                .estimatedDurationSeconds(
                        request.getEstimatedDurationMinutes() != null ? request.getEstimatedDurationMinutes() * 60
                                : null)
                .source("unified_room_api")
                .build();

        // Add metadata from request parameters
        if (request.getParameters() != null) {
            request.getParameters().forEach(command::withMetadata);
        }

        // Extract specific values for common actions
        switch (request.getAction().toLowerCase()) {
            case "set_temperature":
                if (request.getValue() instanceof Number) {
                    command.withMetadata("targetTemperature", request.getValue());
                }
                break;
            case "set_mode":
                if (request.getValue() instanceof String) {
                    command.withMetadata("mode", request.getValue());
                }
                break;
            case "set_fan":
                if (request.getValue() instanceof String) {
                    command.withMetadata("fanSpeed", request.getValue());
                }
                break;
            case "set_vane":
                if (request.getValue() instanceof String) {
                    command.withMetadata("vanePosition", request.getValue());
                }
                break;
            case "set_wide_vane":
                if (request.getValue() instanceof String) {
                    command.withMetadata("wideVanePosition", request.getValue());
                }
                break;
        }

        return command;
    }

    /**
     * Handle automatic session management based on device power state changes.
     * 
     * @param userId  User ID
     * @param roomId  Room ID
     * @param request Device control request
     * @return Mono of session management result metadata
     */
    private Mono<Map<String, Object>> handleSessionManagement(UUID userId, UUID roomId, DeviceControlRequest request) {
        String action = request.getAction().toLowerCase();

        // Only handle session management for power-related actions
        if (!action.contains("power")) {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("sessionAction", "none");
            result.put("reason", "Not a power action");
            return Mono.just(result);
        }

        // Determine if this is a power-on or power-off action
        boolean isPowerOn = action.equals("power_on") ||
                (action.equals("power") && "on".equalsIgnoreCase(String.valueOf(request.getValue())));
        boolean isPowerOff = action.equals("power_off") ||
                (action.equals("power") && "off".equalsIgnoreCase(String.valueOf(request.getValue())));

        if (isPowerOn) {
            // Start a new usage session
            return startUsageSessionSafely(userId, roomId.toString(), request)
                    .map(session -> {
                        Map<String, Object> result = new java.util.HashMap<>();
                        result.put("sessionAction", "started");
                        result.put("sessionId", session.getId().toString());
                        result.put("message", "Usage session started automatically");
                        return result;
                    })
                    .onErrorResume(error -> {
                        log.warn("Failed to start usage session for user {} in room {}: {}",
                                userId, roomId, error.getMessage());
                        Map<String, Object> result = new java.util.HashMap<>();
                        result.put("sessionAction", "start_failed");
                        result.put("error", error.getMessage());
                        result.put("message", "Session management failed but device control succeeded");
                        return Mono.just(result);
                    });
        } else if (isPowerOff) {
            // End any active usage session
            return usageTrackingService.endActiveSession(userId, roomId.toString())
                    .map(session -> {
                        Map<String, Object> result = new java.util.HashMap<>();
                        result.put("sessionAction", "ended");
                        result.put("sessionId", session.getId().toString());
                        result.put("durationMinutes", session.getDurationMinutes());
                        result.put("message", "Usage session ended automatically");
                        return result;
                    })
                    .switchIfEmpty(Mono.fromCallable(() -> {
                        Map<String, Object> result = new java.util.HashMap<>();
                        result.put("sessionAction", "no_active_session");
                        result.put("message", "No active session to end");
                        return result;
                    }))
                    .onErrorResume(error -> {
                        log.warn("Failed to end usage session for user {} in room {}: {}",
                                userId, roomId, error.getMessage());
                        Map<String, Object> result = new java.util.HashMap<>();
                        result.put("sessionAction", "end_failed");
                        result.put("error", error.getMessage());
                        result.put("message", "Session management failed but device control succeeded");
                        return Mono.just(result);
                    });
        }

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("sessionAction", "none");
        result.put("reason", "Not a recognized power action");
        return Mono.just(result);
    }

    /**
     * Start a usage session with error handling to prevent device control failures.
     * 
     * @param userId  User ID
     * @param roomId  Room ID
     * @param request Device control request
     * @return Mono of UsageSession
     */
    private Mono<com.ashelabs.turing.entity.UsageSession> startUsageSessionSafely(UUID userId, String roomId,
            DeviceControlRequest request) {
        // Build initial AC settings from the request
        com.ashelabs.turing.dto.AirConSettings.AirConSettingsBuilder settingsBuilder = com.ashelabs.turing.dto.AirConSettings
                .builder()
                .power("on"); // Default to on since this is a power-on action

        // Extract settings from request parameters
        if (request.getParameters() != null) {
            Object temp = request.getParameters().get("temperature");
            if (temp instanceof Number) {
                settingsBuilder.temperature(((Number) temp).doubleValue());
            }

            Object mode = request.getParameters().get("mode");
            if (mode instanceof String) {
                settingsBuilder.mode((String) mode);
            }

            Object fan = request.getParameters().get("fan");
            if (fan instanceof String) {
                settingsBuilder.fan((String) fan);
            }

            Object vane = request.getParameters().get("vane");
            if (vane instanceof String) {
                settingsBuilder.vane((String) vane);
            }

            Object wideVane = request.getParameters().get("wideVane");
            if (wideVane instanceof String) {
                settingsBuilder.wideVane((String) wideVane);
            }
        }

        // Set defaults for missing values
        com.ashelabs.turing.dto.AirConSettings settings = settingsBuilder
                .temperature(22.0) // Default temperature
                .mode("auto") // Default mode
                .fan("auto") // Default fan
                .vane("auto") // Default vane
                .wideVane("auto") // Default wide vane
                .build();

        return usageTrackingService.startUsageSession(userId, roomId, settings);
    }

    /**
     * Execute device control operation via ReactiveAirConService.
     * 
     * @param roomId   Room ID
     * @param deviceId Device identifier
     * @param request  Device control request
     * @return Mono of Boolean indicating success
     */
    private Mono<Boolean> executeDeviceControl(UUID roomId, String deviceId, DeviceControlRequest request) {
        String action = request.getAction();

        log.debug("Executing device control: {} on device {} in room {}", action, deviceId, roomId);

        // Route to appropriate ReactiveAirConService method based on action
        Mono<Void> commandExecution = switch (action.toLowerCase()) {
            case "power_on" -> reactiveAirConService.setPower(deviceId, "on");
            case "power_off" -> reactiveAirConService.setPower(deviceId, "off");
            case "set_temperature" -> {
                Integer temp = extractTemperature(request.getValue());
                yield reactiveAirConService.setTemperature(deviceId, temp);
            }
            case "set_mode" -> {
                String mode = extractString(request.getValue(), "auto");
                yield reactiveAirConService.setMode(deviceId, mode);
            }
            case "set_fan" -> {
                String fan = extractString(request.getValue(), "auto");
                yield reactiveAirConService.setFan(deviceId, fan);
            }
            case "set_vane" -> {
                String vane = extractString(request.getValue(), "auto");
                yield reactiveAirConService.setVane(deviceId, vane);
            }
            case "set_wide_vane" -> {
                String wideVane = extractString(request.getValue(), "auto");
                yield reactiveAirConService.setWideVane(deviceId, wideVane);
            }
            default -> {
                log.warn("Unknown device control action: {} for device {} in room {}", action, deviceId, roomId);
                yield Mono.error(new IllegalArgumentException("Unknown device control action: " + action));
            }
        };

        return commandExecution
                .then(Mono.just(true))
                .onErrorResume(error -> {
                    log.error("Failed to execute device control via ReactiveAirConService for device {} in room {}: {}",
                            deviceId, roomId, action, error);
                    
                    // Throw appropriate device exception based on error type
                    if (error instanceof java.util.concurrent.TimeoutException) {
                        return Mono.error(DeviceUnavailableException.deviceTimeout(deviceId, roomId.toString(), 5000));
                    } else if (error.getMessage() != null && error.getMessage().toLowerCase().contains("mqtt")) {
                        return Mono.error(DeviceUnavailableException.mqttCommunicationFailure(deviceId, roomId.toString(), error));
                    } else {
                        return Mono.error(new DeviceUnavailableException(
                            "Device control failed: " + error.getMessage(), deviceId, roomId.toString()));
                    }
                })
                .doOnNext(success -> log.debug("Device control execution result for device {} in room {} action {}: {}",
                        deviceId, roomId, action, success));
    }

    /**
     * Extract temperature value from request value.
     * 
     * @param value Request value
     * @return Temperature as integer
     */
    private Integer extractTemperature(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                log.warn("Invalid temperature value: {}", value);
            }
        }
        return 22; // Default temperature
    }

    /**
     * Extract string value from request value.
     * 
     * @param value        Request value
     * @param defaultValue Default value if extraction fails
     * @return String value
     */
    private String extractString(Object value, String defaultValue) {
        if (value instanceof String) {
            return (String) value;
        }
        if (value != null) {
            return value.toString();
        }
        return defaultValue;
    }

    /**
     * Resolve the authenticated user from the reactive security context or fallback Authorization header.
     *
     * @param authorization Authorization header value (optional)
     * @return Mono with authenticated user info or unauthorized error
     */
    private Mono<JwtService.JwtUserInfo> requireAuthenticatedUser(String authorization) {
        Mono<JwtService.JwtUserInfo> fromContext = jwtAuthContext.currentUser();

        if (StringUtils.hasText(authorization)) {
            return fromContext.switchIfEmpty(jwtAuthContext.extractUserFromToken(authorization));
        }

        return fromContext.switchIfEmpty(
                Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization required")));
    }

    /**
     * Map service exceptions to HTTP responses using the centralized error handler.
     *
     * @param error Exception from service layer
     * @return ResponseStatusException with appropriate HTTP status and detailed error information
     */
    private Throwable mapException(Throwable error) {
        // Use the centralized error handler for consistent error mapping
        return RoomControllerErrorHandler.mapException(error, "/api/rooms");
    }
}
