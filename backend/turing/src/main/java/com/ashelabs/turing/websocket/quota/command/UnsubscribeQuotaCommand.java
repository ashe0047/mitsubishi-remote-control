package com.ashelabs.turing.websocket.quota.command;

import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import com.ashelabs.turing.websocket.quota.messages.inbound.UnsubscribeMessage;
import com.ashelabs.turing.websocket.session.WebSocketSessionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Command to handle quota unsubscription requests.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UnsubscribeQuotaCommand implements WebSocketCommand<UnsubscribeMessage> {

    private final WebSocketSessionManager sessionManager;

    @Override
    public Mono<Void> execute(UnsubscribeMessage message, WebSocketContext context) {
        String quotaId = message.quotaId();
        sessionManager.removeSubscription(context.sessionId(), "quota:" + quotaId);
        log.info("Client unsubscribed from quota: {}", quotaId);
        return Mono.empty();
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof UnsubscribeMessage;
    }
}
