# Smart Home App with Admin Features - Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for creating a unified smart home application with integrated administrative features, supporting multi-device control organized by rooms with role-based navigation, following clean code principles and ensuring zero downtime migration.

## Implementation Phases

### Phase 1: Foundation Setup (Week 1) ✅ COMPLETED

#### 1.1 Create App/Admin Separation Structure
**Objective**: Establish separate app and admin directory structures with shared components

**Tasks**:
1. Create separate app and admin route structures
2. Configure Next.js redirects in next.config.ts
3. Set up shared sidebar component
4. Create separate layouts for app and admin

**Implementation Steps**:

```bash
# Create separate app and admin directory structure
mkdir -p src/app/app/{rooms,profile}
mkdir -p src/app/admin/{family,room-assignments,quotas,usage,settings}
mkdir -p src/components/{layout,devices/{aircon,lighting,sensors},rooms,admin,shared}
mkdir -p src/components/ui # ShadcnUI components
```

**Files to Create**:
- `next.config.ts` - Root redirect configuration
- `src/app/app/layout.tsx` - App-specific layout
- `src/app/admin/layout.tsx` - Admin-specific layout
- `src/components/layout/SharedSidebar.tsx` - Shared sidebar component
- `src/middleware.ts` - Route protection
- `src/lib/routing/redirects.ts` - Backwards compatibility redirects

**Success Criteria**: ✅ ALL COMPLETED
- ✅ Root URL redirects to `/app`
- ✅ Separate layouts for app and admin
- ✅ Shared sidebar component working
- ✅ Full viewport height sidebar

**Implementation Status**:
- ✅ Directory structure created
- ✅ Next.js redirect configured in next.config.ts
- ✅ SharedSidebar component implemented with context-aware navigation
- ✅ App layout created using shared sidebar in app context
- ✅ Admin layout created using shared sidebar in admin context
- ✅ Development server running successfully
- ✅ TypeScript issues resolved for Phase 1 foundation code

#### 1.2 Configure Next.js Root Redirect
**Objective**: Set up automatic redirect from root to /app path

```typescript
// next.config.ts - Next.js configuration with root redirect
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app',
        permanent: false,
      },
    ];
  },
  // ... other config options
};

export default nextConfig;
```

#### 1.3 Create Shared Sidebar Component
**Objective**: Build reusable sidebar component with full viewport height

```typescript
// src/components/layout/SharedSidebar.tsx - Shared sidebar for both layouts
"use client";

import React from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, Settings, ChevronDown, Menu } from 'lucide-react';

interface SharedSidebarProps {
  user: User;
  context: 'app' | 'admin';
  isMobile?: boolean;
}

export const SharedSidebar = ({ user, context, isMobile = false }: SharedSidebarProps) => {
  const rooms = useUserRooms(user);

  const NavigationContent = () => (
    <ScrollArea className="h-screen">
      <div className="p-4 space-y-4">
        {/* Context-aware navigation content */}
        {context === 'app' && (
          <>
            {/* Rooms Section */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center">
                    <Home className="mr-2 h-4 w-4" />
                    Rooms
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-2">
                {rooms.map(room => (
                  <Button
                    key={room.id}
                    variant="ghost"
                    className="w-full justify-between text-sm"
                    asChild
                  >
                    <Link href={`/app/rooms/${room.id}`}>
                      <span>{room.name}</span>
                      <Badge variant="outline">{room.deviceCount}</Badge>
                    </Link>
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Admin Access */}
            {hasAdminAccess(user) && (
              <>
                <Separator />
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </Button>
              </>
            )}
          </>
        )}

        {context === 'admin' && (
          <>
            {/* Back to App */}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/app">
                <Home className="mr-2 h-4 w-4" />
                Back to App
              </Link>
            </Button>

            <Separator />

            {/* Admin Navigation */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Administration
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-2">
                {getAdminNavItems(user).map(item => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 h-screen">
          <NavigationContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-80 h-screen border-r bg-muted/50 flex flex-col">
      <NavigationContent />
    </aside>
  );
};
```

#### 1.4 Create App Layout
**Objective**: Create app-specific layout using shared sidebar

```typescript
// src/app/app/layout.tsx - App layout with shared sidebar
"use client";

import React from 'react';
import { SharedSidebar } from '@/components/layout/SharedSidebar';
import { ApiAirconProvider } from '@/components/AirconProvider';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { useAuthStore } from '@/stores/auth-store';
import { Toaster } from '@/components/ui/toaster';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <ApiAirconProvider>
      <QuotaWebSocketContextProvider familyMemberId={user?.id}>
        <div className="flex h-screen bg-background">
          {/* Shared Sidebar for App Context */}
          <SharedSidebar user={user} context="app" />

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </QuotaWebSocketContextProvider>
    </ApiAirconProvider>
  );
}
```

#### 1.5 Create Admin Layout
**Objective**: Create admin-specific layout using shared sidebar

```typescript
// src/app/admin/layout.tsx - Admin layout with shared sidebar
"use client";

import React from 'react';
import { SharedSidebar } from '@/components/layout/SharedSidebar';
import { ApiAirconProvider } from '@/components/AirconProvider';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { useAuthStore } from '@/stores/auth-store';
import { Toaster } from '@/components/ui/toaster';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <ApiAirconProvider>
      <QuotaWebSocketContextProvider familyMemberId={user?.id}>
        <div className="flex h-screen bg-background">
          {/* Shared Sidebar for Admin Context */}
          <SharedSidebar user={user} context="admin" />

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </QuotaWebSocketContextProvider>
    </ApiAirconProvider>
  );
}
```

#### 1.3 Implement Middleware Protection
**Objective**: Secure admin routes and implement smart redirection

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAdminAccess } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = getUserFromRequest(request);

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user || !hasAdminAccess(user.role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Smart root redirection - all users go to main app
  if (pathname === '/') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    // All authenticated users land on main app (room listing)
    return NextResponse.next();
  }

  // Handle legacy redirects
  return handleLegacyRedirects(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

#### 1.3 Create Base Layouts
**Objective**: Establish distinct layout foundations for user and admin contexts

**User Layout** (`src/app/(app)/layout.tsx`):
```typescript
"use client";

import React from 'react';
import { UserNavigation } from '@/components/app/UserNavigation';
import { ApiAirconProvider } from '@/components/AirconProvider';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <ApiAirconProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
          <div className="container flex h-14 items-center">
            <UserNavigation />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </ApiAirconProvider>
  );
}
```

**Admin Layout** (`src/app/(admin)/layout.tsx`):
```typescript
"use client";

import React from 'react';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { ApiAirconProvider } from '@/components/AirconProvider';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { useAuthStore } from '@/stores/auth-store';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <ApiAirconProvider>
      <QuotaWebSocketContextProvider familyMemberId={user?.id}>
        <div className="min-h-screen bg-background">
          <div className="flex">
            <aside className="w-80 flex-shrink-0 border-r bg-muted/50">
              <div className="sticky top-0 h-screen overflow-y-auto">
                <AdminNavigation />
              </div>
            </aside>
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </QuotaWebSocketContextProvider>
    </ApiAirconProvider>
  );
}
```

### Phase 2: Device Component Architecture (Week 2) ✅ COMPLETED

#### 2.1 Create ShadcnUI Navigation Component ✅ COMPLETED
**Objective**: Implement unified sidebar navigation with role-based filtering

**Implementation Status**:
- ✅ UserNavigation component created with role-based navigation items
- ✅ AdminNavigation component created with permission-based admin features
- ✅ Both components use ShadcnUI for consistent design
- ✅ Proper logout functionality and user context display

**NavigationSidebar Component** (`src/components/layout/NavigationSidebar.tsx`):
```typescript
"use client";

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, Settings, ChevronDown, Menu } from 'lucide-react';

interface NavigationSidebarProps {
  user: User;
  isMobile?: boolean;
}

export const NavigationSidebar = ({ user, isMobile = false }: NavigationSidebarProps) => {
  const rooms = useUserRooms(user); // Hook to get user's accessible rooms

  const NavigationContent = () => (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Rooms Section */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center">
                <Home className="mr-2 h-4 w-4" />
                Rooms
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {rooms.map(room => (
              <Button
                key={room.id}
                variant="ghost"
                className="w-full justify-between text-sm"
                asChild
              >
                <Link href={`/rooms/${room.id}`}>
                  <span>{room.name}</span>
                  <Badge variant="outline">{room.deviceCount}</Badge>
                </Link>
              </Button>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Admin Section - Role-based visibility */}
        {hasAdminAccess(user) && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Administration
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {getAdminNavItems(user).map(item => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  asChild
                >
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  );

  // Mobile: Sheet overlay, Desktop: Fixed sidebar
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <NavigationContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-80 border-r bg-muted/50">
      <NavigationContent />
    </aside>
  );
};
```

#### 2.2 Create Device Component Architecture ✅ COMPLETED
**Objective**: Build extensible device control system with ShadcnUI components

**Implementation Status**:
- ✅ BaseDevice component created as foundation for all device types
- ✅ AirConDevice component with full temperature/mode/fan controls
- ✅ LightingDevice component with brightness/color/warmth controls
- ✅ SensorDevice component for environmental monitoring
- ✅ DeviceFactory component for dynamic device rendering
- ✅ RoomDevices component for room-based device organization
- ✅ All components use ShadcnUI for consistent UI patterns

**User Navigation** (`src/components/app/UserNavigation.tsx`):
```typescript
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export const UserNavigation: React.FC = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    {
      href: '/app/rooms',
      icon: Home,
      label: user?.role === 'child' ? 'My Rooms' : 'All Rooms',
    },
    {
      href: '/app/profile',
      icon: User,
      label: 'Profile',
    },
  ];

  return (
    <nav className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        {user?.role === 'parent' && (
          <Link href="/admin">
            <Button variant="outline" size="sm">
              Admin Dashboard
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center space-x-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className="flex items-center space-x-2"
              >
                <IconComponent className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center space-x-2">
        <Badge variant="secondary">{user?.name}</Badge>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
};
```

**Admin Navigation** (`src/components/admin/AdminNavigation.tsx`):
```typescript
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Home, Users, Settings, BarChart3, LogOut, User, ArrowLeft
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/permissions';

export const AdminNavigation: React.FC = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const navigationItems = [
    {
      href: '/admin',
      icon: Home,
      label: 'Dashboard',
      description: 'Overview and quick actions',
      available: true,
    },
    {
      href: '/admin/family',
      icon: Users,
      label: 'Family Members',
      description: 'Manage family and invitations',
      available: hasPermission(user.role, 'FAMILY_MANAGE'),
    },
    {
      href: '/admin/rooms',
      icon: Settings,
      label: 'Room Assignments',
      description: 'Assign rooms to family members',
      available: hasPermission(user.role, 'ROOM_ASSIGN'),
    },
    {
      href: '/admin/quotas',
      icon: BarChart3,
      label: 'Quota Management',
      description: 'Configure usage limits',
      available: hasPermission(user.role, 'QUOTA_MANAGE'),
    },
    {
      href: '/admin/usage',
      icon: BarChart3,
      label: 'Usage Reports',
      description: 'View analytics and reports',
      available: hasPermission(user.role, 'USAGE_VIEW'),
    },
  ];

  return (
    <Card className="h-full border-0 rounded-none">
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            <Link href="/app">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                User App
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <Badge variant="secondary" className="mt-1 text-xs">
                {user.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navigationItems
            .filter(item => item.available)
            .map((item) => {
              const isActive = pathname === item.href;
              const IconComponent = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start h-auto p-3"
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <IconComponent className="h-5 w-5" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                </Link>
              );
            })}
        </nav>

        {/* Logout */}
        <div className="mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 2.3 Migrate Existing Components ✅ COMPLETED
**Objective**: Move and optimize existing components for their new contexts

**Implementation Status**:
- ✅ Created UserRoomList shared component for room overview
- ✅ Updated /app/page.tsx to use UserRoomList component
- ✅ Updated /app/rooms/[roomId]/page.tsx to use new device architecture
- ✅ All components now use consistent ShadcnUI patterns
- ✅ Role-based content filtering implemented

**Migration Tasks**:
1. Move `RoomList.tsx` to `shared/` and create context-specific wrappers
2. Create simplified user versions of complex components
3. Enhance admin versions with additional functionality
4. Update import paths throughout the application

**User Room List** (`src/components/app/UserRoomList.tsx`):
```typescript
"use client";

import React from 'react';
import RoomsList from '@/components/shared/RoomList';
import { useAuthStore } from '@/stores/auth-store';
import { getRoleBasedPageContent } from '@/lib/utils/room-access';

export const UserRoomList: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { title, description } = getRoleBasedPageContent(user);

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <RoomsList
        title={title}
        description={description}
        className="space-y-4"
      />
    </div>
  );
};
```

#### 2.4 Create Page Components ✅ COMPLETED
**Objective**: Implement new page components using migrated layouts and components

**Implementation Status**:
- ✅ Created /app/admin/family/page.tsx for family member management
- ✅ Created /app/admin/room-assignments/page.tsx for room access control
- ✅ Updated existing app pages to use new component architecture
- ✅ All pages follow consistent design patterns with ShadcnUI
- ✅ Role-based functionality implemented throughout

**User App Pages**:
- `src/app/(app)/page.tsx` - User dashboard with room selection
- `src/app/(app)/rooms/page.tsx` - User room listing
- `src/app/(app)/rooms/[roomId]/page.tsx` - AC control interface
- `src/app/(app)/profile/page.tsx` - User profile settings

**Admin App Pages**:
- `src/app/(admin)/page.tsx` - Admin dashboard overview
- `src/app/(admin)/family/page.tsx` - Family management
- `src/app/(admin)/rooms/page.tsx` - Room assignment management
- `src/app/(admin)/quotas/page.tsx` - Quota configuration
- `src/app/(admin)/usage/page.tsx` - Usage analytics

### Phase 3: Testing and Optimization (Week 3)

#### 3.1 Comprehensive Testing Strategy

**Unit Tests**:
```typescript
// src/components/app/__tests__/UserNavigation.test.tsx
import { render, screen } from '@testing-library/react';
import { UserNavigation } from '../UserNavigation';
import { useAuthStore } from '@/stores/auth-store';

jest.mock('@/stores/auth-store');

describe('UserNavigation', () => {
  it('shows correct navigation items for child users', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      user: { role: 'child', name: 'Test Child' },
      logout: jest.fn(),
    });

    render(<UserNavigation />);

    expect(screen.getByText('My Rooms')).toBeInTheDocument();
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
  });

  it('shows admin access for parent users', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      user: { role: 'parent', name: 'Test Parent' },
      logout: jest.fn(),
    });

    render(<UserNavigation />);

    expect(screen.getByText('All Rooms')).toBeInTheDocument();
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});
```

**Integration Tests**:
```typescript
// src/app/(app)/__tests__/app-integration.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@testing-library/jest-dom';

describe('User App Integration', () => {
  it('allows child user to navigate and control AC', async () => {
    // Test complete user workflow
  });

  it('allows parent user to switch to admin context', async () => {
    // Test context switching
  });
});
```

**E2E Tests**:
```typescript
// e2e/admin-user-separation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin/User Separation', () => {
  test('child user flow', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid=email]', 'child@test.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');

    // Should redirect to user app
    await expect(page).toHaveURL('/app');

    // Should not see admin features
    await expect(page.locator('text=Admin Dashboard')).not.toBeVisible();
  });

  test('parent user flow', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid=email]', 'parent@test.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL('/admin');

    // Should be able to switch to user app
    await page.click('text=User App');
    await expect(page).toHaveURL('/app');
  });
});
```

#### 3.2 Performance Optimization

**Bundle Splitting Configuration**:
```typescript
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      '@/components/admin',
      '@/components/app',
      '@/components/shared'
    ],
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          userApp: {
            test: /[\\/](app|components[\\/]app)[\\/]/,
            name: 'user-app',
            priority: 20,
          },
          adminApp: {
            test: /[\\/](admin|components[\\/]admin)[\\/]/,
            name: 'admin-app',
            priority: 20,
          },
          shared: {
            test: /[\\/]components[\\/]shared[\\/]/,
            name: 'shared-components',
            priority: 10,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
```

**Lazy Loading Implementation**:
```typescript
// src/lib/lazy-imports.ts
import { lazy } from 'react';

// User app lazy imports
export const UserProfile = lazy(() => import('@/components/app/UserProfile'));
export const UserSettings = lazy(() => import('@/components/app/UserSettings'));

// Admin app lazy imports
export const FamilyManagement = lazy(() => import('@/components/admin/FamilyManagement'));
export const UsageAnalytics = lazy(() => import('@/components/admin/Analytics'));
export const QuotaManagement = lazy(() => import('@/components/admin/QuotaManagement'));

// Shared component lazy imports
export const AirConRemote = lazy(() => import('@/components/shared/AirConRemote'));
```

#### 3.3 Accessibility and UX Testing

**Accessibility Checklist**:
- [ ] Keyboard navigation works in both contexts
- [ ] Screen reader compatibility verified
- [ ] Color contrast meets WCAG standards
- [ ] Focus management during context switching
- [ ] ARIA labels for navigation elements

**UX Testing Scenarios**:
- [ ] Child user can quickly access and control AC
- [ ] Parent user can efficiently switch between contexts
- [ ] Navigation is intuitive in both contexts
- [ ] Mobile experience remains excellent for user app
- [ ] Admin dashboard is usable on mobile (basic functionality)

### Phase 4: Deployment and Monitoring (Week 4)

#### 4.1 Deployment Strategy

**Gradual Rollout Plan**:
1. **Week 4.1**: Deploy to staging with full test suite
2. **Week 4.2**: Deploy to production with feature flag (10% users)
3. **Week 4.3**: Increase to 50% users with monitoring
4. **Week 4.4**: Full rollout with monitoring and feedback collection

**Feature Flag Implementation**:
```typescript
// src/lib/feature-flags.ts
export const useFeatureFlag = (flag: string) => {
  // Implementation depends on your feature flag system
  return process.env.NODE_ENV === 'development' ||
         getFeatureFlag(flag) ||
         false;
};

// Usage in middleware
export function middleware(request: NextRequest) {
  const newStructureEnabled = getFeatureFlag('admin-user-separation');

  if (newStructureEnabled) {
    return handleNewStructure(request);
  } else {
    return handleLegacyStructure(request);
  }
}
```

#### 4.2 Monitoring and Analytics

**Performance Monitoring**:
```typescript
// src/lib/analytics.ts
export const trackContextSwitch = (from: string, to: string, userId: string) => {
  analytics.track('Context Switch', {
    from,
    to,
    userId,
    timestamp: new Date().toISOString(),
  });
};

export const trackPageLoad = (context: 'user' | 'admin', page: string, loadTime: number) => {
  analytics.track('Page Load', {
    context,
    page,
    loadTime,
    timestamp: new Date().toISOString(),
  });
};
```

**Error Monitoring**:
```typescript
// src/lib/error-tracking.ts
export const trackContextError = (context: 'user' | 'admin', error: Error, userId?: string) => {
  console.error(`[${context.toUpperCase()}] Error:`, error);

  errorTracking.captureException(error, {
    tags: {
      context,
      userId,
      userAgent: navigator.userAgent,
    },
  });
};
```

#### 4.3 User Feedback Collection

**Feedback Implementation**:
```typescript
// src/components/shared/FeedbackWidget.tsx
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';

interface FeedbackWidgetProps {
  context: 'user' | 'admin';
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ context }) => {
  const [feedback, setFeedback] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const submitFeedback = async () => {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback,
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });

    setFeedback('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="fixed bottom-4 right-4">
          <MessageSquare className="h-4 w-4 mr-1" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            Feedback on {context === 'user' ? 'User App' : 'Admin Dashboard'}
          </h3>
          <Textarea
            placeholder="How can we improve your experience?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <Button onClick={submitFeedback} disabled={!feedback.trim()}>
            Submit Feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

## Clean Code Implementation Checklist

### DRY (Don't Repeat Yourself)
- [ ] Shared components extracted to `/components/shared/`
- [ ] Common layout patterns abstracted
- [ ] Unified auth logic across contexts
- [ ] Centralized route configuration

### SOLID Principles
- [ ] **SRP**: Each component has single responsibility
- [ ] **OCP**: Components extensible without modification
- [ ] **LSP**: Interface implementations are substitutable
- [ ] **ISP**: Focused, client-specific interfaces
- [ ] **DIP**: Dependencies on abstractions, not concretions

### YAGNI (You Aren't Gonna Need It)
- [ ] Implement minimal viable separation first
- [ ] Add complexity only when requirements demand it
- [ ] Avoid premature abstraction
- [ ] Start simple, refactor when needed

## Risk Mitigation Strategies

### Risk 1: User Confusion
**Mitigation**:
- Clear visual distinction between contexts
- Smooth onboarding flow for new structure
- Helpful tooltips and guidance
- User testing and feedback collection

### Risk 2: Performance Regression
**Mitigation**:
- Bundle analysis before and after migration
- Performance monitoring in production
- Lazy loading for non-critical components
- Caching strategies for each context

### Risk 3: Functionality Loss
**Mitigation**:
- Comprehensive test coverage
- Feature parity validation
- Backwards compatibility maintenance
- Gradual rollout with monitoring

### Risk 4: Development Complexity
**Mitigation**:
- Clear documentation and examples
- Consistent patterns within each context
- Team training and knowledge sharing
- Code review guidelines

## Success Metrics

### Technical Metrics
- [ ] Bundle size optimization: User app <500kb, Admin app <1MB
- [ ] Page load time: User app <2s, Admin dashboard <3s
- [ ] Test coverage: >90% for new components
- [ ] Zero critical bugs in production

### User Experience Metrics
- [ ] Task completion time reduced by 30% for common actions
- [ ] User satisfaction scores improved
- [ ] Context switching successful for 100% of parent users
- [ ] Mobile usability maintained for user app

### Business Metrics
- [ ] Feature development velocity increased
- [ ] Support tickets reduced for navigation confusion
- [ ] User engagement maintained or improved
- [ ] System scalability improved for future features

## Post-Implementation Tasks

### Documentation Updates
- [ ] Update README with new structure
- [ ] Create developer onboarding guide
- [ ] Document context-switching patterns
- [ ] Update deployment guides

### Team Training
- [ ] Conduct training sessions on new architecture
- [ ] Create development guidelines for each context
- [ ] Establish code review criteria
- [ ] Share best practices and patterns

### Continuous Improvement
- [ ] Monitor user feedback and analytics
- [ ] Identify optimization opportunities
- [ ] Plan future enhancements for each context
- [ ] Regular architecture reviews

This implementation plan provides a comprehensive, phased approach to safely separating the admin and user functionality while maintaining existing features and following clean code principles.