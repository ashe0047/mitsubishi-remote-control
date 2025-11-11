/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { ArgumentsHost, HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ResponseFormatterService } from '../services/response-formatter.service';
import { IErrorStrategy } from './error-strategy.interface';

/**
 * Strategy for handling business logic errors
 * Provides enhanced logging and response formatting for business exceptions
 */
@Injectable()
export class BusinessErrorStrategy implements IErrorStrategy {
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
  ) {}

  /**
   * Check if error is a BusinessException
   */
  canHandle(error: unknown): boolean {
    return error instanceof BusinessException;
  }

  /**
   * Handle business exceptions with enhanced logging and response formatting
   */
  async handle(error: BusinessException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = error.getStatus();

    // Create enhanced error context for logging
    const errorContext = this.errorHandler.createRequestContext(
      request,
      error.operation,
      {
        businessCode: error.businessCode,
        hasDetails: !!error.details,
        detailsCount: error.details ? Object.keys(error.details).length : 0,
      },
    );

    // Log business error with full context
    this.errorHandler.logError('Business error occurred', error, errorContext);

    // Format response with business-specific information
    const errorResponse = this.responseFormatter.formatBusinessErrorResponse(
      error,
      request,
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Get status code from business exception
   */
  getStatusCode(error: unknown): number {
    return (error as BusinessException).getStatus();
  }

  /**
   * Business errors have high priority (100)
   */
  getPriority(): number {
    return 100;
  }
}
