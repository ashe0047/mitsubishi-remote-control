package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

import java.time.Instant;
import java.util.List;

/**
 * Batched room update message for efficient WebSocket communication.
 * 
 * This message combines multiple room status updates into a single WebSocket
 * message to reduce network overhead when multiple devices change status
 * simultaneously.
 *
 * @param type Message type identifier ("BATCHED_ROOM_UPDATE")
 * @param payload Batched update payload with multiple room updates
 */
public record BatchedRoomUpdateMessage(
    String type,
    BatchedRoomUpdatePayload payload
) implements AirConditionerOutboundMessage {
    
    /**
     * Factory method to create batched room update message.
     * 
     * @param roomUpdates List of room status updates to batch
     * @return BatchedRoomUpdateMessage instance
     */
    public static BatchedRoomUpdateMessage create(List<RoomStatusUpdatePayload> roomUpdates) {
        BatchedRoomUpdatePayload payload = new BatchedRoomUpdatePayload(
            roomUpdates,
            roomUpdates.size(),
            Instant.now()
        );
        return new BatchedRoomUpdateMessage("BATCHED_ROOM_UPDATE", payload);
    }
}