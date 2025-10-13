/**
 * Utility to clear service workers in development mode
 * This helps resolve CSP and caching issues during development
 */

export async function clearServiceWorkerInDevelopment(): Promise<void> {
  // Only run in development and in browser environment
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return;
  }

  try {
    console.log('🧹 Clearing service workers in development mode...');

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
        console.log('✅ Unregistered service worker:', registration.scope);
      }
      
      if (registrations.length > 0) {
        console.log(`🧹 Cleared ${registrations.length} service worker(s)`);
      }
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          await caches.delete(cacheName);
          console.log('🗑️ Deleted cache:', cacheName);
        })
      );
      
      if (cacheNames.length > 0) {
        console.log(`🧹 Cleared ${cacheNames.length} cache(s)`);
      }
    }

    // Clear additional browser storage that might interfere
    if (typeof window !== 'undefined') {
      // Clear IndexedDB storage (used by some service workers)
      try {
        if ('indexedDB' in window) {
          // Clear any IndexedDB databases that might be related to service workers
          const databases = await indexedDB.databases?.() || [];
          for (const db of databases) {
            if (db.name && (db.name.includes('workbox') || db.name.includes('sw'))) {
              indexedDB.deleteDatabase(db.name);
              console.log('🗑️ Deleted IndexedDB:', db.name);
            }
          }
        }
      } catch (error) {
        console.warn('Could not clear IndexedDB:', error);
      }

      // Set a flag to indicate we've cleaned up
      sessionStorage.setItem('sw-cleaned', 'true');
    }

    console.log('✅ Service worker cleanup complete');
  } catch (error) {
    console.error('❌ Error clearing service worker:', error);
  }
}

/**
 * Prevent service worker registration in development
 */
export function preventServiceWorkerRegistration(): void {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return;
  }

  // Override the service worker registration to prevent new registrations
  if ('serviceWorker' in navigator) {
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = async (...args) => {
      console.warn('🚫 Blocking service worker registration in development mode:', args[0]);
      throw new Error('Service worker registration blocked in development mode');
    };
  }
}