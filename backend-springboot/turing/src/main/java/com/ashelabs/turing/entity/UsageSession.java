package com.ashelabs.turing.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.DecimalMax;
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
import java.time.Instant;
import java.util.UUID;

/**
 * UsageSession entity representing detailed tracking of AC usage sessions
 * Corresponds to the 'usage_sessions' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("usage_sessions")
public class UsageSession extends BaseEntity {
    
    /**
     * Reference to the user who started this session
     */
    @NotNull(message = "User ID is required")
    @Column("user_id")
    private UUID userId;
    
    /**
     * Room identifier where this session occurred
     */
    @NotBlank(message = "Room ID cannot be empty")
    @Column("room_id")
    private String roomId;
    
    /**
     * Type of device being controlled
     */
    @NotBlank(message = "Device type is required")
    @Column("device_type")
    @Builder.Default
    private String deviceType = "ac";
    
    /**
     * When the session was started
     */
    @NotNull(message = "Start time is required")
    @Column("started_at")
    @Builder.Default
    private Instant startedAt = Instant.now();
    
    /**
     * When the session ended (null for active sessions)
     */
    @Column("ended_at")
    private Instant endedAt;
    
    /**
     * Duration of the session in minutes (calculated when session ends)
     */
    @Min(value = 0, message = "Duration cannot be negative")
    @Column("duration_minutes")
    private Integer durationMinutes;
    
    /**
     * Current status of the session
     */
    @NotNull(message = "Session status is required")
    @Column("status")
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;
    
    /**
     * AC settings when the session was started (stored as JSONB)
     * Example: {"temperature": 22.5, "mode": "cool", "fan": "auto", "vane": "auto"}
     */
    @Column("initial_settings")
    private JsonNode initialSettings;
    
    /**
     * AC settings when the session ended (stored as JSONB)
     * Example: {"temperature": 24.0, "mode": "cool", "fan": "low", "vane": "swing"}
     */
    @Column("final_settings")
    private JsonNode finalSettings;
    
    /**
     * Temperature setting during the session
     */
    @DecimalMin(value = "16.0", message = "Temperature must be at least 16°C")
    @DecimalMax(value = "30.0", message = "Temperature must be at most 30°C")
    @Column("temperature_set")
    private BigDecimal temperatureSet;
    
    /**
     * AC mode during the session
     */
    @Column("mode")
    private String mode;
    
    /**
     * Fan speed setting during the session
     */
    @Column("fan_speed")
    private String fanSpeed;
    
    /**
     * Energy consumed during this session in kWh
     */
    @DecimalMin(value = "0.0", message = "Energy consumed cannot be negative")
    @Column("energy_consumed")
    private BigDecimal energyConsumed;
    
    /**
     * Estimated cost of this session in USD
     */
    @DecimalMin(value = "0.0", message = "Estimated cost cannot be negative")
    @Column("estimated_cost")
    private BigDecimal estimatedCost;
    
    /**
     * Efficiency rating of this session (0.0 to 1.0)
     */
    @DecimalMin(value = "0.0", message = "Efficiency rating must be at least 0.0")
    @DecimalMax(value = "1.0", message = "Efficiency rating must be at most 1.0")
    @Column("efficiency_rating")
    private BigDecimal efficiencyRating;
    
    /**
     * Outdoor temperature during the session
     */
    @Column("outdoor_temperature")
    private BigDecimal outdoorTemperature;
    
    /**
     * Weather conditions during the session
     */
    @Column("weather_conditions")
    private String weatherConditions;
    
    /**
     * Quota violations that occurred during this session (stored as JSONB)
     * Example: [{"quota_id": "uuid", "violation_type": "exceeded", "amount": 2.5}]
     */
    @Column("quota_violations")
    private JsonNode quotaViolations;
    
    /**
     * Reason for any override that occurred during this session
     */
    @Column("override_reason")
    private String overrideReason;
    
    /**
     * User who performed an override (parent/admin)
     */
    @Column("override_by")
    private UUID overrideBy;
    
    /**
     * Additional metadata stored as JSONB
     * Example: {"app_version": "1.2.3", "ip_address": "192.168.1.100"}
     */
    @Column("metadata")
    private JsonNode metadata;
}