/**
 * Authentication Interceptor for Axios Client
 * Handles automatic Bearer token injection, token refresh, and authentication failures
 */

import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError, AxiosHeaders } from 'axios';
import './types'; // Import type extensions
import { 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken, 
  isValidToken, 
  isTokenExpiringSoon,
  redirectToLogin,
  AUTH_HEADER_NAME 
} from '../auth/auth-client';

export interface AuthInterceptorConfig {
  enableTokenRefresh: boolean;
  tokenRefreshThreshold: number; // seconds before expiry to refresh
  maxRetries: number;
  autoRefresh: boolean;
  refreshEndpoint: string;
}

const DEFAULT_AUTH_CONFIG: AuthInterceptorConfig = {
  enableTokenRefresh: true,
  tokenRefreshThreshold: 300, // 5 minutes
  maxRetries: 3,
  autoRefresh: true,
  refreshEndpoint: '/api/auth/refresh',
};

/**
 * Authentication Interceptor class
 * Manages token injection, refresh, and authentication error handling
 */
export class AuthInterceptor {
  private config: AuthInterceptorConfig;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
  }> = [];

  constructor(config: Partial<AuthInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
  }

  /**
   * Setup authentication interceptors on an axios instance
   */
  setupInterceptors(axiosInstance: AxiosInstance): void {
    // Request interceptor for token injection
    axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    // Response interceptor for token refresh and auth errors
    axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Request interceptor - inject authentication tokens
   */
  private async handleRequest(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const token = getAuthToken();

    if (token && isValidToken(token)) {
      // Check if token is expiring soon and refresh if needed
      if (this.config.autoRefresh && isTokenExpiringSoon(token)) {
        try {
          await this.refreshToken();
          const newToken = getAuthToken();
          if (newToken) {
            this.injectToken(config, newToken);
          }
        } catch (error) {
          console.warn('Token refresh failed during request:', error);
          // Continue with existing token
          this.injectToken(config, token);
        }
      } else {
        this.injectToken(config, token);
      }
    }

    return config;
  }

  /**
   * Request error handler
   */
  private handleRequestError(error: any): Promise<never> {
    return Promise.reject(error);
  }

  /**
   * Response interceptor - handle successful responses
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    return response;
  }

  /**
   * Response error handler - handle authentication failures and token refresh
   */
  private async handleResponseError(error: AxiosError): Promise<any> {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (this.isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          this.failedQueue.push({ resolve, reject });
        }).then(() => {
          return this.retryOriginalRequest(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      this.isRefreshing = true;

      try {
        await this.refreshToken();
        this.processQueue(null);
        return this.retryOriginalRequest(originalRequest);
      } catch (refreshError) {
        this.processQueue(refreshError);
        this.handleAuthenticationFailure();
        return Promise.reject(refreshError);
      } finally {
        this.isRefreshing = false;
      }
    }

    // Handle 403 Forbidden errors
    if (error.response?.status === 403) {
      console.warn('Access forbidden - insufficient permissions');
      // Don't redirect for 403, let the component handle it
    }

    return Promise.reject(error);
  }

  /**
   * Inject authentication token into request headers
   */
  private injectToken(config: InternalAxiosRequestConfig, token: string): void {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers[AUTH_HEADER_NAME] = token;
  }

  /**
   * Refresh authentication token using the auth store
   */
  private async refreshToken(): Promise<void> {
    const currentToken = getAuthToken();
    
    if (!currentToken) {
      throw new Error('No token available for refresh');
    }

    try {
      // Extract refresh token from stored tokens
      const storedTokens = this.getStoredTokens();
      if (!storedTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use the auth store's refresh method for consistency
      if (typeof window !== 'undefined') {
        // Import auth store dynamically to avoid circular dependencies
        const { useAuthStore } = await import('../../stores/auth-store');
        const refreshTokens = useAuthStore.getState().refreshTokens;
        
        await refreshTokens();
        
        // Get the updated token
        const newToken = getAuthToken();
        if (newToken) {
          console.log('Token refreshed successfully via auth store');
        } else {
          throw new Error('No token available after refresh');
        }
      } else {
        // Fallback for server-side or when auth store is not available
        const response = await fetch(this.config.refreshEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedTokens.refreshToken}`,
            [AUTH_HEADER_NAME]: storedTokens.refreshToken,
          },
          body: JSON.stringify({ refreshToken: storedTokens.refreshToken }),
        });

        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.data && (data.data.accessToken || data.data.token)) {
          const newToken = data.data.accessToken || data.data.token;
          const refreshToken = data.data.refreshToken || storedTokens.refreshToken;
          const expiresIn = data.data.expiresIn || 3600; // Default 1 hour
          
          // Update stored tokens
          this.updateStoredTokens({
            accessToken: newToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000),
          });
          
          setAuthToken(newToken);
          console.log('Token refreshed successfully via fallback');
        } else {
          throw new Error('No token in refresh response');
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuthToken();
      this.clearStoredTokens();
      throw error;
    }
  }

  /**
   * Get stored tokens from localStorage
   */
  private getStoredTokens(): { accessToken: string; refreshToken: string; expiresAt: number } | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      return data.state?.tokens || null;
    } catch {
      return null;
    }
  }

  /**
   * Update stored tokens in localStorage
   */
  private updateStoredTokens(tokens: { accessToken: string; refreshToken: string; expiresAt: number }): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.state) {
          data.state.tokens = tokens;
          localStorage.setItem('auth-storage', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Failed to update stored tokens:', error);
    }
  }

  /**
   * Clear stored tokens from localStorage
   */
  private clearStoredTokens(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.state) {
          data.state.tokens = null;
          data.state.isAuthenticated = false;
          data.state.user = null;
          localStorage.setItem('auth-storage', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Failed to clear stored tokens:', error);
    }
  }

  /**
   * Retry the original request with new token
   */
  private async retryOriginalRequest(originalRequest: InternalAxiosRequestConfig): Promise<any> {
    const token = getAuthToken();
    
    if (token && isValidToken(token)) {
      this.injectToken(originalRequest, token);
    }

    // Use the axios instance from the original request
    const axiosInstance = originalRequest.adapter ? 
      originalRequest : 
      { ...originalRequest };

    return new Promise((resolve, reject) => {
      // This is a simplified retry - in practice, you'd use the original axios instance
      fetch(originalRequest.url!, {
        method: originalRequest.method,
        headers: originalRequest.headers as Record<string, string>,
        body: originalRequest.data ? JSON.stringify(originalRequest.data) : undefined,
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => resolve({ data }))
      .catch(reject);
    });
  }

  /**
   * Process queued requests after token refresh
   */
  private processQueue(error: any): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    this.failedQueue = [];
  }

  /**
   * Handle authentication failure - clear tokens and redirect
   */
  private handleAuthenticationFailure(): void {
    clearAuthToken();
    
    // Only redirect if we're in a browser environment
    if (typeof window !== 'undefined') {
      redirectToLogin(window.location.pathname);
    }
  }

  /**
   * Update interceptor configuration
   */
  updateConfig(newConfig: Partial<AuthInterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthInterceptorConfig {
    return { ...this.config };
  }

  /**
   * Check if currently refreshing token
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Get number of queued requests
   */
  getQueuedRequestCount(): number {
    return this.failedQueue.length;
  }

  /**
   * Clear the failed request queue
   */
  clearQueue(): void {
    this.failedQueue = [];
  }
}

/**
 * Create and export default auth interceptor instance
 */
export const authInterceptor = new AuthInterceptor();

/**
 * Helper function to setup auth interceptors on an axios instance
 */
export function setupAuthInterceptors(
  axiosInstance: AxiosInstance, 
  config?: Partial<AuthInterceptorConfig>
): AuthInterceptor {
  const interceptor = new AuthInterceptor(config);
  interceptor.setupInterceptors(axiosInstance);
  return interceptor;
}