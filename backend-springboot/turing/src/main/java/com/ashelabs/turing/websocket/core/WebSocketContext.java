package com.ashelabs.turing.websocket.core;

import org.springframework.web.reactive.socket.WebSocketSession;

/**
 * Encapsulates WebSocket session context and metadata.
 * Provides access to session information, query parameters, and session management.
 */
public record WebSocketContext(
        WebSocketSession session,
        String sessionId,
        String familyMemberId,
        String roomId,
        String quotaId
) {
    /**
     * Creates a WebSocketContext from a session and extracted parameters.
     *
     * @param session the WebSocket session
     * @param familyMemberId the family member identifier (can be null)
     * @param roomId the room identifier (can be null)
     * @param quotaId the quota identifier (can be null)
     * @return a new WebSocketContext
     */
    public static WebSocketContext create(WebSocketSession session, String familyMemberId, String roomId, String quotaId) {
        return new WebSocketContext(session, session.getId(), familyMemberId, roomId, quotaId);
    }

    /**
     * Factory method for quota endpoint context.
     *
     * @param session WebSocket session
     * @param familyMemberId User ID from JWT
     * @param roomId Room identifier
     * @param quotaId Quota identifier
     * @return Context for quota endpoint
     */
    public static WebSocketContext createForQuota(
        WebSocketSession session,
        String familyMemberId,
        String roomId,
        String quotaId
    ) {
        return new WebSocketContext(session, session.getId(), familyMemberId, roomId, quotaId);
    }

    /**
     * Factory method for air conditioner endpoint context.
     *
     * @param session WebSocket session
     * @param familyMemberId User ID from JWT
     * @param roomId Room identifier
     * @return Context for air conditioner endpoint
     */
    public static WebSocketContext createForAirConditioner(
        WebSocketSession session,
        String familyMemberId,
        String roomId
    ) {
        return new WebSocketContext(session, session.getId(), familyMemberId, roomId, null);
    }

    /**
     * Checks if this context has a family member filter.
     *
     * @return true if familyMemberId is not null
     */
    public boolean hasFamilyMemberFilter() {
        return familyMemberId != null;
    }

    /**
     * Checks if this context has a room filter.
     *
     * @return true if roomId is not null
     */
    public boolean hasRoomFilter() {
        return roomId != null;
    }

    /**
     * Checks if this context has a quota filter.
     *
     * @return true if quotaId is not null
     */
    public boolean hasQuotaFilter() {
        return quotaId != null;
    }
}
