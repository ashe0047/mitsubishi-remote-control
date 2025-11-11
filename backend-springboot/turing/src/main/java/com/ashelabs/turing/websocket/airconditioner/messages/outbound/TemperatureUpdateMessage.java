package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Room temperature update message.
 *
 * @param type Message type identifier ("TEMPERATURE_UPDATE")
 * @param payload Temperature update payload with current reading
 */
public record TemperatureUpdateMessage(
    String type,
    TemperatureUpdatePayload payload
) implements AirConditionerOutboundMessage {
}
