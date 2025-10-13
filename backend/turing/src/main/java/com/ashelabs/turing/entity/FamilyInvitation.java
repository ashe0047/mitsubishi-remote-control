package com.ashelabs.turing.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity representing a family invitation sent to prospective family members.
 * Used for managing invitation lifecycle from creation to acceptance/decline.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table("family_invitations")
public class FamilyInvitation extends BaseEntity {
    /**
     * The household that the invitation is for
     */
    @Column("household_id")
    private UUID householdId;

    /**
     * The user who sent the invitation (parent/admin)
     */
    @Column("invited_by_user_id")
    private UUID invitedByUserId;

    /**
     * Email address of the person being invited
     */
    @Column("email")
    private String email;

    /**
     * Name of the person being invited
     */
    @Column("name")
    private String name;

    /**
     * Role to assign to the invited user when they accept
     */
    @Column("role")
    private UserRole role;

    /**
     * Unique token for invitation validation and acceptance
     */
    @Column("token")
    private String token;

    /**
     * Current status of the invitation
     */
    @Column("status")
    private InvitationStatus status;

    /**
     * When the invitation was sent
     */
    @Column("sent_at")
    private Instant sentAt;

    /**
     * When the invitation expires
     */
    @Column("expires_at")
    private Instant expiresAt;

    /**
     * When the invitation was accepted (if applicable)
     */
    @Column("accepted_at")
    private Instant acceptedAt;

    /**
     * When the invitation was declined (if applicable)
     */
    @Column("declined_at")
    private Instant declinedAt;

    /**
     * The user ID created when invitation is accepted
     */
    @Column("accepted_user_id")
    private UUID acceptedUserId;

    /**
     * Number of times the invitation has been resent
     */
    @Column("resend_count")
    @Builder.Default
    private Integer resendCount = 0;

    /**
     * Additional message included with the invitation
     */
    @Column("message")
    private String message;

    /**
     * Check if the invitation is still valid (not expired and pending)
     */
    public boolean isValid() {
        return status == InvitationStatus.pending &&
                expiresAt != null &&
                expiresAt.isAfter(Instant.now());
    }

    /**
     * Check if the invitation has expired
     */
    public boolean isExpired() {
        return expiresAt != null && expiresAt.isBefore(Instant.now());
    }

    /**
     * Mark invitation as sent
     */
    public void markAsSent() {
        this.status = InvitationStatus.pending;
        this.sentAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    /**
     * Mark invitation as accepted
     */
    public void markAsAccepted(UUID acceptedUserId) {
        this.status = InvitationStatus.accepted;
        this.acceptedAt = Instant.now();
        this.acceptedUserId = acceptedUserId;
        this.updatedAt = Instant.now();
    }

    /**
     * Mark invitation as declined
     */
    public void markAsDeclined() {
        this.status = InvitationStatus.declined;
        this.declinedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    /**
     * Mark invitation as expired
     */
    public void markAsExpired() {
        this.status = InvitationStatus.expired;
        this.updatedAt = Instant.now();
    }

    /**
     * Increment resend count
     */
    public void incrementResendCount() {
        this.resendCount = (this.resendCount != null ? this.resendCount : 0) + 1;
        this.sentAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}