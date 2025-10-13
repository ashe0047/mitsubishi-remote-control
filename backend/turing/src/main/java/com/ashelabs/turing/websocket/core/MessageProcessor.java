package com.ashelabs.turing.websocket.core;

import reactor.core.publisher.Mono;

/**
 * Processes WebSocket messages using the Chain of Responsibility pattern.
 * Each processor can handle a message or pass it to the next processor in the chain.
 */
public interface MessageProcessor {

    /**
     * Processes a WebSocket message with the given context.
     *
     * @param message the message to process
     * @param context the WebSocket context
     * @return Mono<Void> representing the processing result
     */
    Mono<Void> process(Object message, WebSocketContext context);

    /**
     * Checks if this processor can handle the given message.
     *
     * @param message the message to check
     * @return true if this processor can handle the message
     */
    boolean canProcess(Object message);

    /**
     * Sets the next processor in the chain.
     *
     * @param next the next processor
     */
    void setNext(MessageProcessor next);
}
