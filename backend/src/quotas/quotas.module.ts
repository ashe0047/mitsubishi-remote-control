import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Quota } from './entities/quota.entity';
import { UsageSession } from './entities/usage-session.entity';
import { QuotaOverride } from './entities/quota-override.entity';
import { QuotaViolation } from './entities/quota-violation.entity';
import { WebSocketsModule } from '../shared/websockets/websockets.module';
import { ErrorsModule } from '../shared/errors/errors.module';
import { AuthModule } from '../auth/auth.module';

// Services
import { QuotaValidationService } from './services/quota-validation.service';
import { QuotaCacheService } from './services/quota-cache.service';
import { UsageSessionService } from './services/usage-session.service';
import { QuotaCalculationEngine } from './services/quota-calculation-engine.service';
import { QuotaService } from './services/quota.service';
import { QuotaOverrideService } from './services/quota-override.service';
import { QuotaViolationsService } from './services/quota-violations.service';

// Strategies
import { TimeBasedQuotaStrategy } from './strategies/time-based.strategy';
import { UsageBasedQuotaStrategy } from './strategies/usage-based.strategy';
import { EnergyBasedQuotaStrategy } from './strategies/energy-based.strategy';
import { CostBasedQuotaStrategy } from './strategies/cost-based.strategy';

// Controllers
import { QuotaController } from './controllers/quota.controller';
import { QuotaOverrideController } from './controllers/quota-override.controller';
import { QuotaViolationsController } from './controllers/quota-violations.controller';
import { UsageSessionController } from './controllers/usage-session.controller';

// WebSocket Gateways
// import { QuotaGateway } from './quota.gateway.backup';

@Module({
  imports: [
    WebSocketsModule, // Import shared WebSocket infrastructure
    ErrorsModule, // Import error handling services
    AuthModule, // Import for JwtAccessGuard and TokensService
    TypeOrmModule.forFeature([
      Quota,
      UsageSession,
      QuotaOverride,
      QuotaViolation,
    ]),
    ConfigModule,
  ],
  controllers: [
    QuotaController,
    QuotaOverrideController,
    QuotaViolationsController,
    UsageSessionController,
  ],
  providers: [
    // Core services
    QuotaService,
    QuotaOverrideService,
    QuotaViolationsService,
    QuotaValidationService,
    QuotaCacheService,
    UsageSessionService,
    QuotaCalculationEngine,

    // Strategy implementations
    TimeBasedQuotaStrategy,
    UsageBasedQuotaStrategy,
    EnergyBasedQuotaStrategy,
    CostBasedQuotaStrategy,

    // WebSocket Gateways
    // QuotaGateway,
  ],
  exports: [
    QuotaService,
    QuotaOverrideService,
    QuotaViolationsService,
    QuotaValidationService,
    QuotaCacheService,
    UsageSessionService,
    QuotaCalculationEngine,
  ],
})
export class QuotasModule {}
