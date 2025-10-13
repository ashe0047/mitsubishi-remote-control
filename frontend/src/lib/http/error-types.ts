/**
 * Comprehensive TypeScript types for HTTP Error Handling
 * Provides type safety for error classification, transformation, and recovery
 */

import { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';

// =============================================================================
// ERROR CLASSIFICATION TYPES
// =============================================================================

/**
 * Error severity levels for prioritization and handling
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification and routing
 */
export type ErrorCategory = 
  | 'network'           // Network connectivity issues
  | 'authentication'    // Auth token issues, login required
  | 'authorization'     // Permission denied, forbidden access
  | 'validation'        // Request validation failures
  | 'server'           // Server-side errors (5xx)
  | 'client'           // Client-side errors (4xx)
  | 'timeout'          // Request timeout errors
  | 'cancelled'        // Request cancellation
  | 'rate_limit'       // Rate limiting errors
  | 'maintenance'      // Server maintenance mode
  | 'unknown';         // Unclassified errors

/**
 * Error subcategories for more specific classification
 */
export type ErrorSubcategory = {
  network: 'connection_failed' | 'dns_error' | 'ssl_error' | 'proxy_error';
  authentication: 'token_expired' | 'token_invalid' | 'login_required' | 'token_missing';
  authorization: 'insufficient_permissions' | 'resource_forbidden' | 'account_suspended';
  validation: 'invalid_input' | 'missing_fields' | 'format_error' | 'constraint_violation';
  server: 'internal_error' | 'service_unavailable' | 'database_error' | 'external_service_error';
  client: 'bad_request' | 'not_found' | 'method_not_allowed' | 'conflict';
  timeout: 'request_timeout' | 'gateway_timeout' | 'read_timeout' | 'connection_timeout';
  cancelled: 'user_cancelled' | 'system_cancelled' | 'timeout_cancelled';
  rate_limit: 'requests_exceeded' | 'bandwidth_exceeded' | 'quota_exceeded';
  maintenance: 'scheduled_maintenance' | 'emergency_maintenance' | 'upgrade_in_progress';
  unknown: 'unclassified' | 'unexpected_error';
};

/**
 * Error recovery strategies
 */
export type ErrorRecoveryStrategy = 
  | 'retry'             // Automatic retry with backoff
  | 'refresh_token'     // Refresh auth token and retry
  | 'redirect_login'    // Redirect to login page
  | 'fallback'          // Use fallback data/service
  | 'cache'             // Return cached data if available
  | 'queue'             // Queue request for later
  | 'notify_user'       // Show user notification
  | 'ignore'            // Silently ignore error
  | 'escalate'          // Escalate to error boundary
  | 'custom';           // Custom recovery handler

// =============================================================================
// ENHANCED ERROR INTERFACES
// =============================================================================

/**
 * Comprehensive API error with enhanced metadata
 */
export interface ApiError extends Error {
  // Basic error information
  code: string;
  status: number;
  category: ErrorCategory;
  subcategory?: string;
  severity: ErrorSeverity;
  
  // Error details and context
  details?: ErrorDetails;
  timestamp: number;
  requestId?: string;
  correlationId?: string;
  
  // Retry and recovery information
  retryable: boolean;
  retryAfter?: number;
  maxRetries?: number;
  currentRetry?: number;
  recoveryStrategy?: ErrorRecoveryStrategy;
  
  // Context and debugging information
  context?: ErrorContext;
  userContext?: UserErrorContext;
  
  // Original error information
  originalError?: AxiosError;
  originalResponse?: AxiosResponse;
  originalRequest?: AxiosRequestConfig;
  
  // Stack trace enhancement
  enhancedStack?: string;
  sourceMap?: SourceMapInfo;
  
  // User-facing information
  userMessage?: string;
  userActions?: UserAction[];
  helpUrl?: string;
  
  // Metadata
  metadata?: ErrorMetadata;
}

/**
 * Detailed error information
 */
export interface ErrorDetails {
  // Technical details
  errorCode?: string;
  errorType?: string;
  errorSource?: string;
  
  // Validation details
  validationErrors?: ValidationError[];
  fieldErrors?: Record<string, string[]>;
  
  // Server details
  serverMessage?: string;
  serverCode?: string;
  serverTimestamp?: number;
  
  // Additional context
  additionalInfo?: Record<string, any>;
  debugInfo?: DebugInfo;
}

/**
 * Error context for debugging and analysis
 */
export interface ErrorContext {
  // Request information
  url?: string;
  method?: string;
  requestData?: any;
  requestHeaders?: Record<string, string>;
  queryParams?: Record<string, any>;
  
  // Response information
  responseData?: any;
  responseHeaders?: Record<string, string>;
  responseSize?: number;
  
  // Timing information
  requestStartTime?: number;
  requestEndTime?: number;
  requestDuration?: number;
  
  // Network information
  userAgent?: string;
  ipAddress?: string;
  networkType?: string;
  connectionSpeed?: string;
  
  // Application context
  appVersion?: string;
  buildVersion?: string;
  environment?: string;
  
  // Additional context
  [key: string]: any;
}

/**
 * User-specific error context
 */
export interface UserErrorContext {
  userId?: string;
  sessionId?: string;
  userRole?: string;
  userPermissions?: string[];
  userPreferences?: Record<string, any>;
  userLocation?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  deviceInfo?: {
    type?: string;
    os?: string;
    browser?: string;
    screenSize?: string;
    touchSupport?: boolean;
  };
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  constraint?: any;
  path?: string;
}

/**
 * Debug information for development
 */
export interface DebugInfo {
  stackTrace?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  functionName?: string;
  variables?: Record<string, any>;
  callStack?: CallStackFrame[];
}

/**
 * Call stack frame information
 */
export interface CallStackFrame {
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  source?: string;
}

/**
 * Source map information
 */
export interface SourceMapInfo {
  originalFile?: string;
  originalLine?: number;
  originalColumn?: number;
  originalSource?: string;
}

/**
 * User action suggestions
 */
export interface UserAction {
  type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
  label: string;
  description?: string;
  action: () => void | Promise<void>;
  primary?: boolean;
  destructive?: boolean;
}

/**
 * Error metadata for tracking and analysis
 */
export interface ErrorMetadata {
  // Tracking information
  errorId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  
  // Occurrence information
  firstOccurrence?: number;
  lastOccurrence?: number;
  occurrenceCount?: number;
  
  // Resolution information
  resolved?: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  resolution?: string;
  
  // Classification metadata
  tags?: string[];
  labels?: Record<string, string>;
  priority?: number;
  
  // Custom metadata
  [key: string]: any;
}

// =============================================================================
// ERROR TRANSFORMATION TYPES
// =============================================================================

/**
 * Error transformation configuration
 */
export interface ErrorTransformConfig {
  // Content inclusion
  includeStack?: boolean;
  includeRequestData?: boolean;
  includeResponseData?: boolean;
  includeHeaders?: boolean;
  includeContext?: boolean;
  
  // Data sanitization
  sanitizeHeaders?: boolean;
  sanitizeRequestData?: boolean;
  sanitizeResponseData?: boolean;
  sensitiveFields?: string[];
  
  // Size limits
  maxDetailLength?: number;
  maxStackLength?: number;
  maxContextSize?: number;
  
  // Enhancement options
  enhanceStack?: boolean;
  addSourceMap?: boolean;
  addUserContext?: boolean;
  addDebugInfo?: boolean;
  
  // Custom transformers
  customTransformer?: ErrorTransformer;
  fieldTransformers?: Record<string, FieldTransformer>;
}

/**
 * Error transformer function type
 */
export type ErrorTransformer = (error: AxiosError, config?: ErrorTransformConfig) => ApiError;

/**
 * Field transformer function type
 */
export type FieldTransformer = (value: any, context: ErrorContext) => any;

/**
 * Error classification rule
 */
export interface ErrorClassificationRule {
  // Rule identification
  name: string;
  description?: string;
  priority: number;
  
  // Matching conditions
  condition: ErrorCondition;
  
  // Classification results
  category: ErrorCategory;
  subcategory?: string;
  severity: ErrorSeverity;
  
  // Recovery configuration
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  recoveryStrategy?: ErrorRecoveryStrategy;
  
  // User experience
  userMessage?: string;
  userActions?: UserAction[];
  helpUrl?: string;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Error condition for classification
 */
export type ErrorCondition = 
  | StatusCodeCondition
  | MessageCondition
  | UrlCondition
  | HeaderCondition
  | CustomCondition
  | CompositeCondition;

/**
 * Status code-based condition
 */
export interface StatusCodeCondition {
  type: 'status';
  codes: number[] | number;
  range?: [number, number];
}

/**
 * Message-based condition
 */
export interface MessageCondition {
  type: 'message';
  patterns: string[] | RegExp[];
  caseSensitive?: boolean;
}

/**
 * URL-based condition
 */
export interface UrlCondition {
  type: 'url';
  patterns: string[] | RegExp[];
  methods?: string[];
}

/**
 * Header-based condition
 */
export interface HeaderCondition {
  type: 'header';
  headers: Record<string, string | RegExp>;
}

/**
 * Custom condition function
 */
export interface CustomCondition {
  type: 'custom';
  predicate: (error: AxiosError) => boolean;
}

/**
 * Composite condition with logical operators
 */
export interface CompositeCondition {
  type: 'composite';
  operator: 'and' | 'or' | 'not';
  conditions: ErrorCondition[];
}

// =============================================================================
// ERROR RECOVERY TYPES
// =============================================================================

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
  // Retry configuration
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  retryMultiplier: number;
  maxRetryDelay: number;
  retryCondition?: (error: ApiError) => boolean;
  
  // Fallback configuration
  enableFallback: boolean;
  fallbackData?: any;
  fallbackService?: string;
  fallbackTimeout?: number;
  
  // Cache configuration
  enableCache: boolean;
  cacheTimeout: number;
  cacheKey?: string;
  
  // Queue configuration
  enableQueue: boolean;
  queueTimeout: number;
  maxQueueSize: number;
  
  // Notification configuration
  enableNotification: boolean;
  notificationLevel: 'info' | 'warning' | 'error';
  notificationMessage?: string;
  
  // Custom recovery handlers
  customRecovery?: ErrorRecoveryHandler;
  recoveryStrategies?: Record<ErrorRecoveryStrategy, ErrorRecoveryHandler>;
}

/**
 * Error recovery handler function type
 */
export type ErrorRecoveryHandler = (
  error: ApiError,
  config: ErrorRecoveryConfig
) => Promise<any> | any;

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  success: boolean;
  data?: any;
  strategy: ErrorRecoveryStrategy;
  attempts: number;
  duration: number;
  fallbackUsed?: boolean;
  cacheUsed?: boolean;
  queueUsed?: boolean;
  error?: ApiError;
}

// =============================================================================
// ERROR MONITORING TYPES
// =============================================================================

/**
 * Error monitoring configuration
 */
export interface ErrorMonitoringConfig {
  // Collection settings
  enableCollection: boolean;
  sampleRate: number;
  maxErrors: number;
  
  // Filtering
  excludeCategories?: ErrorCategory[];
  includeSeverities?: ErrorSeverity[];
  excludeUrls?: string[] | RegExp[];
  
  // Aggregation
  aggregationInterval: number;
  aggregationRules: ErrorAggregationRule[];
  
  // Reporting
  enableReporting: boolean;
  reportingInterval: number;
  reportingEndpoint?: string;
  
  // Callbacks
  onError?: (error: ApiError) => void | Promise<void>;
  onErrorResolved?: (error: ApiError, resolution: string) => void | Promise<void>;
  onThresholdExceeded?: (threshold: ErrorThreshold) => void | Promise<void>;
}

/**
 * Error aggregation rule
 */
export interface ErrorAggregationRule {
  name: string;
  groupBy: ('category' | 'status' | 'url' | 'user')[];
  timeWindow: number;
  aggregateFunction: 'count' | 'rate' | 'average' | 'percentile';
  threshold?: number;
}

/**
 * Error threshold configuration
 */
export interface ErrorThreshold {
  name: string;
  condition: ErrorCondition;
  threshold: number;
  timeWindow: number;
  action: 'alert' | 'circuit_breaker' | 'rate_limit' | 'custom';
  actionConfig?: any;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  // Basic counts
  totalErrors: number;
  uniqueErrors: number;
  resolvedErrors: number;
  
  // Categorization
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByStatus: Record<number, number>;
  
  // Timing
  averageResolutionTime: number;
  errorRate: number;
  errorTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Top errors
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  
  // Time range
  timeRange: {
    start: number;
    end: number;
  };
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
 * Error matcher function type
 */
export type ErrorMatcher = (error: ApiError) => boolean;

/**
 * Error handler function type
 */
export type ErrorHandler<T = any> = (error: ApiError) => T | Promise<T>;

/**
 * Error reporter function type
 */
export type ErrorReporter = (error: ApiError) => void | Promise<void>;

// =============================================================================
// FACTORY TYPES
// =============================================================================

/**
 * Error factory configuration
 */
export interface ErrorFactoryConfig {
  defaultCategory: ErrorCategory;
  defaultSeverity: ErrorSeverity;
  includeStack: boolean;
  includeContext: boolean;
  transformConfig: ErrorTransformConfig;
  classificationRules: ErrorClassificationRule[];
}

/**
 * Error factory interface
 */
export interface ErrorFactory {
  createError(error: AxiosError, config?: Partial<ErrorFactoryConfig>): ApiError;
  createCustomError(message: string, code: string, status: number): ApiError;
  classifyError(error: AxiosError): ErrorClassificationRule | null;
  addClassificationRule(rule: ErrorClassificationRule): void;
  removeClassificationRule(name: string): void;
  getClassificationRules(): ErrorClassificationRule[];
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from './types';