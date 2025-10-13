# User Authentication & Family Management - Technical Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

The user authentication and family management system integrates seamlessly with the existing Mitsubishi AC control application architecture. The design maintains all existing functionality while adding the foundational user management layer required for quota management features.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Architecture                    │
├─────────────────────────────────────────────────────────────┤
│  Next.js 15 App Router + React 19                          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Auth Pages    │  │  Family Mgmt    │  │ Quota Config │ │
│  │  - Login        │  │  - Dashboard    │  │ - Setup      │ │
│  │  - Register     │  │  - Members      │  │ - Manage     │ │
│  │  - Reset        │  │  - Rooms        │  │ - Override   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               State Management Layer                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │ │
│  │  │ auth-store  │ │family-store │ │ quota-store      │  │ │
│  │  │ (new)       │ │ (new)       │ │ (existing)       │  │ │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Integration Layer                          │ │
│  │  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │  AuthProvider   │  │ UserProvider    │             │ │
│  │  │  (JWT & Session)│  │ (User Context)  │             │ │
│  │  └─────────────────┘  └─────────────────┘             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Existing Components (Enhanced)               │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  QuotaAwareAirConRemote (user context integration) │ │ │
│  │  │  QuotaStatusBadge (user-specific data)             │ │ │
│  │  │  WebSocket Integration (user-aware updates)        │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ JWT + REST APIs
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Integration                        │
├─────────────────────────────────────────────────────────────┤
│  Spring Boot WebFlux + PostgreSQL                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Authentication APIs                          │ │
│  │  POST /api/auth/login       GET /api/auth/me           │ │
│  │  POST /api/auth/register    POST /api/auth/refresh     │ │
│  │  POST /api/auth/logout      PUT /api/auth/password     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │      Existing APIs (Already Implemented)               │ │
│  │  Family Management: /api/users/*                       │ │
│  │  Quota Management: /api/quotas/*                       │ │
│  │  Usage Tracking: /api/usage/*                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Backward Compatibility**: All existing functionality remains unchanged
2. **Progressive Enhancement**: Features gracefully upgrade with user authentication
3. **Security-First**: JWT tokens, HTTPS-only, proper session management
4. **Mobile-First**: Responsive design with touch-optimized interfaces
5. **Real-Time Integration**: WebSocket updates work with user context
6. **Design Consistency**: Perfect integration with existing ShadcnUI components

---

## 2. Authentication Architecture

### 2.1 JWT Token Management Strategy

**Token Architecture**:
```typescript
interface TokenPair {
  accessToken: string;   // Short-lived (30 minutes)
  refreshToken: string;  // Long-lived (7 days)
  expiresAt: number;     // Access token expiration timestamp
}

interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Storage Strategy**:
- **Access Tokens**: Stored in memory (Zustand store) for security
- **Refresh Tokens**: HttpOnly cookies for automatic refresh
- **User Data**: React Context for component access
- **Session Persistence**: Automatic token refresh on app startup

**Security Implementation**:
```typescript
// Token refresh interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        // Retry original request with new token
        return axios.request(error.config);
      } else {
        // Redirect to login
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);
```

### 2.2 Route Protection Architecture

**Next.js Middleware Implementation**:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('refreshToken');
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicPaths = ['/auth/login', '/auth/register', '/auth/reset-password'];
  
  if (!token && !publicPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Role-based route protection
  if (pathname.startsWith('/family') || pathname.startsWith('/quotas')) {
    // Check user role from JWT payload
    const userRole = getUserRoleFromToken(token);
    if (userRole !== 'PARENT') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}
```

**Client-Side Route Guards**:
```typescript
// components/auth/AuthGuard.tsx
export const AuthGuard: FC<{ children: ReactNode; requiredRole?: UserRole }> = ({
  children,
  requiredRole
}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <AuthLoadingSpinner />;
  if (!isAuthenticated) return <RedirectToLogin />;
  if (requiredRole && user?.role !== requiredRole) {
    return <UnauthorizedMessage />;
  }

  return <>{children}</>;
};
```

---

## 3. State Management Architecture

### 3.1 New State Stores

**Authentication Store** (`stores/auth-store.ts`):
```typescript
interface AuthStore {
  // State
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // Selectors
  getCurrentUserId: () => string | null;
  getUserRole: () => UserRole | null;
  hasPermission: (permission: Permission) => boolean;
}
```

**Family Management Store** (`stores/family-store.ts`):
```typescript
interface FamilyStore {
  // State
  familyMembers: User[];
  roomAssignments: Record<string, string[]>; // userId -> roomIds
  invitations: FamilyInvitation[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFamilyMembers: () => Promise<void>;
  addFamilyMember: (memberData: AddMemberRequest) => Promise<void>;
  updateFamilyMember: (userId: string, updates: Partial<User>) => Promise<void>;
  removeFamilyMember: (userId: string) => Promise<void>;
  updateRoomAssignments: (userId: string, roomIds: string[]) => Promise<void>;
  sendInvitation: (email: string, role: UserRole) => Promise<void>;

  // Selectors
  getFamilyMember: (userId: string) => User | null;
  getUserRooms: (userId: string) => string[];
  getChildrenUsers: () => User[];
  canUserAccessRoom: (userId: string, roomId: string) => boolean;
}
```

### 3.2 Integration with Existing Stores

**Enhanced Quota Store Integration**:
```typescript
// Current quota store uses hardcoded userId
// OLD: const balance = useUserQuotaBalance('demo-user', roomId);
// NEW: Dynamic user context integration

export const useUserQuotaBalance = (roomId: string) => {
  const currentUserId = useAuthStore(state => state.getCurrentUserId());
  return useQuotaStore(state => 
    currentUserId ? state.getBalance(currentUserId, roomId) : null
  );
};

export const useQuotaUsagePercentage = (roomId: string) => {
  const currentUserId = useAuthStore(state => state.getCurrentUserId());
  return useQuotaStore(state => 
    currentUserId ? state.getUsagePercentage(currentUserId, roomId) : 0
  );
};
```

**WebSocket Integration Enhancement**:
```typescript
// Enhanced quota WebSocket with user context
export const useQuotaWebSocketConnection = () => {
  const currentUserId = useAuthStore(state => state.getCurrentUserId());
  
  return useQuotaWebSocket({
    userId: currentUserId || undefined,
    autoConnect: !!currentUserId,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
  });
};
```

### 3.3 Data Flow Architecture

```
User Action (Login) 
    ↓
AuthStore.login() 
    ↓
API Call → JWT Response 
    ↓
Store Tokens + User Data 
    ↓
UserProvider Context Update 
    ↓
Components Re-render with User Context 
    ↓
Quota Components Auto-Update with Real UserId
    ↓
WebSocket Reconnects with User Context
    ↓
Real-time Updates Flow to User-Specific Components
```

---

## 4. Component Architecture

### 4.1 Page Structure & Routing

**Authentication Pages**:
```
/auth/
├── login/
│   └── page.tsx          # Login form with email/password
├── register/
│   └── page.tsx          # Registration + family setup
└── reset-password/
    └── page.tsx          # Password reset flow
```

**Family Management Pages**:
```
/family/
├── page.tsx              # Family dashboard and member list
├── invite/
│   └── page.tsx          # Family member invitation
└── [memberId]/
    └── page.tsx          # Individual member management
```

**Quota Configuration Pages**:
```
/quotas/
├── page.tsx              # Quota overview dashboard
├── create/
│   └── page.tsx          # Create new quota
└── [quotaId]/
    └── page.tsx          # Edit existing quota
```

**Room Management Pages**:
```
/rooms/
├── assign/
│   └── page.tsx          # Room assignment interface
└── [roomId]/
    └── page.tsx          # Enhanced with user filtering
```

### 4.2 Core Component Design

**AuthProvider Component**:
```typescript
// providers/AuthProvider.tsx
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const authStore = useAuthStore();

  useEffect(() => {
    // Initialize authentication on app startup
    authStore.initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={authStore}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Family Dashboard Component**:
```typescript
// components/family/FamilyDashboard.tsx
export const FamilyDashboard: FC = () => {
  const { user } = useAuthStore();
  const familyMembers = useFamilyStore(state => state.familyMembers);
  const isParent = user?.role === 'PARENT';

  if (isParent) {
    return <ParentDashboardView familyMembers={familyMembers} />;
  } else {
    return <ChildDashboardView user={user} />;
  }
};
```

**Enhanced Room Page**:
```typescript
// app/rooms/[roomId]/page.tsx (Enhanced)
export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { user } = useAuthStore();
  const canAccessRoom = useFamilyStore(state => 
    state.canUserAccessRoom(user?.id || '', params.roomId)
  );

  if (!canAccessRoom) {
    return <UnauthorizedRoomAccess />;
  }

  return (
    <QuotaAwareAirConRemote 
      roomId={params.roomId}
      userId={user?.id || ''}
      showQuotaDetails={true}
      allowOverrideRequests={user?.role === 'CHILD'}
    />
  );
}
```

### 4.3 Form Component Design

**Login Form Component**:
```typescript
// components/auth/LoginForm.tsx
export const LoginForm: FC = () => {
  const { login, isLoading, error } = useAuthStore();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      router.push('/dashboard');
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Access your family AC control dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
```

---

## 5. Backend Integration

### 5.1 Authentication API Integration

**API Client Setup**:
```typescript
// lib/api/auth-client.ts
const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Registration failed');
    return response.json();
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Include httpOnly cookies
    });
    if (!response.ok) throw new Error('Token refresh failed');
    return response.json();
  },
};
```

### 5.2 Family Management API Integration

**Existing Backend APIs** (Already Implemented):
```typescript
// lib/api/family-client.ts
const familyApi = {
  getFamilyMembers: () => fetch('/api/users', {
    headers: { Authorization: `Bearer ${getAccessToken()}` }
  }),

  addFamilyMember: (data: CreateUserRequest) => fetch('/api/users', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify(data)
  }),

  updateRoomAssignments: (userId: string, roomIds: string[]) => 
    fetch(`/api/users/${userId}/rooms`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({ roomIds })
    }),
};
```

### 5.3 Real-Time Integration

**WebSocket Authentication**:
```typescript
// Enhanced WebSocket connection with JWT
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NEXT_PUBLIC_QUOTA_WS_HOST || window.location.hostname;
  const port = process.env.NEXT_PUBLIC_QUOTA_WS_PORT || '8080';
  const path = process.env.NEXT_PUBLIC_QUOTA_WS_PATH || '/ws/quota';
  
  const token = getAccessToken();
  return `${protocol}//${host}:${port}${path}?token=${encodeURIComponent(token)}`;
};
```

---

## 6. Security Architecture

### 6.1 Authentication Security

**JWT Token Security**:
```typescript
interface JWTPayload {
  sub: string;           // User ID
  email: string;         // User email
  role: UserRole;        // User role for authorization
  householdId: string;   // Family/household identifier
  exp: number;           // Expiration timestamp
  iat: number;           // Issued at timestamp
}
```

**API Security Headers**:
```typescript
// Default headers for authenticated requests
const secureHeaders = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest', // CSRF protection
};
```

### 6.2 Role-Based Access Control

**Permission System**:
```typescript
enum Permission {
  VIEW_FAMILY_DASHBOARD = 'view:family:dashboard',
  MANAGE_FAMILY_MEMBERS = 'manage:family:members',
  ASSIGN_ROOMS = 'assign:rooms',
  CREATE_QUOTAS = 'create:quotas',
  VIEW_OWN_USAGE = 'view:own:usage',
  REQUEST_OVERRIDE = 'request:override',
}

const rolePermissions: Record<UserRole, Permission[]> = {
  PARENT: [
    Permission.VIEW_FAMILY_DASHBOARD,
    Permission.MANAGE_FAMILY_MEMBERS,
    Permission.ASSIGN_ROOMS,
    Permission.CREATE_QUOTAS,
    Permission.VIEW_OWN_USAGE,
  ],
  CHILD: [
    Permission.VIEW_OWN_USAGE,
    Permission.REQUEST_OVERRIDE,
  ],
};
```

### 6.3 Data Protection

**Sensitive Data Handling**:
```typescript
// Never store sensitive data in localStorage
const secureStorage = {
  // Store only non-sensitive user preferences
  setUserPreferences: (prefs: UserPreferences) => {
    localStorage.setItem('userPrefs', JSON.stringify(prefs));
  },

  // Tokens stored in memory + httpOnly cookies only
  // Never in localStorage for security
};
```

---

## 7. Performance Optimization

### 7.1 Code Splitting Strategy

**Page-Level Splitting**:
```typescript
// Lazy load authentication pages
const LoginPage = lazy(() => import('@/app/auth/login/page'));
const RegisterPage = lazy(() => import('@/app/auth/register/page'));
const FamilyDashboard = lazy(() => import('@/app/family/page'));

// Prefetch critical components
export const prefetchAuthComponents = () => {
  import('@/components/auth/LoginForm');
  import('@/components/family/FamilyDashboard');
};
```

### 7.2 State Optimization

**Selective Re-renders**:
```typescript
// Optimized selectors to prevent unnecessary re-renders
export const useCurrentUser = () => 
  useAuthStore(state => state.user, shallow);

export const useUserRole = () => 
  useAuthStore(state => state.user?.role);

export const useIsAuthenticated = () => 
  useAuthStore(state => state.isAuthenticated);
```

### 7.3 API Optimization

**Request Batching & Caching**:
```typescript
// Batch family data requests
const useFamilyData = () => {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['family', user?.householdId],
    queryFn: () => Promise.all([
      familyApi.getFamilyMembers(),
      familyApi.getRoomAssignments(),
      quotaApi.getFamilyQuotas(user?.householdId),
    ]),
    enabled: !!user?.householdId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

---

## 8. UI/UX Design Integration

### 8.1 Design System Consistency

**Component Theme Integration**:
```typescript
// Use existing design tokens and component variants
const authTheme = {
  cardPadding: 'p-6',           // Consistent with existing cards
  formSpacing: 'space-y-4',     // Matches existing forms
  buttonVariants: {             // Use established button styles
    primary: 'default',
    secondary: 'outline',
    danger: 'destructive',
  },
  colorScheme: {               // Follow existing color patterns
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  },
};
```

**Responsive Design Patterns**:
```typescript
// Follow existing responsive breakpoints
const responsiveClasses = {
  container: 'container mx-auto px-4 sm:px-6 lg:px-8',
  grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  card: 'w-full max-w-md mx-auto sm:max-w-lg',
  button: 'w-full sm:w-auto',
};
```

### 8.2 User Experience Flow

**Onboarding Experience Design**:
```typescript
// Progressive onboarding with clear steps
const OnboardingFlow = [
  {
    step: 1,
    title: 'Create Your Account',
    description: 'Set up your family AC control account',
    component: <RegisterForm />,
  },
  {
    step: 2,
    title: 'Add Family Members',
    description: 'Invite children to your family account',
    component: <AddFamilyMembers />,
  },
  {
    step: 3,
    title: 'Assign Rooms',
    description: 'Choose which rooms each child can control',
    component: <RoomAssignments />,
  },
  {
    step: 4,
    title: 'Set Usage Quotas',
    description: 'Configure daily AC usage limits',
    component: <QuotaSetup />,
  },
];
```

**Navigation Integration**:
```typescript
// Role-based navigation menu
const navigationItems = {
  parent: [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/family', label: 'Family', icon: Users },
    { href: '/rooms/assign', label: 'Room Access', icon: Settings },
    { href: '/quotas', label: 'Quotas', icon: Clock },
    { href: '/profile', label: 'Profile', icon: User },
  ],
  child: [
    { href: '/dashboard', label: 'My AC Status', icon: Home },
    { href: '/profile', label: 'Profile', icon: User },
  ],
};
```

---

## 9. Testing Strategy

### 9.1 Component Testing

**Authentication Flow Testing**:
```typescript
// Test login component
describe('LoginForm', () => {
  it('should authenticate user with valid credentials', async () => {
    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should display error for invalid credentials', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginForm />);
    
    // ... submit form with invalid data
    
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

### 9.2 Integration Testing

**State Management Integration**:
```typescript
describe('Auth Store Integration', () => {
  it('should update quota components when user logs in', async () => {
    const { result } = renderHook(() => ({
      auth: useAuthStore(),
      quota: useUserQuotaBalance('room1'),
    }));

    // User not logged in
    expect(result.current.quota).toBeNull();

    // User logs in
    act(() => {
      result.current.auth.login({ email: 'test@example.com', password: 'pass' });
    });

    // Quota data should now be available
    await waitFor(() => {
      expect(result.current.quota).not.toBeNull();
    });
  });
});
```

### 9.3 End-to-End Testing

**Complete User Flow Testing**:
```typescript
// E2E test for parent onboarding
test('parent can complete full family setup', async ({ page }) => {
  // 1. Register new parent account
  await page.goto('/auth/register');
  await page.fill('[data-testid=email]', 'parent@example.com');
  await page.fill('[data-testid=password]', 'password123');
  await page.click('[data-testid=submit]');

  // 2. Add child to family
  await page.goto('/family');
  await page.click('[data-testid=add-member]');
  await page.fill('[data-testid=child-email]', 'child@example.com');
  await page.click('[data-testid=send-invitation]');

  // 3. Assign child to rooms
  await page.goto('/rooms/assign');
  await page.check('[data-testid=room-bedroom]');
  await page.click('[data-testid=save-assignments]');

  // 4. Create quota for child
  await page.goto('/quotas/create');
  await page.selectOption('[data-testid=user-select]', 'child@example.com');
  await page.fill('[data-testid=daily-hours]', '4');
  await page.click('[data-testid=create-quota]');

  // 5. Verify family dashboard shows setup
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid=family-member]')).toContainText('child@example.com');
  await expect(page.locator('[data-testid=quota-status]')).toContainText('4 hours');
});
```

---

## 10. Deployment & Monitoring

### 10.1 Feature Flag Strategy

**Gradual Rollout Plan**:
```typescript
// Feature flags for controlled deployment
const featureFlags = {
  USER_AUTHENTICATION: process.env.NEXT_PUBLIC_ENABLE_AUTH === 'true',
  FAMILY_MANAGEMENT: process.env.NEXT_PUBLIC_ENABLE_FAMILY === 'true',
  QUOTA_CONFIGURATION: process.env.NEXT_PUBLIC_ENABLE_QUOTA_CONFIG === 'true',
};

// Conditional rendering based on flags
export const App = () => {
  if (featureFlags.USER_AUTHENTICATION) {
    return <AuthenticatedApp />;
  } else {
    return <LegacyApp />; // Current implementation
  }
};
```

### 10.2 Monitoring & Analytics

**User Journey Tracking**:
```typescript
// Track key user actions
const analytics = {
  trackUserRegistration: (method: 'email' | 'google') => {
    gtag('event', 'user_registration', { method });
  },
  
  trackFamilySetup: (memberCount: number) => {
    gtag('event', 'family_setup_complete', { member_count: memberCount });
  },
  
  trackQuotaCreation: (quotaType: string) => {
    gtag('event', 'quota_created', { quota_type: quotaType });
  },
};
```

**Performance Monitoring**:
```typescript
// Monitor authentication performance
const performanceMetrics = {
  trackAuthenticationTime: (startTime: number) => {
    const duration = Date.now() - startTime;
    gtag('event', 'auth_duration', { value: duration });
  },
  
  trackPageLoadTime: (route: string, loadTime: number) => {
    gtag('event', 'page_load', { route, value: loadTime });
  },
};
```

---

## 11. Migration Strategy

### 11.1 Backward Compatibility Plan

**Seamless Transition**:
```typescript
// Support both authenticated and legacy modes
export const useUserContext = () => {
  const authUser = useAuthStore(state => state.user);
  
  if (authUser) {
    // New authenticated mode
    return {
      userId: authUser.id,
      role: authUser.role,
      roomAccess: authUser.assignedRooms,
    };
  } else {
    // Legacy mode fallback
    return {
      userId: 'demo-user',
      role: 'PARENT',
      roomAccess: 'all',
    };
  }
};
```

### 11.2 Data Migration

**User Data Migration**:
```typescript
// Migrate existing demo data to real user accounts
const migrateUserData = async (userId: string) => {
  // Move quota data from 'demo-user' to actual user
  const demoQuotas = await quotaApi.getUserQuotas('demo-user');
  
  for (const quota of demoQuotas) {
    await quotaApi.createQuota({
      ...quota,
      userId: userId,
    });
  }
  
  // Clean up demo data
  await quotaApi.deleteUserQuotas('demo-user');
};
```

---

## 12. Success Metrics

### 12.1 Technical Metrics

- **Authentication Success Rate**: >99.5%
- **Page Load Performance**: <2 seconds for authentication flows
- **Real-time Update Latency**: <500ms for quota/family changes
- **Error Rate**: <1% for all user management operations
- **Security Compliance**: 100% pass rate on security audit

### 12.2 User Experience Metrics

- **Onboarding Completion Rate**: >85% complete family setup
- **Time to First Value**: <15 minutes from registration to first quota
- **User Retention**: >80% families active after 30 days
- **Support Ticket Rate**: <5% need setup assistance
- **Mobile Usability**: >90% mobile users complete onboarding

---

*This technical design provides the complete architecture for implementing user authentication and family management while maintaining perfect integration with the existing Mitsubishi AC control system. The design ensures security, performance, and user experience excellence while building upon the solid foundation already established.*