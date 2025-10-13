# Frontend Navigation UI Design Document

## Overview

This design document outlines the implementation of frontend navigation UI enhancements for the Mitsubishi Remote Control PWA. The enhancements focus on adding back button navigation from room control pages to the room list and improving MQTT status display synchronization with real-time updates.

### Design Goals
- Implement intuitive back button navigation for room control pages
- Enhance connection status display with real-time synchronization
- Maintain consistency with existing UI patterns and architecture
- Support both mobile and desktop user experiences
- Ensure offline functionality and graceful error handling

### Scope
- Navigation header component with back button functionality
- Enhanced connection status badge with real-time updates
- Integration with existing WebSocket client and Zustand store
- Mobile hardware back button support
- Error handling and offline scenarios

## Architecture Design

### System Architecture Diagram

```mermaid
graph TB
    A[Room Control Page] --> B[NavigationHeader Component]
    B --> C[BackButton Component]
    B --> D[ConnectionStatusBadge Component]
    
    C --> E[Next.js Router]
    E --> F[Room List Page]
    
    D --> G[ApiAirconStore]
    G --> H[WebSocket Client]
    H --> I[Backend WebSocket Server]
    I --> J[MQTT Broker]
    
    K[Navigation Hooks] --> C
    L[Status Update Service] --> D
    
    M[Mobile Hardware Back] --> N[Navigation Event Handler]
    N --> E
```

### Data Flow Diagram

```mermaid
graph LR
    A[WebSocket Message] --> B[WebSocketApiClient]
    B --> C[ApiAirconStore]
    C --> D[ConnectionStatusBadge]
    D --> E[Status UI Update]
    
    F[Back Button Click] --> G[useNavigateBack Hook]
    G --> H[Next.js Router]
    H --> I[Route Change]
    
    J[Hardware Back Button] --> K[Navigation Event Handler]
    K --> G
    
    L[MQTT Status Change] --> A
    M[WebSocket Connection Change] --> A
```

## Component Design

### NavigationHeader Component

**Responsibilities:**
- Provide consistent navigation header across room control pages
- Display back button and connection status
- Handle responsive layout for mobile and desktop
- Integrate with theme system

**Interfaces:**
```typescript
interface NavigationHeaderProps {
  roomName?: string;
  showBackButton?: boolean;
  customActions?: React.ReactNode;
  className?: string;
}

interface NavigationHeaderComponent {
  (props: NavigationHeaderProps): JSX.Element;
}
```

**Dependencies:**
- BackButton component
- ConnectionStatusBadge component
- Next.js useRouter hook
- Theme provider context

### BackButton Component

**Responsibilities:**
- Handle back navigation to room list
- Support keyboard navigation (Enter/Space)
- Provide haptic feedback on mobile devices
- Display appropriate loading states

**Interfaces:**
```typescript
interface BackButtonProps {
  fallbackRoute?: string;
  onNavigate?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
}

interface BackButtonComponent {
  (props: BackButtonProps): JSX.Element;
}
```

**Dependencies:**
- useNavigateBack custom hook
- Button UI component
- useHaptic hook
- Lucide React icons

### ConnectionStatusBadge Component

**Responsibilities:**
- Display real-time WebSocket and MQTT connection status
- Show different status states with appropriate visual indicators
- Handle status transitions with smooth animations
- Provide status tooltips with detailed information

**Interfaces:**
```typescript
interface ConnectionStatus {
  websocket: 'connected' | 'connecting' | 'disconnected' | 'error';
  mqtt: 'connected' | 'disconnected' | 'unknown';
  lastUpdate: number;
}

interface ConnectionStatusBadgeProps {
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'compact' | 'detailed';
  className?: string;
}

interface ConnectionStatusBadgeComponent {
  (props: ConnectionStatusBadgeProps): JSX.Element;
}
```

**Dependencies:**
- useAirconContext hook
- Badge UI component
- Tooltip UI component
- Framer Motion for animations

### Navigation Hooks

**useNavigateBack Hook:**
```typescript
interface UseNavigateBackOptions {
  fallbackRoute?: string;
  confirmNavigation?: boolean;
}

interface UseNavigateBackReturn {
  navigateBack: () => void;
  canGoBack: boolean;
  isNavigating: boolean;
}

interface UseNavigateBack {
  (options?: UseNavigateBackOptions): UseNavigateBackReturn;
}
```

**useConnectionStatus Hook:**
```typescript
interface UseConnectionStatusReturn {
  status: ConnectionStatus;
  isOnline: boolean;
  retryConnection: () => void;
  lastError: string | null;
}

interface UseConnectionStatus {
  (): UseConnectionStatusReturn;
}
```

## Data Model

### Connection Status Data Structure

```typescript
// Core connection status interface
interface ConnectionStatus {
  websocket: {
    state: 'connected' | 'connecting' | 'disconnected' | 'error';
    lastConnected: number | null;
    reconnectAttempts: number;
  };
  mqtt: {
    state: 'connected' | 'disconnected' | 'unknown';
    lastUpdate: number | null;
  };
  overall: 'healthy' | 'degraded' | 'disconnected';
}

// Navigation state interface
interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  canGoBack: boolean;
  isNavigating: boolean;
}

// Enhanced store state additions
interface ApiAirconStoreEnhancements {
  // Connection status tracking
  connectionStatus: ConnectionStatus;
  updateConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  
  // Navigation state
  navigationState: NavigationState;
  updateNavigationState: (state: Partial<NavigationState>) => void;
  
  // Status polling
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
}
```

### Connection Status Flow Diagram

```mermaid
sequenceDiagram
    participant WS as WebSocket Client
    participant Store as ApiAirconStore
    participant Badge as ConnectionStatusBadge
    participant UI as User Interface
    
    WS->>Store: Connection State Change
    Store->>Store: updateConnectionStatus()
    Store->>Badge: Status Update Notification
    Badge->>Badge: Process Status Change
    Badge->>UI: Re-render with New Status
    
    Note over Badge,UI: Smooth transition animations
    
    WS->>Store: MQTT Status Update
    Store->>Badge: MQTT Status Change
    Badge->>UI: Update MQTT Indicator
```

## Business Process

### Process 1: Back Button Navigation Flow

```mermaid
flowchart TD
    A[User on Room Control Page] --> B{Back Button Clicked?}
    B -->|Yes| C[useNavigateBack.navigateBack]
    B -->|No| D[Stay on Current Page]
    
    C --> E{Can Go Back?}
    E -->|Yes| F[router.back]
    E -->|No| G[router.push fallbackRoute]
    
    F --> H[Navigate to Previous Page]
    G --> I[Navigate to Room List]
    
    H --> J[Update Navigation State]
    I --> J
    J --> K[Trigger Haptic Feedback]
    K --> L[Complete Navigation]
```

### Process 2: Real-time Status Update Flow

```mermaid
flowchart TD
    A[WebSocket Receives Message] --> B[websocketClient.handleIncomingMessage]
    B --> C{Message Type?}
    
    C -->|mqtt-status| D[Store.setIsMqttConnected]
    C -->|connection-change| E[Store.setIsConnected]
    C -->|other| F[Handle Other Messages]
    
    D --> G[Store.updateConnectionStatus]
    E --> G
    
    G --> H[Notify Status Subscribers]
    H --> I[ConnectionStatusBadge.useConnectionStatus]
    I --> J{Status Changed?}
    
    J -->|Yes| K[Trigger Status Animation]
    J -->|No| L[No UI Update Needed]
    
    K --> M[Update Badge Visual State]
    M --> N[Show Status Tooltip if Hover]
    N --> O[Status Update Complete]
```

### Process 3: Hardware Back Button Integration

```mermaid
flowchart TD
    A[Mobile Hardware Back Pressed] --> B[Navigation Event Handler]
    B --> C{On Room Control Page?}
    
    C -->|Yes| D[Prevent Default Behavior]
    C -->|No| E[Allow Default Navigation]
    
    D --> F[Call useNavigateBack.navigateBack]
    F --> G[Navigate to Room List]
    G --> H[Update Navigation History]
```

## Error Handling Strategy

### Connection Error Handling

```typescript
// Connection error recovery strategy
interface ConnectionErrorHandler {
  handleWebSocketError: (error: WebSocketError) => void;
  handleMqttError: (error: MqttError) => void;
  retryConnection: (type: 'websocket' | 'mqtt') => Promise<void>;
  showErrorNotification: (message: string, type: 'warning' | 'error') => void;
}

// Error states and recovery actions
const ErrorHandlingStrategy = {
  websocketDisconnected: {
    action: 'Show reconnection status',
    retry: 'Exponential backoff (max 10 attempts)',
    fallback: 'Cache last known state'
  },
  mqttDisconnected: {
    action: 'Show MQTT offline status',
    retry: 'Request status update every 30s',
    fallback: 'Disable control commands'
  },
  navigationError: {
    action: 'Fallback to home route',
    retry: 'None',
    fallback: 'Show error boundary'
  }
};
```

### Error Recovery Process

```mermaid
flowchart TD
    A[Error Detected] --> B{Error Type?}
    
    B -->|WebSocket Error| C[Update Connection Status]
    B -->|Navigation Error| D[Fallback to Home Route]
    B -->|Component Error| E[Show Error Boundary]
    
    C --> F[Start Reconnection Process]
    F --> G[Show Reconnecting Status]
    G --> H[Attempt Reconnection]
    H --> I{Success?}
    
    I -->|Yes| J[Update Status to Connected]
    I -->|No| K{Max Attempts Reached?}
    
    K -->|No| L[Wait and Retry]
    K -->|Yes| M[Show Manual Retry Option]
    
    L --> H
    J --> N[Resume Normal Operation]
    M --> O[User Manual Retry]
    O --> F
```

## Testing Strategy

### Unit Testing

**Component Testing:**
- NavigationHeader component rendering with different props
- BackButton click handling and navigation logic
- ConnectionStatusBadge status display variations
- Hook behaviors under different state conditions

**Integration Testing:**
- Navigation flow from room control to room list
- Status updates propagation through WebSocket → Store → Components
- Hardware back button event handling
- Error scenarios and recovery mechanisms

### End-to-End Testing

**User Journey Tests:**
```typescript
describe('Navigation UI Features', () => {
  test('User can navigate back from room control to room list', async () => {
    // Test navigation flow
  });
  
  test('Connection status updates in real-time', async () => {
    // Test WebSocket status changes
  });
  
  test('Hardware back button works on mobile', async () => {
    // Test mobile hardware back button
  });
  
  test('Offline scenarios handled gracefully', async () => {
    // Test offline functionality
  });
});
```

### Performance Testing

**Metrics to Monitor:**
- Status update response time (<100ms)
- Navigation transition time (<200ms)
- Memory usage during status polling
- Battery impact on mobile devices

**Optimization Targets:**
- Debounce status updates to prevent excessive re-renders
- Lazy load navigation components
- Minimize WebSocket message frequency
- Cache navigation history efficiently

## Implementation Notes

### Integration with Existing Architecture

**WebSocket Client Enhancement:**
- Extend `WebSocketApiClient` with enhanced status tracking
- Add connection state change notifications
- Implement status polling with configurable intervals

**Zustand Store Updates:**
- Add navigation state management
- Enhance connection status tracking
- Implement status change notifications

**Component Integration:**
- Update room control page to use NavigationHeader
- Maintain existing status display while enhancing functionality
- Ensure theme consistency across new components

### Mobile Considerations

**Hardware Back Button:**
```typescript
// Mobile back button handler
useEffect(() => {
  const handlePopState = (event: PopStateEvent) => {
    if (isOnRoomControlPage) {
      event.preventDefault();
      navigateBack();
    }
  };
  
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [isOnRoomControlPage, navigateBack]);
```

**Touch Interactions:**
- Haptic feedback for navigation actions
- Swipe gestures for back navigation (future enhancement)
- Touch-friendly button sizes and spacing

### Accessibility

**Keyboard Navigation:**
- Tab navigation through header components
- Enter/Space key support for back button
- Screen reader announcements for status changes

**Visual Indicators:**
- High contrast status colors
- Clear visual hierarchy
- Appropriate focus indicators

This design document provides a comprehensive foundation for implementing the frontend navigation UI enhancements while maintaining consistency with the existing architecture and ensuring optimal user experience across all devices and scenarios.