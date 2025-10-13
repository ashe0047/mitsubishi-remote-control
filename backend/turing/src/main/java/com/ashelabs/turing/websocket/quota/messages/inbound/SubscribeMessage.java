package com.ashelabs.turing.websocket.quota.messages.inbound;

import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;

public record SubscribeMessage(String quotaId) implements QuotaInboundMessage {}
