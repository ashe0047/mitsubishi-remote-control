"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuthStore, type User } from '@/stores/auth-store';
import { setAuthToken, clearAuthToken, setupTokenRefresh, getAuthToken, isValidToken } from '@/lib/auth/auth-client';
import { useShallow } from 'zustand/react/shallow';

// Context value interface with proper TypeScript typing
interface AuthContextValue {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Authentication actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, familyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // Session management
  refreshSession: () => Promise<void>;
  clearError: () => void;

  // Loading states for specific actions
  isLoginLoading: boolean;
  isRegisterLoading: boolean;
  isForgotPasswordLoading: boolean;
  isResetPasswordLoading: boolean;
  isChangePasswordLoading: boolean;
}

// Provider props interface
interface AuthProviderProps {
  children: React.ReactNode;
}

// Create the context with proper typing
const AuthContext = createContext<AuthContextValue | null>(null);

// Custom hook to use the auth context with proper error handling
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Zustand store selectors - using specific selectors to avoid infinite loops
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isLoginLoading = useAuthStore((state) => state.isLoginLoading);
  const isRegisterLoading = useAuthStore((state) => state.isRegisterLoading);
  const isForgotPasswordLoading = useAuthStore((state) => state.isForgotPasswordLoading);
  const isResetPasswordLoading = useAuthStore((state) => state.isResetPasswordLoading);
  const isChangePasswordLoading = useAuthStore((state) => state.isChangePasswordLoading);

  // Store methods - use useShallow to create stable references
  const {
    login: loginAction,
    register: registerAction,
    logout: logoutAction,
    forgotPassword: forgotPasswordAction,
    resetPassword: resetPasswordAction,
    changePassword: changePasswordAction,
    refreshTokens: refreshTokensAction,
    clearError: clearErrorAction,
  } = useAuthStore(
    useShallow((state) => ({
      login: state.login,
      register: state.register,
      logout: state.logout,
      forgotPassword: state.forgotPassword,
      resetPassword: state.resetPassword,
      changePassword: state.changePassword,
      refreshTokens: state.refreshTokens,
      clearError: state.clearError,
    }))
  );

  // Initialize authentication state from persisted storage
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      try {
        // Rehydrate the store from localStorage
        await useAuthStore.persist.rehydrate();

        // Get current state after rehydration
        const currentState = useAuthStore.getState();
        const token = getAuthToken();

        if (token && isValidToken(token)) {
          // Set token for API requests
          setAuthToken(token);

          // If we have a valid token but no authenticated state, restore it
          if (!currentState.isAuthenticated && currentState.tokens?.accessToken) {
            console.log('Restoring authenticated state from local storage');
            useAuthStore.setState({
              isAuthenticated: true,
              // Keep existing user and tokens from rehydration
            });
          }

          // Try to validate the session with the server, but don't clear tokens on network errors
          try {
            const isValidSession = await useAuthStore.getState().validateSession();
            if (!isValidSession) {
              console.warn('Session validation failed - likely due to network or server issues. Keeping local tokens.');
              // Don't clear tokens immediately - they might still be valid
              // We'll let the natural token refresh process handle expired tokens
            } else {
              console.log('Session validation successful');
            }
          } catch (error) {
            console.warn('Session validation threw error - likely network/CSP issue. Keeping local tokens:', error);
            // Don't clear tokens on network errors - they might still be valid
            // Ensure we maintain authenticated state if we have valid tokens locally
            if (currentState.tokens?.accessToken && !currentState.isAuthenticated) {
              useAuthStore.setState({ isAuthenticated: true });
            }
          }
        } else {
          // Clear invalid or expired tokens
          clearAuthToken();
        }
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
        clearAuthToken();
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []); // Remove validateSessionAction dependency to prevent infinite loops

  // Setup automatic token refresh with enhanced options
  useEffect(() => {
    const cleanup = setupTokenRefresh(
      async () => {
        try {
          // Use current store reference to avoid dependency issues
          await useAuthStore.getState().refreshTokens();
        } catch (error) {
          console.error('Token refresh failed:', error);
          throw error; // Re-throw to trigger retry logic
        }
      },
      {
        checkInterval: 60000, // Check every minute
        refreshThreshold: 5, // Refresh when 5 minutes remaining
        maxRetries: 3,
        onRefreshSuccess: () => {
          console.log('Token refreshed successfully in AuthProvider');
        },
        onRefreshFailure: (error) => {
          console.error('Token refresh failed permanently:', error);
          // Clear error state if needed using current store reference
          useAuthStore.getState().clearError();
        },
      }
    );

    return cleanup;
  }, []); // Remove store method dependencies to prevent infinite loops

  // Authentication action wrappers with proper error handling and token management
  const login = useCallback(async (email: string, password: string, rememberMe = false): Promise<void> => {
    try {
      await loginAction({ email, password, rememberMe });

      // Set token in client storage after successful login
      const tokens = useAuthStore.getState().tokens;
      if (tokens?.accessToken) {
        setAuthToken(tokens.accessToken);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [loginAction]);

  const register = useCallback(async (name: string, email: string, password: string, familyName?: string): Promise<void> => {
    try {
      await registerAction({ name, email, password, familyName });

      // Set token in client storage after successful registration
      const tokens = useAuthStore.getState().tokens;
      if (tokens?.accessToken) {
        setAuthToken(tokens.accessToken);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }, [registerAction]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutAction();
      clearAuthToken();
    } catch (error) {
      console.error('Logout failed:', error);
      // Always clear local tokens even if server logout fails
      clearAuthToken();
      throw error;
    }
  }, [logoutAction]);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    try {
      await forgotPasswordAction(email);
    } catch (error) {
      console.error('Forgot password failed:', error);
      throw error;
    }
  }, [forgotPasswordAction]);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<void> => {
    try {
      await resetPasswordAction(token, newPassword);
    } catch (error) {
      console.error('Reset password failed:', error);
      throw error;
    }
  }, [resetPasswordAction]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await changePasswordAction(currentPassword, newPassword);
    } catch (error) {
      console.error('Change password failed:', error);
      throw error;
    }
  }, [changePasswordAction]);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await refreshTokensAction();

      // Update client token after refresh
      const tokens = useAuthStore.getState().tokens;
      if (tokens?.accessToken) {
        setAuthToken(tokens.accessToken);
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      clearAuthToken();
      throw error;
    }
  }, [refreshTokensAction]);

  const clearError = useCallback((): void => {
    clearErrorAction();
  }, [clearErrorAction]);

  // Context value with proper typing
  const contextValue: AuthContextValue = {
    // State
    user,
    isAuthenticated,
    isLoading: isLoading || !isInitialized,
    error: error?.message || null,

    // Actions
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    refreshSession,
    clearError,

    // Loading states
    isLoginLoading,
    isRegisterLoading,
    isForgotPasswordLoading,
    isResetPasswordLoading,
    isChangePasswordLoading,
  };

  // Show loading spinner while initializing
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// HOC for protecting routes that require authentication
interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  fallback,
  redirectTo = '/auth/login'
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated (handled by middleware, but keeping as fallback)
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const loginUrl = new URL(redirectTo, window.location.origin);
      if (currentPath !== redirectTo) {
        loginUrl.searchParams.set('redirect', currentPath);
      }
      window.location.href = loginUrl.toString();
    }
    return fallback || null;
  }

  return <>{children}</>;
};

// HOC for protecting routes that require specific roles
interface RequireRoleProps {
  children: React.ReactNode;
  role: 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest';
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  children,
  role,
  fallback,
  redirectTo = '/unauthorized'
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check authentication and role
  if (!isAuthenticated || !user || user.role !== role) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return fallback || null;
  }

  return <>{children}</>;
};

export default AuthProvider;