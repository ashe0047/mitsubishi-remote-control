import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { MqttModule } from './shared/mqtt/mqtt.module';
import { ErrorsModule } from './shared/errors/errors.module';
import { WebSocketsModule } from './shared/websockets/websockets.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HouseholdsModule } from './households/households.module';
import { RoomsModule } from './rooms/rooms.module';
import { DevicesModule } from './devices/devices.module';
import { QuotasModule } from './quotas/quotas.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsersController } from './users/users.controller';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    // Core configuration and infrastructure modules
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    MqttModule,
    ErrorsModule, // Centralized error handling
    WebSocketsModule, // Global WebSocket infrastructure
    HealthModule,
    // Feature modules
    UsersModule,
    HouseholdsModule,
    AuthModule,
    RoomsModule,
    DevicesModule,
    QuotasModule,
    EventEmitterModule.forRoot(),
    AnalyticsModule,
  ],
  controllers: [AppController, UsersController],
  providers: [AppService],
})
export class AppModule {}
