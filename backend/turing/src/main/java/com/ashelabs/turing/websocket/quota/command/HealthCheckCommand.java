package com.ashelabs.turing.websocket.quota.command;

import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.inbound.HealthCheckMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;

/**
 * Command to handle health check and ping requests.
 */
@Slf4j
@Component
public class HealthCheckCommand implements WebSocketCommand<HealthCheckMessage> {

    @Override
    public Mono<Void> execute(HealthCheckMessage message, WebSocketContext context) {
        log.debug("Handling health check: {} with ID: {}", message.requestType(), message.messageId());

        try {
            String response = buildHealthCheckResponse(message);
            return context.session()
                    .send(Flux.just(context.session().textMessage(response)))
                    .then();
        } catch (Exception e) {
            log.error("Error handling health check for request: {} with ID: {}",
                    message.requestType(), message.messageId(), e);
            return Mono.empty();
        }
    }

    private String buildHealthCheckResponse(HealthCheckMessage message) {
        if ("mqtt.status".equals(message.requestType())) {
            return String.format(
                    "{\"id\":\"%s\",\"type\":\"response\",\"request\":\"mqtt.status\",\"response\":{\"status\":\"connected\",\"timestamp\":\"%s\"}}",
                    message.messageId() != null ? message.messageId() : "unknown",
                    Instant.now().toString()
            );
        } else if ("ping".equals(message.requestType())) {
            return String.format(
                    "{\"id\":\"%s\",\"type\":\"pong\",\"timestamp\":\"%s\"}",
                    message.messageId() != null ? message.messageId() : "unknown",
                    Instant.now().toString()
            );
        } else {
            return String.format(
                    "{\"id\":\"%s\",\"type\":\"error\",\"message\":\"Unknown request type: %s\"}",
                    message.messageId() != null ? message.messageId() : "unknown",
                    message.requestType()
            );
        }
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof HealthCheckMessage;
    }
}
