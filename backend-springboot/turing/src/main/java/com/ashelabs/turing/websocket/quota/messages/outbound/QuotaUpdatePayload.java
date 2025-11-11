package com.ashelabs.turing.websocket.quota.messages.outbound;

public record QuotaUpdatePayload(
        String quotaId,
        String familyMemberId,
        String roomId,
        double currentUsage,
        double dailyLimit,
        String status,
        boolean isCurrentlyActive,
        String sessionStartTime,
        double estimatedSessionUsage,
        String lastUpdated
) {}
