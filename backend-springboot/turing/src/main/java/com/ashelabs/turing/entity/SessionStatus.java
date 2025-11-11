package com.ashelabs.turing.entity;

/**
 * Usage session status matching database enum session_status
 */
public enum SessionStatus {
    /**
     * Currently running session
     */
    ACTIVE,
    
    /**
     * Normally ended session
     */
    COMPLETED,
    
    /**
     * Abnormally ended (power loss, etc.)
     */
    INTERRUPTED,
    
    /**
     * Ended by parent override
     */
    OVERRIDE
}