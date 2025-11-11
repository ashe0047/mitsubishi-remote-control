package com.ashelabs.turing.websocket.airconditioner.messages.inbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;

/**
 * Message to set target temperature for air conditioner.
 *
 * @param type Message type identifier ("SET_TEMPERATURE")
 * @param temperature Target temperature in Celsius (16-30°C)
 */
public record SetTemperatureMessage(
    String type,
    double temperature
) implements AirConditionerInboundMessage {
}
