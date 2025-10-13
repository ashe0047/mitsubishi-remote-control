package com.ashelabs.turing.service;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.repository.RoomRepository;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdateMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdatePayload;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomUpdateType;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.Disposable;
import reactor.core.publisher.Sinks;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.UUID;

/**
 * MQTT-to-WebSocket Bridge Service.
 *
 * <p>Bridges MQTT device events to WebSocket client broadcasts by subscribing to
 * reactive MQTT event streams and transforming them into WebSocket messages.
 *
 * <p><strong>Architecture Pattern</strong>: Adapter Pattern
 * <ul>
 *   <li>Adapts MQTT event format to WebSocket message format</li>
 *   <li>Mediates between MQTT layer and WebSocket layer</li>
 *   <li>Provides fault isolation between protocol layers</li>
 * </ul>
 *
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Single responsibility - bridge MQTT → WebSocket only</li>
 *   <li>OCP: Extensible for new message types without modification</li>
 *   <li>DIP: Depends on abstractions (services, sinks) not implementations</li>
 * </ul>
 *
 * <p><strong>Error Handling</strong>:
 * Device lookup failures, transformation errors, and WebSocket publish failures
 * are logged and skipped to ensure stream continues processing.
 *
 * @see ReactiveMqttService
 * @see DeviceService
 * @see RoomService
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class MqttWebSocketBroadcaster {

    // Dependencies (injected by Spring)
    private final ReactiveMqttService reactiveMqttService;
    private final DeviceService deviceService;
    private final RoomService roomService;
    private final RoomRepository roomRepository;
    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;

    // Subscription lifecycle management
    private Disposable stateSubscription;
    private Disposable settingsSubscription;

    // Metrics for monitoring and health checks
    private final AtomicLong messagesProcessed = new AtomicLong(0);
    private final AtomicLong transformationErrors = new AtomicLong(0);
    private final AtomicLong publishErrors = new AtomicLong(0);

    /**
     * Lookup room information by device identifier.
     *
     * <p>Performs deviceIdentifier → Device → Room lookup flow, returning an enriched
     * {@link RoomResponse} when the mapping succeeds. Any lookup errors are logged and
     * surfaced as {@link Mono#empty()} to keep the reactive pipeline resilient.
     *
     * @param deviceIdentifier Device identifier resolved from MQTT event
     * @return Mono containing {@link RoomResponse} or empty if lookup fails
     */
    private Mono<RoomResponse> lookupRoomByDeviceIdentifier(String deviceIdentifier) {
        return deviceService.getDeviceByIdentifier(deviceIdentifier)
            .flatMap(device -> resolveRoomById(device.roomId(), deviceIdentifier))
            .switchIfEmpty(Mono.defer(() -> resolveRoomByIdentifier(deviceIdentifier)))
            .doOnSuccess(room -> {
                if (room != null) {
                    log.debug("[MqttWebSocketBroadcaster] Room lookup success for device '{}': room='{}'",
                        deviceIdentifier, room.getName());
                }
            })
            .switchIfEmpty(Mono.defer(() -> {
                log.warn("[MqttWebSocketBroadcaster] No room mapping found for device '{}'", deviceIdentifier);
                return Mono.<RoomResponse>empty();
            }))
            .onErrorResume(error -> {
                log.warn("[MqttWebSocketBroadcaster] Failed to lookup room for device '{}': {}",
                    deviceIdentifier, error.getMessage());
                return Mono.empty();
            });
    }

    private Mono<RoomResponse> resolveRoomById(UUID roomId, String identifier) {
        return roomRepository.findById(roomId)
            .switchIfEmpty(Mono.defer(() -> {
                log.warn("[MqttWebSocketBroadcaster] Room '{}' not found for identifier '{}'", roomId, identifier);
                return Mono.empty();
            }))
            .flatMap(room -> {
                UUID householdId = room.getHouseholdId();

                log.debug("[MqttWebSocketBroadcaster] Identifier '{}' mapped via device to roomId={}, householdId={}",
                    identifier, roomId, householdId);

                return roomService.getRoomByIdWithDevices(householdId, roomId);
            });
    }

    private Mono<RoomResponse> resolveRoomByIdentifier(String identifier) {
        return roomRepository.findByRoomIdentifier(identifier)
            .flatMap(room -> {
                UUID householdId = room.getHouseholdId();
                UUID roomId = room.getId();

                log.debug("[MqttWebSocketBroadcaster] Identifier '{}' resolved via slug to roomId={}, householdId={}",
                    identifier, roomId, householdId);

                return roomService.getRoomByIdWithDevices(householdId, roomId);
            })
            .switchIfEmpty(Mono.defer(() -> {
                log.warn("[MqttWebSocketBroadcaster] No room found matching identifier '{}'", identifier);
                return Mono.empty();
            }));
    }

    /**
     * Create a WebSocket message representing the current room state.
     *
     * @param room       Room context with device data
     * @param updateType Update classification emitted to clients
     * @return WebSocket message ready for broadcasting
     */
    private RoomStatusUpdateMessage createRoomStatusMessage(
        RoomResponse room,
        RoomUpdateType updateType,
        AirConState state,
        AirConSettings settings
    ) {
        RoomStatusUpdatePayload payload = new RoomStatusUpdatePayload(
            room.getId().toString(),
            room.getName(),
            room.getAggregateStatus(),
            room.getDevices(),
            Instant.now(),
            updateType,
            state,
            settings
        );

        log.debug("[MqttWebSocketBroadcaster] Created room status payload for roomId={}, updateType={}",
            room.getId(), updateType);

        return RoomStatusUpdateMessage.create(payload);
    }

    /**
     * Publish a room status message to the configured WebSocket sink.
     *
     * <p>Uses {@link Sinks.Many#tryEmitNext(Object)} to respect backpressure and records
     * metrics for monitoring. Any emit failures are logged for investigation.
     *
     * @param message Message to publish
     */
    private void publishToWebSocket(RoomStatusUpdateMessage message) {
        Sinks.EmitResult result = roomStatusUpdateSink.tryEmitNext(message);

        switch (result) {
            case OK -> {
                long total = messagesProcessed.incrementAndGet();
                log.debug("[MqttWebSocketBroadcaster] Published WebSocket message for room '{}' (processed={})",
                    message.payload().roomId(), total);
            }
            case FAIL_OVERFLOW -> {
                publishErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] WebSocket sink overflow for room '{}', message dropped",
                    message.payload().roomId());
            }
            case FAIL_TERMINATED -> {
                publishErrors.incrementAndGet();
                log.error("[MqttWebSocketBroadcaster] WebSocket sink terminated, cannot publish message");
            }
            case FAIL_CANCELLED -> {
                publishErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] WebSocket sink cancelled for room '{}'",
                    message.payload().roomId());
            }
            default -> {
                publishErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] Unexpected emit result '{}' for room '{}'",
                    result, message.payload().roomId());
            }
        }
    }

    /**
     * Transform a {@link MqttStateUpdateEvent} into a room status WebSocket message.
     *
     * @param event Incoming MQTT state event
     * @return Mono emitting transformed {@link RoomStatusUpdateMessage}
     */
    private Mono<RoomStatusUpdateMessage> transformStateUpdate(MqttStateUpdateEvent event) {
        String deviceIdentifier = event.getRoomId();
        AirConState state = event.getState();

        log.debug("[MqttWebSocketBroadcaster] Transforming state update for device '{}'", deviceIdentifier);

        return lookupRoomByDeviceIdentifier(deviceIdentifier)
            .map(room -> createRoomStatusMessage(
                room,
                RoomUpdateType.DEVICE_STATUS_CHANGE,
                state,
                null
            ))
            .doOnSuccess(message -> {
                if (message != null) {
                    log.debug("[MqttWebSocketBroadcaster] State update transformation complete for device '{}'",
                        deviceIdentifier);
                }
            })
            .onErrorResume(error -> {
                transformationErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] State update transformation failed for device '{}': {}",
                    deviceIdentifier, error.getMessage());
                return Mono.empty();
            });
    }

    /**
     * Transform a {@link MqttSettingsUpdateEvent} into a room status WebSocket message.
     *
     * @param event Incoming MQTT settings event
     * @return Mono emitting transformed {@link RoomStatusUpdateMessage}
     */
    private Mono<RoomStatusUpdateMessage> transformSettingsUpdate(MqttSettingsUpdateEvent event) {
        String deviceIdentifier = event.getRoomId();
        AirConSettings settings = event.getSettings();

        log.debug("[MqttWebSocketBroadcaster] Transforming settings update for device '{}'", deviceIdentifier);

        return lookupRoomByDeviceIdentifier(deviceIdentifier)
            .map(room -> createRoomStatusMessage(
                room,
                RoomUpdateType.DEVICE_STATUS_CHANGE,
                null,
                settings
            ))
            .doOnSuccess(message -> {
                if (message != null) {
                    log.debug("[MqttWebSocketBroadcaster] Settings update transformation complete for device '{}'",
                        deviceIdentifier);
                }
            })
            .onErrorResume(error -> {
                transformationErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] Settings update transformation failed for device '{}': {}",
                    deviceIdentifier, error.getMessage());
                return Mono.empty();
            });
    }

    /**
     * Initialize MQTT-WebSocket bridge on application startup.
     *
     * <p>Subscribes to MQTT reactive event streams and sets up message transformation pipeline.
     * Called automatically by Spring after bean construction.
     */
    @PostConstruct
    public void initialize() {
        log.info("[MqttWebSocketBroadcaster] Initializing MQTT-WebSocket bridge");

        stateSubscription = reactiveMqttService.getStateUpdates()
            .flatMap(this::transformStateUpdate, 8)
            .onErrorContinue((error, event) -> {
                transformationErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] Skipping state event due to error: {}, event={}",
                    error.getMessage(), event);
            })
            .doOnSubscribe(subscription -> log.info("[MqttWebSocketBroadcaster] State update subscription activated"))
            .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] State update ready for broadcast: roomId={}",
                message.payload().roomId()))
            .subscribe(
                this::publishToWebSocket,
                error -> log.error("[MqttWebSocketBroadcaster] CRITICAL: State update stream terminated", error),
                () -> log.info("[MqttWebSocketBroadcaster] State update stream completed")
            );

        settingsSubscription = reactiveMqttService.getSettingsUpdates()
            .flatMap(this::transformSettingsUpdate, 8)
            .onErrorContinue((error, event) -> {
                transformationErrors.incrementAndGet();
                log.warn("[MqttWebSocketBroadcaster] Skipping settings event due to error: {}, event={}",
                    error.getMessage(), event);
            })
            .doOnSubscribe(subscription -> log.info("[MqttWebSocketBroadcaster] Settings update subscription activated"))
            .doOnNext(message -> log.debug("[MqttWebSocketBroadcaster] Settings update ready for broadcast: roomId={}",
                message.payload().roomId()))
            .subscribe(
                this::publishToWebSocket,
                error -> log.error("[MqttWebSocketBroadcaster] CRITICAL: Settings update stream terminated", error),
                () -> log.info("[MqttWebSocketBroadcaster] Settings update stream completed")
            );

        log.info("[MqttWebSocketBroadcaster] MQTT-WebSocket bridge fully initialized and active");
    }

    /**
     * Cleanup MQTT-WebSocket bridge on application shutdown.
     *
     * <p>Disposes of reactive subscriptions to prevent memory leaks.
     * Called automatically by Spring during application shutdown.
     */
    @PreDestroy
    public void cleanup() {
        log.info("[MqttWebSocketBroadcaster] Cleaning up MQTT-WebSocket bridge");

        if (stateSubscription != null && !stateSubscription.isDisposed()) {
            stateSubscription.dispose();
            log.info("[MqttWebSocketBroadcaster] State subscription disposed");
        }
        stateSubscription = null;

        if (settingsSubscription != null && !settingsSubscription.isDisposed()) {
            settingsSubscription.dispose();
            log.info("[MqttWebSocketBroadcaster] Settings subscription disposed");
        }
        settingsSubscription = null;

        log.info("[MqttWebSocketBroadcaster] Cleanup complete");
    }

    // Metrics accessors for health checks and monitoring

    /**
     * Get total count of messages successfully processed and published to WebSocket.
     *
     * @return Total messages processed
     */
    public long getMessagesProcessed() {
        return messagesProcessed.get();
    }

    /**
     * Get total count of transformation errors (device lookup, room retrieval, etc.).
     *
     * @return Total transformation errors
     */
    public long getTransformationErrors() {
        return transformationErrors.get();
    }

    /**
     * Get total count of WebSocket publish errors (backpressure, sink issues).
     *
     * @return Total publish errors
     */
    public long getPublishErrors() {
        return publishErrors.get();
    }

    /**
     * Check if MQTT reactive stream subscriptions are active.
     *
     * @return true if subscriptions active, false otherwise
     */
    public boolean areSubscriptionsActive() {
        return stateSubscription != null && !stateSubscription.isDisposed();
    }
}
