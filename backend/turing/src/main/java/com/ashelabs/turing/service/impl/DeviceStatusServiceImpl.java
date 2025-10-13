package com.ashelabs.turing.service.impl;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.room.DeviceInfo;
import com.ashelabs.turing.dto.room.DeviceStatus;
import com.ashelabs.turing.service.DeviceStatusService;
import com.ashelabs.turing.service.ReactiveAirConService;
import com.ashelabs.turing.service.ResilienceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;


import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Implementation of DeviceStatusService with caching and resilience patterns.
 * 
 * This service provides real-time device status information with:
 * - In-memory caching with TTL
 * - Circuit breaker pattern for resilience
 * - Retry logic with exponential backoff
 * - Graceful degradation for offline devices
 * 
 * @since 1.0.0
 */
@Slf4j
@Service
public class DeviceStatusServiceImpl implements DeviceStatusService {

    private final ReactiveAirConService airConService;
    private final ResilienceService resilienceService;
    
    // Cache for device statuses with TTL
    private final ConcurrentMap<String, CachedDeviceStatus> statusCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CachedDeviceInfo> infoCache = new ConcurrentHashMap<>();
    
    // Cache statistics
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong cacheMisses = new AtomicLong(0);
    
    // Configuration
    private static final Duration CACHE_TTL = Duration.ofSeconds(30);
    private static final Duration OFFLINE_CACHE_TTL = Duration.ofMinutes(2);
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final Duration RETRY_MIN_BACKOFF = Duration.ofMillis(100);
    private static final Duration RETRY_MAX_BACKOFF = Duration.ofSeconds(2);

    @Autowired
    public DeviceStatusServiceImpl(ReactiveAirConService airConService, ResilienceService resilienceService) {
        this.airConService = airConService;
        this.resilienceService = resilienceService;
        
        // Start cache cleanup task
        startCacheCleanupTask();
    }

    @Override
    public Mono<DeviceStatus> getDeviceStatus(String deviceIdentifier) {
        log.debug("Getting device status for: {}", deviceIdentifier);
        
        return getCachedStatus(deviceIdentifier)
            .switchIfEmpty(fetchAndCacheStatus(deviceIdentifier))
            .doOnNext(status -> log.debug("Retrieved status for device {}: {}", deviceIdentifier, status))
            .doOnError(error -> log.warn("Failed to get status for device {}: {}", deviceIdentifier, error.getMessage()));
    }

    @Override
    public Flux<DeviceStatus> getDeviceStatuses(List<String> deviceIdentifiers) {
        log.debug("Getting device statuses for {} devices", deviceIdentifiers.size());
        
        return Flux.fromIterable(deviceIdentifiers)
            .flatMap(deviceId -> getDeviceStatus(deviceId)
                .onErrorResume(error -> {
                    log.warn("Failed to get status for device {}, skipping: {}", deviceId, error.getMessage());
                    return Mono.empty();
                }))
            .doOnComplete(() -> log.debug("Retrieved statuses for available devices"));
    }

    @Override
    public Mono<DeviceInfo> getDeviceInfo(String deviceIdentifier) {
        log.debug("Getting device info for: {}", deviceIdentifier);
        
        return getCachedDeviceInfo(deviceIdentifier)
            .switchIfEmpty(fetchAndCacheDeviceInfo(deviceIdentifier))
            .doOnNext(info -> log.debug("Retrieved device info for {}: online={}", deviceIdentifier, info.isOnline()))
            .doOnError(error -> log.warn("Failed to get device info for {}: {}", deviceIdentifier, error.getMessage()));
    }

    @Override
    public Flux<DeviceInfo> getDeviceInfos(List<String> deviceIdentifiers) {
        log.debug("Getting device infos for {} devices", deviceIdentifiers.size());

        return Flux.fromIterable(deviceIdentifiers)
            .doOnNext(deviceId -> log.info("Processing device identifier: {}", deviceId))
            .flatMap(deviceId -> getDeviceInfo(deviceId)
                .doOnSuccess(info -> log.info("Successfully got device info for {}: online={}, enabled={}",
                    deviceId, info != null ? info.isOnline() : "null", info != null ? info.isEnabled() : "null"))
                .onErrorResume(error -> {
                    log.warn("Failed to get info for device {}, returning offline info: {}", deviceId, error.getMessage());
                    return Mono.just(DeviceInfo.offline(deviceId, deviceId));
                }))
            .doOnComplete(() -> log.debug("Retrieved device infos for all devices (some may be offline)"));
    }

    @Override
    public Flux<DeviceInfo> getAllDeviceInfos() {
        log.debug("Getting all device infos");
        
        return airConService.getRooms()
            .flatMapMany(rooms -> Flux.fromIterable(rooms))
            .map(room -> room.getId())
            .flatMap(this::getDeviceInfo)
            .doOnComplete(() -> log.debug("Retrieved all device infos"));
    }

    @Override
    public Mono<Boolean> isDeviceOnline(String deviceIdentifier) {
        return getDeviceInfo(deviceIdentifier)
            .map(DeviceInfo::isOnline)
            .defaultIfEmpty(false);
    }

    @Override
    public Flux<DeviceStatus> getDeviceStatusStream(String deviceIdentifier) {
        log.debug("Starting status stream for device: {}", deviceIdentifier);
        
        return airConService.getStateStream(deviceIdentifier)
            .zipWith(airConService.getSettingsStream(deviceIdentifier), 
                (state, settings) -> DeviceStatus.fromAirConData(state, settings))
            .doOnSubscribe(s -> log.info("Client subscribed to status stream for device: {}", deviceIdentifier))
            .doOnCancel(() -> log.info("Client unsubscribed from status stream for device: {}", deviceIdentifier))
            .doOnError(error -> log.warn("Error in status stream for device {}: {}", deviceIdentifier, error.getMessage()));
    }

    @Override
    public Flux<DeviceStatusUpdate> getAllDeviceStatusUpdates() {
        log.debug("Starting all device status updates stream");
        
        return Flux.merge(
            airConService.getAllStateUpdates()
                .zipWith(airConService.getAllSettingsUpdates(), 
                    (stateUpdate, settingsUpdate) -> {
                        if (stateUpdate.getRoomId().equals(settingsUpdate.getRoomId())) {
                            DeviceStatus status = DeviceStatus.fromAirConData(
                                stateUpdate.getState(), settingsUpdate.getSettings());
                            return new DeviceStatusUpdate(stateUpdate.getRoomId(), status);
                        }
                        return null;
                    })
                .filter(update -> update != null)
        )
        .doOnSubscribe(s -> log.info("Client subscribed to all device status updates"))
        .doOnCancel(() -> log.info("Client unsubscribed from all device status updates"))
        .doOnError(error -> log.warn("Error in all device status updates stream: {}", error.getMessage()));
    }

    @Override
    public Mono<Void> invalidateDeviceCache(String deviceIdentifier) {
        return Mono.fromRunnable(() -> {
            statusCache.remove(deviceIdentifier);
            infoCache.remove(deviceIdentifier);
            log.debug("Invalidated cache for device: {}", deviceIdentifier);
        });
    }

    @Override
    public Mono<Void> invalidateAllCaches() {
        return Mono.fromRunnable(() -> {
            statusCache.clear();
            infoCache.clear();
            log.info("Invalidated all device caches");
        });
    }

    @Override
    public Mono<CacheStatistics> getCacheStatistics() {
        return Mono.fromCallable(() -> {
            long totalHits = cacheHits.get();
            long totalMisses = cacheMisses.get();
            long totalRequests = totalHits + totalMisses;
            double hitRatio = totalRequests > 0 ? (double) totalHits / totalRequests : 0.0;
            
            int onlineDevices = (int) infoCache.values().stream()
                .filter(cached -> !cached.isExpired())
                .map(CachedDeviceInfo::deviceInfo)
                .filter(DeviceInfo::isOnline)
                .count();
                
            int offlineDevices = (int) infoCache.values().stream()
                .filter(cached -> !cached.isExpired())
                .map(CachedDeviceInfo::deviceInfo)
                .filter(info -> !info.isOnline())
                .count();
            
            Duration averageCacheAge = infoCache.values().stream()
                .filter(cached -> !cached.isExpired())
                .map(cached -> Duration.between(cached.timestamp(), Instant.now()))
                .reduce(Duration.ZERO, Duration::plus)
                .dividedBy(Math.max(1, infoCache.size()));
            
            return new CacheStatistics(
                infoCache.size(),
                onlineDevices,
                offlineDevices,
                averageCacheAge,
                totalHits,
                totalMisses,
                hitRatio
            );
        });
    }

    // Private helper methods

    private Mono<DeviceStatus> getCachedStatus(String deviceIdentifier) {
        CachedDeviceStatus cached = statusCache.get(deviceIdentifier);
        if (cached != null && !cached.isExpired()) {
            cacheHits.incrementAndGet();
            log.debug("Cache hit for device status: {}", deviceIdentifier);
            return Mono.just(cached.status());
        }
        cacheMisses.incrementAndGet();
        return Mono.empty();
    }

    private Mono<DeviceInfo> getCachedDeviceInfo(String deviceIdentifier) {
        CachedDeviceInfo cached = infoCache.get(deviceIdentifier);
        if (cached != null && !cached.isExpired()) {
            cacheHits.incrementAndGet();
            log.debug("Cache hit for device info: {}", deviceIdentifier);
            return Mono.just(cached.deviceInfo());
        }
        cacheMisses.incrementAndGet();
        return Mono.empty();
    }

    private Mono<DeviceStatus> fetchAndCacheStatus(String deviceIdentifier) {
        return fetchDeviceStatus(deviceIdentifier)
            .doOnNext(status -> {
                statusCache.put(deviceIdentifier, new CachedDeviceStatus(status, Instant.now()));
                log.debug("Cached status for device: {}", deviceIdentifier);
            })
            .onErrorResume(error -> {
                log.warn("Failed to fetch status for device {}, returning offline status: {}", 
                    deviceIdentifier, error.getMessage());
                DeviceStatus offlineStatus = DeviceStatus.offline();
                statusCache.put(deviceIdentifier, new CachedDeviceStatus(offlineStatus, Instant.now()));
                return Mono.just(offlineStatus);
            });
    }

    private Mono<DeviceInfo> fetchAndCacheDeviceInfo(String deviceIdentifier) {
        return fetchDeviceInfo(deviceIdentifier)
            .doOnNext(info -> {
                Duration ttl = info.isOnline() ? CACHE_TTL : OFFLINE_CACHE_TTL;
                infoCache.put(deviceIdentifier, new CachedDeviceInfo(info, Instant.now(), ttl));
                log.debug("Cached device info for {}: online={}", deviceIdentifier, info.isOnline());
            })
            .onErrorResume(error -> {
                log.warn("Failed to fetch device info for {}, returning offline info: {}", 
                    deviceIdentifier, error.getMessage());
                DeviceInfo offlineInfo = DeviceInfo.offline(deviceIdentifier, deviceIdentifier);
                infoCache.put(deviceIdentifier, new CachedDeviceInfo(offlineInfo, Instant.now(), OFFLINE_CACHE_TTL));
                return Mono.just(offlineInfo);
            });
    }

    private Mono<DeviceStatus> fetchDeviceStatus(String deviceIdentifier) {
        // Wrap nullable results in Optional to avoid Mono.defaultIfEmpty(null) issues
        Mono<java.util.Optional<AirConState>> stateOptional = airConService.getRoomState(deviceIdentifier)
            .map(java.util.Optional::of)
            .switchIfEmpty(Mono.just(java.util.Optional.empty()));

        Mono<java.util.Optional<AirConSettings>> settingsOptional = airConService.getRoomSettings(deviceIdentifier)
            .map(java.util.Optional::of)
            .switchIfEmpty(Mono.just(java.util.Optional.empty()));

        Mono<DeviceStatus> operation = Mono.zip(stateOptional, settingsOptional)
            .map(tuple -> DeviceStatus.fromAirConData(tuple.getT1().orElse(null), tuple.getT2().orElse(null)))
            .subscribeOn(Schedulers.boundedElastic());

        return resilienceService.withRetryAndCircuitBreaker(
            "device-status-" + deviceIdentifier,
            resilienceService.withTimeout(operation, Duration.ofSeconds(5)),
            MAX_RETRY_ATTEMPTS,
            RETRY_MIN_BACKOFF,
            RETRY_MAX_BACKOFF
        );
    }

    private Mono<DeviceInfo> fetchDeviceInfo(String deviceIdentifier) {
        log.info("fetchDeviceInfo called for device: {}", deviceIdentifier);

        // Wrap nullable results in Optional to avoid Mono.just(null) issues
        Mono<java.util.Optional<AirConState>> stateOptional = airConService.getRoomState(deviceIdentifier)
            .doOnSuccess(state -> log.info("Got state for {}: present", deviceIdentifier))
            .map(java.util.Optional::of)
            .switchIfEmpty(Mono.fromCallable(() -> {
                log.info("Got state for {}: empty", deviceIdentifier);
                return java.util.Optional.empty();
            }));

        Mono<java.util.Optional<AirConSettings>> settingsOptional = airConService.getRoomSettings(deviceIdentifier)
            .doOnSuccess(settings -> log.info("Got settings for {}: present", deviceIdentifier))
            .map(java.util.Optional::of)
            .switchIfEmpty(Mono.fromCallable(() -> {
                log.info("Got settings for {}: empty", deviceIdentifier);
                return java.util.Optional.empty();
            }));

        Mono<Boolean> onlineStatus = isDeviceOnlineInternal(deviceIdentifier)
            .doOnSuccess(online -> log.info("Got online status for {}: {}", deviceIdentifier, online));

        Mono<DeviceInfo> operation = Mono.zip(stateOptional, settingsOptional, onlineStatus)
            .doOnNext(tuple -> log.info("Zipped data for {}: state={}, settings={}, online={}",
                deviceIdentifier, tuple.getT1().isPresent(), tuple.getT2().isPresent(), tuple.getT3()))
            .map(tuple -> {
                AirConState state = tuple.getT1().orElse(null);
                AirConSettings settings = tuple.getT2().orElse(null);
                boolean online = tuple.getT3();
                DeviceInfo info = DeviceInfo.fromMqttDevice(deviceIdentifier, deviceIdentifier, state, settings, online);
                log.info("Created DeviceInfo for {}: online={}, enabled={}", deviceIdentifier, info.isOnline(), info.isEnabled());
                return info;
            })
            .subscribeOn(Schedulers.boundedElastic());

        return resilienceService.withRetryAndCircuitBreaker(
            "device-info-" + deviceIdentifier,
            resilienceService.withTimeout(operation, Duration.ofSeconds(5)),
            MAX_RETRY_ATTEMPTS,
            RETRY_MIN_BACKOFF,
            RETRY_MAX_BACKOFF
        )
        .doOnSuccess(info -> log.info("fetchDeviceInfo SUCCESS for {}: {}", deviceIdentifier, info != null ? "present" : "null"))
        .doOnError(error -> log.error("fetchDeviceInfo ERROR for {}: {}", deviceIdentifier, error.getMessage(), error));
    }

    private Mono<Boolean> isDeviceOnlineInternal(String deviceIdentifier) {
        return airConService.getRooms()
            .map(rooms -> rooms.stream()
                .anyMatch(room -> room.getId().equals(deviceIdentifier) && room.isOnline()))
            .defaultIfEmpty(false);
    }

    private void startCacheCleanupTask() {
        Flux.interval(Duration.ofMinutes(1))
            .doOnNext(tick -> cleanupExpiredCaches())
            .subscribe(
                tick -> log.trace("Cache cleanup completed"),
                error -> log.error("Error in cache cleanup task", error)
            );
    }

    private void cleanupExpiredCaches() {
        int removedStatusCaches = 0;
        int removedInfoCaches = 0;
        
        // Clean up expired status caches
        var statusIterator = statusCache.entrySet().iterator();
        while (statusIterator.hasNext()) {
            var entry = statusIterator.next();
            if (entry.getValue().isExpired()) {
                statusIterator.remove();
                removedStatusCaches++;
            }
        }
        
        // Clean up expired info caches
        var infoIterator = infoCache.entrySet().iterator();
        while (infoIterator.hasNext()) {
            var entry = infoIterator.next();
            if (entry.getValue().isExpired()) {
                infoIterator.remove();
                removedInfoCaches++;
            }
        }
        
        if (removedStatusCaches > 0 || removedInfoCaches > 0) {
            log.debug("Cache cleanup: removed {} status caches, {} info caches", 
                removedStatusCaches, removedInfoCaches);
        }
    }

    // Cache record classes
    private record CachedDeviceStatus(DeviceStatus status, Instant timestamp) {
        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plus(CACHE_TTL));
        }
    }

    private record CachedDeviceInfo(DeviceInfo deviceInfo, Instant timestamp, Duration ttl) {
        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plus(ttl));
        }
    }
}