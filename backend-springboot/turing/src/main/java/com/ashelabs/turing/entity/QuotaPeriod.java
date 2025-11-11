package com.ashelabs.turing.entity;

/**
 * Quota reset period types matching database enum quota_period
 */
public enum QuotaPeriod {
    /**
     * Reset every hour
     */
    HOURLY,
    
    /**
     * Reset daily at specified time
     */
    DAILY,
    
    /**
     * Reset weekly on specified day
     */
    WEEKLY,
    
    /**
     * Reset monthly on specified date
     */
    MONTHLY,
    
    /**
     * Custom interval defined by period_duration
     */
    CUSTOM
}