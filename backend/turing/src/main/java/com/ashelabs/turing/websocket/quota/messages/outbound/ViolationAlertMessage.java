package com.ashelabs.turing.websocket.quota.messages.outbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaOutboundMessage;

public record ViolationAlertMessage(
        String type,
        ViolationAlertPayload payload
) implements QuotaOutboundMessage {}
