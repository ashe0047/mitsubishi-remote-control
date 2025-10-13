package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to request current air conditioner status.
 *
 * @param type Message type identifier ("GET_STATUS")
 */
public record GetStatusMessage(
    String type
) implements AirConditionerInboundMessage {
}
