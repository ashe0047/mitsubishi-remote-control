package com.ashelabs.turing.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

/**
 * Household entity representing multi-tenant organization structure
 * Corresponds to the 'households' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("households")
public class Household extends BaseEntity {
    
    /**
     * Household name - required and non-empty
     */
    @NotBlank(message = "Household name cannot be empty")
    @Column("name")
    private String name;
    
    /**
     * Subscription plan type
     */
    @Pattern(regexp = "^(basic|premium|enterprise)$", message = "Subscription plan must be basic, premium, or enterprise")
    @Column("subscription_plan")
    @Builder.Default
    private String subscriptionPlan = "basic";
    
    /**
     * Billing email address
     */
    @Email(message = "Invalid email format")
    @Column("billing_email")
    private String billingEmail;
    
    /**
     * Address information stored as JSONB
     * Example: {"street": "123 Main St", "city": "Springfield", "state": "CA", "zipCode": "90210"}
     */
    @Column("address")
    private String address;
    
    /**
     * Timezone for the household
     */
    @Column("timezone")
    @Builder.Default
    private String timezone = "UTC";
    
    /**
     * Organization ID for enterprise features
     */
    @Column("organization_id")
    private UUID organizationId;
    
    /**
     * Extended settings stored as JSONB
     * Example: {"features": ["quota_management"], "version": "1.0", "theme": "dark"}
     */
    @Column("settings")
    private String settings;
}