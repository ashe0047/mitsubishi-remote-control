import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Quota } from '../entities/quota.entity';
import { QuotaOverride } from '../entities/quota-override.entity';
import { QuotaValidationResult } from '../interfaces/device-operation.interface';

@Injectable()
export class QuotaCacheService {
  private readonly logger = new Logger(QuotaCacheService.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'quota:';
  private readonly defaultTTL = 300; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get('REDIS_PORT', '6379'), 10),
      password: this.configService.get('REDIS_PASSWORD'),
      db: parseInt(this.configService.get('REDIS_DATABASE', '0'), 10),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  // Validation result caching
  async getValidationResult(
    key: string,
  ): Promise<QuotaValidationResult | null> {
    try {
      const data = await this.redis.get(`${this.keyPrefix}validation:${key}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get validation result for key: ${key}`,
        error,
      );
      return null;
    }
  }

  async setValidationResult(
    key: string,
    result: QuotaValidationResult,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}validation:${key}`,
        ttl,
        JSON.stringify(result),
      );
    } catch (error) {
      this.logger.error(
        `Failed to set validation result for key: ${key}`,
        error,
      );
    }
  }

  async invalidateValidationResults(pattern: string): Promise<void> {
    try {
      const patternKey = `${this.keyPrefix}validation:${pattern}`;
      const keys = await this.redis.keys(patternKey);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(
        `Failed to invalidate validation results for pattern: ${pattern}`,
        error,
      );
    }
  }

  // User quotas caching
  async getUserQuotas(key: string): Promise<Quota[] | null> {
    try {
      const data = await this.redis.get(`${this.keyPrefix}user_quotas:${key}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get user quotas for key: ${key}`, error);
      return null;
    }
  }

  async setUserQuotas(
    key: string,
    quotas: Quota[],
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}user_quotas:${key}`,
        ttl,
        JSON.stringify(quotas),
      );
    } catch (error) {
      this.logger.error(`Failed to set user quotas for key: ${key}`, error);
    }
  }

  async invalidateUserQuotas(key: string): Promise<void> {
    try {
      await this.redis.del(`${this.keyPrefix}user_quotas:${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate user quotas for key: ${key}`,
        error,
      );
    }
  }

  // Override caching
  async getActiveOverride(quotaId: string): Promise<QuotaOverride | null> {
    try {
      const data = await this.redis.get(`${this.keyPrefix}override:${quotaId}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get active override for quota: ${quotaId}`,
        error,
      );
      return null;
    }
  }

  async setActiveOverride(
    quotaId: string,
    override: QuotaOverride,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}override:${quotaId}`,
        ttl,
        JSON.stringify(override),
      );
    } catch (error) {
      this.logger.error(
        `Failed to set active override for quota: ${quotaId}`,
        error,
      );
    }
  }

  async invalidateOverride(quotaId: string): Promise<void> {
    try {
      await this.redis.del(`${this.keyPrefix}override:${quotaId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate override for quota: ${quotaId}`,
        error,
      );
    }
  }

  // Session caching
  async getSession(sessionId: string): Promise<unknown> {
    try {
      const data = await this.redis.get(
        `${this.keyPrefix}session:${sessionId}`,
      );
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get session: ${sessionId}`, error);
      return null;
    }
  }

  async setSession(
    sessionId: string,
    session: any,
    ttl: number = 3600,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}session:${sessionId}`,
        ttl,
        JSON.stringify(session),
      );
    } catch (error) {
      this.logger.error(`Failed to set session: ${sessionId}`, error);
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`${this.keyPrefix}session:${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate session: ${sessionId}`, error);
    }
  }

  // Usage tracking caching
  async getCurrentUsage(key: string): Promise<number | null> {
    try {
      const data = await this.redis.get(`${this.keyPrefix}usage:${key}`);
      return data ? parseFloat(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get current usage for key: ${key}`, error);
      return null;
    }
  }

  async setCurrentUsage(
    key: string,
    usage: number,
    ttl: number = 60,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}usage:${key}`,
        ttl,
        usage.toString(),
      );
    } catch (error) {
      this.logger.error(`Failed to set current usage for key: ${key}`, error);
    }
  }

  async incrementUsage(key: string, increment: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(
        `${this.keyPrefix}usage:${key}`,
        increment,
      );
    } catch (error) {
      this.logger.error(`Failed to increment usage for key: ${key}`, error);
      return 0;
    }
  }

  // Performance metrics caching
  async getPerformanceMetrics(key: string): Promise<unknown> {
    try {
      const data = await this.redis.get(`${this.keyPrefix}metrics:${key}`);

      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get performance metrics for key: ${key}`,
        error,
      );
      return null;
    }
  }

  async setPerformanceMetrics(
    key: string,
    metrics: any,
    ttl: number = 300,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${this.keyPrefix}metrics:${key}`,
        ttl,
        JSON.stringify(metrics),
      );
    } catch (error) {
      this.logger.error(
        `Failed to set performance metrics for key: ${key}`,
        error,
      );
    }
  }

  // Cache management
  async clearAllQuotaCache(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cleared ${keys.length} quota cache entries`);
      }
    } catch (error) {
      this.logger.error('Failed to clear quota cache', error);
    }
  }

  async getCacheStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      return {
        memory: info,
        keyspace,
        connected: this.redis.status === 'ready',
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return null;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
