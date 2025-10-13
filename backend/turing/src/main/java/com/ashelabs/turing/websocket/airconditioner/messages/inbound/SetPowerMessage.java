package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to turn air conditioner on or off.
 *
 * @param type Message type identifier ("SET_POWER")
 * @param power Power state: true = on, false = off
 */
public record SetPowerMessage(
    String type,
    boolean power
) implements AirConditionerInboundMessage {
}
