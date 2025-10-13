/**
 * Core Axios Client Infrastructure
 * Provides centralized HTTP client with interceptors, authentication, and error handling
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import './types'; // Import type extensions
import { AuthInterceptor } from './auth-interceptor';
import { ErrorInterceptor } from './error-interceptor';
import { LoggingInterceptor } from './logging-interceptor';
import { PerformanceInterceptor } from './performance-interceptor';

// Configuration interfaces
export interface AxiosClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableRequestDeduplication: boolean;
  maxConcurrentRequests: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: number;
  requestId?: string;
  version?: string;
}

export interface ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  timestamp: number;
  retryable: boolean;
  requestId?: string;
  context?: Record<string, any>;
}

export interface ApiRequestConfig extends AxiosRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  deduplicationKey?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
}

// Default configuration
const DEFAULT_CONFIG: AxiosClientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  enableLogging: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  enableRequestDeduplication: true,
  maxConcurrentRequests: 10,
};

/**
 * Core Axios Client class with comprehensive interceptor support
 */
export class AxiosClient {
  private instance: AxiosInstance;
  private config: AxiosClientConfig;
  private metrics: RequestMetrics;
  private pendingRequests: Map<string, Promise<any>>;
  private requestTimings: Map<string, number>;
  
  // Interceptor instances
  private authInterceptor: AuthInterceptor;
  private errorInterceptor: ErrorInterceptor;
  private loggingInterceptor: LoggingInterceptor;
  private performanceInterceptor: PerformanceInterceptor;

  constructor(config: Partial<AxiosClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      retryCount: 0,
    };
    this.pendingRequests = new Map();
    this.requestTimings = new Map();

    // Create axios instance
    this.instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize interceptors
    this.authInterceptor = new AuthInterceptor();
    this.errorInterceptor = new ErrorInterceptor();
    this.loggingInterceptor = new LoggingInterceptor({
      enableLogging: this.config.enableLogging,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
    });
    this.performanceInterceptor = new PerformanceInterceptor({
      enableRequestDeduplication: this.config.enableRequestDeduplication,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    });

    // Setup retry configuration
    this.setupRetryLogic();
    
    // Setup all interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios-retry configuration
   */
  private setupRetryLogic(): void {
    axiosRetry(this.instance, {
      retries: this.config.retries,
      retryDelay: (retryCount) => {
        return Math.min(this.config.retryDelay * Math.pow(2, retryCount - 1), 10000);
      },
      retryCondition: (error: AxiosError) => {
        // Retry on network errors and 5xx status codes
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ? error.response.status >= 500 : false);
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.metrics.retryCount++;
        if (this.config.enableLogging) {
          console.warn(`Retrying request (${retryCount}/${this.config.retries}):`, {
            url: requestConfig.url,
            method: requestConfig.method,
            error: error.message,
          });
        }
      },
    });
  }

  /**
   * Setup all interceptors in the correct order
   */
  private setupInterceptors(): void {
    // Setup interceptors in order of execution
    // 1. Performance interceptor (first for request deduplication)
    this.performanceInterceptor.setupInterceptors(this.instance);
    
    // 2. Authentication interceptor (for token injection)
    this.authInterceptor.setupInterceptors(this.instance);
    
    // 3. Logging interceptor (for request/response logging)
    this.loggingInterceptor.setupInterceptors(this.instance);
    
    // 4. Error interceptor (last for error transformation)
    this.errorInterceptor.setupInterceptors(this.instance);
  }

  /**
   * HTTP method implementations
   */
  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    const deduplicationKey = config?.deduplicationKey || `GET:${url}`;
    
    if (this.config.enableRequestDeduplication && this.pendingRequests.has(deduplicationKey)) {
      return this.pendingRequests.get(deduplicationKey);
    }

    const request = this.instance.get<T>(url, config).then(response => response.data);
    
    if (this.config.enableRequestDeduplication) {
      this.pendingRequests.set(deduplicationKey, request);
      request.finally(() => this.pendingRequests.delete(deduplicationKey));
    }

    return request;
  }

  async post<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  /**
   * Request cancellation
   */
  cancelRequest(requestId: string): void {
    this.performanceInterceptor.cancelRequest(requestId);
  }

  /**
   * Performance metrics
   */
  getPerformanceMetrics(): RequestMetrics {
    const performanceMetrics = this.performanceInterceptor.getPerformanceMetrics();
    const loggingMetrics = this.loggingInterceptor.getPerformanceMetrics();
    
    // Combine metrics from different interceptors
    return {
      totalRequests: performanceMetrics.totalRequests,
      successfulRequests: loggingMetrics.successfulRequests,
      failedRequests: loggingMetrics.failedRequests,
      averageResponseTime: loggingMetrics.averageResponseTime,
      cacheHitRate: performanceMetrics.cacheHitRate,
      retryCount: this.metrics.retryCount, // From axios-retry
    };
  }

  /**
   * Clear cache and pending requests
   */
  clearCache(): void {
    this.pendingRequests.clear();
    this.requestTimings.clear();
    this.performanceInterceptor.clearCache();
    this.loggingInterceptor.clearMetrics();
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AxiosClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update axios instance defaults
    this.instance.defaults.baseURL = this.config.baseURL;
    this.instance.defaults.timeout = this.config.timeout;
    
    // Update interceptor configurations
    this.loggingInterceptor.updateConfig({
      enableLogging: this.config.enableLogging,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
    });
    
    this.performanceInterceptor.updateConfig({
      enableRequestDeduplication: this.config.enableRequestDeduplication,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    });
  }

  /**
   * Get interceptor instances for advanced usage
   */
  getAuthInterceptor(): AuthInterceptor {
    return this.authInterceptor;
  }

  getErrorInterceptor(): ErrorInterceptor {
    return this.errorInterceptor;
  }

  getLoggingInterceptor(): LoggingInterceptor {
    return this.loggingInterceptor;
  }

  getPerformanceInterceptor(): PerformanceInterceptor {
    return this.performanceInterceptor;
  }

  /**
   * Private helper methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create and export default axios client instance
 */
export const axiosClient = new AxiosClient();

/**
 * Export the class for custom instantiation
 */
export { AxiosClient as default };