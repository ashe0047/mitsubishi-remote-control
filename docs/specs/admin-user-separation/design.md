# Smart Home App with Admin Features - Technical Design Document

## Overview
This document defines the technical architecture for a unified smart home application with integrated administrative features, supporting multi-device control organized by rooms and role-based access to management functions, following clean code principles and modern Next.js App Router patterns.

## Architecture Analysis (Sequential Thinking Applied)

### Clean Code Principles Assessment

#### DRY (Don't Repeat Yourself) Analysis
**Current Duplication Issues Identified**:
- Device control patterns repeated for each device type
- Navigation logic scattered across multiple components
- Status display patterns duplicated
- Room organization logic repeated

**DRY Solutions**:
- Create unified device control component architecture
- Centralized navigation with role-based filtering
- Abstract device card patterns into reusable components
- Unified status indicator components across all device types

#### SOLID Principles Application

**Single Responsibility Principle (SRP)**:
- **Device Components**: Each device type component responsible only for its specific control patterns
- **Navigation Component**: Single sidebar navigation with role-based filtering responsibility
- **Room Layout**: Responsible only for organizing and displaying devices within a room
- **Device Cards**: Responsible only for device summary display and quick controls

**Open/Closed Principle (OCP)**:
- **Device Architecture**: New device types can be added without modifying core components
- **Navigation System**: New admin features can be added without changing navigation logic
- **Room Layout**: Supports new device types without layout component changes
- **Control Patterns**: Device control interfaces extensible for new device capabilities

**Liskov Substitution Principle (LSP)**:
- **Device Components**: All device types implement `DeviceInterface` and can be substituted in room layouts
- **Control Components**: All device controls implement consistent control interfaces
- **Navigation Items**: All navigation items implement consistent navigation behavior contracts

**Interface Segregation Principle (ISP)**:
- **Device Interfaces**: Segregated into `BasicDevice`, `ControllableDevice`, `StatusDevice`, `ConfigurableDevice`
- **Navigation Interface**: Role-based navigation props with only relevant items
- **Control Interfaces**: Specific interfaces for different control types (temperature, brightness, power)
- **Admin Interfaces**: Focused interfaces for each admin function (family, quotas, usage)

**Dependency Inversion Principle (DIP)**:
- **Device Control**: Components depend on `DeviceControlInterface`, not specific device implementations
- **Communication**: Components depend on `CommunicationInterface` (MQTT), not concrete implementations
- **State Management**: Components depend on `StateInterface`, not specific store implementations
- **Role Management**: Navigation depends on `RoleInterface`, not specific auth implementation

#### YAGNI (You Aren't Gonna Need It) Implementation
**Current Over-Engineering**:
- Complex navigation configuration when simple role-based routing would suffice
- Premature abstraction in layout components

**YAGNI-Compliant Approach**:
- Implement minimal viable separation first
- Add complexity only when specific requirements demand it
- Start with simple role-based routing, enhance later if needed

### Design Pattern Analysis

#### Strategy Pattern for Navigation
**Problem**: Different user roles require different navigation structures and behaviors
**Solution**: Implement Strategy pattern for navigation generation

```typescript
interface NavigationStrategy {
  generateNavItems(user: User): NavigationItem[];
  getLayoutPreferences(): LayoutPreferences;
}

class UserNavigationStrategy implements NavigationStrategy {
  generateNavItems(user: User): NavigationItem[] {
    // Simple, task-focused navigation
  }
}

class AdminNavigationStrategy implements NavigationStrategy {
  generateNavItems(user: User): NavigationItem[] {
    // Comprehensive management navigation
  }
}
```

**Trade-off Analysis**:
- **Pros**: Clear separation, easy to extend, follows user mental models
- **Cons**: Additional abstraction layer, potential over-engineering
- **Decision**: Implement - benefits outweigh complexity for this use case

#### Factory Pattern for Layout Creation
**Problem**: Need to create different layout components based on user context
**Solution**: Layout factory that creates appropriate layout based on route context

```typescript
interface LayoutFactory {
  createLayout(context: RouteContext): LayoutComponent;
}

class AppLayoutFactory implements LayoutFactory {
  createLayout(context: RouteContext): LayoutComponent {
    return context.isAdmin ? new AdminLayout() : new UserLayout();
  }
}
```

**Trade-off Analysis**:
- **Pros**: Centralized layout logic, easy to extend
- **Cons**: May be overkill for simple user/admin distinction
- **Decision**: Skip - Next.js nested layouts provide simpler solution

#### Observer Pattern for Context Switching
**Problem**: Need to notify components when user switches between user and admin contexts
**Solution**: Context change notification system

**Trade-off Analysis**:
- **Pros**: Loose coupling, easy to add context-aware features
- **Cons**: Additional complexity for simple context switching
- **Decision**: Skip initially - use simple URL-based context detection

#### Provider Pattern for Context Separation
**Problem**: Need to provide different services and state to user vs admin contexts
**Solution**: Separate provider hierarchies for user and admin contexts

```typescript
// User context providers
<UserContextProvider>
  <BasicAirconProvider>
    <UserApp />
  </BasicAirconProvider>
</UserContextProvider>

// Admin context providers
<AdminContextProvider>
  <FullAirconProvider>
    <QuotaProvider>
      <FamilyProvider>
        <AdminApp />
      </FamilyProvider>
    </QuotaProvider>
  </FullAirconProvider>
</AdminContextProvider>
```

**Trade-off Analysis**:
- **Pros**: Clear separation of concerns, optimized for each context
- **Cons**: Potential duplication of providers
- **Decision**: Implement - provides clear benefits for context separation

### Architecture Quality Assessment

#### Cohesion Analysis
**High Cohesion Targets**:
- User app components focused solely on AC control tasks
- Admin components focused solely on management tasks
- Shared components focused on specific UI functionality

**Cohesion Improvements**:
- Group user features in `/app` directory structure
- Group admin features in `/admin` directory structure
- Extract truly shared functionality to `/components/shared`

#### Coupling Analysis
**Current High Coupling Issues**:
- Navigation components tightly coupled to all possible user roles
- Layout components coupled to both user and admin requirements
- Route components coupled to mixed functionality

**Low Coupling Solutions**:
- Interface-based communication between user and admin contexts
- Shared state only where absolutely necessary (auth, MQTT connection)
- Clear API boundaries between contexts

#### Separation of Concerns Validation
**Context Separation**:
- **User Context**: Focus on device control, room access, basic settings
- **Admin Context**: Focus on user management, system configuration, reporting
- **Shared Context**: Authentication, core UI components, MQTT infrastructure

**Layer Separation**:
- **Presentation**: Separate user and admin UI components
- **Business Logic**: Shared where appropriate, separated where context-specific
- **Data Access**: Shared MQTT and API clients with context-specific wrappers

## System Architecture

### URL Structure Design

```
/                               # Root redirects to /app (via next.config.ts)
├── app/                        # Main smart home application
│   ├── layout.tsx              # App layout with shared sidebar
│   ├── page.tsx                # Dashboard/room listing (role-filtered)
│   └── rooms/
│       └── [roomId]/
│           └── page.tsx        # Room devices page (all device types)
├── admin/                      # Administrative features
│   ├── layout.tsx              # Admin layout with shared sidebar
│   ├── page.tsx                # Admin dashboard overview
│   ├── family/
│   │   ├── page.tsx            # Family member management
│   │   └── [memberId]/
│   │       └── page.tsx        # Individual member management
│   ├── room-assignments/
│   │   └── page.tsx            # Assign rooms to family members
│   ├── quotas/
│   │   ├── page.tsx            # Quota configuration
│   │   ├── setup/
│   │   │   └── page.tsx        # Quota setup wizard
│   │   └── monitoring/
│   │       └── page.tsx        # Usage monitoring
│   ├── usage/
│   │   ├── page.tsx            # Usage reporting dashboard
│   │   ├── reports/
│   │   │   └── page.tsx        # Detailed reports
│   │   └── analytics/
│   │       └── page.tsx        # Usage analytics
│   └── settings/
│       └── page.tsx            # System configuration
└── auth/                       # Authentication (unchanged)
    ├── login/page.tsx
    ├── register/page.tsx
    └── forgot-password/page.tsx

# Next.js Configuration (next.config.ts)
redirects: [
  {
    source: '/',
    destination: '/app',
    permanent: false,
  }
]
```

### Component Architecture with ShadcnUI Integration

#### Component Organization
```typescript
/components/
├── ui/                         # ShadcnUI base components
│   ├── card.tsx               # Base card component
│   ├── sheet.tsx              # Mobile sidebar
│   ├── collapsible.tsx        # Collapsible navigation sections
│   ├── slider.tsx             # Device controls (temperature, brightness)
│   ├── switch.tsx             # On/off toggles
│   ├── select.tsx             # Mode selection dropdowns
│   ├── button.tsx             # Action buttons
│   ├── badge.tsx              # Status indicators
│   ├── progress.tsx           # Status bars and levels
│   ├── dialog.tsx             # Device detail modals
│   ├── tabs.tsx               # Content organization
│   └── separator.tsx          # Visual section dividers
├── layout/                     # Layout components
│   ├── AppLayout.tsx          # App-specific layout (/app routes)
│   ├── AdminLayout.tsx        # Admin-specific layout (/admin routes)
│   ├── SharedSidebar.tsx      # Shared sidebar component (full viewport height)
│   ├── MobileNavigation.tsx   # Mobile-optimized navigation
│   └── ContentHeader.tsx      # Page headers with breadcrumbs
├── devices/                    # Device-specific components
│   ├── DeviceCard.tsx         # Generic device card template
│   ├── aircon/                # Air conditioning controls
│   │   ├── AirConCard.tsx     # AC-specific device card
│   │   ├── AirConControls.tsx # Detailed AC controls
│   │   └── TemperatureSlider.tsx # Temperature control
│   ├── lighting/              # Future: Lighting controls
│   │   ├── LightCard.tsx      # Light-specific device card
│   │   └── BrightnessSlider.tsx # Brightness control
│   └── sensors/               # Future: Sensor displays
│       ├── SensorCard.tsx     # Sensor data display
│       └── SensorChart.tsx    # Sensor data visualization
├── rooms/                      # Room organization components
│   ├── RoomGrid.tsx           # Grid layout for rooms
│   ├── RoomCard.tsx           # Room summary card
│   ├── DeviceGrid.tsx         # Grid layout for devices in room
│   └── RoomHeader.tsx         # Room page header
├── admin/                      # Administrative components
│   ├── FamilyManagement/      # Family management features
│   ├── QuotaManagement/       # Quota configuration and monitoring
│   ├── UsageAnalytics/        # Usage reports and analytics
│   └── SystemSettings/        # System configuration
└── shared/                     # Cross-component utilities
    ├── ConnectionStatus.tsx   # MQTT/WebSocket status
    ├── ErrorBoundary.tsx      # Error handling
    ├── LoadingSpinner.tsx     # Loading states
    └── Auth/                  # Authentication components
```

#### Shared Sidebar Component Implementation
```typescript
// SharedSidebar.tsx - Reusable sidebar component for both app and admin layouts
"use client";

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, Settings, Users, BarChart3, ChevronDown, Menu } from 'lucide-react';

interface SharedSidebarProps {
  user: User;
  context: 'app' | 'admin';
  isMobile?: boolean;
}

export const SharedSidebar = ({ user, context, isMobile = false }: SharedSidebarProps) => {
  const rooms = useUserRooms(user); // Hook to get user's accessible rooms
  const NavigationContent = () => (
    <ScrollArea className="h-screen">
      <div className="p-4 space-y-4">
        {/* Context-aware sections */}
        {context === 'app' && (
          <>
            {/* Rooms Section - Primary for app context */}
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
                {rooms.filter(room => hasRoomAccess(user, room)).map(room => (
                  <Button
                    key={room.id}
                    variant="ghost"
                    className="w-full justify-between text-sm"
                    asChild
                  >
                    <Link href={`/app/rooms/${room.id}`}>
                      <span>{room.name}</span>
                      <Badge variant="outline" className="ml-auto">
                        {room.deviceCount}
                      </Badge>
                    </Link>
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Quick Admin Access - Only for users with admin permissions */}
            {hasAdminAccess(user) && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
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
            {/* Quick App Access */}
            <Button
              variant="outline"
              className="w-full justify-start"
              asChild
            >
              <Link href="/app">
                <Home className="mr-2 h-4 w-4" />
                Back to App
              </Link>
            </Button>

            <Separator />

            {/* Admin Section - Primary for admin context */}
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
                      {item.badge && (
                        <Badge variant="destructive" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
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

  // Mobile: Sheet overlay, Desktop: Fixed sidebar with full viewport height
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

#### Device Control Components with ShadcnUI
```typescript
// DeviceCard.tsx - Generic device card template
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface DeviceCardProps {
  device: Device;
  quickControls: React.ReactNode;
  detailedControls: React.ReactNode;
}

export const DeviceCard = ({ device, quickControls, detailedControls }: DeviceCardProps) => (
  <Card className="transition-all hover:shadow-md">
    <CardHeader className="pb-3">
      <div className="flex justify-between items-start">
        <CardTitle className="text-lg">{device.name}</CardTitle>
        <Badge variant={getStatusVariant(device.status)}>
          {device.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{device.type}</p>
    </CardHeader>

    <CardContent className="space-y-4">
      {/* Quick controls for immediate actions */}
      <div className="space-y-3">
        {quickControls}
      </div>

      {/* More controls button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            More Controls
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          {detailedControls}
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>
);

// AirConCard.tsx - AC-specific implementation
"use client";

import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Thermometer, Power, Wind } from 'lucide-react';

export const AirConCard = ({ device }: { device: AirConDevice }) => {
  const quickControls = (
    <>
      {/* Power Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Power className="h-4 w-4" />
          <span className="text-sm font-medium">Power</span>
        </div>
        <Switch
          checked={device.settings.power}
          onCheckedChange={(checked) => updateDevice(device.id, { power: checked })}
        />
      </div>

      {/* Temperature Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Thermometer className="h-4 w-4" />
            <span className="text-sm font-medium">Temperature</span>
          </div>
          <span className="text-sm text-muted-foreground">{device.settings.temperature}°C</span>
        </div>
        <Slider
          value={[device.settings.temperature]}
          onValueChange={([value]) => updateDevice(device.id, { temperature: value })}
          min={16}
          max={30}
          step={1}
          className="w-full"
        />
      </div>
    </>
  );

  const detailedControls = (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Air Conditioner Controls</h3>

      {/* Mode Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Mode</label>
        <Select
          value={device.settings.mode}
          onValueChange={(mode) => updateDevice(device.id, { mode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="heat">Heat</SelectItem>
            <SelectItem value="cool">Cool</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="fan">Fan Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fan Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Fan Speed</label>
          <span className="text-sm text-muted-foreground">{device.settings.fanSpeed}</span>
        </div>
        <Select
          value={device.settings.fanSpeed}
          onValueChange={(fanSpeed) => updateDevice(device.id, { fanSpeed })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <DeviceCard
      device={device}
      quickControls={quickControls}
      detailedControls={detailedControls}
    />
  );
};
```

### State Management Architecture

#### Context Separation Strategy
```typescript
// User context - lightweight and focused
interface UserContextState {
  rooms: Room[];
  currentRoom: Room | null;
  userPreferences: UserPreferences;
}

// Admin context - comprehensive management
interface AdminContextState {
  familyMembers: FamilyMember[];
  roomAssignments: RoomAssignment[];
  quotaConfigurations: QuotaConfig[];
  usageAnalytics: UsageData[];
  systemSettings: SystemSettings;
}

// Shared context - common functionality
interface SharedContextState {
  user: User;
  mqttConnection: MQTTConnection;
  appConfiguration: AppConfig;
}
```

#### Provider Hierarchy Design
```typescript
// App Root
<SharedProviders>
  <Routes>
    <Route path="/app/*">
      <UserProviders>
        <UserApp />
      </UserProviders>
    </Route>

    <Route path="/admin/*">
      <AdminProviders>
        <AdminApp />
      </AdminProviders>
    </Route>
  </Routes>
</SharedProviders>
```

### Security Architecture

#### Middleware-Based Route Protection
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = getUserFromRequest(request);

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user || !hasAdminAccess(user.role)) {
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }

  // Redirect based on role
  if (pathname === '/') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const defaultPath = user.role === 'child' ? '/app' : '/admin';
    return NextResponse.redirect(new URL(defaultPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

#### Role-Based Access Control
```typescript
interface RolePermissions {
  USER_CONTROL: boolean;      // Basic AC control
  ROOM_ACCESS: boolean;       // Access to rooms
  FAMILY_MANAGE: boolean;     // Manage family members
  QUOTA_MANAGE: boolean;      // Set usage quotas
  USAGE_VIEW: boolean;        // View usage reports
  SYSTEM_CONFIG: boolean;     // System configuration
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  child: {
    USER_CONTROL: true,
    ROOM_ACCESS: true,        // Limited to assigned rooms
    FAMILY_MANAGE: false,
    QUOTA_MANAGE: false,
    USAGE_VIEW: false,
    SYSTEM_CONFIG: false,
  },
  parent: {
    USER_CONTROL: true,
    ROOM_ACCESS: true,        // All rooms
    FAMILY_MANAGE: true,
    QUOTA_MANAGE: true,
    USAGE_VIEW: true,
    SYSTEM_CONFIG: true,
  },
};
```

### Performance Optimization

#### Bundle Splitting Strategy
```typescript
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@/components/admin', '@/components/app'],
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        userApp: {
          test: /[\\/]app[\\/]/,
          name: 'user-app',
          priority: 20,
        },
        adminApp: {
          test: /[\\/]admin[\\/]/,
          name: 'admin-app',
          priority: 20,
        },
        shared: {
          test: /[\\/]components[\\/]shared[\\/]/,
          name: 'shared',
          priority: 10,
        },
      },
    };
    return config;
  },
};
```

#### Lazy Loading Implementation
```typescript
// User app lazy loading
const UserProfile = lazy(() => import('@/components/app/UserProfile'));
const RoomControl = lazy(() => import('@/components/shared/AirConRemote'));

// Admin app lazy loading
const FamilyManagement = lazy(() => import('@/components/admin/FamilyManagement'));
const UsageAnalytics = lazy(() => import('@/components/admin/Analytics'));
```

### Migration Strategy

#### Phase-based Implementation
**Phase 1: Infrastructure**
- Create new URL structure with route groups
- Implement basic layouts for user and admin contexts
- Set up middleware for route protection
- Create backwards compatibility redirects

**Phase 2: Component Migration**
- Move existing components to appropriate contexts
- Implement new navigation strategies
- Create context-specific providers
- Maintain existing functionality

**Phase 3: Optimization**
- Implement bundle splitting
- Optimize for each context's use case
- Add context-specific features
- Performance tuning

**Phase 4: Cleanup**
- Remove old URL patterns
- Clean up deprecated components
- Final optimization pass
- Documentation updates

### Testing Strategy

#### Context-Specific Testing
```typescript
// User app tests
describe('User App', () => {
  it('should show only assigned rooms for child users', () => {
    // Test child user room access
  });

  it('should provide quick AC controls', () => {
    // Test simplified AC interface
  });
});

// Admin app tests
describe('Admin App', () => {
  it('should show comprehensive family management for parents', () => {
    // Test admin family features
  });

  it('should provide detailed usage analytics', () => {
    // Test admin analytics features
  });
});

// Cross-context tests
describe('Context Switching', () => {
  it('should allow parents to switch between user and admin contexts', () => {
    // Test context switching for parents
  });
});
```

## Technology Integration

### Next.js App Router Features
- Route groups for organization: `(app)` and `(admin)`
- Nested layouts for context-specific UI
- Middleware for route protection and redirection
- Server components for optimal performance

### React 19 Integration
- Concurrent features for smooth transitions
- Suspense boundaries for lazy loading
- Enhanced error boundaries for each context

### TypeScript Architecture
- Strict type checking for role-based access
- Interface segregation for clean APIs
- Generic types for reusable components

### ShadcnUI Integration
- Shared component library across contexts
- Context-specific theming and variants
- Consistent design system

## Architecture Benefits

### User Experience Benefits
- **Child Users**: Simple, focused interface for AC control
- **Parent Users**: Choice between simple and comprehensive interfaces
- **Clear Mental Models**: Users understand what context they're in
- **Optimized Workflows**: Each context optimized for its use case

### Developer Experience Benefits
- **Clear Separation**: Easy to understand and modify
- **Independent Development**: User and admin features can be developed separately
- **Consistent Patterns**: Each context follows its own consistent patterns
- **Easy Testing**: Context-specific testing strategies

### System Benefits
- **Performance**: Optimized bundles for each context
- **Security**: Clear route protection and role-based access
- **Scalability**: Easy to add features to either context
- **Maintainability**: Clear separation of concerns

This architecture provides a solid foundation for separating user and admin functionality while maintaining the existing feature set and following modern web development best practices.