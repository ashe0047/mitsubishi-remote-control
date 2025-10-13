package com.ashelabs.turing.application.device;

import com.ashelabs.turing.domain.device.Device;
import com.ashelabs.turing.domain.device.DeviceRepository;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.domain.device.protocol.ProtocolPublisher;
import com.ashelabs.turing.domain.device.protocol.ProtocolPublisherFactory;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDevice;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

/**
 * Application service for device management and control.
 * Orchestrates domain logic and protocol publishing.
 *
 * Responsibilities:
 * - Device registration and lifecycle management
 * - Command routing to appropriate protocol publishers
 * - Device state validation and business rules
 */
@Service
public class DeviceService {

    private static final Logger logger = LoggerFactory.getLogger(DeviceService.class);

    private final DeviceRepository deviceRepository;
    private final ProtocolPublisherFactory publisherFactory;
    private final DiscoveredDeviceRepository discoveredDeviceRepository;

    public DeviceService(
        DeviceRepository deviceRepository,
        ProtocolPublisherFactory publisherFactory,
        DiscoveredDeviceRepository discoveredDeviceRepository
    ) {
        this.deviceRepository = deviceRepository;
        this.publisherFactory = publisherFactory;
        this.discoveredDeviceRepository = discoveredDeviceRepository;
    }

    /**
     * Register a new device in a room.
     *
     * @param roomId Room UUID
     * @param deviceType Type of device
     * @param deviceIdentifier Device identifier
     * @param manufacturer Manufacturer name
     * @param model Model name
     * @param metadata Custom metadata
     * @return Registered device
     */
    public Mono<Device> registerDevice(
        UUID roomId,
        DeviceType deviceType,
        String deviceIdentifier,
        String manufacturer,
        String model,
        Map<String, Object> metadata
    ) {
        return deviceRepository.existsByRoomIdAndDeviceIdentifier(roomId, deviceIdentifier)
            .flatMap(exists -> {
                if (exists) {
                    return Mono.error(new com.ashelabs.turing.exception.DeviceAlreadyExistsException(
                        deviceIdentifier, roomId.toString()
                    ));
                }

                Device device = Device.create(
                    roomId, deviceType, deviceIdentifier, manufacturer, model, metadata
                );

                return deviceRepository.save(device)
                    .doOnSuccess(d -> logger.info("Registered device: {}", d.deviceIdentifier()));
            });
    }

    /**
     * Get all devices across all rooms for the authenticated user's household.
     */
    public Flux<Device> getAllDevices() {
        return deviceRepository.findAll();
    }

    /**
     * Get all devices for a room.
     */
    public Flux<Device> getDevicesByRoom(UUID roomId) {
        return deviceRepository.findByRoomId(roomId);
    }

    /**
     * Get enabled devices for a room.
     */
    public Flux<Device> getEnabledDevicesByRoom(UUID roomId) {
        return deviceRepository.findEnabledByRoomId(roomId);
    }

    /**
     * Get device by identifier.
     */
    public Mono<Device> getDeviceByIdentifier(String deviceIdentifier) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier);
    }

    /**
     * Update device metadata.
     */
    public Mono<Device> updateDeviceMetadata(UUID deviceId, Map<String, Object> metadata) {
        return deviceRepository.findById(deviceId)
            .flatMap(device -> {
                Device updated = device.withMetadata(metadata);
                return deviceRepository.save(updated);
            });
    }

    /**
     * Enable or disable a device.
     */
    public Mono<Device> setDeviceEnabled(UUID deviceId, boolean enabled) {
        return deviceRepository.findById(deviceId)
            .flatMap(device -> {
                Device updated = device.withEnabled(enabled);
                return deviceRepository.save(updated);
            });
    }

    /**
     * Toggle the enabled state of a device.
     */
    public Mono<Device> toggleDeviceEnabled(UUID deviceId) {
        return deviceRepository.findById(deviceId)
            .flatMap(device -> deviceRepository.save(device.withEnabled(!device.enabled())));
    }

    /**
     * Send temperature command to device via appropriate protocol.
     */
    public Mono<Void> setDeviceTemperature(String deviceIdentifier, int temperature) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setTemperature(deviceIdentifier, temperature)
                    .doOnSuccess(v -> logger.info("Set temperature {} for device {}", temperature, deviceIdentifier));
            });
    }

    /**
     * Send mode command to device via appropriate protocol.
     */
    public Mono<Void> setDeviceMode(String deviceIdentifier, String mode) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setMode(deviceIdentifier, mode);
            });
    }

    /**
     * Send fan speed command to device via appropriate protocol.
     */
    public Mono<Void> setDeviceFanSpeed(String deviceIdentifier, String fanSpeed) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setFanSpeed(deviceIdentifier, fanSpeed);
            });
    }

    /**
     * Send power command to device via appropriate protocol.
     */
    public Mono<Void> setDevicePower(String deviceIdentifier, boolean on) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setPower(deviceIdentifier, on);
            });
    }

    /**
     * Send vane position command to device via appropriate protocol.
     */
    public Mono<Void> setDeviceVanePosition(String deviceIdentifier, String position) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setVanePosition(deviceIdentifier, position);
            });
    }

    /**
     * Send wide vane position command to device via appropriate protocol.
     */
    public Mono<Void> setDeviceWideVanePosition(String deviceIdentifier, String position) {
        return deviceRepository.findByDeviceIdentifier(deviceIdentifier)
            .flatMap(device -> {
                if (!device.enabled()) {
                    return Mono.error(new IllegalStateException("Device is disabled: " + deviceIdentifier));
                }

                ProtocolPublisher publisher = publisherFactory.getDefaultPublisher();
                return publisher.setWideVanePosition(deviceIdentifier, position);
            });
    }

    /**
     * Delete a device.
     */
    public Mono<Void> deleteDevice(UUID deviceId) {
        return deviceRepository.findById(deviceId)
            .flatMap(device ->
                deviceRepository.deleteById(deviceId)
                    .doOnSuccess(v -> logger.info("Deleted device: {}", deviceId))
                    .then(
                        // Re-introduce the device into discovery so it appears for registration again
                        discoveredDeviceRepository.save(
                            new DiscoveredDevice(
                                device.deviceIdentifier().value(),
                                null, // no room association after removal
                                device.deviceType(),
                                Map.of(),
                                Map.of("reintroduced", true),
                                java.time.Instant.now(),
                                java.time.Instant.now(),
                                true
                            )
                        ).doOnSuccess(d -> logger.info("Reintroduced device {} into discovery after deletion", d.deviceIdentifier()))
                    )
            )
            .onErrorResume(err -> {
                logger.error("Failed to delete device {} or reintroduce into discovery: {}", deviceId, err.getMessage());
                return Mono.error(err);
            })
            .then();
    }
}
