import { QuotaApiClient } from './quota-api-client';
import { useAuthStore } from '@/stores/auth-store';

// Re-export for convenience
export { QuotaExceededError as QuotaExceededException, type QuotaValidationResult } from './quota-api-client';

/**
 * Creates a quota API client instance with authentication integration.
 *
 * This factory function creates a properly configured QuotaApiClient that
 * automatically handles authentication tokens from the auth store.
 */
export function createQuotaApiClient(): QuotaApiClient {
  return new QuotaApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    getAuthToken: async () => {
      try {
        // Get a valid access token from the auth store
        const token = await useAuthStore.getState().getValidAccessToken();
        return token;
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    }
  });
}

// Singleton instance for consistent usage across the app
let quotaApiClient: QuotaApiClient | null = null;

/**
 * Gets the singleton quota API client instance.
 *
 * This ensures we use the same client instance throughout the application
 * for consistent configuration and authentication handling.
 */
export function getQuotaApiClient(): QuotaApiClient {
  if (!quotaApiClient) {
    quotaApiClient = createQuotaApiClient();
  }
  return quotaApiClient;
}

/**
 * Resets the singleton instance (useful for testing or auth changes).
 */
export function resetQuotaApiClient(): void {
  quotaApiClient = null;
}