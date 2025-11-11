package com.ashelabs.turing.websocket.session;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.Disposable;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Manages WebSocket session lifecycle and subscription tracking.
 * Provides centralized session storage and cleanup operations.
 */
@Slf4j
@Component
public class WebSocketSessionManager {

    private final ConcurrentMap<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ConcurrentMap<String, Disposable>> sessionSubscriptions = new ConcurrentHashMap<>();

    /**
     * Registers a new WebSocket session.
     *
     * @param session the WebSocket session to register
     */
    public void registerSession(WebSocketSession session) {
        String sessionId = session.getId();
        activeSessions.put(sessionId, session);
        sessionSubscriptions.put(sessionId, new ConcurrentHashMap<>());
        log.info("Registered WebSocket session: {}", sessionId);
    }

    /**
     * Retrieves an active session by ID.
     *
     * @param sessionId the session ID
     * @return the WebSocket session, or null if not found
     */
    public WebSocketSession getSession(String sessionId) {
        return activeSessions.get(sessionId);
    }

    /**
     * Adds a subscription to a session.
     *
     * @param sessionId the session ID
     * @param subscriptionKey the subscription identifier (e.g., "quota:123")
     * @param disposable the subscription disposable
     */
    public void addSubscription(String sessionId, String subscriptionKey, Disposable disposable) {
        ConcurrentMap<String, Disposable> subscriptions = sessionSubscriptions.get(sessionId);
        if (subscriptions != null) {
            subscriptions.put(subscriptionKey, disposable);
            log.debug("Added subscription '{}' to session: {}", subscriptionKey, sessionId);
        } else {
            log.warn("Attempted to add subscription to non-existent session: {}", sessionId);
        }
    }

    /**
     * Removes a specific subscription from a session.
     *
     * @param sessionId the session ID
     * @param subscriptionKey the subscription identifier
     */
    public void removeSubscription(String sessionId, String subscriptionKey) {
        ConcurrentMap<String, Disposable> subscriptions = sessionSubscriptions.get(sessionId);
        if (subscriptions != null) {
            Disposable disposable = subscriptions.remove(subscriptionKey);
            if (disposable != null && !disposable.isDisposed()) {
                disposable.dispose();
                log.debug("Removed subscription '{}' from session: {}", subscriptionKey, sessionId);
            }
        }
    }

    /**
     * Retrieves all subscriptions for a session.
     *
     * @param sessionId the session ID
     * @return map of subscription key to disposable, or null if session not found
     */
    public Map<String, Disposable> getSubscriptions(String sessionId) {
        return sessionSubscriptions.get(sessionId);
    }

    /**
     * Cleans up a session and all its subscriptions.
     *
     * @param sessionId the session ID to cleanup
     */
    public void cleanupSession(String sessionId) {
        activeSessions.remove(sessionId);
        ConcurrentMap<String, Disposable> subscriptions = sessionSubscriptions.remove(sessionId);

        if (subscriptions != null) {
            subscriptions.values().forEach(subscription -> {
                if (!subscription.isDisposed()) {
                    subscription.dispose();
                }
            });
            log.info("Cleaned up {} subscriptions for session: {}", subscriptions.size(), sessionId);
        } else {
            log.info("No subscriptions to cleanup for session: {}", sessionId);
        }
    }

    /**
     * Checks if a session is active.
     *
     * @param sessionId the session ID
     * @return true if session exists and is active
     */
    public boolean isSessionActive(String sessionId) {
        return activeSessions.containsKey(sessionId);
    }

    /**
     * Gets the count of active sessions.
     *
     * @return number of active sessions
     */
    public int getActiveSessionCount() {
        return activeSessions.size();
    }
}
