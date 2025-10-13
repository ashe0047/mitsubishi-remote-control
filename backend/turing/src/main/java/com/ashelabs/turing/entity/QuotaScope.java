package com.ashelabs.turing.entity;

/**
 * Quota scope definitions matching database enum quota_scope
 */
public enum QuotaScope {
    /**
     * Applies to all rooms/devices
     */
    GLOBAL,
    
    /**
     * Specific to one room
     */
    ROOM,
    
    /**
     * Specific to one device
     */
    DEVICE
}