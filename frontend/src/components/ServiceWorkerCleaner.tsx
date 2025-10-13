"use client";

import { useEffect } from 'react';
import { clearServiceWorkerInDevelopment, preventServiceWorkerRegistration } from '@/lib/utils/clear-service-worker';

/**
 * Component that clears service workers in development mode
 * This helps resolve CSP and caching issues during development
 */
export default function ServiceWorkerCleaner() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if we've already cleaned up in this session to avoid infinite loops
    const hasBeenCleaned = sessionStorage.getItem('sw-cleaned');
    if (hasBeenCleaned) {
      console.log('ℹ️ Service worker already cleaned in this session');
      return;
    }

    // Add CSP meta tag for development
    if (process.env.NODE_ENV === 'development') {
      // Remove any existing CSP meta tags
      const existingCspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (existingCspMeta) {
        existingCspMeta.remove();
      }

      // Add new CSP meta tag that allows backend connections
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      cspMeta.content = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self' http://localhost:8081 ws://localhost:8081 http://localhost:3000 ws://localhost:3000; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";
      document.head.appendChild(cspMeta);
      console.log('✅ Added development CSP policy that allows backend connections');
    }

    // Prevent new service worker registrations
    preventServiceWorkerRegistration();

    // Clear existing service workers
    clearServiceWorkerInDevelopment().then(async () => {
      if (process.env.NODE_ENV === 'development') {
        // Check if there are any active service workers after cleanup
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            console.warn('⚠️ Service workers still active after cleanup. This may cause issues.');
            
            // Force a hard refresh to ensure cache is completely cleared
            console.log('🔄 Forcing hard refresh to clear remaining cache...');
            window.location.reload();
          } else {
            console.log('✅ All service workers successfully cleared');
          }
        }
        
        // Also check if the CSP is working by testing a simple fetch
        try {
          const testUrl = `${window.location.protocol}//${window.location.hostname}:8081/actuator/health`;
          await fetch(testUrl, { mode: 'no-cors' });
          console.log('✅ Backend connectivity test passed');
        } catch {
          console.warn('⚠️ Backend connectivity test failed, but this may be expected if backend is not running');
        }
      }
    });
  }, []);

  // This component doesn't render anything
  return null;
}