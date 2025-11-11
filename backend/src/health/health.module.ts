import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../shared/database/database.module';
import { RedisModule } from '../shared/redis/redis.module';
import { MqttModule } from '../shared/mqtt/mqtt.module';

@Module({
  imports: [
    TerminusModule.forRoot({
      logger: false,
    }),
    DatabaseModule,
    RedisModule,
    MqttModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
