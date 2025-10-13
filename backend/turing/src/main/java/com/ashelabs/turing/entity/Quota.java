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
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Quota entity representing flexible quota configuration system
 * Corresponds to the 'quotas' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("quotas")
public class Quota extends BaseEntity {
    
    /**
     * Reference to the user this quota applies to
     */
    @NotNull(message = "User ID is required")
    @Column("user_id")
    private UUID userId;
    
    /**
     * Human-readable name for this quota
     */
    @NotBlank(message = "Quota name cannot be empty")
    @Column("name")
    private String name;
    
    /**
     * Optional description explaining the quota
     */
    @Column("description")
    private String description;
    
    /**
     * Type of quota (time-based, usage count, energy-based, cost-based)
     */
    @NotNull(message = "Quota type is required")
    @Column("quota_type")
    @Builder.Default
    private QuotaType quotaType = QuotaType.TIME_BASED;
    
    /**
     * Scope of the quota (global, room, device)
     */
    @NotNull(message = "Quota scope is required")
    @Column("scope")
    @Builder.Default
    private QuotaScope scope = QuotaScope.ROOM;
    
    /**
     * Target identifier (room_id, device_id, or null for global)
     */
    @Column("target_id")
    private String targetId;
    
    /**
     * Maximum allowed amount for this quota period
     * Units depend on quota_type: hours for time_based, count for usage_count, kWh for energy_based, USD for cost_based
     */
    @NotNull(message = "Allowed amount is required")
    @DecimalMin(value = "0.01", message = "Allowed amount must be positive")
    @Column("allowed_amount")
    private BigDecimal allowedAmount;
    
    /**
     * Currently used amount for this quota period
     */
    @NotNull(message = "Used amount is required")
    @DecimalMin(value = "0.0", message = "Used amount cannot be negative")
    @Column("used_amount")
    @Builder.Default
    private BigDecimal usedAmount = BigDecimal.ZERO;
    
    /**
     * Reset period for this quota
     */
    @NotNull(message = "Quota period is required")
    @Column("period")
    @Builder.Default
    private QuotaPeriod period = QuotaPeriod.DAILY;
    
    /**
     * Start time for custom periods
     */
    @Column("period_start")
    private Instant periodStart;
    
    /**
     * Duration for custom periods
     */
    @Column("period_duration")
    private Duration periodDuration;
    
    /**
     * Time of day when daily quotas reset (default midnight)
     */
    @Column("reset_time")
    @Builder.Default
    private LocalTime resetTime = LocalTime.MIDNIGHT;
    
    /**
     * Action to take when quota is exceeded
     */
    @NotNull(message = "Enforcement action is required")
    @Column("enforcement_action")
    @Builder.Default
    private EnforcementAction enforcementAction = EnforcementAction.BLOCK;
    
    /**
     * Current status of this quota
     */
    @NotNull(message = "Quota status is required")
    @Column("status")
    @Builder.Default
    private QuotaStatus status = QuotaStatus.ACTIVE;
    
    /**
     * Priority for this quota (higher numbers = higher priority)
     */
    @Min(value = 1, message = "Priority must be at least 1")
    @Column("priority")
    @Builder.Default
    private Integer priority = 1;
    
    /**
     * Whether unused quota can roll over to the next period
     */
    @Column("allow_rollover")
    @Builder.Default
    private Boolean allowRollover = false;
    
    /**
     * Maximum amount that can be rolled over
     */
    @DecimalMin(value = "0.0", message = "Rollover amount cannot be negative")
    @Column("max_rollover_amount")
    private BigDecimal maxRolloverAmount;
    
    /**
     * Warning thresholds as percentage values (e.g., [75, 90] for 75% and 90% warnings)
     */
    @Column("warning_thresholds")
    private List<Integer> warningThresholds;
    
    /**
     * Notification methods for warnings
     */
    @Column("notification_methods")
    private List<String> notificationMethods;
    
    /**
     * Grace period in minutes after quota exceeded
     */
    @Min(value = 0, message = "Grace period cannot be negative")
    @Column("grace_period_minutes")
    @Builder.Default
    private Integer gracePeriodMinutes = 0;
    
    /**
     * Maximum number of grace periods allowed
     */
    @Min(value = 0, message = "Max grace uses cannot be negative")
    @Column("max_grace_uses")
    @Builder.Default
    private Integer maxGraceUses = 1;
    
    /**
     * Cooldown period in hours between grace period uses
     */
    @Min(value = 0, message = "Grace cooldown cannot be negative")
    @Column("grace_cooldown_hours")
    @Builder.Default
    private Integer graceCooldownHours = 24;
    
    /**
     * Whether this quota can be shared with other users
     */
    @Column("allow_sharing")
    @Builder.Default
    private Boolean allowSharing = false;
    
    /**
     * Whether this user can borrow quota from others
     */
    @Column("allow_borrowing")
    @Builder.Default
    private Boolean allowBorrowing = false;
    
    /**
     * Sharing pool ID for quota pooling features
     */
    @Column("sharing_pool_id")
    private UUID sharingPoolId;
    
    /**
     * Timestamp when this quota was last reset
     */
    @Column("last_reset_at")
    private Instant lastResetAt;
    
    /**
     * User who created this quota
     */
    @Column("created_by")
    private UUID createdBy;
}