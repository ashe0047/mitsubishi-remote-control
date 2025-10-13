/**
 * Performance Cache Utilities
 *
 * Advanced caching utilities for optimizing API requests and data access.
 * Includes TTL, LRU eviction, request deduplication, and performance monitoring.
 */

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  isStale: boolean;
  size?: number; // Estimated size in bytes
}

// Cache statistics
interface CacheStats {
  size: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  totalRequests: number;
  hitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
}

// Cache configuration
interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  staleWhileRevalidate: number;
  maxMemoryUsage: number; // in bytes
  enablePerformanceMonitoring: boolean;
}

/**
 * Advanced LRU Cache with TTL and performance monitoring
 */
export class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    size: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    totalRequests: 0,
    hitRate: 0,
    averageAccessTime: 0,
    memoryUsage: 0
  };
  
  private config: CacheConfig;
  private performanceEntries: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      staleWhileRevalidate: 30 * 1000, // 30 seconds
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB
      enablePerformanceMonitoring: true,
      ...config
    };
  }

  /**
   * Get item from cache
   */
  get(key: string): T | undefined {
    const startTime = this.config.enablePerformanceMonitoring ? performance.now() : 0;
    
    this.stats.totalRequests++;
    
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.missCount++;
      this.updateHitRate();
      return undefined;
    }

    // Check if entry is expired
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.missCount++;
      this.stats.size--;
      this.updateHitRate();
      return undefined;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = now;
    
    // Move to end of access order (most recently used)
    this.moveToEnd(key);
    
    this.stats.hitCount++;
    this.updateHitRate();
    
    // Record performance
    if (this.config.enablePerformanceMonitoring) {
      const accessTime = performance.now() - startTime;
      this.recordPerformance(accessTime);
    }
    
    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    
    // Estimate size
    const estimatedSize = this.estimateSize(data);
    
    // Check memory usage
    if (this.stats.memoryUsage + estimatedSize > this.config.maxMemoryUsage) {
      this.evictByMemory(estimatedSize);
    }
    
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 1,
      lastAccessed: now,
      isStale: false,
      size: estimatedSize
    };
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.currentSize -= existingEntry.size;
    }
    
    // Add new entry
    this.cache.set(key, entry);
    this.currentSize += estimatedSize;
    
    // Update stats
    this.stats.setCount++;
    this.stats.memoryUsage = this.currentSize;
  }
}