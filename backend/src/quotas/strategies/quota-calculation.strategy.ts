import { QuotaType } from '../enums/quota.enums';
import { Quota } from '../entities/quota.entity';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';

export interface QuotaCalculationStrategy {
  calculateUsage(session: UsageSession, quota: Quota): Promise<number>;
  isValidForOperation(
    session: UsageSession,
    operation: DeviceOperation,
  ): boolean;
  getRemainingQuota(quota: Quota, currentUsage: number): number;
  getQuotaType(): QuotaType;
}
