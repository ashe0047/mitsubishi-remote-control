/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { ArgumentsHost, HttpStatus, Logger, Injectable } from '@nestjs/common';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ResponseFormatterService } from '../services/response-formatter.service';
import { ErrorExtractor } from '../utils/error-extractor.utility';
import { IErrorStrategy } from './error-strategy.interface';

/**
 * Fallback strategy for unknown errors
 * Provides safe handling for any error type that doesn't match other strategies
 */
@Injectable()
export class UnknownErrorStrategy implements IErrorStrategy {
  private readonly logger = new Logger(UnknownErrorStrategy.name);

  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
  ) {}

  /**
   * This strategy can handle any error (fallback)
   */
  canHandle(error: unknown): boolean {
    return true;
  }

  /**
   * Handle unknown errors safely without exposing sensitive information
   */
  async handle(error: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Extract error information safely
    const errorInfo = ErrorExtractor.toErrorInfo(error);
    const statusCode = this.getStatusCode(error);

    // Create safe context for logging
    const errorContext = this.errorHandler.createRequestContext(
      request,
      'unknown_error',
      {
        errorType: errorInfo.name,
        hasStack: !!errorInfo.stack,
        errorMessage: errorInfo.message,
      },
    );

    // Log unknown error with full context for debugging
    this.logger.error(
      'Unknown error occurred',
      errorInfo.stack || errorInfo.message,
      errorContext,
    );

    // Format safe response (don't expose stack traces or sensitive details)
    const errorResponse = this.responseFormatter.formatUnknownErrorResponse(
      errorInfo,
      statusCode,
      request,
    );

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Always return 500 for unknown errors (server error)
   */
  getStatusCode(error: unknown): number {
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Unknown errors have lowest priority (0)
   */
  getPriority(): number {
    return 0;
  }
}
