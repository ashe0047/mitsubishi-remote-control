# Rooms Page - Implementation Plan

## Implementation Overview
This document provides a step-by-step implementation plan for creating the `/rooms` page following the design specifications and clean code principles established in the design document.

## Phase 1: Core Implementation (Priority: HIGH)

### Task 1.1: Create Room Access Utilities
**Duration**: 20 minutes
**File**: `/src/lib/utils/room-access.ts`

**Steps**:
1. Create the room access utility module with Strategy pattern implementation
2. Define interfaces for room access strategies
3. Implement role-specific strategies (Parent, Child, Guest)
4. Add utility functions for room filtering and page content

**Code Implementation**:
```typescript
// /src/lib/utils/room-access.ts
import { User } from '@/types/auth';
import { hasPermission, FamilyPermission } from '@/types/family';

export interface Room {
  roomId: string;
  roomName: string;
}

export interface RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[];
  getPageTitle(user: User): string;
  getPageDescription(user: User): string;
}

export class ParentRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return allRooms; // Parents see all rooms
  }

  getPageTitle(user: User): string {
    return "All Rooms";
  }

  getPageDescription(user: User): string {
    return "Manage and control all family rooms";
  }
}

export class ChildRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    // TODO: In future, filter based on room assignments
    // For now, show all rooms but with different title
    return allRooms;
  }

  getPageTitle(user: User): string {
    return "My Rooms";
  }

  getPageDescription(user: User): string {
    return "Your assigned rooms";
  }
}

export class GuestRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return []; // Guests see no rooms
  }

  getPageTitle(user: User): string {
    return "Rooms";
  }

  getPageDescription(user: User): string {
    return "Please log in to access rooms";
  }
}

export const getRoomAccessStrategy = (userRole?: string): RoomAccessStrategy => {
  switch (userRole) {
    case 'parent':
      return new ParentRoomStrategy();
    case 'child':
      return new ChildRoomStrategy();
    default:
      return new GuestRoomStrategy();
  }
};

export interface RoomAccessConfig {
  user: User;
  rooms: Room[];
}

export const filterAccessibleRooms = (config: RoomAccessConfig): Room[] => {
  const strategy = getRoomAccessStrategy(config.user.role);
  return strategy.filterRooms(config.rooms, config.user);
};

export const getRoleBasedPageContent = (user?: User) => {
  const strategy = getRoomAccessStrategy(user?.role);
  return {
    title: strategy.getPageTitle(user),
    description: strategy.getPageDescription(user)
  };
};
```

### Task 1.2: Enhance RoomList Component
**Duration**: 15 minutes
**File**: `/src/components/room/RoomList.tsx`

**Steps**:
1. Add optional props for title and description override
2. Maintain backward compatibility with existing usage
3. Update the title display logic to use props when provided

**Code Changes**:
```typescript
// Add to RoomList component interface
export interface RoomListProps {
  title?: string;           // NEW: Override default title
  description?: string;     // NEW: Override default description
  className?: string;       // EXISTING
}

// Update component implementation
export default function RoomsList({ title, description, className }: RoomListProps = {}) {
  // ... existing code ...

  const displayTitle = title || "My Spaces";
  const displayDescription = description || (
    isLoading
      ? "Discovering rooms..."
      : hasError
      ? "Connection issue - showing cached rooms"
      : "Select a room to control its climate"
  );

  // Update JSX
  <h1 className="text-3xl font-light tracking-tight mb-2">
    {displayTitle}
  </h1>
  <p className="text-muted-foreground text-sm">
    {displayDescription}
  </p>
```

### Task 1.3: Create Main Rooms Page
**Duration**: 30 minutes
**File**: `/src/app/rooms/page.tsx`

**Steps**:
1. Create the main page component with authentication
2. Implement role-based room filtering
3. Add proper error handling and loading states
4. Follow established patterns from other dashboard pages

**Code Implementation**:
```typescript
// /src/app/rooms/page.tsx
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import RoomsList from '@/components/room/RoomList';
import { getRoleBasedPageContent } from '@/lib/utils/room-access';

/**
 * Rooms Page - Role-based room listing
 * Shows "All Rooms" for parents, "My Rooms" for children
 */
export default function RoomsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/rooms');
      return;
    }
  }, [isAuthenticated, router]);

  // Show loading while checking auth state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Get role-based page content
  const { title, description } = getRoleBasedPageContent(user);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <RoomsList
          title={title}
          description={description}
        />
      </div>
    </div>
  );
}
```

## Phase 2: Enhancement and Testing (Priority: MEDIUM)

### Task 2.1: Add Page Metadata
**Duration**: 10 minutes

**Steps**:
1. Add proper Next.js metadata for the rooms page
2. Include role-based page titles in browser tab

**Code Addition**:
```typescript
// Add to /src/app/rooms/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rooms | Mitsubishi AC Control',
  description: 'Access and control your air conditioning units',
};
```

### Task 2.2: Error Boundary Integration
**Duration**: 15 minutes

**Steps**:
1. Add error boundary around room listing
2. Handle WebSocket connection errors gracefully
3. Provide retry mechanisms for failed connections

**Code Enhancement**:
```typescript
// Add error boundary wrapper in RoomsPage
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({error, resetErrorBoundary}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4 text-center">
        Unable to load rooms. Please try again.
      </p>
      <Button onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

// Wrap RoomsList in ErrorBoundary
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => window.location.reload()}
>
  <RoomsList title={title} description={description} />
</ErrorBoundary>
```

### Task 2.3: Add Loading States
**Duration**: 10 minutes

**Steps**:
1. Add skeleton loading state for initial page load
2. Ensure smooth transitions between loading and content states

## Phase 3: Advanced Features (Priority: LOW)

### Task 3.1: Room Permission Integration (Future)
**Duration**: 30 minutes

**Steps**:
1. Integrate with family API for actual room assignments
2. Filter rooms based on real permission data
3. Add permission indicators to room cards

### Task 3.2: Enhanced Empty States
**Duration**: 15 minutes

**Steps**:
1. Add role-specific empty state messages
2. Provide helpful guidance for users with no room access
3. Add call-to-action buttons for parents to assign rooms

## Testing Strategy

### Task 4.1: Component Testing
**Duration**: 25 minutes

**Test Cases**:
1. **Authentication Flow Test**:
   - Unauthenticated user redirects to login
   - Authenticated user sees appropriate content
   - Loading states display correctly

2. **Role-Based Display Test**:
   - Parent user sees "All Rooms" title
   - Child user sees "My Rooms" title
   - Content matches user role

3. **Room Filtering Test**:
   - Room access utilities return correct filtered rooms
   - Strategy pattern works for different roles
   - Empty states handle no rooms gracefully

4. **Navigation Test**:
   - Room card navigation to `/rooms/{roomId}` works
   - Browser back button functions correctly
   - URL routing is correct

### Task 4.2: Integration Testing
**Duration**: 20 minutes

**Test Scenarios**:
1. **End-to-End User Flow**:
   - Login as parent → Navigate to rooms → See all rooms
   - Login as child → Navigate to rooms → See appropriate rooms
   - WebSocket connection → Real-time updates work

2. **Error Handling Test**:
   - Network disconnection → Fallback to cached rooms
   - Authentication expiry → Redirect to login
   - WebSocket errors → Graceful degradation

### Task 4.3: Accessibility Testing
**Duration**: 15 minutes

**Accessibility Checks**:
1. **Keyboard Navigation**: Tab through all interactive elements
2. **Screen Reader**: Verify ARIA labels and structure
3. **Color Contrast**: Ensure all text meets WCAG requirements
4. **Mobile Touch**: Verify touch targets meet 44px minimum

## Build and Deployment

### Task 5.1: Build Verification
**Duration**: 10 minutes

**Commands**:
```bash
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend

# Type checking
pnpm exec tsc --noEmit

# Linting
pnpm lint

# Build verification
pnpm build

# Test development server
pnpm dev
```

### Task 5.2: Performance Testing
**Duration**: 10 minutes

**Performance Checks**:
1. **Load Time**: Page loads within 2 seconds
2. **Rendering**: No layout shifts during load
3. **WebSocket**: Real-time updates within 1 second
4. **Memory**: No memory leaks during navigation

## Risk Mitigation

### Potential Issues
1. **WebSocket Connection**: May fail in certain network environments
2. **Room Data**: Static config may not match dynamic data
3. **Performance**: Large number of rooms may impact performance
4. **Permissions**: Role changes may not immediately reflect

### Mitigation Strategies
1. **Progressive Enhancement**: Graceful fallback to static room data
2. **Error Boundaries**: Comprehensive error handling with recovery options
3. **Loading States**: Responsive feedback for all user actions
4. **Cache Strategy**: Intelligent caching of room data and permissions

## Success Metrics

### Functional Metrics
- [ ] `/rooms` page loads without 404 error
- [ ] Parent users see "All Rooms" with complete listing
- [ ] Child users see "My Rooms" with appropriate content
- [ ] Real-time room status updates function correctly
- [ ] Navigation to individual rooms works seamlessly
- [ ] Authentication redirects work properly

### Technical Metrics
- [ ] Page load time < 2 seconds
- [ ] No TypeScript compilation errors
- [ ] ESLint passes without warnings
- [ ] Build completes successfully
- [ ] All tests pass

### User Experience Metrics
- [ ] Mobile responsiveness maintained
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Error states provide helpful guidance
- [ ] Loading states provide appropriate feedback

## Post-Implementation Tasks

### Immediate Follow-ups
1. **Documentation**: Update README with new page information
2. **User Testing**: Gather feedback from different user roles
3. **Performance Monitoring**: Monitor page load times and WebSocket performance
4. **Error Tracking**: Set up error monitoring for the new page

### Future Enhancements
1. **Room Search**: Add search functionality for users with many rooms
2. **Room Grouping**: Implement location-based room organization
3. **Bulk Controls**: Add ability to control multiple rooms simultaneously
4. **Room Assignments**: Direct integration with family management for room assignments

This implementation plan ensures a systematic approach to building the rooms page while maintaining code quality and following established patterns. The phased approach allows for incremental delivery and testing at each stage.