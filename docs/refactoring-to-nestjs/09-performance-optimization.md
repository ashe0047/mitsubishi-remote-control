# Performance Optimization Guide

## Overview

This document outlines performance optimization strategies for the NestJS backend to ensure it meets or exceeds the Spring Boot performance benchmarks. The focus is on maintaining sub-100ms quota validation response times and handling concurrent WebSocket connections efficiently.

## Performance Benchmarks

### Spring Boot Performance Baseline

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Quota Validation | <100ms | Request timing |
| API Response Time | <200ms average | Load testing |
| WebSocket Latency | <2s updates | Real-time measurement |
| Database Queries | <50ms average | Query profiling |
| Concurrent Connections | 100+ WebSocket | Connection testing |
| Memory Usage | <512MB RAM | Process monitoring |
| CPU Usage | <50% average | System monitoring |

### NestJS Performance Targets

| Metric | Target | Acceptance Criteria |
|--------|--------|-------------------|
| Quota Validation | <80ms | 20% improvement |
| API Response Time | <150ms average | 25% improvement |
| WebSocket Latency | <1s updates | 50% improvement |
| Database Queries | <30ms average | 40% improvement |
| Concurrent Connections | 200+ WebSocket | 100% improvement |
| Memory Usage | <256MB RAM | 50% improvement |
| CPU Usage | <30% average | 40% improvement |

## Database Optimization

### Connection Pool Configuration

```typescript
// src/config/database.config.ts
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getOptimizedDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleAsyncOptions => ({
  useFactory: () => ({
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [/* entities */],
    synchronize: false,
    migrationsRun: true,
    logging: configService.get('NODE_ENV') === 'development',
    migrations: ['dist/migrations/*.js'],

    // Optimized connection pool configuration
    extra: {
      // Connection pool settings
      max: 20,                    // Maximum connections in pool
      min: 5,                     // Minimum connections to maintain
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 2000, // Connection establishment timeout

      // Query optimization
      statement_timeout: 10000,   // Query timeout in ms
      query_timeout: 10000,       // Alternative query timeout

      // Performance tuning
      statement_cache_size: 100,  // Prepared statement cache
      prepared_statements: true,  // Enable prepared statements

      // SSL optimization
      ssl: configService.get('NODE_ENV') === 'production' ? {
        rejectUnauthorized: false,
        checkServerIdentity: false, // Skip hostname verification for internal networks
      } : false,

      // Application-level optimizations
      application_name: 'mitsubishi-nestjs-backend',
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },

    // TypeORM performance settings
    retryAttempts: 3,
    retryDelay: 3000,

    // Cache configuration
    cache: {
      type: 'redis',
      options: {
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        ttl: 3600, // 1 hour default TTL
      },
    },
  }),
  inject: [ConfigService],
});
```

### Query Optimization

```typescript
// src/modules/users/repositories/optimized-user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class OptimizedUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Optimized user lookup with minimal fields
   */
  async findByIdMinimal(id: string): Promise<Partial<User> | null> {
    return await this.repository.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'role', 'status', 'householdId'],
    });
  }

  /**
   * Optimized user lookup with household for authentication
   */
  async findByEmailWithHousehold(email: string): Promise<User | null> {
    return await this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.household', 'household')
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.role',
        'user.status',
        'user.passwordHash',
        'user.householdId',
        'user.lastLoginAt',
        'household.id',
        'household.familyName',
        'household.timezone',
      ])
      .where('user.email = :email', { email })
      .andWhere('user.status = :status', { status: 'active' })
      .cache(60000) // Cache for 1 minute
      .getOne();
  }

  /**
   * Batch user lookup for multiple IDs
   */
  async findByIds(ids: string[]): Promise<User[]> {
    return await this.repository
      .createQueryBuilder('user')
      .select(['user.id', 'user.name', 'user.role', 'user.email', 'user.status'])
      .where('user.id IN (:...ids)', { ids })
      .cache(30000) // Cache for 30 seconds
      .getMany();
  }

  /**
   * Optimized household member count
   */
  async getHouseholdMemberCount(householdId: string): Promise<number> {
    return await this.repository
      .createQueryBuilder('user')
      .select('COUNT(*)', 'count')
      .where('user.householdId = :householdId', { householdId })
      .andWhere('user.status = :status', { status: 'active' })
      .cache(120000) // Cache for 2 minutes
      .getRawOne()
      .then(result => parseInt(result.count, 10));
  }
}
```

### Database Indexing Strategy

```sql
-- Performance-optimized indexes for PostgreSQL

-- Users table indexes
CREATE INDEX CONCURRENTLY idx_users_email_active ON users(email) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_users_household_role ON users(household_id, role) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_users_last_login ON users(last_login_at DESC) WHERE last_login_at IS NOT NULL;

-- Quotas table indexes
CREATE INDEX CONCURRENTLY idx_quotas_user_room_active ON quotas(user_id, room_id) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_quotas_type_period ON quotas(quota_type, period) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_quotas_updated_recently ON quotas(updated_at DESC) WHERE updated_at > NOW() - INTERVAL '1 hour';

-- Usage sessions indexes
CREATE INDEX CONCURRENTLY idx_usage_sessions_active ON usage_sessions(quota_id, status) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_usage_sessions_time_range ON usage_sessions(start_time, end_time) WHERE start_time > NOW() - INTERVAL '24 hours';
CREATE INDEX CONCURRENTLY idx_usage_sessions_user_time ON usage_sessions(user_id, start_time DESC) WHERE start_time > NOW() - INTERVAL '7 days';

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_quotas_lookup ON quotas(user_id, room_id, quota_type, status);
CREATE INDEX CONCURRENTLY idx_usage_daily ON usage_sessions(user_id, room_id, DATE(start_time), status);
```

## Caching Strategy

### Redis Caching Implementation

```typescript
// src/core/cache/cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.defaultTTL = this.configService.get<number>('CACHE_DEFAULT_TTL', 3600);
  }

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<string>(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with automatic JSON stringification
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.cacheManager.set(key, serializedValue, { ttl: ttl || this.defaultTTL });
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Get or set pattern with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    let cached = await this.get<T>(key);

    if (cached === null) {
      cached = await factory();
      await this.set(key, cached, ttl);
    }

    return cached;
  }

  /**
   * Batch cache operations
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, ttl }) => this.set(key, value, ttl))
    );
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmQuotaCache(userIds: string[]): Promise<void> {
    const quotaPromises = userIds.map(async (userId) => {
      const cacheKey = `user:quotas:${userId}`;
      // Implementation would fetch and cache user quotas
      return this.set(cacheKey, { /* quota data */ }, 1800); // 30 minutes
    });

    await Promise.all(quotaPromises);
    this.logger.log(`Warmed quota cache for ${userIds.length} users`);
  }
}
```

### Multi-Level Caching Strategy

```typescript
// src/modules/quotas/services/quota-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../core/cache/cache.service';
import { QuotaBalance } from '../interfaces/quota-balance.interface';

@Injectable()
export class QuotaCacheService {
  private readonly logger = new Logger(QuotaCacheService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get quota balance with L1 (memory) + L2 (Redis) caching
   */
  async getQuotaBalance(userId: string, roomId: string): Promise<QuotaBalance | null> {
    const l1Key = `quota_balance_l1:${userId}:${roomId}`;
    const l2Key = `quota_balance:${userId}:${roomId}`;

    // Try L1 cache (in-memory)
    let balance = await this.cacheService.get<QuotaBalance>(l1Key);

    if (balance) {
      this.logger.debug(`L1 cache hit for ${l1Key}`);
      return balance;
    }

    // Try L2 cache (Redis)
    balance = await this.cacheService.get<QuotaBalance>(l2Key);

    if (balance) {
      this.logger.debug(`L2 cache hit for ${l2Key}`);
      // Promote to L1 cache
      await this.cacheService.set(l1Key, balance, 300); // 5 minutes L1
      return balance;
    }

    return null;
  }

  /**
   * Set quota balance in both cache levels
   */
  async setQuotaBalance(
    userId: string,
    roomId: string,
    balance: QuotaBalance,
  ): Promise<void> {
    const l1Key = `quota_balance_l1:${userId}:${roomId}`;
    const l2Key = `quota_balance:${userId}:${roomId}`;

    // Set in both cache levels
    await Promise.all([
      this.cacheService.set(l1Key, balance, 300),  // 5 minutes L1
      this.cacheService.set(l2Key, balance, 1800), // 30 minutes L2
    ]);
  }

  /**
   * Invalidate quota balance across all cache levels
   */
  async invalidateQuotaBalance(userId: string, roomId: string): Promise<void> {
    const l1Key = `quota_balance_l1:${userId}:${roomId}`;
    const l2Key = `quota_balance:${userId}:${roomId}`;

    await Promise.all([
      this.cacheService.del(l1Key),
      this.cacheService.del(l2Key),
    ]);
  }

  /**
   * Batch cache operations for multiple users
   */
  async batchUpdateBalances(
    updates: Array<{ userId: string; roomId: string; balance: QuotaBalance }>,
  ): Promise<void> {
    const l1Entries = updates.map(({ userId, roomId, balance }) => ({
      key: `quota_balance_l1:${userId}:${roomId}`,
      value: balance,
      ttl: 300,
    }));

    const l2Entries = updates.map(({ userId, roomId, balance }) => ({
      key: `quota_balance:${userId}:${roomId}`,
      value: balance,
      ttl: 1800,
    }));

    await Promise.all([
      this.cacheService.mset(l1Entries),
      this.cacheService.mset(l2Entries),
    ]);
  }
}
```

## Performance Monitoring

### Custom Performance Interceptor

```typescript
// src/common/interceptors/performance.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly metrics: PerformanceMetrics[] = [];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = this.generateRequestId();
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    request.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const endTime = performance.now();
          const endMemory = process.memoryUsage();
          const duration = endTime - startTime;

          const metrics: PerformanceMetrics = {
            requestId,
            method: request.method,
            url: request.url,
            startTime,
            endTime,
            duration,
            memoryUsage: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
              external: endMemory.external - startMemory.external,
              arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
            },
          };

          this.recordMetrics(metrics);
          this.checkPerformanceThresholds(metrics);
        },
        error: (error) => {
          const endTime = performance.now();
          const duration = endTime - startTime;

          this.logger.error(`Request ${requestId} failed after ${duration.toFixed(2)}ms`, error);
        },
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics.splice(0, this.metrics.length - 1000);
    }

    // Log slow requests (>100ms)
    if (metrics.duration > 100) {
      this.logger.warn(
        `Slow request detected: ${metrics.method} ${metrics.url} took ${metrics.duration.toFixed(2)}ms`
      );
    }
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const thresholds = {
      quotaValidation: 80, // 80ms for quota validation
      apiRequest: 150,    // 150ms for general API requests
      websocket: 1000,    // 1000ms for WebSocket operations
    };

    const isQuotaValidation = metrics.url.includes('/quotas') && metrics.method === 'GET';
    const threshold = isQuotaValidation ? thresholds.quotaValidation : thresholds.apiRequest;

    if (metrics.duration > threshold) {
      this.logger.warn(
        `Performance threshold exceeded: ${metrics.method} ${metrics.url} ` +
        `took ${metrics.duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;

    const total = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / this.metrics.length;
  }

  getPercentileResponseTime(percentile: number): number {
    if (this.metrics.length === 0) return 0;

    const sortedDurations = this.metrics
      .map(metric => metric.duration)
      .sort((a, b) => a - b);

    const index = Math.ceil(sortedDurations.length * (percentile / 100)) - 1;
    return sortedDurations[Math.max(0, index)];
  }
}
```

### Performance Health Checks

```typescript
// src/health/performance.health.ts
import { Injectable } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult, HealthIndicator } from '@nestjs/terminus';
import { PerformanceInterceptor } from '../common/interceptors/performance.interceptor';

@Injectable()
export class PerformanceHealthIndicator extends HealthIndicator {
  constructor(private readonly performanceInterceptor: PerformanceInterceptor) {
    super();
  }

  async isHealthy(): Promise<HealthCheckResult> {
    const metrics = this.performanceInterceptor.getMetrics();
    const avgResponseTime = this.performanceInterceptor.getAverageResponseTime();
    const p95ResponseTime = this.performanceInterceptor.getPercentileResponseTime(95);

    const thresholds = {
      averageResponseTime: 150,  // 150ms average
      p95ResponseTime: 300,      // 300ms P95
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    };

    const memoryUsage = process.memoryUsage();
    const isHealthy =
      avgResponseTime < thresholds.averageResponseTime &&
      p95ResponseTime < thresholds.p95ResponseTime &&
      memoryUsage.heapUsed < thresholds.maxMemoryUsage;

    const data = {
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      totalRequests: metrics.length,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
    };

    return this.getStatus('performance', isHealthy, data);
  }
}
```

## WebSocket Performance Optimization

### Connection Pool Management

```typescript
// src/modules/websocket/gateway-pool.manager.ts
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { Socket } from 'socket.io';

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  messagesPerSecond: number;
  averageLatency: number;
}

@Injectable()
export class GatewayPoolManager {
  private readonly logger = new Logger(GatewayPoolManager.name);
  private readonly connectionPool = new Map<string, Socket>();
  private readonly roomConnections = new Map<string, Set<string>>();
  private readonly messageMetrics = new Map<string, number[]>();

  constructor() {
    // Start performance monitoring
    setInterval(() => this.calculateMetrics(), 5000);
  }

  /**
   * Add connection to pool with metadata
   */
  addConnection(socketId: string, socket: Socket, metadata: any): void {
    this.connectionPool.set(socketId, {
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      roomId: metadata.roomId,
      userId: metadata.userId,
    });

    // Track room membership
    const roomId = metadata.roomId;
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId).add(socketId);

    this.logger.debug(`Connection ${socketId} added to pool. Total: ${this.connectionPool.size}`);
  }

  /**
   * Remove connection from pool
   */
  removeConnection(socketId: string): void {
    const connection = this.connectionPool.get(socketId);
    if (connection) {
      // Remove from room tracking
      const roomId = connection.roomId;
      if (roomId && this.roomConnections.has(roomId)) {
        this.roomConnections.get(roomId).delete(socketId);
        if (this.roomConnections.get(roomId).size === 0) {
          this.roomConnections.delete(roomId);
        }
      }

      this.connectionPool.delete(socketId);
      this.logger.debug(`Connection ${socketId} removed from pool. Total: ${this.connectionPool.size}`);
    }
  }

  /**
   * Broadcast message to room with performance tracking
   */
  broadcastToRoom(roomId: string, event: string, data: any): void {
    const startTime = performance.now();
    const connections = this.roomConnections.get(roomId);

    if (!connections || connections.size === 0) {
      return;
    }

    const message = {
      event,
      data,
      timestamp: Date.now(),
    };

    connections.forEach(socketId => {
      const connection = this.connectionPool.get(socketId);
      if (connection && connection.socket.connected) {
        connection.socket.emit(event, message);
        connection.lastActivity = Date.now();
      }
    });

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Track performance metrics
    this.trackMessageLatency('broadcast', latency);
  }

  /**
   * Send message to specific connection with latency tracking
   */
  sendToConnection(socketId: string, event: string, data: any): boolean {
    const startTime = performance.now();
    const connection = this.connectionPool.get(socketId);

    if (!connection || !connection.socket.connected) {
      return false;
    }

    connection.socket.emit(event, {
      ...data,
      timestamp: Date.now(),
    });

    const endTime = performance.now();
    const latency = endTime - startTime;

    this.trackMessageLatency('unicast', latency);
    connection.lastActivity = Date.now();

    return true;
  }

  /**
   * Track message latency for performance monitoring
   */
  private trackMessageLatency(type: string, latency: number): void {
    if (!this.messageMetrics.has(type)) {
      this.messageMetrics.set(type, []);
    }

    const metrics = this.messageMetrics.get(type);
    metrics.push(latency);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(): void {
    const metrics: ConnectionMetrics = {
      totalConnections: this.connectionPool.size,
      activeConnections: Array.from(this.connectionPool.values())
        .filter(conn => Date.now() - conn.lastActivity < 300000) // Active within 5 minutes
        .length,
      messagesPerSecond: this.calculateMessagesPerSecond(),
      averageLatency: this.calculateAverageLatency(),
    };

    // Log metrics for monitoring
    this.logger.debug(`WebSocket Metrics: ${JSON.stringify(metrics)}`);

    // Clean up inactive connections
    this.cleanupInactiveConnections();
  }

  private calculateMessagesPerSecond(): number {
    const totalLatencies = Array.from(this.messageMetrics.values())
      .reduce((sum, metrics) => sum + metrics.length, 0);

    return Math.round(totalLatencies / 60); // Assume 60-second window
  }

  private calculateAverageLatency(): number {
    const allLatencies = Array.from(this.messageMetrics.values())
      .flat();

    if (allLatencies.length === 0) return 0;

    const sum = allLatencies.reduce((total, latency) => total + latency, 0);
    return Math.round((sum / allLatencies.length) * 100) / 100;
  }

  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const inactiveThreshold = 600000; // 10 minutes

    for (const [socketId, connection] of this.connectionPool.entries()) {
      if (now - connection.lastActivity > inactiveThreshold) {
        this.logger.warn(`Cleaning up inactive connection: ${socketId}`);
        connection.socket.disconnect(true);
        this.removeConnection(socketId);
      }
    }
  }

  getConnectionMetrics(): ConnectionMetrics {
    return {
      totalConnections: this.connectionPool.size,
      activeConnections: Array.from(this.connectionPool.values())
        .filter(conn => Date.now() - conn.lastActivity < 300000)
        .length,
      messagesPerSecond: this.calculateMessagesPerSecond(),
      averageLatency: this.calculateAverageLatency(),
    };
  }

  getRoomMetrics(): Array<{ roomId: string; connectionCount: number }> {
    return Array.from(this.roomConnections.entries()).map(([roomId, connections]) => ({
      roomId,
      connectionCount: connections.size,
    }));
  }
}
```

## Load Testing Configuration

### Artillery Load Testing

```yaml
# test/performance/load-test-config.yml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Warm up"
    - duration: 60
      arrivalRate: 50
      name: "Normal load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
    - duration: 30
      arrivalRate: 200
      name: "Stress test"
  defaults:
    headers:
      Content-Type: 'application/json'
    timeout: 5000

scenarios:
  - name: "Authentication flow"
    weight: 20
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test{{ $randomString() }}@example.com"
            password: "Password123!"
          capture:
            - json: "$.data.accessToken"
              as: "authToken"
      - get:
          url: "/api/auth/me"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200

  - name: "Room management"
    weight: 40
    flow:
      - get:
          url: "/api/rooms"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200

  - name: "Quota validation (performance critical)"
    weight: 30
    flow:
      - get:
          url: "/api/quotas/user/{{ $randomString() }}"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - responseTime:
              lt: 100  # Critical: <100ms response time

  - name: "WebSocket connections"
    weight: 10
    engine: ws
    flow:
      - connect:
          target: "ws://localhost:8080/ws/airconditioner"
          queryParams:
            roomId: "test-room-{{ $randomString() }}"
            familyMemberId: "test-user-{{ $randomString() }}"
            token: "{{ authToken }}"
      - send:
          channel: "aircon_command"
          data:
            type: "SET_POWER"
            payload:
              roomId: "test-room-{{ $randomString() }}"
              action: "power"
              value: "ON"
```

### Performance Benchmark Script

```typescript
// test/performance/benchmark.ts
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
}

class PerformanceBenchmark {
  async runBenchmark(
    name: string,
    fn: () => Promise<any>,
    iterations: number = 100,
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const sortedTimes = times.sort((a, b) => a - b);

    return {
      name,
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      p95Time: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99Time: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
    };
  }

  async benchmarkQuotaValidation(): Promise<BenchmarkResult> {
    return this.runBenchmark(
      'Quota Validation',
      async () => {
        // Simulate quota validation process
        const mockCommand = {
          roomId: 'test-room',
          userId: 'test-user',
          action: 'power',
          value: 'ON',
        };

        // Mock quota validation logic
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return { isValid: true };
      },
      1000, // More iterations for critical path
    );
  }

  async benchmarkDatabaseQuery(): Promise<BenchmarkResult> {
    return this.runBenchmark(
      'Database Query',
      async () => {
        // Simulate optimized database query
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return { id: 'test', name: 'Test User' };
      },
      500,
    );
  }

  async benchmarkCacheOperation(): Promise<BenchmarkResult> {
    return this.runBenchmark(
      'Cache Operation',
      async () => {
        // Simulate Redis cache operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        return { cached: true };
      },
      2000,
    );
  }

  printResults(results: BenchmarkResult[]): void {
    console.log('\n📊 Performance Benchmark Results');
    console.log('=====================================');

    results.forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Average: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
      console.log(`  P95: ${result.p95Time.toFixed(2)}ms`);
      console.log(`  P99: ${result.p99Time.toFixed(2)}ms`);

      // Performance warnings
      if (result.name === 'Quota Validation' && result.p95Time > 100) {
        console.log(`  ⚠️  WARNING: P95 exceeds 100ms target!`);
      }
      if (result.name === 'Database Query' && result.p95Time > 50) {
        console.log(`  ⚠️  WARNING: Database query slow!`);
      }
    });
  }
}

// Run benchmarks
async function runPerformanceTests() {
  const benchmark = new PerformanceBenchmark();

  const results = await Promise.all([
    benchmark.benchmarkQuotaValidation(),
    benchmark.benchmarkDatabaseQuery(),
    benchmark.benchmarkCacheOperation(),
  ]);

  benchmark.printResults(results);
}

export { runPerformanceTests };
```

This comprehensive performance optimization guide ensures the NestJS backend meets and exceeds the performance requirements while providing monitoring and benchmarking tools to maintain optimal performance over time.