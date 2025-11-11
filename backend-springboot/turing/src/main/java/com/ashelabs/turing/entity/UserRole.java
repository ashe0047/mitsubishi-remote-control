package com.ashelabs.turing.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * User roles with hierarchical permissions matching database enum user_role
 */
public enum UserRole {
    /**
     * Full system administration
     */
    admin("admin"),
    
    /**
     * Can manage quotas and override restrictions
     */
    parent("parent"),
    
    /**
     * Standard adult access without quota restrictions
     */
    adult("adult"),
    
    /**
     * Limited access with possible quota enforcement
     */
    teen("teen"),
    
    /**
     * Restricted access with quota enforcement
     */
    child("child"),
    
    /**
     * Temporary access
     */
    guest("guest");
    
    private final String value;
    
    UserRole(String value) {
        this.value = value;
    }
    
    @JsonValue
    public String getValue() {
        return value;
    }
    
    public static UserRole fromValue(String value) {
        for (UserRole role : UserRole.values()) {
            if (role.value.equals(value)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown UserRole: " + value);
    }
}