package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * WebSocket message for unsubscribing from room updates.
 * 
 * This message allows clients to unsubscribe from specific room updates
 * or all room updates.
 *
 * @param type Message type identifier ("UNSUBSCRIBE_FROM_ROOM")
 * @param roomId Room ID to unsubscribe from (null for all rooms)
 * @param subscriptionType Type of subscription to remove ("room", "all", "household")
 * @param messageId Unique message ID for correlation
 */
public record UnsubscribeFromRoomMessage(
    String type,
    String roomId,
    String subscriptionType,
    String messageId
) implements AirConditionerInboundMessage {
    
    /**
     * Factory method for room-specific unsubscription.
     * 
     * @param roomId Room ID to unsubscribe from
     * @param messageId Message ID for correlation
     * @return UnsubscribeFromRoomMessage instance
     */
    public static UnsubscribeFromRoomMessage fromRoom(String roomId, String messageId) {
        return new UnsubscribeFromRoomMessage("UNSUBSCRIBE_FROM_ROOM", roomId, "room", messageId);
    }
    
    /**
     * Factory method for all-rooms unsubscription.
     * 
     * @param messageId Message ID for correlation
     * @return UnsubscribeFromRoomMessage instance
     */
    public static UnsubscribeFromRoomMessage fromAllRooms(String messageId) {
        return new UnsubscribeFromRoomMessage("UNSUBSCRIBE_FROM_ROOM", null, "all", messageId);
    }
    
    /**
     * Factory method for household unsubscription.
     * 
     * @param messageId Message ID for correlation
     * @return UnsubscribeFromRoomMessage instance
     */
    public static UnsubscribeFromRoomMessage fromHousehold(String messageId) {
        return new UnsubscribeFromRoomMessage("UNSUBSCRIBE_FROM_ROOM", null, "household", messageId);
    }
}