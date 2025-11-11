package com.ashelabs.turing.websocket.session;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents a WebSocket subscription to room updates.
 * 
 * This class encapsulates the subscription details including the room being
 * subscribed to, the type of updates requested, and subscription metadata.
 */
public class RoomSubscription {
    
    private final UUID roomId;
    private final SubscriptionType subscriptionType;
    private final String sessionId;
    private final Instant subscribedAt;
    private final String userId;

    public RoomSubscription(UUID roomId, SubscriptionType subscriptionType, 
                           String sessionId, String userId) {
        this.roomId = roomId;
        this.subscriptionType = subscriptionType;
        this.sessionId = sessionId;
        this.userId = userId;
        this.subscribedAt = Instant.now();
    }

    /**
     * Factory method for room-specific subscription.
     * 
     * @param roomId Room to subscribe to
     * @param sessionId WebSocket session ID
     * @param userId User ID making the subscription
     * @return RoomSubscription instance
     */
    public static RoomSubscription forRoom(UUID roomId, String sessionId, String userId) {
        return new RoomSubscription(roomId, SubscriptionType.SPECIFIC_ROOM, sessionId, userId);
    }

    /**
     * Factory method for all-rooms subscription.
     * 
     * @param sessionId WebSocket session ID
     * @param userId User ID making the subscription
     * @return RoomSubscription instance
     */
    public static RoomSubscription forAllRooms(String sessionId, String userId) {
        return new RoomSubscription(null, SubscriptionType.ALL_ROOMS, sessionId, userId);
    }

    /**
     * Factory method for household-wide subscription.
     * 
     * @param sessionId WebSocket session ID
     * @param userId User ID making the subscription
     * @return RoomSubscription instance
     */
    public static RoomSubscription forHousehold(String sessionId, String userId) {
        return new RoomSubscription(null, SubscriptionType.HOUSEHOLD_ROOMS, sessionId, userId);
    }

    public UUID getRoomId() {
        return roomId;
    }

    public SubscriptionType getSubscriptionType() {
        return subscriptionType;
    }

    public String getSessionId() {
        return sessionId;
    }

    public Instant getSubscribedAt() {
        return subscribedAt;
    }

    public String getUserId() {
        return userId;
    }

    /**
     * Check if this subscription should receive updates for a specific room.
     * 
     * @param targetRoomId Room ID to check
     * @return true if subscription should receive updates for the room
     */
    public boolean shouldReceiveUpdatesFor(UUID targetRoomId) {
        return switch (subscriptionType) {
            case SPECIFIC_ROOM -> Objects.equals(roomId, targetRoomId);
            case ALL_ROOMS, HOUSEHOLD_ROOMS -> true;
        };
    }

    /**
     * Check if subscription is for a specific room.
     * 
     * @return true if subscription is for a specific room
     */
    public boolean isRoomSpecific() {
        return subscriptionType == SubscriptionType.SPECIFIC_ROOM;
    }

    /**
     * Check if subscription is for all rooms.
     * 
     * @return true if subscription is for all rooms
     */
    public boolean isAllRooms() {
        return subscriptionType == SubscriptionType.ALL_ROOMS || 
               subscriptionType == SubscriptionType.HOUSEHOLD_ROOMS;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RoomSubscription that = (RoomSubscription) o;
        return Objects.equals(roomId, that.roomId) &&
               subscriptionType == that.subscriptionType &&
               Objects.equals(sessionId, that.sessionId) &&
               Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(roomId, subscriptionType, sessionId, userId);
    }

    @Override
    public String toString() {
        return "RoomSubscription{" +
               "roomId=" + roomId +
               ", subscriptionType=" + subscriptionType +
               ", sessionId='" + sessionId + '\'' +
               ", userId='" + userId + '\'' +
               ", subscribedAt=" + subscribedAt +
               '}';
    }
}