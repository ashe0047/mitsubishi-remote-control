"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UseNavigateBackOptions, UseNavigateBackReturn } from '@/types/navigation';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobile } from '@/hooks/useMobile';

export const useNavigateBack = (options: UseNavigateBackOptions = {}): UseNavigateBackReturn => {
  const { fallbackRoute = '/', confirmNavigation = false, forceFallbackRoute = false } = options;
  const [isNavigating, setIsNavigating] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMobile();
  const haptic = useHaptic(isMobile);

  // Check if we can go back based on browser history
  useEffect(() => {
    const checkCanGoBack = () => {
      // Check if we have navigation history
      // This is a simple heuristic - in a real app you might track this more precisely
      const hasHistory = window.history.length > 1;
      const isNotOnHomePage = pathname !== '/' && pathname !== '/rooms';
      setCanGoBack(hasHistory && isNotOnHomePage);
    };

    checkCanGoBack();
    
    // Listen for route changes to update canGoBack status
    const handleRouteChange = () => {
      checkCanGoBack();
    };

    // Listen for popstate events (browser back/forward buttons)
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [pathname]);

  const navigateBack = useCallback(async () => {
    if (isNavigating) {
      console.warn('Navigation already in progress, ignoring duplicate attempt');
      return;
    }

    setIsNavigating(true);

    try {
      // Haptic feedback for mobile devices
      haptic(50);

      // Optional confirmation dialog
      if (confirmNavigation) {
        const confirmed = window.confirm('Are you sure you want to go back?');
        if (!confirmed) {
          setIsNavigating(false);
          return;
        }
      }

      // Use forced fallback route if specified, otherwise try browser history first
      if (forceFallbackRoute) {
        // Always use fallback route - ensures consistent navigation to specific page
        await router.push(fallbackRoute);
      } else if (canGoBack && window.history.length > 1) {
        // Use router.back() for Next.js client-side navigation
        router.back();
      } else {
        // Fallback to the specified route
        await router.push(fallbackRoute);
      }

      // Reset navigation state after a short delay to allow navigation to complete
      setTimeout(() => {
        setIsNavigating(false);
      }, 300);

    } catch (error) {
      console.error('Navigation error:', error);
      
      // Fallback navigation in case of error
      try {
        await router.push(fallbackRoute);
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
        // Last resort: use window.location
        window.location.href = fallbackRoute;
      }
      
      setIsNavigating(false);
    }
  }, [
    isNavigating,
    canGoBack,
    confirmNavigation,
    fallbackRoute,
    forceFallbackRoute,
    router,
    haptic,
  ]);

  return {
    navigateBack,
    canGoBack,
    isNavigating,
  };
};

export default useNavigateBack;