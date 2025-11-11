package com.ashelabs.turing.websocket.core;

import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

/**
 * Abstract base class for MessageProcessors implementing the Chain of Responsibility pattern.
 * Provides common chain handling logic.
 */
@Slf4j
public abstract class AbstractMessageProcessor implements MessageProcessor {

    protected MessageProcessor next;

    @Override
    public void setNext(MessageProcessor next) {
        this.next = next;
    }

    @Override
    public Mono<Void> process(Object message, WebSocketContext context) {
        if (canProcess(message)) {
            log.debug("Processor {} handling message type: {}",
                    this.getClass().getSimpleName(),
                    message.getClass().getSimpleName());
            return handleMessage(message, context);
        } else if (next != null) {
            return next.process(message, context);
        } else {
            log.warn("No processor found for message type: {}", message.getClass().getSimpleName());
            return Mono.empty();
        }
    }

    /**
     * Template method for handling messages.
     * Subclasses implement this to provide specific handling logic.
     *
     * @param message the message to handle
     * @param context the WebSocket context
     * @return Mono<Void> representing the handling result
     */
    protected abstract Mono<Void> handleMessage(Object message, WebSocketContext context);
}
