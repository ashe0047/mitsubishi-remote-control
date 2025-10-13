# Technical Design Document: Air Conditioner Loading State Enhancement

**Feature Name**: Aircon Loading State Enhancement
**Version**: 1.0
**Date**: 2025-10-13
**Status**: Draft
**Author**: System Architect

---

## 1. Executive Summary

This document details the technical architecture for decoupling UI rendering from data availability in the air conditioner control interface. The design introduces a loading state management system that enables immediate control display upon WebSocket connection while showing loading indicators for data-dependent values.

**Key Design Decisions**:
- Simple boolean flags over complex state machines (YAGNI principle)
- Facade pattern via custom hook for loading state access
- Null Object pattern for default states during loading
- Store extension with timestamp tracking for data availability
- ShadcnUI Skeleton components for consistent loading UX

---

## 2. Clean Code Principles Analysis

### 2.1 DRY (Don't Repeat Yourself)

**Current Violations**:
- Loading state checks duplicated across components: `if (!roomInfo)`, `if (!airconState)`
- Connection status tracking duplicated in multiple places
- No centralized loading state management

**Solutions**:
1. **Centralize Loading State**: Add `roomDataTimestamps` to Zustand store as single source of truth
2. **Reusable Hook**: Create `useLoadingState(roomId)` hook to eliminate duplicate logic
3. **Shared Skeletons**: Use ShadcnUI Skeleton component consistently across all loading states

**Impact**: Reduces ~50 lines of duplicate loading logic across components

---

### 2.2 SOLID Principles

#### Single Responsibility Principle (SRP)

**Current Violations**:
- `AirConRemote.tsx` handles UI rendering, loading logic, connection status, and navigation
- Loading state logic mixed with rendering logic

**Solutions**:
1. **Extract Loading Logic**: Create `useLoadingState()` hook (single responsibility: manage loading state)
2. **Separate Concerns**: Hook handles state queries, component handles rendering only
3. **Store Methods**: Add focused helper methods for timestamp management

**New Responsibility Boundaries**:
```
AirConRemote.tsx → UI Rendering only
useLoadingState() → Loading state management
api-aircon-store.ts → State storage and command execution
AirconProvider.tsx → WebSocket lifecycle management
```

#### Open/Closed Principle (OCP)

**Current Issue**: Hard to extend with new loading states without modifying components

**Solution**:
- Loading state interface in hook can be extended without changing consumers
- New loading indicators can be added by extending store without UI changes
- Example: Adding timeout logic later requires only store changes

#### Interface Segregation Principle (ISP)

**Current Issue**: Store exposes large interface (50+ methods), many not relevant to loading state

**Solution**:
- `useLoadingState()` provides focused interface with only 8 properties
- Components only import what they need
- No dependencies on unrelated store functionality

```typescript
// Focused interface - only what's needed for loading UX
interface LoadingStateResult {
  isConnected: boolean;
  isMqttConnected: boolean;
  hasRoomData: boolean;
  hasStateData: boolean;
  hasSettingsData: boolean;
  isInitialLoading: boolean;
  canShowControls: boolean;
  canInteract: boolean;
}
```

#### Dependency Inversion Principle (DIP)

**Current Issue**: Components directly depend on concrete store structure

**Solution**:
- Components depend on `useLoadingState()` abstraction, not store
- Hook can change internal implementation without affecting UI
- Store structure changes don't cascade to components

**Dependency Flow**:
```
AirConRemote.tsx
    ↓ (depends on abstraction)
useLoadingState() hook
    ↓ (depends on store interface)
api-aircon-store.ts
    ↓ (depends on WebSocket)
websocketClient
```

---

### 2.3 YAGNI (You Ain't Gonna Need It)

**Rejected Over-Engineering**:
1. ❌ **Complex State Machine**: Don't need formal FSM for 2 boolean states
2. ❌ **Multiple Loading Types**: Don't need different skeleton variants (spinner, progress, etc.)
3. ❌ **Progressive Loading**: Don't need phases (initial → partial → complete)
4. ❌ **Caching Layer**: Don't need separate cache management (store is sufficient)
5. ❌ **Loading Context Provider**: Simple hook is sufficient, no need for Context

**Accepted Simplicity**:
1. ✅ **Boolean Flags**: Simple `isConnected` + `hasData` flags
2. ✅ **Single Skeleton Type**: ShadcnUI Skeleton component for all cases
3. ✅ **Inline Skeletons**: No separate skeleton components (YAGNI until needed)
4. ✅ **Direct Store Access**: Hook reads store directly, no abstraction layers

---

## 3. Design Pattern Analysis

### 3.1 Pattern Evaluation

#### Facade Pattern ✅ SELECTED

**Application**: `useLoadingState()` custom hook

**Justification**:
- Hides complex store logic from components
- Provides simple, focused interface
- Centralizes loading state calculations
- Easy to test in isolation

**Trade-offs**:
- Complexity: 2/5 (simple hook)
- Maintainability: 5/5 (centralized logic)
- Testability: 5/5 (isolated unit tests)
- Performance: 5/5 (minimal overhead)
- Score: **4.25/5** ✅

#### Null Object Pattern ✅ SELECTED

**Application**: Default state objects for missing data

**Justification**:
- Eliminates null checks throughout UI
- Provides sensible defaults during loading
- Prevents crashes from undefined access
- Already used in `createDefaultState()` helpers

**Implementation**:
```typescript
// Return default state instead of null/undefined
const airconState = roomInfo?.state ?? createDefaultState();
// UI can always access properties without null checks
<div>{airconState.temperature}°C</div>
```

#### State Pattern ❌ REJECTED

**Why Rejected**: YAGNI principle

**Evaluation**:
- Would model as FSM: disconnected → connecting → connected-no-data → connected-with-data
- Complexity: 4/5 (requires state machine implementation)
- Maintainability: 3/5 (more code to maintain)
- Flexibility: 5/5 (very extensible)
- Score: **3.83/5** - Not worth the complexity

**Decision**: Use simple boolean flags instead

#### Observer Pattern ✅ ALREADY IN USE

**Application**: RxJS + Zustand for reactive updates

**Status**: No changes needed
- RxJS handles MQTT message streams
- Zustand provides reactive store
- Components auto-update via hooks

---

### 3.2 Selected Approach: Facade + Null Object

**Pattern Combination**:
1. **Facade**: `useLoadingState()` hook hides store complexity
2. **Null Object**: Default states prevent null checks
3. **Observer**: Existing RxJS + Zustand (no changes)

**Benefits**:
- Simple to understand and maintain
- Follows SOLID principles (SRP, ISP, DIP)
- Eliminates code duplication (DRY)
- No over-engineering (YAGNI)
- Easy to extend later if needed

---

## 4. Architecture Design

### 4.1 Component Architecture

```
┌──────────────────────────────────────────────────┐
│            AirConRemote Component                │
│  Responsibilities:                               │
│  - Render controls when connected                │
│  - Show skeletons for missing data               │
│  - Handle user interactions                      │
│  - Display connection status                     │
└─────────────────┬────────────────────────────────┘
                  │ uses
                  ▼
┌──────────────────────────────────────────────────┐
│         useLoadingState(roomId) Hook             │
│  Responsibilities:                               │
│  - Query store for connection status             │
│  - Check data availability by room               │
│  - Calculate derived loading flags               │
│  - Provide focused loading interface             │
└─────────────────┬────────────────────────────────┘
                  │ reads from
                  ▼
┌──────────────────────────────────────────────────┐
│          api-aircon-store (Zustand)              │
│  Responsibilities:                               │
│  - Store connection status (isConnected)         │
│  - Store room data (rooms)                       │
│  - Track data arrival (roomDataTimestamps)       │
│  - Provide helper methods (hasReceivedRoomData)  │
└─────────────────┬────────────────────────────────┘
                  │ updated by
                  ▼
┌──────────────────────────────────────────────────┐
│           AirconProvider Component               │
│  Responsibilities:                               │
│  - Manage WebSocket connection lifecycle         │
│  - Subscribe to RxJS message stream              │
│  - Update store on message arrival               │
│  - Call timestamp tracking methods               │
└──────────────────────────────────────────────────┘
```

---

### 4.2 Data Flow Sequence

```
1. User Navigation
   └─> Navigate to AC control page
       └─> AirconProvider mounts

2. WebSocket Connection
   └─> websocketClient.connect(roomId)
       └─> store.setIsConnected(true)
           └─> useLoadingState() detects connection
               └─> AirConRemote renders controls
                   └─> Shows skeletons (canShowControls: true, hasRoomData: false)

3. MQTT Message Arrival
   └─> RxJS message stream emits
       └─> AirconProvider processes message
           └─> store.updateRoomState(roomId, state)
               └─> store.markRoomStateReceived(roomId)  ← NEW
                   └─> useLoadingState() detects data
                       └─> AirConRemote replaces skeletons with values

4. Subsequent Messages
   └─> Updates flow through same path
       └─> No skeleton flash (already has data)
           └─> Smooth value transitions via AnimatePresence
```

---

### 4.3 State Transition Diagram

```
┌─────────────────────────────────────────────────┐
│ Initial State                                   │
│ isConnected: false, hasRoomData: false          │
└─────────────────┬───────────────────────────────┘
                  │ WebSocket connects
                  ▼
┌─────────────────────────────────────────────────┐
│ Connected, No Data                              │
│ isConnected: true, hasRoomData: false           │
│ UI: Controls visible with skeletons             │
└─────────────────┬───────────────────────────────┘
                  │ First MQTT message arrives
                  ▼
┌─────────────────────────────────────────────────┐
│ Connected, Data Loaded                          │
│ isConnected: true, hasRoomData: true            │
│ UI: Controls visible with actual values         │
└─────────────────┬───────────────────────────────┘
                  │ WebSocket disconnects
                  ▼
┌─────────────────────────────────────────────────┐
│ Disconnected, Data Cached                       │
│ isConnected: false, hasRoomData: true           │
│ UI: Error banner, stale data still visible      │
└─────────────────┬───────────────────────────────┘
                  │ Reconnect
                  ▼
┌─────────────────────────────────────────────────┐
│ Connected, Data Available                       │
│ isConnected: true, hasRoomData: true            │
│ UI: Normal operation, no flash/reload           │
└─────────────────────────────────────────────────┘
```

**Key State Properties**:
- **Timestamps persist across disconnects**: No data loss on reconnect
- **Skeletons only shown once**: After first data load, no skeleton flash
- **Graceful degradation**: Disconnected state shows last known values

---

## 5. Store Schema Extension

### 5.1 New Type Definitions

```typescript
/**
 * Tracks when data was received for a specific room.
 * Used to determine loading state independently of connection status.
 */
interface RoomDataTimestamps {
  /** Timestamp when state (temperature, mode, etc.) was received */
  stateReceived: number | null;

  /** Timestamp when settings (configuration) were received */
  settingsReceived: number | null;

  /** Timestamp when device list was received */
  devicesReceived: number | null;

  /** Timestamp of first message of any type (used for timeout logic) */
  firstMessageReceived: number | null;
}
```

---

### 5.2 Store State Extension

**Location**: `frontend/src/stores/api-aircon-store.ts`

```typescript
export interface ApiAirconStoreState extends ApiAirconProps {
  // ===== EXISTING PROPERTIES =====
  isConnected: boolean;
  isMqttConnected: boolean;
  rooms: Record<string, RoomInfo>;
  // ... other existing properties

  // ===== NEW PROPERTIES =====

  /**
   * Tracks when data was received for each room.
   * Key: roomId, Value: timestamp record
   */
  roomDataTimestamps: Record<string, RoomDataTimestamps>;

  // ===== NEW METHODS =====

  /**
   * Mark that room state data was received.
   * Called when updateRoomState() processes a message.
   */
  markRoomStateReceived: (roomId: string) => void;

  /**
   * Mark that room settings data was received.
   * Called when updateRoomSettings() processes a message.
   */
  markRoomSettingsReceived: (roomId: string) => void;

  /**
   * Mark that device list was received for room.
   * Called when room info includes devices array.
   */
  markRoomDevicesReceived: (roomId: string) => void;

  /**
   * Check if room has received ANY data.
   * Returns true if state OR settings OR devices received.
   */
  hasReceivedRoomData: (roomId: string) => boolean;

  /**
   * Check if room has received state data specifically.
   */
  hasReceivedRoomState: (roomId: string) => boolean;

  /**
   * Check if room has received settings data specifically.
   */
  hasReceivedRoomSettings: (roomId: string) => boolean;

  /**
   * Get age of room data in milliseconds.
   * Returns null if no data received yet.
   */
  getRoomDataAge: (roomId: string) => number | null;
}
```

---

### 5.3 Store Implementation

**New State Initialization**:
```typescript
const createApiAirconStore = (initProps?: Partial<ApiAirconProps>) => {
  return createStore<ApiAirconStoreState>()((set, get) => ({
    // ... existing initialization

    // NEW: Initialize timestamp tracking
    roomDataTimestamps: {},

    // NEW: Timestamp management methods
    markRoomStateReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              stateReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    markRoomSettingsReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              settingsReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    markRoomDevicesReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              devicesReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    hasReceivedRoomData: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      if (!timestamps) return false;

      return (
        timestamps.stateReceived !== null ||
        timestamps.settingsReceived !== null ||
        timestamps.devicesReceived !== null
      );
    },

    hasReceivedRoomState: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      return timestamps?.stateReceived !== null;
    },

    hasReceivedRoomSettings: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      return timestamps?.settingsReceived !== null;
    },

    getRoomDataAge: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      const firstReceived = timestamps?.firstMessageReceived;

      if (!firstReceived) return null;

      return Date.now() - firstReceived;
    },

    // ... rest of existing methods
  }));
};
```

---

### 5.4 Integration with Existing Methods

**Update `updateRoomState()` to track timestamps**:
```typescript
updateRoomState: (roomId, state) => {
  const rooms = get().rooms;
  if (rooms[roomId]) {
    rooms[roomId] = { ...rooms[roomId], state };
    set({ rooms: { ...rooms } });

    // NEW: Track that state was received
    get().markRoomStateReceived(roomId);
  }
},
```

**Update `updateRoomSettings()` to track timestamps**:
```typescript
updateRoomSettings: (roomId, settings) => {
  const rooms = get().rooms;
  if (rooms[roomId]) {
    rooms[roomId] = { ...rooms[roomId], settings };
    set({ rooms: { ...rooms } });

    // NEW: Track that settings were received
    get().markRoomSettingsReceived(roomId);
  }
},
```

**Update `setRooms()` to track device data**:
```typescript
setRooms: (roomList) => {
  const rooms: RoomsType = {};
  roomList.forEach(room => {
    rooms[room.id] = room;
    websocketClient.subscribeToRoomState(room.id);

    // NEW: Track that devices were received
    if (room.devices && room.devices.length > 0) {
      get().markRoomDevicesReceived(room.id);
    }
  });
  set({
    rooms,
    isDiscoveringRooms: false,
    roomDiscoveryError: null,
    roomsLastUpdated: Date.now()
  });
},
```

---

## 6. Custom Hook Design

### 6.1 Hook Interface

**Location**: `frontend/src/hooks/useLoadingState.ts` (new file)

```typescript
/**
 * Result object returned by useLoadingState hook.
 * Provides all necessary flags for loading UI logic.
 */
export interface LoadingStateResult {
  // ===== CONNECTION STATUS =====

  /** WebSocket connection is active */
  isConnected: boolean;

  /** MQTT broker connection is active (via WebSocket) */
  isMqttConnected: boolean;

  // ===== DATA AVAILABILITY =====

  /** Room has received ANY data (state, settings, or devices) */
  hasRoomData: boolean;

  /** Room has received state data specifically */
  hasStateData: boolean;

  /** Room has received settings data specifically */
  hasSettingsData: boolean;

  // ===== DERIVED FLAGS =====

  /** Connected but no data received yet (show skeletons) */
  isInitialLoading: boolean;

  /** Can show controls (connected, data optional) */
  canShowControls: boolean;

  /** Can interact with controls (connected AND has data) */
  canInteract: boolean;

  // ===== METADATA =====

  /** Milliseconds since first data received, or null if no data */
  dataAge: number | null;
}

/**
 * Hook to manage loading state for air conditioner controls.
 *
 * Provides flags for:
 * - Connection status (WebSocket, MQTT)
 * - Data availability (has data been received?)
 * - Derived states (should show controls? should show skeletons?)
 *
 * @param roomId - The room identifier to check loading state for
 * @returns LoadingStateResult with all loading flags
 *
 * @example
 * const { canShowControls, hasStateData } = useLoadingState(roomId);
 *
 * if (!canShowControls) {
 *   return <ConnectionError />;
 * }
 *
 * return (
 *   <div>
 *     {hasStateData ? (
 *       <div>{temperature}°C</div>
 *     ) : (
 *       <Skeleton className="h-8 w-24" />
 *     )}
 *   </div>
 * );
 */
export function useLoadingState(roomId: string): LoadingStateResult;
```

---

### 6.2 Hook Implementation

**CRITICAL: Zustand v5 Safe Selectors**

```typescript
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAirconContext } from './useAircon';
import { ApiAirconStore } from '@/stores/api-aircon-store';

export interface LoadingStateResult {
  isConnected: boolean;
  isMqttConnected: boolean;
  hasRoomData: boolean;
  hasStateData: boolean;
  hasSettingsData: boolean;
  isInitialLoading: boolean;
  canShowControls: boolean;
  canInteract: boolean;
  dataAge: number | null;
}

export function useLoadingState(roomId: string): LoadingStateResult {
  const store = useAirconContext();

  if (!store) {
    throw new Error('useLoadingState must be used within ApiAirconProvider');
  }

  // CRITICAL: Use useShallow to select multiple values safely
  // This prevents infinite re-render loops in Zustand v5
  const [
    isConnected,
    isMqttConnected,
    hasReceivedRoomData,
    hasReceivedRoomState,
    hasReceivedRoomSettings,
    getRoomDataAge,
  ] = store(
    useShallow((state) => [
      state.isConnected,
      state.isMqttConnected,
      state.hasReceivedRoomData,
      state.hasReceivedRoomState,
      state.hasReceivedRoomSettings,
      state.getRoomDataAge,
    ])
  );

  // Calculate derived values
  // Use useMemo to prevent recalculation on every render
  const result = useMemo((): LoadingStateResult => {
    const hasRoomData = hasReceivedRoomData(roomId);
    const hasStateData = hasReceivedRoomState(roomId);
    const hasSettingsData = hasReceivedRoomSettings(roomId);
    const dataAge = getRoomDataAge(roomId);

    // Derived flags
    const isInitialLoading = isConnected && !hasRoomData;
    const canShowControls = isConnected; // Show controls when connected
    const canInteract = isConnected && hasRoomData; // Need data to interact

    return {
      isConnected,
      isMqttConnected,
      hasRoomData,
      hasStateData,
      hasSettingsData,
      isInitialLoading,
      canShowControls,
      canInteract,
      dataAge,
    };
  }, [
    roomId,
    isConnected,
    isMqttConnected,
    hasReceivedRoomData,
    hasReceivedRoomState,
    hasReceivedRoomSettings,
    getRoomDataAge,
  ]);

  return result;
}
```

**Key Implementation Notes**:
1. **Zustand v5 Safety**: Uses `useShallow` to safely select multiple values
2. **Memoization**: Uses `useMemo` to prevent unnecessary recalculations
3. **Function Stability**: Store methods are stable, safe in dependency arrays
4. **Derived Values**: Calculates loading flags from primitive values
5. **Type Safety**: Full TypeScript type checking

---

## 7. UI Component Updates

### 7.1 AirConRemote Changes

**Location**: `frontend/src/components/AirConRemote.tsx`

**Change 1: Import new hook**
```typescript
import { useLoadingState } from '@/hooks/useLoadingState';
import { Skeleton } from '@/components/ui/skeleton';
```

**Change 2: Use loading state hook instead of direct data checks**
```typescript
// OLD: Direct data checks
const roomInfo = getRoomInfo(roomId);
const airconState = roomInfo?.state;

if (!roomInfo) {
  return <LoadingSpinner />;
}

if (!airconState) {
  return <NoDataMessage />;
}

// NEW: Use loading state hook
const { canShowControls, hasStateData, hasSettingsData, isInitialLoading } = useLoadingState(roomId);

const roomInfo = getRoomInfo(roomId);
const airconState = roomInfo?.state ?? createDefaultState();

if (!canShowControls) {
  return <ConnectionError />;
}

// Controls always render when connected
// Individual values show skeletons if data not available
```

**Change 3: Replace early returns with skeleton conditionals**
```typescript
// OLD: Early return prevents control rendering
if (!roomInfo) {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

// NEW: Show controls with skeletons
return (
  <Card>
    <CardContent>
      {/* Temperature Display - show skeleton if no state data */}
      {hasStateData ? (
        <div className="text-6xl">
          {displayTemp(airconState.temperature)}°C
        </div>
      ) : (
        <Skeleton className="h-20 w-32 mx-auto" />
      )}

      {/* Mode Badge - show skeleton if no state data */}
      {hasStateData ? (
        <Badge>
          {getModeIcon(airconState.mode)}
          {airconState.mode}
        </Badge>
      ) : (
        <Skeleton className="h-6 w-20 mx-auto" />
      )}

      {/* Controls always visible, disabled if no data */}
      <Slider
        disabled={!canInteract}
        value={[airconState.temperature]}
        onValueChange={handleTemperatureChange}
      />
    </CardContent>
  </Card>
);
```

---

### 7.2 Skeleton Patterns

**Temperature Display Skeleton**:
```typescript
{hasStateData ? (
  <motion.div
    key={`temp-${airconState.temperature}`}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.4 }}
    className="text-6xl font-light"
  >
    {displayTemp(airconState.temperature)}
    <span className="text-2xl ml-1">°{prefs.useFahrenheit ? 'F' : 'C'}</span>
  </motion.div>
) : (
  <Skeleton className="h-20 w-32 mx-auto rounded-lg" aria-busy="true" />
)}
```

**Room Temperature Skeleton**:
```typescript
{hasStateData ? (
  <div className="text-sm text-muted-foreground">
    Room: {displayTemp(airconState.roomTemperature)}°{prefs.useFahrenheit ? 'F' : 'C'}
  </div>
) : (
  <Skeleton className="h-4 w-24 mx-auto" />
)}
```

**Mode Badge Skeleton**:
```typescript
{hasStateData ? (
  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted/50">
    {getModeIcon(airconState.mode)}
    <span className="text-sm font-medium ml-1">{airconState.mode}</span>
  </div>
) : (
  <Skeleton className="h-8 w-24 mx-auto rounded-full" />
)}
```

**Controls State**:
```typescript
{/* Temperature Slider - enabled when can interact */}
<Slider
  disabled={!canInteract}
  min={16}
  max={31}
  step={1}
  value={[airconState.temperature]}
  onValueChange={handleTemperatureChange}
  className={cn(
    "w-[60%] cursor-pointer transition-opacity duration-200",
    !canInteract && "opacity-50 cursor-not-allowed"
  )}
/>

{/* Mode Buttons - enabled when can interact */}
<Button
  variant="outline"
  onClick={() => handleModeChange(mode)}
  disabled={!canInteract}
  className={cn(
    "h-12 w-full rounded-lg transition-all duration-200",
    airconState.mode === mode && getModeColor(mode),
    !canInteract && "opacity-50 cursor-not-allowed"
  )}
>
  {getModeIcon(mode)}
</Button>
```

---

### 7.3 Accessibility Attributes

**ARIA Live Regions**:
```typescript
{/* Announce loading state changes to screen readers */}
<div
  role="status"
  aria-live="polite"
  aria-busy={isInitialLoading}
  className="sr-only"
>
  {isInitialLoading ? 'Loading air conditioner data...' : 'Air conditioner data loaded'}
</div>
```

**Skeleton ARIA**:
```typescript
<Skeleton
  className="h-20 w-32"
  role="status"
  aria-label="Loading temperature"
  aria-busy="true"
/>
```

**Control Disabled States**:
```typescript
<Slider
  disabled={!canInteract}
  aria-label="Temperature control"
  aria-disabled={!canInteract}
  aria-describedby={!canInteract ? "temp-disabled-reason" : undefined}
/>

{!canInteract && (
  <span id="temp-disabled-reason" className="sr-only">
    Temperature control disabled while loading data
  </span>
)}
```

---

## 8. Provider Updates

### 8.1 AirconProvider Integration

**Location**: `frontend/src/components/AirconProvider.tsx`

**Change: Call timestamp marking in message handlers**

```typescript
// In useEffect subscription (lines 58-132)
const subscription = websocketStream$.subscribe({
  next: (message) => {
    const { type, roomId, data } = message;

    switch (type) {
      case 'room-state':
        if (roomId) {
          state.updateRoomState(roomId, data as AirConState);
          // Timestamp marking happens inside updateRoomState now
        }
        break;

      case 'room-settings':
        if (roomId) {
          state.updateRoomSettings(roomId, data as AirConSettings);
          // Timestamp marking happens inside updateRoomSettings now
        }
        break;

      case 'room-status-update':
        if (data) {
          state.applyRoomStatusUpdate(data as RoomStatusUpdatePayload);
          // Timestamp marking happens inside applyRoomStatusUpdate
          // Need to add markRoomStateReceived + markRoomSettingsReceived calls
        }
        break;

      // ... other cases unchanged
    }
  },
  // ... error and complete handlers unchanged
});
```

**Update `applyRoomStatusUpdate` handler**:
```typescript
case 'room-status-update':
  if (data) {
    const payload = data as RoomStatusUpdatePayload;
    state.applyRoomStatusUpdate(payload);

    // NEW: Mark data as received based on what's in the payload
    if (payload.state) {
      state.markRoomStateReceived(payload.roomId);
    }
    if (payload.settings) {
      state.markRoomSettingsReceived(payload.roomId);
    }
    if (payload.deviceUpdates && payload.deviceUpdates.length > 0) {
      state.markRoomDevicesReceived(payload.roomId);
    }
  }
  break;
```

**No other changes needed** - Provider maintains single responsibility

---

## 9. Architecture Quality Assessment

### 9.1 Cohesion Analysis

**Current State**:
- ❌ Low Cohesion: `AirConRemote.tsx` mixes UI, loading logic, navigation
- ✅ High Cohesion: `AirconProvider.tsx` focused on WebSocket lifecycle
- ✅ High Cohesion: `api-aircon-store.ts` focused on state management

**After Changes**:
- ✅ High Cohesion: `AirConRemote.tsx` only handles UI rendering
- ✅ High Cohesion: `useLoadingState()` only handles loading state
- ✅ High Cohesion: Store methods focused on timestamp tracking
- ✅ High Cohesion: Provider still focused on WebSocket lifecycle

**Improvement**: All modules now have single, well-defined responsibilities

---

### 9.2 Coupling Analysis

**Current State**:
- ❌ Tight Coupling: UI directly depends on store structure
- ❌ Tight Coupling: Loading logic duplicated across components

**After Changes**:
- ✅ Loose Coupling: UI depends on hook abstraction, not store
- ✅ Loose Coupling: Hook provides stable interface
- ✅ Decoupling: Store changes don't affect UI (mediated by hook)

**Improvement**: Significantly reduced coupling via Facade pattern

---

### 9.3 Separation of Concerns

**Concern Boundaries**:
```
┌─────────────────────────────────────┐
│ Presentation Layer (UI)             │
│ - AirConRemote.tsx                  │
│ - Skeleton components               │
│ - ARIA attributes                   │
└──────────────┬──────────────────────┘
               │ uses
┌──────────────▼──────────────────────┐
│ Business Logic Layer                │
│ - useLoadingState() hook            │
│ - Loading flag calculations         │
│ - Data availability checks          │
└──────────────┬──────────────────────┘
               │ queries
┌──────────────▼──────────────────────┐
│ State Management Layer              │
│ - api-aircon-store.ts               │
│ - roomDataTimestamps                │
│ - Helper methods                    │
└──────────────┬──────────────────────┘
               │ updated by
┌──────────────▼──────────────────────┐
│ Infrastructure Layer                │
│ - AirconProvider.tsx                │
│ - WebSocket client                  │
│ - RxJS message streams              │
└─────────────────────────────────────┘
```

**Clear Boundaries**: Each layer has well-defined responsibilities

---

### 9.4 Dependency Direction

```
UI Components (AirConRemote)
      ↓ depends on
Business Logic (useLoadingState hook)
      ↓ depends on
State Store (api-aircon-store)
      ↓ updated by
Infrastructure (AirconProvider)
```

**Direction**: ✅ Dependencies flow inward (correct)
**No Circular Dependencies**: ✅ Acyclic dependency graph
**Stable Dependencies**: ✅ UI depends on stable hook interface

---

## 10. Performance Considerations

### 10.1 Re-render Optimization

**Zustand v5 Critical Patterns**:
```typescript
// ❌ WRONG - Causes infinite re-render loop
const storeData = useStore(apiAirconStore);
useEffect(() => {
  storeData.someMethod();
}, [storeData]); // storeData is new object every render

// ✅ CORRECT - Use specific selectors
const someMethod = useStore(apiAirconStore, (state) => state.someMethod);
useEffect(() => {
  someMethod();
}, []); // Methods are stable, safe with eslint-disable

// ✅ CORRECT - Use useShallow for multiple values
const [val1, val2] = useStore(
  apiAirconStore,
  useShallow((state) => [state.val1, state.val2])
);
```

**Loading State Hook Optimization**:
- Uses `useShallow` to select multiple store values
- Uses `useMemo` to prevent derived value recalculation
- Only re-renders when loading flags actually change (boolean transitions)
- Timestamps change on every message but don't trigger re-render (not in selector)

---

### 10.2 State Update Batching

**Zustand Auto-Batching**:
When MQTT message arrives, multiple updates occur:
1. `updateRoomState(roomId, state)`
2. `markRoomStateReceived(roomId)`
3. `updateRoomSettings(roomId, settings)`
4. `markRoomSettingsReceived(roomId)`

**Result**: All updates batched into **single re-render** automatically by Zustand

---

### 10.3 Animation Performance

**Framer Motion Optimization**:
- AnimatePresence uses CSS transforms (GPU accelerated)
- Layout animations avoided (cause reflows)
- Skeleton shimmer uses CSS animation (hardware accelerated)

**Performance Budget**:
- Initial render: < 50ms
- Skeleton → Data transition: < 16ms (60fps)
- No janky animations during loading

---

## 11. Error Handling & Edge Cases

### 11.1 Edge Case: Rapid Reconnections

**Scenario**: WebSocket disconnects and reconnects before data arrives

**Current Behavior**: Might flash loading skeleton on reconnect

**Solution**: Preserve timestamps across disconnections
```typescript
// Timestamps NOT cleared on disconnect
// Only cleared explicitly or on room removal
```

**Result**: No skeleton flash on reconnect if data previously loaded

---

### 11.2 Edge Case: Partial Data Arrival

**Scenario**: Receive `state` but not `settings` (or vice versa)

**Solution**: Separate flags for each data type
```typescript
{hasStateData ? <Temperature /> : <Skeleton />}
{hasSettingsData ? <Settings /> : <Skeleton />}
```

**Result**: Show actual data for received parts, skeletons for pending parts

---

### 11.3 Edge Case: Stale Data

**Scenario**: User disconnected for 1 hour, reconnects with old data in store

**Current Solution**: Show old data (acceptable UX)

**Future Enhancement** (Optional, YAGNI for now):
```typescript
const dataAge = getRoomDataAge(roomId);
const isDataStale = dataAge !== null && dataAge > 5 * 60 * 1000; // 5 minutes

if (isConnected && isDataStale) {
  return <StaleDataWarning />;
}
```

---

### 11.4 Edge Case: Room Switching

**Scenario**: Navigate room A → room B → back to room A

**Solution**: Timestamps persist in store (singleton)

**Result**: Room A data still available, no reload needed

---

### 11.5 Edge Case: Backend Sends Empty Values

**Scenario**: Backend sends valid message but with `null`/`undefined` values

**Solution**:
1. Mark as "received" (timestamp set)
2. Use Null Object pattern to provide defaults
3. UI gracefully handles undefined with fallbacks

```typescript
const airconState = roomInfo?.state ?? createDefaultState();
// Always has valid object, even if backend sent empty
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

**api-aircon-store.test.ts** additions:
```typescript
describe('Loading State Tracking', () => {
  it('should track room state received timestamp', () => {
    const store = createApiAirconStore();
    store.getState().markRoomStateReceived('room1');

    expect(store.getState().hasReceivedRoomState('room1')).toBe(true);
    expect(store.getState().roomDataTimestamps['room1'].stateReceived).toBeGreaterThan(0);
  });

  it('should track room settings received timestamp', () => {
    const store = createApiAirconStore();
    store.getState().markRoomSettingsReceived('room1');

    expect(store.getState().hasReceivedRoomSettings('room1')).toBe(true);
  });

  it('should return true for hasReceivedRoomData if any data received', () => {
    const store = createApiAirconStore();

    expect(store.getState().hasReceivedRoomData('room1')).toBe(false);

    store.getState().markRoomStateReceived('room1');

    expect(store.getState().hasReceivedRoomData('room1')).toBe(true);
  });

  it('should track multiple rooms independently', () => {
    const store = createApiAirconStore();

    store.getState().markRoomStateReceived('room1');

    expect(store.getState().hasReceivedRoomData('room1')).toBe(true);
    expect(store.getState().hasReceivedRoomData('room2')).toBe(false);
  });

  it('should calculate data age correctly', () => {
    const store = createApiAirconStore();

    expect(store.getState().getRoomDataAge('room1')).toBeNull();

    store.getState().markRoomStateReceived('room1');
    const age = store.getState().getRoomDataAge('room1');

    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(100); // Should be very recent
  });
});
```

---

**useLoadingState.test.ts** (new file):
```typescript
import { renderHook } from '@testing-library/react';
import { useLoadingState } from './useLoadingState';
import { ApiAirconProvider } from '@/components/AirconProvider';

describe('useLoadingState', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ApiAirconProvider roomId="test-room">{children}</ApiAirconProvider>
  );

  it('should return isInitialLoading=true when connected but no data', () => {
    const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

    // Mock connected state, no data
    expect(result.current.isConnected).toBe(true);
    expect(result.current.hasRoomData).toBe(false);
    expect(result.current.isInitialLoading).toBe(true);
  });

  it('should return canShowControls=true when connected', () => {
    const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

    expect(result.current.canShowControls).toBe(true);
  });

  it('should return canInteract=false when no data', () => {
    const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

    expect(result.current.canInteract).toBe(false);
  });

  it('should return canInteract=true when connected and has data', async () => {
    // Test implementation with mock store updates
  });
});
```

---

### 12.2 Integration Tests

**Loading Flow Integration Test**:
```typescript
describe('Air Conditioner Loading Flow', () => {
  it('should show controls with skeletons on connect, then populate with data', async () => {
    const { getByRole, queryByRole, findByText } = render(
      <ApiAirconProvider roomId="test-room">
        <AirConRemote room={{ roomId: 'test-room', roomName: 'Test' }} />
      </ApiAirconProvider>
    );

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(getByRole('slider')).toBeInTheDocument();
    });

    // Controls should be visible
    expect(getByRole('slider')).toBeInTheDocument();

    // Skeletons should be visible
    expect(queryByRole('status', { name: /loading temperature/i })).toBeInTheDocument();

    // Simulate MQTT message arrival
    act(() => {
      mockWebSocket.emit('message', {
        type: 'room-state',
        roomId: 'test-room',
        data: { temperature: 24, mode: 'cool', /* ... */ }
      });
    });

    // Wait for skeleton to be replaced with actual value
    await waitFor(() => {
      expect(findByText('24°C')).toBeInTheDocument();
    });

    // Skeleton should be gone
    expect(queryByRole('status', { name: /loading temperature/i })).not.toBeInTheDocument();
  });
});
```

---

## 13. Migration Path & Rollout

### 13.1 Implementation Order

**Phase 1: Store Foundation** (1-2 hours)
1. Add `RoomDataTimestamps` type definition
2. Add `roomDataTimestamps` state to store
3. Add timestamp marking methods
4. Add helper query methods
5. Write unit tests for store methods

**Phase 2: Hook Creation** (1 hour)
1. Create `useLoadingState.ts` file
2. Implement hook with proper selectors
3. Write unit tests for hook
4. Verify Zustand v5 safety (no infinite loops)

**Phase 3: Provider Integration** (30 minutes)
1. Update message handlers to call timestamp methods
2. Test timestamp tracking with mock messages
3. Verify no breaking changes to existing flow

**Phase 4: UI Updates** (2-3 hours)
1. Import `useLoadingState` in AirConRemote
2. Replace data checks with loading state flags
3. Add Skeleton components for each data-dependent value
4. Add ARIA attributes for accessibility
5. Test loading states in browser

**Phase 5: Testing & Polish** (1-2 hours)
1. Integration testing with real WebSocket
2. Test rapid reconnections
3. Test room switching
4. Verify animations smooth
5. Accessibility testing

**Total Estimated Time**: 6-10 hours

---

### 13.2 Rollout Strategy

**Development Environment**:
1. Implement all changes in feature branch
2. Test with local development server
3. Verify with MQTT simulator

**Staging Environment**:
1. Deploy to staging
2. Test with real MQTT broker
3. Monitor for issues (console errors, infinite loops)
4. Performance testing with Chrome DevTools

**Production Rollout**:
1. Deploy during low-traffic period
2. Monitor error rates via logging
3. Watch for performance degradation
4. Have rollback plan ready (feature flag or quick revert)

---

### 13.3 Rollback Plan

**If Issues Detected**:
1. **Quick Revert**: Git revert commit(s)
2. **Feature Flag**: Add flag to disable loading state logic
3. **Fallback Mode**: Hook returns `canShowControls=false` until data loads (old behavior)

**Monitoring Metrics**:
- Error rate (should not increase)
- Time to first render (should decrease from ~2s to <200ms)
- Memory usage (should be stable)
- Re-render count (should be low, no infinite loops)

---

## 14. Future Enhancements (Out of Scope)

The following enhancements are **explicitly out of scope** for this implementation but could be added later:

### 14.1 Timeout Logic (Low Priority)

**Feature**: Show error after 10 seconds if no data arrives

**Implementation**:
```typescript
const { dataAge, hasRoomData } = useLoadingState(roomId);

const hasTimedOut = useMemo(() => {
  if (hasRoomData) return false;
  if (dataAge === null) return false;
  return dataAge > 10000; // 10 seconds
}, [hasRoomData, dataAge]);

if (hasTimedOut) {
  return <TimeoutError onRetry={retryConnection} />;
}
```

---

### 14.2 Progressive Loading (YAGNI)

**Feature**: Show different loading phases (initial → partial → complete)

**Why Rejected**: Adds complexity with minimal UX benefit

---

### 14.3 Optimistic UI Updates (Separate Feature)

**Feature**: Show command result immediately before server confirmation

**Why Out of Scope**: Different feature, requires separate design

---

### 14.4 Offline Mode (Separate Feature)

**Feature**: Work with cached data when offline

**Why Out of Scope**: Requires service worker, separate spec needed

---

## 15. References & Documentation

### 15.1 Related Files

**Modified Files**:
- `frontend/src/stores/api-aircon-store.ts` - Store extension
- `frontend/src/components/AirConRemote.tsx` - UI updates
- `frontend/src/components/AirconProvider.tsx` - Timestamp tracking

**New Files**:
- `frontend/src/hooks/useLoadingState.ts` - Loading state hook
- `frontend/src/hooks/__tests__/useLoadingState.test.ts` - Hook tests

**Unchanged Files** (no modifications needed):
- `frontend/src/lib/mqtt/mqtt-config.ts` - MQTT schemas
- `frontend/src/lib/websocket/websocket-client.ts` - WebSocket client
- Backend files - no changes

---

### 15.2 External References

**Design Patterns**:
- Facade Pattern: https://refactoring.guru/design-patterns/facade
- Null Object Pattern: https://refactoring.guru/design-patterns/null-object
- Observer Pattern: https://refactoring.guru/design-patterns/observer

**React Patterns**:
- Custom Hooks: https://react.dev/learn/reusing-logic-with-custom-hooks
- Zustand Best Practices: https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions

**UI Components**:
- ShadcnUI Skeleton: https://ui.shadcn.com/docs/components/skeleton
- Framer Motion AnimatePresence: https://www.framer.com/motion/animate-presence/

**Accessibility**:
- ARIA Live Regions: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
- ARIA Busy State: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-busy

---

## 16. Approval & Sign-off

This design document must be reviewed and approved before proceeding to implementation.

**Review Checklist**:
- [ ] Clean code principles properly applied (DRY, SOLID, YAGNI)
- [ ] Design patterns justified with trade-off analysis
- [ ] Architecture maintains separation of concerns
- [ ] Performance considerations addressed
- [ ] Zustand v5 patterns correctly applied (no infinite loops)
- [ ] Error handling and edge cases covered
- [ ] Testing strategy comprehensive
- [ ] Implementation plan realistic
- [ ] No breaking changes to existing functionality

**Stakeholders**:
- [ ] Technical Lead: Approve architecture design
- [ ] Frontend Developer: Confirm implementation feasibility
- [ ] UX Designer: Approve loading state UX
- [ ] QA Lead: Approve testing strategy

---

**Next Steps**:
1. Review and approve this design document
2. Proceed to Implementation Plan (`implementation.md`)
3. Begin development with Phase 1 (Store Foundation)
