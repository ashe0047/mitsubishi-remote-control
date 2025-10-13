/**
 * Logging and Debugging Interceptor for Axios Client
 * Provides comprehensive request/response logging, debug mode, and performance monitoring
 */

import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import './types'; // Import type extensions

export interface LoggingInterceptorConfig {
  enableLogging: boolean;
  enableDebugMode: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logRequestHeaders: boolean;
  logRequestBody: boolean;
  logResponseHeaders: boolean;
  logResponseBody: boolean;
  maxBodyLength: number;
  sensitiveHeaders: string[];
  sensitiveBodyFields: string[];
}

export interface RequestTiming {
  requestId: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  error?: boolean;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  slowRequests: RequestTiming[];
}

const DEFAULT_LOGGING_CONFIG: LoggingInterceptorConfig = {
  enableLogging: process.env.NODE_ENV === 'development',
  enableDebugMode: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  logLevel: 'info',
  logRequestHeaders: true,
  logRequestBody: true,
  logResponseHeaders: false,
  logResponseBody: true,
  maxBodyLength: 1000,
  sensitiveHeaders: ['authorization', 'x-auth-token', 'cookie', 'x-api-key'],
  sensitiveBodyFields: ['password', 'token', 'secret', 'key', 'auth'],
};

/**
 * Logging and Debugging Interceptor class
 * Provides comprehensive logging, debugging, and performance monitoring capabilities
 */
export class LoggingInterceptor {
  private config: LoggingInterceptorConfig;
  private requestTimings: Map<string, RequestTiming>;
  private performanceMetrics: PerformanceMetrics;
  private startTime: number;

  constructor(config: Partial<LoggingInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_LOGGING_CONFIG, ...config };
    this.requestTimings = new Map();
    this.startTime = Date.now();
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      slowRequests: [],
    };
  }

  /**
   * Setup logging interceptors on an axios instance
   */
  setupInterceptors(axiosInstance: AxiosInstance): void {
    // Request interceptor for logging outgoing requests
    axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    // Response interceptor for logging responses and performance
    axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Handle outgoing requests - log request details and start timing
   */
  private handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const requestId = config.metadata?.requestId || this.generateRequestId();
    const startTime = Date.now();

    // Store timing information
    const timing: RequestTiming = {
      requestId,
      url: config.url || '',
      method: (config.method || 'GET').toUpperCase(),
      startTime,
    };
    this.requestTimings.set(requestId, timing);

    // Update metrics
    this.performanceMetrics.totalRequests++;
    this.updateRequestsPerSecond();

    // Log request if enabled
    if (this.config.enableLogging) {
      this.logRequest(config, requestId);
    }

    // Add request ID to config metadata
    config.metadata = { ...config.metadata, requestId, startTime };

    return config;
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: any): Promise<never> {
    if (this.config.enableLogging) {
      this.log('error', 'Request Error:', {
        message: error.message,
        stack: this.config.enableDebugMode ? error.stack : undefined,
      });
    }

    return Promise.reject(error);
  }

  /**
   * Handle successful responses - log response details and calculate timing
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    const requestId = response.config.metadata?.requestId;
    const endTime = Date.now();

    if (requestId) {
      this.updateTiming(requestId, endTime, response.status, false);
    }

    // Update metrics
    this.performanceMetrics.successfulRequests++;
    this.updateErrorRate();

    // Log response if enabled
    if (this.config.enableLogging) {
      this.logResponse(response, requestId);
    }

    return response;
  }

  /**
   * Handle response errors - log error details and calculate timing
   */
  private handleResponseError(error: AxiosError): Promise<never> {
    const requestId = error.config?.metadata?.requestId;
    const endTime = Date.now();

    if (requestId) {
      this.updateTiming(requestId, endTime, error.response?.status, true);
    }

    // Update metrics
    this.performanceMetrics.failedRequests++;
    this.updateErrorRate();

    // Log error if enabled
    if (this.config.enableLogging) {
      this.logResponseError(error, requestId);
    }

    return Promise.reject(error);
  }

  /**
   * Log outgoing request details
   */
  private logRequest(config: InternalAxiosRequestConfig, requestId: string): void {
    const logData: any = {
      requestId,
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
    };

    // Add headers if enabled
    if (this.config.logRequestHeaders && config.headers) {
      logData.headers = this.sanitizeHeaders(config.headers);
    }

    // Add body if enabled
    if (this.config.logRequestBody && config.data) {
      logData.body = this.sanitizeBody(config.data);
    }

    // Add timing information in debug mode
    if (this.config.enableDebugMode) {
      logData.timestamp = new Date().toISOString();
      logData.timeout = config.timeout;
    }

    this.log('info', '🚀 HTTP Request:', logData);
  }

  /**
   * Log successful response details
   */
  private logResponse(response: AxiosResponse, requestId?: string): void {
    const timing = requestId ? this.requestTimings.get(requestId) : undefined;
    
    const logData: any = {
      requestId,
      status: response.status,
      statusText: response.statusText,
      duration: timing?.duration,
    };

    // Add headers if enabled
    if (this.config.logResponseHeaders && response.headers) {
      logData.headers = response.headers;
    }

    // Add body if enabled
    if (this.config.logResponseBody && response.data) {
      logData.body = this.sanitizeBody(response.data);
    }

    // Add performance info in debug mode
    if (this.config.enableDebugMode && timing) {
      logData.performance = {
        startTime: new Date(timing.startTime).toISOString(),
        endTime: timing.endTime ? new Date(timing.endTime).toISOString() : undefined,
        duration: timing.duration,
      };
    }

    const emoji = response.status >= 200 && response.status < 300 ? '✅' : '⚠️';
    this.log('info', `${emoji} HTTP Response:`, logData);
  }

  /**
   * Log response error details
   */
  private logResponseError(error: AxiosError, requestId?: string): void {
    const timing = requestId ? this.requestTimings.get(requestId) : undefined;
    
    const logData: any = {
      requestId,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      duration: timing?.duration,
    };

    // Add response data if available
    if (error.response?.data) {
      logData.responseBody = this.sanitizeBody(error.response.data);
    }

    // Add stack trace in debug mode
    if (this.config.enableDebugMode) {
      logData.stack = error.stack;
      logData.config = {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? this.sanitizeHeaders(error.config.headers) : undefined,
      };
    }

    this.log('error', '❌ HTTP Error:', logData);
  }

  /**
   * Update timing information for a request
   */
  private updateTiming(requestId: string, endTime: number, status?: number, error?: boolean): void {
    const timing = this.requestTimings.get(requestId);
    if (!timing) return;

    timing.endTime = endTime;
    timing.duration = endTime - timing.startTime;
    timing.status = status;
    timing.error = error;

    // Update performance metrics
    if (this.config.enablePerformanceMonitoring) {
      this.updatePerformanceMetrics(timing);
    }

    // Clean up old timings (keep only last 1000)
    if (this.requestTimings.size > 1000) {
      const oldestKey = this.requestTimings.keys().next().value;
      if (oldestKey) {
        this.requestTimings.delete(oldestKey);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(timing: RequestTiming): void {
    if (!timing.duration) return;

    const metrics = this.performanceMetrics;
    
    // Update response time statistics
    metrics.minResponseTime = Math.min(metrics.minResponseTime, timing.duration);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, timing.duration);
    
    // Update average response time
    const totalSuccessful = metrics.successfulRequests + metrics.failedRequests;
    if (totalSuccessful > 0) {
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (totalSuccessful - 1) + timing.duration) / totalSuccessful;
    }

    // Track slow requests (> 2 seconds)
    if (timing.duration > 2000) {
      metrics.slowRequests.push(timing);
      // Keep only last 50 slow requests
      if (metrics.slowRequests.length > 50) {
        metrics.slowRequests.shift();
      }
    }
  }

  /**
   * Update requests per second metric
   */
  private updateRequestsPerSecond(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    this.performanceMetrics.requestsPerSecond = this.performanceMetrics.totalRequests / elapsedSeconds;
  }

  /**
   * Update error rate metric
   */
  private updateErrorRate(): void {
    const total = this.performanceMetrics.totalRequests;
    if (total > 0) {
      this.performanceMetrics.errorRate = this.performanceMetrics.failedRequests / total;
    }
  }

  /**
   * Sanitize headers by removing sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    this.config.sensitiveHeaders.forEach(header => {
      const key = Object.keys(sanitized).find(k => k.toLowerCase() === header.toLowerCase());
      if (key) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize body by removing sensitive fields and truncating if too long
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    let sanitized = body;

    // Handle string bodies
    if (typeof body === 'string') {
      if (body.length > this.config.maxBodyLength) {
        sanitized = body.substring(0, this.config.maxBodyLength) + '... [TRUNCATED]';
      }
      return sanitized;
    }

    // Handle object bodies
    if (typeof body === 'object') {
      try {
        sanitized = JSON.parse(JSON.stringify(body));
        
        // Remove sensitive fields
        this.removeSensitiveFields(sanitized, this.config.sensitiveBodyFields);
        
        // Truncate if too long
        const bodyString = JSON.stringify(sanitized);
        if (bodyString.length > this.config.maxBodyLength) {
          return bodyString.substring(0, this.config.maxBodyLength) + '... [TRUNCATED]';
        }
      } catch (error) {
        return '[UNPARSEABLE BODY]';
      }
    }

    return sanitized;
  }

  /**
   * Recursively remove sensitive fields from object
   */
  private removeSensitiveFields(obj: any, sensitiveFields: string[]): void {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key], sensitiveFields);
      }
    });
  }

  /**
   * Log message with appropriate level
   */
  private log(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }

  /**
   * Check if message should be logged based on current log level
   */
  private shouldLog(level: string): boolean {
    if (!this.config.enableLogging) return false;

    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get request timing for a specific request
   */
  getRequestTiming(requestId: string): RequestTiming | undefined {
    return this.requestTimings.get(requestId);
  }

  /**
   * Get all request timings
   */
  getAllRequestTimings(): RequestTiming[] {
    return Array.from(this.requestTimings.values());
  }

  /**
   * Clear performance metrics and timings
   */
  clearMetrics(): void {
    this.requestTimings.clear();
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      slowRequests: [],
    };
    this.startTime = Date.now();
  }

  /**
   * Update interceptor configuration
   */
  updateConfig(newConfig: Partial<LoggingInterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggingInterceptorConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.config.enableDebugMode = enabled;
  }

  /**
   * Enable/disable logging
   */
  setLoggingEnabled(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }

  /**
   * Set log level
   */
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.config.logLevel = level;
  }
}

/**
 * Create and export default logging interceptor instance
 */
export const loggingInterceptor = new LoggingInterceptor();

/**
 * Helper function to setup logging interceptors on an axios instance
 */
export function setupLoggingInterceptors(
  axiosInstance: AxiosInstance,
  config?: Partial<LoggingInterceptorConfig>
): LoggingInterceptor {
  const interceptor = new LoggingInterceptor(config);
  interceptor.setupInterceptors(axiosInstance);
  return interceptor;
}