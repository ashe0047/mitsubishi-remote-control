import { Injectable } from '@nestjs/common';
import { QuotaType } from '../enums/quota.enums';
import { Quota } from '../entities/quota.entity';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';
import { QuotaCalculationStrategy } from './quota-calculation.strategy';

@Injectable()
export class EnergyBasedQuotaStrategy implements QuotaCalculationStrategy {
  getQuotaType(): QuotaType {
    return QuotaType.ENERGY_BASED;
  }

  async calculateUsage(session: UsageSession, _quota: Quota): Promise<number> {
    const recordedEnergy = Number(session.energyConsumed ?? 0);
    if (recordedEnergy > 0) {
      return recordedEnergy;
    }

    // Fallback: approximate energy using duration and default power draw
    const durationMs = session.duration;
    const powerRating = this.getDevicePowerRating(session.metadata ?? {});
    return this.calculateEnergyConsumption(durationMs, powerRating);
  }

  isValidForOperation(
    session: UsageSession,
    operation: DeviceOperation,
  ): boolean {
    // Energy consumption only happens when device is ON
    return this.isEnergyConsumingOperation(operation);
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    const allowed = Number(quota.allowedAmount ?? 0);
    return Math.max(0, allowed - currentUsage);
  }

  private isEnergyConsumingOperation(operation: DeviceOperation): boolean {
    // Device must be ON to consume energy
    // This would be determined by device state, not operation type
    return operation.type !== 'POWER_OFF' && operation.type !== 'READ_ONLY';
  }

  private calculateEnergyConsumption(
    durationMs: number,
    powerRatingKw: number,
  ): number {
    const durationHours = durationMs / (1000 * 60 * 60);
    return powerRatingKw * durationHours;
  }

  private getDevicePowerRating(deviceState: Record<string, unknown>): number {
    // Default power rating in kW
    const defaultPower = 1.5; // 1.5kW typical for AC

    // Device-specific power calculation

    if (deviceState.mode === 'heat_cool' || deviceState.mode === 'heat') {
      return defaultPower * 1.2; // 20% more power for heating/cooling
    }

    return defaultPower;
  }
}
