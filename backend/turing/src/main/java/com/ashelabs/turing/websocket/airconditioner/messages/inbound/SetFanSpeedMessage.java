package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to set air conditioner fan speed.
 *
 * @param type Message type identifier ("SET_FAN_SPEED")
 * @param fanSpeed Fan speed: "low", "medium", "high", "auto"
 */
public record SetFanSpeedMessage(
    String type,
    String fanSpeed
) implements AirConditionerInboundMessage {
}
