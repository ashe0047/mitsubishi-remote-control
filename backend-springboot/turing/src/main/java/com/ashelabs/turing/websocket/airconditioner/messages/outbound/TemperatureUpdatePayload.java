package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

/**
 * Payload for temperature update message containing room temperature reading.
 *
 * @param roomId Room identifier
 * @param currentTemperature Current room temperature in Celsius
 * @param timestamp Unix timestamp of temperature reading
 */
public record TemperatureUpdatePayload(
    String roomId,
    double currentTemperature,
    long timestamp
) {
}
