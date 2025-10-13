# Device-Room Integration: Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation plan for integrating protocol-agnostic device identifiers with the room management system. The implementation follows the hexagonal architecture and SOLID principles outlined in the design document.

## Prerequisites

- PostgreSQL 14+ with JSONB support
- Spring Boot 3.5.5 with WebFlux and R2DBC
- Maven 3.9+
- Java 21
- MQTT broker (mitsubishi2mqtt) running and accessible

## Implementation Phases

### Phase 1: Database Schema and Migrations

**Estimated Time**: 2-3 hours

#### Tasks

1. **Create Database Migration Script** (`V1__create_devices_table.sql`)
   ```sql
   -- Create devices table
   CREATE TABLE devices (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
       device_type VARCHAR(50) NOT NULL,
       device_identifier VARCHAR(255) NOT NULL,
       manufacturer VARCHAR(100),
       model VARCHAR(100),
       enabled BOOLEAN DEFAULT true,
       metadata JSONB DEFAULT '{}'::jsonb,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

       -- Constraints
       CONSTRAINT devices_identifier_format CHECK (device_identifier ~ '^[a-z0-9_-]+$'),
       CONSTRAINT devices_unique_room_type_identifier UNIQUE(room_id, device_type, device_identifier)
   );

   -- Indexes for performance
   CREATE INDEX idx_devices_room_id ON devices(room_id);
   CREATE INDEX idx_devices_device_type ON devices(device_type);
   CREATE INDEX idx_devices_device_identifier ON devices(device_identifier);
   CREATE INDEX idx_devices_enabled ON devices(enabled);
   CREATE INDEX idx_devices_metadata_gin ON devices USING gin(metadata);

   -- Trigger for updated_at
   CREATE OR REPLACE FUNCTION update_devices_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
       NEW.updated_at = CURRENT_TIMESTAMP;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER devices_updated_at_trigger
       BEFORE UPDATE ON devices
       FOR EACH ROW
       EXECUTE FUNCTION update_devices_updated_at();

   -- Comments for documentation
   COMMENT ON TABLE devices IS 'Protocol-agnostic device registry for room-based device management';
   COMMENT ON COLUMN devices.device_identifier IS 'Protocol-agnostic identifier (e.g., ac_bedroom_main)';
   COMMENT ON COLUMN devices.metadata IS 'Flexible JSONB storage for protocol-specific configuration';
   ```

2. **Configure Flyway Migration** (if not already configured)
   - Location: `src/main/resources/db/migration/`
   - File: `V1__create_devices_table.sql`
   - Verify migration in `application.properties`:
     ```properties
     spring.flyway.enabled=true
     spring.flyway.locations=classpath:db/migration
     spring.flyway.baseline-on-migrate=true
     ```

3. **Test Migration**
   ```bash
   ./mvnw flyway:migrate
   ./mvnw flyway:info  # Verify migration status
   ```

**Acceptance Criteria**:
- [ ] Migration script created and runs successfully
- [ ] All indexes and constraints created
- [ ] Triggers for `updated_at` working
- [ ] Can insert sample device records without errors
- [ ] Foreign key constraints enforce referential integrity

---

### Phase 2: Domain Models and Value Objects

**Estimated Time**: 3-4 hours

#### Tasks

1. **Create DeviceType Enum**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/DeviceType.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device;

   public enum DeviceType {
       AIRCONDITIONER("airconditioner", "Air Conditioner"),
       THERMOSTAT("thermostat", "Thermostat"),
       HUMIDIFIER("humidifier", "Humidifier"),
       FAN("fan", "Fan");

       private final String code;
       private final String displayName;

       DeviceType(String code, String displayName) {
           this.code = code;
           this.displayName = displayName;
       }

       public String getCode() {
           return code;
       }

       public String getDisplayName() {
           return displayName;
       }

       public static DeviceType fromCode(String code) {
           for (DeviceType type : values()) {
               if (type.code.equalsIgnoreCase(code)) {
                   return type;
               }
           }
           throw new IllegalArgumentException("Unknown device type: " + code);
       }
   }
   ```

2. **Create DeviceIdentifier Value Object**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/DeviceIdentifier.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device;

   import java.util.regex.Pattern;

   /**
    * Value object representing a protocol-agnostic device identifier.
    * Format: lowercase alphanumeric with hyphens and underscores only.
    * Example: "ac_bedroom_main", "thermostat-living-01"
    */
   public record DeviceIdentifier(String value) {

       private static final Pattern VALID_PATTERN = Pattern.compile("^[a-z0-9_-]+$");
       private static final int MAX_LENGTH = 255;

       public DeviceIdentifier {
           if (value == null || value.isBlank()) {
               throw new IllegalArgumentException("Device identifier cannot be null or blank");
           }
           if (value.length() > MAX_LENGTH) {
               throw new IllegalArgumentException(
                   String.format("Device identifier exceeds maximum length of %d characters", MAX_LENGTH)
               );
           }
           if (!VALID_PATTERN.matcher(value).matches()) {
               throw new IllegalArgumentException(
                   "Device identifier must be lowercase alphanumeric with hyphens or underscores only. Got: " + value
               );
           }
       }

       @Override
       public String toString() {
           return value;
       }
   }
   ```

3. **Create Device Domain Entity**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/Device.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device;

   import java.sql.Timestamp;
   import java.time.Instant;
   import java.util.HashMap;
   import java.util.Map;
   import java.util.UUID;

   /**
    * Device domain entity representing a protocol-agnostic device in a room.
    * Immutable record with factory methods for creation and updates.
    */
   public record Device(
       UUID id,
       UUID roomId,
       DeviceType deviceType,
       DeviceIdentifier deviceIdentifier,
       String manufacturer,
       String model,
       boolean enabled,
       Map<String, Object> metadata,
       Timestamp createdAt,
       Timestamp updatedAt
   ) {

       /**
        * Create a new device with minimal required fields.
        */
       public static Device create(UUID roomId, DeviceType deviceType, String identifier) {
           return new Device(
               UUID.randomUUID(),
               roomId,
               deviceType,
               new DeviceIdentifier(identifier),  // Validates format
               null,
               null,
               true,
               new HashMap<>(),
               Timestamp.from(Instant.now()),
               Timestamp.from(Instant.now())
           );
       }

       /**
        * Create a new device with full details.
        */
       public static Device create(
           UUID roomId,
           DeviceType deviceType,
           String identifier,
           String manufacturer,
           String model,
           Map<String, Object> metadata
       ) {
           return new Device(
               UUID.randomUUID(),
               roomId,
               deviceType,
               new DeviceIdentifier(identifier),
               manufacturer,
               model,
               true,
               metadata != null ? new HashMap<>(metadata) : new HashMap<>(),
               Timestamp.from(Instant.now()),
               Timestamp.from(Instant.now())
           );
       }

       /**
        * Update device metadata.
        */
       public Device withMetadata(Map<String, Object> newMetadata) {
           return new Device(
               id, roomId, deviceType, deviceIdentifier, manufacturer, model, enabled,
               new HashMap<>(newMetadata),
               createdAt, Timestamp.from(Instant.now())
           );
       }

       /**
        * Enable or disable the device.
        */
       public Device withEnabled(boolean newEnabled) {
           return new Device(
               id, roomId, deviceType, deviceIdentifier, manufacturer, model, newEnabled,
               metadata, createdAt, Timestamp.from(Instant.now())
           );
       }

       /**
        * Update manufacturer and model information.
        */
       public Device withManufacturerAndModel(String newManufacturer, String newModel) {
           return new Device(
               id, roomId, deviceType, deviceIdentifier, newManufacturer, newModel, enabled,
               metadata, createdAt, Timestamp.from(Instant.now())
           );
       }
   }
   ```

**Acceptance Criteria**:
- [ ] DeviceType enum created with all relevant device types
- [ ] DeviceIdentifier validates format correctly (lowercase, alphanumeric, hyphens/underscores)
- [ ] Device entity created with factory methods
- [ ] Immutability enforced through record pattern
- [ ] Unit tests for value object validation pass

---

### Phase 3: Repository Layer (Port Implementation)

**Estimated Time**: 4-5 hours

#### Tasks

1. **Create DeviceRepository Interface (Port)**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/DeviceRepository.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device;

   import reactor.core.publisher.Flux;
   import reactor.core.publisher.Mono;

   import java.util.UUID;

   /**
    * Repository port for device persistence.
    * Domain-level abstraction, no R2DBC coupling.
    */
   public interface DeviceRepository {

       Mono<Device> save(Device device);

       Mono<Device> findById(UUID id);

       Mono<Device> findByDeviceIdentifier(String deviceIdentifier);

       Flux<Device> findByRoomId(UUID roomId);

       Flux<Device> findByDeviceType(DeviceType deviceType);

       Flux<Device> findEnabledByRoomId(UUID roomId);

       Mono<Boolean> existsByRoomIdAndDeviceIdentifier(UUID roomId, String deviceIdentifier);

       Mono<Void> deleteById(UUID id);

       Flux<Device> findAll();
   }
   ```

2. **Create R2DBC Device Entity Mapping**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/persistence/device/DeviceEntity.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.persistence.device;

   import org.springframework.data.annotation.Id;
   import org.springframework.data.relational.core.mapping.Column;
   import org.springframework.data.relational.core.mapping.Table;
   import io.r2dbc.postgresql.codec.Json;

   import java.sql.Timestamp;
   import java.util.UUID;

   @Table("devices")
   public record DeviceEntity(
       @Id
       UUID id,

       @Column("room_id")
       UUID roomId,

       @Column("device_type")
       String deviceType,

       @Column("device_identifier")
       String deviceIdentifier,

       String manufacturer,

       String model,

       Boolean enabled,

       @Column("metadata")
       Json metadata,  // R2DBC PostgreSQL JSONB support

       @Column("created_at")
       Timestamp createdAt,

       @Column("updated_at")
       Timestamp updatedAt
   ) {
   }
   ```

3. **Create Spring Data R2DBC Repository**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/persistence/device/R2dbcDeviceRepository.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.persistence.device;

   import org.springframework.data.r2dbc.repository.R2dbcRepository;
   import org.springframework.data.r2dbc.repository.Query;
   import reactor.core.publisher.Flux;
   import reactor.core.publisher.Mono;

   import java.util.UUID;

   public interface R2dbcDeviceRepository extends R2dbcRepository<DeviceEntity, UUID> {

       Mono<DeviceEntity> findByDeviceIdentifier(String deviceIdentifier);

       Flux<DeviceEntity> findByRoomId(UUID roomId);

       Flux<DeviceEntity> findByDeviceType(String deviceType);

       @Query("SELECT * FROM devices WHERE room_id = :roomId AND enabled = true")
       Flux<DeviceEntity> findEnabledByRoomId(UUID roomId);

       Mono<Boolean> existsByRoomIdAndDeviceIdentifier(UUID roomId, String deviceIdentifier);
   }
   ```

4. **Create DeviceMapper for Entity ↔ Domain Conversion**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/persistence/device/DeviceMapper.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.persistence.device;

   import com.ashelabs.turing.domain.device.Device;
   import com.ashelabs.turing.domain.device.DeviceIdentifier;
   import com.ashelabs.turing.domain.device.DeviceType;
   import com.fasterxml.jackson.core.type.TypeReference;
   import com.fasterxml.jackson.databind.ObjectMapper;
   import io.r2dbc.postgresql.codec.Json;
   import org.springframework.stereotype.Component;

   import java.util.HashMap;
   import java.util.Map;

   @Component
   public class DeviceMapper {

       private final ObjectMapper objectMapper;

       public DeviceMapper(ObjectMapper objectMapper) {
           this.objectMapper = objectMapper;
       }

       public Device toDomain(DeviceEntity entity) {
           Map<String, Object> metadata = parseMetadata(entity.metadata());

           return new Device(
               entity.id(),
               entity.roomId(),
               DeviceType.fromCode(entity.deviceType()),
               new DeviceIdentifier(entity.deviceIdentifier()),
               entity.manufacturer(),
               entity.model(),
               entity.enabled() != null ? entity.enabled() : true,
               metadata,
               entity.createdAt(),
               entity.updatedAt()
           );
       }

       public DeviceEntity toEntity(Device domain) {
           Json metadataJson = serializeMetadata(domain.metadata());

           return new DeviceEntity(
               domain.id(),
               domain.roomId(),
               domain.deviceType().getCode(),
               domain.deviceIdentifier().value(),
               domain.manufacturer(),
               domain.model(),
               domain.enabled(),
               metadataJson,
               domain.createdAt(),
               domain.updatedAt()
           );
       }

       private Map<String, Object> parseMetadata(Json json) {
           if (json == null) {
               return new HashMap<>();
           }
           try {
               return objectMapper.readValue(
                   json.asString(),
                   new TypeReference<Map<String, Object>>() {}
               );
           } catch (Exception e) {
               return new HashMap<>();
           }
       }

       private Json serializeMetadata(Map<String, Object> metadata) {
           try {
               String json = objectMapper.writeValueAsString(metadata);
               return Json.of(json);
           } catch (Exception e) {
               return Json.of("{}");
           }
       }
   }
   ```

5. **Create DeviceRepositoryAdapter (Adapter Implementation)**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/persistence/device/DeviceRepositoryAdapter.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.persistence.device;

   import com.ashelabs.turing.domain.device.Device;
   import com.ashelabs.turing.domain.device.DeviceRepository;
   import com.ashelabs.turing.domain.device.DeviceType;
   import org.springframework.stereotype.Repository;
   import reactor.core.publisher.Flux;
   import reactor.core.publisher.Mono;

   import java.util.UUID;

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
   ```

**Acceptance Criteria**:
- [ ] DeviceRepository port interface created
- [ ] R2DBC entity mapping with JSONB support
- [ ] DeviceMapper converts between domain and entity correctly
- [ ] DeviceRepositoryAdapter implements all repository methods
- [ ] Repository integration tests pass with test database

---

### Phase 4: Protocol Publisher Layer (Strategy Pattern)

**Estimated Time**: 5-6 hours

#### Tasks

1. **Create ProtocolPublisher Interface**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/protocol/ProtocolPublisher.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device.protocol;

   import reactor.core.publisher.Mono;

   /**
    * Strategy interface for protocol-specific device command publishing.
    * Implementations provide protocol-specific logic (MQTT, HTTP, WebSocket, etc.)
    */
   public interface ProtocolPublisher {

       /**
        * Set target temperature for a device.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param temperature Target temperature in Celsius
        */
       Mono<Void> setTemperature(String deviceIdentifier, int temperature);

       /**
        * Set operating mode for a device.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param mode Operating mode (e.g., "heat", "cool", "auto")
        */
       Mono<Void> setMode(String deviceIdentifier, String mode);

       /**
        * Set fan speed for a device.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param fanSpeed Fan speed setting (e.g., "low", "medium", "high", "auto")
        */
       Mono<Void> setFanSpeed(String deviceIdentifier, String fanSpeed);

       /**
        * Set power state for a device.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param on Power state (true = on, false = off)
        */
       Mono<Void> setPower(String deviceIdentifier, boolean on);

       /**
        * Set vertical vane position.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param position Vane position (e.g., "auto", "swing", "1" to "5")
        */
       Mono<Void> setVanePosition(String deviceIdentifier, String position);

       /**
        * Set horizontal wide vane position.
        * @param deviceIdentifier Protocol-agnostic device identifier
        * @param position Wide vane position (e.g., "auto", "swing", "<<", ">>")
        */
       Mono<Void> setWideVanePosition(String deviceIdentifier, String position);

       /**
        * Get the protocol name for logging and debugging.
        */
       String getProtocolName();
   }
   ```

2. **Create MqttProtocolPublisher Implementation**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/protocol/mqtt/MqttProtocolPublisher.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.protocol.mqtt;

   import com.ashelabs.turing.domain.device.protocol.ProtocolPublisher;
   import org.eclipse.paho.client.mqttv3.MqttClient;
   import org.eclipse.paho.client.mqttv3.MqttException;
   import org.eclipse.paho.client.mqttv3.MqttMessage;
   import org.slf4j.Logger;
   import org.slf4j.LoggerFactory;
   import org.springframework.beans.factory.annotation.Value;
   import org.springframework.stereotype.Service;
   import reactor.core.publisher.Mono;

   /**
    * MQTT protocol publisher for mitsubishi2mqtt integration.
    * Topic pattern: mitsubishi2mqtt/{deviceIdentifier}/{command}/set
    */
   @Service("mqttProtocolPublisher")
   public class MqttProtocolPublisher implements ProtocolPublisher {

       private static final Logger logger = LoggerFactory.getLogger(MqttProtocolPublisher.class);
       private static final String TOPIC_PATTERN = "mitsubishi2mqtt/%s/%s/set";

       private final MqttClient mqttClient;

       public MqttProtocolPublisher(
           @Value("${mqtt.broker.url}") String brokerUrl,
           @Value("${mqtt.client.id}") String clientId
       ) throws MqttException {
           this.mqttClient = new MqttClient(brokerUrl, clientId);
           this.mqttClient.connect();
           logger.info("MQTT Protocol Publisher connected to broker: {}", brokerUrl);
       }

       @Override
       public Mono<Void> setTemperature(String deviceIdentifier, int temperature) {
           return publishCommand(deviceIdentifier, "temp", String.valueOf(temperature));
       }

       @Override
       public Mono<Void> setMode(String deviceIdentifier, String mode) {
           return publishCommand(deviceIdentifier, "mode", mode);
       }

       @Override
       public Mono<Void> setFanSpeed(String deviceIdentifier, String fanSpeed) {
           return publishCommand(deviceIdentifier, "fan", fanSpeed);
       }

       @Override
       public Mono<Void> setPower(String deviceIdentifier, boolean on) {
           return publishCommand(deviceIdentifier, "power", on ? "ON" : "OFF");
       }

       @Override
       public Mono<Void> setVanePosition(String deviceIdentifier, String position) {
           return publishCommand(deviceIdentifier, "vane", position);
       }

       @Override
       public Mono<Void> setWideVanePosition(String deviceIdentifier, String position) {
           return publishCommand(deviceIdentifier, "wideVane", position);
       }

       @Override
       public String getProtocolName() {
           return "MQTT";
       }

       private Mono<Void> publishCommand(String deviceIdentifier, String command, String payload) {
           return Mono.fromCallable(() -> {
               String topic = String.format(TOPIC_PATTERN, deviceIdentifier, command);
               MqttMessage message = new MqttMessage(payload.getBytes());
               message.setQos(1); // At least once delivery
               message.setRetained(false);

               mqttClient.publish(topic, message);
               logger.debug("Published MQTT command: topic={}, payload={}", topic, payload);

               return null;
           }).then();
       }
   }
   ```

3. **Create HttpProtocolPublisher Implementation (Future-Proofing)**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/protocol/http/HttpProtocolPublisher.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.protocol.http;

   import com.ashelabs.turing.domain.device.protocol.ProtocolPublisher;
   import org.slf4j.Logger;
   import org.slf4j.LoggerFactory;
   import org.springframework.stereotype.Service;
   import org.springframework.web.reactive.function.client.WebClient;
   import reactor.core.publisher.Mono;

   /**
    * HTTP protocol publisher for RESTful device control APIs.
    * Demonstrates protocol abstraction - not currently used but ready for future integration.
    */
   @Service("httpProtocolPublisher")
   public class HttpProtocolPublisher implements ProtocolPublisher {

       private static final Logger logger = LoggerFactory.getLogger(HttpProtocolPublisher.class);

       private final WebClient webClient;

       public HttpProtocolPublisher(WebClient.Builder webClientBuilder) {
           this.webClient = webClientBuilder
               .baseUrl("http://device-api.example.com")
               .build();
       }

       @Override
       public Mono<Void> setTemperature(String deviceIdentifier, int temperature) {
           return webClient.post()
               .uri("/devices/{id}/temperature", deviceIdentifier)
               .bodyValue(temperature)
               .retrieve()
               .bodyToMono(Void.class)
               .doOnSuccess(v -> logger.debug("HTTP: Set temperature {} for {}", temperature, deviceIdentifier));
       }

       @Override
       public Mono<Void> setMode(String deviceIdentifier, String mode) {
           return webClient.post()
               .uri("/devices/{id}/mode", deviceIdentifier)
               .bodyValue(mode)
               .retrieve()
               .bodyToMono(Void.class);
       }

       @Override
       public Mono<Void> setFanSpeed(String deviceIdentifier, String fanSpeed) {
           return webClient.post()
               .uri("/devices/{id}/fan", deviceIdentifier)
               .bodyValue(fanSpeed)
               .retrieve()
               .bodyToMono(Void.class);
       }

       @Override
       public Mono<Void> setPower(String deviceIdentifier, boolean on) {
           return webClient.post()
               .uri("/devices/{id}/power", deviceIdentifier)
               .bodyValue(on)
               .retrieve()
               .bodyToMono(Void.class);
       }

       @Override
       public Mono<Void> setVanePosition(String deviceIdentifier, String position) {
           return webClient.post()
               .uri("/devices/{id}/vane", deviceIdentifier)
               .bodyValue(position)
               .retrieve()
               .bodyToMono(Void.class);
       }

       @Override
       public Mono<Void> setWideVanePosition(String deviceIdentifier, String position) {
           return webClient.post()
               .uri("/devices/{id}/wide-vane", deviceIdentifier)
               .bodyValue(position)
               .retrieve()
               .bodyToMono(Void.class);
       }

       @Override
       public String getProtocolName() {
           return "HTTP";
       }
   }
   ```

4. **Create ProtocolPublisherFactory**
   - **File**: `src/main/java/com/ashelabs/turing/domain/device/protocol/ProtocolPublisherFactory.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.domain.device.protocol;

   import org.springframework.stereotype.Component;

   import java.util.Map;

   /**
    * Factory for resolving protocol publishers by protocol name.
    */
   @Component
   public class ProtocolPublisherFactory {

       private final Map<String, ProtocolPublisher> publishers;

       public ProtocolPublisherFactory(Map<String, ProtocolPublisher> publishers) {
           this.publishers = publishers;
       }

       /**
        * Get protocol publisher by bean name.
        * @param protocolName Bean name (e.g., "mqttProtocolPublisher", "httpProtocolPublisher")
        */
       public ProtocolPublisher getPublisher(String protocolName) {
           ProtocolPublisher publisher = publishers.get(protocolName);
           if (publisher == null) {
               throw new IllegalArgumentException("No protocol publisher found for: " + protocolName);
           }
           return publisher;
       }

       /**
        * Get default protocol publisher (MQTT).
        */
       public ProtocolPublisher getDefaultPublisher() {
           return getPublisher("mqttProtocolPublisher");
       }
   }
   ```

**Acceptance Criteria**:
- [ ] ProtocolPublisher interface created with all command methods
- [ ] MqttProtocolPublisher implemented and tested with mitsubishi2mqtt
- [ ] HttpProtocolPublisher implemented as example alternative
- [ ] ProtocolPublisherFactory resolves publishers correctly
- [ ] MQTT commands publish to correct topics with correct payloads

---

### Phase 5: Application Services (Use Cases)

**Estimated Time**: 4-5 hours

#### Tasks

1. **Create DeviceService**
   - **File**: `src/main/java/com/ashelabs/turing/application/device/DeviceService.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.application.device;

   import com.ashelabs.turing.domain.device.Device;
   import com.ashelabs.turing.domain.device.DeviceRepository;
   import com.ashelabs.turing.domain.device.DeviceType;
   import com.ashelabs.turing.domain.device.protocol.ProtocolPublisher;
   import com.ashelabs.turing.domain.device.protocol.ProtocolPublisherFactory;
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
    */
   @Service
   public class DeviceService {

       private static final Logger logger = LoggerFactory.getLogger(DeviceService.class);

       private final DeviceRepository deviceRepository;
       private final ProtocolPublisherFactory publisherFactory;

       public DeviceService(DeviceRepository deviceRepository, ProtocolPublisherFactory publisherFactory) {
           this.deviceRepository = deviceRepository;
           this.publisherFactory = publisherFactory;
       }

       /**
        * Register a new device in a room.
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
                       return Mono.error(new IllegalArgumentException(
                           "Device already exists: " + deviceIdentifier
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
        * Delete a device.
        */
       public Mono<Void> deleteDevice(UUID deviceId) {
           return deviceRepository.deleteById(deviceId)
               .doOnSuccess(v -> logger.info("Deleted device: {}", deviceId));
       }
   }
   ```

**Acceptance Criteria**:
- [ ] DeviceService implements all use cases
- [ ] Commands validate device enabled status before publishing
- [ ] Proper error handling for disabled devices
- [ ] Logging for all operations
- [ ] Integration tests with mocked repository and publisher

---

### Phase 6: REST API Controllers

**Estimated Time**: 3-4 hours

#### Tasks

1. **Create Device DTOs**
   - **File**: `src/main/java/com/ashelabs/turing/api/device/dto/DeviceDto.java`
   ```java
   package com.ashelabs.turing.api.device.dto;

   import com.ashelabs.turing.domain.device.Device;
   import com.fasterxml.jackson.annotation.JsonProperty;

   import java.sql.Timestamp;
   import java.util.Map;
   import java.util.UUID;

   public record DeviceDto(
       UUID id,
       @JsonProperty("room_id") UUID roomId,
       @JsonProperty("device_type") String deviceType,
       @JsonProperty("device_identifier") String deviceIdentifier,
       String manufacturer,
       String model,
       Boolean enabled,
       Map<String, Object> metadata,
       @JsonProperty("created_at") Timestamp createdAt,
       @JsonProperty("updated_at") Timestamp updatedAt
   ) {
       public static DeviceDto from(Device device) {
           return new DeviceDto(
               device.id(),
               device.roomId(),
               device.deviceType().getCode(),
               device.deviceIdentifier().value(),
               device.manufacturer(),
               device.model(),
               device.enabled(),
               device.metadata(),
               device.createdAt(),
               device.updatedAt()
           );
       }
   }
   ```

   - **File**: `src/main/java/com/ashelabs/turing/api/device/dto/RegisterDeviceRequest.java`
   ```java
   package com.ashelabs.turing.api.device.dto;

   import com.fasterxml.jackson.annotation.JsonProperty;
   import jakarta.validation.constraints.NotBlank;
   import jakarta.validation.constraints.NotNull;
   import jakarta.validation.constraints.Pattern;

   import java.util.Map;
   import java.util.UUID;

   public record RegisterDeviceRequest(
       @NotNull
       @JsonProperty("room_id")
       UUID roomId,

       @NotBlank
       @JsonProperty("device_type")
       String deviceType,

       @NotBlank
       @Pattern(regexp = "^[a-z0-9_-]+$", message = "Device identifier must be lowercase alphanumeric with - or _")
       @JsonProperty("device_identifier")
       String deviceIdentifier,

       String manufacturer,
       String model,
       Map<String, Object> metadata
   ) {}
   ```

   - **File**: `src/main/java/com/ashelabs/turing/api/device/dto/DeviceCommandRequest.java`
   ```java
   package com.ashelabs.turing.api.device.dto;

   import com.fasterxml.jackson.annotation.JsonProperty;
   import jakarta.validation.constraints.NotBlank;

   public record DeviceCommandRequest(
       @NotBlank
       @JsonProperty("device_identifier")
       String deviceIdentifier,

       @JsonProperty("temperature")
       Integer temperature,

       @JsonProperty("mode")
       String mode,

       @JsonProperty("fan_speed")
       String fanSpeed,

       @JsonProperty("power")
       Boolean power
   ) {}
   ```

2. **Create DeviceController**
   - **File**: `src/main/java/com/ashelabs/turing/api/device/DeviceController.java`
   ```java
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

   @RestController
   @RequestMapping("/api/devices")
   public class DeviceController {

       private final DeviceService deviceService;

       public DeviceController(DeviceService deviceService) {
           this.deviceService = deviceService;
       }

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

       @GetMapping("/room/{roomId}")
       public Flux<DeviceDto> getDevicesByRoom(@PathVariable UUID roomId) {
           return deviceService.getDevicesByRoom(roomId)
               .map(DeviceDto::from);
       }

       @GetMapping("/room/{roomId}/enabled")
       public Flux<DeviceDto> getEnabledDevicesByRoom(@PathVariable UUID roomId) {
           return deviceService.getEnabledDevicesByRoom(roomId)
               .map(DeviceDto::from);
       }

       @GetMapping("/{deviceIdentifier}")
       public Mono<DeviceDto> getDeviceByIdentifier(@PathVariable String deviceIdentifier) {
           return deviceService.getDeviceByIdentifier(deviceIdentifier)
               .map(DeviceDto::from);
       }

       @PatchMapping("/{deviceId}/metadata")
       public Mono<DeviceDto> updateMetadata(
           @PathVariable UUID deviceId,
           @RequestBody Map<String, Object> metadata
       ) {
           return deviceService.updateDeviceMetadata(deviceId, metadata)
               .map(DeviceDto::from);
       }

       @PatchMapping("/{deviceId}/enabled")
       public Mono<DeviceDto> setEnabled(
           @PathVariable UUID deviceId,
           @RequestParam boolean enabled
       ) {
           return deviceService.setDeviceEnabled(deviceId, enabled)
               .map(DeviceDto::from);
       }

       @PostMapping("/command/temperature")
       public Mono<Void> setTemperature(@Valid @RequestBody DeviceCommandRequest request) {
           if (request.temperature() == null) {
               return Mono.error(new IllegalArgumentException("Temperature is required"));
           }
           return deviceService.setDeviceTemperature(request.deviceIdentifier(), request.temperature());
       }

       @PostMapping("/command/mode")
       public Mono<Void> setMode(@Valid @RequestBody DeviceCommandRequest request) {
           if (request.mode() == null) {
               return Mono.error(new IllegalArgumentException("Mode is required"));
           }
           return deviceService.setDeviceMode(request.deviceIdentifier(), request.mode());
       }

       @PostMapping("/command/fan")
       public Mono<Void> setFanSpeed(@Valid @RequestBody DeviceCommandRequest request) {
           if (request.fanSpeed() == null) {
               return Mono.error(new IllegalArgumentException("Fan speed is required"));
           }
           return deviceService.setDeviceFanSpeed(request.deviceIdentifier(), request.fanSpeed());
       }

       @PostMapping("/command/power")
       public Mono<Void> setPower(@Valid @RequestBody DeviceCommandRequest request) {
           if (request.power() == null) {
               return Mono.error(new IllegalArgumentException("Power state is required"));
           }
           return deviceService.setDevicePower(request.deviceIdentifier(), request.power());
       }

       @DeleteMapping("/{deviceId}")
       @ResponseStatus(HttpStatus.NO_CONTENT)
       public Mono<Void> deleteDevice(@PathVariable UUID deviceId) {
           return deviceService.deleteDevice(deviceId);
       }
   }
   ```

**Acceptance Criteria**:
- [ ] All DTOs created with validation annotations
- [ ] DeviceController implements all REST endpoints
- [ ] Proper HTTP status codes returned
- [ ] Request validation working correctly
- [ ] API integration tests pass

---

### Phase 7: Integration with Existing AirConditioner WebSocket Handler

**Estimated Time**: 3-4 hours

#### Tasks

1. **Update AirConditionerWebSocketHandler to Use DeviceService**
   - **File**: `src/main/java/com/ashelabs/turing/websocket/airconditioner/AirConditionerWebSocketHandler.java`
   - **Changes**:
   ```java
   // Add DeviceService dependency
   private final DeviceService deviceService;

   // In handleCommand() method, resolve device identifier from roomId
   private Mono<Void> handleCommand(WebSocketCommand command, WebSocketSession session) {
       String roomId = extractRoomId(session);

       // Get device identifier from room
       return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
           .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
           .next()  // Get first enabled AC device
           .flatMap(device -> {
               String deviceIdentifier = device.deviceIdentifier().value();

               // Use deviceIdentifier instead of roomId for MQTT commands
               return switch (command.getAction()) {
                   case "SET_TEMPERATURE" ->
                       deviceService.setDeviceTemperature(deviceIdentifier, command.getTemperature());
                   case "SET_MODE" ->
                       deviceService.setDeviceMode(deviceIdentifier, command.getMode());
                   case "SET_FAN_SPEED" ->
                       deviceService.setDeviceFanSpeed(deviceIdentifier, command.getFanSpeed());
                   case "SET_POWER" ->
                       deviceService.setDevicePower(deviceIdentifier, command.getPower());
                   default -> Mono.error(new IllegalArgumentException("Unknown command: " + command.getAction()));
               };
           })
           .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
   }
   ```

2. **Create Device Auto-Registration on Room Creation**
   - **File**: `src/main/java/com/ashelabs/turing/application/room/RoomService.java`
   - **Changes**: Add device auto-registration when a room is created
   ```java
   public Mono<Room> createRoom(CreateRoomRequest request) {
       return roomRepository.save(Room.create(request.name(), request.familyId()))
           .flatMap(room -> {
               // Auto-register default AC device for room
               String deviceIdentifier = generateDefaultDeviceIdentifier(room);

               return deviceService.registerDevice(
                   room.id(),
                   DeviceType.AIRCONDITIONER,
                   deviceIdentifier,
                   "Mitsubishi",
                   "Unknown",
                   Map.of("auto_registered", true)
               ).thenReturn(room);
           });
   }

   private String generateDefaultDeviceIdentifier(Room room) {
       // Generate identifier: ac_{room_name_lowercase}
       String normalized = room.name().toLowerCase().replaceAll("[^a-z0-9]", "_");
       return "ac_" + normalized;
   }
   ```

**Acceptance Criteria**:
- [ ] AirConditionerWebSocketHandler uses DeviceService for command routing
- [ ] Device identifier lookup from roomId working correctly
- [ ] Auto-registration of devices on room creation
- [ ] WebSocket commands routed through protocol abstraction layer
- [ ] Integration tests verify end-to-end flow

---

### Phase 8: Testing

**Estimated Time**: 6-8 hours

#### Unit Tests

1. **DeviceIdentifier Value Object Tests**
   - **File**: `src/test/java/com/ashelabs/turing/domain/device/DeviceIdentifierTest.java`
   - Test valid formats
   - Test invalid formats (uppercase, spaces, special chars)
   - Test null/blank validation

2. **Device Entity Tests**
   - **File**: `src/test/java/com/ashelabs/turing/domain/device/DeviceTest.java`
   - Test factory methods
   - Test immutability
   - Test with* update methods

3. **DeviceMapper Tests**
   - **File**: `src/test/java/com/ashelabs/turing/infrastructure/persistence/device/DeviceMapperTest.java`
   - Test entity to domain conversion
   - Test domain to entity conversion
   - Test JSONB metadata serialization/deserialization

4. **DeviceService Tests**
   - **File**: `src/test/java/com/ashelabs/turing/application/device/DeviceServiceTest.java`
   - Mock DeviceRepository and ProtocolPublisherFactory
   - Test all service methods
   - Test validation and error cases

#### Integration Tests

5. **DeviceRepositoryAdapter Integration Tests**
   - **File**: `src/test/java/com/ashelabs/turing/infrastructure/persistence/device/DeviceRepositoryAdapterTest.java`
   - Use test database with Testcontainers
   - Test all repository methods
   - Test JSONB queries
   - Test unique constraints

6. **MqttProtocolPublisher Integration Tests**
   - **File**: `src/test/java/com/ashelabs/turing/infrastructure/protocol/mqtt/MqttProtocolPublisherTest.java`
   - Use embedded MQTT broker for testing
   - Verify topic patterns
   - Verify message payloads

7. **DeviceController Integration Tests**
   - **File**: `src/test/java/com/ashelabs/turing/api/device/DeviceControllerTest.java`
   - Use WebTestClient
   - Test all REST endpoints
   - Test validation errors
   - Test error responses

#### End-to-End Tests

8. **WebSocket to MQTT Flow Test**
   - **File**: `src/test/java/com/ashelabs/turing/e2e/DeviceControlE2ETest.java`
   - Test complete flow: WebSocket command → Device lookup → MQTT publish
   - Verify device identifier resolution
   - Verify MQTT message published to correct topic

**Acceptance Criteria**:
- [ ] All unit tests pass with >80% code coverage
- [ ] Integration tests pass with real database and MQTT broker
- [ ] End-to-end tests verify complete flow
- [ ] No test flakiness or race conditions

---

### Phase 9: Configuration and Documentation

**Estimated Time**: 2-3 hours

#### Tasks

1. **Update application.properties**
   ```properties
   # MQTT Configuration
   mqtt.broker.url=tcp://localhost:1883
   mqtt.client.id=turing-device-controller
   mqtt.username=
   mqtt.password=

   # R2DBC PostgreSQL Configuration
   spring.r2dbc.url=r2dbc:postgresql://localhost:5432/turing_db
   spring.r2dbc.username=turing_user
   spring.r2dbc.password=turing_pass

   # Flyway Migration
   spring.flyway.enabled=true
   spring.flyway.locations=classpath:db/migration
   ```

2. **Create API Documentation**
   - **File**: `/docs/api/device-api.md`
   - Document all REST endpoints
   - Include request/response examples
   - Document error codes

3. **Update CLAUDE.md**
   - Add device-room integration architecture section
   - Document device identifier format and validation rules
   - Add protocol abstraction explanation
   - Update testing strategy section

4. **Create Migration Guide**
   - **File**: `/docs/migration/device-integration-migration.md`
   - Steps for existing deployments
   - Database migration checklist
   - Rollback procedures

**Acceptance Criteria**:
- [ ] Configuration files updated and documented
- [ ] API documentation complete with examples
- [ ] CLAUDE.md updated with new architecture
- [ ] Migration guide created for production deployment

---

### Phase 10: Deployment and Verification

**Estimated Time**: 2-3 hours

#### Deployment Checklist

1. **Database Migration**
   - [ ] Backup production database
   - [ ] Run Flyway migration: `./mvnw flyway:migrate`
   - [ ] Verify migration: `./mvnw flyway:info`
   - [ ] Verify indexes created: `\d devices` in psql

2. **Application Deployment**
   - [ ] Build application: `./mvnw clean package`
   - [ ] Run integration tests: `./mvnw verify`
   - [ ] Deploy to staging environment
   - [ ] Verify MQTT connection in logs
   - [ ] Verify database connection in logs

3. **Verification Tests**
   - [ ] Register test device via REST API
   - [ ] Verify device appears in database
   - [ ] Send WebSocket command to test room
   - [ ] Verify MQTT message published to correct topic
   - [ ] Verify device identifier resolution working

4. **Monitoring Setup**
   - [ ] Configure application metrics
   - [ ] Set up alerts for MQTT connection failures
   - [ ] Set up alerts for database connection pool exhaustion
   - [ ] Configure logging for device commands

5. **Production Deployment**
   - [ ] Deploy to production
   - [ ] Monitor logs for errors
   - [ ] Verify existing functionality not broken
   - [ ] Verify new device endpoints accessible
   - [ ] Run smoke tests

**Rollback Plan**:
1. Revert application deployment
2. Run Flyway undo migration if needed: `./mvnw flyway:undo`
3. Restore database backup if migration cannot be undone
4. Verify application functionality restored

---

### Phase 11: MQTT Inbound Message Routing & Device Discovery

**Estimated Time**: 5-6 hours

This phase implements **bidirectional communication** - routing MQTT messages from devices back to the correct WebSocket clients, and **dynamic device discovery** for rooms.

#### Tasks

1. **Create MqttMessageSubscriber Service**
   - **File**: `src/main/java/com/ashelabs/turing/infrastructure/protocol/mqtt/MqttMessageSubscriber.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.infrastructure.protocol.mqtt;

   import com.ashelabs.turing.application.device.DeviceService;
   import com.ashelabs.turing.websocket.session.WebSocketSessionRegistry;
   import com.fasterxml.jackson.databind.ObjectMapper;
   import jakarta.annotation.PostConstruct;
   import jakarta.annotation.PreDestroy;
   import org.eclipse.paho.client.mqttv3.*;
   import org.slf4j.Logger;
   import org.slf4j.LoggerFactory;
   import org.springframework.beans.factory.annotation.Value;
   import org.springframework.stereotype.Service;
   import reactor.core.publisher.Mono;

   import java.util.Map;

   /**
    * Subscribes to MQTT topics and routes messages to WebSocket clients.
    * Handles device state updates and dynamic device discovery.
    */
   @Service
   public class MqttMessageSubscriber {

       private static final Logger logger = LoggerFactory.getLogger(MqttMessageSubscriber.class);

       // Topic patterns for device messages
       private static final String STATE_TOPIC_PATTERN = "mitsubishi2mqtt/+/state";
       private static final String SETTINGS_TOPIC_PATTERN = "mitsubishi2mqtt/+/settings";

       private final MqttClient mqttClient;
       private final DeviceService deviceService;
       private final WebSocketSessionRegistry sessionRegistry;
       private final ObjectMapper objectMapper;

       public MqttMessageSubscriber(
           @Value("${mqtt.broker.url}") String brokerUrl,
           @Value("${mqtt.subscriber.client.id}") String clientId,
           DeviceService deviceService,
           WebSocketSessionRegistry sessionRegistry,
           ObjectMapper objectMapper
       ) throws MqttException {
           this.mqttClient = new MqttClient(brokerUrl, clientId);
           this.deviceService = deviceService;
           this.sessionRegistry = sessionRegistry;
           this.objectMapper = objectMapper;
       }

       @PostConstruct
       public void start() throws MqttException {
           MqttConnectOptions options = new MqttConnectOptions();
           options.setAutomaticReconnect(true);
           options.setCleanSession(false);

           mqttClient.setCallback(new MqttCallback() {
               @Override
               public void connectionLost(Throwable cause) {
                   logger.error("MQTT connection lost", cause);
               }

               @Override
               public void messageArrived(String topic, MqttMessage message) {
                   handleIncomingMessage(topic, message);
               }

               @Override
               public void deliveryComplete(IMqttDeliveryToken token) {
                   // Not used for subscriber
               }
           });

           mqttClient.connect(options);

           // Subscribe to device state and settings topics
           mqttClient.subscribe(STATE_TOPIC_PATTERN, 1);
           mqttClient.subscribe(SETTINGS_TOPIC_PATTERN, 1);

           logger.info("MQTT Subscriber started and subscribed to device topics");
       }

       @PreDestroy
       public void stop() throws MqttException {
           if (mqttClient.isConnected()) {
               mqttClient.disconnect();
               mqttClient.close();
           }
           logger.info("MQTT Subscriber stopped");
       }

       /**
        * Handle incoming MQTT message and route to WebSocket clients.
        * Format: mitsubishi2mqtt/{deviceIdentifier}/{messageType}
        */
       private void handleIncomingMessage(String topic, MqttMessage message) {
           try {
               // Extract device identifier from topic
               String deviceIdentifier = extractDeviceIdentifier(topic);
               String messageType = extractMessageType(topic);
               String payload = new String(message.getPayload());

               logger.debug("Received MQTT message: topic={}, deviceId={}, type={}",
                   topic, deviceIdentifier, messageType);

               // Find device and get room ID
               deviceService.getDeviceByIdentifier(deviceIdentifier)
                   .flatMap(device -> {
                       // Parse message payload
                       Map<String, Object> parsedPayload = objectMapper.readValue(
                           payload,
                           Map.class
                       );

                       // Create WebSocket message
                       Map<String, Object> wsMessage = Map.of(
                           "type", messageType.toUpperCase(),
                           "deviceIdentifier", deviceIdentifier,
                           "deviceType", device.deviceType().getCode(),
                           "data", parsedPayload,
                           "timestamp", System.currentTimeMillis()
                       );

                       String wsPayload = objectMapper.writeValueAsString(wsMessage);

                       // Broadcast to all WebSocket sessions in the room
                       sessionRegistry.broadcastToRoom(device.roomId(), wsPayload);

                       return Mono.empty();
                   })
                   .onErrorResume(error -> {
                       logger.warn("Device not found for identifier: {}. This might be a new device.",
                           deviceIdentifier);

                       // Trigger dynamic discovery for unknown devices
                       triggerDeviceDiscovery(deviceIdentifier, messageType, payload);

                       return Mono.empty();
                   })
                   .subscribe();

           } catch (Exception e) {
               logger.error("Error processing MQTT message from topic: " + topic, e);
           }
       }

       /**
        * Extract device identifier from MQTT topic.
        * Topic format: mitsubishi2mqtt/{deviceIdentifier}/{messageType}
        */
       private String extractDeviceIdentifier(String topic) {
           String[] parts = topic.split("/");
           return parts.length >= 2 ? parts[1] : null;
       }

       /**
        * Extract message type from MQTT topic.
        * Returns: "state" or "settings"
        */
       private String extractMessageType(String topic) {
           String[] parts = topic.split("/");
           return parts.length >= 3 ? parts[2] : "unknown";
       }

       /**
        * Trigger dynamic device discovery when unknown device sends MQTT message.
        * Broadcasts discovery event to all WebSocket sessions for user-driven registration.
        */
       private void triggerDeviceDiscovery(String deviceIdentifier, String messageType, String payload) {
           try {
               Map<String, Object> discoveryMessage = Map.of(
                   "type", "DEVICE_DISCOVERED",
                   "deviceIdentifier", deviceIdentifier,
                   "messageType", messageType,
                   "payload", objectMapper.readValue(payload, Map.class),
                   "timestamp", System.currentTimeMillis(),
                   "requiresRegistration", true
               );

               String wsPayload = objectMapper.writeValueAsString(discoveryMessage);

               // Broadcast to ALL sessions for discovery notification
               sessionRegistry.broadcastToAll(wsPayload);

               logger.info("Device discovery triggered for unknown device: {}", deviceIdentifier);

           } catch (Exception e) {
               logger.error("Error triggering device discovery", e);
           }
       }
   }
   ```

2. **Create WebSocketSessionRegistry**
   - **File**: `src/main/java/com/ashelabs/turing/websocket/session/WebSocketSessionRegistry.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.websocket.session;

   import org.slf4j.Logger;
   import org.slf4j.LoggerFactory;
   import org.springframework.stereotype.Component;
   import org.springframework.web.reactive.socket.WebSocketSession;
   import reactor.core.publisher.Mono;

   import java.util.Map;
   import java.util.Set;
   import java.util.UUID;
   import java.util.concurrent.ConcurrentHashMap;
   import java.util.concurrent.CopyOnWriteArraySet;

   /**
    * Registry for tracking active WebSocket sessions by room.
    * Enables broadcasting messages to all clients in a specific room.
    */
   @Component
   public class WebSocketSessionRegistry {

       private static final Logger logger = LoggerFactory.getLogger(WebSocketSessionRegistry.class);

       // roomId -> Set of WebSocket sessions
       private final Map<UUID, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

       /**
        * Register a WebSocket session for a room.
        */
       public void registerSession(UUID roomId, WebSocketSession session) {
           roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>())
               .add(session);

           logger.debug("Registered session {} for room {}", session.getId(), roomId);
       }

       /**
        * Unregister a WebSocket session.
        */
       public void unregisterSession(UUID roomId, WebSocketSession session) {
           Set<WebSocketSession> sessions = roomSessions.get(roomId);
           if (sessions != null) {
               sessions.remove(session);
               if (sessions.isEmpty()) {
                   roomSessions.remove(roomId);
               }
           }

           logger.debug("Unregistered session {} from room {}", session.getId(), roomId);
       }

       /**
        * Broadcast message to all WebSocket sessions in a room.
        */
       public void broadcastToRoom(UUID roomId, String message) {
           Set<WebSocketSession> sessions = roomSessions.get(roomId);

           if (sessions == null || sessions.isEmpty()) {
               logger.debug("No active sessions for room {}", roomId);
               return;
           }

           logger.debug("Broadcasting to {} sessions in room {}", sessions.size(), roomId);

           sessions.forEach(session -> {
               session.send(Mono.just(session.textMessage(message)))
                   .onErrorResume(error -> {
                       logger.error("Error sending message to session {}", session.getId(), error);
                       return Mono.empty();
                   })
                   .subscribe();
           });
       }

       /**
        * Broadcast message to ALL WebSocket sessions (for device discovery).
        */
       public void broadcastToAll(String message) {
           roomSessions.values().forEach(sessions -> {
               sessions.forEach(session -> {
                   session.send(Mono.just(session.textMessage(message)))
                       .onErrorResume(error -> {
                           logger.error("Error sending discovery message to session {}", session.getId(), error);
                           return Mono.empty();
                       })
                       .subscribe();
               });
           });

           logger.debug("Broadcasted discovery message to all sessions");
       }

       /**
        * Get active session count for a room.
        */
       public int getSessionCount(UUID roomId) {
           Set<WebSocketSession> sessions = roomSessions.get(roomId);
           return sessions != null ? sessions.size() : 0;
       }

       /**
        * Get total active session count across all rooms.
        */
       public int getTotalSessionCount() {
           return roomSessions.values().stream()
               .mapToInt(Set::size)
               .sum();
       }
   }
   ```

3. **Update AirConditionerWebSocketHandler with Session Registry**
   - **File**: `src/main/java/com/ashelabs/turing/websocket/airconditioner/AirConditionerWebSocketHandler.java`
   - **Changes**:
   ```java
   private final WebSocketSessionRegistry sessionRegistry;

   @Override
   public Mono<Void> handle(WebSocketSession session) {
       UUID roomId = extractRoomId(session);

       // Register session for room-based broadcasting
       sessionRegistry.registerSession(roomId, session);

       return session.send(
           // ... existing command handling logic ...
       )
       .doFinally(signalType -> {
           // Unregister session on disconnect
           sessionRegistry.unregisterSession(roomId, session);
           logger.info("WebSocket session ended for room {}: {}", roomId, signalType);
       });
   }
   ```

4. **Create Device Discovery REST Endpoint**
   - **File**: `src/main/java/com/ashelabs/turing/api/device/DeviceDiscoveryController.java`
   - **Content**:
   ```java
   package com.ashelabs.turing.api.device;

   import com.ashelabs.turing.api.device.dto.DeviceDto;
   import com.ashelabs.turing.application.device.DeviceService;
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

       private final DeviceService deviceService;

       public DeviceDiscoveryController(DeviceService deviceService) {
           this.deviceService = deviceService;
       }

       /**
        * Get all devices discovered for a room (from database).
        */
       @GetMapping("/room/{roomId}")
       public Flux<DeviceDto> getDiscoveredDevices(@PathVariable UUID roomId) {
           return deviceService.getDevicesByRoom(roomId)
               .map(DeviceDto::from);
       }

       /**
        * Register a discovered device to a room.
        * Called by UI when user confirms device registration.
        */
       @PostMapping("/register")
       public Mono<DeviceDto> registerDiscoveredDevice(
           @RequestParam UUID roomId,
           @RequestParam String deviceIdentifier,
           @RequestParam String deviceType,
           @RequestBody(required = false) Map<String, Object> metadata
       ) {
           return deviceService.registerDevice(
               roomId,
               DeviceType.fromCode(deviceType),
               deviceIdentifier,
               null,  // manufacturer unknown for discovered devices
               null,  // model unknown
               metadata != null ? metadata : Map.of("discovered", true)
           ).map(DeviceDto::from);
       }
   }
   ```

5. **Update application.properties**
   ```properties
   # MQTT Subscriber Configuration
   mqtt.subscriber.client.id=turing-mqtt-subscriber
   ```

**Acceptance Criteria**:
- [ ] MqttMessageSubscriber subscribes to device topics on startup
- [ ] MQTT messages from devices routed to correct WebSocket sessions by roomId
- [ ] WebSocketSessionRegistry tracks sessions per room
- [ ] Device discovery triggered for unknown device identifiers
- [ ] Discovery notifications broadcast to all WebSocket clients
- [ ] Session cleanup on WebSocket disconnect
- [ ] User can register discovered devices via REST API

---

### Phase 12: Dynamic Device Discovery UI Flow

**Estimated Time**: 2-3 hours (Backend verification only)

This phase ensures the implementation supports the required UI behaviors:

#### Behavior A: Room Navigation with Dynamic Device Discovery

**Backend Requirements**:

1. **GET /api/devices/discovery/room/{roomId}** - Returns registered devices
   - ✅ Already implemented in DeviceDiscoveryController
   - Returns all devices registered to the room from database

2. **WebSocket Discovery Messages** - Real-time device discovery
   - ✅ MqttMessageSubscriber broadcasts `DEVICE_DISCOVERED` messages
   - Contains: `deviceIdentifier`, `messageType`, `payload`, `requiresRegistration: true`
   - UI can show "New device found: {deviceIdentifier}" prompt

3. **POST /api/devices/discovery/register** - User registers device to room
   - ✅ Already implemented in DeviceDiscoveryController
   - Associates discovered device identifier with room

**Flow**:
```
1. User navigates to room page
2. Frontend calls GET /api/devices/discovery/room/{roomId}
3. Backend returns list of registered devices for that room
4. UI displays registered devices
5. (Parallel) Unknown device sends MQTT message
6. MqttMessageSubscriber detects unknown deviceIdentifier
7. Broadcasts DEVICE_DISCOVERED to all WebSocket clients
8. UI shows "New device discovered: {deviceIdentifier}" notification
9. User clicks "Add to Room"
10. Frontend calls POST /api/devices/discovery/register with roomId + deviceIdentifier
11. Device now registered, appears in device list
```

#### Behavior B: Device Selection and Control

**Backend Requirements**:

1. **Device Selection** - User clicks on discovered device
   - Frontend navigates to device control page with `deviceIdentifier` parameter
   - No additional backend API needed

2. **Device Control Commands** - User interacts with device controls
   - ✅ DeviceService validates deviceIdentifier before sending commands
   - ✅ Commands sent to correct MQTT topic: `mitsubishi2mqtt/{deviceIdentifier}/temp/set`
   - ✅ Protocol abstraction ensures correct device receives command

3. **Real-time State Updates** - Device state changes reflected in UI
   - ✅ Device sends MQTT state update → MqttMessageSubscriber
   - ✅ Routed to WebSocket sessions in device's room
   - ✅ UI receives state update and displays current device state

**Flow**:
```
1. User clicks on device "ac_bedroom_main" in room device list
2. Frontend navigates to /devices/ac_bedroom_main/control
3. User sets temperature to 24°C
4. Frontend sends WebSocket command: {"action": "SET_TEMPERATURE", "temperature": 24}
5. AirConditionerWebSocketHandler receives command
6. Calls DeviceService.setDeviceTemperature("ac_bedroom_main", 24)
7. MqttProtocolPublisher publishes to: mitsubishi2mqtt/ac_bedroom_main/temp/set → "24"
8. Physical AC receives command and updates
9. AC sends state update to: mitsubishi2mqtt/ac_bedroom_main/state
10. MqttMessageSubscriber receives state update
11. Looks up device by identifier → gets roomId
12. Broadcasts to all WebSocket sessions in room
13. UI receives update and displays new temperature
```

**Acceptance Criteria**:
- [ ] Room page displays devices registered to that room
- [ ] Dynamic discovery notifications appear in real-time for unknown devices
- [ ] User can register discovered devices to rooms
- [ ] Device control page sends commands with correct deviceIdentifier
- [ ] Commands routed to correct MQTT topic based on deviceIdentifier
- [ ] Real-time state updates from devices displayed in UI
- [ ] Multiple users in same room see synchronized device state

---

## Clean Code Compliance Checklist

Throughout implementation, ensure adherence to clean code principles:

### DRY (Don't Repeat Yourself)
- [ ] Protocol-specific logic isolated in strategy implementations
- [ ] Device identifier validation centralized in value object
- [ ] Entity-domain conversion logic in mapper (not duplicated)
- [ ] Common query patterns in repository interface

### SOLID Principles
- [ ] **SRP**: Each class has single responsibility (Device, DeviceRepository, ProtocolPublisher, DeviceService)
- [ ] **OCP**: Protocol abstraction open for extension (new protocol publishers), closed for modification
- [ ] **LSP**: All ProtocolPublisher implementations substitutable
- [ ] **ISP**: Focused interfaces (DeviceRepository, ProtocolPublisher) - no fat interfaces
- [ ] **DIP**: High-level DeviceService depends on abstractions (interfaces), not concretions

### YAGNI (You Aren't Gonna Need It)
- [ ] Only implement required device types (AIRCONDITIONER initially)
- [ ] HTTP protocol publisher provided as example, not fully implemented unless needed
- [ ] Metadata field allows extension without schema changes
- [ ] No premature optimization - measure before optimizing

### Additional Standards
- [ ] Functions < 20 lines where possible
- [ ] Clear, descriptive naming (no abbreviations unless standard)
- [ ] Comprehensive error handling with meaningful messages
- [ ] Logging at appropriate levels (DEBUG for commands, INFO for lifecycle, ERROR for failures)

---

## Risk Mitigation

### Identified Risks

1. **MQTT Connection Failures**
   - **Mitigation**: Implement retry logic with exponential backoff in MqttProtocolPublisher
   - **Monitoring**: Alert on connection failures

2. **Device Identifier Conflicts**
   - **Mitigation**: Database unique constraint on (room_id, device_type, device_identifier)
   - **Handling**: Return clear error message on duplicate registration

3. **Database Migration Failures**
   - **Mitigation**: Comprehensive testing in staging environment
   - **Rollback**: Flyway undo migration + database backup

4. **Performance Degradation**
   - **Mitigation**: Database indexes on frequently queried columns
   - **Monitoring**: Query performance metrics, connection pool monitoring

5. **Protocol Publisher Failures**
   - **Mitigation**: Graceful error handling in DeviceService
   - **Monitoring**: Track command success/failure rates

---

## Success Metrics

### Functional Metrics
- [ ] Device registration via REST API working
- [ ] Device lookup by room ID < 50ms (P95)
- [ ] MQTT command publishing < 100ms (P95)
- [ ] WebSocket commands successfully routed through device abstraction
- [ ] Zero data loss during device registration/updates

### Code Quality Metrics
- [ ] Unit test coverage > 80%
- [ ] Integration test coverage > 70%
- [ ] Zero critical SonarQube issues
- [ ] Clean code principles score > 9/10 (as per design document)

### Operational Metrics
- [ ] MQTT connection uptime > 99.9%
- [ ] Database query success rate > 99.99%
- [ ] API endpoint availability > 99.9%
- [ ] Average API response time < 200ms

---

## Completion Criteria

This implementation is considered complete when:

1. **All phases completed** (1-10) with acceptance criteria met
2. **All tests passing** (unit, integration, E2E)
3. **Documentation updated** (API docs, CLAUDE.md, migration guide)
4. **Deployment successful** in staging and production
5. **Monitoring configured** with alerts for critical failures
6. **Clean code compliance verified** against checklist
7. **Performance metrics met** as defined in success metrics
8. **User acceptance testing passed** for device management workflows

---

## Appendix: Quick Reference Commands

### Development
```bash
# Run backend with hot reload
./mvnw spring-boot:run

# Run all tests
./mvnw test

# Run integration tests only
./mvnw verify -Dtest=*IntegrationTest

# Run database migration
./mvnw flyway:migrate

# Check migration status
./mvnw flyway:info
```

### Database
```sql
-- Check devices table
SELECT * FROM devices;

-- Check indexes
\d devices

-- Query devices by room
SELECT * FROM devices WHERE room_id = 'your-room-uuid';

-- Check metadata JSONB queries
SELECT * FROM devices WHERE metadata @> '{"auto_registered": true}';
```

### MQTT Testing
```bash
# Subscribe to all device topics
mosquitto_sub -h localhost -t 'mitsubishi2mqtt/#' -v

# Publish test temperature command
mosquitto_pub -h localhost -t 'mitsubishi2mqtt/ac_bedroom/temp/set' -m '24'
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Status**: Ready for Collaborative Refinement
