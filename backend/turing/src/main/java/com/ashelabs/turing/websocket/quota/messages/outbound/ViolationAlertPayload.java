package com.ashelabs.turing.websocket.quota.messages.outbound;

public record ViolationAlertPayload(
        String quotaId,
        String familyMemberId,
        String familyMemberName,
        String roomId,
        String roomName,
        String violationType,
        double currentUsage,
        double limit,
        String timestamp
) {}
