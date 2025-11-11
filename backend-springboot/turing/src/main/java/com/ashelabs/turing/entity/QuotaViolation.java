package com.ashelabs.turing.entity;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * QuotaViolation entity representing quota breaches and enforcement actions
 * Corresponds to the 'quota_violations' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("quota_violations")
public class QuotaViolation extends BaseEntity {
    
    /**
     * Reference to the user who violated the quota
     */
    @NotNull(message = "User ID is required")
    @Column("user_id")
    private UUID userId;
    
    /**
     * Reference to the quota that was violated
     */
    @NotNull(message = "Quota ID is required")
    @Column("quota_id")
    private UUID quotaId;
    
    /**
     * Reference to the usage session that caused the violation (optional)
     */
    @Column("usage_session_id")
    private UUID usageSessionId;
    
    /**
     * Type of violation (exceeded, warning, blocked)
     */
    @NotBlank(message = "Violation type cannot be empty")
    @Column("violation_type")
    private String violationType;
    
    /**
     * Amount by which the quota was exceeded
     */
    @NotNull(message = "Violation amount is required")
    @DecimalMin(value = "0.0", message = "Violation amount cannot be negative")
    @Column("violation_amount")
    private BigDecimal violationAmount;
    
    /**
     * What the quota limit was at the time of violation
     */
    @NotNull(message = "Quota limit is required")
    @DecimalMin(value = "0.01", message = "Quota limit must be positive")
    @Column("quota_limit")
    private BigDecimal quotaLimit;
    
    /**
     * Enforcement action taken (warning_sent, access_blocked, session_ended)
     */
    @NotBlank(message = "Enforcement action cannot be empty")
    @Column("enforcement_action")
    private String enforcementAction;
    
    /**
     * Whether an override was granted for this violation
     */
    @NotNull(message = "Override granted flag is required")
    @Column("override_granted")
    @Builder.Default
    private Boolean overrideGranted = false;
    
    /**
     * User who granted the override (parent/admin)
     */
    @Column("override_by")
    private UUID overrideBy;
    
    /**
     * Reason for granting the override
     */
    @Column("override_reason")
    private String overrideReason;
    
    /**
     * Duration of the override in minutes
     */
    @Min(value = 1, message = "Override duration must be at least 1 minute")
    @Column("override_duration_minutes")
    private Integer overrideDurationMinutes;
    
    /**
     * Whether this violation has been resolved
     */
    @NotNull(message = "Resolved flag is required")
    @Column("resolved")
    @Builder.Default
    private Boolean resolved = false;
    
    /**
     * When the violation was resolved
     */
    @Column("resolved_at")
    private Instant resolvedAt;
    
    /**
     * User who resolved the violation
     */
    @Column("resolved_by")
    private UUID resolvedBy;
    
    /**
     * Notes about how the violation was resolved
     */
    @Column("resolution_notes")
    private String resolutionNotes;
    
    /**
     * Override the createdAt field from BaseEntity since quota_violations table doesn't have updated_at
     * We only use created_at for this entity
     */
    @Override
    @CreatedDate
    @Column("created_at")
    public Instant getCreatedAt() {
        return super.getCreatedAt();
    }
    
    /**
     * QuotaViolation doesn't use updatedAt field, so we override to exclude it
     */
    @Override
    public Instant getUpdatedAt() {
        return null;
    }
    
    @Override
    public void setUpdatedAt(Instant updatedAt) {
        // No-op - this entity doesn't track updates
    }
}