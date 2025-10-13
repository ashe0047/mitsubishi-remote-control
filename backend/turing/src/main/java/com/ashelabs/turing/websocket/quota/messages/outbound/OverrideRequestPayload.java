package com.ashelabs.turing.websocket.quota.messages.outbound;

public record OverrideRequestPayload(
        String requestId,
        String quotaId,
        String familyMemberId,
        String status,
        String requestType,
        int duration,
        String reason,
        String urgency,
        String requestedAt,
        String respondedAt,
        String approvedBy,
        String responseReason
) {}
