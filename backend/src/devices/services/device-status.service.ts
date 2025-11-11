import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Observable, of, throwError, timer, combineLatest } from 'rxjs';
import { map, catchError, retry, timeout, shareReplay } from 'rxjs/operators';
import { DeviceStatus } from '../interfaces/device-status.interface';
import { DeviceInfo } from '../interfaces/device-info.interface';
// AirCon types not used directly here
import { DeviceStateManagerService } from './device-state-manager.service';

// Minimal cache type to avoid external dependency requirements
type CacheLike = {
  set: (key: string, value: unknown, ttlMs?: number) => unknown;
};

// Cache TTL constants matching Spring Boot exactly
const CACHE_TTL = 30; // 30 seconds for online devices
const OFFLINE_CACHE_TTL = 120; // 2 minutes for offline devices
const CLEANUP_INTERVAL = 60000; // 1 minute cleanup interval
const MAX_RETRY_ATTEMPTS = 3; // Matching Spring Boot retry attempts
const RETRY_MIN_BACKOFF = 100; // 100ms minimum backoff
const RETRY_MAX_BACKOFF = 2000; // 2 seconds maximum backoff
const OPERATION_TIMEOUT = 5000; // 5 seconds operation timeout

// Circuit breaker states
enum CircuitBreakerStateEnum {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutDuration: number;
  halfOpenMaxCalls: number;
  resetTimeout: number;
}

// Cache entry interfaces matching Spring Boot records
interface CachedDeviceStatus {
  status: DeviceStatus;
  timestamp: number;
  ttl: number;
}

interface CachedDeviceInfo {
  deviceInfo: DeviceInfo;
  timestamp: number;
  ttl: number;
}

// Cache statistics interface matching Spring Boot
interface CacheStatistics {
  totalCachedDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  averageCacheAge: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
}

// Circuit breaker state
interface CircuitBreakerSnapshot {
  state: CircuitBreakerStateEnum;
  failures: number;
  lastFailureTime: number;
  nextAttempt: number;
}

@Injectable()
export class DeviceStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceStatusService.name);

  // In-memory caches (matching Spring Boot ConcurrentHashMap pattern)
  private readonly statusCache = new Map<string, CachedDeviceStatus>();
  private readonly infoCache = new Map<string, CachedDeviceInfo>();

  // Circuit breaker state per device
  private readonly circuitBreakers = new Map<string, CircuitBreakerSnapshot>();

  // Cache statistics (matching Spring Boot AtomicLong pattern)
  private cacheHits = 0;
  private cacheMisses = 0;

  // Background cleanup interval
  private cleanupInterval: NodeJS.Timeout;

  // Circuit breaker configuration
  private readonly circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    timeoutDuration: 60000, // 60 seconds
    halfOpenMaxCalls: 3,
    resetTimeout: 30000, // 30 seconds
  };

  constructor(private readonly deviceStateManager: DeviceStateManagerService) {}

  onModuleInit(): void {
    this.logger.log('Initializing DeviceStatusService');

    // Start background cleanup task (matching Spring Boot Flux.interval pattern)
    this.startCacheCleanupTask();

    // Initialize from Redis cache
    this.initializeFromPersistentCache();
  }

  onModuleDestroy(): void {
    this.logger.log('Cleaning up DeviceStatusService');

    // Cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear in-memory caches
    this.statusCache.clear();
    this.infoCache.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Get device status with caching and resilience (matching Spring Boot getDeviceStatus pattern)
   */
  getDeviceStatus(deviceIdentifier: string): Observable<DeviceStatus> {
    this.logger.debug(`Getting device status for ${deviceIdentifier}`);

    // Check circuit breaker state
    if (!this.canAttemptOperation(deviceIdentifier)) {
      return this.handleCircuitBreakerOpen(deviceIdentifier);
    }

    // Try cache first (cache-aside pattern)
    const cachedStatus = this.getCachedDeviceStatus(deviceIdentifier);
    if (cachedStatus) {
      this.cacheHits++;
      return of(cachedStatus);
    }

    // Cache miss - fetch from source with resilience
    this.cacheMisses++;
    return this.fetchAndCacheDeviceStatus(deviceIdentifier).pipe(
      timeout(OPERATION_TIMEOUT),
      retry({
        count: MAX_RETRY_ATTEMPTS,
        delay: (error, retryIndex) => {
          const delay = this.calculateExponentialBackoff(retryIndex);
          this.logger.warn(
            `Retrying device status fetch for ${deviceIdentifier}, attempt ${retryIndex + 1}, delay ${delay}ms`,
          );
          return timer(delay);
        },
        resetOnSuccess: true,
      }),
      catchError((error) => {
        this.handleDeviceStatusFailure(deviceIdentifier, error);
        return of(this.createOfflineDeviceStatus(deviceIdentifier));
      }),
    );
  }

  /**
   * Get device info with caching and resilience
   */
  getDeviceInfo(deviceIdentifier: string): Observable<DeviceInfo> {
    this.logger.debug(`Getting device info for ${deviceIdentifier}`);

    // Check circuit breaker state
    if (!this.canAttemptOperation(deviceIdentifier)) {
      return this.handleCircuitBreakerOpen(deviceIdentifier);
    }

    // Try cache first
    const cachedInfo = this.getCachedDeviceInfo(deviceIdentifier);
    if (cachedInfo) {
      this.cacheHits++;
      return of(cachedInfo);
    }

    // Cache miss - fetch from source
    this.cacheMisses++;
    return this.fetchAndCacheDeviceInfo(deviceIdentifier).pipe(
      timeout(OPERATION_TIMEOUT),
      retry({
        count: MAX_RETRY_ATTEMPTS,
        delay: (error, retryIndex) =>
          timer(this.calculateExponentialBackoff(retryIndex)),
        resetOnSuccess: true,
      }),
      catchError((error) => {
        this.handleDeviceInfoFailure(deviceIdentifier, error);
        return of(this.createOfflineDeviceInfo(deviceIdentifier));
      }),
    );
  }

  /**
   * Get cache statistics (matching Spring Boot pattern)
   */
  getCacheStatistics(): Observable<CacheStatistics> {
    return of(this.calculateCacheStatistics()).pipe(shareReplay(1));
  }

  /**
   * Force refresh of device status cache
   */
  refreshDeviceStatus(deviceIdentifier: string): Observable<DeviceStatus> {
    // Clear cache entry
    this.statusCache.delete(deviceIdentifier);

    // Reset circuit breaker for this device
    this.resetCircuitBreaker(deviceIdentifier);

    // Fetch fresh data
    return this.getDeviceStatus(deviceIdentifier);
  }

  /**
   * Force refresh of device info cache
   */
  refreshDeviceInfo(deviceIdentifier: string): Observable<DeviceInfo> {
    // Clear cache entry
    this.infoCache.delete(deviceIdentifier);

    // Reset circuit breaker for this device
    this.resetCircuitBreaker(deviceIdentifier);

    // Fetch fresh data
    return this.getDeviceInfo(deviceIdentifier);
  }

  // Private methods

  /**
   * Get cached device status (matching Spring Boot getCachedStatus)
   */
  private getCachedDeviceStatus(deviceIdentifier: string): DeviceStatus | null {
    const cached = this.statusCache.get(deviceIdentifier);
    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl * 1000) {
      this.statusCache.delete(deviceIdentifier);
      return null;
    }

    return cached.status;
  }

  /**
   * Get cached device info
   */
  private getCachedDeviceInfo(deviceIdentifier: string): DeviceInfo | null {
    const cached = this.infoCache.get(deviceIdentifier);
    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl * 1000) {
      this.infoCache.delete(deviceIdentifier);
      return null;
    }

    return cached.deviceInfo;
  }

  /**
   * Fetch and cache device status (matching Spring Boot fetchAndCacheStatus)
   */
  private fetchAndCacheDeviceStatus(
    deviceIdentifier: string,
  ): Observable<DeviceStatus> {
    return this.deviceStateManager.getRoomState(deviceIdentifier).pipe(
      map((state) => {
        if (!state) {
          throw new Error(`Device ${deviceIdentifier} not found`);
        }

        // Create device status from state
        const status: DeviceStatus = {
          deviceId: deviceIdentifier,
          roomId: deviceIdentifier,
          isOnline: true,
          lastSeen: new Date(),
          state,
          errors: [],
        };

        // Cache with appropriate TTL
        const ttl = status.isOnline ? CACHE_TTL : OFFLINE_CACHE_TTL;
        this.statusCache.set(deviceIdentifier, {
          status,
          timestamp: Date.now(),
          ttl,
        });

        // Store in persistent cache
        // Optional persistent cache
        (this as { cacheManager?: CacheLike }).cacheManager?.set(
          `status:${deviceIdentifier}`,
          status,
          ttl * 1000,
        );

        this.recordSuccess(deviceIdentifier);
        return status;
      }),
    );
  }

  /**
   * Fetch and cache device info (matching Spring Boot fetchAndCacheDeviceInfo)
   */
  private fetchAndCacheDeviceInfo(
    deviceIdentifier: string,
  ): Observable<DeviceInfo> {
    return combineLatest([
      this.deviceStateManager.getRoomState(deviceIdentifier),
      this.deviceStateManager.getRoomOnlineStatus(deviceIdentifier),
    ]).pipe(
      map(([state, isOnline]) => {
        if (!state) {
          throw new Error(`Device ${deviceIdentifier} not found`);
        }

        // Create device info
        const deviceInfo: DeviceInfo = {
          deviceId: deviceIdentifier,
          roomId: deviceIdentifier,
          isOnline,
          lastSeen: new Date(),
          state,
          model: 'Mitsubishi AC',
          manufacturer: 'Mitsubishi Electric',
          firmwareVersion: '1.0.0',
          signalStrength: isOnline ? 85 : 0,
          batteryLevel: undefined,
          errors: [],
        };

        // Cache with appropriate TTL
        const ttl = deviceInfo.isOnline ? CACHE_TTL : OFFLINE_CACHE_TTL;
        this.infoCache.set(deviceIdentifier, {
          deviceInfo,
          timestamp: Date.now(),
          ttl,
        });

        // Store in persistent cache
        (this as { cacheManager?: CacheLike }).cacheManager?.set(
          `info:${deviceIdentifier}`,
          deviceInfo,
          ttl * 1000,
        );

        this.recordSuccess(deviceIdentifier);
        return deviceInfo;
      }),
    );
  }

  /**
   * Calculate exponential backoff delay (matching Spring Boot retry pattern)
   */
  private calculateExponentialBackoff(retryIndex: number): number {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, capped at 2000ms
    const delay = RETRY_MIN_BACKOFF * Math.pow(2, retryIndex);
    return Math.min(delay, RETRY_MAX_BACKOFF);
  }

  /**
   * Handle circuit breaker logic
   */
  private canAttemptOperation(deviceIdentifier: string): boolean {
    const breaker = this.circuitBreakers.get(deviceIdentifier);
    if (!breaker) {
      // Initialize circuit breaker for this device
      this.circuitBreakers.set(deviceIdentifier, {
        state: CircuitBreakerStateEnum.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        nextAttempt: 0,
      });
      return true;
    }

    const now = Date.now();

    switch (breaker.state) {
      case CircuitBreakerStateEnum.CLOSED:
        return true;

      case CircuitBreakerStateEnum.OPEN:
        if (now >= breaker.nextAttempt) {
          // Transition to HALF_OPEN
          breaker.state = CircuitBreakerStateEnum.HALF_OPEN;
          this.logger.log(
            `Circuit breaker for ${deviceIdentifier} transitioning to HALF_OPEN`,
          );
          return true;
        }
        return false;

      case CircuitBreakerStateEnum.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(deviceIdentifier: string): void {
    const breaker = this.circuitBreakers.get(deviceIdentifier);
    if (breaker) {
      breaker.state = CircuitBreakerStateEnum.CLOSED;
      breaker.failures = 0;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(deviceIdentifier: string): void {
    const breaker = this.circuitBreakers.get(deviceIdentifier);
    if (!breaker) return;

    const now = Date.now();
    breaker.failures++;
    breaker.lastFailureTime = now;

    if (breaker.failures >= this.circuitBreakerConfig.failureThreshold) {
      breaker.state = CircuitBreakerStateEnum.OPEN;
      breaker.nextAttempt = now + this.circuitBreakerConfig.timeoutDuration;
      this.logger.warn(
        `Circuit breaker for ${deviceIdentifier} opened after ${breaker.failures} failures`,
      );
    }
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(deviceIdentifier: string): void {
    const breaker = this.circuitBreakers.get(deviceIdentifier);
    if (breaker) {
      breaker.state = CircuitBreakerStateEnum.CLOSED;
      breaker.failures = 0;
      breaker.lastFailureTime = 0;
      breaker.nextAttempt = 0;
    }
  }

  /**
   * Handle circuit breaker open state
   */
  private handleCircuitBreakerOpen<T>(deviceIdentifier: string): Observable<T> {
    this.logger.warn(
      `Circuit breaker open for device ${deviceIdentifier}, returning cached/offline data`,
    );

    // Try to return cached data even if circuit breaker is open
    const cachedStatus = this.getCachedDeviceStatus(deviceIdentifier);
    if (cachedStatus) {
      return of(cachedStatus as T);
    }

    return throwError(
      () => new Error(`Circuit breaker open for device ${deviceIdentifier}`),
    );
  }

  /**
   * Handle device status fetch failure
   */
  private handleDeviceStatusFailure(
    deviceIdentifier: string,
    error: unknown,
  ): void {
    this.logger.warn(
      `Failed to fetch status for device ${deviceIdentifier}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    this.recordFailure(deviceIdentifier);

    // Cache offline status to prevent repeated failures
    const offlineStatus = this.createOfflineDeviceStatus(deviceIdentifier);
    this.statusCache.set(deviceIdentifier, {
      status: offlineStatus,
      timestamp: Date.now(),
      ttl: OFFLINE_CACHE_TTL,
    });
  }

  /**
   * Handle device info fetch failure
   */
  private handleDeviceInfoFailure(
    deviceIdentifier: string,
    error: unknown,
  ): void {
    this.logger.warn(
      `Failed to fetch info for device ${deviceIdentifier}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    this.recordFailure(deviceIdentifier);

    // Cache offline info to prevent repeated failures
    const offlineInfo = this.createOfflineDeviceInfo(deviceIdentifier);
    this.infoCache.set(deviceIdentifier, {
      deviceInfo: offlineInfo,
      timestamp: Date.now(),
      ttl: OFFLINE_CACHE_TTL,
    });
  }

  /**
   * Create offline device status
   */
  private createOfflineDeviceStatus(deviceIdentifier: string): DeviceStatus {
    return {
      deviceId: deviceIdentifier,
      roomId: deviceIdentifier,
      isOnline: false,
      lastSeen: new Date(),
      errors: ['Device offline'],
    };
  }

  /**
   * Create offline device info
   */
  private createOfflineDeviceInfo(deviceIdentifier: string): DeviceInfo {
    return {
      deviceId: deviceIdentifier,
      roomId: deviceIdentifier,
      isOnline: false,
      lastSeen: new Date(),
      errors: ['Device offline'],
    };
  }

  /**
   * Calculate cache statistics
   */
  private calculateCacheStatistics(): CacheStatistics {
    const now = Date.now();
    let totalAge = 0;
    let onlineCount = 0;
    let offlineCount = 0;

    // Calculate statistics from status cache
    for (const cached of this.statusCache.values()) {
      const age = now - cached.timestamp;
      totalAge += age;

      if (cached.status.isOnline) {
        onlineCount++;
      } else {
        offlineCount++;
      }
    }

    const totalDevices = this.statusCache.size;
    const averageAge = totalDevices > 0 ? totalAge / totalDevices : 0;
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRatio =
      totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      totalCachedDevices: totalDevices,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      averageCacheAge: Math.round(averageAge),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRatio: Math.round(hitRatio * 100) / 100,
    };
  }

  /**
   * Start cache cleanup task (matching Spring Boot background cleanup)
   */
  private startCacheCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCaches();
    }, CLEANUP_INTERVAL);

    this.logger.log('Started cache cleanup task');
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCaches(): void {
    const now = Date.now();
    let cleanedStatus = 0;
    let cleanedInfo = 0;

    // Cleanup status cache
    for (const [deviceId, cached] of this.statusCache) {
      const age = now - cached.timestamp;
      if (age > cached.ttl * 1000) {
        this.statusCache.delete(deviceId);
        cleanedStatus++;
      }
    }

    // Cleanup info cache
    for (const [deviceId, cached] of this.infoCache) {
      const age = now - cached.timestamp;
      if (age > cached.ttl * 1000) {
        this.infoCache.delete(deviceId);
        cleanedInfo++;
      }
    }

    if (cleanedStatus > 0 || cleanedInfo > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedStatus} status entries and ${cleanedInfo} info entries`,
      );
    }
  }

  /**
   * Initialize from persistent cache
   */
  private initializeFromPersistentCache(): void {
    try {
      // This would load from Redis cache manager
      // Implementation depends on your cache manager setup
      this.logger.log('Initializing from persistent cache (placeholder)');
    } catch (error) {
      this.logger.error('Failed to initialize from persistent cache', error);
    }
  }
}
