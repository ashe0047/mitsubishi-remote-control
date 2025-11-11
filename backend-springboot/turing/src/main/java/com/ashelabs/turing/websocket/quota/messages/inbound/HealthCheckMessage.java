package com.ashelabs.turing.websocket.quota.messages.inbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;

public record HealthCheckMessage(
        String messageId,
        String requestType
) implements QuotaInboundMessage {}
