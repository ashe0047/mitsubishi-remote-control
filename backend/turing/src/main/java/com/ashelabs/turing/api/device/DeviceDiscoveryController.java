package com.ashelabs.turing.api.device;

import com.ashelabs.turing.api.device.dto.DeviceDto;
import com.ashelabs.turing.api.device.dto.DiscoveredDeviceDto;
import com.ashelabs.turing.application.device.DeviceDiscoveryService;
import com.ashelabs.turing.domain.device.DeviceType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

/**
 * REST API for device discovery and registration.
 * Supports both manual registration and MQTT-driven discovery.
 */
@RestController
@RequestMapping("/api/devices/discovery")
public class DeviceDiscoveryController {

    private final DeviceDiscoveryService deviceDiscoveryService;

    public DeviceDiscoveryController(DeviceDiscoveryService deviceDiscoveryService) {
        this.deviceDiscoveryService = deviceDiscoveryService;
    }

    /**
     * Get all discovered devices pending registration.
     */
    @GetMapping
    public Flux<DiscoveredDeviceDto> getAllDiscoveredDevices() {
        return deviceDiscoveryService.getAllDiscoveries()
            .map(DiscoveredDeviceDto::from);
    }

    /**
     * Get discovered devices scoped to a specific room.
     */
    @GetMapping("/room/{roomId}")
    public Flux<DiscoveredDeviceDto> getDiscoveredDevices(@PathVariable UUID roomId) {
        return deviceDiscoveryService.getDiscoveriesByRoom(roomId)
            .map(DiscoveredDeviceDto::from);
    }

    /**
     * Register a discovered device to a room.
     * Called by UI when user confirms device registration.
     */
    @PostMapping("/register")
    public Mono<DeviceDto> registerDiscoveredDevice(
        @RequestParam(required = false) UUID roomId,
        @RequestParam String deviceIdentifier,
        @RequestParam(required = false) String deviceType,
        @RequestBody(required = false) Map<String, Object> metadata
    ) {
        DeviceType resolvedType = (deviceType != null && !deviceType.isBlank())
            ? DeviceType.fromCode(deviceType)
            : null;

        return deviceDiscoveryService.registerDiscoveredDevice(
            roomId,
            deviceIdentifier,
            resolvedType,
            metadata
        ).map(DeviceDto::from);
    }

    /**
     * Dismiss a discovered device without registering it.
     */
    @DeleteMapping("/{deviceIdentifier}")
    public Mono<Void> dismissDiscoveredDevice(@PathVariable String deviceIdentifier) {
        return deviceDiscoveryService.dismissDiscovery(deviceIdentifier);
    }
}
