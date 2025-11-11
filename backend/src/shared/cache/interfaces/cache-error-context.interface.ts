import {
  CacheOperation,
  CacheOperationCategory,
  getOperationCategory,
} from '../enums/cache-operation.enum';

// Re-export for convenience
export { CacheOperation, CacheOperationCategory, getOperationCategory };

/**
 * Cache connection status for error context
 */
export enum CacheConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Circuit breaker state for error context
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Circuit is open, fail fast
  HALF_OPEN = 'half-open', // Testing recovery
}

/**
 * Performance metrics for cache operations
 */
export interface CachePerformanceMetrics {
  /** Operation execution time in milliseconds */
  executionTime: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** Number of items in cache */
  cacheSize?: number;
  /** Current hit rate */
  hitRate?: number;
}

/**
 * Comprehensive cache error context for debugging and monitoring
 */
export interface CacheErrorContext {
  /** Cache operation that failed */
  operation: CacheOperation;
  /** Operation category for error handling strategy */
  category: CacheOperationCategory;
  /** Cache key or pattern that caused the error */
  key?: string;
  /** Cache namespace for isolation */
  namespace: string;
  /** TTL setting for the operation (if applicable) */
  ttl?: number;
  /** Current connection status with Redis */
  connectionStatus: CacheConnectionStatus;
  /** Circuit breaker state (if implemented) */
  circuitBreakerState?: CircuitBreakerState;
  /** Number of retry attempts made */
  retryAttempt?: number;
  /** Maximum retry attempts allowed */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Performance metrics for the operation */
  performance?: CachePerformanceMetrics;
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;
  /** Error timestamp */
  timestamp: Date;
}

/**
 * Default error context factory
 */
export function createCacheErrorContext(
  operation: CacheOperation,
  namespace: string,
  connectionStatus: CacheConnectionStatus = CacheConnectionStatus.CONNECTED,
  overrides: Partial<CacheErrorContext> = {},
): CacheErrorContext {
  return {
    operation,
    category: getOperationCategory(operation),
    namespace,
    connectionStatus,
    timestamp: new Date(),
    ...overrides,
  };
}
