package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents the current quota balance and usage information for a user in a specific room.
 * 
 * This class provides a snapshot of quota consumption, remaining allowances, and usage patterns
 * for real-time quota validation and user interface display.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaBalance {
    
    /**
     * ID of the quota configuration this balance represents.
     */
    private UUID quotaId;
    
    /**
     * ID of the user this quota balance belongs to.
     */
    private UUID userId;
    
    /**
     * Room ID this quota balance applies to.
     */
    private String roomId;
    
    // Time-based quota fields
    
    /**
     * Total time allowance in seconds for the current period.
     */
    private Integer totalSeconds;
    
    /**
     * Time already used in seconds for the current period.
     */
    private Integer usedSeconds;
    
    /**
     * Remaining time in seconds for the current period.
     */
    private Integer remainingSeconds;
    
    // Usage count-based quota fields
    
    /**
     * Total usage count allowance for the current period.
     */
    private Integer totalUsageCount;
    
    /**
     * Usage count already consumed for the current period.
     */
    private Integer usedUsageCount;
    
    /**
     * Remaining usage count for the current period.
     */
    private Integer remainingUsageCount;
    
    // Energy-based quota fields
    
    /**
     * Total energy allowance in kWh for the current period.
     */
    private BigDecimal totalEnergyKwh;
    
    /**
     * Energy already consumed in kWh for the current period.
     */
    private BigDecimal usedEnergyKwh;
    
    /**
     * Remaining energy in kWh for the current period.
     */
    private BigDecimal remainingEnergyKwh;
    
    // Cost-based quota fields
    
    /**
     * Total cost allowance for the current period.
     */
    private BigDecimal totalCostAmount;
    
    /**
     * Cost already incurred for the current period.
     */
    private BigDecimal usedCostAmount;
    
    /**
     * Remaining cost allowance for the current period.
     */
    private BigDecimal remainingCostAmount;
    
    // Configuration and metadata
    
    /**
     * Warning threshold as a percentage (0-100).
     * Warnings are triggered when usage exceeds this percentage.
     */
    private Integer warningThreshold;
    
    /**
     * Timestamp when this balance snapshot was last updated.
     */
    private Instant lastUpdated;
    
    /**
     * When the current quota period resets (daily, weekly, etc.).
     */
    private LocalDateTime resetTime;
    
    /**
     * Whether the quota is currently active and being enforced.
     */
    @Builder.Default
    private Boolean isActive = true;
    
    /**
     * Whether the quota has been exceeded for the current period.
     */
    private Boolean isExceeded;
    
    /**
     * Whether there's currently an active override for this quota.
     */
    @Builder.Default
    private Boolean hasOverride = false;
    
    // Calculated properties and utility methods
    
    /**
     * Calculates the usage percentage for time-based quotas.
     * 
     * @return usage percentage (0.0 to 100.0), or 0.0 if no time quota configured
     */
    public double getTimeUsagePercentage() {
        if (totalSeconds == null || totalSeconds == 0) return 0.0;
        return ((double) (usedSeconds != null ? usedSeconds : 0) / totalSeconds) * 100.0;
    }
    
    /**
     * Calculates the usage percentage for count-based quotas.
     * 
     * @return usage percentage (0.0 to 100.0), or 0.0 if no count quota configured
     */
    public double getCountUsagePercentage() {
        if (totalUsageCount == null || totalUsageCount == 0) return 0.0;
        return ((double) (usedUsageCount != null ? usedUsageCount : 0) / totalUsageCount) * 100.0;
    }
    
    /**
     * Calculates the usage percentage for energy-based quotas.
     * 
     * @return usage percentage (0.0 to 100.0), or 0.0 if no energy quota configured
     */
    public double getEnergyUsagePercentage() {
        if (totalEnergyKwh == null || totalEnergyKwh.compareTo(BigDecimal.ZERO) == 0) return 0.0;
        BigDecimal used = usedEnergyKwh != null ? usedEnergyKwh : BigDecimal.ZERO;
        return used.divide(totalEnergyKwh, 4, java.math.RoundingMode.HALF_UP)
                  .multiply(new BigDecimal("100"))
                  .doubleValue();
    }
    
    /**
     * Calculates the usage percentage for cost-based quotas.
     * 
     * @return usage percentage (0.0 to 100.0), or 0.0 if no cost quota configured
     */
    public double getCostUsagePercentage() {
        if (totalCostAmount == null || totalCostAmount.compareTo(BigDecimal.ZERO) == 0) return 0.0;
        BigDecimal used = usedCostAmount != null ? usedCostAmount : BigDecimal.ZERO;
        return used.divide(totalCostAmount, 4, java.math.RoundingMode.HALF_UP)
                  .multiply(new BigDecimal("100"))
                  .doubleValue();
    }
    
    /**
     * Gets the highest usage percentage across all quota types.
     * 
     * @return the maximum usage percentage among all active quota types
     */
    public double getMaxUsagePercentage() {
        return Math.max(
            Math.max(getTimeUsagePercentage(), getCountUsagePercentage()),
            Math.max(getEnergyUsagePercentage(), getCostUsagePercentage())
        );
    }
    
    /**
     * Checks if any quota type has been exceeded.
     * 
     * @return true if any quota limit has been reached or exceeded
     */
    public boolean isAnyQuotaExceeded() {
        return isTimeQuotaExceeded() || 
               isCountQuotaExceeded() || 
               isEnergyQuotaExceeded() || 
               isCostQuotaExceeded();
    }
    
    /**
     * Checks if the time-based quota has been exceeded.
     * 
     * @return true if time quota is exceeded
     */
    public boolean isTimeQuotaExceeded() {
        return remainingSeconds != null && remainingSeconds <= 0;
    }
    
    /**
     * Checks if the count-based quota has been exceeded.
     * 
     * @return true if usage count quota is exceeded
     */
    public boolean isCountQuotaExceeded() {
        return remainingUsageCount != null && remainingUsageCount <= 0;
    }
    
    /**
     * Checks if the energy-based quota has been exceeded.
     * 
     * @return true if energy quota is exceeded
     */
    public boolean isEnergyQuotaExceeded() {
        return remainingEnergyKwh != null && remainingEnergyKwh.compareTo(BigDecimal.ZERO) <= 0;
    }
    
    /**
     * Checks if the cost-based quota has been exceeded.
     * 
     * @return true if cost quota is exceeded
     */
    public boolean isCostQuotaExceeded() {
        return remainingCostAmount != null && remainingCostAmount.compareTo(BigDecimal.ZERO) <= 0;
    }
    
    /**
     * Checks if usage is at or above the warning threshold for any quota type.
     * 
     * @return true if any quota type is at warning level
     */
    public boolean isAtWarningThreshold() {
        if (warningThreshold == null) return false;
        return getMaxUsagePercentage() >= warningThreshold;
    }
    
    /**
     * Gets remaining time in a human-readable format.
     * 
     * @return formatted time string (e.g., "2h 30m")
     */
    public String getFormattedRemainingTime() {
        if (remainingSeconds == null || remainingSeconds <= 0) {
            return "0m";
        }
        
        int hours = remainingSeconds / 3600;
        int minutes = (remainingSeconds % 3600) / 60;
        
        if (hours > 0) {
            return String.format("%dh %dm", hours, minutes);
        } else {
            return String.format("%dm", minutes);
        }
    }
    
    /**
     * Creates a snapshot of this balance for caching.
     * Updates the lastUpdated timestamp to current time.
     * 
     * @return a copy of this balance with updated timestamp
     */
    public QuotaBalance snapshot() {
        return QuotaBalance.builder()
            .quotaId(this.quotaId)
            .userId(this.userId)
            .roomId(this.roomId)
            .totalSeconds(this.totalSeconds)
            .usedSeconds(this.usedSeconds)
            .remainingSeconds(this.remainingSeconds)
            .totalUsageCount(this.totalUsageCount)
            .usedUsageCount(this.usedUsageCount)
            .remainingUsageCount(this.remainingUsageCount)
            .totalEnergyKwh(this.totalEnergyKwh)
            .usedEnergyKwh(this.usedEnergyKwh)
            .remainingEnergyKwh(this.remainingEnergyKwh)
            .totalCostAmount(this.totalCostAmount)
            .usedCostAmount(this.usedCostAmount)
            .remainingCostAmount(this.remainingCostAmount)
            .warningThreshold(this.warningThreshold)
            .lastUpdated(Instant.now())
            .resetTime(this.resetTime)
            .isActive(this.isActive)
            .isExceeded(this.isExceeded)
            .hasOverride(this.hasOverride)
            .build();
    }
    
    /**
     * Checks if this balance data is fresh enough for use.
     * 
     * @param maxAgeSeconds maximum age in seconds
     * @return true if the balance was updated recently enough
     */
    public boolean isFresh(long maxAgeSeconds) {
        if (lastUpdated == null) return false;
        return Instant.now().isBefore(lastUpdated.plusSeconds(maxAgeSeconds));
    }
}