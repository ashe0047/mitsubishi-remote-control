import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types for authentication
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

export interface AuthError {
  message: string;
  code?: string;
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

// Store state interface
export interface AuthStore {
  // Authentication state
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;

  // Token management
  isTokenExpired: () => boolean;
  isTokenExpiringSoon: () => boolean;
  clearTokens: () => void;
  setTokens: (tokens: AuthTokens) => void;

  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  
  // User management
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  
  // Password management
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Session management
  validateSession: () => Promise<boolean>;
  extendSession: () => Promise<void>;
  ensureValidToken: () => Promise<string>;
  getValidAccessToken: () => Promise<string>;
  
  // Loading states for specific actions
  isLoginLoading: boolean;
  isRegisterLoading: boolean;
  isRefreshLoading: boolean;
  isForgotPasswordLoading: boolean;
  isResetPasswordLoading: boolean;
  isChangePasswordLoading: boolean;
}

// Import the new axios-based auth client
import { authClient, isValidToken, isTokenExpiringSoon } from '../lib/auth/auth-client';

// Store creation with persistence
const createAuthStore = () => {
  return create<AuthStore>()(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          isLoginLoading: false,
          isRegisterLoading: false,
          isRefreshLoading: false,
          isForgotPasswordLoading: false,
          isResetPasswordLoading: false,
          isChangePasswordLoading: false,

          // Token management with enhanced validation
          isTokenExpired: () => {
            const tokens = get().tokens;
            if (!tokens?.accessToken) return true;
            
            // Check both stored expiration time and JWT token validity
            const isStoredExpired = Date.now() >= tokens.expiresAt;
            const isJwtValid = isValidToken(tokens.accessToken);
            
            return isStoredExpired || !isJwtValid;
          },

          isTokenExpiringSoon: () => {
            const tokens = get().tokens;
            if (!tokens?.accessToken) return true;
            
            // Check both stored expiration time and JWT token expiration
            const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
            const isStoredExpiringSoon = fiveMinutesFromNow >= tokens.expiresAt;
            const isJwtExpiringSoon = isTokenExpiringSoon(tokens.accessToken);
            
            return isStoredExpiringSoon || isJwtExpiringSoon;
          },

          clearTokens: () => {
            set((state) => {
              state.tokens = null;
              state.isAuthenticated = false;
              state.user = null;
            });
          },

          setTokens: (tokens: AuthTokens) => {
            set((state) => {
              state.tokens = tokens;
              state.isAuthenticated = true;
            });
          },

          // Authentication actions
          login: async (credentials: LoginCredentials) => {
            set((state) => {
              state.isLoginLoading = true;
              state.error = null;
            });

            try {
              const response = await authClient.login(credentials);
              
              const tokens: AuthTokens = {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                expiresAt: Date.now() + (response.expiresIn * 1000),
              };

              set((state) => {
                state.user = response.user;
                state.tokens = tokens;
                state.isAuthenticated = true;
                state.isLoginLoading = false;
                state.error = null;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: error instanceof Error ? error.message : 'Login failed' };
                state.isLoginLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.tokens = null;
              });
              throw error;
            }
          },

          register: async (credentials: RegisterCredentials) => {
            set((state) => {
              state.isRegisterLoading = true;
              state.error = null;
            });

            try {
              const response = await authClient.register(credentials);
              
              const tokens: AuthTokens = {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                expiresAt: Date.now() + (response.expiresIn * 1000),
              };

              set((state) => {
                state.user = response.user;
                state.tokens = tokens;
                state.isAuthenticated = true;
                state.isRegisterLoading = false;
                state.error = null;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: error instanceof Error ? error.message : 'Registration failed' };
                state.isRegisterLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.tokens = null;
              });
              throw error;
            }
          },

          logout: async () => {
            const refreshToken = get().tokens?.refreshToken;
            
            set((state) => {
              state.isLoading = true;
            });

            try {
              if (refreshToken) {
                await authClient.logout(refreshToken);
              }
            } finally {
              set((state) => {
                state.user = null;
                state.tokens = null;
                state.isAuthenticated = false;
                state.isLoading = false;
                state.error = null;
              });
            }
          },

          refreshTokens: async () => {
            const currentTokens = get().tokens;
            if (!currentTokens?.refreshToken) {
              throw new Error('No refresh token available');
            }

            set((state) => {
              state.isRefreshLoading = true;
            });

            try {
              const response = await authClient.refreshToken(currentTokens.refreshToken);
              
              const tokens: AuthTokens = {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                expiresAt: Date.now() + (response.expiresIn * 1000),
              };

              set((state) => {
                state.user = response.user;
                state.tokens = tokens;
                state.isAuthenticated = true;
                state.isRefreshLoading = false;
                state.error = null;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: 'Session expired. Please log in again.' };
                state.isRefreshLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.tokens = null;
              });
              throw error;
            }
          },

          // User management
          updateUser: (updates: Partial<User>) => {
            set((state) => {
              if (state.user) {
                state.user = { ...state.user, ...updates };
              }
            });
          },

          clearError: () => {
            set((state) => {
              state.error = null;
            });
          },

          // Password management
          forgotPassword: async (email: string) => {
            set((state) => {
              state.isForgotPasswordLoading = true;
              state.error = null;
            });

            try {
              await authClient.forgotPassword(email);
              set((state) => {
                state.isForgotPasswordLoading = false;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: error instanceof Error ? error.message : 'Password reset request failed' };
                state.isForgotPasswordLoading = false;
              });
              throw error;
            }
          },

          resetPassword: async (token: string, newPassword: string) => {
            set((state) => {
              state.isResetPasswordLoading = true;
              state.error = null;
            });

            try {
              await authClient.resetPassword(token, newPassword);
              set((state) => {
                state.isResetPasswordLoading = false;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: error instanceof Error ? error.message : 'Password reset failed' };
                state.isResetPasswordLoading = false;
              });
              throw error;
            }
          },

          changePassword: async (currentPassword: string, newPassword: string) => {
            set((state) => {
              state.isChangePasswordLoading = true;
              state.error = null;
            });

            try {
              await authClient.changePassword(currentPassword, newPassword);
              set((state) => {
                state.isChangePasswordLoading = false;
              });
            } catch (error) {
              set((state) => {
                state.error = { message: error instanceof Error ? error.message : 'Password change failed' };
                state.isChangePasswordLoading = false;
              });
              throw error;
            }
          },

          // Session management
          validateSession: async () => {
            const tokens = get().tokens;
            if (!tokens?.accessToken) {
              return false;
            }

            try {
              const user = await authClient.validateSession();
              set((state) => {
                state.user = user;
                state.isAuthenticated = true;
              });
              return true;
            } catch {
              set((state) => {
                state.isAuthenticated = false;
                state.user = null;
                state.tokens = null;
              });
              return false;
            }
          },

          extendSession: async () => {
            const tokens = get().tokens;
            if (!tokens || get().isTokenExpired()) {
              await get().refreshTokens();
            }
          },

          // Enhanced session management
          ensureValidToken: async () => {
            const tokens = get().tokens;
            
            if (!tokens) {
              throw new Error('No authentication tokens available');
            }
            
            if (get().isTokenExpired()) {
              throw new Error('Token has expired');
            }
            
            if (get().isTokenExpiringSoon()) {
              try {
                await get().refreshTokens();
              } catch (error) {
                console.error('Failed to refresh expiring token:', error);
                throw error;
              }
            }
            
            return tokens.accessToken;
          },

          // Get valid access token or refresh if needed
          getValidAccessToken: async () => {
            try {
              return await get().ensureValidToken();
            } catch (error) {
              console.error('Failed to get valid access token:', error);
              get().clearTokens();
              throw error;
            }
          },
        })),
        {
          name: 'auth-storage',
          storage: createJSONStorage(() => localStorage),
          // Only persist essential authentication data
          partialize: (state) => ({
            user: state.user,
            tokens: state.tokens,
            isAuthenticated: state.isAuthenticated,
          }),
          // Skip hydration for SSR compatibility
          skipHydration: true,
        }
      )
    )
  );
};

// Create the auth store hook using Zustand's create function
export const useAuthStore = createAuthStore();

// Export the store type
export type AuthStoreType = typeof useAuthStore;

// Helper function to get initial authentication status
export const getInitialAuthStatus = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem('auth-storage');
  if (!stored) return false;
  
  try {
    const data = JSON.parse(stored);
    return data.state?.isAuthenticated || false;
  } catch {
    return false;
  }
};

export default useAuthStore;