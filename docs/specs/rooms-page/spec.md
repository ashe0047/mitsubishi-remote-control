# Rooms Page Implementation

## Overview
Implement the missing `/rooms` page that serves as the primary room listing and access interface for all users in the Mitsubishi AC Control application.

## Problem Statement
The `/rooms` page is referenced throughout the codebase as a critical navigation destination but currently returns a 404 error. This page serves as:
- Primary landing page for child users
- Main room listing for all users
- Fallback redirect for users without permissions
- Entry point to individual room controls

## Requirements

### Functional Requirements

#### 1. Role-Based Access Control
- **Parent Users**: Display "All Rooms" with full room listing and management options
- **Child Users**: Display "My Rooms" showing only assigned rooms based on permissions
- **Guest Users**: Redirect to authentication with proper return path

#### 2. Room Listing Display
- **Room Cards**: Show interactive cards for each accessible room
- **Real-time Status**: Display current temperature, AC status, and online state
- **Connection State**: Handle both connected and offline states gracefully
- **Empty States**: Proper messaging when no rooms are available or accessible

#### 3. Navigation Integration
- **Room Selection**: Navigate to `/rooms/{roomId}` for individual room control
- **Breadcrumb Support**: Integrate with existing navigation breadcrumb system
- **Back Navigation**: Support browser back button and navigation history

#### 4. Permission Enforcement
- **Room Filtering**: Only show rooms user has access to view/control
- **Visual Indicators**: Show permission levels (view-only, control, admin)
- **Access Denial**: Graceful handling of unauthorized room access

### Technical Requirements

#### 1. Component Integration
- **Reuse RoomList**: Leverage existing `RoomList` component with enhancements
- **Family Integration**: Connect with family permission system
- **Auth Integration**: Proper authentication state management
- **App Config**: Use room configuration from app config context

#### 2. State Management
- **WebSocket Connection**: Real-time room status updates
- **Offline Handling**: Fallback to cached/static room data
- **Loading States**: Proper loading indicators during data fetching
- **Error Recovery**: Robust error handling with retry mechanisms

#### 3. Performance Requirements
- **Fast Loading**: Page loads in < 2 seconds
- **Real-time Updates**: Status updates within 1 second of changes
- **Responsive Design**: Mobile-first design with touch-friendly controls
- **Progressive Enhancement**: Works with JavaScript disabled

### User Experience Requirements

#### 1. Visual Design
- **Consistent UI**: Follow established ShadcnUI component patterns
- **Role Indicators**: Clear visual distinction between "All Rooms" and "My Rooms"
- **Status Visualization**: Intuitive status indicators (online, offline, active)
- **Accessibility**: WCAG 2.1 AA compliance with screen reader support

#### 2. Interaction Design
- **Touch Friendly**: Minimum 44px touch targets for mobile
- **Keyboard Navigation**: Full keyboard accessibility
- **Gesture Support**: Swipe gestures for mobile navigation
- **Haptic Feedback**: Use existing haptic feedback system

#### 3. Information Architecture
- **Room Grouping**: Logical grouping by location or assignment
- **Search/Filter**: Quick search and filtering capabilities (future enhancement)
- **Status Summary**: Overview of total rooms and their states
- **Quick Actions**: Fast access to common controls

## Success Criteria
- [ ] `/rooms` page loads without 404 error
- [ ] Parents see "All Rooms" with complete room listing
- [ ] Children see "My Rooms" with only assigned rooms
- [ ] Real-time status updates function correctly
- [ ] Navigation to individual rooms works properly
- [ ] Offline/error states handled gracefully
- [ ] Mobile responsiveness maintained
- [ ] Authentication redirects work correctly

## Acceptance Criteria

### Room Access Control
1. **GIVEN** a parent user visits `/rooms`
2. **WHEN** the page loads
3. **THEN** they see "All Rooms" with complete room listing
4. **AND** all rooms are accessible for control

### Child Room Restrictions
1. **GIVEN** a child user visits `/rooms`
2. **WHEN** the page loads
3. **THEN** they see "My Rooms" with only assigned rooms
4. **AND** unassigned rooms are not visible

### Room Navigation
1. **GIVEN** a user selects a room card
2. **WHEN** they click/tap the room
3. **THEN** they navigate to `/rooms/{roomId}`
4. **AND** the individual room control page loads

### Real-time Updates
1. **GIVEN** a room's AC status changes
2. **WHEN** the WebSocket receives the update
3. **THEN** the room card reflects the new status
4. **AND** the change is visible within 1 second

### Offline Handling
1. **GIVEN** the WebSocket connection is lost
2. **WHEN** the user visits `/rooms`
3. **THEN** cached room data is displayed
4. **AND** appropriate offline indicators are shown

## Priority
**HIGH** - Critical navigation destination blocking user access

## Dependencies
- Existing RoomList component and RoomCard components
- Family permission system and role-based access control
- WebSocket MQTT client for real-time updates
- Authentication system and auth store
- App configuration system for room definitions
- Navigation breadcrumb system

## Current State Analysis
Based on codebase analysis:

### Missing Implementation
- **`/src/app/rooms/page.tsx`**: Primary page component missing entirely

### Existing Assets
- **`RoomList` Component**: Fully functional component at `/src/components/room/RoomList.tsx`
- **`RoomCard` Component**: Individual room cards with navigation
- **Navigation Integration**: FamilyNavigation already references `/rooms`
- **Permission System**: Role-based access control implemented
- **Auth Redirects**: Multiple redirect patterns already point to `/rooms`

### Integration Points
- **Line 101**: FamilyNavigation.tsx references `/rooms` route
- **Line 28**: Dashboard page redirects children to `/rooms`
- **Line 266**: Auth client redirects children to `/rooms`
- **Line 30**: Various permission failures redirect to `/rooms`

## Implementation Scope
1. **Create main page component** at `/src/app/rooms/page.tsx`
2. **Add role-based filtering** for room access control
3. **Integrate authentication** with proper redirect handling
4. **Enhance RoomList** for role-based display variations
5. **Add permission checks** for room visibility

## Out of Scope
- Room search and filtering capabilities (future enhancement)
- Room grouping by location (future enhancement)
- Bulk room controls (future enhancement)
- Room assignment modifications (handled by `/dashboard/rooms`)
- New room discovery/setup (handled by configuration)

## Constraints
- Must maintain compatibility with existing navigation patterns
- Cannot break current individual room page routing (`/rooms/{roomId}`)
- Must preserve existing RoomCard and RoomList functionality
- Should not duplicate room assignment functionality from `/dashboard/rooms`
- Must work within existing authentication and permission framework