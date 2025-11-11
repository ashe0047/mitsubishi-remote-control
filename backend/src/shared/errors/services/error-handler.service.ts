import { Injectable, Logger } from '@nestjs/common';
import { ErrorExtractor } from '../utils/error-extractor.utility';
import { ErrorInfo, ILogger } from '../types/error.types';

/**
 * Centralized error handling service for type-safe error processing
 * Provides safe error extraction, context creation, and logging
 */
@Injectable()
export class ErrorHandlerService implements ILogger {
  private readonly logger = new Logger(ErrorHandlerService.name);

  /**
   * Safely extract error message from unknown error type
   * @param error - Unknown error object
   * @returns Safe string representation of error message
   */
  safeMessage(error: unknown): string {
    return ErrorExtractor.safeMessage(error);
  }

  /**
   * Safely extract stack trace from unknown error type
   * @param error - Unknown error object
   * @returns Stack trace string if available, undefined otherwise
   */
  safeStack(error: unknown): string | undefined {
    return ErrorExtractor.safeStack(error);
  }

  /**
   * Check if error is a known Error instance
   * @param error - Unknown error object
   * @returns True if error is an Error instance
   */
  isKnownError(error: unknown): error is Error {
    return ErrorExtractor.isKnownError(error);
  }

  /**
   * Convert unknown error to structured ErrorInfo
   * @param error - Unknown error object
   * @param context - Additional context information
   * @returns Structured error information
   */
  toErrorInfo(error: unknown, context?: Record<string, any>) {
    return ErrorExtractor.toErrorInfo(error, context);
  }

  /**
   * Create safe error context for logging
   * @param error - Unknown error object
   * @param additional - Additional context data
   * @returns Safe error context object
   */
  createContext(
    error: unknown,
    additional?: Record<string, any>,
  ): Record<string, any> {
    return ErrorExtractor.createContext(error, additional);
  }

  /**
   * Log error with structured context
   * @param message - Log message
   * @param error - Error object (unknown type)
   * @param context - Additional context information
   */
  logError(
    message: string,
    error: unknown,
    context?: Record<string, any>,
  ): void {
    const errorInfo = ErrorExtractor.toErrorInfo(error, context);

    // Include error details in context for better debugging
    const logContext = {
      ...errorInfo.context,
      errorName: errorInfo.name,
      hasStack: !!errorInfo.stack,
      errorMessage: errorInfo.message,
    };

    this.logger.error(message, errorInfo.message, logContext);
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param context - Additional context information
   */
  logWarning(message: string, context?: Record<string, any>): void {
    this.logger.warn(message, context);
  }

  /**
   * Log debug message
   * @param message - Debug message
   * @param context - Additional context information
   */
  logDebug(message: string, context?: Record<string, any>): void {
    this.logger.debug(message, context);
  }

  /**
   * Create enhanced error context for request tracking
   * @param request - Request object (Express or Socket.IO)
   * @param operation - Operation being performed
   * @param additional - Additional context data
   * @returns Enhanced context with request information
   */
  createRequestContext(
    request: unknown,
    operation?: string,
    additional?: Record<string, unknown>,
  ): Record<string, unknown> {
    const baseContext = ErrorExtractor.createContext(null);

    const requestContext: Record<string, unknown> = {};

    // Extract common request properties safely
    if (request && typeof request === 'object') {
      const req = request as Record<string, unknown>;
      if (req.url && typeof req.url === 'string') {
        requestContext.path = req.url;
      }
      if (req.method && typeof req.method === 'string') {
        requestContext.method = req.method;
      }
      if (req.id && typeof req.id === 'string') {
        requestContext.requestId = req.id;
      }
      if (req.headers && typeof req.headers === 'object') {
        const headers = req.headers as Record<string, unknown>;
        requestContext.userAgent = headers['user-agent'];
        requestContext.ip = headers['x-forwarded-for'] || headers['x-real-ip'];
      }
      if (
        req.id &&
        typeof req.id === 'string' &&
        req.handshake &&
        typeof req.handshake === 'object'
      ) {
        // Socket.IO request
        requestContext.socketId = req.id;
        const handshake = req.handshake as Record<string, unknown>;
        requestContext.query = handshake.query;
      }
    }

    if (operation) {
      requestContext.operation = operation;
    }

    return {
      ...baseContext,
      ...requestContext,
      ...additional,
    };
  }

  /**
   * Handle error in service layer with proper logging and context
   * @param error - Unknown error object
   * @param operation - Operation being performed
   * @param request - Request object for context
   * @param rethrow - Whether to rethrow after logging
   * @returns Error information if rethrow is false
   */
  handleServiceError(
    error: unknown,
    operation: string,
    request?: any,
    rethrow: boolean = true,
  ): ErrorInfo {
    const context = this.createRequestContext(request, operation);
    this.logError(`Service error in ${operation}`, error, context);

    const errorInfo = this.toErrorInfo(error, context);

    if (rethrow) {
      throw error;
    }

    return errorInfo;
  }
}
