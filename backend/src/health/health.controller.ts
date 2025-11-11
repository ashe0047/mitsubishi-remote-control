import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../shared/database/database.health';
import { RedisHealthIndicator } from '../shared/redis/redis.health';
import { MqttHealthIndicator } from '../shared/mqtt/mqtt.health';

// Interface for detailed health status responses
interface DetailedHealthStatus {
  status: 'up' | 'down';
  details?: Record<string, unknown>;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private healthCheckService: HealthCheckService,
    private databaseHealthIndicator: DatabaseHealthIndicator,
    private redisHealthIndicator: RedisHealthIndicator,
    private mqttHealthIndicator: MqttHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check' })
  async check(): Promise<HealthCheckResult> {
    const healthChecks: HealthIndicatorFunction[] = [
      async () => {
        const isHealthy = await this.databaseHealthIndicator.isHealthy();
        return {
          database: {
            status: isHealthy ? 'up' : 'down',
            message: isHealthy
              ? 'Database is healthy'
              : 'Database is unhealthy',
          },
        };
      },
      async () => {
        const isHealthy = await this.redisHealthIndicator.isHealthy();
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
            message: isHealthy ? 'Redis is healthy' : 'Redis is unhealthy',
          },
        };
      },
      async () => {
        const isHealthy = await this.mqttHealthIndicator.isHealthy();
        return {
          mqtt: {
            status: isHealthy ? 'up' : 'down',
            message: isHealthy ? 'MQTT is healthy' : 'MQTT is unhealthy',
          },
        };
      },
    ];

    return this.healthCheckService.check(healthChecks);
  }

  @Get('database')
  @ApiOperation({ summary: 'Database health check' })
  async checkDatabase(): Promise<DetailedHealthStatus> {
    return this.databaseHealthIndicator.getDetailedStatus();
  }

  @Get('redis')
  @ApiOperation({ summary: 'Redis health check' })
  async checkRedis(): Promise<DetailedHealthStatus> {
    return this.redisHealthIndicator.getDetailedStatus();
  }

  @Get('mqtt')
  @ApiOperation({ summary: 'MQTT health check' })
  async checkMqtt(): Promise<DetailedHealthStatus> {
    return this.mqttHealthIndicator.getDetailedStatus();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async readiness(): Promise<{ status: 'ready' | 'not_ready' }> {
    const checks = await Promise.allSettled([
      this.databaseHealthIndicator.isHealthy(),
      this.redisHealthIndicator.isHealthy(),
    ]);

    const allHealthy = checks.every(
      (result): result is PromiseFulfilledResult<boolean> =>
        result.status === 'fulfilled' && result.value === true,
    );

    return {
      status: allHealthy ? 'ready' : 'not_ready',
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  liveness(): { status: 'alive' | 'not_alive' } {
    // Basic liveness check - if we can respond, we're alive
    return {
      status: 'alive',
    };
  }
}
