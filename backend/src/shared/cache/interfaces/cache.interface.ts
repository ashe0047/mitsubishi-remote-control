/**
 * Cache key interface for type-safe cache operations
 */
export interface CacheKey<T = string> {
  key: T;
  prefix?: string;
  namespace?: string;
}

/**
 * Cache value with metadata
 */
export interface CacheValue<T = unknown> {
  value: T;
  timestamp?: number;
  ttl?: number;
}

/**
 * Cache operation result
 */
export interface CacheResult<T = unknown> {
  value: T | null;
  hit: boolean;
  key: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  total: number;
  hitRate: number;
  store: string;
}

/**
 * Cache options for operations
 */
export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  prefix?: string;
}

/**
 * Cache store configuration
 */
export interface CacheStoreConfig {
  name: string;
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  enableOfflineQueue?: boolean;
  retryDelayOnFailover?: number;
}

/**
 * Cache module configuration options
 */
export interface CacheModuleOptions {
  ttl?: number;
  max?: number;
  isGlobal?: boolean;
  store?: string;
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
}

/**
 * Cache factory interface for creating cache instances
 */
export interface CacheFactory {
  createCache<T>(options?: CacheOptions): Cache;
}

/**
 * Generic cache interface with type safety
 */
export interface ICache<T = unknown> {
  /**
   * Get value from cache
   */
  get<K extends keyof T>(key: K): Promise<CacheResult<T[K] | null>>;

  /**
   * Get value with cache options
   */
  getWithOptions<K extends keyof T>(
    key: K,
    options?: CacheOptions,
  ): Promise<CacheResult<T[K] | null>>;

  /**
   * Set value in cache
   */
  set<K extends keyof T>(
    key: K,
    value: T[K],
    options?: CacheOptions,
  ): Promise<void>;

  /**
   * Set value with specific TTL
   */
  setWithTTL<K extends keyof T>(
    key: K,
    value: T[K],
    ttl: number,
  ): Promise<void>;

  /**
   * Delete value from cache
   */
  del<K extends keyof T>(key: K): Promise<boolean>;

  /**
   * Delete multiple values
   */
  delMany<K extends keyof T>(keys: K[]): Promise<boolean[]>;

  /**
   * Clear cache
   */
  clear(): Promise<void>;

  /**
   * Reset entire cache
   */
  reset(): Promise<void>;

  /**
   * Get cache keys matching pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Check if key exists
   */
  has<K extends keyof T>(key: K): Promise<boolean>;

  /**
   * Get TTL for key
   */
  getTTL<K extends keyof T>(key: K): Promise<number>;

  /**
   * Store multiple values
   */
  mset<K extends keyof T>(entries: Array<[K, T[K]]>): Promise<void>;

  /**
   * Retrieve multiple values
   */
  mget<K extends keyof T>(keys: K[]): Promise<Array<CacheResult<T[K] | null>>>;

  /**
   * Delete multiple values
   */
  mdel<K extends keyof T>(keys: K[]): Promise<boolean[]>;
}

/**
 * Cache manager interface for managing multiple caches
 */
export interface ICacheManager {
  /**
   * Get cache instance by name
   */
  getCache<T extends Record<string, unknown> = Record<string, unknown>>(
    name?: string,
  ): ICache<T>;

  /**
   * Set global cache options
   */
  setGlobalOptions(options: CacheOptions): void;

  /**
   * Get store configuration
   */
  getStoreConfig(): CacheStoreConfig;

  /**
   * Close all cache connections
   */
  close(): Promise<void>;
}
