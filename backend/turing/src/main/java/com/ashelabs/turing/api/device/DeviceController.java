package com.ashelabs.turing.api.device;

import com.ashelabs.turing.api.device.dto.DeviceCommandRequest;
import com.ashelabs.turing.api.device.dto.DeviceDto;
import com.ashelabs.turing.api.device.dto.RegisterDeviceRequest;
import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

/**
 * REST API controller for device management and control.
 * Provides endpoints for device registration, querying, and command execution.
 */
@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    /**
     * Get all devices for the authenticated user's household.
     *
     * GET /api/devices
     */
    @GetMapping
    public Flux<DeviceDto> getAllDevices() {
        return deviceService.getAllDevices()
            .map(DeviceDto::from);
    }

    /**
     * Register a new device.
     *
     * POST /api/devices
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<DeviceDto> registerDevice(@Valid @RequestBody RegisterDeviceRequest request) {
        return deviceService.registerDevice(
            request.roomId(),
            DeviceType.fromCode(request.deviceType()),
            request.deviceIdentifier(),
            request.manufacturer(),
            request.model(),
            request.metadata()
        ).map(DeviceDto::from);
    }

    /**
     * Get all devices in a room.
     *
     * GET /api/devices/room/{roomId}
     */
    @GetMapping("/room/{roomId}")
    public Flux<DeviceDto> getDevicesByRoom(@PathVariable UUID roomId) {
        return deviceService.getDevicesByRoom(roomId)
            .map(DeviceDto::from);
    }

    /**
     * Get enabled devices in a room.
     *
     * GET /api/devices/room/{roomId}/enabled
     */
    @GetMapping("/room/{roomId}/enabled")
    public Flux<DeviceDto> getEnabledDevicesByRoom(@PathVariable UUID roomId) {
        return deviceService.getEnabledDevicesByRoom(roomId)
            .map(DeviceDto::from);
    }

    /**
     * Get device by identifier.
     *
     * GET /api/devices/{deviceIdentifier}
     */
    @GetMapping("/{deviceIdentifier}")
    public Mono<DeviceDto> getDeviceByIdentifier(@PathVariable String deviceIdentifier) {
        return deviceService.getDeviceByIdentifier(deviceIdentifier)
            .map(DeviceDto::from);
    }

    /**
     * Update device metadata.
     *
     * PATCH /api/devices/{deviceId}/metadata
     */
    @PatchMapping("/{deviceId}/metadata")
    public Mono<DeviceDto> updateMetadata(
        @PathVariable UUID deviceId,
        @RequestBody Map<String, Object> metadata
    ) {
        return deviceService.updateDeviceMetadata(deviceId, metadata)
            .map(DeviceDto::from);
    }

    /**
     * Enable or disable device.
     *
     * PATCH /api/devices/{deviceId}/enabled?enabled=true
     */
    @PatchMapping("/{deviceId}/enabled")
    public Mono<DeviceDto> setEnabled(
        @PathVariable UUID deviceId,
        @RequestParam boolean enabled
    ) {
        return deviceService.setDeviceEnabled(deviceId, enabled)
            .map(DeviceDto::from);
    }

    /**
     * Toggle device enabled state.
     *
     * PATCH /api/devices/{deviceId}/toggle-enabled
     */
    @PatchMapping("/{deviceId}/toggle-enabled")
    public Mono<DeviceDto> toggleEnabled(@PathVariable UUID deviceId) {
        return deviceService.toggleDeviceEnabled(deviceId)
            .map(DeviceDto::from);
    }

    /**
     * Set device temperature.
     *
     * POST /api/devices/command/temperature
     */
    @PostMapping("/command/temperature")
    public Mono<Void> setTemperature(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.temperature() == null) {
            return Mono.error(new IllegalArgumentException("Temperature is required"));
        }
        return deviceService.setDeviceTemperature(request.deviceIdentifier(), request.temperature());
    }

    /**
     * Set device mode.
     *
     * POST /api/devices/command/mode
     */
    @PostMapping("/command/mode")
    public Mono<Void> setMode(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.mode() == null) {
            return Mono.error(new IllegalArgumentException("Mode is required"));
        }
        return deviceService.setDeviceMode(request.deviceIdentifier(), request.mode());
    }

    /**
     * Set fan speed.
     *
     * POST /api/devices/command/fan
     */
    @PostMapping("/command/fan")
    public Mono<Void> setFanSpeed(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.fanSpeed() == null) {
            return Mono.error(new IllegalArgumentException("Fan speed is required"));
        }
        return deviceService.setDeviceFanSpeed(request.deviceIdentifier(), request.fanSpeed());
    }

    /**
     * Set power state.
     *
     * POST /api/devices/command/power
     */
    @PostMapping("/command/power")
    public Mono<Void> setPower(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.power() == null) {
            return Mono.error(new IllegalArgumentException("Power state is required"));
        }
        return deviceService.setDevicePower(request.deviceIdentifier(), request.power());
    }

    /**
     * Set vane position.
     *
     * POST /api/devices/command/vane
     */
    @PostMapping("/command/vane")
    public Mono<Void> setVanePosition(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.vanePosition() == null) {
            return Mono.error(new IllegalArgumentException("Vane position is required"));
        }
        return deviceService.setDeviceVanePosition(request.deviceIdentifier(), request.vanePosition());
    }

    /**
     * Set wide vane position.
     *
     * POST /api/devices/command/wide-vane
     */
    @PostMapping("/command/wide-vane")
    public Mono<Void> setWideVanePosition(@Valid @RequestBody DeviceCommandRequest request) {
        if (request.wideVanePosition() == null) {
            return Mono.error(new IllegalArgumentException("Wide vane position is required"));
        }
        return deviceService.setDeviceWideVanePosition(request.deviceIdentifier(), request.wideVanePosition());
    }

    /**
     * Delete device.
     *
     * DELETE /api/devices/{deviceId}
     */
    @DeleteMapping("/{deviceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteDevice(@PathVariable UUID deviceId) {
        return deviceService.deleteDevice(deviceId);
    }
}
