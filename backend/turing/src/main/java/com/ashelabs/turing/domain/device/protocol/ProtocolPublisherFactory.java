package com.ashelabs.turing.domain.device.protocol;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Factory for resolving protocol publishers by protocol name.
 * Enables runtime protocol selection based on device or system configuration.
 */
@Component
public class ProtocolPublisherFactory {

    private final Map<String, ProtocolPublisher> publishers;

    public ProtocolPublisherFactory(Map<String, ProtocolPublisher> publishers) {
        this.publishers = publishers;
    }

    /**
     * Get protocol publisher by bean name.
     *
     * @param protocolName Bean name (e.g., "mqttProtocolPublisher", "httpProtocolPublisher")
     * @return ProtocolPublisher implementation
     * @throws IllegalArgumentException if protocol not found
     */
    public ProtocolPublisher getPublisher(String protocolName) {
        ProtocolPublisher publisher = publishers.get(protocolName);
        if (publisher == null) {
            throw new IllegalArgumentException("No protocol publisher found for: " + protocolName);
        }
        return publisher;
    }

    /**
     * Get default protocol publisher (MQTT).
     *
     * @return Default ProtocolPublisher
     */
    public ProtocolPublisher getDefaultPublisher() {
        return getPublisher("mqttProtocolPublisher");
    }
}
