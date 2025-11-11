package com.ashelabs.turing.websocket.quota.processor;

import com.ashelabs.turing.websocket.core.AbstractMessageProcessor;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Processes quota-related WebSocket messages by delegating to appropriate commands.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuotaMessageProcessor extends AbstractMessageProcessor {

    private final List<WebSocketCommand<?>> commands;

    @Override
    public boolean canProcess(Object message) {
        return message instanceof QuotaInboundMessage;
    }

    @Override
    @SuppressWarnings("unchecked")
    protected Mono<Void> handleMessage(Object message, WebSocketContext context) {
        return commands.stream()
                .filter(cmd -> cmd.canHandle(message))
                .findFirst()
                .map(cmd -> ((WebSocketCommand<Object>) cmd).execute(message, context))
                .orElseGet(() -> {
                    log.warn("No command found for message type: {}", message.getClass().getSimpleName());
                    return Mono.empty();
                });
    }
}
