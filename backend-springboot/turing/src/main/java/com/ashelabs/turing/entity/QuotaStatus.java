package com.ashelabs.turing.entity;

/**
 * Current quota status matching database enum quota_status
 */
public enum QuotaStatus {
    /**
     * Currently enforced
     */
    ACTIVE,
    
    /**
     * Temporarily disabled
     */
    PAUSED,
    
    /**
     * Limit exceeded, enforcement active
     */
    EXCEEDED,
    
    /**
     * Past valid date range
     */
    EXPIRED
}