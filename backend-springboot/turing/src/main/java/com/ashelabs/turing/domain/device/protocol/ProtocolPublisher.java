package com.ashelabs.turing.domain.device.protocol;

import reactor.core.publisher.Mono;

/**
 * Strategy interface for protocol-specific device command publishing.
 * Implementations provide protocol-specific logic (MQTT, HTTP, WebSocket, etc.)
 *
 * This abstraction enables the system to support multiple control protocols
 * without coupling the domain logic to any specific protocol implementation.
 */
public interface ProtocolPublisher {

    /**
     * Set target temperature for a device.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param temperature Target temperature in Celsius
     * @return Mono that completes when command is sent
     */
    Mono<Void> setTemperature(String deviceIdentifier, int temperature);

    /**
     * Set operating mode for a device.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param mode Operating mode (e.g., "heat", "cool", "auto", "dry", "fan")
     * @return Mono that completes when command is sent
     */
    Mono<Void> setMode(String deviceIdentifier, String mode);

    /**
     * Set fan speed for a device.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param fanSpeed Fan speed setting (e.g., "low", "medium", "high", "auto")
     * @return Mono that completes when command is sent
     */
    Mono<Void> setFanSpeed(String deviceIdentifier, String fanSpeed);

    /**
     * Set power state for a device.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param on Power state (true = on, false = off)
     * @return Mono that completes when command is sent
     */
    Mono<Void> setPower(String deviceIdentifier, boolean on);

    /**
     * Set vertical vane position.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param position Vane position (e.g., "auto", "swing", "1" to "5")
     * @return Mono that completes when command is sent
     */
    Mono<Void> setVanePosition(String deviceIdentifier, String position);

    /**
     * Set horizontal wide vane position.
     *
     * @param deviceIdentifier Protocol-agnostic device identifier
     * @param position Wide vane position (e.g., "auto", "swing", "<<", ">>")
     * @return Mono that completes when command is sent
     */
    Mono<Void> setWideVanePosition(String deviceIdentifier, String position);

    /**
     * Get the protocol name for logging and debugging.
     *
     * @return Protocol name (e.g., "MQTT", "HTTP", "WebSocket")
     */
    String getProtocolName();
}
