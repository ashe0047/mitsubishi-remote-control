package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.websocket.airconditioner.messages.inbound.UnsubscribeFromRoomMessage;
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

import java.util.Set;
import java.util.UUID;

/**
 * Command to handle room unsubscription requests.
 * 
 * This command processes UNSUBSCRIBE_FROM_ROOM messages and removes
 * WebSocket subscriptions for room status updates.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UnsubscribeFromRoomCommand implements WebSocketCommand<UnsubscribeFromRoomMessage> {

    private final EnhancedWebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> execute(UnsubscribeFromRoomMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String sessionId = context.session().getId();
            String userId = context.familyMemberId();
            
            log.debug("Processing room unsubscription request: {} for session {}", message, sessionId);

            try {
                int removedCount = removeSubscriptions(message, sessionId, userId);
                
                if (removedCount > 0) {
                    log.info("Successfully removed {} subscription(s) for session {}", removedCount, sessionId);
                    return sendAcknowledgment(message, context, removedCount);
                } else {
                    log.warn("No matching subscriptions found for session {}", sessionId);
                    return sendError(message, context, "No matching subscriptions found");
                }
                
            } catch (Exception e) {
                log.error("Error processing unsubscription request for session {}", sessionId, e);
                return sendError(message, context, "Invalid unsubscription request: " + e.getMessage());
            }
        });
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof UnsubscribeFromRoomMessage;
    }

    /**
     * Remove subscriptions matching the unsubscription request.
     * 
     * @param message Unsubscription message
     * @param sessionId WebSocket session ID
     * @param userId User ID
     * @return Number of subscriptions removed
     */
    private int removeSubscriptions(UnsubscribeFromRoomMessage message, String sessionId, String userId) {
        Set<RoomSubscription> existingSubscriptions = sessionRegistry.getSubscriptionsForSession(sessionId);
        int removedCount = 0;

        for (RoomSubscription subscription : existingSubscriptions) {
            if (shouldRemoveSubscription(subscription, message)) {
                boolean removed = sessionRegistry.removeSubscription(sessionId, subscription);
                if (removed) {
                    removedCount++;
                    log.debug("Removed subscription: {}", subscription);
                }
            }
        }

        return removedCount;
    }

    /**
     * Check if a subscription should be removed based on the unsubscription message.
     * 
     * @param subscription Existing subscription
     * @param message Unsubscription message
     * @return true if subscription should be removed
     */
    private boolean shouldRemoveSubscription(RoomSubscription subscription, UnsubscribeFromRoomMessage message) {
        return switch (message.subscriptionType().toLowerCase()) {
            case "room" -> {
                if (message.roomId() == null || message.roomId().isBlank()) {
                    yield false;
                }
                UUID roomUuid = UUID.fromString(message.roomId());
                yield subscription.isRoomSpecific() && roomUuid.equals(subscription.getRoomId());
            }
            case "all", "household" -> subscription.isAllRooms();
            default -> false;
        };
    }

    /**
     * Send acknowledgment message to client.
     * 
     * @param originalMessage Original unsubscription message
     * @param context WebSocket context
     * @param removedCount Number of subscriptions removed
     * @return Mono<Void> representing the send operation
     */
    private Mono<Void> sendAcknowledgment(UnsubscribeFromRoomMessage originalMessage, WebSocketContext context, int removedCount) {
        AckMessage ackMessage = new AckMessage(
            "ACK",
            originalMessage.messageId(),
            "UNSUBSCRIBE_FROM_ROOM",
            String.format("Removed %d subscription(s)", removedCount)
        );
        
        return sendMessage(ackMessage, context);
    }

    /**
     * Send error message to client.
     * 
     * @param originalMessage Original unsubscription message
     * @param context WebSocket context
     * @param errorDescription Error description
     * @return Mono<Void> representing the send operation
     */
    private Mono<Void> sendError(UnsubscribeFromRoomMessage originalMessage, WebSocketContext context, String errorDescription) {
        ErrorMessage errorMessage = new ErrorMessage(
            "ERROR",
            originalMessage.messageId(),
            "UNSUBSCRIBE_FROM_ROOM",
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