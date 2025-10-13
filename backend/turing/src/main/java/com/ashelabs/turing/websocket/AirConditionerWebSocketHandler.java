package com.ashelabs.turing.websocket;

import com.ashelabs.turing.websocket.airconditioner.command.SetFanSpeedCommand;
import com.ashelabs.turing.websocket.airconditioner.command.SetModeCommand;
import com.ashelabs.turing.websocket.airconditioner.command.SetPowerCommand;
import com.ashelabs.turing.websocket.airconditioner.command.SetTemperatureCommand;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.*;
import com.ashelabs.turing.websocket.airconditioner.parser.AirConditionerMessageParser;
import com.ashelabs.turing.websocket.core.BaseWebSocketHandler;
import com.ashelabs.turing.websocket.core.CommandRegistry;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.session.WebSocketSessionRegistry;
import com.ashelabs.turing.websocket.session.EnhancedWebSocketSessionRegistry;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * WebSocket handler for air conditioner control endpoint (/ws).
 *
 * <p>Extends BaseWebSocketHandler to inherit standard workflow:
 * context creation → session setup → message processing → cleanup.
 *
 * <p><strong>Responsibilities</strong>:
 * <ul>
 *   <li>Air conditioner-specific session processing</li>
 *   <li>Outbound stream creation (status and temperature updates)</li>
 *   <li>Inbound stream processing (delegates to commands)</li>
 *   <li>Context creation for air conditioner endpoint</li>
 * </ul>
 *
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Only handles air conditioner WebSocket sessions</li>
 *   <li>OCP: Extensible via command pattern (add commands without modifying handler)</li>
 *   <li>DIP: Depends on abstractions (CommandRegistry, MessageParser)</li>
 * </ul>
 */
@Slf4j
@Component("airConditionerWebSocketHandler")
public class AirConditionerWebSocketHandler extends BaseWebSocketHandler {

    private final CommandRegistry commandRegistry;
    private final AirConditionerMessageParser messageParser;
    private final ObjectMapper objectMapper;
    private final Sinks.Many<StatusUpdateMessage> statusUpdateSink;
    private final Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink;
    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;
    private final Sinks.Many<BatchedRoomUpdateMessage> batchedRoomUpdateSink;
    private final WebSocketSessionRegistry sessionRegistry;
    private final EnhancedWebSocketSessionRegistry enhancedSessionRegistry;

    @Autowired
    public AirConditionerWebSocketHandler(
            CommandRegistry commandRegistry,
            AirConditionerMessageParser messageParser,
            ObjectMapper objectMapper,
            Sinks.Many<StatusUpdateMessage> statusUpdateSink,
            Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink,
            Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink,
            Sinks.Many<BatchedRoomUpdateMessage> batchedRoomUpdateSink,
            WebSocketSessionRegistry sessionRegistry,
            EnhancedWebSocketSessionRegistry enhancedSessionRegistry,
            SetPowerCommand setPowerCommand,
            SetModeCommand setModeCommand,
            SetTemperatureCommand setTemperatureCommand,
            SetFanSpeedCommand setFanSpeedCommand) {
        this.commandRegistry = commandRegistry;
        this.messageParser = messageParser;
        this.objectMapper = objectMapper;
        this.statusUpdateSink = statusUpdateSink;
        this.temperatureUpdateSink = temperatureUpdateSink;
        this.roomStatusUpdateSink = roomStatusUpdateSink;
        this.batchedRoomUpdateSink = batchedRoomUpdateSink;
        this.sessionRegistry = sessionRegistry;
        this.enhancedSessionRegistry = enhancedSessionRegistry;

        // Register commands for inbound control messages
        this.commandRegistry.registerCommands(List.of(
            setPowerCommand,
            setModeCommand,
            setTemperatureCommand,
            setFanSpeedCommand
        ));
    }

    @Override
    protected Mono<Void> processSession(WebSocketContext context) {
        String roomId = context.roomId();

        // Validate roomId parameter
        if (roomId == null || roomId.isBlank()) {
            log.error("Missing required 'roomId' query parameter in WebSocket URL");
            return Mono.error(new IllegalArgumentException(
                "Missing required 'roomId' query parameter. " +
                "WebSocket URL must be: /ws/airconditioner?roomId={uuid}&token={jwt}"
            ));
        }

        UUID roomUuid;
        try {
            roomUuid = UUID.fromString(roomId);
        } catch (IllegalArgumentException e) {
            log.error("Invalid roomId format: {}", roomId);
            return Mono.error(new IllegalArgumentException(
                "Invalid roomId format. Expected UUID, got: " + roomId
            ));
        }

        WebSocketSession session = context.session();

        log.info("[WS][airconditioner] New session: roomId={}, userId={}", roomId, context.familyMemberId());

        // Register session for room-based broadcasting (legacy)
        sessionRegistry.registerSession(roomUuid, session);
        
        // Register session for enhanced subscription management
        String userId = context.familyMemberId();
        enhancedSessionRegistry.registerSession(session, userId);

        Flux<WebSocketMessage> outbound = createOutboundStream(context);
        Flux<Void> inbound = createInboundStream(context);

        return context.session().send(outbound).and(inbound)
            .doFinally(signalType -> {
                // Unregister session on disconnect (legacy)
                sessionRegistry.unregisterSession(roomUuid, session);
                
                // Unregister session from enhanced registry
                enhancedSessionRegistry.unregisterSession(session);
                
                log.info("WebSocket session ended for room {}: {}", roomId, signalType);
            });
    }

    @Override
    protected WebSocketContext createContext(WebSocketSession session) {
        // Extract query parameters
        Map<String, String> queryParams = extractQueryParameters(session);
        String familyMemberId = queryParams.get("familyMemberId");
        String roomId = queryParams.get("roomId");

        // Use userId from session attributes if familyMemberId not in query params
        if (familyMemberId == null) {
            Object userIdObj = session.getAttributes().get("userId");
            familyMemberId = userIdObj != null ? userIdObj.toString() : null;
        }

        log.debug("Creating air conditioner context for room {}", roomId);

        return WebSocketContext.createForAirConditioner(session, familyMemberId, roomId);
    }

    /**
     * Create outbound message stream (server → client).
     *
     * <p>Merges device status updates, temperature updates, room status updates, 
     * and batched updates, filtered by room ID.
     */
    private Flux<WebSocketMessage> createOutboundStream(WebSocketContext context) {
        String roomId = context.roomId();
        WebSocketSession session = context.session();

        // Device-level status updates (existing)
        Flux<WebSocketMessage> statusUpdates = statusUpdateSink.asFlux()
            .doOnNext(msg -> {
                try {
                    log.debug("[WS][airconditioner] StatusUpdate emitted: payload.roomId={} (session roomId={})",
                        msg.payload().roomId(), roomId);
                } catch (Exception ignored) {}
            })
            .filter(msg -> msg.payload().roomId().equals(roomId))
            .map(this::serializeMessage)
            .map(session::textMessage)
            .doOnNext(msg -> log.debug("Sending device status update to room {}", roomId));

        // Device temperature updates (existing)
        Flux<WebSocketMessage> temperatureUpdates = temperatureUpdateSink.asFlux()
            .doOnNext(msg -> {
                try {
                    log.debug("[WS][airconditioner] TemperatureUpdate emitted: payload.roomId={} (session roomId={})",
                        msg.payload().roomId(), roomId);
                } catch (Exception ignored) {}
            })
            .filter(msg -> msg.payload().roomId().equals(roomId))
            .map(this::serializeMessage)
            .map(session::textMessage)
            .doOnNext(msg -> log.debug("Sending temperature update to room {}", roomId));

        // Room-level status updates (new)
        Flux<WebSocketMessage> roomStatusUpdates = roomStatusUpdateSink.asFlux()
            .doOnNext(msg -> {
                try {
                    log.debug("[WS][airconditioner] RoomStatusUpdate emitted: payload.roomId={} (session roomId={})",
                        msg.payload().roomId(), roomId);
                } catch (Exception ignored) {}
            })
            .filter(msg -> msg.payload().roomId().equals(roomId))
            .map(this::serializeMessage)
            .map(session::textMessage)
            .doOnNext(msg -> log.debug("Sending room status update to room {}", roomId));

        // Batched room updates (new) - filter for updates containing this room
        Flux<WebSocketMessage> batchedUpdates = batchedRoomUpdateSink.asFlux()
            .doOnNext(msg -> {
                try {
                    var hasRoom = msg.payload().roomUpdates().stream().anyMatch(u -> u.roomId().equals(roomId));
                    log.debug("[WS][airconditioner] BatchedUpdate emitted containsRoom={}", hasRoom);
                } catch (Exception ignored) {}
            })
            .filter(msg -> msg.payload().roomUpdates().stream()
                .anyMatch(update -> update.roomId().equals(roomId)))
            .map(this::serializeMessage)
            .map(session::textMessage)
            .doOnNext(msg -> log.debug("Sending batched room update to room {}", roomId));

        return Flux.merge(statusUpdates, temperatureUpdates, roomStatusUpdates, batchedUpdates);
    }

    /**
     * Create inbound message stream (client → server).
     *
     * <p>Parses JSON messages and delegates to commands via CommandRegistry.
     */
    private Flux<Void> createInboundStream(WebSocketContext context) {
        return context.session().receive()
            .map(WebSocketMessage::getPayloadAsText)
            .doOnNext(json -> log.debug("Received air conditioner message: {}", json))
            .flatMap(messageParser::parseInboundMessage)
            .filter(msg -> msg != null) // Filter out null messages
            .flatMap(msg -> commandRegistry.executeCommand(msg, context))
            .doOnError(e -> log.error("Error processing inbound message for room {}",
                context.roomId(), e))
            .onErrorResume(e -> Mono.empty()); // Don't crash connection on error
    }

    /**
     * Extract query parameters from WebSocket handshake.
     */
    private Map<String, String> extractQueryParameters(WebSocketSession session) {
        Map<String, String> params = new HashMap<>();
        String query = session.getHandshakeInfo().getUri().getQuery();
        if (query != null) {
            String[] pairs = query.split("&");
            for (String pair : pairs) {
                String[] keyValue = pair.split("=");
                if (keyValue.length == 2) {
                    params.put(keyValue[0], keyValue[1]);
                }
            }
        }
        return params;
    }

    /**
     * Serialize message object to JSON string.
     */
    private String serializeMessage(Object message) {
        try {
            return objectMapper.writeValueAsString(message);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message to JSON", e);
            return "{\"type\":\"error\",\"error\":\"Serialization error\"}";
        }
    }
}
