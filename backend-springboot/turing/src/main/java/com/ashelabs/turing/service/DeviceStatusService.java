package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.room.DeviceInfo;
import com.ashelabs.turing.dto.room.DeviceStatus;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

/**
 * Service interface for device status management and real-time data access.
 * 
 * This service provides a unified interface for fetching current device status
 * from MQTT/WebSocket sources with caching and resilience patterns.
 * 
 * @since 1.0.0
 */
public interface DeviceStatusService {

    /**
     * Get current status for a specific device.
     * 
     * @param deviceIdentifier Device identifier used in MQTT communication
     * @return Mono containing device status, empty if device not found or offline
     */
    Mono<DeviceStatus> getDeviceStatus(String deviceIdentifier);

    /**
     * Get current status for multiple devices.
     * 
     * @param deviceIdentifiers List of device identifiers
     * @return Flux of device statuses (only online devices included)
     */
    Flux<DeviceStatus> getDeviceStatuses(List<String> deviceIdentifiers);

    /**
     * Get device information with current status for a specific device.
     * 
     * @param deviceIdentifier Device identifier
     * @return Mono containing device info with status, offline info if device unavailable
     */
    Mono<DeviceInfo> getDeviceInfo(String deviceIdentifier);

    /**
     * Get device information with current status for multiple devices.
     * 
     * @param deviceIdentifiers List of device identifiers
     * @return Flux of device info (includes offline devices)
     */
    Flux<DeviceInfo> getDeviceInfos(List<String> deviceIdentifiers);

    /**
     * Get all known devices with their current status.
     * 
     * @return Flux of all device information
     */
    Flux<DeviceInfo> getAllDeviceInfos();

    /**
     * Check if a device is currently online.
     * 
     * @param deviceIdentifier Device identifier
     * @return Mono containing online status
     */
    Mono<Boolean> isDeviceOnline(String deviceIdentifier);

    /**
     * Get real-time status updates for a specific device.
     * 
     * @param deviceIdentifier Device identifier
     * @return Flux of status updates
     */
    Flux<DeviceStatus> getDeviceStatusStream(String deviceIdentifier);

    /**
     * Get real-time status updates for all devices.
     * 
     * @return Flux of device status updates with device identifiers
     */
    Flux<DeviceStatusUpdate> getAllDeviceStatusUpdates();

    /**
     * Invalidate cached status for a specific device.
     * 
     * @param deviceIdentifier Device identifier
     * @return Mono that completes when cache is invalidated
     */
    Mono<Void> invalidateDeviceCache(String deviceIdentifier);

    /**
     * Invalidate all cached device statuses.
     * 
     * @return Mono that completes when all caches are invalidated
     */
    Mono<Void> invalidateAllCaches();

    /**
     * Get cache statistics for monitoring.
     * 
     * @return Mono containing cache statistics
     */
    Mono<CacheStatistics> getCacheStatistics();

    /**
     * DTO for device status updates with device identifier.
     */
    record DeviceStatusUpdate(String deviceIdentifier, DeviceStatus status) {}

    /**
     * DTO for cache statistics.
     */
    record CacheStatistics(
        int totalCachedDevices,
        int onlineDevices,
        int offlineDevices,
        Duration averageCacheAge,
        long cacheHits,
        long cacheMisses,
        double hitRatio
    ) {}
}