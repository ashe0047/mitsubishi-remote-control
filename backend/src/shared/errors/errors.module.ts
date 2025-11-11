import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorHandlerService } from './services/error-handler.service';
import { ResponseFormatterService } from './services/response-formatter.service';
import { TypeSafeErrorFilter } from '../filters/type-safe-error.filter';
import { BusinessErrorStrategy } from './strategies/business-error.strategy';
import { HttpErrorStrategy } from './strategies/http-error.strategy';
import { UnknownErrorStrategy } from './strategies/unknown-error.strategy';

/**
 * Shared module for centralized error handling
 * Provides all error handling components and registers global exception filter
 */
@Global()
@Module({
  providers: [
    // Core services
    ErrorHandlerService,
    ResponseFormatterService,

    // Error handling strategies
    BusinessErrorStrategy,
    HttpErrorStrategy,
    UnknownErrorStrategy,

    // Global exception filter
    TypeSafeErrorFilter,

    // Register global exception filter with NestJS
    {
      provide: APP_FILTER,
      useClass: TypeSafeErrorFilter,
    },
  ],
  exports: [
    // Export services for use in other modules
    ErrorHandlerService,
    ResponseFormatterService,
  ],
})
export class ErrorsModule {
  /**
   * Module initialization logging
   */
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly errorFilter: TypeSafeErrorFilter,
  ) {
    // Log successful module initialization
    this.errorHandler.logDebug('ErrorsModule initialized', {
      strategies: errorFilter.getErrorHandlingStats().strategies,
      strategyCount: errorFilter.getErrorHandlingStats().strategyCount,
    });
  }
}
