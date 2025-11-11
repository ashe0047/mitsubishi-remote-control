package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import java.time.Instant;
import java.util.List;

/**
 * Payload for batched room update message.
 *
 * @param roomUpdates List of individual room status updates
 * @param updateCount Number of updates in the batch
 * @param batchTimestamp When this batch was created
 */
public record BatchedRoomUpdatePayload(
    List<RoomStatusUpdatePayload> roomUpdates,
    int updateCount,
    Instant batchTimestamp
) {}
