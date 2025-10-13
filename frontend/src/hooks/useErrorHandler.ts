"use client";

import { useState, useCallback } from 'react';
import { 
  AppError, 
  ErrorCode, 
  createAppError, 
  errorLogger, 
  getUserFriendlyMessage, 
  isRecoverableError 
} from '@/lib/error-handling/error-utils';

// Type definitions for error details
type ErrorDetails = Record<string, unknown> | string | number | boolean | null;

export interface UseErrorHandlerReturn {
  /** Current error state */
  error: AppError | null;
  /** Whether there is an active error */
  hasError: boolean;
  /** User-friendly error message */
  errorMessage: string | null;
  /** Whether the error is recoverable */
  isRecoverable: boolean;
  /** Handle a new error */
  handleError: (code: ErrorCode, message: string, details?: ErrorDetails, context?: string) => void;
  /** Handle an existing error or exception */
  handleException: (error: unknown, code: ErrorCode, context?: string) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Retry handler (if applicable) */
  retry: (() => void) | null;
  /** Set a retry handler */
  setRetryHandler: (handler: (() => void) | null) => void;
}

export interface UseErrorHandlerOptions {
  /** Auto-clear error after specified milliseconds */
  autoClearAfter?: number;
  /** Default retry handler */
  onRetry?: () => void;
  /** Custom error handler */
  onError?: (error: AppError) => void;
}

/**
 * Custom hook for centralized error handling
 */
export const useErrorHandler = (options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn => {
  const { autoClearAfter, onRetry, onError } = options;
  
  const [error, setError] = useState<AppError | null>(null);
  const [retryHandler, setRetryHandler] = useState<(() => void) | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setRetryHandler(null);
  }, []);

  // Handle a new error
  const handleError = useCallback((
    code: ErrorCode,
    message: string,
    details?: ErrorDetails,
    context?: string
  ) => {
    const appError = createAppError(code, message, details, context);
    
    // Log the error
    errorLogger.log(appError);
    
    // Set error state
    setError(appError);
    
    // Call custom error handler if provided
    if (onError) {
      onError(appError);
    }
    
    // Auto-clear if specified
    if (autoClearAfter) {
      setTimeout(clearError, autoClearAfter);
    }
  }, [onError, autoClearAfter, clearError]);

  // Handle an existing error or exception
  const handleException = useCallback((
    error: unknown,
    code: ErrorCode,
    context?: string
  ) => {
    let message: string;
    let details: ErrorDetails;
    
    if (error instanceof Error) {
      message = error.message;
      details = {
        name: error.name,
        stack: error.stack,
      };
    } else if (typeof error === 'string') {
      message = error;
      details = null;
    } else {
      message = 'Unknown error occurred';
      details = error as ErrorDetails;
    }
    
    handleError(code, message, details, context);
  }, [handleError]);

  // Set retry handler
  const setRetryHandlerCallback = useCallback((handler: (() => void) | null) => {
    setRetryHandler(() => handler);
  }, []);

  // Execute retry
  const retry = useCallback(() => {
    if (retryHandler) {
      clearError();
      retryHandler();
    } else if (onRetry) {
      clearError();
      onRetry();
    }
  }, [retryHandler, onRetry, clearError]);

  return {
    error,
    hasError: error !== null,
    errorMessage: error ? getUserFriendlyMessage(error) : null,
    isRecoverable: error ? isRecoverableError(error) : false,
    handleError,
    handleException,
    clearError,
    retry: (retryHandler || onRetry) ? retry : null,
    setRetryHandler: setRetryHandlerCallback,
  };
};