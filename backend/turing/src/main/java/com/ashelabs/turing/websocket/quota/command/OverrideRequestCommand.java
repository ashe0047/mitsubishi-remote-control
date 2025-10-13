package com.ashelabs.turing.websocket.quota.command;

import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.inbound.OverrideRequestInbound;
import com.ashelabs.turing.websocket.quota.messages.outbound.OverrideRequestMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.OverrideRequestPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Instant;
import java.util.UUID;

/**
 * Command to handle quota override requests from family members.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OverrideRequestCommand implements WebSocketCommand<OverrideRequestInbound> {

    private final Sinks.Many<OverrideRequestMessage> overrideRequestSink;

    @Override
    public Mono<Void> execute(OverrideRequestInbound message, WebSocketContext context) {
        log.info("Processing override request: quotaId={}, type={}, familyMemberId={}",
                message.quotaId(), message.requestType(), context.familyMemberId());

        String requestId = UUID.randomUUID().toString();
        OverrideRequestMessage overrideMsg = new OverrideRequestMessage(
                "OVERRIDE_REQUEST",
                new OverrideRequestPayload(
                        requestId,
                        message.quotaId(),
                        context.familyMemberId(),
                        "pending",
                        message.requestType(),
                        message.duration(),
                        message.reason(),
                        message.urgency(),
                        Instant.now().toString(),
                        null,
                        null,
                        null
                )
        );

        overrideRequestSink.tryEmitNext(overrideMsg);
        return Mono.empty();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof OverrideRequestInbound;
    }
}
