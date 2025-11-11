/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { ErrorInfo, IErrorExtractor } from '../types/error.types';

/**
 * Utility class for safe error extraction and processing
 * Provides type-safe methods to handle unknown error types
 */
export class ErrorExtractor implements IErrorExtractor {
  /**
   * Safely extract error message from unknown error type
   * @param error - Unknown error object
   * @returns Safe string representation of error message
   */
  static safeMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      // Handle objects that might have a message property
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }

      // Handle objects that might have a toString method
      if (
        error &&
        typeof error === 'object' &&
        'toString' in error &&
        typeof (error as any).toString === 'function'
      ) {
        try {
          const result = (error as any).toString();
          if (typeof result === 'string' && result !== '[object Object]') {
            return result;
          }
        } catch {
          // Fall through to String conversion
        }
      }
    }

    // Fallback to String conversion
    return String(error);
  }

  /**
   * Safely extract stack trace from unknown error type
   * @param error - Unknown error object
   * @returns Stack trace string if available, undefined otherwise
   */
  static safeStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    if (error && typeof error === 'object' && 'stack' in error) {
      const stack = error.stack;
      if (typeof stack === 'string') {
        return stack;
      }
    }

    return undefined;
  }

  /**
   * Type guard to check if error is a known Error instance
   * @param error - Unknown error object
   * @returns True if error is an Error instance
   */
  static isKnownError(error: unknown): error is Error {
    return error instanceof Error;
  }

  /**
   * Convert unknown error to ErrorInfo with optional context
   * @param error - Unknown error object
   * @param context - Additional context information
   * @returns Structured error information
   */
  static toErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo {
    return {
      message: this.safeMessage(error),
      stack: this.safeStack(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      cause:
        error instanceof Error && error.cause instanceof Error
          ? error.cause
          : undefined,
      context,
    };
  }

  /**
   * Create safe error context for logging
   * @param error - Unknown error object
   * @param additional - Additional context data
   * @returns Safe error context object
   */
  static createContext(
    error: unknown,
    additional?: Record<string, any>,
  ): Record<string, any> {
    const baseContext = {
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      hasStack: !!this.safeStack(error),
      hasCause: error instanceof Error && !!error.cause,
    };

    return {
      ...baseContext,
      ...additional,
    };
  }

  // Instance methods for interface compatibility
  safeMessage(error: unknown): string {
    return ErrorExtractor.safeMessage(error);
  }

  safeStack(error: unknown): string | undefined {
    return ErrorExtractor.safeStack(error);
  }

  isKnownError(error: unknown): error is Error {
    return ErrorExtractor.isKnownError(error);
  }

  toErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo {
    return ErrorExtractor.toErrorInfo(error, context);
  }
}
