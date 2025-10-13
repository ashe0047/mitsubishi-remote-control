/**
 * Performance Monitoring Interceptor for Axios Client
 * Provides request deduplication, bundle size optimization, metrics collection, and cancellation
 */

import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError, CancelTokenSource } from 'axios';
import axios from 'axios';
import './types'; // Import type extensions

export interface PerformanceInterceptorConfig {
  enableRequestDeduplication: boolean;
  enableBundleOptimization: boolean;
  enableMetricsCollection: boolean;
  enableRequestCancellation: boolean;
  maxConcurrentRequests: number;
  deduplicationTTL: number; // Time to live for deduplication cache in ms
  metricsRetentionTime: number; // How long to keep metrics in ms
  slowRequestThreshold: number; // Threshold for slow request detection in ms
}

export interface RequestDeduplicationEntry {
  promise: Promise<any>;
  timestamp: number;
  requestCount: number;
}

export interface PerformanceMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  cancelledRequests: number;
  concurrentRequests: number;
  maxConcurrentRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  cacheHitRate: number;
  bundleSize: number;
  memoryUsage: number;
}

export interface RequestCancellation {
  requestId: string;
  cancelToken: CancelTokenSource;
  timestamp: number;
  reason?: string;
}

const DEFAULT_PERFORMANCE_CONFIG: PerformanceInterceptorConfig = {
  enableRequestDeduplication: true,
  enableBundleOptimization: true,
  enableMetricsCollection: true,
  enableRequestCancellation: true,
  maxConcurrentRequests: 10,
  deduplicationTTL: 5000, // 5 seconds
  metricsRetentionTime: 300000, // 5 minutes
  slowRequestThreshold: 2000, // 2 seconds
};

/**
 * Performance Monitoring Interceptor class
 * Provides comprehensive performance monitoring and optimization features
 */
export class PerformanceInterceptor {
  private config: PerformanceInterceptorConfig;
  private deduplicationCache: Map<string, RequestDeduplicationEntry>;
  private activeCancellations: Map<string, RequestCancellation>;
  private metrics: PerformanceMetrics;
  private concurrentRequestCount: number;
  private requestTimings: Map<string, number>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(config: Partial<PerformanceInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.deduplicationCache = new Map();
    this.activeCancellations = new Map();
    this.concurrentRequestCount = 0;
    this.requestTimings = new Map();
    this.cleanupInterval = null;

    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cancelledRequests: 0,
      concurrentRequests: 0,
      maxConcurrentRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      cacheHitRate: 0,
      bundleSize: 0,
      memoryUsage: 0,
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Setup performance interceptors on an axios instance
   */
  setupInterceptors(axiosInstance: AxiosInstance): void {
    // Request interceptor for performance monitoring and deduplication
    axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    // Response interceptor for metrics collection and cleanup
    axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Handle outgoing requests with deduplication and performance tracking
   */
  private async handleRequest(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const requestId = config.metadata?.requestId || this.generateRequestId();
    
    // Check concurrent request limit
    if (this.concurrentRequestCount >= this.config.maxConcurrentRequests) {
      throw new Error(`Maximum concurrent requests (${this.config.maxConcurrentRequests}) exceeded`);
    }

    // Handle request deduplication
    if (this.config.enableRequestDeduplication && this.isDeduplicatable(config)) {
      const deduplicationKey = this.generateDeduplicationKey(config);
      const cachedEntry = this.deduplicationCache.get(deduplicationKey);
      
      if (cachedEntry && this.isCacheValid(cachedEntry)) {
        this.metrics.deduplicatedRequests++;
        this.updateCacheHitRate();
        
        // Return the cached promise
        throw new axios.Cancel('Request deduplicated - using cached response');
      }
    }

    // Setup request cancellation if enabled
    if (this.config.enableRequestCancellation) {
      const cancelToken = axios.CancelToken.source();
      config.cancelToken = cancelToken.token;
      
      this.activeCancellations.set(requestId, {
        requestId,
        cancelToken,
        timestamp: Date.now(),
      });
    }

    // Track concurrent requests
    this.concurrentRequestCount++;
    this.metrics.concurrentRequests = this.concurrentRequestCount;
    this.metrics.maxConcurrentRequests = Math.max(
      this.metrics.maxConcurrentRequests,
      this.concurrentRequestCount
    );

    // Start timing
    this.requestTimings.set(requestId, Date.now());

    // Update metrics
    this.metrics.totalRequests++;

    // Add metadata
    config.metadata = { ...config.metadata, requestId, startTime: Date.now() };

    return config;
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: any): Promise<never> {
    this.concurrentRequestCount = Math.max(0, this.concurrentRequestCount - 1);
    return Promise.reject(error);
  }

  /**
   * Handle successful responses with metrics collection
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    const requestId = response.config.metadata?.requestId;
    
    if (requestId) {
      this.updateResponseMetrics(requestId, false);
      this.cleanupRequest(requestId);
    }

    // Decrease concurrent request count
    this.concurrentRequestCount = Math.max(0, this.concurrentRequestCount - 1);

    // Handle deduplication caching
    if (this.config.enableRequestDeduplication && this.isDeduplicatable(response.config)) {
      this.cacheResponse(response);
    }

    return response;
  }

  /**
   * Handle response errors with metrics collection
   */
  private handleResponseError(error: AxiosError): Promise<never> {
    const requestId = error.config?.metadata?.requestId;
    
    if (requestId) {
      this.updateResponseMetrics(requestId, true);
      this.cleanupRequest(requestId);
    }

    // Decrease concurrent request count
    this.concurrentRequestCount = Math.max(0, this.concurrentRequestCount - 1);

    // Check if request was cancelled
    if (axios.isCancel(error)) {
      this.metrics.cancelledRequests++;
    }

    return Promise.reject(error);
  }

  /**
   * Generate deduplication key for request
   */
  private generateDeduplicationKey(config: InternalAxiosRequestConfig): string {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data && method !== 'GET' ? JSON.stringify(config.data) : '';
    
    return `${method}:${url}:${params}:${data}`;
  }

  /**
   * Check if request is deduplicatable (GET requests and idempotent operations)
   */
  private isDeduplicatable(config: InternalAxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase() || 'GET';
    return ['GET', 'HEAD', 'OPTIONS'].includes(method);
  }

  /**
   * Check if cached entry is still valid
   */
  private isCacheValid(entry: RequestDeduplicationEntry): boolean {
    return Date.now() - entry.timestamp < this.config.deduplicationTTL;
  }

  /**
   * Cache response for deduplication
   */
  private cacheResponse(response: AxiosResponse): void {
    const deduplicationKey = this.generateDeduplicationKey(response.config);
    
    const entry: RequestDeduplicationEntry = {
      promise: Promise.resolve(response),
      timestamp: Date.now(),
      requestCount: 1,
    };

    this.deduplicationCache.set(deduplicationKey, entry);
  }

  /**
   * Update response timing metrics
   */
  private updateResponseMetrics(requestId: string, isError: boolean): void {
    const startTime = this.requestTimings.get(requestId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    
    // Update average response time
    const totalRequests = this.metrics.totalRequests;
    if (totalRequests > 0) {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
    }

    // Track slow requests
    if (duration > this.config.slowRequestThreshold) {
      this.metrics.slowRequests++;
    }

    this.requestTimings.delete(requestId);
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.cacheHitRate = this.metrics.deduplicatedRequests / this.metrics.totalRequests;
    }
  }

  /**
   * Cleanup request-related data
   */
  private cleanupRequest(requestId: string): void {
    this.activeCancellations.delete(requestId);
    this.requestTimings.delete(requestId);
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(requestId: string, reason?: string): boolean {
    const cancellation = this.activeCancellations.get(requestId);
    if (!cancellation) return false;

    cancellation.cancelToken.cancel(reason || 'Request cancelled by user');
    cancellation.reason = reason;
    this.metrics.cancelledRequests++;
    
    return true;
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(reason?: string): number {
    let cancelledCount = 0;
    
    this.activeCancellations.forEach((cancellation) => {
      cancellation.cancelToken.cancel(reason || 'All requests cancelled');
      cancellation.reason = reason;
      cancelledCount++;
    });

    this.metrics.cancelledRequests += cancelledCount;
    this.activeCancellations.clear();
    
    return cancelledCount;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Update memory usage if available
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
    }

    // Update bundle size estimation
    this.metrics.bundleSize = this.estimateBundleSize();

    return { ...this.metrics };
  }

  /**
   * Get active request cancellations
   */
  getActiveCancellations(): RequestCancellation[] {
    return Array.from(this.activeCancellations.values());
  }

  /**
   * Get deduplication cache statistics
   */
  getDeduplicationStats(): {
    cacheSize: number;
    hitRate: number;
    totalHits: number;
  } {
    return {
      cacheSize: this.deduplicationCache.size,
      hitRate: this.metrics.cacheHitRate,
      totalHits: this.metrics.deduplicatedRequests,
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  clearCache(): void {
    this.deduplicationCache.clear();
    this.requestTimings.clear();
    this.activeCancellations.clear();
    
    // Reset metrics but keep totals
    this.metrics.concurrentRequests = 0;
    this.concurrentRequestCount = 0;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cancelledRequests: 0,
      concurrentRequests: 0,
      maxConcurrentRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      cacheHitRate: 0,
      bundleSize: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Start cleanup interval for expired cache entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean up deduplication cache
    this.deduplicationCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.config.deduplicationTTL) {
        this.deduplicationCache.delete(key);
      }
    });

    // Clean up old cancellations
    this.activeCancellations.forEach((cancellation, key) => {
      if (now - cancellation.timestamp > this.config.metricsRetentionTime) {
        this.activeCancellations.delete(key);
      }
    });
  }

  /**
   * Estimate bundle size impact
   */
  private estimateBundleSize(): number {
    // This is a rough estimation - in practice, you'd use webpack-bundle-analyzer
    const baseAxiosSize = 50000; // ~50KB for axios
    const interceptorSize = 10000; // ~10KB for interceptors
    const cacheSize = this.deduplicationCache.size * 100; // Rough estimate
    
    return baseAxiosSize + interceptorSize + cacheSize;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update interceptor configuration
   */
  updateConfig(newConfig: Partial<PerformanceInterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceInterceptorConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.clearCache();
    this.resetMetrics();
  }
}

/**
 * Create and export default performance interceptor instance
 */
export const performanceInterceptor = new PerformanceInterceptor();

/**
 * Helper function to setup performance interceptors on an axios instance
 */
export function setupPerformanceInterceptors(
  axiosInstance: AxiosInstance,
  config?: Partial<PerformanceInterceptorConfig>
): PerformanceInterceptor {
  const interceptor = new PerformanceInterceptor(config);
  interceptor.setupInterceptors(axiosInstance);
  return interceptor;
}