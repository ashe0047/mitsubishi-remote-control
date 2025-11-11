import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for all business logic errors
 * Extends HttpException to maintain NestJS compatibility
 * while providing additional business context
 */
export class BusinessException extends HttpException {
  /** Business-specific error code for categorization */
  readonly businessCode: string;
  /** Additional business context data */
  readonly details?: Record<string, any>;
  /** Operation that caused the error */
  readonly operation?: string;
  /** Timestamp when error occurred */
  readonly timestamp: string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    businessCode?: string,
    details?: Record<string, any>,
    cause?: Error,
    operation?: string,
  ) {
    super(message, status, { cause });

    this.businessCode = businessCode || 'BUSINESS_ERROR';
    this.details = details;
    this.operation = operation;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Get error information for logging
   */
  getErrorInfo(): Record<string, any> {
    return {
      businessCode: this.businessCode,
      details: this.details,
      operation: this.operation,
      timestamp: this.timestamp,
      statusCode: this.getStatus(),
      message: this.message,
    };
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return this.businessCode === 'VALIDATION_ERROR';
  }

  /**
   * Check if this is a quota-related error
   */
  isQuotaError(): boolean {
    return this.businessCode.startsWith('QUOTA_');
  }

  /**
   * Check if this is a permission-related error
   */
  isPermissionError(): boolean {
    return (
      this.businessCode.startsWith('PERMISSION_') || this.getStatus() === 403
    );
  }
}
