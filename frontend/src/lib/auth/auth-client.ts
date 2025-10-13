/**
 * Client-side authentication utilities
 * Handles token management and middleware integration with axios
 */

import { axiosClient } from '../http/axios-client';
import type { ApiResponse } from '../http/axios-client';

// Auth token header name used by middleware
export const AUTH_HEADER_NAME = 'x-auth-token';

// Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest';
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  familyName?: string;
}

export interface IAuthError extends Error {
  code?: string;
  status?: number;
  field?: string;
}

// Authentication API responses
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Sets authentication token both in localStorage and httpOnly cookie for middleware
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;

  // Store in localStorage for client-side access
  localStorage.setItem('auth-token', token);

  // Set httpOnly cookie for middleware access
  // Note: This should ideally be done server-side for security, but for development we'll use a non-httpOnly cookie
  document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=strict`;

  // Set default headers for future requests
  (window as unknown as { __authToken?: string }).__authToken = token;
}

/**
 * Gets authentication token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

/**
 * Removes authentication token from both localStorage and cookies
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('auth-token');

  // Clear cookie by setting it with past expiration date
  document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=strict';

  delete (window as unknown as { __authToken?: string }).__authToken;
}

/**
 * Validates JWT token structure and expiration
 */
export function isValidToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Decode payload to check expiration
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    return payload.exp && payload.exp > currentTime;
  } catch {
    return false;
  }
}

/**
 * Extracts user information from JWT token payload
 */
export function getUserFromToken(token: string): { id: string; email: string; role: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub || payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if token is expiring soon (within 5 minutes)
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    const fiveMinutesFromNow = currentTime + (5 * 60);

    return payload.exp && payload.exp <= fiveMinutesFromNow;
  } catch {
    return true;
  }
}

/**
 * Gets the remaining time until token expiration in seconds
 */
export function getTokenRemainingTime(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    if (!payload.exp) return 0;

    const remainingTime = payload.exp - currentTime;
    return Math.max(0, remainingTime);
  } catch {
    return 0;
  }
}

/**
 * Checks if token needs refresh based on configurable threshold
 */
export function shouldRefreshToken(token: string, thresholdMinutes: number = 5): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    const thresholdTime = currentTime + (thresholdMinutes * 60);

    return payload.exp && payload.exp <= thresholdTime;
  } catch {
    return true;
  }
}

/**
 * Gets token expiration date
 */
export function getTokenExpirationDate(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return null;

    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

/**
 * Creates an authenticated fetch wrapper that includes auth tokens
 */
export function createAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token && isValidToken(token)) {
      headers['Authorization'] = `Bearer ${token}`;
      // Also set the header that middleware looks for
      headers[AUTH_HEADER_NAME] = token;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };
}

/**
 * Navigation helper that preserves current URL for post-login redirect
 */
export function redirectToLogin(currentPath?: string): void {
  if (typeof window === 'undefined') return;

  const loginUrl = new URL('/auth/login', window.location.origin);
  if (currentPath && currentPath !== '/auth/login') {
    loginUrl.searchParams.set('redirect', currentPath);
  }

  window.location.href = loginUrl.toString();
}

/**
 * Redirect to appropriate dashboard based on user role
 */
export function redirectToDashboard(userRole?: string): void {
  if (typeof window === 'undefined') return;

  let dashboardUrl = '/dashboard';

  if (userRole === 'child') {
    dashboardUrl = '/rooms';
  }

  window.location.href = dashboardUrl;
}

/**
 * Client-side route protection hook
 * Used for components that need to enforce authentication
 */
export function useClientAuth() {
  if (typeof window === 'undefined') return { isAuthenticated: false, token: null, user: null };

  const token = getAuthToken();
  const isAuthenticated = token ? isValidToken(token) : false;
  const user = token && isAuthenticated ? getUserFromToken(token) : null;

  return {
    isAuthenticated,
    token,
    user,
    redirectToLogin: () => redirectToLogin(window.location.pathname),
    redirectToDashboard: () => redirectToDashboard(user?.role),
  };
}

/**
 * Authentication API client using axios
 */
export class AuthClient {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await axiosClient.post<LoginResponse & { success: boolean; message?: string }>(
        '/api/auth/login',
        credentials,
        {
          timeout: 10000, // 10 second timeout for auth requests
          retries: 2, // Retry failed login attempts
        }
      );

      // Debug logging to understand the response structure
      console.log('Login response:', response);
      console.log('Response success:', response.success);
      console.log('Response data:', response.data);

      if (!response.success) {
        throw new AuthError(response.message || 'Login failed');
      }

      // Backend returns login data directly in response, not nested in response.data
      const loginData: LoginResponse = {
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn
      };

      // Validate required fields
      if (!loginData.accessToken || !loginData.refreshToken || !loginData.user) {
        console.error('Missing required fields in login response:', {
          hasAccessToken: !!loginData.accessToken,
          hasRefreshToken: !!loginData.refreshToken,
          hasUser: !!loginData.user,
          fullResponse: response
        });
        throw new AuthError('Incomplete login response - missing required authentication data');
      }

      return loginData;
    } catch (error: any) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });

      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Login failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'LOGIN_FAILED';
      authError.status = error.response?.status;
      authError.field = error.response?.data?.field;
      throw authError;
    }
  }

  /**
   * Register new user account
   */
  async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
    try {
      const response = await axiosClient.post<RegisterResponse & { success: boolean; message?: string }>(
        '/api/auth/register',
        credentials,
        {
          timeout: 15000, // 15 second timeout for registration
          retries: 2,
        }
      );

      if (!response.success) {
        throw new AuthError(response.message || 'Registration failed');
      }

      // Backend returns registration data directly in response, not nested in response.data
      const registerData: RegisterResponse = {
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn
      };

      return registerData;
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Registration failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'REGISTRATION_FAILED';
      authError.status = error.response?.status;
      authError.field = error.response?.data?.field;
      throw authError;
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        await axiosClient.post('/api/auth/logout',
          { refreshToken },
          {
            timeout: 5000, // 5 second timeout for logout
            retries: 1, // Single retry for logout
          }
        );
      }
    } catch (error) {
      // Logout should always succeed locally even if server request fails
      console.warn('Server logout failed, but clearing local session:', error);
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await axiosClient.post<RefreshTokenResponse & { success: boolean; message?: string }>(
        '/api/auth/refresh',
        { refreshToken },
        {
          timeout: 10000, // 10 second timeout for token refresh
          retries: 2,
        }
      );

      if (!response.success) {
        throw new AuthError(response.message || 'Token refresh failed');
      }

      // Backend returns refresh data directly in response, not nested in response.data
      const refreshData: RefreshTokenResponse = {
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn
      };

      return refreshData;
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Token refresh failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'TOKEN_REFRESH_FAILED';
      authError.status = error.response?.status;
      throw authError;
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await axiosClient.post<ApiResponse<void>>(
        '/api/auth/forgot-password',
        { email },
        {
          timeout: 10000,
          retries: 2,
        }
      );

      if (!response.success) {
        throw new AuthError(response.message || 'Password reset request failed');
      }
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Password reset request failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'FORGOT_PASSWORD_FAILED';
      authError.status = error.response?.status;
      throw authError;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const response = await axiosClient.post<ApiResponse<void>>(
        '/api/auth/reset-password',
        { token, newPassword },
        {
          timeout: 10000,
          retries: 2,
        }
      );

      if (!response.success) {
        throw new AuthError(response.message || 'Password reset failed');
      }
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Password reset failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'RESET_PASSWORD_FAILED';
      authError.status = error.response?.status;
      throw authError;
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const response = await axiosClient.post<ApiResponse<void>>(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        {
          timeout: 10000,
          retries: 2,
        }
      );

      if (!response.success) {
        throw new AuthError(response.message || 'Password change failed');
      }
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Password change failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'CHANGE_PASSWORD_FAILED';
      authError.status = error.response?.status;
      throw authError;
    }
  }

  /**
   * Validate current session and get user info
   */
  async validateSession(): Promise<User> {
    try {
      // Backend returns UserResponse directly without success wrapper
      const response = await axiosClient.get<{
        id: string;
        email: string;
        name: string;
        role: string;
        familyId: string;
        createdAt: string;
        updatedAt: string;
      }>(
        '/api/auth/me',
        {
          timeout: 5000,
          retries: 1,
        }
      );

      // Convert backend response to frontend User format
      const userData: User = {
        id: response.id,
        email: response.email,
        name: response.name,
        role: response.role as 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest',
        familyId: response.familyId,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      };

      return userData;
    } catch (error: any) {
      const authError = new AuthError(
        error.response?.data?.message || error.message || 'Session validation failed'
      ) as IAuthError;
      authError.code = error.response?.data?.code || 'SESSION_VALIDATION_FAILED';
      authError.status = error.response?.status;
      throw authError;
    }
  }
}

// Create and export default auth client instance
export const authClient = new AuthClient();

/**
 * Custom AuthError class for better error handling
 */
class AuthError extends Error {
  code?: string;
  status?: number;
  field?: string;

  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Enhanced automatic token refresh setup
 * Should be called once when app initializes
 */
export function setupTokenRefresh(
  refreshCallback: () => Promise<void>,
  options: {
    checkInterval?: number; // in milliseconds
    refreshThreshold?: number; // in minutes
    maxRetries?: number;
    onRefreshSuccess?: () => void;
    onRefreshFailure?: (error: Error) => void;
  } = {}
) {
  if (typeof window === 'undefined') return;

  const {
    checkInterval = 60000, // Check every minute
    refreshThreshold = 5, // Refresh when 5 minutes remaining
    maxRetries = 3,
    onRefreshSuccess,
    onRefreshFailure,
  } = options;

  let retryCount = 0;

  // Check token expiration at specified interval
  const intervalId = setInterval(async () => {
    const token = getAuthToken();

    if (token && shouldRefreshToken(token, refreshThreshold)) {
      try {
        await refreshCallback();
        retryCount = 0; // Reset retry count on success
        onRefreshSuccess?.();
        console.log('Token refreshed automatically');
      } catch (error) {
        retryCount++;
        console.error(`Token refresh failed (attempt ${retryCount}/${maxRetries}):`, error);

        if (retryCount >= maxRetries) {
          console.error('Max token refresh retries exceeded, clearing session');
          clearAuthToken();
          onRefreshFailure?.(error as Error);
          redirectToLogin(window.location.pathname);
        }
      }
    }
  }, checkInterval);

  // Store interval ID for cleanup
  (window as unknown as { __tokenRefreshInterval?: NodeJS.Timeout }).__tokenRefreshInterval = intervalId;

  // Return cleanup function
  return () => {
    const windowWithInterval = window as unknown as { __tokenRefreshInterval?: NodeJS.Timeout };
    if (windowWithInterval.__tokenRefreshInterval) {
      clearInterval(windowWithInterval.__tokenRefreshInterval);
      delete windowWithInterval.__tokenRefreshInterval;
    }
  };
}

/**
 * Legacy token refresh setup for backward compatibility
 */
export function setupLegacyTokenRefresh(refreshCallback: () => Promise<void>) {
  return setupTokenRefresh(refreshCallback);
}