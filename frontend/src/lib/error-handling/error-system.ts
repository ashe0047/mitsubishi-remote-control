/**
 * Error Handling System
 * Provides comprehensive error handling for both HTTP and WebSocket communications
 */

import { AxiosError } from 'axios';
import { 
  ApiError, 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorRecoveryStrategy,
  ErrorContext,
  UserErrorContext,
  ErrorDetails,
  ErrorMetadata
} from '../http/error-types';
import { 
  WebSocketError, 
  WebSocketErrorCategory,
  ConnectionError,
  AuthError,
  SubscriptionError
} from '../websocket/websocket-types';

// =============================================================================
// BASE ERROR CLASSES
// =============================================================================

/**
 * Base unified error class that extends the standard Error
 */
export abstract class AppError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory | WebSocketErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly retryable: boolean;
  public readonly recoveryStrategy: ErrorRecoveryStrategy;
  public readonly context?: ErrorContext;
  public readonly userContext?: UserErrorContext;
  public readonly details?: ErrorDetails;
  public readonly metadata?: ErrorMetadata;
  public readonly correlationId?: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory | WebSocketErrorCategory,
    severity: ErrorSeverity = 'medium',
    retryable: boolean = false,
    recoveryStrategy: ErrorRecoveryStrategy = 'notify_user',
    options?: {
      context?: ErrorContext;
      userContext?: UserErrorContext;
      details?: ErrorDetails;
      metadata?: ErrorMetadata;
      correlationId?: string;
      requestId?: string;
      cause?: Error;
    }
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.timestamp = Date.now();
    this.retryable = retryable;
    this.recoveryStrategy = recoveryStrategy;
    this.context = options?.context;
    this.userContext = options?.userContext;
    this.details = options?.details;
    this.metadata = options?.metadata;
    this.correlationId = options?.correlationId;
    this.requestId = options?.requestId;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Chain the cause if provided
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  /**
   * Get user-friendly error message
   */
  abstract getUserMessage(): string;

  /**
   * Get suggested user actions
   */
  abstract getUserActions(): Array<{
    type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
    label: string;
    description?: string;
    action: () => void | Promise<void>;
    primary?: boolean;
  }>;

  /**
   * Check if error should be reported to monitoring service
   */
  shouldReport(): boolean {
    return this.severity === 'high' || this.severity === 'critical';
  }

  /**
   * Get error for logging (sanitized)
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      retryable: this.retryable,
      recoveryStrategy: this.recoveryStrategy,
      correlationId: this.correlationId,
      requestId: this.requestId,
      context: this.sanitizeContext(this.context),
      userContext: this.sanitizeUserContext(this.userContext),
      details: this.sanitizeDetails(this.details),
      metadata: this.metadata,
    };
  }

  /**
   * Sanitize context for logging (remove sensitive data)
   */
  private sanitizeContext(context?: ErrorContext): Partial<ErrorContext> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    
    // Remove sensitive headers
    if (sanitized.requestHeaders) {
      const headers = { ...sanitized.requestHeaders };
      delete headers.authorization;
      delete headers.cookie;
      delete headers['x-api-key'];
      sanitized.requestHeaders = headers;
    }

    if (sanitized.responseHeaders) {
      const headers = { ...sanitized.responseHeaders };
      delete headers['set-cookie'];
      sanitized.responseHeaders = headers;
    }

    // Remove sensitive request data
    if (sanitized.requestData && typeof sanitized.requestData === 'object') {
      const data = { ...sanitized.requestData };
      delete data.password;
      delete data.token;
      delete data.secret;
      sanitized.requestData = data;
    }

    return sanitized;
  }

  /**
   * Sanitize user context for logging
   */
  private sanitizeUserContext(userContext?: UserErrorContext): Partial<UserErrorContext> | undefined {
    if (!userContext) return undefined;

    const sanitized = { ...userContext };
    
    // Keep only non-sensitive user information
    return {
      userRole: sanitized.userRole,
      userLocation: sanitized.userLocation,
      deviceInfo: sanitized.deviceInfo,
    };
  }

  /**
   * Sanitize details for logging
   */
  private sanitizeDetails(details?: ErrorDetails): Partial<ErrorDetails> | undefined {
    if (!details) return undefined;
    if (typeof details !== 'object') return { value: String(details) };

    const sanitized = { ...details };
    
    // Remove sensitive fields from additional info
    if (sanitized.additionalInfo && typeof sanitized.additionalInfo === 'object') {
      const info = { ...sanitized.additionalInfo };
      delete info.password;
      delete info.token;
      delete info.secret;
      delete info.apiKey;
      sanitized.additionalInfo = info;
    }

    return sanitized;
  }
}

/**
 * HTTP-specific unified error
 */
export class AppHttpError extends AppError implements ApiError {
  public readonly status: number;
  public readonly originalError?: AxiosError;
  public readonly originalResponse?: any;
  public readonly originalRequest?: any;

  constructor(
    message: string,
    code: string,
    status: number,
    category: ErrorCategory = 'client',
    severity: ErrorSeverity = 'medium',
    retryable: boolean = false,
    recoveryStrategy: ErrorRecoveryStrategy = 'notify_user',
    options?: {
      context?: ErrorContext;
      userContext?: UserErrorContext;
      details?: ErrorDetails;
      metadata?: ErrorMetadata;
      correlationId?: string;
      requestId?: string;
      originalError?: AxiosError;
      originalResponse?: any;
      originalRequest?: any;
    }
  ) {
    super(message, code, category, severity, retryable, recoveryStrategy, options);
    
    this.status = status;
    this.originalError = options?.originalError;
    this.originalResponse = options?.originalResponse;
    this.originalRequest = options?.originalRequest;
  }

  getUserMessage(): string {
    switch (this.status) {
      case 400:
        return 'The request was invalid. Please check your input and try again.';
      case 401:
        return 'You need to log in to access this feature.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'The request timed out. Please try again.';
      case 409:
        return 'There was a conflict with your request. Please refresh and try again.';
      case 422:
        return 'The data you provided is invalid. Please check and try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'A server error occurred. Please try again later.';
      case 502:
        return 'The service is temporarily unavailable. Please try again later.';
      case 503:
        return 'The service is currently under maintenance. Please try again later.';
      case 504:
        return 'The request timed out. Please try again.';
      default:
        if (this.status >= 500) {
          return 'A server error occurred. Please try again later.';
        } else if (this.status >= 400) {
          return 'There was a problem with your request. Please try again.';
        } else {
          return 'An unexpected error occurred. Please try again.';
        }
    }
  }

  getUserActions(): Array<{
    type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
    label: string;
    description?: string;
    action: () => void | Promise<void>;
    primary?: boolean;
  }> {
    const actions: Array<{
      type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
      label: string;
      description?: string;
      action: () => void | Promise<void>;
      primary?: boolean;
    }> = [];

    switch (this.status) {
      case 401:
        actions.push({
          type: 'login',
          label: 'Log In',
          description: 'Go to login page',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          },
          primary: true,
        });
        break;

      case 403:
        actions.push({
          type: 'refresh',
          label: 'Refresh Page',
          description: 'Reload the page to update permissions',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          },
          primary: true,
        });
        break;

      case 408:
      case 429:
      case 500:
      case 502:
      case 503:
      case 504:
        if (this.retryable) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            description: 'Retry the request',
            action: async () => {
              // This would be implemented by the calling code
              console.log('Retry action triggered');
            },
            primary: true,
          });
        }
        break;

      default:
        if (this.retryable) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            action: async () => {
              console.log('Retry action triggered');
            },
            primary: true,
          });
        }
    }

    // Always provide option to contact support for severe errors
    if (this.severity === 'high' || this.severity === 'critical') {
      actions.push({
        type: 'contact_support',
        label: 'Contact Support',
        description: 'Get help with this issue',
        action: () => {
          if (typeof window !== 'undefined') {
            window.open('mailto:support@example.com?subject=Error Report&body=' + 
              encodeURIComponent(`Error Code: ${this.code}\nMessage: ${this.message}\nTime: ${new Date(this.timestamp).toISOString()}`));
          }
        },
      });
    }

    return actions;
  }
}

/**
 * WebSocket-specific unified error
 */
export class AppWebSocketError extends AppError implements WebSocketError {
  public readonly connectionId?: string;
  public readonly messageId?: string;
  public readonly readyState?: number;
  public readonly closeCode?: number;
  public readonly closeReason?: string;

  constructor(
    message: string,
    code: string,
    category: WebSocketErrorCategory = 'unknown',
    severity: ErrorSeverity = 'medium',
    retryable: boolean = true,
    recoveryStrategy: ErrorRecoveryStrategy = 'retry',
    options?: {
      context?: ErrorContext;
      userContext?: UserErrorContext;
      details?: ErrorDetails;
      metadata?: ErrorMetadata;
      correlationId?: string;
      requestId?: string;
      connectionId?: string;
      messageId?: string;
      readyState?: number;
      closeCode?: number;
      closeReason?: string;
      cause?: Error;
    }
  ) {
    super(message, code, category, severity, retryable, recoveryStrategy, options);
    
    this.connectionId = options?.connectionId;
    this.messageId = options?.messageId;
    this.readyState = options?.readyState;
    this.closeCode = options?.closeCode;
    this.closeReason = options?.closeReason;
  }

  getUserMessage(): string {
    switch (this.category) {
      case 'connection':
        return 'Connection to the server was lost. Attempting to reconnect...';
      case 'authentication':
        return 'Authentication failed. Please log in again.';
      case 'authorization':
        return 'You don\'t have permission to access this feature.';
      case 'protocol':
        return 'A communication error occurred. Please refresh the page.';
      case 'message':
        return 'Failed to send message. Please try again.';
      case 'subscription':
        return 'Failed to subscribe to updates. Please refresh the page.';
      case 'timeout':
        return 'The connection timed out. Please check your internet connection.';
      case 'network':
        return 'Network error. Please check your internet connection and try again.';
      case 'server':
        return 'Server error. Please try again later.';
      default:
        return 'A connection error occurred. Please refresh the page or try again.';
    }
  }

  getUserActions(): Array<{
    type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
    label: string;
    description?: string;
    action: () => void | Promise<void>;
    primary?: boolean;
  }> {
    const actions: Array<{
      type: 'retry' | 'refresh' | 'login' | 'contact_support' | 'navigate' | 'custom';
      label: string;
      description?: string;
      action: () => void | Promise<void>;
      primary?: boolean;
    }> = [];

    switch (this.category) {
      case 'authentication':
        actions.push({
          type: 'login',
          label: 'Log In Again',
          description: 'Go to login page',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          },
          primary: true,
        });
        break;

      case 'connection':
      case 'network':
      case 'timeout':
        actions.push({
          type: 'refresh',
          label: 'Refresh Page',
          description: 'Reload the page to reconnect',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          },
          primary: true,
        });
        break;

      case 'protocol':
      case 'message':
      case 'subscription':
        actions.push({
          type: 'refresh',
          label: 'Refresh Page',
          description: 'Reload the page to reset connection',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          },
          primary: true,
        });
        break;

      default:
        if (this.retryable) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            action: async () => {
              console.log('Retry action triggered');
            },
            primary: true,
          });
        }
    }

    // Always provide option to contact support for severe errors
    if (this.severity === 'high' || this.severity === 'critical') {
      actions.push({
        type: 'contact_support',
        label: 'Contact Support',
        description: 'Get help with this issue',
        action: () => {
          if (typeof window !== 'undefined') {
            window.open('mailto:support@example.com?subject=WebSocket Error Report&body=' + 
              encodeURIComponent(`Error Code: ${this.code}\nMessage: ${this.message}\nConnection ID: ${this.connectionId}\nTime: ${new Date(this.timestamp).toISOString()}`));
          }
        },
      });
    }

    return actions;
  }
}

// =============================================================================
// ERROR TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transform AxiosError to AppHttpError
 */
export function transformAxiosError(error: AxiosError): AppHttpError {
  const status = error.response?.status || 0;
  const code = getHttpErrorCode(error);
  const category = getHttpErrorCategory(status);
  const severity = getHttpErrorSeverity(status);
  const retryable = isHttpErrorRetryable(status, error.code);
  const recoveryStrategy = getHttpRecoveryStrategy(status);

  const context: ErrorContext = {
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    requestData: error.config?.data,
    requestHeaders: error.config?.headers as Record<string, string>,
    responseData: error.response?.data,
    responseHeaders: error.response?.headers as Record<string, string>,
    responseSize: error.response?.data ? JSON.stringify(error.response.data).length : 0,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    timestamp: Date.now(),
  };

  const details: ErrorDetails = {
    errorCode: error.code,
    errorType: error.name,
    serverMessage: error.response?.data?.message || error.response?.data?.error,
    serverCode: error.response?.data?.code,
    serverTimestamp: error.response?.data?.timestamp,
    validationErrors: error.response?.data?.validationErrors,
    fieldErrors: error.response?.data?.fieldErrors,
  };

  return new AppHttpError(
    getHttpErrorMessage(error),
    code,
    status,
    category,
    severity,
    retryable,
    recoveryStrategy,
    {
      context,
      details,
      originalError: error,
      originalResponse: error.response,
      originalRequest: error.config,
      requestId: error.config?.metadata?.requestId,
    }
  );
}

/**
 * Transform WebSocket error to AppWebSocketError
 */
export function transformWebSocketError(
  error: Error | WebSocketError,
  category: WebSocketErrorCategory = 'unknown',
  options?: {
    connectionId?: string;
    messageId?: string;
    readyState?: number;
    closeCode?: number;
    closeReason?: string;
  }
): AppWebSocketError {
  const code = getWebSocketErrorCode(error, category);
  const severity = getWebSocketErrorSeverity(category);
  const retryable = isWebSocketErrorRetryable(category);
  const recoveryStrategy = getWebSocketRecoveryStrategy(category);

  const context: ErrorContext = {
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    timestamp: Date.now(),
  };

  const details: ErrorDetails = {
    errorCode: 'code' in error ? error.code : undefined,
    errorType: error.name,
    additionalInfo: {
      readyState: options?.readyState,
      closeCode: options?.closeCode,
      closeReason: options?.closeReason,
    },
  };

  return new AppWebSocketError(
    error.message,
    code,
    category,
    severity,
    retryable,
    recoveryStrategy,
    {
      context,
      details,
      connectionId: options?.connectionId,
      messageId: options?.messageId,
      readyState: options?.readyState,
      closeCode: options?.closeCode,
      closeReason: options?.closeReason,
      cause: error,
    }
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHttpErrorCode(error: AxiosError): string {
  if (error.response?.data?.code) return error.response.data.code;
  if (error.code) return error.code;
  if (error.response?.status) return `HTTP_${error.response.status}`;
  return 'HTTP_UNKNOWN';
}

function getHttpErrorCategory(status: number): ErrorCategory {
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status >= 400 && status < 500) return 'client';
  if (status >= 500) return 'server';
  if (status === 0) return 'network';
  return 'unknown';
}

function getHttpErrorSeverity(status: number): ErrorSeverity {
  if (status >= 500) return 'high';
  if (status === 401 || status === 403) return 'medium';
  if (status >= 400) return 'low';
  return 'medium';
}

function isHttpErrorRetryable(status: number, code?: string): boolean {
  // Network errors are retryable
  if (!status || status === 0) return true;
  
  // Server errors are retryable
  if (status >= 500) return true;
  
  // Timeout errors are retryable
  if (status === 408 || code === 'ECONNABORTED') return true;
  
  // Rate limit errors are retryable
  if (status === 429) return true;
  
  // Client errors are generally not retryable
  return false;
}

function getHttpRecoveryStrategy(status: number): ErrorRecoveryStrategy {
  if (status === 401) return 'redirect_login';
  if (status === 403) return 'notify_user';
  if (status >= 500 || status === 408 || status === 429) return 'retry';
  return 'notify_user';
}

function getHttpErrorMessage(error: AxiosError): string {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'An HTTP error occurred';
}

function getWebSocketErrorCode(error: Error | WebSocketError, category: WebSocketErrorCategory): string {
  if ('code' in error && error.code) return error.code;
  return `WS_${category.toUpperCase()}`;
}

function getWebSocketErrorSeverity(category: WebSocketErrorCategory): ErrorSeverity {
  switch (category) {
    case 'authentication':
    case 'authorization':
      return 'high';
    case 'connection':
    case 'network':
      return 'medium';
    case 'message':
    case 'subscription':
      return 'low';
    default:
      return 'medium';
  }
}

function isWebSocketErrorRetryable(category: WebSocketErrorCategory): boolean {
  switch (category) {
    case 'connection':
    case 'network':
    case 'timeout':
    case 'server':
      return true;
    case 'authentication':
    case 'authorization':
    case 'protocol':
      return false;
    default:
      return true;
  }
}

function getWebSocketRecoveryStrategy(category: WebSocketErrorCategory): ErrorRecoveryStrategy {
  switch (category) {
    case 'authentication':
      return 'redirect_login';
    case 'connection':
    case 'network':
    case 'timeout':
      return 'retry';
    case 'authorization':
      return 'notify_user';
    default:
      return 'retry';
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard for AppHttpError
 */
export function isAppHttpError(error: any): error is AppHttpError {
  return error instanceof AppHttpError;
}

/**
 * Type guard for AppWebSocketError
 */
export function isAppWebSocketError(error: any): error is AppWebSocketError {
  return error instanceof AppWebSocketError;
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from '../http/error-types';
export * from '../websocket/websocket-types';