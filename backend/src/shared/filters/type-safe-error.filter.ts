/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { ErrorHandlerService } from '../errors/services/error-handler.service';
import { ResponseFormatterService } from '../errors/services/response-formatter.service';
import { IErrorStrategy } from '../errors/strategies/error-strategy.interface';
import { BusinessErrorStrategy } from '../errors/strategies/business-error.strategy';
import { HttpErrorStrategy } from '../errors/strategies/http-error.strategy';
import { UnknownErrorStrategy } from '../errors/strategies/unknown-error.strategy';

/**
 * Global exception filter that provides centralized, type-safe error handling
 * Uses strategy pattern to handle different error types appropriately
 *
 * This filter catches all unhandled exceptions and:
 * 1. Processes errors safely without type assertions
 * 2. Logs errors with comprehensive context
 * 3. Returns consistent error responses
 * 4. Maintains security by not exposing sensitive information
 */
@Catch()
export class TypeSafeErrorFilter {
  private readonly logger = new Logger(TypeSafeErrorFilter.name);
  private readonly strategies: IErrorStrategy[];

  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
    businessErrorStrategy: BusinessErrorStrategy,
    httpErrorStrategy: HttpErrorStrategy,
    unknownErrorStrategy: UnknownErrorStrategy,
  ) {
    // Initialize strategies sorted by priority (highest first)
    this.strategies = [
      businessErrorStrategy,
      httpErrorStrategy,
      unknownErrorStrategy,
    ].sort((a, b) => b.getPriority() - a.getPriority());

    this.logger.log(
      'TypeSafeErrorFilter initialized with strategies: ' +
        this.strategies.map((s) => s.constructor.name).join(', '),
    );
  }

  /**
   * Main exception handling method
   * Routes errors to appropriate strategy based on type
   */
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const startTime = Date.now();

    try {
      // Determine the appropriate strategy for this error
      const strategy = this.findBestStrategy(exception);

      if (!strategy) {
        // This should never happen as UnknownErrorStrategy handles everything
        this.logger.error('No strategy found for error, using fallback', {
          errorType: typeof exception,
          hasStack: !!(exception instanceof Error && exception.stack),
        });
        this.handleFallbackError(exception, host);
        return;
      }

      // Handle the error with the selected strategy
      await strategy.handle(exception, host);

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      if (processingTime > 10) {
        // Log if processing takes more than 10ms
        this.logger.warn(`Error processing took ${processingTime}ms`, {
          strategy: strategy.constructor.name,
          errorType:
            exception instanceof Error
              ? exception.constructor.name
              : typeof exception,
        });
      }
    } catch (handlingError) {
      // If error handling itself fails, log and send basic response
      this.logger.error('Error in exception filter', handlingError, {
        originalError:
          exception instanceof Error ? exception.message : String(exception),
      });
      this.handleFallbackError(exception, host);
    }
  }

  /**
   * Find the best strategy to handle the given error
   * Prioritizes strategies by priority and capability
   */
  private findBestStrategy(error: unknown): IErrorStrategy | null {
    // Find all strategies that can handle this error
    const capableStrategies = this.strategies.filter((strategy) =>
      strategy.canHandle(error),
    );

    if (capableStrategies.length === 0) {
      return null;
    }

    // Return the strategy with highest priority
    return capableStrategies[0];
  }

  /**
   * Fallback error handling when strategy-based handling fails
   * Provides minimal safe response
   */
  private handleFallbackError(error: unknown, host: ArgumentsHost): void {
    try {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();
      const request = ctx.getRequest();

      // Create safe error response
      const statusCode = 500;
      const errorResponse = {
        success: false,
        error: {
          statusCode,
          message: 'An unexpected error occurred',
          error: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date().toISOString(),
          path: request?.url,
        },
      };

      response.status(statusCode).json(errorResponse);

      // Log the fallback handling
      this.logger.error('Fallback error handling used', {
        originalError: error instanceof Error ? error.message : String(error),
        errorType: typeof error,
        path: request?.url,
      });
    } catch (fallbackError) {
      // Last resort - this should ideally never happen
      this.logger.error('Fallback error handling failed', fallbackError);
      // We can't do much more at this point
    }
  }

  /**
   * Get statistics about error handling (useful for monitoring)
   */
  getErrorHandlingStats(): {
    strategyCount: number;
    strategies: string[];
    initializedAt: string;
  } {
    return {
      strategyCount: this.strategies.length,
      strategies: this.strategies.map((s) => s.constructor.name),
      initializedAt: new Date().toISOString(),
    };
  }
}
