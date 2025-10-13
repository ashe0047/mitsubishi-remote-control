/**
 * Comprehensive TypeScript types for Axios Interceptors
 * Provides type safety for interceptor implementations and configurations
 */

import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { 
  ApiError, 
  ApiRequestConfig, 
  LogData, 
  PerformanceMetrics, 
  RequestMetrics,
  ErrorContext,
  RequestMetadata 
} from './types';

// =============================================================================
// BASE INTERCEPTOR TYPES
// =============================================================================

/**
 * Base interceptor interface that all interceptors must implement
 */
export interface BaseInterceptor {
  setupInterceptors(instance: AxiosInstance): void;
  cleanup?(): void;
  isEnabled(): boolean;
  enable(): void;
  disable(): void;
}

/**
 * Interceptor lifecycle hooks
 */
export interface InterceptorLifecycle {
  onSetup?(): void;
  onCleanup?(): void;
  onEnable?(): void;
  onDisable?(): void;
  onError?(error: Error): void;
}

/**
 * Interceptor metadata
 */
export interface InterceptorMetadata {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  priority: number;
}

// =============================================================================
// AUTHENTICATION INTERCEPTOR TYPES
// =============================================================================

/**
 * Authentication interceptor configuration
 */
export interface AuthInterceptorConfig {
  // Token configuration
  tokenHeader: string;
  tokenPrefix: string;
  tokenType: 'Bearer' | 'Basic' | 'Custom';
  
  // Refresh configuration
  refreshEndpoint: string;
  refreshMethod: 'POST' | 'PUT' | 'PATCH';
  refreshThreshold: number; // seconds before expiry
  maxRefreshRetries: number;
  autoRefresh: boolean;
  
  // Token storage
  tokenStorage: 'localStorage' | 'sessionStorage' | 'memory' | 'custom';
  storageKey: string;
  
  // Callbacks
  onAuthFailure?: (error: ApiError) => void | Promise<void>;
  onTokenRefresh?: (newToken: string, oldToken?: string) => void | Promise<void>;
  onTokenExpired?: (token: string) => void | Promise<void>;
  
  // Custom token providers
  getToken?: () => string | null | Promise<string | null>;
  setToken?: (token: string) => void | Promise<void>;
  removeToken?: () => void | Promise<void>;
  
  // Validation
  validateToken?: (token: string) => boolean | Promise<boolean>;
  isTokenExpired?: (token: string) => boolean | Promise<boolean>;
  
  // Exclusions
  excludeUrls?: string[] | RegExp[];
  includeUrls?: string[] | RegExp[];
}

/**
 * Token information interface
 */
export interface TokenInfo {
  token: string;
  type: string;
  expiresAt?: number;
  refreshToken?: string;
  scope?: string[];
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  token?: TokenInfo;
  user?: any;
  lastRefresh?: number;
  refreshInProgress: boolean;
  failedRefreshAttempts: number;
}

/**
 * Authentication interceptor interface
 */
export interface AuthInterceptor extends BaseInterceptor {
  getConfig(): AuthInterceptorConfig;
  updateConfig(config: Partial<AuthInterceptorConfig>): void;
  getAuthState(): AuthState;
  setToken(token: string): Promise<void>;
  getToken(): Promise<string | null>;
  removeToken(): Promise<void>;
  refreshToken(): Promise<string>;
  isTokenValid(): Promise<boolean>;
  logout(): Promise<void>;
}

// =============================================================================
// ERROR INTERCEPTOR TYPES
// =============================================================================

/**
 * Error classification rules
 */
export interface ErrorClassificationRule {
  condition: (error: AxiosError) => boolean;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

/**
 * Error interceptor configuration
 */
export interface ErrorInterceptorConfig {
  // Transformation settings
  enableTransformation: boolean;
  includeStack: boolean;
  includeContext: boolean;
  sanitizeData: boolean;
  maxDetailLength: number;
  
  // Retry settings
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  retryMultiplier: number;
  maxRetryDelay: number;
  
  // Classification
  classificationRules: ErrorClassificationRule[];
  defaultCategory: string;
  defaultSeverity: 'low' | 'medium' | 'high' | 'critical';
  
  // Callbacks
  onError?: (error: ApiError, originalError: AxiosError) => void | Promise<void>;
  onRetry?: (error: ApiError, retryCount: number) => void | Promise<void>;
  onMaxRetriesExceeded?: (error: ApiError) => void | Promise<void>;
  
  // Custom transformers
  errorTransformer?: (error: AxiosError) => ApiError;
  contextEnhancer?: (error: AxiosError) => ErrorContext;
  
  // Filtering
  excludeUrls?: string[] | RegExp[];
  includeUrls?: string[] | RegExp[];
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsByStatus: Record<number, number>;
  errorsBySeverity: Record<string, number>;
  retryStatistics: {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryCount: number;
  };
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Error interceptor interface
 */
export interface ErrorInterceptor extends BaseInterceptor {
  getConfig(): ErrorInterceptorConfig;
  updateConfig(config: Partial<ErrorInterceptorConfig>): void;
  getErrorStatistics(): ErrorStatistics;
  clearStatistics(): void;
  addClassificationRule(rule: ErrorClassificationRule): void;
  removeClassificationRule(index: number): void;
  classifyError(error: AxiosError): { category: string; severity: string; retryable: boolean };
}

// =============================================================================
// LOGGING INTERCEPTOR TYPES
// =============================================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log format types
 */
export type LogFormat = 'json' | 'text' | 'structured' | 'custom';

/**
 * Logging interceptor configuration
 */
export interface LoggingInterceptorConfig {
  // Basic settings
  enableLogging: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: LogLevel;
  logFormat: LogFormat;
  
  // Content settings
  includeHeaders: boolean;
  includeBody: boolean;
  includeQuery: boolean;
  includeResponse: boolean;
  maxBodyLength: number;
  maxHeaderLength: number;
  
  // Filtering
  excludeUrls?: string[] | RegExp[];
  includeUrls?: string[] | RegExp[];
  excludeHeaders?: string[];
  includeHeaders?: string[];
  
  // Sanitization
  sanitizeHeaders: boolean;
  sanitizeBody: boolean;
  sensitiveFields: string[];
  
  // Performance
  enableTimingDetails: boolean;
  enableSizeTracking: boolean;
  enableConcurrencyTracking: boolean;
  
  // Output
  outputTarget: 'console' | 'file' | 'network' | 'custom';
  outputConfig?: {
    filePath?: string;
    endpoint?: string;
    batchSize?: number;
    flushInterval?: number;
  };
  
  // Callbacks
  onLog?: (logData: LogData) => void | Promise<void>;
  onPerformanceData?: (metrics: PerformanceMetrics) => void | Promise<void>;
  
  // Custom formatters
  requestFormatter?: (config: AxiosRequestConfig) => any;
  responseFormatter?: (response: AxiosResponse) => any;
  errorFormatter?: (error: AxiosError) => any;
}

/**
 * Enhanced log data with detailed information
 */
export interface EnhancedLogData extends LogData {
  // Request details
  requestSize?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  queryParams?: Record<string, any>;
  
  // Response details
  responseSize?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  
  // Timing details
  timing?: {
    start: number;
    end: number;
    duration: number;
    phases?: {
      dns?: number;
      connection?: number;
      tls?: number;
      request?: number;
      response?: number;
    };
  };
  
  // Context
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  
  // Performance
  memoryUsage?: number;
  cpuUsage?: number;
  networkLatency?: number;
}

/**
 * Logging interceptor interface
 */
export interface LoggingInterceptor extends BaseInterceptor {
  getConfig(): LoggingInterceptorConfig;
  updateConfig(config: Partial<LoggingInterceptorConfig>): void;
  getPerformanceMetrics(): PerformanceMetrics;
  clearMetrics(): void;
  setLogLevel(level: LogLevel): void;
  addSensitiveField(field: string): void;
  removeSensitiveField(field: string): void;
  flushLogs(): Promise<void>;
}

// =============================================================================
// PERFORMANCE INTERCEPTOR TYPES
// =============================================================================

/**
 * Cache strategy types
 */
export type CacheStrategy = 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB' | 'custom';

/**
 * Request deduplication strategy
 */
export type DeduplicationStrategy = 'url' | 'url+method' | 'url+method+body' | 'custom';

/**
 * Performance interceptor configuration
 */
export interface PerformanceInterceptorConfig {
  // Request deduplication
  enableRequestDeduplication: boolean;
  deduplicationStrategy: DeduplicationStrategy;
  deduplicationTimeout: number;
  maxPendingRequests: number;
  
  // Caching
  enableCaching: boolean;
  cacheStrategy: CacheStrategy;
  cacheTimeout: number;
  maxCacheSize: number;
  cacheKeyGenerator?: (config: AxiosRequestConfig) => string;
  
  // Concurrency control
  maxConcurrentRequests: number;
  requestQueueSize: number;
  priorityLevels: string[];
  
  // Performance monitoring
  enableMetrics: boolean;
  enableTimingAPI: boolean;
  enableResourceTiming: boolean;
  metricsInterval: number;
  
  // Optimization
  enableCompression: boolean;
  enableKeepAlive: boolean;
  connectionPoolSize: number;
  
  // Callbacks
  onPerformanceData?: (metrics: PerformanceMetrics) => void | Promise<void>;
  onCacheHit?: (key: string, data: any) => void;
  onCacheMiss?: (key: string) => void;
  onRequestQueued?: (config: AxiosRequestConfig) => void;
  onRequestDequeued?: (config: AxiosRequestConfig) => void;
  
  // Custom implementations
  customCache?: CacheImplementation;
  customDeduplicator?: DeduplicationImplementation;
  customQueue?: QueueImplementation;
}

/**
 * Cache implementation interface
 */
export interface CacheImplementation {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
}

/**
 * Deduplication implementation interface
 */
export interface DeduplicationImplementation {
  generateKey(config: AxiosRequestConfig): string;
  isDuplicate(key: string): boolean;
  addRequest(key: string, promise: Promise<any>): void;
  removeRequest(key: string): void;
  clear(): void;
}

/**
 * Queue implementation interface
 */
export interface QueueImplementation {
  enqueue(config: AxiosRequestConfig, priority?: string): Promise<void>;
  dequeue(): Promise<AxiosRequestConfig | null>;
  size(): number;
  clear(): void;
  isEmpty(): boolean;
  isFull(): boolean;
}

/**
 * Detailed performance metrics
 */
export interface DetailedPerformanceMetrics extends PerformanceMetrics {
  // Cache metrics
  cacheMetrics: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    evictions: number;
  };
  
  // Deduplication metrics
  deduplicationMetrics: {
    duplicatesDetected: number;
    duplicatesAvoided: number;
    savingsPercentage: number;
  };
  
  // Queue metrics
  queueMetrics: {
    maxQueueSize: number;
    averageQueueSize: number;
    totalQueued: number;
    averageWaitTime: number;
  };
  
  // Resource metrics
  resourceMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    networkUtilization: number;
    connectionPoolUsage: number;
  };
}

/**
 * Performance interceptor interface
 */
export interface PerformanceInterceptor extends BaseInterceptor {
  getConfig(): PerformanceInterceptorConfig;
  updateConfig(config: Partial<PerformanceInterceptorConfig>): void;
  getPerformanceMetrics(): DetailedPerformanceMetrics;
  clearCache(): void;
  clearMetrics(): void;
  cancelRequest(requestId: string): void;
  getQueueStatus(): {
    size: number;
    maxSize: number;
    pending: number;
  };
  getCacheStatus(): {
    size: number;
    maxSize: number;
    hitRate: number;
  };
}

// =============================================================================
// INTERCEPTOR FACTORY TYPES
// =============================================================================

/**
 * Interceptor factory configuration
 */
export interface InterceptorFactoryConfig {
  type: 'auth' | 'error' | 'logging' | 'performance' | 'custom';
  config: any;
  metadata?: InterceptorMetadata;
  lifecycle?: InterceptorLifecycle;
}

/**
 * Interceptor factory interface
 */
export interface InterceptorFactory {
  create(config: InterceptorFactoryConfig): BaseInterceptor;
  getAvailableTypes(): string[];
  getDefaultConfig(type: string): any;
  validateConfig(type: string, config: any): boolean;
}

/**
 * Interceptor manager interface
 */
export interface InterceptorManager {
  register(name: string, interceptor: BaseInterceptor): void;
  unregister(name: string): void;
  get(name: string): BaseInterceptor | undefined;
  getAll(): Record<string, BaseInterceptor>;
  enable(name: string): void;
  disable(name: string): void;
  enableAll(): void;
  disableAll(): void;
  clear(): void;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Interceptor configuration validator
 */
export type InterceptorConfigValidator<T = any> = (config: T) => boolean | string[];

/**
 * Interceptor middleware function
 */
export type InterceptorMiddleware = (
  config: AxiosRequestConfig,
  next: () => Promise<AxiosResponse>
) => Promise<AxiosResponse>;

/**
 * Interceptor hook function
 */
export type InterceptorHook<T = any> = (data: T) => void | Promise<void>;

/**
 * Interceptor condition function
 */
export type InterceptorCondition = (config: AxiosRequestConfig) => boolean;

// =============================================================================
// EXPORTS
// =============================================================================

export * from './types';