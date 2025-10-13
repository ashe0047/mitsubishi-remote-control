package com.ashelabs.turing.entity;

/**
 * Quota configuration types matching database enum quota_type
 */
public enum QuotaType {
    /**
     * Hours per day/week/month
     */
    TIME_BASED,
    
    /**
     * Number of AC activations
     */
    USAGE_COUNT,
    
    /**
     * kWh consumption limits
     */
    ENERGY_BASED,
    
    /**
     * Dollar amount limits
     */
    COST_BASED
}