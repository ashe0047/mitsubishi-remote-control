import { z } from 'zod';

/**
 * Validates that a command is supported by a device strategy
 * @param supportedCommands - Array of supported command strings
 * @returns Validation function that checks command support
 */
export function createSupportedCommandValidator(supportedCommands: string[]) {
  return (command: string): boolean => {
    return supportedCommands.includes(command);
  };
}

/**
 * Creates a refined validation schema with custom logic
 * @param baseSchema - The base Zod schema
 * @param refinement - Custom validation logic
 * @param errorMessage - Error message for failed validation
 * @returns Refined Zod schema
 */
export function createRefinedSchema<T extends z.ZodType>(
  baseSchema: T,
  refinement: (data: z.infer<T>) => boolean,
  errorMessage: string,
) {
  return baseSchema.refine(refinement, {
    message: errorMessage,
  });
}

/**
 * Formats Zod validation errors into user-friendly messages
 * @param errors - Zod error array
 * @returns Formatted error message string
 */
export function formatValidationErrors(errors: z.ZodIssue[]): string {
  return errors
    .map((error) => {
      const path = error.path.length > 0 ? `${error.path.join('.')}: ` : '';
      return `${path}${error.message}`;
    })
    .join(', ');
}
