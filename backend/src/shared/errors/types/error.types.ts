/**
 * Error handling type definitions for centralized error management
 */

export interface ErrorInfo {
  /** The error message extracted safely */
  message: string;
  /** Stack trace if available */
  stack?: string;
  /** Error name/type */
  name?: string;
  /** Original cause if this is a wrapped error */
  cause?: Error;
  /** Additional context information */
  context?: Record<string, any>;
}

export interface HttpErrorBody {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Request path that caused the error */
  path?: string;
  /** Unique request identifier */
  requestId?: string;
  /** Additional error details */
  details?: Record<string, any>;
  /** Business error code for domain-specific errors */
  businessCode?: string;
  /** Optional operation identifier or name */
  operation?: string;
  /** Error type or code */
  error?: string;
}

export interface HttpErrorResponse {
  success: false;
  error: HttpErrorBody;
}

export interface RequestLike {
  url?: string;
  id?: string;
}

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta: Record<string, unknown> & { timestamp: string };
}

export interface ErrorContext {
  /** Timestamp when error occurred */
  timestamp: string;
  /** Type of error */
  errorType: string;
  /** Whether stack trace is available */
  hasStack: boolean;
  /** Additional custom context */
  [key: string]: any;
}

export interface IErrorExtractor {
  /** Safely extract error message from unknown error type */
  safeMessage(error: unknown): string;
  /** Safely extract stack trace from unknown error type */
  safeStack(error: unknown): string | undefined;
  /** Check if error is a known Error instance */
  isKnownError(error: unknown): error is Error;
  /** Convert unknown error to ErrorInfo with context */
  toErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo;
}

export interface IResponseFormatter {
  /** Format successful response */
  formatSuccessResponse<T>(
    data: T,
    meta?: Record<string, unknown>,
  ): SuccessEnvelope<T>;
  /** Format error response */
  formatErrorResponse(
    errorInfo: ErrorInfo,
    statusCode: number,
    request?: RequestLike,
  ): HttpErrorResponse;
}

export interface ILogger {
  logError(
    message: string,
    error: unknown,
    context?: Record<string, any>,
  ): void;
  logWarning(message: string, context?: Record<string, any>): void;
  logDebug(message: string, context?: Record<string, any>): void;
}
