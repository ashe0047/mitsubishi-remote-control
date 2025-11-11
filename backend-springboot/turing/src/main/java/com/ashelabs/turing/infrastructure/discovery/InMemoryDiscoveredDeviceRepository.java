package com.ashelabs.turing.infrastructure.discovery;

import com.ashelabs.turing.domain.device.discovery.DiscoveredDevice;
import com.ashelabs.turing.domain.device.discovery.DiscoveredDeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * In-memory implementation of {@link DiscoveredDeviceRepository} backed by a concurrent map.
 * Implements simple TTL eviction to prevent unbounded growth while keeping the abstraction pluggable.
 */
@Component
public class InMemoryDiscoveredDeviceRepository implements DiscoveredDeviceRepository {

    private static final Logger logger = LoggerFactory.getLogger(InMemoryDiscoveredDeviceRepository.class);

    private final ConcurrentMap<String, StoredDiscovery> storage = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    public InMemoryDiscoveredDeviceRepository(
        @Value("${device.discovery.ttl-seconds:600}") long ttlSeconds
    ) {
        if (ttlSeconds <= 0) {
            throw new IllegalArgumentException("device.discovery.ttl-seconds must be greater than zero");
        }
        this.ttl = Duration.ofSeconds(ttlSeconds);
        this.clock = Clock.systemUTC();
    }

    @Override
    public Mono<DiscoveredDevice> save(DiscoveredDevice device) {
        Objects.requireNonNull(device, "device must not be null");
        purgeExpired();

        Instant now = clock.instant();
        storage.compute(device.deviceIdentifier(), (key, existing) ->
            new StoredDiscovery(device, now.plus(ttl))
        );

        logger.debug("Stored discovered device {} with TTL {}s", device.deviceIdentifier(), ttl.getSeconds());
        return Mono.just(device);
    }

    @Override
    public Mono<DiscoveredDevice> findByDeviceIdentifier(String deviceIdentifier) {
        purgeExpired();
        return Mono.justOrEmpty(storage.get(deviceIdentifier)).map(StoredDiscovery::device);
    }

    @Override
    public Flux<DiscoveredDevice> findAll() {
        purgeExpired();
        return Flux.fromIterable(storage.values()).map(StoredDiscovery::device);
    }

    @Override
    public Flux<DiscoveredDevice> findByRoomId(UUID roomId) {
        purgeExpired();
        return Flux.fromStream(storage.values().stream()
            .map(StoredDiscovery::device)
            .filter(device -> roomId.equals(device.roomId())));
    }

    @Override
    public Mono<Void> deleteByDeviceIdentifier(String deviceIdentifier) {
        storage.remove(deviceIdentifier);
        return Mono.empty();
    }

    @Override
    public Mono<Void> deleteAll() {
        storage.clear();
        return Mono.empty();
    }

    private void purgeExpired() {
        Instant now = clock.instant();
        storage.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }

    private record StoredDiscovery(DiscoveredDevice device, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return expiresAt.isBefore(now);
        }
    }
}
