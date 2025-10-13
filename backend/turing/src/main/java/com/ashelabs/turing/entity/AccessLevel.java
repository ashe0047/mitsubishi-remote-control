package com.ashelabs.turing.entity;

/**
 * Room access level types matching database enum access_level
 */
public enum AccessLevel {
    /**
     * Complete control of AC settings
     */
    full,
    
    /**
     * Basic temperature and power control only
     */
    limited,
    
    /**
     * Can view settings but not control
     */
    view_only,
    
    /**
     * Access based on time schedules
     */
    scheduled,
    
    /**
     * Only emergency override access
     */
    emergency_only
}