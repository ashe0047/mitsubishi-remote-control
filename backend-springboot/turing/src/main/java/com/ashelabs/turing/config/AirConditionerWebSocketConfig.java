package com.ashelabs.turing.config;

import com.ashelabs.turing.websocket.airconditioner.messages.outbound.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Sinks;

/**
 * Configuration for air conditioner WebSocket sinks.
 *
 * <p>Provides sinks as Spring beans for dependency injection.
 * Sinks are shared between MQTT subscribers and WebSocket handlers.
 */
@Configuration
public class AirConditionerWebSocketConfig {

    /**
     * Sink for status update messages (AC mode, settings).
     */
    @Bean
    public Sinks.Many<StatusUpdateMessage> statusUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    /**
     * Sink for temperature update messages (room temperature readings).
     */
    @Bean
    public Sinks.Many<TemperatureUpdateMessage> temperatureUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    /**
     * Sink for room status update messages (aggregate room status changes).
     *
     * <p>Uses replay(1) to cache the most recent message for late-subscribing clients.
     * This ensures clients connecting after MQTT messages arrive still receive the latest state.
     *
     * <p><strong>Buffer Strategy</strong>:
     * - Replay size: 1 (cache most recent message only)
     * - Backpressure: Buffer up to 1024 messages (increased from default 256)
     * - Behavior: Hot source with late subscriber support
     */
    @Bean
    public Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink() {
        return Sinks.many().replay().limit(1);
    }

    /**
     * Sink for batched room update messages (multiple room updates combined).
     */
    @Bean
    public Sinks.Many<BatchedRoomUpdateMessage> batchedRoomUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }
}
