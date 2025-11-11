import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async isHealthy(): Promise<boolean> {
    try {
      // Test Redis connectivity with ping command
      const result: string = await this.redis.ping();
      const isHealthy = result === 'PONG';

      if (isHealthy) {
        this.logger.debug('Redis health check passed');
      } else {
        this.logger.warn(
          `Redis health check failed: unexpected ping response ${result}`,
        );
      }

      return isHealthy;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Redis health check failed: ${err.message}`);
      return false;
    }
  }

  async getDetailedStatus(): Promise<{
    status: 'up' | 'down';
    details?: Record<string, unknown>;
  }> {
    try {
      const pingResult = await this.redis.ping();
      const info = await this.redis.info('server');

      return {
        status: 'up',
        details: {
          connected: true,
          ping: pingResult,
          server: this.parseRedisInfo(info),
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        status: 'down',
        details: {
          connected: false,
          error: err.message,
        },
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, unknown> {
    const lines = info.split('\r\n');
    const serverInfo: Record<string, string> = {};

    lines.forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          serverInfo[key] = value;
        }
      }
    });

    return {
      version: serverInfo.redis_version,

      uptime: serverInfo.uptime_in_seconds,

      connected_clients: serverInfo.connected_clients,

      used_memory: serverInfo.used_memory_human,
    };
  }
}
