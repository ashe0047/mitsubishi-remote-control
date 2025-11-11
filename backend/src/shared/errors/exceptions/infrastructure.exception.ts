import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

/**
 * Exception thrown for database-related errors
 * Provides context about the database operation that failed
 */
export class DatabaseException extends BusinessException {
  constructor(operation: string, details?: Record<string, any>, cause?: Error) {
    super(
      `Database operation failed: ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'DATABASE_ERROR',
      {
        operation,
        infrastructureType: 'database',
        ...details,
      },
      cause,
      'database_operation',
    );
  }
}

/**
 * Exception thrown for external service failures
 * Provides context about the external service and operation
 */
export class ExternalServiceException extends BusinessException {
  constructor(
    service: string,
    operation: string,
    statusCode?: number,
    cause?: Error,
  ) {
    super(
      `External service ${service} failed during ${operation}`,
      HttpStatus.BAD_GATEWAY,
      'EXTERNAL_SERVICE_ERROR',
      {
        service,
        operation,
        statusCode,
        infrastructureType: 'external_service',
      },
      cause,
      'external_service_call',
    );
  }
}

/**
 * Exception thrown for network-related errors
 */
export class NetworkException extends BusinessException {
  constructor(host: string, operation: string, cause?: Error) {
    super(
      `Network error during ${operation} with ${host}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      'NETWORK_ERROR',
      {
        host,
        operation,
        infrastructureType: 'network',
      },
      cause,
      'network_operation',
    );
  }
}

/**
 * Exception thrown for Redis/cache-related errors
 */
export class CacheException extends BusinessException {
  constructor(operation: string, key?: string, cause?: Error) {
    super(
      `Cache operation failed: ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'CACHE_ERROR',
      {
        operation,
        key,
        infrastructureType: 'cache',
      },
      cause,
      'cache_operation',
    );
  }
}

/**
 * Exception thrown for file system operations
 */
export class FileSystemException extends BusinessException {
  constructor(operation: string, path?: string, cause?: Error) {
    super(
      `File system operation failed: ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'FILESYSTEM_ERROR',
      {
        operation,
        path,
        infrastructureType: 'filesystem',
      },
      cause,
      'filesystem_operation',
    );
  }
}

/**
 * Exception thrown for message queue/broker errors
 */
export class MessageBrokerException extends BusinessException {
  constructor(
    broker: string,
    operation: string,
    topic?: string,
    cause?: Error,
  ) {
    super(
      `Message broker ${broker} error during ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'MESSAGE_BROKER_ERROR',
      {
        broker,
        operation,
        topic,
        infrastructureType: 'message_broker',
      },
      cause,
      'message_broker_operation',
    );
  }
}
