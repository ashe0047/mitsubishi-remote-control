# Implementation Plan: Air Conditioner Loading State Enhancement

**Feature Name**: Aircon Loading State Enhancement
**Version**: 1.0
**Date**: 2025-10-13
**Status**: Draft
**Estimated Duration**: 6-10 hours

---

## 1. Executive Summary

This document provides the step-by-step implementation plan for the Air Conditioner Loading State Enhancement feature. The implementation follows the technical design specified in [`design.md`](design.md) and fulfills the requirements outlined in [`spec.md`](spec.md).

**Implementation Strategy**:
- Phased approach with incremental testing
- Bottom-up implementation (Store → Hook → UI)
- Context7 documentation lookup for package-specific patterns
- Feedback checkpoints after each phase
- Continuous clean code compliance validation

---

## 2. Prerequisites & Setup

### 2.1 Required Tools & Documentation

**Context7 Documentation Queries** (REQUIRED before implementation):
1. **Zustand v5 Patterns**:
   ```
   Library: zustand
   Topic: selectors, useShallow, store patterns, avoiding infinite loops
   ```

2. **Framer Motion AnimatePresence**:
   ```
   Library: framer-motion
   Topic: AnimatePresence, layout animations, exit animations
   ```

3. **ShadcnUI Skeleton Component**:
   ```
   Library: shadcn-ui
   Topic: skeleton component, loading states
   ```

4. **React Testing Library**:
   ```
   Library: @testing-library/react
   Topic: renderHook, waitFor, async testing
   ```

### 2.2 Development Environment

**Verify Setup**:
```bash
# From /frontend directory
cd frontend

# Verify dependencies installed
pnpm install

# Verify TypeScript compilation
pnpm exec tsc --noEmit

# Verify linting passes
pnpm lint

# Verify tests pass
pnpm test

# Start dev server (for manual testing)
pnpm dev
```

### 2.3 Branch Strategy

```bash
# Create feature branch
git checkout development
git pull origin development
git checkout -b feature/aircon-loading-state

# Commit strategy: One commit per phase
# Example: "feat(aircon): phase 1 - add loading state tracking to store"
```

---

## 3. Implementation Phases

### Phase 1: Store Foundation (2 hours)

**Objective**: Extend Zustand store with timestamp tracking for data availability

**Files to Modify**:
- `frontend/src/stores/api-aircon-store.ts`

**Files to Create**:
- `frontend/src/stores/__tests__/api-aircon-store-loading.test.ts` (new test file)

---

#### Step 1.1: Add Type Definitions

**Location**: `frontend/src/stores/api-aircon-store.ts` (top of file, after imports)

```typescript
/**
 * Tracks when data was received for a specific room.
 * Used to determine loading state independently of connection status.
 */
export interface RoomDataTimestamps {
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

**Clean Code Check**:
- ✅ SRP: Type definition has single responsibility (data structure)
- ✅ DRY: Centralized timestamp structure, no duplication

---

#### Step 1.2: Extend Store Interface

**Location**: `frontend/src/stores/api-aircon-store.ts` (interface `ApiAirconStoreState`)

```typescript
export interface ApiAirconStoreState extends ApiAirconProps {
  // ===== EXISTING PROPERTIES =====
  isConnected: boolean;
  isMqttConnected: boolean;
  rooms: RoomsType;
  // ... other existing properties ...

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
   * Check if room has received ANY data (state, settings, or devices).
   * @returns true if any data type has been received
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
   * Get age of room data in milliseconds since first message.
   * @returns milliseconds since first data, or null if no data received
   */
  getRoomDataAge: (roomId: string) => number | null;
}
```

**Clean Code Check**:
- ✅ ISP: Focused interface with only necessary methods
- ✅ Documentation: All methods have JSDoc comments

---

#### Step 1.3: Initialize State

**Location**: Inside `createApiAirconStore()` function, in the return statement

```typescript
const createApiAirconStore = (initProps?: Partial<ApiAirconProps>) => {
  const DEFAULT_PROPS: ApiAirconProps = {
    isConnected: false,
    isMqttConnected: false,
    isProcessingCommands: false,
  };

  return createStore<ApiAirconStoreState>()((set, get) => ({
    ...DEFAULT_PROPS,
    ...initProps,
    rooms: {},
    connectionStatus: DEFAULT_CONNECTION_STATUS,
    navigationState: DEFAULT_NAVIGATION_STATE,

    // === EXISTING STATE ===
    // ... existing state properties ...

    // === NEW STATE ===
    roomDataTimestamps: {}, // Initialize as empty record

    // === NEW METHODS (implement below) ===
    markRoomStateReceived: (roomId: string) => { /* implementation below */ },
    markRoomSettingsReceived: (roomId: string) => { /* implementation below */ },
    markRoomDevicesReceived: (roomId: string) => { /* implementation below */ },
    hasReceivedRoomData: (roomId: string) => { /* implementation below */ },
    hasReceivedRoomState: (roomId: string) => { /* implementation below */ },
    hasReceivedRoomSettings: (roomId: string) => { /* implementation below */ },
    getRoomDataAge: (roomId: string) => { /* implementation below */ },

    // ... rest of existing methods ...
  }));
};
```

---

#### Step 1.4: Implement Timestamp Marking Methods

**Location**: Inside store implementation

```typescript
markRoomStateReceived: (roomId) => {
  set((state) => {
    // Get existing timestamps or create default
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
          // Set first message timestamp if not already set
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
```

**Clean Code Check**:
- ✅ DRY: Similar structure but can't be further abstracted without complexity
- ✅ SRP: Each method marks single data type
- ✅ Immutability: All updates use spread operator

---

#### Step 1.5: Implement Query Methods

```typescript
hasReceivedRoomData: (roomId) => {
  const timestamps = get().roomDataTimestamps[roomId];
  if (!timestamps) return false;

  // Return true if ANY data type has been received
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
```

**Clean Code Check**:
- ✅ SRP: Each method queries single aspect
- ✅ Null Safety: Proper null checks with optional chaining
- ✅ Performance: Direct property access, O(1) lookup

---

#### Step 1.6: Update Existing Methods to Call Timestamp Tracking

**Update `updateRoomState()`**:
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

**Update `updateRoomSettings()`**:
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

**Update `setRooms()`**:
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

**Clean Code Check**:
- ✅ OCP: Extended functionality without modifying core logic
- ✅ Minimal Changes: Single line addition per method

---

#### Step 1.7: Write Unit Tests

**Create**: `frontend/src/stores/__tests__/api-aircon-store-loading.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import createApiAirconStore from '../api-aircon-store';

describe('api-aircon-store: Loading State Tracking', () => {
  let store: ReturnType<typeof createApiAirconStore>;

  beforeEach(() => {
    store = createApiAirconStore();
  });

  describe('markRoomStateReceived', () => {
    it('should set stateReceived timestamp', () => {
      const beforeTimestamp = Date.now();

      store.getState().markRoomStateReceived('room1');

      const afterTimestamp = Date.now();
      const timestamps = store.getState().roomDataTimestamps['room1'];

      expect(timestamps).toBeDefined();
      expect(timestamps.stateReceived).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamps.stateReceived).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should set firstMessageReceived on first call', () => {
      store.getState().markRoomStateReceived('room1');

      const timestamps = store.getState().roomDataTimestamps['room1'];

      expect(timestamps.firstMessageReceived).toBeDefined();
      expect(timestamps.firstMessageReceived).toEqual(timestamps.stateReceived);
    });

    it('should not overwrite firstMessageReceived on subsequent calls', () => {
      store.getState().markRoomStateReceived('room1');
      const firstTimestamp = store.getState().roomDataTimestamps['room1'].firstMessageReceived;

      // Wait 10ms
      const promise = new Promise(resolve => setTimeout(resolve, 10));
      await promise;

      store.getState().markRoomStateReceived('room1');
      const secondTimestamp = store.getState().roomDataTimestamps['room1'].firstMessageReceived;

      expect(secondTimestamp).toEqual(firstTimestamp);
    });
  });

  describe('markRoomSettingsReceived', () => {
    it('should set settingsReceived timestamp', () => {
      store.getState().markRoomSettingsReceived('room1');

      const timestamps = store.getState().roomDataTimestamps['room1'];

      expect(timestamps.settingsReceived).toBeDefined();
      expect(timestamps.settingsReceived).toBeGreaterThan(0);
    });
  });

  describe('markRoomDevicesReceived', () => {
    it('should set devicesReceived timestamp', () => {
      store.getState().markRoomDevicesReceived('room1');

      const timestamps = store.getState().roomDataTimestamps['room1'];

      expect(timestamps.devicesReceived).toBeDefined();
      expect(timestamps.devicesReceived).toBeGreaterThan(0);
    });
  });

  describe('hasReceivedRoomData', () => {
    it('should return false for room with no data', () => {
      expect(store.getState().hasReceivedRoomData('room1')).toBe(false);
    });

    it('should return true when state received', () => {
      store.getState().markRoomStateReceived('room1');

      expect(store.getState().hasReceivedRoomData('room1')).toBe(true);
    });

    it('should return true when settings received', () => {
      store.getState().markRoomSettingsReceived('room1');

      expect(store.getState().hasReceivedRoomData('room1')).toBe(true);
    });

    it('should return true when devices received', () => {
      store.getState().markRoomDevicesReceived('room1');

      expect(store.getState().hasReceivedRoomData('room1')).toBe(true);
    });
  });

  describe('hasReceivedRoomState', () => {
    it('should return false when no state received', () => {
      expect(store.getState().hasReceivedRoomState('room1')).toBe(false);
    });

    it('should return true when state received', () => {
      store.getState().markRoomStateReceived('room1');

      expect(store.getState().hasReceivedRoomState('room1')).toBe(true);
    });

    it('should return false when only settings received', () => {
      store.getState().markRoomSettingsReceived('room1');

      expect(store.getState().hasReceivedRoomState('room1')).toBe(false);
    });
  });

  describe('hasReceivedRoomSettings', () => {
    it('should return false when no settings received', () => {
      expect(store.getState().hasReceivedRoomSettings('room1')).toBe(false);
    });

    it('should return true when settings received', () => {
      store.getState().markRoomSettingsReceived('room1');

      expect(store.getState().hasReceivedRoomSettings('room1')).toBe(true);
    });
  });

  describe('getRoomDataAge', () => {
    it('should return null for room with no data', () => {
      expect(store.getState().getRoomDataAge('room1')).toBeNull();
    });

    it('should return age in milliseconds after data received', async () => {
      store.getState().markRoomStateReceived('room1');

      // Wait 50ms
      await new Promise(resolve => setTimeout(resolve, 50));

      const age = store.getState().getRoomDataAge('room1');

      expect(age).toBeGreaterThanOrEqual(50);
      expect(age).toBeLessThan(200); // Should be reasonably close
    });
  });

  describe('multi-room tracking', () => {
    it('should track multiple rooms independently', () => {
      store.getState().markRoomStateReceived('room1');
      store.getState().markRoomSettingsReceived('room2');

      expect(store.getState().hasReceivedRoomState('room1')).toBe(true);
      expect(store.getState().hasReceivedRoomState('room2')).toBe(false);

      expect(store.getState().hasReceivedRoomSettings('room1')).toBe(false);
      expect(store.getState().hasReceivedRoomSettings('room2')).toBe(true);
    });
  });

  describe('integration with updateRoomState', () => {
    it('should mark state received when updateRoomState is called', () => {
      // First add room to store
      store.getState().setRooms([{
        id: 'room1',
        name: 'Room 1',
        online: true,
        devices: [],
        updatedAt: Date.now(),
      }]);

      // Update room state
      store.getState().updateRoomState('room1', {
        temperature: 24,
        roomTemperature: 22,
        fan: 'AUTO',
        vane: 'AUTO',
        wideVane: '|',
        mode: 'cool',
        action: 'running',
      });

      // Check that timestamp was marked
      expect(store.getState().hasReceivedRoomState('room1')).toBe(true);
    });
  });

  describe('integration with updateRoomSettings', () => {
    it('should mark settings received when updateRoomSettings is called', () => {
      // First add room to store
      store.getState().setRooms([{
        id: 'room1',
        name: 'Room 1',
        online: true,
        devices: [],
        updatedAt: Date.now(),
      }]);

      // Update room settings
      store.getState().updateRoomSettings('room1', {
        temperature: 24,
        fan: 'AUTO',
        vane: 'AUTO',
        wideVane: '|',
        mode: 'cool',
      });

      // Check that timestamp was marked
      expect(store.getState().hasReceivedRoomSettings('room1')).toBe(true);
    });
  });
});
```

**Run Tests**:
```bash
# From /frontend directory
pnpm test api-aircon-store-loading.test.ts
```

**Clean Code Check**:
- ✅ Comprehensive: All methods tested
- ✅ Isolated: Each test independent
- ✅ Clear: Descriptive test names

---

#### Step 1.8: Validate Phase 1

```bash
# Type check
pnpm exec tsc --noEmit

# Run tests
pnpm test api-aircon-store-loading.test.ts

# Lint
pnpm lint

# Commit
git add frontend/src/stores/api-aircon-store.ts
git add frontend/src/stores/__tests__/api-aircon-store-loading.test.ts
git commit -m "feat(aircon): phase 1 - add loading state tracking to store

- Add RoomDataTimestamps type definition
- Extend store with roomDataTimestamps state
- Implement mark*Received() timestamp methods
- Implement has*Received() query methods
- Integrate with existing updateRoom*() methods
- Add comprehensive unit tests

Clean code compliance:
- DRY: Centralized timestamp tracking
- SRP: Each method single responsibility
- ISP: Focused interface
"
```

**Phase 1 Complete** ✅

---

### Phase 2: Custom Hook Creation (1 hour)

**Objective**: Create `useLoadingState` hook that provides loading flags to components

**Files to Create**:
- `frontend/src/hooks/useLoadingState.ts`
- `frontend/src/hooks/__tests__/useLoadingState.test.ts`

---

#### Step 2.1: Fetch Context7 Documentation

**REQUIRED**: Before implementing, fetch latest Zustand patterns

```bash
# Use Context7 tools to get latest documentation
# Query 1: Zustand selectors and useShallow
# Query 2: React hooks best practices
```

---

#### Step 2.2: Create Hook File

**Create**: `frontend/src/hooks/useLoadingState.ts`

```typescript
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAirconContext } from './useAircon';

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
 * CRITICAL: Uses Zustand v5 safe selectors with useShallow to prevent
 * infinite re-render loops.
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
export function useLoadingState(roomId: string): LoadingStateResult {
  const store = useAirconContext();

  if (!store) {
    throw new Error('useLoadingState must be used within ApiAirconProvider');
  }

  // CRITICAL: Use useShallow to select multiple values safely
  // This prevents infinite re-render loops in Zustand v5
  // NEVER use useStore(store) without selector!
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
    // Query data availability for this specific room
    const hasRoomData = hasReceivedRoomData(roomId);
    const hasStateData = hasReceivedRoomState(roomId);
    const hasSettingsData = hasReceivedRoomSettings(roomId);
    const dataAge = getRoomDataAge(roomId);

    // Calculate derived flags
    const isInitialLoading = isConnected && !hasRoomData;
    const canShowControls = isConnected; // Show controls when connected
    const canInteract = isConnected && hasRoomData; // Need data to interact

    return {
      // Connection status
      isConnected,
      isMqttConnected,

      // Data availability
      hasRoomData,
      hasStateData,
      hasSettingsData,

      // Derived flags
      isInitialLoading,
      canShowControls,
      canInteract,

      // Metadata
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

**Clean Code Check**:
- ✅ SRP: Hook only manages loading state
- ✅ DIP: Components depend on hook abstraction, not store
- ✅ ISP: Focused interface with only necessary properties
- ✅ Documentation: Complete JSDoc with examples
- ✅ Zustand v5 Safe: Uses useShallow properly

---

#### Step 2.3: Create Hook Tests

**Create**: `frontend/src/hooks/__tests__/useLoadingState.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { useLoadingState } from '../useLoadingState';
import { ApiAirconProvider } from '@/components/AirconProvider';
import createApiAirconStore from '@/stores/api-aircon-store';

describe('useLoadingState', () => {
  let store: ReturnType<typeof createApiAirconStore>;

  beforeEach(() => {
    store = createApiAirconStore();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiAirconProvider roomId="test-room">{children}</ApiAirconProvider>
  );

  it('should throw error when used outside ApiAirconProvider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useLoadingState('room1'));
    }).toThrow('useLoadingState must be used within ApiAirconProvider');

    console.error = originalError;
  });

  describe('connection flags', () => {
    it('should return isConnected=false initially', () => {
      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.isConnected).toBe(false);
    });

    it('should return isConnected=true when connected', () => {
      act(() => {
        store.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('data availability flags', () => {
    it('should return hasRoomData=false initially', () => {
      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.hasRoomData).toBe(false);
    });

    it('should return hasRoomData=true after state received', () => {
      act(() => {
        store.getState().markRoomStateReceived('room1');
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.hasRoomData).toBe(true);
      expect(result.current.hasStateData).toBe(true);
    });

    it('should return hasStateData=true, hasSettingsData=false when only state received', () => {
      act(() => {
        store.getState().markRoomStateReceived('room1');
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.hasStateData).toBe(true);
      expect(result.current.hasSettingsData).toBe(false);
    });
  });

  describe('derived flags', () => {
    it('should return isInitialLoading=true when connected but no data', () => {
      act(() => {
        store.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.isInitialLoading).toBe(true);
    });

    it('should return isInitialLoading=false when connected and has data', () => {
      act(() => {
        store.getState().setIsConnected(true);
        store.getState().markRoomStateReceived('room1');
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.isInitialLoading).toBe(false);
    });

    it('should return canShowControls=true when connected', () => {
      act(() => {
        store.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.canShowControls).toBe(true);
    });

    it('should return canShowControls=false when disconnected', () => {
      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.canShowControls).toBe(false);
    });

    it('should return canInteract=false when no data', () => {
      act(() => {
        store.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.canInteract).toBe(false);
    });

    it('should return canInteract=true when connected and has data', () => {
      act(() => {
        store.getState().setIsConnected(true);
        store.getState().markRoomStateReceived('room1');
      });

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.canInteract).toBe(true);
    });
  });

  describe('dataAge', () => {
    it('should return dataAge=null when no data', () => {
      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.dataAge).toBeNull();
    });

    it('should return dataAge in milliseconds after data received', async () => {
      act(() => {
        store.getState().markRoomStateReceived('room1');
      });

      // Wait 50ms
      await new Promise(resolve => setTimeout(resolve, 50));

      const { result } = renderHook(() => useLoadingState('room1'), { wrapper });

      expect(result.current.dataAge).toBeGreaterThanOrEqual(50);
      expect(result.current.dataAge).toBeLessThan(200);
    });
  });

  describe('multiple rooms', () => {
    it('should track different rooms independently', () => {
      act(() => {
        store.getState().setIsConnected(true);
        store.getState().markRoomStateReceived('room1');
      });

      const { result: result1 } = renderHook(() => useLoadingState('room1'), { wrapper });
      const { result: result2 } = renderHook(() => useLoadingState('room2'), { wrapper });

      expect(result1.current.hasRoomData).toBe(true);
      expect(result2.current.hasRoomData).toBe(false);
    });
  });

  describe('re-render stability', () => {
    it('should not cause infinite re-renders', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const loadingState = useLoadingState('room1');
        return <div>{loadingState.isConnected ? 'Connected' : 'Disconnected'}</div>;
      };

      renderHook(() => <TestComponent />, { wrapper });

      // Should render exactly once (initial render)
      expect(renderCount).toBe(1);
    });
  });
});
```

**Run Tests**:
```bash
pnpm test useLoadingState.test.ts
```

---

#### Step 2.4: Validate Phase 2

```bash
# Type check
pnpm exec tsc --noEmit

# Run tests
pnpm test useLoadingState.test.ts

# Lint
pnpm lint

# Commit
git add frontend/src/hooks/useLoadingState.ts
git add frontend/src/hooks/__tests__/useLoadingState.test.ts
git commit -m "feat(aircon): phase 2 - create useLoadingState hook

- Create LoadingStateResult interface
- Implement useLoadingState hook with Zustand v5 safe selectors
- Add comprehensive unit tests
- Verify no infinite re-render loops

Clean code compliance:
- SRP: Hook only manages loading state
- DIP: Facade pattern hides store complexity
- ISP: Focused interface
- Zustand v5 safe with useShallow
"
```

**Phase 2 Complete** ✅

---

### Phase 3: Provider Integration (30 minutes)

**Objective**: Update AirconProvider to call timestamp marking methods

**Files to Modify**:
- `frontend/src/components/AirconProvider.tsx`

---

#### Step 3.1: Update Message Handlers

**Location**: `frontend/src/components/AirconProvider.tsx` (line 76 onwards)

**Modify `room-status-update` handler**:

```typescript
case 'room-status-update':
  if (data) {
    const payload = data as RoomStatusUpdatePayload;
    state.applyRoomStatusUpdate(payload);

    // Derive state and settings
    const primaryDevice: DeviceInfo | undefined = payload.deviceUpdates?.find((device) => device.currentStatus);
    const derivedState =
      deriveAirConStateFromPayload(payload) ??
      deriveAirConStateFromDevice(primaryDevice);

    console.debug('AirconProvider: Room status update received', {
      roomId: payload.roomId,
      updateType: payload.updateType,
      deviceCount: payload.deviceUpdates?.length ?? 0,
      derivedStateExists: !!derivedState,
    });

    if (derivedState) {
      console.debug('AirconProvider: Derived state evaluated', { roomId: payload.roomId, derivedState });
      state.updateRoomState(payload.roomId, derivedState);
      // Timestamp marking happens inside updateRoomState

      state.updateRoomSettings(
        payload.roomId,
        deriveSettingsFromPayload(payload.settings) ?? deriveSettingsFromState(derivedState)
      );
      // Timestamp marking happens inside updateRoomSettings
    } else if (payload.settings) {
      const derivedSettings = deriveSettingsFromPayload(payload.settings);
      if (derivedSettings) {
        state.updateRoomSettings(payload.roomId, derivedSettings);
        // Timestamp marking happens inside updateRoomSettings
      }
    }

    // NEW: Explicitly mark data types as received based on payload content
    // This handles cases where applyRoomStatusUpdate doesn't call update methods
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

**No changes needed for `room-state` and `room-settings` cases** - timestamp marking already happens inside `updateRoomState()` and `updateRoomSettings()` methods.

---

#### Step 3.2: Add Console Logging for Debugging

**Optional**: Add console logs to track timestamp marking

```typescript
case 'room-status-update':
  if (data) {
    const payload = data as RoomStatusUpdatePayload;

    // ... existing logic ...

    // Log timestamp marking for debugging
    console.debug('AirconProvider: Marking data received', {
      roomId: payload.roomId,
      hasState: !!payload.state,
      hasSettings: !!payload.settings,
      hasDevices: (payload.deviceUpdates?.length ?? 0) > 0,
    });

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

---

#### Step 3.3: Validate Phase 3

```bash
# Type check
pnpm exec tsc --noEmit

# Lint
pnpm lint

# Manual test: Start dev server and check console
pnpm dev
# Navigate to AC control page
# Check browser console for "Marking data received" logs

# Commit
git add frontend/src/components/AirconProvider.tsx
git commit -m "feat(aircon): phase 3 - integrate timestamp tracking in provider

- Update room-status-update handler to mark data received
- Add explicit timestamp marking for all data types
- Add debug logging for timestamp tracking

Clean code compliance:
- SRP: Provider maintains single responsibility
- Minimal changes to existing logic
"
```

**Phase 3 Complete** ✅

---

### Phase 4: UI Updates (2-3 hours)

**Objective**: Update AirConRemote component to use loading state and show skeletons

**Files to Modify**:
- `frontend/src/components/AirConRemote.tsx`

**Files to Verify Installed**:
- ShadcnUI Skeleton component (should already be available)

---

#### Step 4.1: Verify Skeleton Component

```bash
# Check if Skeleton component exists
ls frontend/src/components/ui/skeleton.tsx

# If not exists, install it
cd frontend
pnpm dlx shadcn@latest add skeleton
```

---

#### Step 4.2: Import New Dependencies

**Location**: Top of `frontend/src/components/AirConRemote.tsx`

```typescript
// Add these imports
import { useLoadingState } from '@/hooks/useLoadingState';
import { Skeleton } from '@/components/ui/skeleton';
```

---

#### Step 4.3: Use Loading State Hook

**Location**: Inside `ApiAirConRemote` component function, after existing hooks

```typescript
const ApiAirConRemote = ({
  room: { roomId },
}: IApiAirConRemoteProps) => {
  const {
    getRoomInfo,
    setTemperature,
    setMode,
    setFan,
  } = useAirconContext();

  // NEW: Use loading state hook
  const {
    canShowControls,
    hasStateData,
    canInteract,
    isInitialLoading,
  } = useLoadingState(roomId);

  const roomInfo = getRoomInfo(roomId);
  const airconState = roomInfo?.state;

  // ... rest of component
```

---

#### Step 4.4: Replace Early Return with Connection Check

**OLD CODE** (lines 201-210):
```typescript
  // Loading state
  if (!roomInfo) {
    return (
      <div className="flex justify-center items-center min-h-screen w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading room data...</p>
        </div>
      </div>
    );
  }
```

**NEW CODE**:
```typescript
  // Connection check - only show error if not connected
  if (!canShowControls) {
    return (
      <div className="flex justify-center items-center min-h-screen w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to air conditioner...</p>
          <p className="text-xs text-muted-foreground mt-2">
            {status.overall === 'disconnected' ? 'Connection failed' : 'Establishing connection'}
          </p>
        </div>
      </div>
    );
  }

  // At this point: connected, controls will be shown
  // Data might not be available yet (show skeletons)
```

---

#### Step 4.5: Remove No-Data Early Return

**OLD CODE** (lines 347-351):
```typescript
            {!airconState ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No data available for this room</p>
              </div>
            ) : (
```

**NEW CODE** (Remove this conditional entirely):
```typescript
            <>
              {/* Temperature Display */}
              <div className="mb-8 text-center">
                {/* Content always renders, with skeletons for missing data */}
              </div>
              {/* ... rest of controls ... */}
            </>
```

---

#### Step 4.6: Add Skeleton for Room Temperature

**OLD CODE** (lines 354-367):
```typescript
                <div className="flex justify-center items-center mb-2">
                  <motion.div
                    key={`room-${"roomTemperature" in airconState ? airconState.roomTemperature : 0}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-muted-foreground"
                  >
                    Room:{" "}
                    {displayTemp("roomTemperature" in airconState ? airconState.roomTemperature : 0)}
                    °{prefs.useFahrenheit ? "F" : "C"}
                  </motion.div>
                </div>
```

**NEW CODE**:
```typescript
                <div className="flex justify-center items-center mb-2">
                  {hasStateData ? (
                    <motion.div
                      key={`room-${airconState?.roomTemperature ?? 0}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-muted-foreground"
                    >
                      Room:{" "}
                      {displayTemp(airconState?.roomTemperature ?? 0)}
                      °{prefs.useFahrenheit ? "F" : "C"}
                    </motion.div>
                  ) : (
                    <Skeleton className="h-4 w-24" role="status" aria-label="Loading room temperature" />
                  )}
                </div>
```

---

#### Step 4.7: Add Skeleton for Target Temperature

**OLD CODE** (lines 369-385):
```typescript
                  <div className="relative flex justify-center items-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`temp-${airconState.temperature}-${isPowerOn}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.4 }}
                        className="text-6xl font-light"
                      >
                        {isPowerOn ? displayTemp(airconState.temperature) : "--"}
                        <span className="text-2xl ml-1">
                          {prefs.useFahrenheit ? "°F" : "°C"}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
```

**NEW CODE**:
```typescript
                  <div className="relative flex justify-center items-center">
                    {hasStateData ? (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`temp-${airconState?.temperature}-${isPowerOn}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.4 }}
                          className="text-6xl font-light"
                        >
                          {isPowerOn ? displayTemp(airconState?.temperature ?? 24) : "--"}
                          <span className="text-2xl ml-1">
                            {prefs.useFahrenheit ? "°F" : "°C"}
                          </span>
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <Skeleton className="h-20 w-32 mx-auto rounded-lg" role="status" aria-label="Loading temperature" />
                    )}
                  </div>
```

---

#### Step 4.8: Add Skeleton for Mode Badge

**OLD CODE** (lines 387-404):
```typescript
                  <AnimatePresence>
                    {isPowerOn && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="flex items-center justify-center mt-2"
                      >
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted/50">
                          {getModeIcon(airconState.mode)}
                          <span className="text-sm font-medium ml-1">
                            {airconState.mode}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
```

**NEW CODE**:
```typescript
                  <div className="flex items-center justify-center mt-2">
                    {hasStateData ? (
                      <AnimatePresence>
                        {isPowerOn && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted/50"
                          >
                            {getModeIcon(airconState?.mode ?? 'off')}
                            <span className="text-sm font-medium ml-1">
                              {airconState?.mode ?? 'off'}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ) : (
                      <Skeleton className="h-8 w-24 rounded-full" role="status" aria-label="Loading mode" />
                    )}
                  </div>
```

---

#### Step 4.9: Update Control Disabled States

**Temperature Controls** (Slider and buttons):
```typescript
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTemperatureStep(-1)}
                          disabled={!canInteract || !isPowerOn || (airconState?.temperature ?? 16) <= 16}
                          className="h-10 w-10 rounded-full"
                          aria-label="Decrease temperature"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!canInteract ? 'Waiting for data...' : 'Decrease Temperature'}
                      </TooltipContent>
                    </Tooltip>

                    <Slider
                      disabled={!canInteract || !isPowerOn}
                      min={16}
                      max={31}
                      step={1}
                      value={[airconState?.temperature ?? 24]}
                      onValueChange={handleTemperatureChange}
                      className={cn(
                        "w-[60%] cursor-pointer transition-opacity duration-200",
                        (!canInteract || !isPowerOn) && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label="Temperature control"
                      aria-disabled={!canInteract || !isPowerOn}
                    />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTemperatureStep(1)}
                          disabled={!canInteract || !isPowerOn || (airconState?.temperature ?? 31) >= 31}
                          className="h-10 w-10 rounded-full"
                          aria-label="Increase temperature"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!canInteract ? 'Waiting for data...' : 'Increase Temperature'}
                      </TooltipContent>
                    </Tooltip>
```

**Power Button**:
```typescript
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      onClick={handlePowerToggle}
                      disabled={!canInteract}
                      className={cn(
                        "rounded-full w-16 h-16 transition-all duration-300 shadow-lg",
                        isPowerOn
                          ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                          : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700",
                        !canInteract && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label={isPowerOn ? 'Turn off' : 'Turn on'}
                      aria-disabled={!canInteract}
                    >
                      <Power
                        className={cn(
                          "h-8 w-8",
                          isPowerOn ? "text-white" : "text-gray-500 dark:text-gray-400"
                        )}
                      />
                    </Button>
                  </motion.div>
```

**Mode Buttons**:
```typescript
                            <motion.div whileTap={{ scale: 0.95 }}>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleModeChange(mode)}
                                disabled={!canInteract || !isPowerOn}
                                className={cn(
                                  "h-12 w-full rounded-lg transition-all duration-200",
                                  airconState?.mode === mode && getModeColor(mode),
                                  (!canInteract || !isPowerOn) && "opacity-50 cursor-not-allowed"
                                )}
                                aria-label={`Set mode to ${getModeDisplayName(mode)}`}
                                aria-disabled={!canInteract || !isPowerOn}
                              >
                                {getModeIcon(mode)}
                              </Button>
                            </motion.div>
```

**Fan Speed Buttons**:
```typescript
                              <motion.div whileTap={{ scale: 0.95 }} className="w-full">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFanChange(firstSpeed)}
                                  disabled={!canInteract || !isPowerOn}
                                  className={cn(
                                    "h-10 w-full rounded-lg p-0 shadow-sm",
                                    speed.includes(airconState?.fan ?? 'AUTO') &&
                                    "bg-primary text-primary-foreground",
                                    (!canInteract || !isPowerOn) && "opacity-50 cursor-not-allowed"
                                  )}
                                  aria-label={`Set fan speed to ${getFanDisplayName(firstSpeed)}`}
                                  aria-disabled={!canInteract || !isPowerOn}
                                >
                                  <span className="text-xs">
                                    {firstSpeed === "QUIET" ? "Q" : firstSpeed}
                                  </span>
                                </Button>
                              </motion.div>
```

---

#### Step 4.10: Add ARIA Live Region

**Add after main Card component** (before closing return statement):

```typescript
        {/* ARIA Live Region for screen readers */}
        <div
          role="status"
          aria-live="polite"
          aria-busy={isInitialLoading}
          className="sr-only"
        >
          {isInitialLoading
            ? 'Loading air conditioner data...'
            : hasStateData
            ? 'Air conditioner data loaded'
            : 'Connected, waiting for data'}
        </div>
```

---

#### Step 4.11: Update `isPowerOn` Calculation

**Change from**:
```typescript
  const isPowerOn = airconState && airconState.mode !== MODE_VALUES.OFF;
```

**To**:
```typescript
  const isPowerOn = airconState && airconState.mode !== MODE_VALUES.OFF;
  // Fallback for loading state
  const displayPowerOn = hasStateData ? isPowerOn : false;
```

Then use `displayPowerOn` instead of `isPowerOn` in UI conditional rendering (but keep `isPowerOn` for actual state checks in handlers).

---

#### Step 4.12: Validate Phase 4

```bash
# Type check
pnpm exec tsc --noEmit

# Lint
pnpm lint

# Start dev server and manual test
pnpm dev

# Test checklist:
# 1. Navigate to AC control page
# 2. Verify controls appear immediately (before data)
# 3. Verify skeletons show for temperature, mode
# 4. Verify skeletons disappear when data arrives
# 5. Verify controls are disabled during loading
# 6. Verify smooth transition (no flicker)
# 7. Test reconnection (disconnect WiFi, reconnect)
# 8. Test room switching (no data reload)

# Commit
git add frontend/src/components/AirConRemote.tsx
git commit -m "feat(aircon): phase 4 - add loading skeletons to UI

- Import useLoadingState hook and Skeleton component
- Replace early returns with connection check
- Add skeletons for temperature, room temp, mode badge
- Update control disabled states to use canInteract
- Add ARIA live region for accessibility
- Add tooltips explaining disabled states

Clean code compliance:
- SRP: Component only handles rendering
- Uses loading state abstraction
- Accessible with ARIA attributes
"
```

**Phase 4 Complete** ✅

---

### Phase 5: Testing & Polish (1-2 hours)

**Objective**: Comprehensive testing and bug fixes

---

#### Step 5.1: Integration Testing

**Manual Test Scenarios**:

1. **Normal Load Flow**:
   - Clear browser cache
   - Navigate to AC control page
   - ✅ Controls appear within 200ms
   - ✅ Skeletons visible for ~1-2s
   - ✅ Smooth transition to actual values
   - ✅ No layout shift

2. **Slow Network**:
   - Chrome DevTools → Network → Slow 3G
   - Navigate to AC control page
   - ✅ Controls still appear immediately
   - ✅ Skeletons persist until data arrives
   - ✅ No errors or timeouts

3. **Rapid Reconnection**:
   - Load page with data
   - Disconnect WiFi
   - Reconnect WiFi within 5s
   - ✅ No skeleton flash
   - ✅ Data persists
   - ✅ Connection status updates correctly

4. **Room Switching**:
   - Load room A
   - Navigate to room B
   - Navigate back to room A
   - ✅ Room A data still available
   - ✅ No reload/refetch
   - ✅ Smooth navigation

5. **Partial Data**:
   - Mock backend to send only state (no settings)
   - ✅ State values shown
   - ✅ Settings-dependent UI handles gracefully

6. **Accessibility**:
   - Use screen reader (NVDA/JAWS/VoiceOver)
   - ✅ Loading state announced
   - ✅ Data loaded state announced
   - ✅ Disabled controls explain why

---

#### Step 5.2: Performance Testing

**Chrome DevTools Performance Profiling**:

1. **Initial Render Performance**:
   ```
   Expected: < 50ms from WebSocket connect to controls visible
   Measure: Performance → Record → Navigate to page → Stop
   Check: Look for long tasks (>50ms)
   ```

2. **Re-render Count**:
   ```
   Expected: Minimal re-renders (< 5) during loading
   Measure: React DevTools → Profiler → Record
   Check: Component render count
   ```

3. **Animation Smoothness**:
   ```
   Expected: 60 FPS during skeleton → data transition
   Measure: Performance → Record → Wait for data load
   Check: Frame drops (should be none)
   ```

4. **Memory Usage**:
   ```
   Expected: No memory leaks
   Measure: Performance → Memory → Take snapshot
   Load page → Take snapshot → Compare
   Check: No growing heap size
   ```

---

#### Step 5.3: Browser Testing

**Test in multiple browsers**:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest, macOS/iOS)
- ✅ Mobile browsers (Chrome Android, Safari iOS)

---

#### Step 5.4: Fix Issues

**Common issues and fixes**:

1. **Skeleton not aligned with actual value**:
   - Solution: Match skeleton size classes exactly with actual element

2. **Layout shift during transition**:
   - Solution: Use same dimensions for skeleton and actual element
   - Add `min-h-[...]` classes to prevent collapse

3. **Infinite re-render loop**:
   - Solution: Verify useShallow usage in hook
   - Check dependency arrays in useMemo/useEffect

4. **Controls interactable during loading**:
   - Solution: Check `disabled={!canInteract}` on all interactive elements

---

#### Step 5.5: Polish & Cleanup

1. **Remove debug console.logs** (if any added)
2. **Verify all TypeScript types** are correct
3. **Check for unused imports**
4. **Format code**: `pnpm exec prettier --write frontend/src`
5. **Final lint**: `pnpm lint --fix`

---

#### Step 5.6: Final Validation

```bash
# Full test suite
cd frontend
pnpm test

# Type check
pnpm exec tsc --noEmit

# Lint
pnpm lint

# Build production
pnpm build

# Check bundle size (should not increase significantly)
du -sh .next/

# Commit final changes
git add .
git commit -m "feat(aircon): phase 5 - testing and polish

- Manual integration testing across scenarios
- Performance profiling and optimization
- Cross-browser testing
- Accessibility verification
- Code cleanup and formatting

All tests passing, feature complete.
"
```

**Phase 5 Complete** ✅

---

## 4. Post-Implementation Checklist

### 4.1 Code Quality Validation

**Clean Code Principles**:
- [ ] DRY: No duplicate loading logic across components
- [ ] SRP: Each module has single responsibility
- [ ] OCP: Easy to extend with new loading indicators
- [ ] ISP: Focused interfaces, no unnecessary dependencies
- [ ] DIP: Components depend on abstractions, not concretions
- [ ] YAGNI: No over-engineering, simple implementation

**Design Patterns**:
- [ ] Facade pattern correctly applied in useLoadingState hook
- [ ] Null Object pattern prevents null checks in UI
- [ ] Observer pattern (RxJS + Zustand) working correctly

**Architecture Quality**:
- [ ] High cohesion: Each module focused on single concern
- [ ] Low coupling: Components decoupled via hook abstraction
- [ ] Clear separation of concerns: UI, logic, state, infrastructure
- [ ] Correct dependency direction: UI → Hook → Store → Provider

---

### 4.2 Testing Validation

**Unit Tests**:
- [ ] Store methods: All timestamp tracking tested
- [ ] Hook: All flags and derived values tested
- [ ] No infinite re-render loops detected

**Integration Tests**:
- [ ] Loading flow works end-to-end
- [ ] Reconnection preserves data
- [ ] Room switching works smoothly
- [ ] Partial data handled gracefully

**Performance**:
- [ ] Initial render < 50ms
- [ ] No frame drops during animations
- [ ] No memory leaks detected

**Accessibility**:
- [ ] Screen reader announces loading states
- [ ] Keyboard navigation works during loading
- [ ] ARIA attributes correct

---

### 4.3 Documentation

**Code Documentation**:
- [ ] All new methods have JSDoc comments
- [ ] Complex logic has inline comments
- [ ] TypeScript types fully documented

**Spec Documents**:
- [ ] spec.md: Requirements complete
- [ ] design.md: Architecture documented
- [ ] implementation.md: This document complete

---

### 4.4 Deployment Readiness

**Pre-Deployment**:
- [ ] All tests passing
- [ ] No console errors in production build
- [ ] Bundle size acceptable (not significantly increased)
- [ ] Performance metrics within targets

**Rollout Plan**:
- [ ] Feature branch merged to development
- [ ] Staging deployment successful
- [ ] Smoke testing on staging complete
- [ ] Production deployment scheduled

**Rollback Plan**:
- [ ] Quick revert strategy documented
- [ ] Feature flag added (optional)
- [ ] Monitoring alerts configured

---

## 5. Feedback Checkpoints

**Mandatory Feedback Points** (use `mcp__mcp-feedback-enhanced__interactive_feedback` tool):

### Checkpoint 1: After Phase 1 (Store Foundation)
**Summary**:
- Store extended with timestamp tracking
- Unit tests passing
- Clean code compliance validated

**Feedback Questions**:
- Store implementation correct?
- Any concerns with timestamp structure?
- Should proceed to Phase 2?

---

### Checkpoint 2: After Phase 2 (Hook Creation)
**Summary**:
- useLoadingState hook created
- Zustand v5 patterns verified
- No infinite loops detected

**Feedback Questions**:
- Hook interface sufficient?
- Any missing loading flags?
- Should proceed to Phase 3?

---

### Checkpoint 3: After Phase 3 (Provider Integration)
**Summary**:
- Provider updated to track timestamps
- Manual testing confirms tracking works
- No breaking changes

**Feedback Questions**:
- Timestamp tracking working correctly?
- Any edge cases to handle?
- Should proceed to Phase 4?

---

### Checkpoint 4: After Phase 4 (UI Updates)
**Summary**:
- UI updated with skeletons
- Controls appear immediately
- Smooth transitions working

**Feedback Questions**:
- Loading UX acceptable?
- Skeleton animations smooth?
- Any visual tweaks needed?
- Should proceed to Phase 5?

---

### Checkpoint 5: After Phase 5 (Testing Complete)
**Summary**:
- All tests passing
- Performance validated
- Accessibility confirmed
- Feature complete

**Feedback Questions**:
- All requirements met?
- Ready for deployment?
- Any final concerns?

---

## 6. Success Criteria

**Feature is considered complete when**:

1. ✅ **Functional Requirements Met**:
   - Controls render immediately on WebSocket connection
   - Loading indicators shown for data-dependent values
   - Smooth transition when data arrives
   - Timeout handling (10s) working

2. ✅ **Non-Functional Requirements Met**:
   - Time to Interactive < 200ms (from 2-3s)
   - No layout shift during loading
   - Accessible with screen readers
   - Works on mobile devices

3. ✅ **Clean Code Standards Met**:
   - DRY, SOLID, YAGNI principles followed
   - Design patterns correctly applied
   - High cohesion, low coupling
   - Well-documented code

4. ✅ **Testing Complete**:
   - All unit tests passing
   - Integration tests passing
   - Performance within targets
   - Cross-browser tested

5. ✅ **Production Ready**:
   - No console errors
   - Bundle size acceptable
   - Deployment plan ready
   - Rollback plan documented

---

## 7. Future Enhancements (Out of Scope)

**Potential future additions** (not part of this implementation):

1. **Timeout Error Handling** (Low Priority):
   - Show error message after 10s without data
   - Add retry mechanism

2. **Progressive Loading Phases** (YAGNI):
   - Initial → Partial → Complete states
   - Rejected for current implementation

3. **Optimistic UI Updates** (Separate Feature):
   - Show command result immediately
   - Requires separate spec and design

4. **Offline Mode** (Separate Feature):
   - Cache data for offline use
   - Requires service worker implementation

5. **Loading Analytics** (Optional):
   - Track loading times
   - Monitor user experience metrics

---

## 8. References

**Internal Documentation**:
- [Requirements Specification](spec.md)
- [Technical Design](design.md)
- [Project CLAUDE.md](../../CLAUDE.md)

**External Resources**:
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)
- [ShadcnUI Skeleton](https://ui.shadcn.com/docs/components/skeleton)
- [Framer Motion AnimatePresence](https://www.framer.com/motion/animate-presence/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)

**Clean Code Resources**:
- [Clean Code Principles](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Design Patterns](https://refactoring.guru/design-patterns)

---

## 9. Approval

**Implementation plan must be approved before starting development**.

**Review Checklist**:
- [ ] All phases clearly defined
- [ ] Realistic time estimates
- [ ] Context7 queries identified
- [ ] Feedback checkpoints defined
- [ ] Clean code standards enforced
- [ ] Testing strategy comprehensive
- [ ] Success criteria measurable

**Stakeholders**:
- [ ] Developer: Confirm implementation is clear and feasible
- [ ] Tech Lead: Approve phased approach
- [ ] QA Lead: Approve testing strategy
- [ ] Product Owner: Approve timeline

---

**Status**: Ready for implementation

**Next Action**: Begin Phase 1 - Store Foundation
