package com.ashelabs.turing.websocket.quota.command;

import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.inbound.SubscribeMessage;
import com.ashelabs.turing.websocket.quota.messages.outbound.QuotaUpdateMessage;
import com.ashelabs.turing.websocket.session.WebSocketSessionManager;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

/**
 * Command to handle quota subscription requests.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscribeQuotaCommand implements WebSocketCommand<SubscribeMessage> {

    private final WebSocketSessionManager sessionManager;
    private final Sinks.Many<QuotaUpdateMessage> quotaUpdateSink;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> execute(SubscribeMessage message, WebSocketContext context) {
        String quotaId = message.quotaId();
        log.info("Client subscribed to quota: quotaId={}, familyMemberId={}, roomId={}",
                quotaId, context.familyMemberId(), context.roomId());

        // Subscribe to quota updates for this specific quota
        Disposable subscription = quotaUpdateSink.asFlux()
                .filter(update -> quotaId.equals(update.payload().quotaId()))
                .subscribe(update -> {
                    try {
                        String json = objectMapper.writeValueAsString(update);
                        context.session().send(Flux.just(context.session().textMessage(json))).subscribe();
                    } catch (JsonProcessingException e) {
                        log.error("Error serializing quota update", e);
                    }
                });

        sessionManager.addSubscription(context.sessionId(), "quota:" + quotaId, subscription);
        return Mono.empty();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SubscribeMessage;
    }
}
