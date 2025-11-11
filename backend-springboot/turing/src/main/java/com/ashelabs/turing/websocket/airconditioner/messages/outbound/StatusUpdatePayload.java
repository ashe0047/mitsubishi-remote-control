package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

/**
 * Payload for status update message containing current air conditioner settings.
 *
 * @param roomId Room identifier
 * @param mode Operating mode
 * @param targetTemperature Target temperature in Celsius
 * @param fanSpeed Fan speed setting
 * @param power Power state (true = on, false = off)
 * @param swing Swing/vane position
 */
public record StatusUpdatePayload(
    String roomId,
    String mode,
    double targetTemperature,
    String fanSpeed,
    boolean power,
    String swing
) {
}
