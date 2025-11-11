package com.ashelabs.turing.config;

import com.ashelabs.turing.websocket.quota.messages.outbound.OverrideRequestMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.QuotaUpdateMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.ViolationAlertMessage;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Sinks;

/**
 * Configuration for Quota WebSocket components.
 * Provides sinks as Spring beans for dependency injection.
 */
@Configuration
public class QuotaWebSocketConfig {

    @Bean
    public Sinks.Many<QuotaUpdateMessage> quotaUpdateSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    @Bean
    public Sinks.Many<ViolationAlertMessage> violationAlertSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }

    @Bean
    public Sinks.Many<OverrideRequestMessage> overrideRequestSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }
}
