package com.ashelabs.turing.websocket.session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.Collectors;

/**
 * Enhanced WebSocket session registry with subscription management.
 * 
 * This registry extends the basic session tracking to support different
 * subscription types, allowing clients to subscribe to specific rooms,
 * all rooms, or household-wide updates.
 * 
 * Thread-safe implementation using concurrent collections.
 */
@Component
public class EnhancedWebSocketSessionRegistry {

    private static final Logger logger = LoggerFactory.getLogger(EnhancedWebSocketSessionRegistry.class);

    // sessionId -> WebSocket session
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    // sessionId -> Set of room subscriptions
    private final Map<String, Set<RoomSubscription>> sessionSubscriptions = new ConcurrentHashMap<>();
    
    // roomId -> Set of session IDs subscribed to this room
    private final Map<UUID, Set<String>> roomSubscribers = new ConcurrentHashMap<>();
    
    // userId -> Set of session IDs for this user
    private final Map<String, Set<String>> userSessions = new ConcurrentHashMap<>();

    /**
     * Register a WebSocket session.
     * 
     * @param session WebSocket session
     * @param userId User ID associated with the session
     */
    public void registerSession(WebSocketSession session, String userId) {
        String sessionId = session.getId();
        
        sessions.put(sessionId, session);
        sessionSubscriptions.put(sessionId, new CopyOnWriteArraySet<>());
        
        // Track user sessions
        userSessions.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>())
                   .add(sessionId);

        logger.debug("Registered WebSocket session {} for user {}", sessionId, userId);
    }

    /**
     * Unregister a WebSocket session and clean up all subscriptions.
     * 
     * @param session WebSocket session
     */
    public void unregisterSession(WebSocketSession session) {
        String sessionId = session.getId();
        
        // Remove session
        sessions.remove(sessionId);
        
        // Clean up subscriptions
        Set<RoomSubscription> subscriptions = sessionSubscriptions.remove(sessionId);
        if (subscriptions != null) {
            for (RoomSubscription subscription : subscriptions) {
                if (subscription.getRoomId() != null) {
                    Set<String> subscribers = roomSubscribers.get(subscription.getRoomId());
                    if (subscribers != null) {
                        subscribers.remove(sessionId);
                        if (subscribers.isEmpty()) {
                            roomSubscribers.remove(subscription.getRoomId());
                        }
                    }
                }
            }
        }
        
        // Clean up user sessions
        userSessions.values().forEach(userSessionSet -> userSessionSet.remove(sessionId));
        userSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        logger.debug("Unregistered WebSocket session {}", sessionId);
    }

    /**
     * Subscribe a session to room updates.
     * 
     * @param sessionId WebSocket session ID
     * @param subscription Room subscription details
     * @return true if subscription was added successfully
     */
    public boolean addSubscription(String sessionId, RoomSubscription subscription) {
        if (!sessions.containsKey(sessionId)) {
            logger.warn("Cannot add subscription for unknown session {}", sessionId);
            return false;
        }

        Set<RoomSubscription> subscriptions = sessionSubscriptions.get(sessionId);
        if (subscriptions == null) {
            logger.warn("No subscription set found for session {}", sessionId);
            return false;
        }

        boolean added = subscriptions.add(subscription);
        
        if (added && subscription.getRoomId() != null) {
            // Track room-specific subscriptions
            roomSubscribers.computeIfAbsent(subscription.getRoomId(), k -> new CopyOnWriteArraySet<>())
                          .add(sessionId);
        }

        logger.debug("Added subscription {} for session {}", subscription, sessionId);
        return added;
    }

    /**
     * Remove a subscription from a session.
     * 
     * @param sessionId WebSocket session ID
     * @param subscription Room subscription to remove
     * @return true if subscription was removed successfully
     */
    public boolean removeSubscription(String sessionId, RoomSubscription subscription) {
        Set<RoomSubscription> subscriptions = sessionSubscriptions.get(sessionId);
        if (subscriptions == null) {
            return false;
        }

        boolean removed = subscriptions.remove(subscription);
        
        if (removed && subscription.getRoomId() != null) {
            Set<String> subscribers = roomSubscribers.get(subscription.getRoomId());
            if (subscribers != null) {
                subscribers.remove(sessionId);
                if (subscribers.isEmpty()) {
                    roomSubscribers.remove(subscription.getRoomId());
                }
            }
        }

        logger.debug("Removed subscription {} from session {}", subscription, sessionId);
        return removed;
    }

    /**
     * Get all sessions subscribed to a specific room.
     * 
     * @param roomId Room UUID
     * @return Set of WebSocket sessions subscribed to the room
     */
    public Set<WebSocketSession> getSessionsForRoom(UUID roomId) {
        Set<String> subscriberIds = roomSubscribers.get(roomId);
        if (subscriberIds == null || subscriberIds.isEmpty()) {
            return Set.of();
        }

        return subscriberIds.stream()
                .map(sessions::get)
                .filter(Objects::nonNull)
                .filter(WebSocketSession::isOpen)
                .collect(Collectors.toSet());
    }

    /**
     * Get all sessions with all-rooms subscriptions.
     * 
     * @return Set of WebSocket sessions subscribed to all rooms
     */
    public Set<WebSocketSession> getSessionsForAllRooms() {
        return sessionSubscriptions.entrySet().stream()
                .filter(entry -> entry.getValue().stream()
                        .anyMatch(RoomSubscription::isAllRooms))
                .map(entry -> sessions.get(entry.getKey()))
                .filter(Objects::nonNull)
                .filter(WebSocketSession::isOpen)
                .collect(Collectors.toSet());
    }

    /**
     * Get all sessions that should receive updates for a specific room.
     * This includes both room-specific and all-rooms subscriptions.
     * 
     * @param roomId Room UUID
     * @return Set of WebSocket sessions that should receive updates
     */
    public Set<WebSocketSession> getSessionsForRoomUpdates(UUID roomId) {
        Set<WebSocketSession> result = new HashSet<>();
        
        // Add room-specific subscribers
        result.addAll(getSessionsForRoom(roomId));
        
        // Add all-rooms subscribers
        result.addAll(getSessionsForAllRooms());
        
        return result;
    }

    /**
     * Broadcast message to all sessions subscribed to a specific room.
     * 
     * @param roomId Room UUID
     * @param message Message to broadcast
     */
    public void broadcastToRoom(UUID roomId, String message) {
        Set<WebSocketSession> targetSessions = getSessionsForRoomUpdates(roomId);
        
        if (targetSessions.isEmpty()) {
            logger.debug("No active sessions for room {}", roomId);
            return;
        }

        logger.debug("Broadcasting to {} sessions for room {}", targetSessions.size(), roomId);
        
        targetSessions.forEach(session -> {
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
     * Broadcast message to all active sessions (global broadcast).
     * 
     * @param message Message to broadcast
     */
    public void broadcastToAll(String message) {
        int totalSessions = 0;

        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                totalSessions++;
                session.send(Mono.just(session.textMessage(message)))
                    .onErrorResume(error -> {
                        logger.error("Error sending global message to session {}", session.getId(), error);
                        return Mono.empty();
                    })
                    .subscribe();
            }
        }

        logger.debug("Broadcasted global message to {} sessions", totalSessions);
    }

    /**
     * Get subscription count for a specific room.
     * 
     * @param roomId Room UUID
     * @return Number of active subscriptions for the room
     */
    public int getSubscriptionCount(UUID roomId) {
        return getSessionsForRoomUpdates(roomId).size();
    }

    /**
     * Get total active session count.
     * 
     * @return Total number of active sessions
     */
    public int getTotalSessionCount() {
        return (int) sessions.values().stream()
                .filter(WebSocketSession::isOpen)
                .count();
    }

    /**
     * Get subscriptions for a specific session.
     * 
     * @param sessionId WebSocket session ID
     * @return Set of subscriptions for the session
     */
    public Set<RoomSubscription> getSubscriptionsForSession(String sessionId) {
        Set<RoomSubscription> subscriptions = sessionSubscriptions.get(sessionId);
        return subscriptions != null ? new HashSet<>(subscriptions) : Set.of();
    }

    /**
     * Check if a session has any subscriptions.
     * 
     * @param sessionId WebSocket session ID
     * @return true if session has subscriptions
     */
    public boolean hasSubscriptions(String sessionId) {
        Set<RoomSubscription> subscriptions = sessionSubscriptions.get(sessionId);
        return subscriptions != null && !subscriptions.isEmpty();
    }

    /**
     * Get all active room IDs that have subscribers.
     * 
     * @return Set of room IDs with active subscribers
     */
    public Set<UUID> getActiveRoomIds() {
        return new HashSet<>(roomSubscribers.keySet());
    }
}