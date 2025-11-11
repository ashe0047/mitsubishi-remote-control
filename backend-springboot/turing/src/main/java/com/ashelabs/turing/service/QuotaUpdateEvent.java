package com.ashelabs.turing.service;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Event published when quota usage data needs to be broadcast via WebSocket.
 */
@Getter
public class QuotaUpdateEvent extends ApplicationEvent {
    
    private final String quotaId;
    private final String familyMemberId;
    private final String roomId;
    private final double currentUsage;
    private final double dailyLimit;
    private final String status;
    private final boolean isCurrentlyActive;
    private final double estimatedSessionUsage;
    
    public QuotaUpdateEvent(Object source, String quotaId, String familyMemberId, String roomId,
                           double currentUsage, double dailyLimit, String status, 
                           boolean isCurrentlyActive, double estimatedSessionUsage) {
        super(source);
        this.quotaId = quotaId;
        this.familyMemberId = familyMemberId;
        this.roomId = roomId;
        this.currentUsage = currentUsage;
        this.dailyLimit = dailyLimit;
        this.status = status;
        this.isCurrentlyActive = isCurrentlyActive;
        this.estimatedSessionUsage = estimatedSessionUsage;
    }
}