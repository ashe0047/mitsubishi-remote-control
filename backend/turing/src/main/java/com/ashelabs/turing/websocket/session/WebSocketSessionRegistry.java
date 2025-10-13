package com.ashelabs.turing.websocket.session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketMessage;
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
 *
 * Thread-safe implementation using concurrent collections.
 */
@Component
public class WebSocketSessionRegistry {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketSessionRegistry.class);

    // roomId -> Set of WebSocket sessions
    private final Map<UUID, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    /**
     * Register a WebSocket session for a room.
     *
     * @param roomId Room UUID
     * @param session WebSocket session
     */
    public void registerSession(UUID roomId, WebSocketSession session) {
        roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>())
            .add(session);

        logger.debug("Registered session {} for room {}", session.getId(), roomId);
    }

    /**
     * Unregister a WebSocket session.
     *
     * @param roomId Room UUID
     * @param session WebSocket session
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
     *
     * @param roomId Room UUID
     * @param message Message to broadcast
     */
    public void broadcastToRoom(UUID roomId, String message) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);

        if (sessions == null || sessions.isEmpty()) {
            logger.debug("No active sessions for room {}", roomId);
            return;
        }

        logger.debug("Broadcasting to {} sessions in room {}", sessions.size(), roomId);

        sessions.forEach(session -> {
            if (session.isOpen()) {
                session.send(Mono.just(session.textMessage(message)))
                    .onErrorResume(error -> {
                        logger.error("Error sending message to session {}", session.getId(), error);
                        return Mono.empty();
                    })
                    .subscribe();
            }
        });
    }

    /**
     * Broadcast message to ALL WebSocket sessions (for device discovery).
     *
     * @param message Message to broadcast
     */
    public void broadcastToAll(String message) {
        int totalSessions = 0;

        for (Set<WebSocketSession> sessions : roomSessions.values()) {
            totalSessions += sessions.size();
            sessions.forEach(session -> {
                if (session.isOpen()) {
                    session.send(Mono.just(session.textMessage(message)))
                        .onErrorResume(error -> {
                            logger.error("Error sending discovery message to session {}", session.getId(), error);
                            return Mono.empty();
                        })
                        .subscribe();
                }
            });
        }

        logger.debug("Broadcasted discovery message to {} total sessions", totalSessions);
    }

    /**
     * Get active session count for a room.
     *
     * @param roomId Room UUID
     * @return Number of active sessions
     */
    public int getSessionCount(UUID roomId) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        return sessions != null ? sessions.size() : 0;
    }

    /**
     * Get total active session count across all rooms.
     *
     * @return Total number of active sessions
     */
    public int getTotalSessionCount() {
        return roomSessions.values().stream()
            .mapToInt(Set::size)
            .sum();
    }
}
