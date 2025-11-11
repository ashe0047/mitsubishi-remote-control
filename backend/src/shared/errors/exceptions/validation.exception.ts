import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

/**
 * Exception thrown for detailed validation errors
 * Provides comprehensive validation failure information
 */
export class DetailedValidationException extends BusinessException {
  constructor(
    validationErrors: Record<string, string[]>,
    message: string = 'Validation failed',
    cause?: Error,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      {
        validationErrors,
        validationType: 'detailed',
        errorCount: Object.values(validationErrors).reduce(
          (sum, errors) => sum + errors.length,
          0,
        ),
        fieldCount: Object.keys(validationErrors).length,
      },
      cause,
      'validation',
    );
  }
}

/**
 * Exception thrown for single field validation errors
 */
export class FieldValidationException extends BusinessException {
  constructor(
    field: string,
    value: unknown,
    constraint: string,
    message?: string,
    cause?: Error,
  ) {
    super(
      message || `Validation failed for field '${field}': ${constraint}`,
      HttpStatus.BAD_REQUEST,
      'FIELD_VALIDATION_ERROR',
      {
        field,
        value,
        constraint,
        validationType: 'field',
      },
      cause,
      'validation',
    );
  }
}

/**
 * Exception thrown for authentication validation errors
 */
export class AuthenticationValidationException extends BusinessException {
  constructor(
    authenticationError: string,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      `Authentication validation failed: ${authenticationError}`,
      HttpStatus.UNAUTHORIZED,
      'AUTH_VALIDATION_ERROR',
      {
        authenticationError,
        validationType: 'authentication',
        ...details,
      },
      cause,
      'authentication',
    );
  }
}

/**
 * Exception thrown for authorization validation errors
 */
export class AuthorizationValidationException extends BusinessException {
  constructor(
    resource: string,
    action: string,
    reason?: string,
    cause?: Error,
  ) {
    super(
      reason || `Authorization failed: ${action} not allowed on ${resource}`,
      HttpStatus.FORBIDDEN,
      'AUTHORIZATION_VALIDATION_ERROR',
      {
        resource,
        action,
        reason: reason || 'Insufficient permissions',
        validationType: 'authorization',
      },
      cause,
      'authorization',
    );
  }
}
