/**
 * Error Handling Interceptor for Axios Client
 * Transforms axios errors to consistent ApiError format with retry logic and classification
 */

import { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import './types'; // Import type extensions
import { ApiError } from './axios-client';

export interface ErrorInterceptorConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  retryDelayMultiplier: number;
  maxRetryDelay: number;
  enableErrorTransformation: boolean;
  enableErrorLogging: boolean;
  retryableStatusCodes: number[];
  nonRetryableStatusCodes: number[];
}

export interface ErrorContext {
  url?: string;
  method?: string;
  requestId?: string;
  timestamp: number;
  userAgent?: string;
  retryCount?: number;
}

const DEFAULT_ERROR_CONFIG: ErrorInterceptorConfig = {
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryDelayMultiplier: 2,
  maxRetryDelay: 10000, // 10 seconds
  enableErrorTransformation: true,
  enableErrorLogging: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  nonRetryableStatusCodes: [400, 401, 403, 404, 422],
};

/**
 * Error Handling Interceptor class
 * Provides comprehensive error handling, transformation, and retry logic
 */
export class ErrorInterceptor {
  private config: ErrorInterceptorConfig;
  private retryCount: Map<string, number>;
  private axiosInstance: AxiosInstance | null = null;

  constructor(config: Partial<ErrorInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
    this.retryCount = new Map();
  }

  /**
   * Setup error handling interceptors on an axios instance
   */
  setupInterceptors(axiosInstance: AxiosInstance): void {
    // Store reference to axios instance for retries
    this.axiosInstance = axiosInstance;

    // Response interceptor for error handling
    axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Handle successful responses
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    // Clear retry count for successful requests
    const requestId = response.config.metadata?.requestId;
    if (requestId) {
      this.retryCount.delete(requestId);
    }

    return response;
  }

  /**
   * Handle response errors with transformation and retry logic
   */
  private async handleResponseError(error: AxiosError): Promise<any> {
    // Silently ignore canceled requests (deduplication) - they're not real errors
    if (error.code === 'ERR_CANCELED') {
      // Don't log, don't transform, don't reject - just silently ignore
      // The original request will provide the response
      return Promise.reject(error);
    }

    const transformedError = this.config.enableErrorTransformation
      ? this.transformError(error)
      : error;

    if (this.config.enableErrorLogging) {
      this.logError(transformedError as ApiError, error);
    }

    // Check if error is retryable
    if (this.config.enableRetry && this.isRetryableError(error)) {
      const retryResult = await this.attemptRetry(error);
      if (retryResult) {
        return retryResult;
      }
    }

    return Promise.reject(transformedError);
  }

  /**
   * Transform axios error to consistent ApiError format
   */
  private transformError(error: AxiosError): ApiError {
    const apiError = new Error() as ApiError;
    const context = this.buildErrorContext(error);

    // Set basic error properties
    apiError.name = 'ApiError';
    apiError.message = this.getErrorMessage(error);
    apiError.code = this.getErrorCode(error);
    apiError.status = error.response?.status || 0;
    apiError.timestamp = Date.now();
    apiError.context = context;
    apiError.retryable = this.isRetryableError(error);

    // Add response data if available
    if (error.response?.data) {
      apiError.details = error.response.data;
    }

    // Add request ID if available
    if (error.config?.metadata?.requestId) {
      apiError.requestId = error.config.metadata.requestId;
    }

    return apiError;
  }

  /**
   * Get appropriate error message based on error type and status
   */
  private getErrorMessage(error: AxiosError): string {
    // Check for request cancellation (deduplication)
    if (error.code === 'ERR_CANCELED') {
      return error.message || 'Request deduplicated - using cached response';
    }

    // Check for custom error message in response
    if (error.response?.data) {
      const data = error.response.data as any;
      if (data.message) return data.message;
      if (data.error) return data.error;
      if (data.detail) return data.detail;
    }

    // Default messages based on status code
    const status = error.response?.status;
    switch (status) {
      case 400:
        return 'Bad request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please log in and try again.';
      case 403:
        return 'Access denied. You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'Request timeout. Please try again.';
      case 409:
        return 'Conflict. The request could not be completed due to a conflict.';
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please wait and try again.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 502:
        return 'Bad gateway. The server is temporarily unavailable.';
      case 503:
        return 'Service unavailable. Please try again later.';
      case 504:
        return 'Gateway timeout. The server took too long to respond.';
      default:
        if (!error.response) {
          return 'Network error. Please check your connection and try again.';
        }
        return error.message || 'An unexpected error occurred.';
    }
  }

  /**
   * Get error code based on error type
   */
  private getErrorCode(error: AxiosError): string {
    // Check for custom error code in response
    if (error.response?.data) {
      const data = error.response.data as any;
      if (data.code) return data.code;
      if (data.errorCode) return data.errorCode;
    }

    // Use axios error code if available
    if (error.code) return error.code;

    // Generate code based on status
    const status = error.response?.status;
    if (status) {
      return `HTTP_${status}`;
    }

    // Network or unknown error
    return 'NETWORK_ERROR';
  }

  /**
   * Build error context for debugging
   */
  private buildErrorContext(error: AxiosError): ErrorContext {
    const config = error.config;
    const requestId = config?.metadata?.requestId;
    
    return {
      url: config?.url,
      method: config?.method?.toUpperCase(),
      requestId,
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      retryCount: requestId ? this.retryCount.get(requestId) || 0 : 0,
    };
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isRetryableError(error: AxiosError): boolean {
    const status = error.response?.status;

    // Network errors are retryable
    if (!status) return true;

    // Check non-retryable status codes first
    if (this.config.nonRetryableStatusCodes.includes(status)) {
      return false;
    }

    // Check retryable status codes
    if (this.config.retryableStatusCodes.includes(status)) {
      return true;
    }

    // Default: 5xx errors are retryable
    return status >= 500;
  }

  /**
   * Attempt to retry the failed request
   */
  private async attemptRetry(error: AxiosError): Promise<AxiosResponse | null> {
    const config = error.config;
    if (!config) return null;

    const requestId = config.metadata?.requestId;
    if (!requestId) return null;

    const currentRetryCount = this.retryCount.get(requestId) || 0;
    
    if (currentRetryCount >= this.config.maxRetries) {
      return null;
    }

    // Update retry count
    this.retryCount.set(requestId, currentRetryCount + 1);

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.retryDelay * Math.pow(this.config.retryDelayMultiplier, currentRetryCount),
      this.config.maxRetryDelay
    );

    // Add jitter to prevent thundering herd
    const jitteredDelay = delay + Math.random() * 1000;

    if (this.config.enableErrorLogging) {
      console.warn(`Retrying request (${currentRetryCount + 1}/${this.config.maxRetries}) after ${jitteredDelay}ms:`, {
        url: config.url,
        method: config.method,
        requestId,
      });
    }

    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, jitteredDelay));

    // Retry the request using fetch with proper full URL construction
    try {
      if (!this.axiosInstance) {
        throw new Error('Axios instance not available for retry');
      }

      // Get the baseURL from the axios instance
      const baseURL = this.axiosInstance.defaults.baseURL || '';
      const fullURL = config.url?.startsWith('http')
        ? config.url
        : `${baseURL}${config.url}`;

      const response = await fetch(fullURL, {
        method: config.method,
        headers: config.headers as Record<string, string>,
        body: config.data ? JSON.stringify(config.data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: config
      } as AxiosResponse;
    } catch (retryError) {
      // If retry fails, continue with original error handling
      return null;
    }
  }

  /**
   * Log error details for debugging
   */
  private logError(apiError: ApiError, originalError: AxiosError): void {
    const logLevel = apiError.status >= 500 ? 'error' : 'warn';
    
    console[logLevel]('API Error:', {
      message: apiError.message,
      code: apiError.code,
      status: apiError.status,
      url: apiError.context?.url,
      method: apiError.context?.method,
      requestId: apiError.requestId,
      retryable: apiError.retryable,
      details: apiError.details,
      originalError: originalError.message,
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalRetries: number;
    activeRetries: number;
    retrySuccessRate: number;
  } {
    const totalRetries = Array.from(this.retryCount.values()).reduce((sum, count) => sum + count, 0);
    const activeRetries = this.retryCount.size;
    
    return {
      totalRetries,
      activeRetries,
      retrySuccessRate: 0, // Would need to track successes to calculate this
    };
  }

  /**
   * Clear retry tracking
   */
  clearRetryTracking(): void {
    this.retryCount.clear();
  }

  /**
   * Update interceptor configuration
   */
  updateConfig(newConfig: Partial<ErrorInterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorInterceptorConfig {
    return { ...this.config };
  }

  /**
   * Check if a specific error type should be retried
   */
  shouldRetryError(error: AxiosError): boolean {
    return this.config.enableRetry && this.isRetryableError(error);
  }

  /**
   * Get retry count for a specific request
   */
  getRetryCount(requestId: string): number {
    return this.retryCount.get(requestId) || 0;
  }
}

/**
 * Create and export default error interceptor instance
 */
export const errorInterceptor = new ErrorInterceptor();

/**
 * Helper function to setup error interceptors on an axios instance
 */
export function setupErrorInterceptors(
  axiosInstance: AxiosInstance,
  config?: Partial<ErrorInterceptorConfig>
): ErrorInterceptor {
  const interceptor = new ErrorInterceptor(config);
  interceptor.setupInterceptors(axiosInstance);
  return interceptor;
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'code' in error && 'status' in error && 'retryable' in error;
}

/**
 * Helper function to extract user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Helper function to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.retryable;
  }
  
  return false;
}