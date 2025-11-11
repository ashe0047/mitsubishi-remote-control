import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

/**
 * Exception thrown when quota limit is exceeded
 * Provides detailed quota information for client response
 */
export class QuotaExceededException extends BusinessException {
  constructor(
    quotaId: string,
    currentUsage: number,
    allowedLimit: number,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    const percentageUsed = (currentUsage / allowedLimit) * 100;

    super(
      `Quota ${quotaId} exceeded. Current usage: ${currentUsage}, Limit: ${allowedLimit} (${percentageUsed.toFixed(1)}%)`,
      HttpStatus.BAD_REQUEST,
      'QUOTA_EXCEEDED',
      {
        quotaId,
        currentUsage,
        allowedLimit,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        overUsage: Math.max(0, currentUsage - allowedLimit),
        ...details,
      },
      cause,
      'quota_validation',
    );
  }
}

/**
 * Exception thrown when quota validation fails
 * Provides specific validation error information
 */
export class QuotaValidationException extends BusinessException {
  constructor(
    message: string,
    validationErrors?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'QUOTA_VALIDATION_ERROR',
      {
        validationErrors,
        validationType: 'quota_check',
      },
      cause,
      'quota_validation',
    );
  }
}

/**
 * Exception thrown when quota configuration is invalid
 */
export class QuotaConfigurationException extends BusinessException {
  constructor(quotaId: string, configurationError: string, cause?: Error) {
    super(
      `Invalid quota configuration for ${quotaId}: ${configurationError}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'QUOTA_CONFIGURATION_ERROR',
      {
        quotaId,
        configurationError,
      },
      cause,
      'quota_management',
    );
  }
}

/**
 * Exception thrown when quota calculation fails
 */
export class QuotaCalculationException extends BusinessException {
  constructor(
    quotaId: string,
    calculationError: string,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      `Quota calculation failed for ${quotaId}: ${calculationError}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'QUOTA_CALCULATION_ERROR',
      {
        quotaId,
        calculationError,
        ...details,
      },
      cause,
      'quota_calculation',
    );
  }
}

/**
 * Exception thrown when quota session management fails
 */
export class QuotaSessionException extends BusinessException {
  constructor(
    sessionId: string,
    sessionError: string,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      `Quota session error for ${sessionId}: ${sessionError}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'QUOTA_SESSION_ERROR',
      {
        sessionId,
        sessionError,
        ...details,
      },
      cause,
      'quota_session_management',
    );
  }
}
