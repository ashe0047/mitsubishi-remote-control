package com.ashelabs.turing.websocket.quota.messages.outbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaOutboundMessage;

public record OverrideRequestMessage(
        String type,
        OverrideRequestPayload payload
) implements QuotaOutboundMessage {}
