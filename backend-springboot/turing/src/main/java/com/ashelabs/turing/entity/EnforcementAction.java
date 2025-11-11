package com.ashelabs.turing.entity;

/**
 * Enforcement actions when quota exceeded matching database enum enforcement_action
 */
public enum EnforcementAction {
    /**
     * Show warnings but allow usage
     */
    WARN,
    
    /**
     * Limit available actions
     */
    RESTRICT,
    
    /**
     * Completely block AC control
     */
    BLOCK
}