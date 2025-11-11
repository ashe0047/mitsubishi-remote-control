package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Room-level status update message for unified room API.
 * 
 * This message is sent when the aggregate status of a room changes,
 * such as when devices come online/offline or their status changes.
 *
 * @param type Message type identifier ("ROOM_STATUS_UPDATE")
 * @param payload Room status update payload with aggregate information
 */
public record RoomStatusUpdateMessage(
    String type,
    RoomStatusUpdatePayload payload
) implements AirConditionerOutboundMessage {
    
    /**
     * Factory method to create room status update message.
     * 
     * @param payload Room status update payload
     * @return RoomStatusUpdateMessage instance
     */
    public static RoomStatusUpdateMessage create(RoomStatusUpdatePayload payload) {
        return new RoomStatusUpdateMessage("ROOM_STATUS_UPDATE", payload);
    }
}