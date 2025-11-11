import { Injectable } from '@nestjs/common';
import { QuotaType } from '../enums/quota.enums';
import { Quota } from '../entities/quota.entity';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';
import { QuotaCalculationStrategy } from './quota-calculation.strategy';

@Injectable()
export class TimeBasedQuotaStrategy implements QuotaCalculationStrategy {
  getQuotaType(): QuotaType {
    return QuotaType.TIME_BASED;
  }

  async calculateUsage(session: UsageSession, _quota: Quota): Promise<number> {
    const durationMinutes = this.getDurationMinutes(session);
    const legacyTotalUsage = this.getLegacyTotalUsage(session);

    // Prefer explicit durationMinutes; fall back to legacy totalUsage counter
    if (durationMinutes > 0) {
      return durationMinutes;
    }

    return legacyTotalUsage;
  }

  isValidForOperation(
    session: UsageSession,
    operation: DeviceOperation,
  ): boolean {
    // For time-based quotas, any operation that keeps device ON uses quota
    return this.isQuotaConsumingOperation(operation);
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    const allowed = Number(quota.allowedAmount ?? 0);
    return Math.max(0, allowed - currentUsage);
  }

  private isQuotaConsumingOperation(operation: DeviceOperation): boolean {
    const nonConsumingOperations = ['READ_ONLY', 'STATUS_CHECK', 'POWER_OFF'];
    return !nonConsumingOperations.includes(operation.type);
  }

  private getDurationMinutes(session: UsageSession): number {
    if (session.durationMinutes && session.durationMinutes > 0) {
      return session.durationMinutes;
    }

    if (session.isCompleted || session.isInterrupted || session.isOverride) {
      return session.calculatedDurationMinutes;
    }

    return session.calculatedDurationMinutes;
  }

  private getLegacyTotalUsage(session: UsageSession): number {
    const totalUsage = session.totalUsage;
    return typeof totalUsage === 'number' && !Number.isNaN(totalUsage)
      ? totalUsage
      : 0;
  }
}
