# Room Auto-Discovery Implementation Plan

## Implementation Overview

This plan implements room auto-discovery by modifying the `RoomList` component to consume dynamic WebSocket data instead of static YAML configuration, while maintaining full backward compatibility.

## Development Phases

### Phase 1: Store Enhancement
**Objective**: Add room discovery state management to the existing store

**Tasks**:
1. **Enhance ApiAirconStore Interface**
   - File: `src/stores/api-aircon-store.ts`
   - Add room discovery state properties
   - Add helper methods for room management
   - Implement efficient room list retrieval

2. **Add Room Discovery State Management**
   - Add `isDiscoveringRooms: boolean`
   - Add `roomDiscoveryError: string | null` 
   - Add `roomsLastUpdated: number | null`
   - Add corresponding setter methods

**Expected Duration**: 1-2 hours

### Phase 2: Data Adapter Layer
**Objective**: Create compatibility layer between WebSocket data and existing UI expectations

**Tasks**:
1. **Create Room Data Adapter**
   - File: `src/lib/adapters/room-adapter.ts` (new file)
   - Implement `adaptRoomInfo()` function
   - Map `RoomInfo` to `{ roomName, roomId }` format
   - Add online status information

2. **Add Type Definitions**
   - File: `src/types/rooms.ts` (new file)
   - Define adapter interfaces
   - Export room-related type definitions

**Implementation Code**:
```typescript
// src/lib/adapters/room-adapter.ts
import { RoomInfo } from '@/types/websocket';

export interface AdaptedRoom {
  roomName: string;
  roomId: string;
  online: boolean;
}

export const adaptRoomInfo = (roomInfo: RoomInfo): AdaptedRoom => ({
  roomName: roomInfo.name,
  roomId: roomInfo.id,
  online: roomInfo.online
});

export const adaptRoomsList = (rooms: Record<string, RoomInfo>): AdaptedRoom[] => 
  Object.values(rooms).map(adaptRoomInfo);
```

**Expected Duration**: 30-60 minutes

### Phase 3: Component Modification
**Objective**: Update RoomList component to use dynamic data with static fallback

**Tasks**:
1. **Modify RoomList Component**
   - File: `src/components/room/RoomList.tsx`
   - Replace `AppConfigContext` with `useAirconContext`
   - Implement hybrid data source strategy
   - Add loading and error states
   - Preserve existing animations and styling

2. **Update Imports and Dependencies**
   - Add room adapter import
   - Add aircon context hook
   - Maintain existing context for fallback

**Key Implementation Changes**:
```typescript
// Replace existing context usage
const appConfig = useContext(AppConfigContext);
const { getRoomsList, isConnected, isDiscoveringRooms, roomDiscoveryError } = useAirconContext();

// Hybrid data source
const dynamicRooms = getRoomsList();
const staticRooms = appConfig?.rooms || [];
const rooms = isConnected && dynamicRooms.length > 0 
  ? dynamicRooms.map(adaptRoomInfo)
  : staticRooms;
```

**Expected Duration**: 2-3 hours

### Phase 4: Enhanced Store Methods
**Objective**: Add helper methods to the store for efficient room management

**Tasks**:
1. **Add Room Management Methods**
   - File: `src/stores/api-aircon-store.ts`
   - Implement `getRoomsList()` method
   - Implement `isRoomOnline(roomId)` method
   - Implement `getRoomCount()` method

**Implementation**:
```typescript
// In store state interface
getRoomsList: () => AdaptedRoom[];
isRoomOnline: (roomId: string) => boolean;
getRoomCount: () => number;
getOnlineRoomCount: () => number;

// In store implementation
getRoomsList: () => Object.values(state.rooms).map(adaptRoomInfo),
isRoomOnline: (roomId: string) => state.rooms[roomId]?.online ?? false,
getRoomCount: () => Object.keys(state.rooms).length,
getOnlineRoomCount: () => Object.values(state.rooms).filter(room => room.online).length,
```

**Expected Duration**: 1 hour

### Phase 5: UI Enhancements
**Objective**: Add visual indicators for room status and discovery states

**Tasks**:
1. **Add Loading States to RoomList**
   - Show skeleton loader during discovery
   - Add retry button for failed discovery
   - Display error messages appropriately

2. **Enhance RoomCard with Status Indicators**
   - File: `src/components/room/RoomCard.tsx`
   - Add online/offline status indicator
   - Update styling for status visibility
   - Maintain existing design patterns

**Status Indicator Implementation**:
```typescript
interface RoomStatusProps {
  online: boolean;
  className?: string;
}

const RoomStatusIndicator: React.FC<RoomStatusProps> = ({ online, className }) => (
  <div className={cn(
    "flex items-center gap-1",
    className
  )}>
    <div className={cn(
      "w-2 h-2 rounded-full",
      online ? "bg-green-500" : "bg-gray-400"
    )} />
    <span className="text-xs text-muted-foreground">
      {online ? "Online" : "Offline"}
    </span>
  </div>
);
```

**Expected Duration**: 2-3 hours

### Phase 6: Error Handling and Resilience
**Objective**: Implement robust error handling and fallback mechanisms

**Tasks**:
1. **Add Error Boundary Components**
   - File: `src/components/ui/room-discovery-error.tsx` (new file)
   - Handle WebSocket connection failures
   - Provide retry functionality
   - Show helpful error messages

2. **Implement Discovery Timeout Handling**
   - Add timeout logic for room discovery
   - Fallback to static config on timeout
   - User notification for discovery issues

**Expected Duration**: 1-2 hours

## Implementation Sequence

### Step-by-Step Execution Order

1. **Store Enhancement** (Phase 1)
   - Modify `src/stores/api-aircon-store.ts`
   - Add new state properties and methods
   - Test store functionality

2. **Data Adapter Creation** (Phase 2)
   - Create `src/lib/adapters/room-adapter.ts`
   - Create `src/types/rooms.ts`
   - Test adapter functions

3. **Store Helper Methods** (Phase 4)
   - Add room management methods to store
   - Import adapter in store
   - Test new methods

4. **Component Updates** (Phase 3)
   - Modify `src/components/room/RoomList.tsx`
   - Test hybrid data source
   - Verify fallback behavior

5. **UI Enhancements** (Phase 5)
   - Update `src/components/room/RoomCard.tsx`
   - Add loading/error states to RoomList
   - Test visual indicators

6. **Error Handling** (Phase 6)
   - Create error boundary components
   - Add timeout handling
   - Test error scenarios

## Testing Strategy

### Unit Tests Required
```typescript
// src/lib/adapters/__tests__/room-adapter.test.ts
describe('Room Adapter', () => {
  it('should adapt RoomInfo to expected format');
  it('should handle missing fields gracefully');
  it('should preserve online status');
});

// src/stores/__tests__/api-aircon-store-rooms.test.ts  
describe('Room Management', () => {
  it('should return adapted room list');
  it('should check room online status');
  it('should count rooms correctly');
});
```

### Integration Tests
```typescript
// src/components/room/__tests__/RoomList.integration.test.tsx
describe('RoomList Integration', () => {
  it('should use dynamic data when WebSocket connected');
  it('should fallback to static config when WebSocket fails');
  it('should show loading state during discovery');
  it('should handle error states gracefully');
});
```

### Manual Testing Scenarios
1. **Happy Path**: WebSocket connects, rooms discovered, UI updates
2. **WebSocket Failure**: Connection fails, fallback to static config
3. **Discovery Timeout**: Long discovery time, timeout handling
4. **Real-time Updates**: Room status changes, UI reflects updates
5. **Reconnection**: WebSocket reconnects, rooms re-discovered

## Package Dependencies

### New Dependencies Required
**None** - Implementation uses existing dependencies:
- Zustand (already installed)
- RxJS (already installed)  
- Existing UI components
- Current WebSocket infrastructure

### Context7 Documentation Queries Needed
**During implementation phase**:
1. **Zustand v5 best practices**: For store selector patterns
2. **React Query patterns**: If adding cache management
3. **ShadcnUI components**: For status indicators and loading states

## Risk Mitigation

### High-Risk Areas
1. **Store State Transitions**: Carefully test state updates to avoid infinite loops
2. **WebSocket Message Handling**: Ensure message types are handled correctly
3. **Component Re-rendering**: Use proper selectors to prevent performance issues

### Mitigation Strategies
1. **Incremental Development**: Test each phase thoroughly before proceeding
2. **Feature Flags**: Implement toggle to enable/disable dynamic discovery
3. **Monitoring**: Add console logging for debugging during development
4. **Rollback Plan**: Keep static config as fallback mechanism

## Deployment Strategy

### Development Environment
1. Test with mock WebSocket data
2. Verify static config fallback works
3. Test error scenarios manually

### Staging Environment  
1. Test with real WebSocket backend
2. Verify room discovery performance
3. Test reconnection scenarios

### Production Rollout
1. Deploy with feature flag disabled initially
2. Monitor WebSocket connection stability
3. Gradually enable for user segments
4. Full rollout after validation

## Success Criteria

### Functional Requirements
- ✅ Rooms auto-discovered via WebSocket
- ✅ Real-time status updates working
- ✅ Static config fallback functional
- ✅ Loading and error states implemented
- ✅ No regression in existing functionality

### Performance Requirements  
- ✅ Room discovery < 5 seconds
- ✅ Status updates < 2 seconds latency
- ✅ No increase in page load time
- ✅ Smooth animations maintained

### User Experience Requirements
- ✅ No change in UI appearance
- ✅ Clear status indicators
- ✅ Helpful error messages
- ✅ Retry functionality available

## Post-Implementation Tasks

1. **Documentation Updates**
   - Update README with WebSocket requirements
   - Document new store methods
   - Add troubleshooting guide

2. **Monitoring Setup**
   - Add analytics for room discovery success rate
   - Monitor WebSocket connection stability
   - Track error rates and types

3. **Future Enhancements**
   - Room management UI (add/remove rooms)
   - Advanced filtering and sorting
   - Room favorite/priority system
   - Bulk operations support

## Estimated Total Implementation Time

**Development**: 8-12 hours
**Testing**: 4-6 hours  
**Documentation**: 2-3 hours
**Deployment/Monitoring**: 2-3 hours

**Total**: 16-24 hours over 2-3 development sessions