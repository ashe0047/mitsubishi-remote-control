package com.ashelabs.turing.websocket.core;

import com.ashelabs.turing.websocket.session.WebSocketSessionManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;

/**
 * Base WebSocket handler implementing Template Method pattern.
 *
 * <p>Defines standard WebSocket handling workflow:
 * <ol>
 *   <li>Create Context - Extract parameters and create context (hook method)</li>
 *   <li>Setup Session - Register in session manager (invariant)</li>
 *   <li>Process Session - Custom message processing (hook method)</li>
 *   <li>Cleanup - Remove session on disconnect (invariant)</li>
 * </ol>
 *
 * <p><strong>Note</strong>: JWT authentication is handled by WebSocketJwtAuthHandler decorator.
 * User info is available in session.getAttributes() as "userId", "householdId", "userRole", "userInfo".
 *
 * <p><strong>Subclasses</strong> must implement:
 * <ul>
 *   <li>{@link #processSession(WebSocketContext)} - Custom processing logic</li>
 *   <li>{@link #createContext(WebSocketSession)} - Context creation</li>
 * </ul>
 *
 * <p><strong>Design Pattern</strong>: Template Method
 * <p><strong>SOLID Compliance</strong>:
 * <ul>
 *   <li>SRP: Only manages WebSocket lifecycle</li>
 *   <li>OCP: Open for extension (hook methods), closed for modification (final methods)</li>
 *   <li>LSP: All subclasses can substitute this base class</li>
 * </ul>
 */
@Slf4j
public abstract class BaseWebSocketHandler implements WebSocketHandler {

    @Autowired
    protected WebSocketSessionManager sessionManager;

    /**
     * Template Method - defines the WebSocket handling workflow.
     *
     * <p>This method is FINAL - subclasses cannot override the workflow.
     *
     * @param session WebSocket session from Spring WebFlux
     * @return Mono that completes when session ends
     */
    @Override
    public final Mono<Void> handle(WebSocketSession session) {
        log.debug("WebSocket connection initiated: {}", session.getId());

        return Mono.fromCallable(() -> createContext(session))
            .flatMap(this::setupSession)
            .flatMap(this::processSession)
            .doOnError(e -> log.error("WebSocket error for session {}", session.getId(), e))
            .onErrorResume(e -> {
                log.error("Fatal WebSocket error, closing session {}", session.getId(), e);
                return Mono.empty();
            })
            .doFinally(signal -> {
                log.debug("WebSocket connection terminated: {} (signal: {})", session.getId(), signal);
                cleanupSession(session);
            });
    }

    // ========== Invariant Steps (FINAL methods - cannot be overridden) ==========

    /**
     * Setup session - register in session manager.
     *
     * @param context WebSocket context
     * @return Mono with same context (pass-through)
     */
    private Mono<WebSocketContext> setupSession(WebSocketContext context) {
        return Mono.fromRunnable(() -> {
            sessionManager.registerSession(context.session());
            log.debug("Registered session {} in session manager", context.sessionId());
            log.info("WebSocket session {} set up for user {} (room: {})",
                context.sessionId(), context.familyMemberId(), context.roomId());
        }).thenReturn(context);
    }

    /**
     * Cleanup session - remove from session manager.
     *
     * @param session WebSocket session
     */
    private void cleanupSession(WebSocketSession session) {
        sessionManager.cleanupSession(session.getId());
        log.debug("Cleaned up session {}", session.getId());
    }

    // ========== Hook Methods (ABSTRACT - must be implemented by subclasses) ==========

    /**
     * Process WebSocket session - custom implementation per endpoint.
     *
     * <p>This is the main hook method where subclasses implement:
     * <ul>
     *   <li>Inbound message processing</li>
     *   <li>Outbound message streaming</li>
     *   <li>Bidirectional communication setup</li>
     * </ul>
     *
     * @param context WebSocket context with session and authentication info
     * @return Mono that completes when processing ends
     */
    protected abstract Mono<Void> processSession(WebSocketContext context);

    /**
     * Create WebSocket context from session.
     *
     * <p>Extract query parameters, session attributes (user info from JWT),
     * and any other endpoint-specific information to create the context.
     *
     * <p>JWT authentication is already completed by WebSocketJwtAuthHandler decorator.
     * User info is available in session attributes:
     * <ul>
     *   <li>userId - from session.getAttributes().get("userId")</li>
     *   <li>householdId - from session.getAttributes().get("householdId")</li>
     *   <li>userRole - from session.getAttributes().get("userRole")</li>
     *   <li>userInfo - full JwtUserInfo object</li>
     * </ul>
     *
     * @param session WebSocket session (already authenticated)
     * @return WebSocket context for this endpoint
     */
    protected abstract WebSocketContext createContext(WebSocketSession session);
}
