package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to set air conditioner swing/vane position.
 *
 * @param type Message type identifier ("SET_SWING")
 * @param swing Swing position: "auto", "1", "2", "3", "4", "5", "swing"
 */
public record SetSwingMessage(
    String type,
    String swing
) implements AirConditionerInboundMessage {
}
