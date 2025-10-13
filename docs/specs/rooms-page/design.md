# Rooms Page - Technical Design Document

## Architecture Overview

This document outlines the technical design for implementing the `/rooms` page following clean code principles and design patterns. The architecture leverages existing components while adding role-based access control and authentication.

## Sequential Thinking Analysis

### Clean Code Principles Application

#### DRY (Don't Repeat Yourself)
- **Component Reuse**: Leverage existing `RoomList` and `RoomCard` components instead of rebuilding room listing logic
- **Authentication Patterns**: Use established auth patterns from other dashboard pages (`/dashboard/family/page.tsx`)
- **Permission Checking**: Reuse existing `hasPermission` function and `FamilyPermission` enum
- **Context Integration**: Utilize existing `AppConfigContext` and `useAuthStore` patterns

#### SOLID Principles Implementation

**Single Responsibility Principle (SRP)**:
- **RoomsPage Component**: Handle authentication, routing, and role-based access control only
- **RoomList Component**: Maintain current responsibility for room display and real-time updates
- **Room Access Service**: Handle room filtering logic based on user permissions
- **Auth Guard Logic**: Handle unauthorized access redirects

**Open/Closed Principle (OCP)**:
- **Room Filtering Strategy**: Design as pluggable utility functions for future role extensions
- **Permission System**: Allow new role types without modifying core page logic
- **Component Enhancement**: Extend RoomList with props rather than modifying internal logic

**Liskov Substitution Principle (LSP)**:
- **Role Types**: Ensure any user role can be substituted in permission checking logic
- **Room Data**: Maintain compatibility with existing room data structures

**Interface Segregation Principle (ISP)**:
- **Room Access Interface**: Create focused interfaces for room visibility vs. control permissions
- **User Interface**: Don't force child users to know about parent-only room management features

**Dependency Inversion Principle (DIP)**:
- **Auth Abstraction**: Depend on `useAuthStore` abstraction rather than concrete auth implementation
- **Permission Abstraction**: Use `hasPermission` utility rather than hardcoded role checks
- **Room Filtering**: Abstract filtering logic into reusable utilities

#### YAGNI (You Ain't Gonna Need It)
**Implement Now (Required)**:
- Basic page component with authentication and role checking
- Room filtering based on current user permissions
- Integration with existing RoomList component
- Role-based page titles ("All Rooms" vs "My Rooms")

**Avoid Over-Engineering (Future Enhancement)**:
- Room search functionality (no current user stories)
- Room grouping by location (not in requirements)
- Bulk room controls (no current need)
- Advanced filtering options (premature optimization)

### Design Pattern Analysis

#### Selected Patterns

**1. Strategy Pattern - Room Access Control**
```typescript
interface RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[];
  getPageTitle(user: User): string;
  getPageDescription(user: User): string;
}

class ParentRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return allRooms; // Parents see all rooms
  }
  getPageTitle(): string { return "All Rooms"; }
}

class ChildRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return allRooms.filter(room => hasRoomAccess(user, room));
  }
  getPageTitle(): string { return "My Rooms"; }
}
```

**Benefits**: Extensible for new roles, testable, follows OCP
**Trade-off**: More complex than simple conditionals, but better for maintainability

**2. Provider Pattern - Data Access**
- Continue leveraging `AppConfigContext` for room configuration
- Use `useAuthStore` for user state management
- Utilize `useAirconContext` for real-time room status

**3. Higher-Order Component Pattern - Authentication**
- Wrap RoomList with authentication and permission logic
- Similar pattern used in `/dashboard/family/page.tsx`
- Maintains separation of concerns

#### Pattern Trade-off Analysis

**Strategy vs Conditional Logic**:
- **Complexity**: Strategy adds more files but improves testability
- **Extensibility**: Strategy easily supports new roles (admin, guest, etc.)
- **Maintainability**: Strategy isolates role-specific logic
- **Decision**: Use Strategy pattern for future-proofing

**New Component vs Component Enhancement**:
- **Reuse**: Enhancement maximizes existing component reuse
- **Complexity**: New component would duplicate existing logic
- **Maintenance**: Enhancement reduces code duplication
- **Decision**: Enhance RoomList with minimal role-aware props

## Component Architecture

### File Structure
```
/src/app/rooms/
├── page.tsx                    # Main page component (NEW)
└── layout.tsx                  # Optional layout (FUTURE)

/src/lib/utils/
└── room-access.ts              # Room filtering utilities (NEW)

/src/components/room/
├── RoomList.tsx                # Enhanced with role props (MODIFIED)
├── RoomCard.tsx                # No changes (EXISTING)
└── RoomListWrapper.tsx         # Optional wrapper (FUTURE)
```

### Component Hierarchy
```
RoomsPage
├── Authentication & Role Checking
├── Error Boundary
└── RoomList (Enhanced)
    ├── Role-based Title Display
    ├── Filtered Room Data
    └── RoomCard[] (Unchanged)
        └── Navigation to /rooms/{roomId}
```

## API Design

### Room Access Utilities
```typescript
// /src/lib/utils/room-access.ts
export interface RoomAccessConfig {
  user: User;
  rooms: Room[];
  permissions?: string[];
}

export const getRoomAccessStrategy = (userRole: string): RoomAccessStrategy => {
  switch (userRole) {
    case 'parent': return new ParentRoomStrategy();
    case 'child': return new ChildRoomStrategy();
    default: return new GuestRoomStrategy();
  }
};

export const filterAccessibleRooms = (config: RoomAccessConfig): Room[] => {
  const strategy = getRoomAccessStrategy(config.user.role);
  return strategy.filterRooms(config.rooms, config.user);
};

export const getRoleBasedPageContent = (userRole: string) => {
  const strategy = getRoomAccessStrategy(userRole);
  return {
    title: strategy.getPageTitle(),
    description: strategy.getPageDescription()
  };
};
```

### Enhanced RoomList Props
```typescript
// Minimal enhancement to existing RoomList component
interface RoomListProps {
  title?: string;           // NEW: Role-based title
  description?: string;     // NEW: Role-based description
  filteredRooms?: Room[];   // NEW: Pre-filtered room data
  className?: string;       // EXISTING
}
```

## State Management

### Data Flow
1. **Authentication**: `useAuthStore` → User role and auth state
2. **Room Configuration**: `AppConfigContext` → Static room definitions
3. **Real-time Data**: `useAirconContext` → Live room status updates
4. **Room Filtering**: Utility functions → Role-based room access
5. **Display**: Enhanced RoomList → Filtered room presentation

### No New State Required
- Leverage existing Zustand stores and React contexts
- No additional state management complexity
- Maintain existing real-time update patterns

## Integration Points

### Authentication Integration
```typescript
// Pattern from /dashboard/family/page.tsx
const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

useEffect(() => {
  if (!isAuthenticated) {
    router.push('/auth/login?redirect=/rooms');
    return;
  }
}, [isAuthenticated, router]);
```

### Permission Integration
```typescript
// Existing permission patterns
import { hasPermission, FamilyPermission } from '@/types/family';

const canViewAllRooms = user && hasPermission(user.role, FamilyPermission.VIEW_ALL_ROOMS);
const accessibleRooms = filterAccessibleRooms({ user, rooms: allRooms });
```

### WebSocket Integration
```typescript
// Existing real-time patterns
const { getRoomsList, isConnected, isDiscoveringRooms } = useAirconContext();
const dynamicRooms = getRoomsList();
```

## Security Considerations

### Access Control
- **Route Protection**: Authentication required before accessing rooms
- **Room Filtering**: Server-side room assignment validation (future)
- **Permission Checks**: Role-based room visibility enforcement
- **Secure Redirects**: Validate redirect URLs to prevent open redirects

### Data Privacy
- **Child Users**: Only see assigned rooms, no access to unassigned rooms
- **Parent Users**: Full visibility with appropriate permission checks
- **Guest Users**: No room access, immediate auth redirect

## Performance Considerations

### Optimization Strategies
- **Component Reuse**: Leverage existing optimized RoomList component
- **Memo Optimization**: Use React.memo for room filtering results
- **Lazy Loading**: Room status loaded on-demand by existing WebSocket system
- **Caching**: Utilize existing room configuration caching

### Loading States
- **Initial Load**: Show loading spinner during auth check
- **Room Discovery**: Existing loading states in RoomList component
- **Real-time Updates**: Non-blocking status updates via WebSocket

## Error Handling

### Authentication Errors
- **Unauthenticated**: Redirect to `/auth/login?redirect=/rooms`
- **Authorization Failed**: Redirect to appropriate fallback page
- **Session Expired**: Automatic login redirect with return path

### Room Access Errors
- **No Rooms Available**: Show appropriate empty state message
- **WebSocket Disconnected**: Fallback to cached room data
- **Permission Denied**: Graceful degradation with limited functionality

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility for room selection
- **Screen Reader Support**: Proper ARIA labels and role descriptions
- **Focus Management**: Logical tab order and focus indicators
- **Color Contrast**: Maintain existing design system contrast ratios

### Mobile Accessibility
- **Touch Targets**: Minimum 44px touch targets (maintained by existing RoomCard)
- **Gesture Support**: Existing swipe and tap gestures
- **Screen Size**: Responsive design with existing breakpoints

## Architecture Quality Assessment

### Cohesion Analysis
- **High Cohesion**: Each component has a single, well-defined responsibility
- **RoomsPage**: Authentication and role-based access control only
- **Room Access Utils**: Room filtering and permission logic only
- **RoomList**: Room display and real-time updates only

### Coupling Analysis
- **Low Coupling**: Minimal dependencies between components
- **Loose Coupling**: Interface-based dependencies via utilities
- **Dependency Direction**: Page → Utils → Store/Context (unidirectional)

### Separation of Concerns
- **Authentication**: Isolated in page component using existing patterns
- **Permission Logic**: Abstracted into reusable utility functions
- **Room Display**: Maintained in existing RoomList component
- **Real-time Updates**: Handled by existing WebSocket integration
- **Navigation**: Preserved in existing RoomCard component

## Future Enhancement Considerations

### Extensibility Points
- **New Role Types**: Strategy pattern easily accommodates additional roles
- **Room Grouping**: Can be added to room access utilities without breaking changes
- **Search/Filter**: Can be integrated into RoomList component as additional props
- **Bulk Actions**: Can be added as new components without modifying existing logic

### Backward Compatibility
- **Existing Routes**: No changes to `/rooms/{roomId}` individual room pages
- **Component API**: RoomList enhancement maintains backward compatibility
- **Navigation**: Existing navigation patterns preserved
- **State Management**: No breaking changes to existing stores or contexts

This design provides a solid foundation for the rooms page while maintaining clean architecture principles and ensuring future extensibility.