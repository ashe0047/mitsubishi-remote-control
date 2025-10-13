package com.ashelabs.turing.websocket.quota.command;

import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.inbound.OverrideApprovalMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.OverrideRequestMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.OverrideRequestPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Instant;

/**
 * Command to handle quota override approval/rejection from parents.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OverrideApprovalCommand implements WebSocketCommand<OverrideApprovalMessage> {

    private final Sinks.Many<OverrideRequestMessage> overrideRequestSink;

    @Override
    public Mono<Void> execute(OverrideApprovalMessage message, WebSocketContext context) {
        log.info("Processing override approval: requestId={}, approved={}, familyMemberId={}",
                message.requestId(), message.approved(), context.familyMemberId());

        String status = message.approved() ? "approved" : "rejected";
        OverrideRequestMessage updateMsg = new OverrideRequestMessage(
                "OVERRIDE_UPDATE",
                new OverrideRequestPayload(
                        message.requestId(),
                        null,  // quotaId not needed for updates
                        null,  // familyMemberId not needed for updates
                        status,
                        null,
                        0,
                        null,
                        null,
                        null,
                        Instant.now().toString(),
                        context.familyMemberId(),
                        message.reason()
                )
        );

        overrideRequestSink.tryEmitNext(updateMsg);
        return Mono.empty();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof OverrideApprovalMessage;
    }
}
