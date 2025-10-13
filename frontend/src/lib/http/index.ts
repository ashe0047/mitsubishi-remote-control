/**
 * HTTP Types and Utilities Index
 * Centralized exports for all HTTP-related types, clients, and utilities
 */

// Core HTTP types
export * from './types';

// Interceptor types
export * from './interceptor-types';

// Error types
export * from './error-types';

// Core axios client
export * from './axios-client';

// Interceptor implementations
export * from './auth-interceptor';
export * from './error-interceptor';
export * from './logging-interceptor';
export * from './performance-interceptor';

// Utility type aliases for common use cases
export type {
  ApiResponse as HttpResponse,
  ApiError as HttpError,
  ApiRequestConfig as HttpRequestConfig,
  RequestMetrics as HttpMetrics,
  AxiosClientConfig as HttpClientConfig,
} from './types';

export type {
  AuthInterceptor as HttpAuthInterceptor,
  ErrorInterceptor as HttpErrorInterceptor,
  LoggingInterceptor as HttpLoggingInterceptor,
  PerformanceInterceptor as HttpPerformanceInterceptor,
} from './interceptor-types';

// Error type aliases
export type {
  ErrorCategory as HttpErrorCategory,
  ErrorSeverity as HttpErrorSeverity,
  ErrorRecoveryStrategy as HttpErrorRecoveryStrategy,
} from './error-types';

// Client aliases
export {
  AxiosClient as HttpClient,
  axiosClient as httpClient,
} from './axios-client';