/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import {
  ErrorInfo,
  IResponseFormatter,
  HttpErrorResponse,
  RequestLike,
  SuccessEnvelope,
} from '../types/error.types';

/**
 * Service for formatting standardized error and success responses
 * Ensures consistent response structure across the application
 */
@Injectable()
export class ResponseFormatterService implements IResponseFormatter {
  private getRequestStringProp(
    request: unknown,
    key: 'url' | 'id',
  ): string | undefined {
    if (request && typeof request === 'object' && request !== null) {
      const value = (request as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }
  /**
   * Format successful response with consistent structure
   */
  formatSuccessResponse<T>(
    data: T,
    meta?: Record<string, unknown>,
  ): SuccessEnvelope<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  /**
   * Format error response with comprehensive information
   */
  formatErrorResponse(
    errorInfo: ErrorInfo,
    statusCode: number,
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode,
        message: errorInfo.message,
        error: errorInfo.name || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details: errorInfo.context,
      },
    };
  }

  /**
   * Format business exception response with enhanced information
   */
  formatBusinessErrorResponse(
    error: BusinessException,
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode: error.getStatus(),
        message: error.message,
        businessCode: error.businessCode,
        error: error.constructor.name,
        timestamp: error.timestamp,
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details: error.details,
        operation: error.operation,
      },
    };
  }

  /**
   * Format HTTP exception response
   */
  formatHttpErrorResponse(
    error: HttpException,
    request?: RequestLike,
  ): HttpErrorResponse {
    const statusCode = error.getStatus();
    const errorResponse = error.getResponse();

    // Extract additional details if available
    let details: Record<string, any> | undefined;
    if (typeof errorResponse === 'object' && errorResponse !== null) {
      const responseObj = errorResponse as any;
      details = {
        ...responseObj,
        // Remove properties that are already in the top level
        statusCode: undefined,
        message: undefined,
        error: undefined,
      };
    }

    return {
      success: false,
      error: {
        statusCode,
        message: error.message,
        error: error.constructor.name,
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details,
      },
    };
  }

  /**
   * Format unknown error response (safe, doesn't expose sensitive information)
   */
  formatUnknownErrorResponse(
    errorInfo: ErrorInfo,
    statusCode: number,
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode,
        message: 'An unexpected error occurred',
        error: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        // Don't expose internal error details for unknown errors
        details: undefined,
      },
    };
  }

  /**
   * Format validation error response
   */
  formatValidationErrorResponse(
    validationErrors: Record<string, string[]>,
    message: string = 'Validation failed',
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode: 400,
        message,
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details: {
          validationErrors,
          errorCount: Object.values(validationErrors).reduce(
            (sum, errors) => sum + errors.length,
            0,
          ),
          fieldCount: Object.keys(validationErrors).length,
        },
      },
    };
  }

  /**
   * Format unauthorized error response
   */
  formatUnauthorizedErrorResponse(
    message: string = 'Unauthorized',
    details?: Record<string, unknown>,
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode: 401,
        message,
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details,
      },
    };
  }

  /**
   * Format forbidden error response
   */
  formatForbiddenErrorResponse(
    message: string = 'Forbidden',
    details?: Record<string, unknown>,
    request?: RequestLike,
  ): HttpErrorResponse {
    return {
      success: false,
      error: {
        statusCode: 403,
        message,
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
        path: this.getRequestStringProp(request, 'url'),
        requestId: this.getRequestStringProp(request, 'id'),
        details,
      },
    };
  }

  /**
   * Format not found error response
   */
  formatNotFoundErrorResponse(
    resource: string,
    identifier?: string,
    request?: any,
  ): any {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    return {
      success: false,
      error: {
        statusCode: 404,
        message,
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
        path:
          (request &&
            typeof request === 'object' &&
            (request as Record<string, unknown>).url) ||
          undefined,
        requestId:
          (request &&
            typeof request === 'object' &&
            (request as Record<string, unknown>).id) ||
          undefined,
        details: identifier ? { resource, identifier } : { resource },
      },
    };
  }

  /**
   * Format rate limit exceeded error response
   */
  formatRateLimitErrorResponse(
    limit: number,
    windowMs: number,
    request?: any,
  ): any {
    return {
      success: false,
      error: {
        statusCode: 429,
        message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms.`,
        error: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString(),
        path:
          (request &&
            typeof request === 'object' &&
            (request as Record<string, unknown>).url) ||
          undefined,
        requestId:
          (request &&
            typeof request === 'object' &&
            (request as Record<string, unknown>).id) ||
          undefined,
        details: {
          limit,
          windowMs,
          retryAfter: Math.ceil(windowMs / 1000), // seconds
        },
      },
    };
  }
}
