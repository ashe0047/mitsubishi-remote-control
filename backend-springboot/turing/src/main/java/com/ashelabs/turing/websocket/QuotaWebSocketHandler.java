package com.ashelabs.turing.websocket;

import com.ashelabs.turing.service.QuotaNotificationService;
import com.ashelabs.turing.service.QuotaUpdateEvent;
import com.ashelabs.turing.service.QuotaViolationEvent;
import com.ashelabs.turing.websocket.core.BaseWebSocketHandler;
import com.ashelabs.turing.websocket.core.CommandRegistry;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.QuotaOutboundMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.*;
import com.ashelabs.turing.websocket.quota.parser.QuotaMessageParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket handler for quota management features.
 *
 * <p>Extends BaseWebSocketHandler to inherit standard workflow:
 * context creation → session setup → message processing → cleanup.
 *
 * <p>Handles real-time quota updates, violation alerts, and override requests.
 *
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Only handles quota WebSocket sessions</li>
 *   <li>OCP: Extensible via command pattern</li>
 *   <li>DIP: Depends on abstractions (CommandRegistry, MessageParser)</li>
 * </ul>
 */
@Slf4j
@Component("quotaWebSocketHandler")
public class QuotaWebSocketHandler extends BaseWebSocketHandler {

    private final QuotaNotificationService quotaNotificationService;
    private final ObjectMapper objectMapper;
    private final QuotaMessageParser messageParser;
    private final CommandRegistry commandRegistry;

    // Global sinks for broadcasting quota updates
    private final Sinks.Many<QuotaUpdateMessage> quotaUpdateSink;
    private final Sinks.Many<ViolationAlertMessage> violationAlertSink;
    private final Sinks.Many<OverrideRequestMessage> overrideRequestSink;

    @Autowired
    public QuotaWebSocketHandler(
            QuotaNotificationService quotaNotificationService,
            ObjectMapper objectMapper,
            QuotaMessageParser messageParser,
            CommandRegistry commandRegistry,
            Sinks.Many<QuotaUpdateMessage> quotaUpdateSink,
            Sinks.Many<ViolationAlertMessage> violationAlertSink,
            Sinks.Many<OverrideRequestMessage> overrideRequestSink) {
        this.quotaNotificationService = quotaNotificationService;
        this.objectMapper = objectMapper;
        this.messageParser = messageParser;
        this.commandRegistry = commandRegistry;
        this.quotaUpdateSink = quotaUpdateSink;
        this.violationAlertSink = violationAlertSink;
        this.overrideRequestSink = overrideRequestSink;
    }

    @Override
    protected Mono<Void> processSession(WebSocketContext context) {
        log.debug("Processing quota session for user {} (room: {}, quota: {})",
            context.familyMemberId(), context.roomId(), context.quotaId());

        Flux<WebSocketMessage> outbound = createOutboundStream(context);
        Flux<Void> inbound = createInboundStream(context);

        return context.session().send(outbound).and(inbound);
    }

    @Override
    protected WebSocketContext createContext(WebSocketSession session) {
        // Extract query parameters
        Map<String, String> queryParams = extractQueryParameters(session);
        String familyMemberId = queryParams.get("familyMemberId");
        String roomId = queryParams.get("roomId");
        String quotaId = queryParams.get("quotaId");

        log.debug("Creating quota context: familyMemberId={}, roomId={}, quotaId={}",
            familyMemberId, roomId, quotaId);

        return WebSocketContext.createForQuota(session, familyMemberId, roomId, quotaId);
    }

    /**
     * Create outbound message stream (server → client).
     *
     * <p>Merges quota updates, violation alerts, and override requests,
     * filtered by familyMemberId/roomId/quotaId.
     */
    private Flux<WebSocketMessage> createOutboundStream(WebSocketContext context) {
        String familyMemberId = context.familyMemberId();
        String roomId = context.roomId();
        String quotaId = context.quotaId();

        Flux<WebSocketMessage> quotaUpdates = quotaUpdateSink.asFlux()
            .filter(msg -> shouldReceiveMessage(
                msg.payload().familyMemberId(), msg.payload().roomId(),
                familyMemberId, roomId, quotaId))
            .map(this::serializeOutboundMessage)
            .map(context.session()::textMessage)
            .doOnNext(msg -> log.debug("Sending quota update to session {}", context.sessionId()));

        Flux<WebSocketMessage> violationAlerts = violationAlertSink.asFlux()
            .filter(msg -> shouldReceiveMessage(
                msg.payload().familyMemberId(), msg.payload().roomId(),
                familyMemberId, roomId, quotaId))
            .map(this::serializeOutboundMessage)
            .map(context.session()::textMessage)
            .doOnNext(msg -> log.debug("Sending violation alert to session {}", context.sessionId()));

        Flux<WebSocketMessage> overrideRequests = overrideRequestSink.asFlux()
            .filter(msg -> shouldReceiveMessage(
                msg.payload().familyMemberId(), null,
                familyMemberId, roomId, quotaId))
            .map(this::serializeOutboundMessage)
            .map(context.session()::textMessage)
            .doOnNext(msg -> log.debug("Sending override request to session {}", context.sessionId()));

        return Flux.merge(quotaUpdates, violationAlerts, overrideRequests);
    }

    /**
     * Create inbound message stream (client → server).
     *
     * <p>Parses JSON messages and delegates to commands via CommandRegistry.
     */
    private Flux<Void> createInboundStream(WebSocketContext context) {
        return context.session().receive()
            .map(WebSocketMessage::getPayloadAsText)
            .doOnNext(json -> log.debug("Received quota message: {}", json))
            .flatMap(messageParser::parseInboundMessage)
            .filter(msg -> msg != null) // Filter out null messages (ignored types)
            .flatMap(msg -> commandRegistry.executeCommand(msg, context))
            .doOnError(e -> log.error("Error processing inbound message for session {}",
                context.sessionId(), e))
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
     * Filter messages based on session parameters.
     */
    private boolean shouldReceiveMessage(String msgFamilyMemberId, String msgRoomId,
                                       String sessionFamilyMemberId, String sessionRoomId, String sessionQuotaId) {
        // Filter by familyMemberId
        if (sessionFamilyMemberId != null && !sessionFamilyMemberId.equals(msgFamilyMemberId)) {
            return false;
        }
        // Filter by roomId
        if (sessionRoomId != null && msgRoomId != null && !sessionRoomId.equals(msgRoomId)) {
            return false;
        }
        return true;
    }

    /**
     * Serialize outbound message to JSON.
     */
    private String serializeOutboundMessage(QuotaOutboundMessage message) {
        try {
            return objectMapper.writeValueAsString(message);
        } catch (JsonProcessingException e) {
            log.error("Error serializing outbound message", e);
            return "{\"type\":\"error\",\"payload\":{\"message\":\"Serialization error\"}}";
        }
    }

    // ========== Event Listeners for Decoupled Communication ==========

    @EventListener
    public void handleQuotaUpdateEvent(QuotaUpdateEvent event) {
        log.debug("Received quota update event for quota: {}", event.getQuotaId());

        QuotaUpdateMessage message = new QuotaUpdateMessage(
                "QUOTA_UPDATE",
                new QuotaUpdatePayload(
                        event.getQuotaId(),
                        event.getFamilyMemberId(),
                        event.getRoomId(),
                        event.getCurrentUsage(),
                        event.getDailyLimit(),
                        event.getStatus(),
                        event.isCurrentlyActive(),
                        event.isCurrentlyActive() ? Instant.now().toString() : null,
                        event.getEstimatedSessionUsage(),
                        Instant.now().toString()
                )
        );

        quotaUpdateSink.tryEmitNext(message);
    }

    @EventListener
    public void handleQuotaViolationEvent(QuotaViolationEvent event) {
        log.debug("Received quota violation event for quota: {}", event.getQuotaId());

        ViolationAlertMessage message = new ViolationAlertMessage(
                "QUOTA_VIOLATION_ALERT",
                new ViolationAlertPayload(
                        event.getQuotaId(),
                        event.getFamilyMemberId(),
                        event.getFamilyMemberName(),
                        event.getRoomId(),
                        event.getRoomName(),
                        event.getViolationType(),
                        event.getCurrentUsage(),
                        event.getLimit(),
                        Instant.now().toString()
                )
        );

        violationAlertSink.tryEmitNext(message);
    }
}
