/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { ArgumentsHost, HttpException, Injectable } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ResponseFormatterService } from '../services/response-formatter.service';
import { IErrorStrategy } from './error-strategy.interface';

/**
 * Strategy for handling standard NestJS HttpException
 * Provides consistent response formatting for HTTP exceptions
 */
@Injectable()
export class HttpErrorStrategy implements IErrorStrategy {
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
  ) {}

  /**
   * Check if error is an HttpException (but not a BusinessException)
   */
  canHandle(error: unknown): boolean {
    return (
      error instanceof HttpException && !(error instanceof BusinessException)
    );
  }

  /**
   * Handle HTTP exceptions with standard response formatting
   */
  async handle(error: HttpException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = error.getStatus();

    // Create context for logging
    const errorContext = this.errorHandler.createRequestContext(
      request,
      'http_exception',
      {
        httpStatus: status,
        errorType: error.constructor.name,
      },
    );

    // Log HTTP error (but not 4xx client errors unless debug mode)
    if (status >= 500) {
      this.errorHandler.logError('HTTP server error', error, errorContext);
    } else {
      this.errorHandler.logWarning('HTTP client error', {
        ...errorContext,
        message: error.message,
      });
    }

    // Format response for HTTP exception
    const errorResponse = this.responseFormatter.formatHttpErrorResponse(
      error,
      request,
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Get status code from HTTP exception
   */
  getStatusCode(error: unknown): number {
    return (error as HttpException).getStatus();
  }

  /**
   * HTTP errors have medium priority (50)
   */
  getPriority(): number {
    return 50;
  }
}
