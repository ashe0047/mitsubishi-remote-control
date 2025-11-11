import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Household } from '../../households/entities/household.entity';
// (no rxjs usage required in this service)

// RolloutStatus data class matching Spring Boot exactly
export class RolloutStatus {
  constructor(
    public readonly globalEnabled: boolean,
    public readonly rolloutPercentage: number,
    public readonly explicitlyEnabledHouseholds: number,
    public readonly explicitlyDisabledHouseholds: number,
    public readonly betaMode: boolean,
    public readonly emergencyDisable: boolean,
  ) {}

  // Matching Spring Boot isAnyQuotaFeaturesActive method
  isAnyQuotaFeaturesActive(): boolean {
    return (
      this.globalEnabled &&
      !this.emergencyDisable &&
      (this.rolloutPercentage > 0 || this.explicitlyEnabledHouseholds > 0)
    );
  }

  // Additional convenience methods
  getPercentageInRollout(): number {
    const totalHouseholds =
      this.explicitlyEnabledHouseholds + this.explicitlyDisabledHouseholds;
    if (totalHouseholds === 0) return this.rolloutPercentage;
    return (this.explicitlyEnabledHouseholds / totalHouseholds) * 100;
  }
}

// Configuration interface matching Spring Boot @ConfigurationProperties
interface QuotaFeatureConfig {
  enabled: boolean;
  betaMode: boolean;
  enabledHouseholds: Set<string>;
  disabledHouseholds: Set<string>;
  rolloutPercentage: number;
  emergencyDisable: boolean;
}

@Injectable()
export class QuotaFeatureService {
  private readonly logger = new Logger(QuotaFeatureService.name);

  // Default configuration matching Spring Boot defaults
  private readonly config: QuotaFeatureConfig = {
    enabled: false, // Default disabled
    betaMode: false, // Default beta mode disabled
    enabledHouseholds: new Set(),
    disabledHouseholds: new Set(),
    rolloutPercentage: 0, // Default 0% rollout
    emergencyDisable: false, // Default no emergency disable
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
  ) {
    this.loadConfiguration();
  }

  /**
   * Check if quota feature is enabled for a user (matching Spring Boot isQuotaEnabledForUser)
   */
  async isQuotaEnabledForUser(userId: string): Promise<boolean> {
    try {
      this.logDebug(`Checking quota feature status for user ${userId}`);

      // Step 1: Emergency disable check (highest priority)
      if (this.config.emergencyDisable) {
        this.logDebug(`Quota feature emergency disabled for user ${userId}`);
        return false;
      }

      // Step 2: Global feature flag check
      if (!this.config.enabled) {
        this.logDebug(`Quota feature globally disabled for user ${userId}`);
        return false;
      }

      // Step 3: Get user and household information
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['household'],
      });

      if (!user || !user.household) {
        this.logDebug(`User ${userId} or household not found - quota disabled`);
        return false;
      }

      const householdId = user.household.id;

      // Step 4: Household explicit disable check
      if (this.config.disabledHouseholds.has(householdId)) {
        this.logDebug(
          `Quota feature explicitly disabled for household ${householdId}`,
        );
        return false;
      }

      // Step 5: Household explicit enable check
      if (this.config.enabledHouseholds.has(householdId)) {
        this.logDebug(
          `Quota feature explicitly enabled for household ${householdId}`,
        );
        return true;
      }

      // Step 6: Percentage-based rollout check (matching Spring Boot consistent hashing)
      const isInRollout = this.isIncludedInPercentageRollout(householdId);
      this.logDebug(
        `User ${userId} in household ${householdId} rollout result: ${isInRollout}`,
      );

      return isInRollout;
    } catch (error) {
      this.logger.error(
        `Error checking quota feature status for user ${userId}`,
        error,
      );
      // Fail-safe: return false on error
      return false;
    }
  }

  /**
   * Check if quota feature is enabled for a household
   */
  isQuotaEnabledForHousehold(householdId: string): boolean {
    try {
      // Step 1: Emergency disable check
      if (this.config.emergencyDisable) {
        return false;
      }

      // Step 2: Global feature flag check
      if (!this.config.enabled) {
        return false;
      }

      // Step 3: Household explicit disable check
      if (this.config.disabledHouseholds.has(householdId)) {
        return false;
      }

      // Step 4: Household explicit enable check
      if (this.config.enabledHouseholds.has(householdId)) {
        return true;
      }

      // Step 5: Percentage-based rollout check
      return this.isIncludedInPercentageRollout(householdId);
    } catch (error) {
      this.logger.error(
        `Error checking quota feature status for household ${householdId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Enable quota feature for a household (matching Spring Boot enableForHousehold)
   */
  async enableForHousehold(householdId: string): Promise<void> {
    this.logger.log(`Enabling quota feature for household ${householdId}`);

    // Remove from disabled set if present
    this.config.disabledHouseholds.delete(householdId);

    // Add to enabled set
    this.config.enabledHouseholds.add(householdId);

    // Save configuration
    await this.saveConfiguration();
  }

  /**
   * Disable quota feature for a household (matching Spring Boot disableForHousehold)
   */
  async disableForHousehold(householdId: string): Promise<void> {
    this.logger.log(`Disabling quota feature for household ${householdId}`);

    // Remove from enabled set if present
    this.config.enabledHouseholds.delete(householdId);

    // Add to disabled set
    this.config.disabledHouseholds.add(householdId);

    // Save configuration
    await this.saveConfiguration();
  }

  /**
   * Enable quota feature globally
   */
  async enableGlobally(): Promise<void> {
    this.logger.log('Enabling quota feature globally');
    this.config.enabled = true;
    await this.saveConfiguration();
  }

  /**
   * Disable quota feature globally
   */
  async disableGlobally(): Promise<void> {
    this.logger.log('Disabling quota feature globally');
    this.config.enabled = false;
    await this.saveConfiguration();
  }

  /**
   * Set rollout percentage (matching Spring Boot percentage-based enrollment)
   */
  async setRolloutPercentage(percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    this.logger.log(
      `Setting quota feature rollout percentage to ${percentage}%`,
    );
    this.config.rolloutPercentage = percentage;
    await this.saveConfiguration();
  }

  /**
   * Emergency disable (matching Spring Boot emergencyDisable)
   */
  async emergencyDisable(): Promise<void> {
    this.logger.warn('Emergency disabling quota feature globally');
    this.config.emergencyDisable = true;
    await this.saveConfiguration();
  }

  /**
   * Emergency enable (restore from emergency disable)
   */
  async emergencyEnable(): Promise<void> {
    this.logger.log('Emergency enabling quota feature globally');
    this.config.emergencyDisable = false;
    await this.saveConfiguration();
  }

  /**
   * Get current configuration
   */
  getConfiguration(): QuotaFeatureConfig {
    return { ...this.config };
  }

  /**
   * Get rollout status (matching Spring Boot RolloutStatus)
   */
  async getRolloutStatus(): Promise<RolloutStatus> {
    try {
      const totalHouseholds = await this.householdRepository.count();
      const enabledCount = this.config.enabledHouseholds.size;
      const disabledCount = this.config.disabledHouseholds.size;

      return new RolloutStatus(
        this.config.enabled,
        this.config.rolloutPercentage,
        enabledCount,
        disabledCount,
        this.config.betaMode,
        this.config.emergencyDisable,
      );
    } catch (error) {
      this.logger.error('Error getting rollout status', error);
      return new RolloutStatus(
        this.config.enabled,
        this.config.rolloutPercentage,
        this.config.enabledHouseholds.size,
        this.config.disabledHouseholds.size,
        this.config.betaMode,
        this.config.emergencyDisable,
      );
    }
  }

  /**
   * Get rollout statistics
   */
  async getRolloutStatistics(): Promise<{
    totalHouseholds: number;
    enabledHouseholds: number;
    disabledHouseholds: number;
    rolloutHouseholds: number;
    rolloutPercentage: number;
  }> {
    try {
      const totalHouseholds = await this.householdRepository.count();
      const enabledCount = this.config.enabledHouseholds.size;
      const disabledCount = this.config.disabledHouseholds.size;

      return {
        totalHouseholds,
        enabledHouseholds: enabledCount,
        disabledHouseholds: disabledCount,
        rolloutHouseholds: totalHouseholds - enabledCount - disabledCount,
        rolloutPercentage: this.config.rolloutPercentage,
      };
    } catch (error) {
      this.logger.error('Error calculating rollout statistics', error);
      return {
        totalHouseholds: 0,
        enabledHouseholds: 0,
        disabledHouseholds: 0,
        rolloutHouseholds: 0,
        rolloutPercentage: this.config.rolloutPercentage,
      };
    }
  }

  /**
   * Reset household status to percentage-based rollout (matching Spring Boot)
   */
  async resetHouseholdStatus(householdId: string): Promise<void> {
    this.logger.log(
      `Resetting household ${householdId} to percentage-based rollout`,
    );

    // Remove from both explicit lists
    this.config.enabledHouseholds.delete(householdId);
    this.config.disabledHouseholds.delete(householdId);

    // Save configuration
    await this.saveConfiguration();
  }

  /**
   * Check if beta mode is enabled
   */
  isBetaModeEnabled(): boolean {
    return this.config.betaMode;
  }

  /**
   * Enable beta mode
   */
  async enableBetaMode(): Promise<void> {
    this.logger.log('Enabling quota feature beta mode');
    this.config.betaMode = true;
    await this.saveConfiguration();
  }

  /**
   * Disable beta mode
   */
  async disableBetaMode(): Promise<void> {
    this.logger.log('Disabling quota feature beta mode');
    this.config.betaMode = false;
    await this.saveConfiguration();
  }

  // Private methods

  /**
   * Check if household is included in percentage rollout (matching Spring Boot consistent hashing)
   */
  private isIncludedInPercentageRollout(householdId: string): boolean {
    // Simple hash-based implementation (matching Spring Boot hashCode behavior)
    let hash = 0;
    for (let i = 0; i < householdId.length; i++) {
      const char = householdId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const normalizedHash = Math.abs(hash);
    const hashPercentage = normalizedHash % 100;

    return hashPercentage < this.config.rolloutPercentage;
  }

  /**
   * Load configuration from environment or database (matching Spring Boot exactly)
   */
  private loadConfiguration(): void {
    try {
      // Load from environment variables (matching Spring Boot @ConfigurationProperties)
      const enabled = process.env.QUOTA_FEATURE_ENABLED;
      if (enabled !== undefined) {
        this.config.enabled = enabled.toLowerCase() === 'true';
      }

      const betaMode = process.env.QUOTA_BETA_MODE;
      if (betaMode !== undefined) {
        this.config.betaMode = betaMode.toLowerCase() === 'true';
      }

      const rolloutPercentage = process.env.QUOTA_ROLLOUT_PERCENTAGE;
      if (rolloutPercentage !== undefined) {
        const percentage = parseInt(rolloutPercentage, 10);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
          this.config.rolloutPercentage = percentage;
        }
      }

      const emergencyDisable = process.env.QUOTA_EMERGENCY_DISABLE;
      if (emergencyDisable !== undefined) {
        this.config.emergencyDisable =
          emergencyDisable.toLowerCase() === 'true';
      }

      // Load enabled households from comma-separated list
      const enabledHouseholds = process.env.QUOTA_ENABLED_HOUSEHOLDS;
      if (enabledHouseholds) {
        const householdIds = enabledHouseholds
          .split(',')
          .map((id) => id.trim());
        this.config.enabledHouseholds = new Set(householdIds);
      }

      // Load disabled households from comma-separated list
      const disabledHouseholds = process.env.QUOTA_DISABLED_HOUSEHOLDS;
      if (disabledHouseholds) {
        const householdIds = disabledHouseholds
          .split(',')
          .map((id) => id.trim());
        this.config.disabledHouseholds = new Set(householdIds);
      }

      // TODO: Load household-specific configurations from database
      // This would involve querying a configuration table or settings entity

      this.logDebug('Quota feature configuration loaded', {
        enabled: this.config.enabled,
        betaMode: this.config.betaMode,
        rolloutPercentage: this.config.rolloutPercentage,
        emergencyDisable: this.config.emergencyDisable,
        enabledHouseholdsCount: this.config.enabledHouseholds.size,
        disabledHouseholdsCount: this.config.disabledHouseholds.size,
      });
    } catch (error) {
      this.logger.error('Error loading quota feature configuration', error);
    }
  }

  /**
   * Debug logging method matching Spring Boot beta mode enhancement
   */
  private logDebug(message: string, ...args: any[]): void {
    if (this.config.betaMode || this.logger.debug) {
      this.logger.debug(message, ...args);
    }
  }

  /**
   * Save configuration to database or persistent storage
   */
  private saveConfiguration(): void {
    try {
      // TODO: Save to database configuration table or settings entity
      // This would persist the configuration for restart recovery

      this.logger.debug('Quota feature configuration saved', {
        enabled: this.config.enabled,
        rolloutPercentage: this.config.rolloutPercentage,
        emergencyDisable: this.config.emergencyDisable,
        enabledHouseholdsCount: this.config.enabledHouseholds.size,
        disabledHouseholdsCount: this.config.disabledHouseholds.size,
      });
    } catch (error) {
      this.logger.error('Error saving quota feature configuration', error);
    }
  }
}
