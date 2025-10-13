package com.ashelabs.turing.service;

import com.ashelabs.turing.repository.UserRepository;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import jakarta.annotation.PostConstruct;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Service for managing quota feature flags and gradual rollout.
 * 
 * This service controls which users and households have access to quota features,
 * enabling safe gradual rollout and easy rollback capabilities.
 */
@Service
@ConfigurationProperties(prefix = "quota")
@Data
@Slf4j
public class QuotaFeatureService {
    
    /**
     * Global quota feature flag.
     */
    private boolean enabled = false;
    
    /**
     * Set of household IDs that have quota features explicitly enabled.
     */
    private Set<UUID> enabledHouseholds = new HashSet<>();
    
    /**
     * Percentage-based rollout (0-100).
     * Users are included based on consistent hash of their household ID.
     */
    private int rolloutPercentage = 0;
    
    /**
     * Beta testing mode - more verbose logging and metrics.
     */
    private boolean betaMode = false;
    
    /**
     * Set of household IDs that are explicitly disabled (overrides percentage rollout).
     */
    private Set<UUID> disabledHouseholds = new HashSet<>();
    
    /**
     * Emergency disable flag - overrides all other settings.
     */
    private boolean emergencyDisable = false;
    
    private final UserRepository userRepository;
    
    @Autowired
    public QuotaFeatureService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @PostConstruct
    public void initialize() {
        log.info("QuotaFeatureService initialized - enabled: {}, rollout: {}%, explicit households: {}", 
            enabled, rolloutPercentage, enabledHouseholds.size());
        
        if (betaMode) {
            log.info("Quota feature service running in BETA MODE with enhanced logging");
        }
        
        if (emergencyDisable) {
            log.warn("EMERGENCY DISABLE is active - all quota features are disabled");
        }
    }
    
    /**
     * Checks if quota features are enabled for a specific user.
     * 
     * @param userId ID of the user to check
     * @return Mono that emits true if quota features are enabled for this user
     */
    public Mono<Boolean> isQuotaEnabledForUser(UUID userId) {
        // Emergency disable overrides everything
        if (emergencyDisable) {
            logDebug("Quota disabled for user {} due to emergency disable", userId);
            return Mono.just(false);
        }
        
        // Global feature flag check
        if (!enabled) {
            logDebug("Quota disabled for user {} due to global feature flag", userId);
            return Mono.just(false);
        }
        
        // Get user's household and check enablement
        return userRepository.findById(userId)
            .map(user -> isEnabledForHousehold(user.getHouseholdId()))
            .defaultIfEmpty(false)
            .doOnNext(enabled -> logDebug("Quota enabled for user {}: {}", userId, enabled));
    }
    
    /**
     * Checks if quota features are enabled for a specific household.
     * 
     * @param householdId ID of the household to check
     * @return true if quota features are enabled for this household
     */
    public boolean isEnabledForHousehold(UUID householdId) {
        // Emergency disable overrides everything
        if (emergencyDisable) {
            return false;
        }
        
        // Global feature flag check
        if (!enabled) {
            return false;
        }
        
        // Check explicit disable list first
        if (disabledHouseholds.contains(householdId)) {
            logDebug("Quota disabled for household {} due to explicit disable", householdId);
            return false;
        }
        
        // Explicit household enablement takes precedence
        if (enabledHouseholds.contains(householdId)) {
            logDebug("Quota enabled for household {} due to explicit enable", householdId);
            return true;
        }
        
        // Percentage-based rollout using consistent hashing
        if (rolloutPercentage > 0) {
            boolean enabled = isIncludedInPercentageRollout(householdId);
            logDebug("Quota {} for household {} via {}% rollout", 
                enabled ? "enabled" : "disabled", householdId, rolloutPercentage);
            return enabled;
        }
        
        logDebug("Quota disabled for household {} - no enabling criteria met", householdId);
        return false;
    }
    
    /**
     * Explicitly enables quota features for a household.
     * 
     * @param householdId ID of the household to enable
     */
    public void enableForHousehold(UUID householdId) {
        enabledHouseholds.add(householdId);
        disabledHouseholds.remove(householdId); // Remove from disable list if present
        log.info("Explicitly enabled quota features for household: {}", householdId);
    }
    
    /**
     * Explicitly disables quota features for a household.
     * 
     * @param householdId ID of the household to disable
     */
    public void disableForHousehold(UUID householdId) {
        disabledHouseholds.add(householdId);
        enabledHouseholds.remove(householdId); // Remove from enable list if present
        log.info("Explicitly disabled quota features for household: {}", householdId);
    }
    
    /**
     * Removes explicit enable/disable status for a household.
     * The household will fall back to percentage-based rollout.
     * 
     * @param householdId ID of the household to reset
     */
    public void resetHouseholdStatus(UUID householdId) {
        boolean wasEnabled = enabledHouseholds.remove(householdId);
        boolean wasDisabled = disabledHouseholds.remove(householdId);
        
        if (wasEnabled || wasDisabled) {
            log.info("Reset explicit status for household: {} (was {})", 
                householdId, wasEnabled ? "enabled" : "disabled");
        }
    }
    
    /**
     * Gets the current rollout status and statistics.
     * 
     * @return rollout status information
     */
    public RolloutStatus getRolloutStatus() {
        return RolloutStatus.builder()
            .globalEnabled(enabled)
            .rolloutPercentage(rolloutPercentage)
            .explicitlyEnabledHouseholds(enabledHouseholds.size())
            .explicitlyDisabledHouseholds(disabledHouseholds.size())
            .betaMode(betaMode)
            .emergencyDisable(emergencyDisable)
            .build();
    }
    
    /**
     * Emergency disable all quota features.
     * This immediately disables quota features for all users.
     */
    public void emergencyDisable() {
        this.emergencyDisable = true;
        log.error("EMERGENCY DISABLE activated - all quota features are now disabled");
    }
    
    /**
     * Re-enable quota features after emergency disable.
     */
    public void clearEmergencyDisable() {
        this.emergencyDisable = false;
        log.info("Emergency disable cleared - quota features restored based on configuration");
    }
    
    /**
     * Updates the percentage-based rollout.
     * 
     * @param newPercentage new rollout percentage (0-100)
     */
    public void setRolloutPercentage(int newPercentage) {
        if (newPercentage < 0 || newPercentage > 100) {
            throw new IllegalArgumentException("Rollout percentage must be between 0 and 100");
        }
        
        int oldPercentage = this.rolloutPercentage;
        this.rolloutPercentage = newPercentage;
        
        log.info("Updated quota rollout percentage from {}% to {}%", oldPercentage, newPercentage);
    }
    
    // Private helper methods
    
    private boolean isIncludedInPercentageRollout(UUID householdId) {
        if (rolloutPercentage <= 0) {
            return false;
        }
        
        if (rolloutPercentage >= 100) {
            return true;
        }
        
        // Use consistent hashing based on household ID
        int hash = Math.abs(householdId.hashCode() % 100);
        return hash < rolloutPercentage;
    }
    
    private void logDebug(String message, Object... args) {
        if (betaMode || log.isDebugEnabled()) {
            log.debug(message, args);
        }
    }
    
    /**
     * Data class for rollout status information.
     */
    @Data
    @lombok.Builder
    public static class RolloutStatus {
        private boolean globalEnabled;
        private int rolloutPercentage;
        private int explicitlyEnabledHouseholds;
        private int explicitlyDisabledHouseholds;
        private boolean betaMode;
        private boolean emergencyDisable;
        
        public boolean isAnyQuotaFeaturesActive() {
            return globalEnabled && !emergencyDisable && 
                   (rolloutPercentage > 0 || explicitlyEnabledHouseholds > 0);
        }
    }
}