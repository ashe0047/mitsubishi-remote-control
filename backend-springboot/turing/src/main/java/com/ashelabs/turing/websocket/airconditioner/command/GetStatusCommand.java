package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.service.ReactiveAirConService;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.GetStatusMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Command to handle air conditioner status request.
 *
 * <p>Retrieves current AC status from ReactiveAirConService.
 * Note: Status is typically sent via outbound stream rather than direct response.
 *
 * <p><strong>Single Responsibility</strong>: Handle GET_STATUS messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GetStatusCommand implements WebSocketCommand<GetStatusMessage> {

    private final ReactiveAirConService airConService;

    @Override
    public Mono<Void> execute(GetStatusMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String roomId = context.roomId();

            log.debug("Getting status for room {}", roomId);

            // Get current state and settings (triggers update via stream)
            return Mono.when(
                airConService.getRoomState(roomId)
                    .doOnNext(state -> log.debug("Retrieved state for room {}: {}", roomId, state)),
                airConService.getRoomSettings(roomId)
                    .doOnNext(settings -> log.debug("Retrieved settings for room {}: {}", roomId, settings))
            )
            .doOnSuccess(v -> log.info("Successfully retrieved status for room {}", roomId))
            .then();
        })
        .doOnError(e -> log.error("Failed to get status for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof GetStatusMessage;
    }
}
