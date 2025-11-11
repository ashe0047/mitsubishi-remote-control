package com.ashelabs.turing.websocket.core;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Registry for managing and executing WebSocket commands.
 * Provides centralized command lookup and execution.
 */
@Slf4j
@Component
public class CommandRegistry {

    private final List<WebSocketCommand<?>> commands = new CopyOnWriteArrayList<>();

    /**
     * Registers a command in the registry.
     *
     * @param command the command to register
     */
    public void registerCommand(WebSocketCommand<?> command) {
        commands.add(command);
        log.info("Registered command: {}", command.getClass().getSimpleName());
    }

    /**
     * Registers multiple commands in the registry.
     *
     * @param commandList the list of commands to register
     */
    public void registerCommands(List<WebSocketCommand<?>> commandList) {
        commandList.forEach(this::registerCommand);
    }

    /**
     * Executes the appropriate command for the given message.
     *
     * @param message the message to process
     * @param context the WebSocket context
     * @return Mono<Void> representing the command execution
     */
    @SuppressWarnings("unchecked")
    public Mono<Void> executeCommand(Object message, WebSocketContext context) {
        return commands.stream()
                .filter(cmd -> cmd.canHandle(message))
                .findFirst()
                .map(cmd -> ((WebSocketCommand<Object>) cmd).execute(message, context))
                .orElseGet(() -> {
                    log.warn("No command found for message type: {}", message.getClass().getSimpleName());
                    return Mono.empty();
                });
    }

    /**
     * Gets all registered commands.
     *
     * @return list of all registered commands
     */
    public List<WebSocketCommand<?>> getCommands() {
        return List.copyOf(commands);
    }

    /**
     * Clears all registered commands.
     */
    public void clearCommands() {
        commands.clear();
        log.info("Cleared all commands from registry");
    }
}
