# Room Auto-Discovery Technical Design

## Architecture Overview

This design leverages the existing WebSocket infrastructure to enable dynamic room discovery while maintaining backward compatibility with the current static configuration approach.

## Current State Analysis

### Existing Infrastructure
- **WebSocket Client**: Already implements `requestRoomsList()` method
- **Store Management**: `ApiAirconStore` has `setRooms()` and `rooms` state
- **Data Structures**: `RoomInfo` interface is properly defined
- **UI Components**: `RoomList` currently uses static `AppConfigContext`

### Data Flow Transformation

**Current Flow (Static)**:
```
YAML Config → AppConfigContext → RoomList Component
```

**New Flow (Dynamic)**:
```
WebSocket Connect → requestRoomsList() → WebSocket Response → ApiAirconStore.setRooms() → RoomList Component
```

## Component Architecture Design

### 1. RoomList Component Modifications

**Key Changes**:
- Replace `AppConfigContext` usage with `useAirconContext()` hook
- Implement hybrid data source strategy (dynamic + static fallback)
- Add loading and error state handling
- Create data adapter for structure compatibility

**Implementation Strategy**:
```typescript
const RoomsList = () => {
  // Get both dynamic and static data
  const staticRooms = useContext(AppConfigContext)?.rooms || [];
  const { rooms: dynamicRooms, isConnected, isDiscoveringRooms } = useAirconContext();
  
  // Hybrid data source with priority
  const rooms = isConnected && Object.keys(dynamicRooms).length > 0 
    ? Object.values(dynamicRooms).map(adaptRoomInfo)
    : staticRooms;
}
```

### 2. Data Structure Compatibility

**Current Interface** (Static Config):
```typescript
interface StaticRoom {
  roomName: string;
  roomId: string;
}
```

**WebSocket Interface** (Dynamic):
```typescript
interface RoomInfo {
  id: string;
  name: string;
  online: boolean;
  settings?: AirConSettings;
  state?: AirConState;
}
```

**Adapter Function**:
```typescript
const adaptRoomInfo = (roomInfo: RoomInfo) => ({
  roomName: roomInfo.name,
  roomId: roomInfo.id,
  online: roomInfo.online // Additional status information
});
```

### 3. State Management Enhancements

**Additional Store State**:
```typescript
interface ApiAirconStoreState {
  // Existing state...
  
  // New room discovery states
  isDiscoveringRooms: boolean;
  roomDiscoveryError: string | null;
  roomsLastUpdated: number | null;
  
  // New methods
  setIsDiscoveringRooms: (discovering: boolean) => void;
  setRoomDiscoveryError: (error: string | null) => void;
  getRoomsList: () => RoomInfo[];
}
```

**Performance Optimization**:
- Use specific Zustand selectors to prevent unnecessary re-renders
- Implement React.memo for RoomCard components
- Maintain efficient Record<string, RoomInfo> structure for lookups

## Real-time Updates Architecture

### WebSocket Message Flow
1. **Initial Discovery**: `requestRoomsList()` on connection
2. **Status Updates**: Real-time room online/offline changes via existing streams
3. **Reconnection**: Automatic re-discovery on WebSocket reconnection

### UI State Updates
```typescript
// In ApiAirconProvider message handler
case 'rooms':
  state.setRooms(data as RoomInfo[]);
  state.setIsDiscoveringRooms(false);
  state.setRoomDiscoveryError(null);
  break;
```

## Loading and Error State Design

### Loading States
1. **Initial Connection**: Skeleton loader while WebSocket connects
2. **Room Discovery**: Spinner during `requestRoomsList()` execution
3. **Real-time Updates**: Smooth transitions for room status changes

### Error Handling Strategy
```typescript
const ErrorStates = {
  CONNECTION_FAILED: 'WebSocket connection failed',
  DISCOVERY_TIMEOUT: 'Room discovery timed out',
  NO_ROOMS_FOUND: 'No rooms available'
};
```

**Fallback Behavior**:
- WebSocket fails → Use static config if available
- Discovery timeout → Show error + retry option
- Partial failures → Show available rooms + error notice

## Visual Status Indicators

### Room Online Status
- **Online**: Green indicator dot
- **Offline**: Gray indicator with crossed-out icon  
- **Connecting**: Yellow pulsing indicator

### Implementation in RoomCard
```typescript
const StatusIndicator = ({ online }: { online: boolean }) => (
  <div className={cn(
    "w-2 h-2 rounded-full",
    online ? "bg-green-500" : "bg-gray-400"
  )} />
);
```

## Migration and Compatibility Strategy

### Phase 1: Hybrid Implementation
- Support both static config and dynamic discovery
- Dynamic takes precedence when available
- Static config as fallback

### Phase 2: Full Migration (Future)
- Remove static configuration dependency
- Pure WebSocket-based discovery
- Enhanced room management features

### Backward Compatibility
- Existing routing patterns preserved (`/rooms/[roomId]`)
- Component props and interfaces unchanged
- Navigation behavior maintained

## Performance Considerations

### Optimization Strategies
1. **Efficient Selectors**: Use targeted Zustand selectors
2. **Memoization**: React.memo for room cards
3. **Animation Performance**: Maintain existing AnimatePresence patterns
4. **Memory Management**: Proper WebSocket cleanup

### Expected Performance Impact
- **Room Discovery**: <5 seconds initial load
- **Status Updates**: <2 seconds real-time latency
- **UI Rendering**: No degradation from current performance

## Integration Points

### WebSocket Client
- Leverage existing `requestRoomsList()` method
- Use existing message handling in `ApiAirconProvider`
- Maintain current reconnection and error handling

### Store Integration
```typescript
// Enhanced room management methods
getRoomsList: () => Object.values(state.rooms),
isRoomOnline: (roomId: string) => state.rooms[roomId]?.online ?? false,
getRoomCount: () => Object.keys(state.rooms).length
```

### Component Integration
- Minimal changes to existing UI components
- Preserve current styling and animation patterns
- Maintain accessibility and responsive design

## Security and Reliability

### Data Validation
- Validate WebSocket responses using existing Zod schemas
- Sanitize room names and IDs
- Handle malformed discovery responses gracefully

### Connection Resilience
- Automatic re-discovery on WebSocket reconnection
- Exponential backoff for failed discovery attempts
- Graceful degradation when backend is unavailable

## Testing Strategy

### Unit Tests
- Room adapter function mapping
- Store state management methods
- Component rendering with different data states

### Integration Tests
- WebSocket discovery flow end-to-end
- Fallback behavior when WebSocket fails
- Real-time status update handling

### Performance Tests
- Room list rendering with large datasets
- Animation performance during state changes
- Memory usage during extended sessions

## Conclusion

This design leverages the existing robust WebSocket infrastructure to enable seamless room auto-discovery while maintaining full backward compatibility. The hybrid approach ensures reliability and smooth migration path, while the minimal component changes preserve the current user experience and performance characteristics.