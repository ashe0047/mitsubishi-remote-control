import { Module, Global } from '@nestjs/common';
import { CacheModule as BaseCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './services/cache.service';
import { CacheManagerService } from './services/cache.service';
import { ErrorHandlerService } from '../errors/services/error-handler.service';
import type { CacheModuleOptions } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Shared Cache Module Configuration
 *
 * Provides centralized caching with Redis backend for all application modules.
 * Features:
 * - Type-safe generic cache operations
 * - Redis store with configurable connection
 * - Multi-layer caching support (memory + Redis)
 * - Automatic failover and error handling
 * - Performance monitoring and statistics
 * - Namespace-based key isolation
 */
@Global()
@Module({
  imports: [
    BaseCacheModule.registerAsync({
      imports: [ConfigModule],
      //eslint-disable-next-line @typescript-eslint/require-await
      useFactory: async (
        configService: ConfigService,
      ): Promise<CacheModuleOptions> => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisDb = configService.get<number>('REDIS_DB', 0);
        const cacheTTL = configService.get<number>('CACHE_TTL', 300000); // 5 minutes
        const cacheNamespace = configService.get<string>(
          'CACHE_NAMESPACE',
          'app',
        );

        // Configure Redis connection string for Keyv
        const redisUrl = `redis://${redisPassword ? `${redisPassword}@` : ''}${redisHost}:${redisPort}/${redisDb}`;

        // Create Redis store using Keyv with proper options
        const redisStore = new KeyvRedis(redisUrl, {
          useUnlink: true,
          clearBatchSize: 1000,
          throwOnConnectError: true,
          namespace: cacheNamespace,
        });

        return {
          // Use Redis store as backend
          stores: [redisStore],
          ttl: cacheTTL,
          isGlobal: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: CacheService,
      useFactory: (
        cacheManager: Cache,
        configService: ConfigService,
        errorHandlerService?: ErrorHandlerService,
      ) => {
        return new CacheService(
          cacheManager,
          configService,
          errorHandlerService,
          'default',
        );
      },
      inject: [
        'CACHE_MANAGER',
        ConfigService,
        { token: ErrorHandlerService, optional: true },
      ],
    },
    CacheManagerService,
  ],
  exports: [
    CacheService,
    CacheManagerService,
    // Export CACHE_MANAGER for direct access if needed
    'CACHE_MANAGER',
  ],
})
export class CacheModule {}
