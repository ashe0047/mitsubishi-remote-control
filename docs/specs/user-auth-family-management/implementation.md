# User Authentication & Family Management - Implementation Plan

## 1. Implementation Overview

This implementation plan provides step-by-step instructions for building the complete user authentication and family management system. The plan includes detailed file creation, Context7 integration for latest library documentation, and interactive feedback checkpoints throughout the development process.

### 1.1 Implementation Phases

**Phase 1**: Authentication Foundation (Days 1-3)
- JWT token management system
- Authentication stores and middleware
- Login/register pages
- Route protection

**Phase 2**: Family Management Core (Days 4-6)
- Family store implementation
- Family member management UI
- Room assignment interfaces
- User profile management

**Phase 3**: Quota Configuration Integration (Days 7-9)
- Quota setup forms
- Parent dashboard
- Enhanced existing components with user context
- Real-time updates integration

**Phase 4**: Testing & Polish (Days 10-12)
- Comprehensive testing
- Performance optimization
- User experience refinements
- Production deployment preparation

---

## 2. Prerequisites & Environment Setup

### 2.1 Required Dependencies Installation

**Install Authentication & Form Dependencies**:
```bash
cd frontend
pnpm add @hookform/resolvers zod react-hook-form next-auth jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

**Install State Management Dependencies**:
```bash
pnpm add zustand immer
```

**Install UI/Form Components** (if not already installed):
```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-form @radix-ui/react-toast
```

### 2.2 Context7 Documentation Requirements

Based on Context7 integration, we'll reference the following library documentation during implementation:

- **Next.js** (`/vercel/next.js`): Authentication middleware, route protection patterns
- **React Hook Form** (`/react-hook-form/react-hook-form`): Form validation with Zod resolvers
- **Zustand** (`/pmndrs/zustand`): State management with persistence middleware
- **Zod** (`/colinhacks/zod`): Schema validation for forms and API data

---

## 3. Phase 1: Authentication Foundation (Days 1-3)

### 3.1 Day 1: JWT Token Management & Auth Store

#### 3.1.1 Create Authentication Types

**File**: `frontend/src/types/auth.ts`
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'PARENT' | 'CHILD';
  householdId: string;
  assignedRooms?: string[];
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

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  familyName?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

#### 3.1.2 Create Authentication API Client

**File**: `frontend/src/lib/api/auth-client.ts`
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

class AuthApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // For refresh token cookies
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshTokens(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
    });
  }

  async logout(): Promise<void> {
    await this.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async resetPassword(email: string): Promise<void> {
    await this.request<void>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async updatePassword(token: string, password: string): Promise<void> {
    await this.request<void>('/api/auth/update-password', {
      method: 'PUT',
      body: JSON.stringify({ token, password }),
    });
  }
}

export const authApiClient = new AuthApiClient();
```

#### 3.1.3 Create Zustand Authentication Store

**Context7 Reference**: Using Zustand persistence patterns from `/pmndrs/zustand`

**File**: `frontend/src/stores/auth-store.ts`
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { User, AuthTokens, LoginCredentials, RegisterData, AuthState } from '@/types/auth';
import { authApiClient } from '@/lib/api/auth-client';

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Selectors
  getCurrentUserId: () => string | null;
  getUserRole: () => 'PARENT' | 'CHILD' | null;
  getHouseholdId: () => string | null;
  hasPermission: (permission: string) => boolean;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: async (credentials: LoginCredentials) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authApiClient.login(credentials);
            
            set((state) => {
              state.user = response.user;
              state.tokens = response.tokens;
              state.isAuthenticated = true;
              state.isLoading = false;
            });

            // Store refresh token in httpOnly cookie happens automatically
            // Access token is stored in memory for security
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Login failed';
              state.isLoading = false;
            });
            throw error;
          }
        },

        register: async (data: RegisterData) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authApiClient.register(data);
            
            set((state) => {
              state.user = response.user;
              state.tokens = response.tokens;
              state.isAuthenticated = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Registration failed';
              state.isLoading = false;
            });
            throw error;
          }
        },

        logout: async () => {
          try {
            await authApiClient.logout();
          } catch (error) {
            // Continue with logout even if API call fails
            console.error('Logout API call failed:', error);
          }

          set((state) => {
            state.user = null;
            state.tokens = null;
            state.isAuthenticated = false;
            state.error = null;
          });
        },

        refreshTokens: async () => {
          try {
            const response = await authApiClient.refreshTokens();
            
            set((state) => {
              state.user = response.user;
              state.tokens = response.tokens;
              state.isAuthenticated = true;
            });

            return true;
          } catch (error) {
            set((state) => {
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
              state.error = 'Session expired';
            });
            return false;
          }
        },

        updateProfile: async (updates: Partial<User>) => {
          const currentUser = get().user;
          if (!currentUser) return;

          try {
            // API call would be made here
            set((state) => {
              if (state.user) {
                Object.assign(state.user, updates);
              }
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Profile update failed';
            });
            throw error;
          }
        },

        resetPassword: async (email: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await authApiClient.resetPassword(email);
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Password reset failed';
              state.isLoading = false;
            });
            throw error;
          }
        },

        setUser: (user: User | null) => {
          set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
          });
        },

        setTokens: (tokens: AuthTokens | null) => {
          set((state) => {
            state.tokens = tokens;
          });
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        // Selectors
        getCurrentUserId: () => {
          return get().user?.id || null;
        },

        getUserRole: () => {
          return get().user?.role || null;
        },

        getHouseholdId: () => {
          return get().user?.householdId || null;
        },

        hasPermission: (permission: string) => {
          const user = get().user;
          if (!user) return false;

          // Basic role-based permissions
          const parentPermissions = [
            'manage:family',
            'create:quotas',
            'manage:rooms',
            'view:usage:all',
            'grant:overrides',
          ];

          const childPermissions = [
            'view:usage:own',
            'request:override',
          ];

          const userPermissions = user.role === 'PARENT' ? parentPermissions : childPermissions;
          return userPermissions.includes(permission);
        },
      })),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        // Only persist user data, not sensitive tokens
        partialize: (state) => ({ 
          user: state.user,
          isAuthenticated: state.isAuthenticated 
        }),
      }
    )
  )
);

// Helper hooks for common selectors
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
export const useHasPermission = (permission: string) => 
  useAuthStore((state) => state.hasPermission(permission));
```

**FEEDBACK CHECKPOINT**: After implementing authentication foundation, we'll use the feedback tool to review progress and get approval before proceeding.

### 3.2 Day 2: Next.js Middleware & Route Protection

#### 3.2.1 Create Next.js Middleware for Route Protection

**Context7 Reference**: Using Next.js middleware patterns from `/vercel/next.js`

**File**: `frontend/middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';

// Define route categories
const publicRoutes = ['/auth/login', '/auth/register', '/auth/reset-password', '/'];
const protectedRoutes = ['/dashboard', '/family', '/quotas', '/rooms', '/profile'];
const parentOnlyRoutes = ['/family', '/quotas/create', '/rooms/assign'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // Check for authentication token in cookies
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const accessToken = request.cookies.get('accessToken')?.value; // If stored in cookies
  
  const isAuthenticated = !!(refreshToken || accessToken);
  const isPublicRoute = publicRoutes.includes(pathname) || pathname === '/';
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isParentOnlyRoute = parentOnlyRoutes.some(route => pathname.startsWith(route));

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth pages to dashboard
  if (isAuthenticated && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For parent-only routes, we'll handle role checking in components
  // since we can't easily decode JWT in Edge Runtime
  if (isParentOnlyRoute && isAuthenticated) {
    // Let the component handle role-based access control
    // We'll add a header to indicate this needs role checking
    const response = NextResponse.next();
    response.headers.set('X-Requires-Parent-Role', 'true');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

#### 3.2.2 Create Authentication Context Provider

**File**: `frontend/src/providers/AuthProvider.tsx`
```typescript
'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authStore = useAuthStore();

  // Initialize authentication on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Check if we have stored user data
      if (authStore.user && !authStore.tokens) {
        // Try to refresh tokens
        await authStore.refreshTokens();
      }
    };

    initializeAuth();
  }, [authStore]);

  // Set up automatic token refresh
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (authStore.tokens?.expiresAt) {
      const timeUntilExpiry = authStore.tokens.expiresAt - Date.now();
      const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 1000); // 5 minutes before expiry

      refreshInterval = setTimeout(async () => {
        await authStore.refreshTokens();
      }, refreshTime);
    }

    return () => {
      if (refreshInterval) {
        clearTimeout(refreshInterval);
      }
    };
  }, [authStore.tokens?.expiresAt]);

  const contextValue: AuthContextValue = {
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    login: authStore.login,
    logout: authStore.logout,
    hasPermission: authStore.hasPermission,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### 3.2.3 Create Route Guard Components

**File**: `frontend/src/components/auth/AuthGuard.tsx`
```typescript
'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: 'PARENT' | 'CHILD';
  fallback?: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredRole,
  fallback
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const loginUrl = `/auth/login?redirect=${encodeURIComponent(pathname)}`;
      router.push(loginUrl);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  // Show loading state
  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return fallback || null;
  }

  // Check role requirements
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6">
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            This page requires {requiredRole.toLowerCase()} privileges.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Convenience components for specific roles
export const ParentGuard: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AuthGuard requiredRole="PARENT">{children}</AuthGuard>
);

export const ChildGuard: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AuthGuard requiredRole="CHILD">{children}</AuthGuard>
);
```

### 3.3 Day 3: Authentication UI Components

#### 3.3.1 Create Login Form Component

**Context7 Reference**: Using React Hook Form with Zod resolver from documentation

**File**: `frontend/src/components/auth/LoginForm.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

// Zod validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  
  const { login, isLoading } = useAuth();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setApiError(null);
      await login(data);
      router.push(redirectTo);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your AC control dashboard
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...form.register('email')}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                {...form.register('password')}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={form.watch('rememberMe')}
              onCheckedChange={(checked) => form.setValue('rememberMe', !!checked)}
              disabled={isLoading}
            />
            <Label
              htmlFor="rememberMe"
              className="text-sm font-normal cursor-pointer"
            >
              Remember me
            </Label>
          </div>

          {apiError && (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link
            href="/auth/reset-password"
            className="text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link
            href="/auth/register"
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 3.3.2 Create Registration Form Component

**File**: `frontend/src/components/auth/RegisterForm.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

// Registration schema with password confirmation
const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  name: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Name must be at least 2 characters'),
  familyName: z
    .string()
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuth();
  
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      familyName: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setApiError(null);
      await registerUser(data);
      router.push('/dashboard');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Registration failed');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription>
          Set up your family AC control system
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              {...form.register('name')}
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="familyName">Family Name (Optional)</Label>
            <Input
              id="familyName"
              placeholder="e.g., Smith Family"
              {...form.register('familyName')}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              This will be used to name your family group
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...form.register('email')}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                {...form.register('password')}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                {...form.register('confirmPassword')}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {apiError && (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link
            href="/auth/login"
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 3.3.3 Create Authentication Pages

**File**: `frontend/src/app/auth/login/page.tsx`
```typescript
import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <LoginForm />
    </div>
  );
}
```

**File**: `frontend/src/app/auth/register/page.tsx`
```typescript
import React from 'react';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <RegisterForm />
    </div>
  );
}
```

**FEEDBACK CHECKPOINT 1**: After completing Phase 1, use the interactive feedback tool to review the authentication foundation implementation and get approval before proceeding to Phase 2.

---

## 4. Phase 2: Family Management Core (Days 4-6)

### 4.1 Day 4: Family Store & API Integration

#### 4.1.1 Create Family Management Types

**File**: `frontend/src/types/family.ts`
```typescript
export interface FamilyMember extends User {
  invitationStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedAt?: string;
  joinedAt?: string;
}

export interface FamilyInvitation {
  id: string;
  email: string;
  role: 'PARENT' | 'CHILD';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token?: string;
}

export interface RoomAssignment {
  userId: string;
  roomId: string;
  roomName: string;
  accessLevel: 'VIEW_ONLY' | 'CONTROL' | 'ADMIN';
  assignedAt: string;
}

export interface FamilyState {
  familyMembers: FamilyMember[];
  roomAssignments: Record<string, RoomAssignment[]>; // userId -> assignments
  invitations: FamilyInvitation[];
  isLoadingMembers: boolean;
  isLoadingAssignments: boolean;
  error: string | null;
}
```

#### 4.1.2 Create Family API Client

**File**: `frontend/src/lib/api/family-client.ts`
```typescript
import { FamilyMember, FamilyInvitation, RoomAssignment } from '@/types/family';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface AddFamilyMemberRequest {
  email: string;
  fullName: string;
  role: 'PARENT' | 'CHILD';
  roomIds?: string[];
}

interface UpdateRoomAssignmentsRequest {
  roomIds: string[];
}

class FamilyApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Get access token from auth store
    const accessToken = localStorage.getItem('accessToken'); // Or from auth store
    
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async getFamilyMembers(): Promise<FamilyMember[]> {
    return this.request<FamilyMember[]>('/api/users');
  }

  async addFamilyMember(data: AddFamilyMemberRequest): Promise<FamilyMember> {
    return this.request<FamilyMember>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFamilyMember(userId: string, updates: Partial<FamilyMember>): Promise<FamilyMember> {
    return this.request<FamilyMember>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async removeFamilyMember(userId: string): Promise<void> {
    await this.request<void>(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getUserRoomAssignments(userId: string): Promise<RoomAssignment[]> {
    return this.request<RoomAssignment[]>(`/api/users/${userId}/rooms`);
  }

  async updateRoomAssignments(userId: string, assignments: UpdateRoomAssignmentsRequest): Promise<void> {
    await this.request<void>(`/api/users/${userId}/rooms`, {
      method: 'PUT',
      body: JSON.stringify(assignments),
    });
  }

  async sendFamilyInvitation(email: string, role: 'PARENT' | 'CHILD'): Promise<FamilyInvitation> {
    return this.request<FamilyInvitation>('/api/family/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async getFamilyInvitations(): Promise<FamilyInvitation[]> {
    return this.request<FamilyInvitation[]>('/api/family/invitations');
  }
}

export const familyApiClient = new FamilyApiClient();
```

#### 4.1.3 Create Family Management Store

**File**: `frontend/src/stores/family-store.ts`
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { FamilyMember, FamilyInvitation, RoomAssignment, FamilyState } from '@/types/family';
import { familyApiClient } from '@/lib/api/family-client';

interface FamilyActions {
  loadFamilyMembers: () => Promise<void>;
  addFamilyMember: (data: AddFamilyMemberRequest) => Promise<void>;
  updateFamilyMember: (userId: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeFamilyMember: (userId: string) => Promise<void>;
  loadRoomAssignments: (userId: string) => Promise<void>;
  updateRoomAssignments: (userId: string, roomIds: string[]) => Promise<void>;
  sendInvitation: (email: string, role: 'PARENT' | 'CHILD') => Promise<void>;
  loadInvitations: () => Promise<void>;
  setError: (error: string | null) => void;
  
  // Selectors
  getFamilyMember: (userId: string) => FamilyMember | null;
  getUserRooms: (userId: string) => string[];
  getChildrenUsers: () => FamilyMember[];
  getParentUsers: () => FamilyMember[];
  canUserAccessRoom: (userId: string, roomId: string) => boolean;
}

type FamilyStore = FamilyState & FamilyActions;

export const useFamilyStore = create<FamilyStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      familyMembers: [],
      roomAssignments: {},
      invitations: [],
      isLoadingMembers: false,
      isLoadingAssignments: false,
      error: null,

      // Actions
      loadFamilyMembers: async () => {
        set((state) => {
          state.isLoadingMembers = true;
          state.error = null;
        });

        try {
          const members = await familyApiClient.getFamilyMembers();
          set((state) => {
            state.familyMembers = members;
            state.isLoadingMembers = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load family members';
            state.isLoadingMembers = false;
          });
        }
      },

      addFamilyMember: async (data: AddFamilyMemberRequest) => {
        try {
          const newMember = await familyApiClient.addFamilyMember(data);
          set((state) => {
            state.familyMembers.push(newMember);
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to add family member';
          });
          throw error;
        }
      },

      updateFamilyMember: async (userId: string, updates: Partial<FamilyMember>) => {
        try {
          const updatedMember = await familyApiClient.updateFamilyMember(userId, updates);
          set((state) => {
            const index = state.familyMembers.findIndex(m => m.id === userId);
            if (index >= 0) {
              state.familyMembers[index] = updatedMember;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to update family member';
          });
          throw error;
        }
      },

      removeFamilyMember: async (userId: string) => {
        try {
          await familyApiClient.removeFamilyMember(userId);
          set((state) => {
            state.familyMembers = state.familyMembers.filter(m => m.id !== userId);
            delete state.roomAssignments[userId];
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to remove family member';
          });
          throw error;
        }
      },

      loadRoomAssignments: async (userId: string) => {
        set((state) => {
          state.isLoadingAssignments = true;
        });

        try {
          const assignments = await familyApiClient.getUserRoomAssignments(userId);
          set((state) => {
            state.roomAssignments[userId] = assignments;
            state.isLoadingAssignments = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load room assignments';
            state.isLoadingAssignments = false;
          });
        }
      },

      updateRoomAssignments: async (userId: string, roomIds: string[]) => {
        try {
          await familyApiClient.updateRoomAssignments(userId, { roomIds });
          // Reload assignments to get updated data
          await get().loadRoomAssignments(userId);
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to update room assignments';
          });
          throw error;
        }
      },

      sendInvitation: async (email: string, role: 'PARENT' | 'CHILD') => {
        try {
          const invitation = await familyApiClient.sendFamilyInvitation(email, role);
          set((state) => {
            state.invitations.push(invitation);
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to send invitation';
          });
          throw error;
        }
      },

      loadInvitations: async () => {
        try {
          const invitations = await familyApiClient.getFamilyInvitations();
          set((state) => {
            state.invitations = invitations;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load invitations';
          });
        }
      },

      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
        });
      },

      // Selectors
      getFamilyMember: (userId: string) => {
        return get().familyMembers.find(m => m.id === userId) || null;
      },

      getUserRooms: (userId: string) => {
        const assignments = get().roomAssignments[userId] || [];
        return assignments.map(a => a.roomId);
      },

      getChildrenUsers: () => {
        return get().familyMembers.filter(m => m.role === 'CHILD');
      },

      getParentUsers: () => {
        return get().familyMembers.filter(m => m.role === 'PARENT');
      },

      canUserAccessRoom: (userId: string, roomId: string) => {
        const assignments = get().roomAssignments[userId] || [];
        return assignments.some(a => a.roomId === roomId);
      },
    }))
  )
);

// Helper hooks for common use cases
export const useFamilyMembers = () => useFamilyStore(state => state.familyMembers);
export const useChildrenUsers = () => useFamilyStore(state => state.getChildrenUsers());
export const useUserRooms = (userId: string) => useFamilyStore(state => state.getUserRooms(userId));
```

**FEEDBACK CHECKPOINT 2**: After implementing family store and API integration, use the feedback tool to review progress and get approval before continuing with UI components.

### 4.2 Day 5: Family Management UI Components

#### 4.2.1 Create Family Dashboard Component

**File**: `frontend/src/components/family/FamilyDashboard.tsx`
```typescript
'use client';

import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Settings, 
  Clock, 
  Home,
  Shield,
  AlertCircle
} from 'lucide-react';
import { useFamilyStore, useFamilyMembers, useChildrenUsers } from '@/stores/family-store';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

export const FamilyDashboard: React.FC = () => {
  const { user } = useAuth();
  const familyMembers = useFamilyMembers();
  const childrenUsers = useChildrenUsers();
  const { loadFamilyMembers, isLoadingMembers, error } = useFamilyStore();

  useEffect(() => {
    loadFamilyMembers();
  }, [loadFamilyMembers]);

  if (isLoadingMembers) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Family Management</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const isParent = user?.role === 'PARENT';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Family Management</h1>
        </div>
        
        {isParent && (
          <Button asChild>
            <Link href="/family/invite">
              <Plus className="h-4 w-4 mr-2" />
              Add Family Member
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{familyMembers.length}</p>
                <p className="text-sm text-muted-foreground">Family Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{childrenUsers.length}</p>
                <p className="text-sm text-muted-foreground">Children</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">Active</p>
                <p className="text-sm text-muted-foreground">Quotas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Home className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Rooms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Family Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Family Members</CardTitle>
            {isParent && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/rooms/assign">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Rooms
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      <Badge variant={member.role === 'PARENT' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {member.id === user?.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.assignedRooms && member.assignedRooms.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {member.assignedRooms.length} rooms
                    </Badge>
                  )}
                  
                  {isParent && member.id !== user?.id && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/family/${member.id}`}>
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {familyMembers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No family members yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start by adding your family members to manage their AC access
                </p>
                {isParent && (
                  <Button asChild>
                    <Link href="/family/invite">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Member
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {isParent && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/quotas/create">
                  <Clock className="h-4 w-4 mr-2" />
                  Set Up Quotas
                </Link>
              </Button>
              
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/rooms/assign">
                  <Home className="h-4 w-4 mr-2" />
                  Assign Rooms
                </Link>
              </Button>
              
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/family/invite">
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Activity tracking coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FamilyDashboard;
```

#### 4.2.2 Create Add Family Member Form

**File**: `frontend/src/components/family/AddFamilyMemberForm.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { useFamilyStore } from '@/stores/family-store';
import Link from 'next/link';

// Add member form schema
const addMemberSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Name must be at least 2 characters'),
  role: z.enum(['PARENT', 'CHILD'], {
    required_error: 'Please select a role',
  }),
  roomIds: z.array(z.string()).optional(),
});

type AddMemberFormData = z.infer<typeof addMemberSchema>;

// Mock room data - in real app, this would come from configuration
const availableRooms = [
  { id: 'living-room', name: 'Living Room' },
  { id: 'bedroom-1', name: 'Master Bedroom' },
  { id: 'bedroom-2', name: 'Child Bedroom' },
  { id: 'office', name: 'Office' },
];

export const AddFamilyMemberForm: React.FC = () => {
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();
  
  const { addFamilyMember, isLoadingMembers } = useFamilyStore();
  
  const form = useForm<AddMemberFormData>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'CHILD',
      roomIds: [],
    },
  });

  const selectedRole = form.watch('role');
  const selectedRooms = form.watch('roomIds') || [];

  const onSubmit = async (data: AddMemberFormData) => {
    try {
      setApiError(null);
      await addFamilyMember(data);
      router.push('/family');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to add family member');
    }
  };

  const toggleRoom = (roomId: string) => {
    const currentRooms = selectedRooms;
    const updatedRooms = currentRooms.includes(roomId)
      ? currentRooms.filter(id => id !== roomId)
      : [...currentRooms, roomId];
    
    form.setValue('roomIds', updatedRooms);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/family">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Family
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <UserPlus className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Add Family Member</h1>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invite New Family Member</CardTitle>
          <CardDescription>
            Add a new family member to your AC control system. They'll receive an email invitation to join.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  {...form.register('fullName')}
                  disabled={isLoadingMembers}
                />
                {form.formState.errors.fullName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  {...form.register('email')}
                  disabled={isLoadingMembers}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  They'll receive an invitation email to join your family
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  onValueChange={(value) => form.setValue('role', value as 'PARENT' | 'CHILD')}
                  defaultValue={selectedRole}
                  disabled={isLoadingMembers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARENT">
                      Parent - Full control and management access
                    </SelectItem>
                    <SelectItem value="CHILD">
                      Child - Limited access with quota restrictions
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.role && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.role.message}
                  </p>
                )}
              </div>
            </div>

            {/* Room Access */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Room Access</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedRole === 'PARENT' 
                    ? 'Parents have access to all rooms by default'
                    : 'Select which rooms this child can control'
                  }
                </p>
              </div>

              {selectedRole === 'CHILD' && (
                <div className="grid gap-3 md:grid-cols-2">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg"
                    >
                      <Checkbox
                        id={room.id}
                        checked={selectedRooms.includes(room.id)}
                        onCheckedChange={() => toggleRoom(room.id)}
                        disabled={isLoadingMembers}
                      />
                      <Label
                        htmlFor={room.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {room.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {selectedRole === 'PARENT' && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    As a parent, this member will have access to all rooms and can manage family settings.
                  </p>
                </div>
              )}
            </div>

            {apiError && (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isLoadingMembers}>
                {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Invitation
              </Button>
              
              <Button type="button" variant="outline" asChild>
                <Link href="/family">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddFamilyMemberForm;
```

**FEEDBACK CHECKPOINT 3**: After implementing family management UI, use the feedback tool to review the components and get approval before proceeding to Phase 3.

### 4.3 Day 6: Room Assignment Interface

#### 4.3.1 Create Room Assignment Component

**File**: `frontend/src/components/family/RoomAssignmentManager.tsx`
```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Home, 
  ArrowLeft, 
  Save, 
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useFamilyStore, useFamilyMembers } from '@/stores/family-store';
import Link from 'next/link';

// Mock room data - would come from app configuration in real implementation
const availableRooms = [
  { 
    id: 'living-room', 
    name: 'Living Room',
    description: 'Main family space',
    icon: '🛋️'
  },
  { 
    id: 'bedroom-1', 
    name: 'Master Bedroom',
    description: 'Parent bedroom',
    icon: '🛏️'
  },
  { 
    id: 'bedroom-2', 
    name: 'Child Bedroom',
    description: 'Kids bedroom',
    icon: '🧸'
  },
  { 
    id: 'office', 
    name: 'Office',
    description: 'Work space',
    icon: '💻'
  },
  { 
    id: 'kitchen', 
    name: 'Kitchen',
    description: 'Cooking area',
    icon: '🍳'
  },
];

export const RoomAssignmentManager: React.FC = () => {
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const familyMembers = useFamilyMembers();
  const { 
    loadFamilyMembers, 
    loadRoomAssignments, 
    updateRoomAssignments,
    isLoadingMembers,
    error 
  } = useFamilyStore();

  // Filter to only show children (parents have access to all rooms by default)
  const childMembers = familyMembers.filter(member => member.role === 'CHILD');

  useEffect(() => {
    loadFamilyMembers();
  }, [loadFamilyMembers]);

  useEffect(() => {
    // Load room assignments for all children
    const loadAllAssignments = async () => {
      const assignmentsMap: Record<string, string[]> = {};
      
      for (const member of childMembers) {
        await loadRoomAssignments(member.id);
        // This would come from the store in real implementation
        assignmentsMap[member.id] = member.assignedRooms || [];
      }
      
      setAssignments(assignmentsMap);
    };

    if (childMembers.length > 0) {
      loadAllAssignments();
    }
  }, [childMembers, loadRoomAssignments]);

  const toggleRoomAssignment = (userId: string, roomId: string) => {
    setAssignments(prev => {
      const userRooms = prev[userId] || [];
      const updatedRooms = userRooms.includes(roomId)
        ? userRooms.filter(id => id !== roomId)
        : [...userRooms, roomId];
      
      return {
        ...prev,
        [userId]: updatedRooms
      };
    });
  };

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Update assignments for each child
      for (const [userId, roomIds] of Object.entries(assignments)) {
        await updateRoomAssignments(userId, roomIds);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save room assignments');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoomName = (roomId: string) => {
    return availableRooms.find(room => room.id === roomId)?.name || roomId;
  };

  if (isLoadingMembers) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Home className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Room Assignments</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/family">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Family
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Home className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Room Assignments</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Room assignments saved successfully!</AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manage Room Access</CardTitle>
          <CardDescription>
            Control which rooms each child can access. Parents have access to all rooms by default.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {childMembers.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No children to assign rooms</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add child members to your family first to manage their room access.
              </p>
              <Button asChild>
                <Link href="/family/invite">Add Child Member</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {childMembers.map((child) => (
                <Card key={child.id} className="border-2">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {child.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{child.name}</h3>
                          <p className="text-sm text-muted-foreground">{child.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">CHILD</Badge>
                        <Badge variant="outline">
                          {assignments[child.id]?.length || 0} rooms
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {availableRooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`${child.id}-${room.id}`}
                            checked={assignments[child.id]?.includes(room.id) || false}
                            onCheckedChange={() => toggleRoomAssignment(child.id, room.id)}
                            disabled={isSaving}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`${child.id}-${room.id}`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <span className="text-lg">{room.icon}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{room.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {room.description}
                                </p>
                              </div>
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>

                    {assignments[child.id]?.length === 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          No rooms assigned - this child won't be able to control any AC units.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleSaveAssignments} 
                  disabled={isSaving}
                  size="lg"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Save className="h-4 w-4 mr-2" />
                  Save Room Assignments
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomAssignmentManager;
```

**FEEDBACK CHECKPOINT 4**: After completing family management components, use the feedback tool to review the complete family management system and get approval before proceeding to Phase 3.

---

## 5. Interactive Feedback Integration

### 5.1 Feedback Checkpoints Schedule

Throughout the implementation, we'll use the interactive feedback tool at key milestones:

1. **After Phase 1 completion** (Day 3): Authentication foundation review
2. **After Phase 2.1 completion** (Day 4): Family store and API integration review  
3. **After Phase 2.2 completion** (Day 5): Family management UI review
4. **After Phase 2.3 completion** (Day 6): Room assignment interface review
5. **After Phase 3 completion** (Day 9): Complete integration review
6. **After Phase 4 completion** (Day 12): Final implementation review

### 5.2 Feedback Implementation Pattern

Each feedback checkpoint will use this pattern:

```typescript
// Example feedback call after completing a major component
await mcp__mcp-feedback-enhanced__interactive_feedback({
  project_directory: "/mnt/drive/codebases/apps/mitsubishi-remote-control/frontend",
  summary: `
  Completed Phase 1: Authentication Foundation
  
  ✅ Implemented:
  - JWT token management with Zustand store
  - Next.js middleware for route protection  
  - Login/Register forms with Zod validation
  - Authentication context and guards
  - Integration with existing quota system
  
  📁 Files Created:
  - stores/auth-store.ts - Authentication state management
  - middleware.ts - Route protection
  - components/auth/ - Login/register forms
  - lib/api/auth-client.ts - API integration
  
  🔄 Next Steps:
  - Family management store and API
  - Family dashboard and member management
  - Room assignment interfaces
  
  Please review the authentication implementation and provide feedback for any adjustments before proceeding to family management features.
  `,
  timeout: 600
});
```

### 5.3 Context7 Documentation Integration

For each implementation phase, we'll fetch the latest documentation:

**During Authentication Implementation**:
```typescript
// Fetch Next.js middleware documentation
const nextjsDocs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/vercel/next.js",
  topic: "middleware authentication route protection",
  tokens: 2000
});

// Use patterns from documentation in implementation
```

**During Form Implementation**:
```typescript  
// Fetch React Hook Form + Zod integration docs
const hookFormDocs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/react-hook-form/react-hook-form", 
  topic: "zod resolver validation",
  tokens: 1500
});
```

**During State Management**:
```typescript
// Fetch Zustand persistence documentation
const zustandDocs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/pmndrs/zustand",
  topic: "persistence middleware authentication",
  tokens: 1500  
});
```

---

## 6. Success Criteria & Validation

### 6.1 Phase 1 Success Criteria
- [ ] JWT token management working with automatic refresh
- [ ] Route protection preventing unauthorized access
- [ ] Login/register forms with proper validation
- [ ] Integration with existing quota components
- [ ] User context properly injected throughout app

### 6.2 Phase 2 Success Criteria  
- [ ] Family members can be added/managed via UI
- [ ] Room assignments working with backend API
- [ ] Parent/child role restrictions enforced
- [ ] Real-time family data updates
- [ ] Proper error handling and loading states

### 6.3 Phase 3 Success Criteria
- [ ] Quota setup forms integrated with user context
- [ ] Parent dashboard shows family quota overview
- [ ] Existing quota components work with real user IDs
- [ ] WebSocket updates work with authenticated users
- [ ] Override requests properly handled

### 6.4 Phase 4 Success Criteria
- [ ] All user flows tested end-to-end
- [ ] Performance optimizations implemented
- [ ] Mobile responsiveness verified
- [ ] Production deployment ready
- [ ] Documentation updated

---

*This implementation plan provides the complete roadmap for building the user authentication and family management system with interactive feedback, Context7 documentation integration, and systematic validation at each phase.*