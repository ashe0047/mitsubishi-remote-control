package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSink;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
public class ReactiveMqttService {

    private final MqttService mqttService; // Existing MQTT service

    // Reactive streams bridging MQTT callbacks
    private final Flux<MqttStateUpdateEvent> stateUpdates;
    private final Flux<MqttSettingsUpdateEvent> settingsUpdates;
    private final Flux<MqttConnectionEvent> connectionEvents;

    // FluxSink instances for bridging callbacks to reactive streams
    private FluxSink<MqttStateUpdateEvent> stateSink;
    private FluxSink<MqttSettingsUpdateEvent> settingsSink;
    private FluxSink<MqttConnectionEvent> connectionSink;

    // Track subscribers for proper cleanup
    private final ConcurrentMap<String, FluxSink<MqttStateUpdateEvent>> stateSubscribers = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, FluxSink<MqttSettingsUpdateEvent>> settingsSubscribers = new ConcurrentHashMap<>();

    @Autowired
    public ReactiveMqttService(MqttService mqttService) {
        this.mqttService = mqttService;

        // Initialize hot streams for MQTT events using Flux.create
        this.stateUpdates = Flux.<MqttStateUpdateEvent>create(sink -> {
            this.stateSink = sink;
            log.info("State updates stream subscriber registered");

            // Cleanup on disposal
            sink.onDispose(() -> {
                log.info("State updates stream subscriber disposed");
                this.stateSink = null;
            });
        }, FluxSink.OverflowStrategy.BUFFER)
                .share(); // Hot stream for multiple subscribers

        this.settingsUpdates = Flux.<MqttSettingsUpdateEvent>create(sink -> {
            this.settingsSink = sink;
            log.info("Settings updates stream subscriber registered");

            // Cleanup on disposal
            sink.onDispose(() -> {
                log.info("Settings updates stream subscriber disposed");
                this.settingsSink = null;
            });
        }, FluxSink.OverflowStrategy.BUFFER)
                .share(); // Hot stream for multiple subscribers

        this.connectionEvents = Flux.<MqttConnectionEvent>create(sink -> {
            this.connectionSink = sink;
            log.info("Connection events stream subscriber registered");

            // Cleanup on disposal
            sink.onDispose(() -> {
                log.info("Connection events stream subscriber disposed");
                this.connectionSink = null;
            });
        }, FluxSink.OverflowStrategy.BUFFER)
                .share(); // Hot stream for multiple subscribers
    }

    @PostConstruct
    public void initialize() {
        log.info("Initializing Reactive MQTT Service - bridging existing MQTT service to reactive streams");

        // Subscribe to the reactive streams to activate them
        stateUpdates.subscribe(
                event -> log.debug("State update event processed: {} for room {}", event.getState(), event.getRoomId()),
                error -> log.error("Error in state updates stream", error),
                () -> log.info("State updates stream completed"));

        settingsUpdates.subscribe(
                event -> log.debug("Settings update event processed: {} for room {}", event.getSettings(),
                        event.getRoomId()),
                error -> log.error("Error in settings updates stream", error),
                () -> log.info("Settings updates stream completed"));

        connectionEvents.subscribe(
                event -> log.debug("Connection event processed: connected={}", event.isConnected()),
                error -> log.error("Error in connection events stream", error),
                () -> log.info("Connection events stream completed"));
    }

    @PreDestroy
    public void cleanup() {
        log.info("Cleaning up Reactive MQTT Service");

        // Complete all sinks to clean up subscriptions
        if (stateSink != null && !stateSink.isCancelled()) {
            stateSink.complete();
        }
        if (settingsSink != null && !settingsSink.isCancelled()) {
            settingsSink.complete();
        }
        if (connectionSink != null && !connectionSink.isCancelled()) {
            connectionSink.complete();
        }
    }

    // Bridge Spring Application Events to reactive streams
    @EventListener
    public void handleMqttStateUpdate(MqttStateUpdateEvent event) {
        log.debug("Bridging MQTT state update event to reactive stream for room: {}", event.getRoomId());

        if (stateSink != null && !stateSink.isCancelled()) {
            stateSink.next(event);
        }
    }

    @EventListener
    public void handleMqttSettingsUpdate(MqttSettingsUpdateEvent event) {
        log.debug("Bridging MQTT settings update event to reactive stream for room: {}", event.getRoomId());

        if (settingsSink != null && !settingsSink.isCancelled()) {
            settingsSink.next(event);
        }
    }

    @EventListener
    public void handleMqttConnectionEvent(MqttConnectionEvent event) {
        log.debug("Bridging MQTT connection event to reactive stream: connected={}", event.isConnected());

        if (connectionSink != null && !connectionSink.isCancelled()) {
            connectionSink.next(event);
        }
    }

    // Reactive API methods

    /**
     * Publish a command to MQTT broker reactively
     * 
     * @param roomId  The room identifier
     * @param command The command type (power, temp, mode, etc.)
     * @param value   The command value
     * @return Mono that completes when command is published
     */
    public Mono<Void> publishCommand(String roomId, String command, Object value) {
        return Mono.fromRunnable(() -> mqttService.publishCommand(roomId, command, value))
                .subscribeOn(Schedulers.boundedElastic()) // Use bounded elastic for potentially blocking operations
                .doOnSuccess(
                        v -> log.info("Reactive MQTT command published: {}={} for room {}", command, value, roomId))
                .doOnError(error -> log.error("Failed to publish reactive MQTT command: {}={} for room {}", command,
                        value, roomId, error))
                .then();
    }

    /**
     * Get reactive stream of state updates
     * 
     * @return Flux of MQTT state update events
     */
    public Flux<MqttStateUpdateEvent> getStateUpdates() {
        return stateUpdates;
    }

    /**
     * Get reactive stream of state updates for a specific room
     * 
     * @param roomId The room identifier
     * @return Flux of MQTT state update events filtered by room ID
     */
    public Flux<MqttStateUpdateEvent> getStateUpdatesForRoom(String roomId) {
        return stateUpdates
                .filter(event -> roomId.equals(event.getRoomId()))
                .doOnSubscribe(s -> log.info("Client subscribed to state updates for room: {}", roomId))
                .doOnCancel(() -> log.info("Client unsubscribed from state updates for room: {}", roomId));
    }

    /**
     * Get reactive stream of settings updates
     * 
     * @return Flux of MQTT settings update events
     */
    public Flux<MqttSettingsUpdateEvent> getSettingsUpdates() {
        return settingsUpdates;
    }

    /**
     * Get reactive stream of settings updates for a specific room
     * 
     * @param roomId The room identifier
     * @return Flux of MQTT settings update events filtered by room ID
     */
    public Flux<MqttSettingsUpdateEvent> getSettingsUpdatesForRoom(String roomId) {
        return settingsUpdates
                .filter(event -> roomId.equals(event.getRoomId()))
                .doOnSubscribe(s -> log.info("Client subscribed to settings updates for room: {}", roomId))
                .doOnCancel(() -> log.info("Client unsubscribed from settings updates for room: {}", roomId));
    }

    /**
     * Get reactive stream of connection events
     * 
     * @return Flux of MQTT connection events
     */
    public Flux<MqttConnectionEvent> getConnectionEvents() {
        return connectionEvents;
    }

    /**
     * Check if MQTT is connected reactively
     * 
     * @return Mono containing connection status
     */
    public Mono<Boolean> isConnected() {
        return Mono.fromCallable(() -> mqttService.isConnected())
                .subscribeOn(Schedulers.boundedElastic());
    }

    /**
     * Get current state from MQTT service as Mono
     * 
     * @param roomId The room identifier
     * @return Mono containing current state, empty if not found
     */
    public Mono<AirConState> getCurrentState(String roomId) {
        // This would need to be implemented if MqttService had state access
        // For now, return empty as state is managed in AirConService
        return Mono.empty();
    }

    /**
     * Get current settings from MQTT service as Mono
     * 
     * @param roomId The room identifier
     * @return Mono containing current settings, empty if not found
     */
    public Mono<AirConSettings> getCurrentSettings(String roomId) {
        // This would need to be implemented if MqttService had settings access
        // For now, return empty as settings are managed in AirConService
        return Mono.empty();
    }
}