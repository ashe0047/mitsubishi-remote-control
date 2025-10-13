/**
 * Toast notification utilities
 *
 * Centralized toast notification functions using Sonner library.
 * Provides consistent user feedback for success, error, and info messages.
 */

import { toast } from 'sonner';

/**
 * Show success toast notification
 * @param message - Success message to display
 * @param description - Optional detailed description
 */
export function showSuccessToast(message: string, description?: string): void {
  toast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show error toast notification
 * @param message - Error message to display
 * @param description - Optional detailed error description
 */
export function showErrorToast(message: string, description?: string): void {
  toast.error(message, {
    description,
    duration: 5000, // Errors stay longer for users to read
  });
}

/**
 * Show info toast notification
 * @param message - Info message to display
 * @param description - Optional detailed description
 */
export function showInfoToast(message: string, description?: string): void {
  toast.info(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show warning toast notification
 * @param message - Warning message to display
 * @param description - Optional detailed description
 */
export function showWarningToast(message: string, description?: string): void {
  toast.warning(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show loading toast notification
 * Returns toast ID for later dismissal
 * @param message - Loading message to display
 * @returns Toast ID for dismissal
 */
export function showLoadingToast(message: string): string | number {
  return toast.loading(message);
}

/**
 * Dismiss a specific toast by ID
 * @param toastId - ID of toast to dismiss
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Dismiss all active toasts
 */
export function dismissAllToasts(): void {
  toast.dismiss();
}
