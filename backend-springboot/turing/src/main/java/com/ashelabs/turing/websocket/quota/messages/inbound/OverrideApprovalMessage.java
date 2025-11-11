package com.ashelabs.turing.websocket.quota.messages.inbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;

public record OverrideApprovalMessage(
        String requestId,
        boolean approved,
        String reason
) implements QuotaInboundMessage {}
