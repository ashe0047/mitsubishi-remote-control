/**
 * Comprehensive TypeScript types for Axios with enhanced functionality
 * Provides type safety for HTTP client operations, interceptors, and error handling
 */

import { 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError, 
  InternalAxiosRequestConfig,
  AxiosInstance,
  Method,
  ResponseType,
  AxiosHeaders
} from 'axios';

// =============================================================================
// AXIOS EXTENSIONS
// =============================================================================

// Extend axios types to include custom metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata;
  }
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Custom metadata attached to requests for tracking and debugging
 */
export interface RequestMetadata {
  requestId?: string;
  startTime?: number;
  priority?: RequestPriority;
  deduplicationKey?: string;
  retryCount?: number;
  source?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Request priority levels for queue management
 */
export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Enhanced request configuration with custom options
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
  // Custom options
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  deduplicationKey?: string;
  priority?: RequestPriority;
  
  // Performance options
  enableCaching?: boolean;
  cacheTimeout?: number;
  enableCompression?: boolean;
  
  // Authentication options
  requireAuth?: boolean;
  skipAuthRefresh?: boolean;
  
  // Validation options
  validateResponse?: boolean;
  responseSchema?: any; // Zod schema or similar
  
  // Debugging options
  debugMode?: boolean;
  tags?: string[];
  source?: string;
}

/**
 * Request configuration for different HTTP methods
 */
export interface GetRequestConfig extends Omit<ApiRequestConfig, 'data'> {
  params?: Record<string, any>;
}

export interface PostRequestConfig extends ApiRequestConfig {
  data?: any;
}

export interface PutRequestConfig extends ApiRequestConfig {
  data?: any;
}

export interface PatchRequestConfig extends ApiRequestConfig {
  data?: any;
}

export interface DeleteRequestConfig extends Omit<ApiRequestConfig, 'data'> {
  params?: Record<string, any>;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Standardized API response wrapper
 */
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: number;
  requestId?: string;
  version?: string;
  metadata?: ResponseMetadata;
}

/**
 * Response metadata for debugging and monitoring
 */
export interface ResponseMetadata {
  processingTime?: number;
  cacheHit?: boolean;
  retryCount?: number;
  source?: string;
  [key: string]: any;
}

/**
 * Enhanced axios response with custom metadata
 */
export interface EnhancedAxiosResponse<T = any> extends AxiosResponse<T> {
  metadata?: ResponseMetadata;
  timing?: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  success: boolean;
  message?: string;
  timestamp: number;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'server'
  | 'client'
  | 'timeout'
  | 'cancelled'
  | 'unknown';

/**
 * Enhanced API error with comprehensive information
 */
export interface ApiError extends Error {
  // Basic error info
  code: string;
  status: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  
  // Error details
  details?: any;
  timestamp: number;
  requestId?: string;
  
  // Retry information
  retryable: boolean;
  retryAfter?: number;
  maxRetries?: number;
  currentRetry?: number;
  
  // Context information
  context?: ErrorContext;
  
  // Original axios error
  originalError?: AxiosError;
  
  // Stack trace enhancement
  enhancedStack?: string;
}

/**
 * Error context for debugging
 */
export interface ErrorContext {
  url?: string;
  method?: Method;
  requestData?: any;
  responseData?: any;
  headers?: Record<string, string>;
  userAgent?: string;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

/**
 * Error transformation configuration
 */
export interface ErrorTransformConfig {
  includeStack?: boolean;
  includeRequestData?: boolean;
  includeResponseData?: boolean;
  sanitizeHeaders?: boolean;
  maxDetailLength?: number;
}

// =============================================================================
// INTERCEPTOR TYPES
// =============================================================================

/**
 * Base interceptor interface
 */
export interface BaseInterceptor {
  setupInterceptors(instance: AxiosInstance): void;
  cleanup?(): void;
}

/**
 * Authentication interceptor configuration
 */
export interface AuthInterceptorConfig {
  tokenHeader: string;
  tokenPrefix: string;
  refreshEndpoint: string;
  refreshThreshold: number;
  maxRefreshRetries: number;
  autoRefresh: boolean;
  onAuthFailure?: (error: ApiError) => void;
  onTokenRefresh?: (newToken: string) => void;
}

/**
 * Error interceptor configuration
 */
export interface ErrorInterceptorConfig {
  enableTransformation: boolean;
  includeStack: boolean;
  includeContext: boolean;
  sanitizeData: boolean;
  maxRetries: number;
  retryDelay: number;
  onError?: (error: ApiError) => void;
}

/**
 * Logging interceptor configuration
 */
export interface LoggingInterceptorConfig {
  enableLogging: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders: boolean;
  includeBody: boolean;
  maxBodyLength: number;
  onLog?: (logData: LogData) => void;
}

/**
 * Performance interceptor configuration
 */
export interface PerformanceInterceptorConfig {
  enableRequestDeduplication: boolean;
  enableCaching: boolean;
  maxConcurrentRequests: number;
  cacheTimeout: number;
  enableMetrics: boolean;
  onPerformanceData?: (metrics: PerformanceMetrics) => void;
}

/**
 * Log data structure
 */
export interface LogData {
  type: 'request' | 'response' | 'error';
  method?: Method;
  url?: string;
  status?: number;
  duration?: number;
  size?: number;
  timestamp: number;
  requestId?: string;
  data?: any;
  headers?: Record<string, string>;
  error?: ApiError;
}

// =============================================================================
// PERFORMANCE TYPES
// =============================================================================

/**
 * Request performance metrics
 */
export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
  timeoutCount: number;
  cancelledCount: number;
}

/**
 * Performance metrics with detailed breakdown
 */
export interface PerformanceMetrics extends RequestMetrics {
  // Request size metrics
  averageRequestSize: number;
  averageResponseSize: number;
  totalDataTransferred: number;
  
  // Timing metrics
  connectionTime: number;
  dnsLookupTime: number;
  tlsHandshakeTime: number;
  
  // Error breakdown
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByStatus: Record<number, number>;
  
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  
  // Concurrency metrics
  maxConcurrentRequests: number;
  averageConcurrentRequests: number;
  queuedRequests: number;
}

/**
 * Request timing information
 */
export interface RequestTiming {
  start: number;
  end: number;
  duration: number;
  phases: {
    dns?: number;
    connection?: number;
    tls?: number;
    request?: number;
    response?: number;
  };
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Comprehensive axios client configuration
 */
export interface AxiosClientConfig {
  // Basic configuration
  baseURL: string;
  timeout: number;
  
  // Retry configuration
  retries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
  
  // Feature flags
  enableLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableRequestDeduplication: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  
  // Limits
  maxConcurrentRequests: number;
  maxRequestSize: number;
  maxResponseSize: number;
  
  // Authentication
  auth?: AuthInterceptorConfig;
  
  // Error handling
  errorHandling?: ErrorInterceptorConfig;
  
  // Logging
  logging?: LoggingInterceptorConfig;
  
  // Performance
  performance?: PerformanceInterceptorConfig;
  
  // Custom headers
  defaultHeaders?: Record<string, string>;
  
  // Environment-specific settings
  environment?: 'development' | 'staging' | 'production' | 'test';
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Type guard for API errors
 */
export type ApiErrorGuard = (error: any) => error is ApiError;

/**
 * Type guard for axios errors
 */
export type AxiosErrorGuard = (error: any) => error is AxiosError;

/**
 * Request transformer function type
 */
export type RequestTransformer<T = any> = (data: T, headers: AxiosHeaders) => T;

/**
 * Response transformer function type
 */
export type ResponseTransformer<T = any> = (data: T) => T;

/**
 * Error transformer function type
 */
export type ErrorTransformer = (error: AxiosError) => ApiError;

/**
 * Validation function type
 */
export type ValidationFunction<T = any> = (data: T) => boolean | Promise<boolean>;

/**
 * Cache key generator function type
 */
export type CacheKeyGenerator = (config: ApiRequestConfig) => string;

/**
 * Request ID generator function type
 */
export type RequestIdGenerator = () => string;

// =============================================================================
// FACTORY TYPES
// =============================================================================

/**
 * Axios client factory configuration
 */
export interface AxiosClientFactoryConfig {
  name: string;
  config: AxiosClientConfig;
  interceptors?: BaseInterceptor[];
  transformers?: {
    request?: RequestTransformer[];
    response?: ResponseTransformer[];
    error?: ErrorTransformer;
  };
}

/**
 * Client instance registry
 */
export interface ClientRegistry {
  [name: string]: AxiosInstance;
}

// =============================================================================
// TESTING TYPES
// =============================================================================

/**
 * Mock configuration for testing
 */
export interface MockConfig {
  baseURL?: string;
  responses?: Record<string, any>;
  delays?: Record<string, number>;
  errors?: Record<string, ApiError>;
  enableNetworkDelay?: boolean;
  networkDelayRange?: [number, number];
}

/**
 * Test utilities interface
 */
export interface TestUtils {
  mockResponse<T>(url: string, data: T, status?: number): void;
  mockError(url: string, error: ApiError): void;
  clearMocks(): void;
  getRequestHistory(): Array<{
    url: string;
    method: Method;
    data?: any;
    config?: ApiRequestConfig;
  }>;
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from 'axios';