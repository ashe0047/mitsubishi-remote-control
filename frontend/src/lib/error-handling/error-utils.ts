"use client";

/**
 * Error handling utilities for the application
 */

// Type definitions for error details
export type ErrorDetails = Record<string, unknown> | string | number | boolean | null | Error;

// Interface for objects that have a message property
interface HasMessage {
  message: string | number;
}

export interface AppError {
  code: string;
  message: string;
  details?: ErrorDetails;
  timestamp: number;
  context?: string;
}

export enum ErrorCode {
  // Navigation Errors
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
  NAVIGATION_BLOCKED = 'NAVIGATION_BLOCKED',
  
  // Connection Errors
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_RECONNECTION_FAILED = 'WEBSOCKET_RECONNECTION_FAILED',
  MQTT_CONNECTION_FAILED = 'MQTT_CONNECTION_FAILED',
  MQTT_STATUS_CHECK_FAILED = 'MQTT_STATUS_CHECK_FAILED',
  
  // Component Errors
  COMPONENT_RENDER_ERROR = 'COMPONENT_RENDER_ERROR',
  HOOK_ERROR = 'HOOK_ERROR',
  
  // API Errors
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
  API_UNAUTHORIZED = 'API_UNAUTHORIZED',
  
  // Configuration Errors
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  INVALID_ROOM_CONFIG = 'INVALID_ROOM_CONFIG',
  
  // General Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Create a standardized application error
 */
export function createAppError(
  code: ErrorCode,
  message: string,
  details?: ErrorDetails,
  context?: string
): AppError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
    context,
  };
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as HasMessage).message);
  }
  
  return 'An unknown error occurred';
}

/**
 * Check if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('offline')
    );
  }
  
  return false;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: AppError): boolean {
  const recoverableCodes = [
    ErrorCode.WEBSOCKET_CONNECTION_FAILED,
    ErrorCode.MQTT_CONNECTION_FAILED,
    ErrorCode.API_REQUEST_FAILED,
    ErrorCode.API_TIMEOUT,
    ErrorCode.NETWORK_ERROR,
  ];
  
  return recoverableCodes.includes(error.code as ErrorCode);
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case ErrorCode.WEBSOCKET_CONNECTION_FAILED:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case ErrorCode.MQTT_CONNECTION_FAILED:
      return 'Connection to air conditioning units lost. Attempting to reconnect...';
    
    case ErrorCode.NAVIGATION_FAILED:
      return 'Navigation failed. Please try again or go back to the home page.';
    
    case ErrorCode.API_TIMEOUT:
      return 'Request timed out. Please check your connection and try again.';
    
    case ErrorCode.API_UNAUTHORIZED:
      return 'You are not authorized to perform this action.';
    
    case ErrorCode.CONFIG_LOAD_FAILED:
      return 'Failed to load application configuration. Please refresh the page.';
    
    case ErrorCode.INVALID_ROOM_CONFIG:
      return 'Invalid room configuration. Please check your settings.';
    
    case ErrorCode.NETWORK_ERROR:
      return 'Network error. Please check your internet connection.';
    
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Error logger utility
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: AppError[] = [];
  private maxErrors = 100; // Keep last 100 errors

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: AppError): void {
    console.error(`[${error.code}] ${error.message}`, error.details);
    
    // Add to in-memory storage
    this.errors.unshift(error);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.reportToService(error);
    }
  }

  logError(
    code: ErrorCode,
    message: string,
    details?: ErrorDetails,
    context?: string
  ): void {
    const error = createAppError(code, message, details, context);
    this.log(error);
  }

  getRecentErrors(count = 10): AppError[] {
    return this.errors.slice(0, count);
  }

  clearErrors(): void {
    this.errors = [];
  }

  private reportToService(error: AppError): void {
    try {
      // Here you would integrate with your error tracking service
      // Examples:
      // - Sentry.captureException(new Error(error.message), { extra: error })
      // - LogRocket.captureException(new Error(error.message))
      // - Custom API endpoint for error reporting
      
      console.log('Would report error to service:', error);
    } catch (reportingError) {
      console.error('Failed to report error to service:', reportingError);
    }
  }
}

/**
 * Global error logger instance
 */
export const errorLogger = ErrorLogger.getInstance();

/**
 * Async error handler wrapper
 */
export function handleAsyncError<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorCode: ErrorCode,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = createAppError(
        errorCode,
        getErrorMessage(error),
        error as ErrorDetails,
        context
      );
      errorLogger.log(appError);
      throw appError;
    }
  }) as T;
}

/**
 * Sync error handler wrapper
 */
export function handleSyncError<T extends (...args: unknown[]) => unknown>(
  fn: T,
  errorCode: ErrorCode,
  context?: string
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      const appError = createAppError(
        errorCode,
        getErrorMessage(error),
        error as ErrorDetails,
        context
      );
      errorLogger.log(appError);
      throw appError;
    }
  }) as T;
}

/**
 * React error handler for components
 */
export function handleComponentError(
  error: Error,
  componentName: string
): AppError {
  const appError = createAppError(
    ErrorCode.COMPONENT_RENDER_ERROR,
    `Error in component ${componentName}: ${error.message}`,
    error,
    componentName
  );
  
  errorLogger.log(appError);
  return appError;
}