package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * WebSocket message for subscribing to room updates.
 * 
 * This message allows clients to subscribe to specific room updates,
 * all rooms, or household-wide updates.
 *
 * @param type Message type identifier ("SUBSCRIBE_TO_ROOM")
 * @param roomId Room ID to subscribe to (null for all rooms)
 * @param subscriptionType Type of subscription ("room", "all", "household")
 * @param messageId Unique message ID for correlation
 */
public record SubscribeToRoomMessage(
    String type,
    String roomId,
    String subscriptionType,
    String messageId
) implements AirConditionerInboundMessage {
    
    /**
     * Factory method for room-specific subscription.
     * 
     * @param roomId Room ID to subscribe to
     * @param messageId Message ID for correlation
     * @return SubscribeToRoomMessage instance
     */
    public static SubscribeToRoomMessage forRoom(String roomId, String messageId) {
        return new SubscribeToRoomMessage("SUBSCRIBE_TO_ROOM", roomId, "room", messageId);
    }
    
    /**
     * Factory method for all-rooms subscription.
     * 
     * @param messageId Message ID for correlation
     * @return SubscribeToRoomMessage instance
     */
    public static SubscribeToRoomMessage forAllRooms(String messageId) {
        return new SubscribeToRoomMessage("SUBSCRIBE_TO_ROOM", null, "all", messageId);
    }
    
    /**
     * Factory method for household subscription.
     * 
     * @param messageId Message ID for correlation
     * @return SubscribeToRoomMessage instance
     */
    public static SubscribeToRoomMessage forHousehold(String messageId) {
        return new SubscribeToRoomMessage("SUBSCRIBE_TO_ROOM", null, "household", messageId);
    }
}