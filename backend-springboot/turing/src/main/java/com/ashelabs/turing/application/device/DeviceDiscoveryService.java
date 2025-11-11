package com.ashelabs.turing.application.device;

import com.ashelabs.turing.domain.device.Device;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDevice;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDeviceRepository;
import com.ashelabs.turing.exception.DiscoveredDeviceNotFoundException;
import com.ashelabs.turing.exception.InvalidDeviceDiscoveryRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Application service coordinating device discovery lifecycle operations.
 */
@Service
public class DeviceDiscoveryService {

    private static final Logger logger = LoggerFactory.getLogger(DeviceDiscoveryService.class);

    private final DiscoveredDeviceRepository discoveryRepository;
    private final DeviceService deviceService;
    private final Clock clock;

    public DeviceDiscoveryService(
        DiscoveredDeviceRepository discoveryRepository,
        DeviceService deviceService
    ) {
        this.discoveryRepository = discoveryRepository;
        this.deviceService = deviceService;
        this.clock = Clock.systemUTC();
    }

    public Flux<DiscoveredDevice> getAllDiscoveries() {
        return discoveryRepository.findAll();
    }

    public Flux<DiscoveredDevice> getDiscoveriesByRoom(UUID roomId) {
        Objects.requireNonNull(roomId, "roomId must not be null");
        return discoveryRepository.findAll()
            .filter(discovery -> roomId.equals(discovery.roomId()) || discovery.roomId() == null);
    }

    public Mono<DiscoveredDevice> recordDiscovery(
        String deviceIdentifier,
        UUID roomId,
        DeviceType deviceType,
        Map<String, Object> payload,
        Map<String, Object> metadata
    ) {
        Instant now = clock.instant();
        Map<String, Object> safeMetadata = sanitize(metadata);
        Map<String, Object> safePayload = sanitize(payload);

        return discoveryRepository.findByDeviceIdentifier(deviceIdentifier)
            .map(existing -> existing.refresh(
                now,
                safePayload.isEmpty() ? null : safePayload,
                safeMetadata.isEmpty() ? null : safeMetadata,
                deviceType,
                roomId
            ))
            .defaultIfEmpty(new DiscoveredDevice(
                deviceIdentifier,
                roomId,
                deviceType,
                safePayload,
                safeMetadata,
                now,
                now,
                true
            ))
            .flatMap(discoveryRepository::save)
            .doOnSuccess(discovery -> logger.info("Recorded discovery for device {}", discovery.deviceIdentifier()));
    }

    public Mono<Void> dismissDiscovery(String deviceIdentifier) {
        return discoveryRepository.deleteByDeviceIdentifier(deviceIdentifier)
            .doOnSuccess(ignored -> logger.info("Dismissed discovery for device {}", deviceIdentifier));
    }

    public Mono<Device> registerDiscoveredDevice(
        UUID roomId,
        String deviceIdentifier,
        DeviceType deviceType,
        Map<String, Object> metadata
    ) {
        return discoveryRepository.findByDeviceIdentifier(deviceIdentifier)
            .switchIfEmpty(Mono.error(new DiscoveredDeviceNotFoundException(deviceIdentifier)))
            .flatMap(discovery -> {
                UUID targetRoom = roomId != null ? roomId : discovery.roomId();
                if (targetRoom == null) {
                    return Mono.error(new InvalidDeviceDiscoveryRequestException("Room ID is required to register discovered device"));
                }

                DeviceType targetType = deviceType != null ? deviceType : discovery.deviceType();
                if (targetType == null) {
                    return Mono.error(new InvalidDeviceDiscoveryRequestException("Device type is required to register discovered device"));
                }

                Map<String, Object> mergedMetadata = mergeMetadata(discovery.metadata(), metadata);

                // Extract manufacturer and model from metadata if present
                String manufacturer = extractStringFromMetadata(mergedMetadata, "manufacturer");
                String model = extractStringFromMetadata(mergedMetadata, "model");

                return deviceService.registerDevice(
                    targetRoom,
                    targetType,
                    deviceIdentifier,
                    manufacturer,
                    model,
                    mergedMetadata
                ).flatMap(device -> discoveryRepository.deleteByDeviceIdentifier(deviceIdentifier)
                    .thenReturn(device)
                );
            })
            .doOnSuccess(device -> logger.info("Registered discovered device {} for room {}", device.deviceIdentifier(), device.roomId()));
    }

    private Map<String, Object> sanitize(Map<String, Object> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }

        return source.entrySet().stream()
            .filter(entry -> entry.getKey() != null && entry.getValue() != null)
            .collect(Collectors.toUnmodifiableMap(
                Map.Entry::getKey,
                Map.Entry::getValue
            ));
    }

    private Map<String, Object> mergeMetadata(Map<String, Object> discoveryMetadata, Map<String, Object> requestMetadata) {
        if ((requestMetadata == null || requestMetadata.isEmpty()) && (discoveryMetadata == null || discoveryMetadata.isEmpty())) {
            return Map.of("discovered", true);
        }

        LinkedHashMap<String, Object> merged = new LinkedHashMap<>();
        if (discoveryMetadata != null) {
            merged.putAll(discoveryMetadata);
        }
        if (requestMetadata != null) {
            merged.putAll(requestMetadata);
        }
        merged.putIfAbsent("discovered", true);
        return Map.copyOf(merged);
    }

    private String extractStringFromMetadata(Map<String, Object> metadata, String key) {
        if (metadata == null || !metadata.containsKey(key)) {
            return null;
        }
        Object value = metadata.get(key);
        return value instanceof String ? (String) value : null;
    }
}
