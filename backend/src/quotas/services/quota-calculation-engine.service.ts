import { Injectable } from '@nestjs/common';
import { QuotaType } from '../enums/quota.enums';
import { TimeBasedQuotaStrategy } from '../strategies/time-based.strategy';
import { UsageBasedQuotaStrategy } from '../strategies/usage-based.strategy';
import { EnergyBasedQuotaStrategy } from '../strategies/energy-based.strategy';
import { CostBasedQuotaStrategy } from '../strategies/cost-based.strategy';
import { QuotaCalculationStrategy } from '../strategies/quota-calculation.strategy';

@Injectable()
export class QuotaCalculationEngine {
  private readonly strategies = new Map<QuotaType, QuotaCalculationStrategy>();

  constructor(
    private readonly timeBasedStrategy: TimeBasedQuotaStrategy,
    private readonly usageBasedStrategy: UsageBasedQuotaStrategy,
    private readonly energyBasedStrategy: EnergyBasedQuotaStrategy,
    private readonly costBasedStrategy: CostBasedQuotaStrategy,
  ) {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set(QuotaType.TIME_BASED, this.timeBasedStrategy);
    this.strategies.set(QuotaType.USAGE_COUNT, this.usageBasedStrategy);
    this.strategies.set(QuotaType.ENERGY_BASED, this.energyBasedStrategy);
    this.strategies.set(QuotaType.COST_BASED, this.costBasedStrategy);
  }

  getStrategy(quotaType: QuotaType): QuotaCalculationStrategy {
    const strategy = this.strategies.get(quotaType);
    if (!strategy) {
      throw new Error(`No strategy found for quota type: ${quotaType}`);
    }
    return strategy;
  }

  // Static utility methods
  static calculateUsagePercentage(used: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, (used / total) * 100);
  }

  static isWarningThreshold(
    percentage: number,
    threshold: number = 75,
  ): boolean {
    return percentage >= threshold;
  }

  static calculateRemaining(used: number, total: number): number {
    return Math.max(0, total - used);
  }

  static formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static formatEnergy(kwh: number): string {
    if (kwh >= 1) {
      return `${kwh.toFixed(2)} kWh`;
    } else {
      return `${(kwh * 1000).toFixed(0)} Wh`;
    }
  }

  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
