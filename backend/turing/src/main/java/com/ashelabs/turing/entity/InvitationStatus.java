package com.ashelabs.turing.entity;

/**
 * Enumeration of possible states for family invitations
 */
public enum InvitationStatus {
    /**
     * Invitation has been sent and is awaiting response
     */
    pending,

    /**
     * Invitation has been accepted and user account created
     */
    accepted,

    /**
     * Invitation has been declined by the recipient
     */
    declined,

    /**
     * Invitation has expired without being accepted
     */
    expired,

    /**
     * Invitation has been cancelled by the sender
     */
    cancelled
}