import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsageSession } from '../quotas/entities/usage-session.entity';
import { Quota } from '../quotas/entities/quota.entity';
import { QuotaViolation } from '../quotas/entities/quota-violation.entity';
import { User } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';
import { UsageSessionService } from '../quotas/services/usage-session.service';
import { QuotaViolationsService } from '../quotas/services/quota-violations.service';
import { UsageController } from './usage.controller';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { QuotasModule } from '../quotas/quotas.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsageSession,
      Quota,
      QuotaViolation,
      User,
      Household,
    ]),
    QuotasModule, // Import for QuotaCacheService dependency
    AuthModule, // Import for JwtAccessGuard used by controllers
  ],
  controllers: [UsageController, AnalyticsController],
  providers: [
    UsageSessionService,
    QuotaViolationsService,
    AnalyticsService,
    ConfigService,
  ],
  exports: [UsageSessionService, QuotaViolationsService, AnalyticsService],
})
export class AnalyticsModule {}
