package com.ashelabs.turing.service;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Event published when a quota violation needs to be broadcast via WebSocket.
 */
@Getter
public class QuotaViolationEvent extends ApplicationEvent {
    
    private final String quotaId;
    private final String familyMemberId;
    private final String familyMemberName;
    private final String roomId;
    private final String roomName;
    private final String violationType;
    private final double currentUsage;
    private final double limit;
    
    public QuotaViolationEvent(Object source, String quotaId, String familyMemberId, String familyMemberName,
                              String roomId, String roomName, String violationType, 
                              double currentUsage, double limit) {
        super(source);
        this.quotaId = quotaId;
        this.familyMemberId = familyMemberId;
        this.familyMemberName = familyMemberName;
        this.roomId = roomId;
        this.roomName = roomName;
        this.violationType = violationType;
        this.currentUsage = currentUsage;
        this.limit = limit;
    }
}