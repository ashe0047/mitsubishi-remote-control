package com.ashelabs.turing.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * User account status matching database enum user_status
 */
public enum UserStatus {
    /**
     * Normal active account
     */
    active("active"),
    
    /**
     * Temporarily disabled
     */
    suspended("suspended"),
    
    /**
     * Account created but not activated
     */
    pending("pending"),
    
    /**
     * Account disabled but data retained
     */
    archived("archived");
    
    private final String value;
    
    UserStatus(String value) {
        this.value = value;
    }
    
    @JsonValue
    public String getValue() {
        return value;
    }
    
    public static UserStatus fromValue(String value) {
        for (UserStatus status : UserStatus.values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown UserStatus: " + value);
    }
}