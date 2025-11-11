import { Injectable } from '@nestjs/common';
import { QuotaType } from '../enums/quota.enums';
import { Quota } from '../entities/quota.entity';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';
import { QuotaCalculationStrategy } from './quota-calculation.strategy';

@Injectable()
export class UsageBasedQuotaStrategy implements QuotaCalculationStrategy {
  getQuotaType(): QuotaType {
    return QuotaType.USAGE_COUNT;
  }

  async calculateUsage(session: UsageSession, _quota: Quota): Promise<number> {
    const metadata = session.metadata ?? {};
    const legacyUsage = Number(metadata.totalUsage ?? 0);
    if (legacyUsage > 0) {
      return legacyUsage;
    }

    const operations = Array.isArray(metadata.operationHistory)
      ? metadata.operationHistory
      : [];
    const countedOperations = operations.filter(
      (op: any) =>
        op &&
        this.isCountedOperation({ type: op.operation } as DeviceOperation),
    );

    return countedOperations.length;
  }

  isValidForOperation(
    session: UsageSession,
    operation: DeviceOperation,
  ): boolean {
    return this.isCountedOperation(operation);
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    const allowed = Number(quota.allowedAmount ?? 0);
    return Math.max(0, allowed - currentUsage);
  }

  private isCountedOperation(operation: DeviceOperation): boolean {
    const countedOperations = [
      'POWER_ON',
      'MODE_CHANGE',
      'TEMPERATURE_CHANGE',
      'FAN_CHANGE',
      'VANE_CHANGE',
      'SWING_CHANGE',
    ];
    return countedOperations.includes(operation.type);
  }
}
