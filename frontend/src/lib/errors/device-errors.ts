/**
 * Device-specific error classes for better error handling and user experience.
 */

/**
 * Base class for device-related errors.
 */
export abstract class DeviceError extends Error {
  public readonly deviceIdentifier?: string;
  public readonly roomId?: string;
  public readonly suggestion?: string;
  public readonly originalError?: any;
  public readonly userMessage: string;

  constructor(
    message: string,
    details: {
      deviceIdentifier?: string;
      roomId?: string;
      suggestion?: string;
      originalError?: any;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.deviceIdentifier = details.deviceIdentifier;
    this.roomId = details.roomId;
    this.suggestion = details.suggestion;
    this.originalError = details.originalError;
    this.userMessage = message;
  }

  /**
   * Get a user-friendly error message with suggestions.
   */
  getUserMessage(): string {
    if (this.suggestion) {
      return `${this.userMessage}\n\nSuggestion: ${this.suggestion}`;
    }
    return this.userMessage;
  }

  /**
   * Get error details for logging or debugging.
   */
  getErrorDetails(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      deviceIdentifier: this.deviceIdentifier,
      roomId: this.roomId,
      suggestion: this.suggestion,
      originalError: this.originalError
    };
  }
}

/**
 * Error thrown when attempting to register a device that already exists.
 */
export class DeviceAlreadyExistsError extends DeviceError {
  constructor(
    message: string,
    details: {
      deviceIdentifier?: string;
      roomId?: string;
      suggestion?: string;
      originalError?: any;
    } = {}
  ) {
    super(message, details);
  }

  /**
   * Check if this error can be resolved by updating the existing device.
   */
  canUpdateExisting(): boolean {
    return this.suggestion?.toLowerCase().includes('update') || false;
  }

  /**
   * Get suggested actions for resolving this error.
   */
  getSuggestedActions(): string[] {
    const actions = [];
    
    if (this.deviceIdentifier) {
      actions.push(`Use a different identifier instead of '${this.deviceIdentifier}'`);
      actions.push('Update the existing device if you want to change its settings');
    }
    
    if (this.suggestion) {
      actions.push(this.suggestion);
    }
    
    return actions;
  }
}

/**
 * Error thrown when a device is unavailable for communication.
 */
export class DeviceUnavailableError extends DeviceError {
  public readonly retryable: boolean;
  public readonly retryDelayMs?: number;

  constructor(
    message: string,
    details: {
      deviceIdentifier?: string;
      roomId?: string;
      suggestion?: string;
      retryable?: boolean;
      retryDelayMs?: number;
      originalError?: any;
    } = {}
  ) {
    super(message, details);
    this.retryable = details.retryable ?? true;
    this.retryDelayMs = details.retryDelayMs;
  }

  /**
   * Check if this error allows for retry attempts.
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get suggested retry delay in milliseconds.
   */
  getRetryDelayMs(): number {
    return this.retryDelayMs || 2000; // Default 2 seconds
  }

  /**
   * Get suggested actions for resolving this error.
   */
  getSuggestedActions(): string[] {
    const actions = [];
    
    if (this.deviceIdentifier) {
      actions.push(`Check that device '${this.deviceIdentifier}' is powered on`);
      actions.push('Verify the device network connection');
    }
    
    if (this.retryable) {
      actions.push('Try again in a few moments');
    }
    
    if (this.suggestion) {
      actions.push(this.suggestion);
    }
    
    return actions;
  }
}

/**
 * Error thrown when device validation fails.
 */
export class DeviceValidationError extends DeviceError {
  public readonly validationErrors: string[];

  constructor(
    message: string,
    validationErrors: string[] = [],
    details: {
      deviceIdentifier?: string;
      roomId?: string;
      suggestion?: string;
      originalError?: any;
    } = {}
  ) {
    super(message, details);
    this.validationErrors = validationErrors;
  }

  /**
   * Get all validation error messages.
   */
  getValidationErrors(): string[] {
    return this.validationErrors;
  }

  /**
   * Get formatted validation error message.
   */
  getFormattedValidationMessage(): string {
    if (this.validationErrors.length === 0) {
      return this.userMessage;
    }

    return `${this.userMessage}:\n${this.validationErrors.map(err => `• ${err}`).join('\n')}`;
  }
}

/**
 * Utility function to check if an error is a device-related error.
 */
export function isDeviceError(error: unknown): error is DeviceError {
  return error instanceof DeviceError;
}

/**
 * Utility function to extract user-friendly message from any error.
 */
export function getDeviceErrorMessage(error: unknown): string {
  if (isDeviceError(error)) {
    return error.getUserMessage();
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Utility function to check if an error is retryable.
 */
export function isRetryableDeviceError(error: unknown): boolean {
  if (error instanceof DeviceUnavailableError) {
    return error.isRetryable();
  }
  
  // Network errors are generally retryable
  if (error instanceof Error && error.message.toLowerCase().includes('network')) {
    return true;
  }
  
  return false;
}