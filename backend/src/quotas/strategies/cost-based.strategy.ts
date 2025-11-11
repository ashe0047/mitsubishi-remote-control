import { Injectable } from '@nestjs/common';
import { QuotaType } from '../enums/quota.enums';
import { Quota } from '../entities/quota.entity';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';
import { QuotaCalculationStrategy } from './quota-calculation.strategy';

@Injectable()
export class CostBasedQuotaStrategy implements QuotaCalculationStrategy {
  getQuotaType(): QuotaType {
    return QuotaType.COST_BASED;
  }

  async calculateUsage(session: UsageSession, quota: Quota): Promise<number> {
    const recordedCost = Number(session.estimatedCost ?? 0);
    if (recordedCost > 0) {
      return recordedCost;
    }

    const energyConsumed = Number(session.energyConsumed ?? 0);
    if (energyConsumed > 0) {
      return this.calculateCostFromEnergy(energyConsumed, quota);
    }

    const durationMs = session.duration;
    const powerRating = this.getDevicePowerRating(session.metadata ?? {});
    const energyEstimate = this.calculateEnergyFromDuration(
      durationMs,
      powerRating,
    );
    return this.calculateCostFromEnergy(energyEstimate, quota);
  }

  isValidForOperation(
    // eslint-disable @typescript-eslint/no-unused-vars
    _session: UsageSession,
    // eslint-disable @typescript-eslint/no-unused-vars
    _operation: DeviceOperation,
  ): boolean {
    return true;
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    const allowed = Number(quota.allowedAmount ?? 0);
    return Math.max(0, allowed - currentUsage);
  }

  calculateOperationCost(
    operation: DeviceOperation,

    deviceState: any,
    duration: number,
    quota: Quota,
  ): number {
    // Calculate cost based on energy consumption and rates
    const energyConsumed = this.calculateEnergyConsumption(
      operation,
      deviceState,
      duration,
    );
    const energyRate = 0.15; // Default $0.15 per kWh - TODO: Implement settings in Quota entity if needed

    return energyConsumed * energyRate;
  }

  private calculateEnergyConsumption(
    operation: DeviceOperation,

    deviceState: any,
    duration: number,
  ): number {
    const powerRating = this.getDevicePowerRating(deviceState);
    const durationHours = duration / (1000 * 60 * 60);

    return powerRating * durationHours;
  }

  private getDevicePowerRating(deviceState: any): number {
    const defaultPower = 1.5;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (deviceState.mode === 'heat_cool' || deviceState.mode === 'heat') {
      return defaultPower * 1.2;
    }

    return defaultPower;
  }

  private calculateCostFromEnergy(energyKwh: number, quota: Quota): number {
    const rate = this.getEnergyRate(quota);
    return energyKwh * rate;
  }

  private calculateEnergyFromDuration(
    duration: number,
    powerRating: number,
  ): number {
    const durationHours = duration / (1000 * 60 * 60);
    return powerRating * durationHours;
  }

  private getEnergyRate(_quota: Quota): number {
    // Future: pull from quota.settings; for now use default of $0.15/kWh
    return 0.15;
  }
}
