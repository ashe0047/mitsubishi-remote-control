import { z } from 'zod';

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    })
    .min(1, { message: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters long' }),
  rememberMe: z.boolean().optional(),
});

/**
 * Registration form validation schema
 */
export const registerSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    })
    .min(1, { message: 'Name is required' })
    .min(2, { message: 'Name must be at least 2 characters long' })
    .max(50, { message: 'Name must be less than 50 characters long' })
    .regex(/^[a-zA-Z\s]+$/, { message: 'Name can only contain letters and spaces' }),
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password must be less than 100 characters long' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    }),
  confirmPassword: z
    .string({
      required_error: 'Please confirm your password',
      invalid_type_error: 'Confirm password must be a string',
    })
    .min(1, { message: 'Please confirm your password' }),
  familyName: z
    .string()
    .min(2, { message: 'Family name must be at least 2 characters long' })
    .max(50, { message: 'Family name must be less than 50 characters long' })
    .regex(/^[a-zA-Z\s]+$/, { message: 'Family name can only contain letters and spaces' })
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
});

/**
 * Reset password form validation schema
 */
export const resetPasswordSchema = z.object({
  token: z
    .string({
      required_error: 'Reset token is required',
      invalid_type_error: 'Reset token must be a string',
    })
    .min(1, { message: 'Reset token is required' }),
  password: z
    .string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password must be less than 100 characters long' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    }),
  confirmPassword: z
    .string({
      required_error: 'Please confirm your password',
      invalid_type_error: 'Confirm password must be a string',
    })
    .min(1, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Change password form validation schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string({
      required_error: 'Current password is required',
      invalid_type_error: 'Current password must be a string',
    })
    .min(1, { message: 'Current password is required' }),
  newPassword: z
    .string({
      required_error: 'New password is required',
      invalid_type_error: 'New password must be a string',
    })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password must be less than 100 characters long' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    }),
  confirmNewPassword: z
    .string({
      required_error: 'Please confirm your new password',
      invalid_type_error: 'Confirm new password must be a string',
    })
    .min(1, { message: 'Please confirm your new password' }),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

// Type aliases for form data
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// Form state interfaces for better TypeScript support
export interface FormFieldError {
  message: string;
}

export interface FormState<T> {
  data: T | null;
  errors: Partial<Record<keyof T, FormFieldError>>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface AuthFormProps<T> {
  onSubmit: (data: T) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

// Helper type for form field props
export interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}