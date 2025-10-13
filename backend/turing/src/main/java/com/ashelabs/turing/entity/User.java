package com.ashelabs.turing.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * User entity representing user accounts with role-based access and household association
 * Corresponds to the 'users' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("users")
public class User extends BaseEntity {
    
    /**
     * Reference to the household this user belongs to
     */
    @NotNull(message = "Household ID is required")
    @Column("household_id")
    private UUID householdId;
    
    /**
     * User's email address - unique across the system
     */
    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    @Column("email")
    private String email;
    
    /**
     * Password hash - never store plain text passwords
     */
    @NotBlank(message = "Password hash is required")
    @Column("password_hash")
    private String passwordHash;
    
    /**
     * User's full name
     */
    @NotBlank(message = "Name is required")
    @Column("name")
    private String name;
    
    /**
     * User's role determining permissions
     */
    @NotNull(message = "User role is required")
    @Column("role")
    @Builder.Default
    private UserRole role = UserRole.child;
    
    /**
     * User's account status
     */
    @NotNull(message = "User status is required")
    @Column("status")
    @Builder.Default
    private UserStatus status = UserStatus.active;
    
    /**
     * User's date of birth for age verification
     */
    @PastOrPresent(message = "Birth date cannot be in the future")
    @Column("date_of_birth")
    private LocalDate dateOfBirth;
    
    /**
     * URL to user's avatar image
     */
    @Column("avatar_url")
    private String avatarUrl;
    
    /**
     * User's phone number
     */
    @Column("phone")
    private String phone;
    
    /**
     * User preferences stored as JSONB
     * Example: {"theme": "dark", "language": "en", "notifications": true}
     */
    @Column("preferences")
    private String preferences;
    
    /**
     * Emergency contacts stored as JSONB
     * Example: [{"name": "John Doe", "phone": "+1234567890", "relationship": "parent"}]
     */
    @Column("emergency_contacts")
    private String emergencyContacts;
    
    /**
     * Employee ID for enterprise features
     */
    @Column("employee_id")
    private String employeeId;
    
    /**
     * Department for enterprise features
     */
    @Column("department")
    private String department;
    
    /**
     * Cost center for enterprise features
     */
    @Column("cost_center")
    private String costCenter;
    
    /**
     * Timestamp of last successful login
     */
    @Column("last_login_at")
    private Instant lastLoginAt;
    
    /**
     * User who created this account
     */
    @Column("created_by")
    private UUID createdBy;
}