package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.RoomInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
public class ReactiveAirConService {

    private final ReactiveMqttService mqttService;
    
    // Preserve existing in-memory storage (thread-safe)
    private final ConcurrentMap<String, AirConState> roomStates = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AirConSettings> roomSettings = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, LocalDateTime> lastUpdated = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> roomNames = new ConcurrentHashMap<>();

    @Autowired
    public ReactiveAirConService(ReactiveMqttService mqttService) {
        this.mqttService = mqttService;
        initializeDefaultRooms();
    }

    private void initializeDefaultRooms() {
        // Room names will be populated dynamically from MQTT discovery
        // No hardcoded demo rooms - real rooms will be discovered through MQTT topics
    }

    @PostConstruct
    public void initialize() {
        log.info("Initializing Reactive AirCon Service - subscribing to MQTT streams");
        
        // Subscribe to reactive MQTT streams instead of @EventListener
        mqttService.getStateUpdates()
            .doOnNext(event -> log.debug("Received state update for room {}: {}", event.getRoomId(), event.getState()))
            .subscribe(this::handleStateUpdate,
                error -> log.error("Error processing MQTT state updates", error),
                () -> log.info("MQTT state updates stream completed"));
            
        mqttService.getSettingsUpdates()
            .doOnNext(event -> log.debug("Received settings update for room {}: {}", event.getRoomId(), event.getSettings()))
            .subscribe(this::handleSettingsUpdate,
                error -> log.error("Error processing MQTT settings updates", error),
                () -> log.info("MQTT settings updates stream completed"));
                
        mqttService.getConnectionEvents()
            .doOnNext(event -> log.debug("Received connection event: connected={}", event.isConnected()))
            .subscribe(this::handleConnectionEvent,
                error -> log.error("Error processing MQTT connection events", error),
                () -> log.info("MQTT connection events stream completed"));
    }

    // Event handlers (now called from reactive streams)
    private void handleStateUpdate(MqttStateUpdateEvent event) {
        String roomId = event.getRoomId();
        AirConState state = event.getState();
        
        log.info("Processing reactive state update for room {}: {}", roomId, state);
        
        roomStates.put(roomId, state);
        lastUpdated.put(roomId, LocalDateTime.now());
        
        // Add room name if not exists - use roomId as-is from MQTT
        if (!roomNames.containsKey(roomId)) {
            roomNames.put(roomId, roomId);
        }
        
        log.info("Updated reactive state for room {} (WebSocket clients will receive updates)", roomId);
    }

    private void handleSettingsUpdate(MqttSettingsUpdateEvent event) {
        String roomId = event.getRoomId();
        AirConSettings settings = event.getSettings();
        
        log.info("Processing reactive settings update for room {}: {}", roomId, settings);
        
        roomSettings.put(roomId, settings);
        lastUpdated.put(roomId, LocalDateTime.now());
        
        // Add room name if not exists - use roomId as-is from MQTT
        if (!roomNames.containsKey(roomId)) {
            roomNames.put(roomId, roomId);
        }
        
        log.info("Updated reactive settings for room {} (WebSocket clients will receive updates)", roomId);
    }

    private void handleConnectionEvent(MqttConnectionEvent event) {
        boolean connected = event.isConnected();
        log.info("Reactive MQTT connection status changed: {}", connected ? "CONNECTED" : "DISCONNECTED");
    }

    // Reactive API methods

    /**
     * Get all rooms reactively
     * @return Mono containing list of room information
     */
    public Mono<List<RoomInfo>> getRooms() {
        return Mono.fromCallable(this::buildRoomsList)
            .subscribeOn(Schedulers.boundedElastic())
            .doOnSuccess(rooms -> log.debug("Retrieved {} rooms", rooms.size()));
    }

    /**
     * Get room state reactively
     * @param roomId The room identifier
     * @return Mono containing room state, empty if not found
     */
    public Mono<AirConState> getRoomState(String roomId) {
        AirConState state = roomStates.get(roomId);
        if (state != null) {
            log.debug("Retrieved state for room {}: {}", roomId, state);
            return Mono.just(state);
        } else {
            log.debug("No state found for room: {}", roomId);
            return Mono.empty();
        }
    }

    /**
     * Get room settings reactively
     * @param roomId The room identifier
     * @return Mono containing room settings, empty if not found
     */
    public Mono<AirConSettings> getRoomSettings(String roomId) {
        AirConSettings settings = roomSettings.get(roomId);
        if (settings != null) {
            log.debug("Retrieved settings for room {}: {}", roomId, settings);
            return Mono.just(settings);
        } else {
            log.debug("No settings found for room: {}", roomId);
            return Mono.empty();
        }
    }

    /**
     * Get state stream for a room (for WebSocket subscriptions)
     * @param roomId The room identifier
     * @return Flux of state updates for the room
     */
    public Flux<AirConState> getStateStream(String roomId) {
        return Flux.interval(Duration.ofSeconds(2))
            .mapNotNull(i -> roomStates.get(roomId))
            .distinctUntilChanged()
            .doOnSubscribe(s -> log.info("Client subscribed to state stream for room: {}", roomId))
            .doOnCancel(() -> log.info("Client unsubscribed from state stream for room: {}", roomId));
    }

    /**
     * Get settings stream for a room (for WebSocket subscriptions)
     * @param roomId The room identifier
     * @return Flux of settings updates for the room
     */
    public Flux<AirConSettings> getSettingsStream(String roomId) {
        return Flux.interval(Duration.ofSeconds(2))
            .mapNotNull(i -> roomSettings.get(roomId))
            .distinctUntilChanged()
            .doOnSubscribe(s -> log.info("Client subscribed to settings stream for room: {}", roomId))
            .doOnCancel(() -> log.info("Client unsubscribed from settings stream for room: {}", roomId));
    }

    /**
     * Get all state updates stream (for global WebSocket subscriptions)
     * @return Flux of all state updates with room information
     */
    public Flux<RoomStateUpdate> getAllStateUpdates() {
        return mqttService.getStateUpdates()
            .map(event -> new RoomStateUpdate(event.getRoomId(), event.getState()))
            .doOnSubscribe(s -> log.info("Client subscribed to all state updates stream"))
            .doOnCancel(() -> log.info("Client unsubscribed from all state updates stream"));
    }

    /**
     * Get all settings updates stream (for global WebSocket subscriptions)
     * @return Flux of all settings updates with room information
     */
    public Flux<RoomSettingsUpdate> getAllSettingsUpdates() {
        return mqttService.getSettingsUpdates()
            .map(event -> new RoomSettingsUpdate(event.getRoomId(), event.getSettings()))
            .doOnSubscribe(s -> log.info("Client subscribed to all settings updates stream"))
            .doOnCancel(() -> log.info("Client unsubscribed from all settings updates stream"));
    }

    // Command methods that return reactive types
    
    /**
     * Set power reactively
     * @param roomId The room identifier
     * @param power The power state
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setPower(String roomId, String power) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "power", power))
            .doOnSuccess(v -> log.info("Reactive power command sent for room {}: {}", roomId, power));
    }

    /**
     * Set temperature reactively
     * @param roomId The room identifier
     * @param temperature The target temperature
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setTemperature(String roomId, int temperature) {
        return validateRoomId(roomId)
            .then(validateTemperature(temperature))
            .then(mqttService.publishCommand(roomId, "temp", temperature))
            .doOnSuccess(v -> log.info("Reactive temperature command sent for room {}: {}", roomId, temperature));
    }

    /**
     * Set mode reactively
     * @param roomId The room identifier
     * @param mode The AC mode
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setMode(String roomId, String mode) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "mode", mode))
            .doOnSuccess(v -> log.info("Reactive mode command sent for room {}: {}", roomId, mode));
    }

    /**
     * Set fan speed reactively
     * @param roomId The room identifier
     * @param fan The fan speed
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setFan(String roomId, String fan) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "fan", fan))
            .doOnSuccess(v -> log.info("Reactive fan command sent for room {}: {}", roomId, fan));
    }

    /**
     * Set vane position reactively
     * @param roomId The room identifier
     * @param vane The vane position
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setVane(String roomId, String vane) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "vane", vane))
            .doOnSuccess(v -> log.info("Reactive vane command sent for room {}: {}", roomId, vane));
    }

    /**
     * Set wide vane position reactively
     * @param roomId The room identifier
     * @param wideVane The wide vane position
     * @return Mono that completes when command is sent
     */
    public Mono<Void> setWideVane(String roomId, String wideVane) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "widevane", wideVane))
            .doOnSuccess(v -> log.info("Reactive wide vane command sent for room {}: {}", roomId, wideVane));
    }

    /**
     * Update all settings reactively
     * @param roomId The room identifier
     * @param settings The air conditioning settings
     * @return Mono that completes when all commands are sent
     */
    public Mono<Void> updateSettings(String roomId, AirConSettings settings) {
        return validateRoomId(roomId)
            .then(Mono.when(
                setPower(roomId, settings.getPower()),
                setTemperature(roomId, settings.getTemperature().intValue()),
                setMode(roomId, settings.getMode()),
                setFan(roomId, settings.getFan()),
                setVane(roomId, settings.getVane()),
                setWideVane(roomId, settings.getWideVane())
            ))
            .doOnSuccess(v -> log.info("Reactive settings update completed for room {}: {}", roomId, settings));
    }

    /**
     * Check if MQTT is connected reactively
     * @return Mono containing connection status
     */
    public Mono<Boolean> isMqttConnected() {
        return mqttService.isConnected();
    }

    // Validation methods

    private Mono<Void> validateRoomId(String roomId) {
        return Mono.fromCallable(() -> {
            if (roomId == null || roomId.trim().isEmpty()) {
                throw new IllegalArgumentException("Room ID cannot be null or empty");
            }
            if (!roomNames.containsKey(roomId)) {
                throw new IllegalArgumentException("Unknown room ID: " + roomId);
            }
            return roomId;
        }).then();
    }

    private Mono<Void> validateTemperature(int temperature) {
        return Mono.fromCallable(() -> {
            if (temperature < 16 || temperature > 31) {
                throw new IllegalArgumentException("Temperature must be between 16 and 31 degrees");
            }
            return temperature;
        }).then();
    }

    // Helper methods

    private List<RoomInfo> buildRoomsList() {
        List<RoomInfo> rooms = new ArrayList<>();
        
        for (String roomId : roomNames.keySet()) {
            RoomInfo roomInfo = new RoomInfo();
            roomInfo.setId(roomId);
            roomInfo.setName(roomNames.get(roomId));
            roomInfo.setOnline(isRoomOnline(roomId));
            roomInfo.setState(roomStates.get(roomId));
            roomInfo.setSettings(roomSettings.get(roomId));
            rooms.add(roomInfo);
        }
        
        return rooms;
    }

    private boolean isRoomOnline(String roomId) {
        LocalDateTime lastUpdate = lastUpdated.get(roomId);
        if (lastUpdate == null) {
            return false;
        }
        // Consider room online if updated within last 5 minutes
        return lastUpdate.isAfter(LocalDateTime.now().minusMinutes(5));
    }


    // Helper classes for WebSocket streaming

    public static class RoomStateUpdate {
        private final String roomId;
        private final AirConState state;

        public RoomStateUpdate(String roomId, AirConState state) {
            this.roomId = roomId;
            this.state = state;
        }

        public String getRoomId() { return roomId; }
        public AirConState getState() { return state; }
    }

    public static class RoomSettingsUpdate {
        private final String roomId;
        private final AirConSettings settings;

        public RoomSettingsUpdate(String roomId, AirConSettings settings) {
            this.roomId = roomId;
            this.settings = settings;
        }

        public String getRoomId() { return roomId; }
        public AirConSettings getSettings() { return settings; }
    }
}