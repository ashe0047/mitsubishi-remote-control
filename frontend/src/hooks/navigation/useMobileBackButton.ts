"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface UseMobileBackButtonOptions {
  /** Callback when hardware back button is pressed */
  onBackPressed?: () => void;
  /** Fallback route if no history is available */
  fallbackRoute?: string;
  /** Enable/disable the back button handler */
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

export interface UseMobileBackButtonReturn {
  /** Whether the handler is currently active */
  isActive: boolean;
  /** Manually trigger back navigation */
  goBack: () => void;
  /** Enable the back button handler */
  enable: () => void;
  /** Disable the back button handler */
  disable: () => void;
}

/**
 * Custom hook to handle mobile hardware back button presses
 * Works by adding a history entry and listening for popstate events
 */
export const useMobileBackButton = (
  options: UseMobileBackButtonOptions = {}
): UseMobileBackButtonReturn => {
  const {
    onBackPressed,
    fallbackRoute = '/',
    enabled = true,
    preventDefault = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const isActiveRef = useRef(false);
  const handlerEnabledRef = useRef(enabled);

  // Add a history entry to intercept back button
  const addHistoryEntry = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Add a state entry to catch back button presses
    window.history.pushState({ interceptBack: true, originalPath: pathname }, '', pathname);
    isActiveRef.current = true;
  }, [pathname]);

  // Remove the intercepted history entry
  const removeHistoryEntry = useCallback(() => {
    if (typeof window === 'undefined' || !isActiveRef.current) return;
    
    // Remove the intercepting entry by going back
    try {
      window.history.back();
      isActiveRef.current = false;
    } catch (error) {
      console.warn('Failed to remove history entry:', error);
    }
  }, []);

  // Handle back button press
  const handleBackPressed = useCallback(async () => {
    if (!handlerEnabledRef.current) return;

    try {
      if (onBackPressed) {
        onBackPressed();
      } else {
        // Default behavior: navigate back or to fallback
        if (window.history.length > 1) {
          router.back();
        } else {
          await router.push(fallbackRoute);
        }
      }
    } catch (error) {
      console.error('Error handling back button press:', error);
      // Fallback to default route
      await router.push(fallbackRoute);
    }
  }, [onBackPressed, router, fallbackRoute]);

  // Handle popstate events (hardware back button)
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!handlerEnabledRef.current) return;

    // Check if this is our intercepted back action
    if (event.state?.interceptBack) {
      if (preventDefault) {
        // Prevent the default navigation by re-adding the entry
        addHistoryEntry();
      }
      
      // Handle the back button press
      handleBackPressed();
    }
  }, [preventDefault, addHistoryEntry, handleBackPressed]);

  // Manually trigger back navigation
  const goBack = useCallback(() => {
    handleBackPressed();
  }, [handleBackPressed]);

  // Enable the back button handler
  const enable = useCallback(() => {
    handlerEnabledRef.current = true;
    if (enabled) {
      addHistoryEntry();
    }
  }, [enabled, addHistoryEntry]);

  // Disable the back button handler
  const disable = useCallback(() => {
    handlerEnabledRef.current = false;
    removeHistoryEntry();
  }, [removeHistoryEntry]);

  // Set up event listener and initial state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (enabled) {
      // Add initial history entry
      addHistoryEntry();

      // Listen for popstate events
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        removeHistoryEntry();
      };
    }
  }, [enabled, addHistoryEntry, handlePopState, removeHistoryEntry]);

  // Update enabled state when option changes
  useEffect(() => {
    handlerEnabledRef.current = enabled;
  }, [enabled]);

  // Clean up on pathname change
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        removeHistoryEntry();
      }
    };
  }, [pathname, removeHistoryEntry]);

  return {
    isActive: isActiveRef.current,
    goBack,
    enable,
    disable,
  };
};

export default useMobileBackButton;