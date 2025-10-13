package com.ashelabs.turing.websocket.quota.messages.outbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaOutboundMessage;

public record QuotaUpdateMessage(
        String type,
        QuotaUpdatePayload payload
) implements QuotaOutboundMessage {}
