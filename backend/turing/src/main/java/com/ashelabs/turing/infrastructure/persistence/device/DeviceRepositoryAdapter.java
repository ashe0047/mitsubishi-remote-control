package com.ashelabs.turing.infrastructure.persistence.device;

import com.ashelabs.turing.domain.device.Device;
import com.ashelabs.turing.domain.device.DeviceRepository;
import com.ashelabs.turing.domain.device.DeviceType;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Adapter implementation of DeviceRepository.
 * Bridges domain layer with R2DBC infrastructure.
 * Follows hexagonal architecture pattern.
 */
@Repository
public class DeviceRepositoryAdapter implements DeviceRepository {

    private final R2dbcDeviceRepository r2dbcRepository;
    private final DeviceMapper mapper;

    public DeviceRepositoryAdapter(R2dbcDeviceRepository r2dbcRepository, DeviceMapper mapper) {
        this.r2dbcRepository = r2dbcRepository;
        this.mapper = mapper;
    }

    @Override
    public Mono<Device> save(Device device) {
        return Mono.just(device)
            .map(mapper::toEntity)
            .flatMap(r2dbcRepository::save)
            .map(mapper::toDomain);
    }

    @Override
    public Mono<Device> findById(UUID id) {
        return r2dbcRepository.findById(id)
            .map(mapper::toDomain);
    }

    @Override
    public Mono<Device> findByDeviceIdentifier(String deviceIdentifier) {
        return r2dbcRepository.findByDeviceIdentifier(deviceIdentifier)
            .map(mapper::toDomain);
    }

    @Override
    public Flux<Device> findByRoomId(UUID roomId) {
        return r2dbcRepository.findByRoomId(roomId)
            .map(mapper::toDomain);
    }

    @Override
    public Flux<Device> findByDeviceType(DeviceType deviceType) {
        return r2dbcRepository.findByDeviceType(deviceType.getCode())
            .map(mapper::toDomain);
    }

    @Override
    public Flux<Device> findEnabledByRoomId(UUID roomId) {
        return r2dbcRepository.findEnabledByRoomId(roomId)
            .map(mapper::toDomain);
    }

    @Override
    public Mono<Boolean> existsByRoomIdAndDeviceIdentifier(UUID roomId, String deviceIdentifier) {
        return r2dbcRepository.existsByRoomIdAndDeviceIdentifier(roomId, deviceIdentifier);
    }

    @Override
    public Mono<Void> deleteById(UUID id) {
        return r2dbcRepository.deleteById(id);
    }

    @Override
    public Flux<Device> findAll() {
        return r2dbcRepository.findAll()
            .map(mapper::toDomain);
    }
}
