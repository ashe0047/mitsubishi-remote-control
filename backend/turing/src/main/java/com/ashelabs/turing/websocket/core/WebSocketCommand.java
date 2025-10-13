package com.ashelabs.turing.websocket.core;

import reactor.core.publisher.Mono;

/**
 * Represents a WebSocket command that can be executed.
 * Implements the Command pattern for processing WebSocket messages.
 *
 * @param <T> the type of message this command processes
 */
public interface WebSocketCommand<T> {

    /**
     * Executes the command with the given message and context.
     *
     * @param message the message to process
     * @param context the WebSocket context
     * @return Mono<Void> representing command execution
     */
    Mono<Void> execute(T message, WebSocketContext context);

    /**
     * Indicates whether this command can handle the given message type.
     *
     * @param message the message to check
     * @return true if this command can handle the message
     */
    boolean canHandle(Object message);
}
