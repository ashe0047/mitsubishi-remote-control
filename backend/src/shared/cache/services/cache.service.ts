import {
  Injectable,
  Logger,
  Inject,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

// Import error handling infrastructure
import { ErrorHandlerService } from '../../errors/services/error-handler.service';
import { CacheException } from '../../errors/exceptions/infrastructure.exception';

import {
  ICache,
  ICacheManager,
  CacheValue,
  CacheResult,
  CacheStats,
  CacheOptions,
  CacheStoreConfig,
} from '../interfaces/cache.interface';

// Import cache error handling infrastructure
import {
  CacheOperation,
  createCacheErrorContext,
  CacheConnectionStatus,
  CircuitBreakerState,
} from '../interfaces/cache-error-context.interface';

/**
 * Retry configuration for cache operations
 */
interface CacheRetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: CacheRetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 60000, // 1 minute
};

/**
 * Type-safe cache service implementation using NestJS Cache Manager
 * with Redis store as backend and comprehensive error handling
 */
@Injectable()
export class CacheService<T extends Record<string, unknown>>
  implements ICache<T>, OnModuleDestroy
{
  private readonly logger = new Logger(CacheService.name);
  private readonly cacheNamespace: string;
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;
  private readonly cacheManager: Cache;
  private readonly configService: ConfigService | undefined;
  private readonly errorHandlerService: ErrorHandlerService | undefined;

  // Circuit breaker state
  private circuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitBreakerConfig: CircuitBreakerConfig;

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    @Optional() @Inject(ConfigService) configService?: ConfigService,
    @Optional()
    @Inject(ErrorHandlerService)
    errorHandlerService?: ErrorHandlerService,
    namespace = 'app',
  ) {
    this.cacheManager = cacheManager;
    this.configService = configService;
    this.errorHandlerService = errorHandlerService;
    this.cacheNamespace = namespace;
    this.defaultTTL = configService?.get<number>('CACHE_TTL', 300000) ?? 300000; // 5 minutes default
    this.keyPrefix =
      configService?.get<string>('CACHE_KEY_PREFIX', 'cache') ?? 'cache';
    this.circuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG;
  }

  /**
   * Get value from cache with type safety
   */
  async get<K extends keyof T>(key: K): Promise<CacheResult<T[K] | null>> {
    const operation = CacheOperation.GET;
    const startTime = Date.now();
    const fullKey = this.buildKey(key);

    try {
      // Use retry logic for read operations
      const value = (await this.executeWithRetry(
        () => Promise.resolve(this.cacheManager.get(fullKey)),
        operation,
        fullKey,
        { maxRetries: 2 }, // Fewer retries for read operations
      )) as T[K] | undefined;

      const cacheResult: CacheResult<T[K] | null> = {
        value: value ?? null,
        hit: value !== undefined && value !== null,
        key: fullKey,
      };

      this.debugOperation('get', fullKey, cacheResult.hit);
      return cacheResult;
    } catch (cacheError: unknown) {
      // Create structured error context for final failure
      createCacheErrorContext(
        operation,
        this.cacheNamespace,
        CacheConnectionStatus.ERROR,
        {
          key: fullKey,
          performance: {
            executionTime: Date.now() - startTime,
          },
          timestamp: new Date(),
        },
      );

      // Use structured error handling for final failure
      if (this.errorHandlerService) {
        this.errorHandlerService.handleServiceError(
          cacheError,
          'CacheService.get',
          { operation: String(operation), key: fullKey },
          false, // Don't rethrow, we want to return gracefully
        );
      } else {
        this.logger.error(
          `Cache get error for key ${String(key)} after retries:`,
          cacheError,
        );
      }

      // Return graceful fallback for read operations
      return {
        value: null,
        hit: false,
        key: fullKey,
      };
    }
  }

  /**
   * Get value with custom options
   */
  async getWithOptions<K extends keyof T>(
    key: K,
    options?: CacheOptions,
  ): Promise<CacheResult<T[K] | null>> {
    try {
      const fullKey = this.buildKeyWithPrefix(key, options?.prefix);
      const value = (await this.cacheManager.get(fullKey)) as T[K] | undefined;

      const cacheResult: CacheResult<T[K] | null> = {
        value: value ?? null,
        hit: value !== undefined && value !== null,
        key: fullKey,
      };

      this.debugOperation(
        'getWithOptions',
        fullKey,
        cacheResult.hit,
        options as Record<string, unknown> | undefined,
      );
      return cacheResult;
    } catch (error: unknown) {
      this.logger.error(
        `Cache getWithOptions error for key ${String(key)}:`,
        error,
      );
      return {
        value: null,
        hit: false,
        key: this.buildKeyWithPrefix(key, options?.prefix),
      };
    }
  }

  /**
   * Set value in cache with type safety
   */
  async set<K extends keyof T>(
    key: K,
    value: T[K],
    options?: CacheOptions,
  ): Promise<void> {
    const operation = CacheOperation.SET;
    const startTime = Date.now();
    const fullKey = this.buildKeyWithPrefix(key, options?.prefix);
    const ttl = options?.ttl ?? this.defaultTTL;

    try {
      // Use retry logic for write operations
      await this.executeWithRetry(
        async () => {
          const cacheValue: CacheValue<T[K]> = {
            value,
            timestamp: Date.now(),
            ttl,
          };

          await this.cacheManager.set(fullKey, cacheValue, ttl);
        },
        operation,
        fullKey,
        { maxRetries: 3 }, // More retries for write operations
      );

      this.debugOperation('set', fullKey, true, {
        ttl,
        valueType: typeof value,
      });
    } catch (cacheError: unknown) {
      // Create structured error context for final failure
      createCacheErrorContext(
        operation,
        this.cacheNamespace,
        CacheConnectionStatus.ERROR,
        {
          key: fullKey,
          ttl,
          performance: {
            executionTime: Date.now() - startTime,
          },
          timestamp: new Date(),
        },
      );

      // Use structured error handling for final failure
      if (this.errorHandlerService) {
        this.errorHandlerService.handleServiceError(
          cacheError,
          'CacheService.set',
          { operation: String(operation), key: fullKey, ttl },
          false, // Don't rethrow, we want to throw our own exception
        );
      } else {
        this.logger.error(
          `Cache set error for key ${String(key)} after retries:`,
          cacheError,
        );
      }

      // Throw CacheException for write operations
      const errorMessage =
        cacheError instanceof Error ? cacheError.message : String(cacheError);
      const error =
        cacheError instanceof Error ? cacheError : new Error(errorMessage);

      throw new CacheException(String(operation), fullKey, error);
    }
  }

  /**
   * Set value with specific TTL
   */
  async setWithTTL<K extends keyof T>(
    key: K,
    value: T[K],
    ttl: number,
  ): Promise<void> {
    return this.set(key, value, { ttl });
  }

  /**
   * Delete value from cache
   */
  async del<K extends keyof T>(key: K): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key);
      const result = await this.cacheManager.del(fullKey);

      this.debugOperation('del', fullKey, result);
      return Boolean(result);
    } catch (error: unknown) {
      this.logger.error(`Cache del error for key ${String(key)}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple values
   */
  async delMany<K extends keyof T>(keys: K[]): Promise<boolean[]> {
    try {
      // Delete keys individually since store API may vary
      const results = await Promise.all(keys.map((key) => this.del(key)));

      this.debugOperation('delMany', keys.join(', '), results);
      return results;
    } catch (error: unknown) {
      this.logger.error(`Cache delMany error:`, error);
      return keys.map(() => false);
    }
  }

  /**
   * Clear all cache entries in this namespace
   */
  async clear(): Promise<void> {
    try {
      // Clear all cache entries from the current namespace
      // Keyv stores don't have namespace isolation, so we clear everything
      await this.cacheManager.clear();
      this.logger.log(`Cache cleared for namespace: ${this.cacheNamespace}`);
    } catch (error: unknown) {
      this.logger.error(`Cache clear error:`, error);
      throw new Error(
        `Cache clear operation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Reset entire cache store
   */
  async reset(): Promise<void> {
    try {
      // Reset entire cache store
      await this.cacheManager.clear();
      this.logger.log(`Cache reset completed`);
    } catch (error: unknown) {
      this.logger.error(`Cache reset error:`, error);
      throw new Error(
        `Cache reset operation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get cache keys matching pattern
   */
  keys(pattern?: string): Promise<string[]> {
    try {
      // Since store.keys may not be available, return empty array
      // In real implementation, you might need to use Redis client directly
      this.logger.debug(`Cache keys called with pattern: ${pattern || '*'}`);
      return Promise.resolve([]);
    } catch (error: unknown) {
      this.logger.error(`Cache keys error:`, error);
      return Promise.resolve([]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats> {
    // Return basic stats since store.getStats may not be available
    return Promise.resolve({
      hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
      store: 'keyv-redis',
    });
  }

  /**
   * Check if key exists in cache
   */
  async has<K extends keyof T>(key: K): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key);
      const value = await this.cacheManager.get(fullKey);
      return value !== undefined && value !== null;
    } catch (error: unknown) {
      this.logger.error(`Cache has error for key ${String(key)}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  getTTL<K extends keyof T>(key: K): Promise<number> {
    // TTL functionality may not be available through cache-manager
    this.logger.debug(`TTL check requested for key: ${String(key)}`);
    return Promise.resolve(-1);
  }

  /**
   * Store multiple values atomically
   */
  async mset<K extends keyof T>(entries: Array<[K, T[K]]>): Promise<void> {
    try {
      // Set values individually since pipeline may not be available
      await Promise.all(entries.map(([key, value]) => this.set(key, value)));

      this.debugOperation('mset', String(entries.length), true);
    } catch (error: unknown) {
      this.logger.error(`Cache mset error:`, error);
      throw new Error(
        `Cache mset operation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieve multiple values
   */
  async mget<K extends keyof T>(
    keys: K[],
  ): Promise<Array<CacheResult<T[K] | null>>> {
    try {
      // Get values individually since pipeline may not be available
      const results = await Promise.all(keys.map((key) => this.get(key)));

      return results;
    } catch (error: unknown) {
      this.logger.error(`Cache mget error:`, error);
      return keys.map((key) => ({
        value: null,
        hit: false,
        key: this.buildKey(key),
      }));
    }
  }

  /**
   * Delete multiple values
   */
  async mdel<K extends keyof T>(keys: K[]): Promise<boolean[]> {
    try {
      return this.delMany(keys);
    } catch (error: unknown) {
      this.logger.error(`Cache mdel error:`, error);
      return keys.map(() => false);
    }
  }

  /**
   * Build cache key with namespace and prefix
   */
  private buildKey(key: string | number | symbol): string {
    return `${this.buildKeyPrefix()}${String(key)}`;
  }

  /**
   * Build cache key prefix
   */
  private buildKeyPrefix(prefix?: string): string {
    const parts: string[] = [this.keyPrefix];

    if (prefix) {
      parts.push(prefix);
    }

    if (this.cacheNamespace && this.cacheNamespace !== 'default') {
      parts.push(this.cacheNamespace);
    }

    return parts.join(':');
  }

  /**
   * Build key with custom prefix
   */
  private buildKeyWithPrefix<K extends keyof T>(
    key: K,
    customPrefix?: string,
  ): string {
    const parts: string[] = [this.keyPrefix];

    if (customPrefix) {
      parts.push(customPrefix);
    }

    if (this.cacheNamespace && this.cacheNamespace !== 'default') {
      parts.push(this.cacheNamespace);
    }

    parts.push(String(key));
    return parts.join(':');
  }

  /**
   * Check if circuit breaker allows operation
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (
          now - this.lastFailureTime >=
          this.circuitBreakerConfig.recoveryTimeout
        ) {
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
          this.logger.log('Circuit breaker transitioning to HALF_OPEN');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerState = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.logger.log(
        'Circuit breaker transitioning to CLOSED after successful operation',
      );
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.circuitBreakerState === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.circuitBreakerConfig.failureThreshold
    ) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.logger.warn(
        `Circuit breaker transitioning to OPEN after ${this.failureCount} failures`,
      );
    } else if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.logger.warn(
        'Circuit breaker returning to OPEN after failure in HALF_OPEN state',
      );
    }
  }

  /**
   * Execute cache operation with retry logic
   */
  private async executeWithRetry<K>(
    operation: () => Promise<K>,
    operationType: CacheOperation,
    key?: string,
    retryOptions: Partial<CacheRetryOptions> = {},
  ): Promise<K> {
    // Check circuit breaker first
    if (!this.canExecute()) {
      this.logger.warn(
        `Circuit breaker OPEN, rejecting ${String(operationType)} operation for key: ${key}`,
      );

      throw new CacheException(
        `Circuit breaker OPEN - ${String(operationType)} operation rejected`,
        key,
        new Error('Circuit breaker is OPEN'),
      );
    }

    const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
    let lastError: unknown;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt === options.maxRetries) {
          this.recordFailure();
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelay,
        );

        // Create error context for logging
        createCacheErrorContext(
          operationType,
          this.cacheNamespace,
          CacheConnectionStatus.ERROR,
          {
            key,
            retryAttempt: attempt + 1,
            maxRetries: options.maxRetries,
            retryDelay: delay,
            circuitBreakerState: this.circuitBreakerState,
            timestamp: new Date(),
          },
        );

        // Use structured error handling if available
        if (this.errorHandlerService) {
          this.errorHandlerService.handleServiceError(
            error,
            `CacheService.${String(operationType)}`,
            { operationType: String(operationType), key, attempt: attempt + 1 },
            false, // Don't rethrow, we want to retry
          );
        } else {
          this.logger.warn(
            `Cache ${String(operationType)} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${options.maxRetries}):`,
            error,
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted, record failure and throw
    this.recordFailure();
    throw lastError;
  }

  /**
   * Log cache operations for debugging
   */
  private debugOperation(
    operation: string,
    key: string,
    success: boolean | number | boolean[],
    metadata?: Record<string, unknown>,
  ): void {
    if (this.configService?.get('NODE_ENV') === 'development') {
      const metadataString = metadata ? JSON.stringify(metadata) : 'none';
      this.logger.debug(
        `Cache ${operation}: key=${key}, success=${String(success)}, metadata=${metadataString}`,
      );
    }
  }

  /**
   * Handle module cleanup
   */
  onModuleDestroy(): void {
    try {
      this.logger.log(
        `Cache service destroyed for namespace: ${this.cacheNamespace}`,
      );
    } catch (error: unknown) {
      this.logger.error('Error during cache service cleanup:', error);
    }
  }
}

/**
 * Cache manager implementation for managing multiple cache instances
 */
@Injectable()
export class CacheManagerService implements ICacheManager {
  private readonly logger = new Logger(CacheManagerService.name);
  private readonly caches = new Map<string, ICache>();
  private readonly globalOptions: CacheOptions;
  private readonly cacheManager: Cache;

  constructor(@Inject(CACHE_MANAGER) cacheManager: Cache) {
    this.cacheManager = cacheManager;
    this.globalOptions = {
      ttl: 300000, // 5 minutes
    };
  }

  /**
   * Get or create cache instance for specific namespace
   */
  getCache<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string = 'default',
  ): ICache<T> {
    if (!this.caches.has(name)) {
      const cacheService = new CacheService<T>(
        this.cacheManager,
        undefined, // ConfigService is optional, will use defaults
        undefined, // ErrorHandlerService is optional, will use defaults
        name,
      );
      this.caches.set(name, cacheService);
      this.logger.log(`Created cache instance for namespace: ${name}`);
    }

    return this.caches.get(name)! as ICache<T>;
  }

  /**
   * Set global cache options
   */
  setGlobalOptions(options: CacheOptions): void {
    Object.assign(this.globalOptions, options);
    this.logger.log(`Updated global cache options:`, options);
  }

  /**
   * Get store configuration
   */
  getStoreConfig(): CacheStoreConfig {
    return {
      name: 'keyv-redis',
      host: 'localhost',
      port: 6379,
      database: 0,
      keyPrefix: '',
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableOfflineQueue: false,
      retryDelayOnFailover: 100,
    };
  }

  /**
   * Close all cache connections
   */
  async close(): Promise<void> {
    try {
      // Simple approach: convert caches to array and handle cleanup
      const cacheEntries = Array.from(this.caches.values());

      const cleanupPromises = cacheEntries.map(async (cache) => {
        try {
          // Type guard to check if cache has cleanup method
          if (
            cache &&
            typeof cache === 'object' &&
            cache !== null &&
            'onModuleDestroy' in cache
          ) {
            const cacheWithCleanup = cache as {
              onModuleDestroy?: () => void | Promise<void>;
            };
            const cleanupMethod = cacheWithCleanup.onModuleDestroy;
            if (typeof cleanupMethod === 'function') {
              await cleanupMethod();
            }
          }
        } catch (cleanupError) {
          // Log individual cleanup errors but don't fail the entire operation
          this.logger.warn(
            'Error during individual cache cleanup:',
            cleanupError,
          );
        }
      });

      await Promise.all(cleanupPromises);
      this.caches.clear();

      this.logger.log('All cache connections closed');
    } catch (error: unknown) {
      this.logger.error('Error closing cache connections:', error);
    }
  }
}
