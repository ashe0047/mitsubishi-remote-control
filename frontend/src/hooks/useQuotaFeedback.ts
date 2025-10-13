import { useState, useCallback, useRef, useEffect } from 'react';
import { QuotaValidationResult, QuotaExceededException } from '@/lib/api/quota-api-factory';

export interface QuotaFeedbackState {
  validationResult: QuotaValidationResult | null;
  isVisible: boolean;
  autoHideTimer: NodeJS.Timeout | null;
}

export interface UseQuotaFeedbackOptions {
  /**
   * Auto-hide timeout in milliseconds.
   * Set to 0 to disable auto-hide.
   * @default 5000
   */
  autoHideTimeout?: number;

  /**
   * Whether to auto-hide success messages.
   * @default true
   */
  autoHideSuccess?: boolean;

  /**
   * Whether to auto-hide warning messages.
   * @default false
   */
  autoHideWarnings?: boolean;

  /**
   * Whether to auto-hide error messages.
   * @default false
   */
  autoHideErrors?: boolean;
}

export interface UseQuotaFeedbackReturn {
  /**
   * Current quota validation result to display.
   */
  validationResult: QuotaValidationResult | null;

  /**
   * Whether the feedback should be visible.
   */
  isVisible: boolean;

  /**
   * Show quota validation result.
   */
  showFeedback: (result: QuotaValidationResult) => void;

  /**
   * Show quota exceeded error.
   */
  showQuotaExceeded: (error: QuotaExceededException) => void;

  /**
   * Hide the current feedback.
   */
  hideFeedback: () => void;

  /**
   * Clear any auto-hide timers.
   */
  clearAutoHide: () => void;

  /**
   * Helper to handle errors from quota-aware operations.
   */
  handleQuotaError: (error: Error) => void;
}

/**
 * Hook for managing quota feedback state and display.
 *
 * This hook provides a simple interface for showing quota validation
 * results to users with automatic timeout and error handling.
 */
export const useQuotaFeedback = (
  options: UseQuotaFeedbackOptions = {}
): UseQuotaFeedbackReturn => {
  const {
    autoHideTimeout = 5000,
    autoHideSuccess = true,
    autoHideWarnings = false,
    autoHideErrors = false
  } = options;

  const [state, setState] = useState<QuotaFeedbackState>({
    validationResult: null,
    isVisible: false,
    autoHideTimer: null
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current.autoHideTimer) {
        clearTimeout(stateRef.current.autoHideTimer);
      }
    };
  }, []);

  const clearAutoHide = useCallback(() => {
    if (state.autoHideTimer) {
      clearTimeout(state.autoHideTimer);
      setState(prev => ({ ...prev, autoHideTimer: null }));
    }
  }, [state.autoHideTimer]);

  const scheduleAutoHide = useCallback((result: QuotaValidationResult) => {
    if (autoHideTimeout <= 0) return;

    const shouldAutoHide =
      (result.status === 'ALLOW' && autoHideSuccess) ||
      (result.status === 'ALLOW_WITH_WARNING' && autoHideWarnings) ||
      (result.status === 'BLOCK' && autoHideErrors) ||
      (result.status === 'FAIL_OPEN' && autoHideSuccess);

    if (shouldAutoHide) {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isVisible: false,
          autoHideTimer: null
        }));
      }, autoHideTimeout);

      setState(prev => ({ ...prev, autoHideTimer: timer }));
    }
  }, [autoHideTimeout, autoHideSuccess, autoHideWarnings, autoHideErrors]);

  const showFeedback = useCallback((result: QuotaValidationResult) => {
    // Clear any existing timer
    if (state.autoHideTimer) {
      clearTimeout(state.autoHideTimer);
    }

    setState({
      validationResult: result,
      isVisible: true,
      autoHideTimer: null
    });

    // Schedule auto-hide if applicable
    scheduleAutoHide(result);
  }, [state.autoHideTimer, scheduleAutoHide]);

  const showQuotaExceeded = useCallback((error: QuotaExceededException) => {
    const result: QuotaValidationResult = error.validationResult || {
      status: 'BLOCK',
      message: error.message,
      reason: 'Quota limit exceeded'
    };

    showFeedback(result);
  }, [showFeedback]);

  const hideFeedback = useCallback(() => {
    clearAutoHide();
    setState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, [clearAutoHide]);

  const handleQuotaError = useCallback((error: Error) => {
    if (error instanceof QuotaExceededException) {
      showQuotaExceeded(error);
    } else {
      // For other errors, show a generic failure message
      const result: QuotaValidationResult = {
        status: 'FAIL_OPEN',
        message: 'Command executed despite validation error',
        reason: error.message || 'Unknown error occurred'
      };
      showFeedback(result);
    }
  }, [showFeedback, showQuotaExceeded]);

  return {
    validationResult: state.validationResult,
    isVisible: state.isVisible,
    showFeedback,
    showQuotaExceeded,
    hideFeedback,
    clearAutoHide,
    handleQuotaError
  };
};

export default useQuotaFeedback;