import { ArgumentsHost } from '@nestjs/common';

/**
 * Interface for error handling strategies
 * Allows different error types to be handled with specific logic
 */
export interface IErrorStrategy {
  /**
   * Check if this strategy can handle the given error
   * @param error - The error to evaluate
   * @returns True if this strategy can handle the error
   */
  canHandle(error: unknown): boolean;

  /**
   * Handle the error and send appropriate response
   * @param error - The error to handle
   * @param host - NestJS execution context host
   */
  handle(error: unknown, host: ArgumentsHost): Promise<void> | void;

  /**
   * Get the HTTP status code for this error type
   * @param error - The error to evaluate
   * @returns HTTP status code
   */
  getStatusCode(error: unknown): number;

  /**
   * Get strategy priority (higher number = higher priority)
   * Used to determine strategy order when multiple strategies can handle the same error
   */
  getPriority(): number;
}
