import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisHealthIndicator } from './redis.health';

// ioredis client configuration for Redis integration
// Documentation: https://context7.com/redis/ioredis/llms.txt
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('redis.host', 'localhost'),
          port: configService.get('redis.port', 6379),
          password: configService.get('redis.password'),
          maxRetriesPerRequest: 3,
          // Connection retry strategy for resilience
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          // Enable lazy connect to test connection in health check
          lazyConnect: true,
          // Reconnect on connection loss
          autoResubscribe: true,
          autoResendUnfulfilledCommands: true,
        });
      },
      inject: [ConfigService],
    },
    RedisHealthIndicator,
  ],
  exports: ['REDIS_CLIENT', RedisHealthIndicator],
})
export class RedisModule {}
