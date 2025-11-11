package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SubscribeToRoomMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.AckMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.ErrorMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.session.EnhancedWebSocketSessionRegistry;
import com.ashelabs.turing.websocket.session.RoomSubscription;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Command to handle room subscription requests.
 * 
 * This command processes SUBSCRIBE_TO_ROOM messages and manages
 * WebSocket subscriptions for room status updates.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscribeToRoomCommand implements WebSocketCommand<SubscribeToRoomMessage> {

    private final EnhancedWebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> execute(SubscribeToRoomMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String sessionId = context.session().getId();
            String userId = context.familyMemberId();
            
            log.debug("Processing room subscription request: {} for session {}", message, sessionId);

            try {
                RoomSubscription subscription = createSubscription(message, sessionId, userId);
                boolean success = sessionRegistry.addSubscription(sessionId, subscription);
                
                if (success) {
                    log.info("Successfully subscribed session {} to {}", sessionId, subscription);
                    return sendAcknowledgment(message, context);
                } else {
                    log.warn("Failed to add subscription for session {}", sessionId);
                    return sendError(message, context, "Failed to add subscription");
                }
                
            } catch (Exception e) {
                log.error("Error processing subscription request for session {}", sessionId, e);
                return sendError(message, context, "Invalid subscription request: " + e.getMessage());
            }
        });
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SubscribeToRoomMessage;
    }

    /**
     * Create a room subscription from the message.
     * 
     * @param message Subscription message
     * @param sessionId WebSocket session ID
     * @param userId User ID
     * @return RoomSubscription instance
     * @throws IllegalArgumentException if subscription type is invalid
     */
    private RoomSubscription createSubscription(SubscribeToRoomMessage message, String sessionId, String userId) {
        return switch (message.subscriptionType().toLowerCase()) {
            case "room" -> {
                if (message.roomId() == null || message.roomId().isBlank()) {
                    throw new IllegalArgumentException("Room ID is required for room-specific subscription");
                }
                UUID roomUuid = UUID.fromString(message.roomId());
                yield RoomSubscription.forRoom(roomUuid, sessionId, userId);
            }
            case "all" -> RoomSubscription.forAllRooms(sessionId, userId);
            case "household" -> RoomSubscription.forHousehold(sessionId, userId);
            default -> throw new IllegalArgumentException("Invalid subscription type: " + message.subscriptionType());
        };
    }

    /**
     * Send acknowledgment message to client.
     * 
     * @param originalMessage Original subscription message
     * @param context WebSocket context
     * @return Mono<Void> representing the send operation
     */
    private Mono<Void> sendAcknowledgment(SubscribeToRoomMessage originalMessage, WebSocketContext context) {
        AckMessage ackMessage = new AckMessage(
            "ACK",
            originalMessage.messageId(),
            "SUBSCRIBE_TO_ROOM",
            "Subscription successful"
        );
        
        return sendMessage(ackMessage, context);
    }

    /**
     * Send error message to client.
     * 
     * @param originalMessage Original subscription message
     * @param context WebSocket context
     * @param errorDescription Error description
     * @return Mono<Void> representing the send operation
     */
    private Mono<Void> sendError(SubscribeToRoomMessage originalMessage, WebSocketContext context, String errorDescription) {
        ErrorMessage errorMessage = new ErrorMessage(
            "ERROR",
            originalMessage.messageId(),
            "SUBSCRIBE_TO_ROOM",
            errorDescription
        );
        
        return sendMessage(errorMessage, context);
    }

    /**
     * Send a message through the WebSocket session.
     * 
     * @param message Message to send
     * @param context WebSocket context
     * @return Mono<Void> representing the send operation
     */
    private Mono<Void> sendMessage(Object message, WebSocketContext context) {
        try {
            String json = objectMapper.writeValueAsString(message);
            return context.session().send(Mono.just(context.session().textMessage(json)))
                .doOnError(e -> log.error("Failed to send message to session {}", context.session().getId(), e))
                .onErrorResume(e -> Mono.empty());
        } catch (Exception e) {
            log.error("Failed to serialize message", e);
            return Mono.empty();
        }
    }
}