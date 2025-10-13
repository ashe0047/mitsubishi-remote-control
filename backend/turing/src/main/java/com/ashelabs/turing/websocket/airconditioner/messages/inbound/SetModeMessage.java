package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to set air conditioner operating mode.
 *
 * @param type Message type identifier ("SET_MODE")
 * @param mode Operating mode: "cool", "heat", "fan", "dry", "auto"
 */
public record SetModeMessage(
    String type,
    String mode
) implements AirConditionerInboundMessage {
}
