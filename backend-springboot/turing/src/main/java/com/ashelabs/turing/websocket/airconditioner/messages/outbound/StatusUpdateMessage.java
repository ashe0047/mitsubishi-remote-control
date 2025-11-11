package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Current air conditioner status update message.
 *
 * @param type Message type identifier ("STATUS_UPDATE")
 * @param payload Status update payload with current settings
 */
public record StatusUpdateMessage(
    String type,
    StatusUpdatePayload payload
) implements AirConditionerOutboundMessage {
}
