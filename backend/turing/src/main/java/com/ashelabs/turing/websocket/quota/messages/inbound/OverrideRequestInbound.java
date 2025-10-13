package com.ashelabs.turing.websocket.quota.messages.inbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;

public record OverrideRequestInbound(
        String quotaId,
        String requestType,
        int duration,
        String reason,
        String urgency
) implements QuotaInboundMessage {}
