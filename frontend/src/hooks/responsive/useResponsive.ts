import { useState, useEffect } from 'react';

/**
 * Responsive breakpoint state
 */
export interface ResponsiveBreakpoint {
  /** Current viewport width in pixels */
  width: number;
  /** Is viewport mobile size (< 768px) */
  isMobile: boolean;
  /** Is viewport tablet size (768px - 1024px) */
  isTablet: boolean;
  /** Is viewport desktop size (>= 1024px) */
  isDesktop: boolean;
  /** Current breakpoint name */
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Get breakpoint information from width
 */
const getBreakpoint = (width: number): ResponsiveBreakpoint => {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  };
};

/**
 * Responsive layout hook
 *
 * Detects current breakpoint and provides responsive state.
 * Uses matchMedia API for efficient breakpoint detection.
 *
 * @returns {ResponsiveBreakpoint} Current breakpoint state
 *
 * @example
 * ```tsx
 * const { isMobile, isDesktop } = useResponsive();
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * return <DesktopLayout />;
 * ```
 */
export const useResponsive = (): ResponsiveBreakpoint => {
  // SSR-safe initial state (default to desktop to avoid hydration mismatch)
  const [breakpoint, setBreakpoint] = useState<ResponsiveBreakpoint>(() =>
    getBreakpoint(typeof window !== 'undefined' ? window.innerWidth : 1024)
  );

  useEffect(() => {
    // Skip if not in browser
    if (typeof window === 'undefined') return;

    // Create media queries
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

    // Update breakpoint state
    const updateBreakpoint = () => {
      setBreakpoint(getBreakpoint(window.innerWidth));
    };

    // Listen to media query changes (more efficient than resize)
    mobileQuery.addEventListener('change', updateBreakpoint);
    tabletQuery.addEventListener('change', updateBreakpoint);

    // Initial update
    updateBreakpoint();

    // Cleanup
    return () => {
      mobileQuery.removeEventListener('change', updateBreakpoint);
      tabletQuery.removeEventListener('change', updateBreakpoint);
    };
  }, []);

  return breakpoint;
};
