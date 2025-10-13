# Frontend Device-Room Integration - Implementation Plan

## 1. Overview

This document provides a step-by-step implementation plan for integrating the Next.js frontend with the backend device-room architecture. Implementation follows the spec-driven development workflow with mandatory feedback checkpoints and Context7 documentation lookups.

## 2. Implementation Phases

### Phase 1: Foundation - Types and Interfaces (2-3 hours)

**Objective**: Define TypeScript types and interfaces for device domain

**Tasks**:
1. Create device type definitions
2. Update WebSocket message types
3. Create API request/response types

**Files to Create**:
- `frontend/src/types/device.ts` - Core device types
- `frontend/src/types/device-api.ts` - API request/response types

**Context7 Documentation Required**:
- None (using existing TypeScript patterns)

**Acceptance Criteria**:
- TypeScript compilation succeeds
- All device types exported and importable
- Zod schemas created for runtime validation

**Risk**: Type mismatches with backend API
**Mitigation**: Cross-reference with backend Device.java and DTOs

---

### Phase 2: Data Access Layer - Device API Client (3-4 hours)

**Objective**: Implement REST API client for device operations using Repository pattern

**Tasks**:
1. Create DeviceApiClient interface (DIP compliance)
2. Implement HttpDeviceApiClient with axios
3. Create factory function for dependency injection
4. Add error handling and request/response transformation

**Files to Create**:
- `frontend/src/lib/api/device-api-client.ts`

**Files to Modify**:
- `frontend/src/lib/api/index.ts` - Export device client

**Context7 Documentation Required**:
```bash
# Fetch latest axios documentation
mcp__context7__resolve-library-id libraryName: "axios"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/axios/axios" topic: "typescript interfaces error handling"
```

**Implementation Details**:
```typescript
// DeviceApiClient interface
export interface DeviceApiClient {
  getDiscoveredDevices(roomId: string): Promise<DiscoveredDevice[]>;
  registerDevice(request: RegisterDeviceRequest): Promise<Device>;
  getDevicesByRoom(roomId: string): Promise<Device[]>;
  updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device>;
  deleteDevice(deviceId: string): Promise<void>;
}

// HTTP implementation
export class HttpDeviceApiClient implements DeviceApiClient {
  constructor(private httpClient: AxiosInstance) {}

  async registerDevice(request: RegisterDeviceRequest): Promise<Device> {
    const response = await this.httpClient.post('/api/devices/discovery/register', request);
    return response.data;
  }
  // ... other methods
}
```

**Acceptance Criteria**:
- All CRUD operations implemented
- Error responses properly typed
- Request/response logging integrated
- Factory function creates singleton instance

**Clean Code Validation**:
- SRP: Client only handles HTTP communication
- DIP: Interface allows mocking for tests
- Error handling: Axios interceptors used

---

### Phase 3: Message Handling - Device Message Adapter (2-3 hours)

**Objective**: Centralize WebSocket message transformation logic using Adapter pattern

**Tasks**:
1. Create DeviceMessageAdapter class
2. Implement message transformation methods
3. Add device identifier extraction and validation
4. Integrate with websocket-client.ts

**Files to Create**:
- `frontend/src/lib/adapters/device-message-adapter.ts`

**Files to Modify**:
- `frontend/src/lib/websocket/websocket-client.ts` - Use adapter for message conversion

**Context7 Documentation Required**:
- None (pure TypeScript transformation logic)

**Implementation Details**:
```typescript
export class DeviceMessageAdapter {
  static adaptStateMessage(wsMessage: DeviceStateMessage): {
    roomId: string;
    deviceIdentifier: string;
    state: AirConState;
  } | null;

  static adaptDiscoveryMessage(wsMessage: DeviceDiscoveryMessage): DiscoveredDevice;

  static extractDeviceIdentifier(topic: string): string | null;

  static isValidDeviceIdentifier(identifier: string): boolean;
}
```

**Acceptance Criteria**:
- Message transformations handle all backend formats
- Invalid messages return null (fail-safe)
- Device identifier validation prevents injection
- Unit tests for all transformation methods

**Clean Code Validation**:
- DRY: Eliminates scattered transformation logic
- SRP: Only handles message transformation

---

### Phase 4: State Management - Create Device Store (4-5 hours)

**Objective**: Create new device-store.ts with clean architecture (SRP compliance)

**Tasks**:
1. Create device-store.ts with device state only
2. Implement device operations (register, select, update, discovery)
3. Add localStorage persistence for device selection
4. Implement command methods that use selected device
5. Ensure Zustand v5 patterns (specific selectors)

**Files to Create**:
- `frontend/src/stores/device-store.ts` - New device-centric store
- `frontend/src/stores/connection-store.ts` - Optional: Connection status only (SRP)

**Context7 Documentation Required**:
```bash
# Fetch latest Zustand v5 documentation
mcp__context7__resolve-library-id libraryName: "zustand"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/pmndrs/zustand" topic: "v5 selectors react patterns"
```

**Implementation Details**:
```typescript
// New state properties
devices: Record<string, Device[]>; // roomId → Device[]
selectedDevices: Record<string, string>; // roomId → deviceIdentifier
discoveredDevices: DiscoveredDevice[];
deviceStates: Record<string, DeviceState>; // deviceIdentifier → DeviceState

// New methods
registerDevice: (discovery: DiscoveredDevice, roomId: string, metadata?) => Promise<Device>;
getDevicesByRoom: (roomId: string) => Device[];
selectDevice: (roomId: string, deviceIdentifier: string) => void;
getSelectedDevice: (roomId: string) => Device | undefined;
updateDeviceState: (deviceIdentifier: string, state: AirConState) => void;

// Modified methods
setTemperature: async (roomId: string, temperature: number) => {
  const selectedDevice = get().getSelectedDevice(roomId);
  if (!selectedDevice) throw new Error('No device selected');

  // Use deviceIdentifier in WebSocket command
  await websocketClient.sendTemperatureCommand(roomId, selectedDevice.deviceIdentifier, temperature);
};
```

**Acceptance Criteria**:
- Device state properly typed
- Device selection persisted to localStorage
- Commands route through selected device
- Device auto-selection: first enabled device if no preference
- No Zustand v5 infinite loops (verified with React DevTools)
- **No legacy code or backward compatibility checks**

**Clean Code Validation**:
- SRP: Device store only handles device state (no connection, no quota)
- Zustand v5 compliance: Specific selectors only
- localStorage operations non-blocking (requestIdleCallback)
- Device selection fallback logic (first enabled device)

**CRITICAL: Zustand v5 Patterns**:
```typescript
// ❌ NEVER DO
const store = useStore(apiAirconStore);
useEffect(() => { store.method() }, [store]); // INFINITE LOOP!

// ✅ ALWAYS DO
const method = useStore(apiAirconStore, (state) => state.method);
useEffect(() => { method() }, []); // eslint-disable-line
```

---

### Phase 5: UI Abstraction - Custom Hooks (2-3 hours)

**Objective**: Create focused hooks following ISP and Facade patterns

**Tasks**:
1. Create useDeviceDiscovery hook
2. Create useDeviceSelection hook
3. Create useDeviceControl hook (Facade)
4. Update useAircon hook to delegate to new hooks

**Files to Create**:
- `frontend/src/hooks/useDeviceDiscovery.ts`
- `frontend/src/hooks/useDeviceSelection.ts`
- `frontend/src/hooks/useDeviceControl.ts`

**Files to Modify**:
- `frontend/src/hooks/useAircon.ts` - Update to use device layer

**Context7 Documentation Required**:
```bash
# Fetch React hooks best practices
mcp__context7__resolve-library-id libraryName: "react"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/facebook/react" topic: "custom hooks patterns"
```

**Implementation Details**:
```typescript
// useDeviceDiscovery.ts
export const useDeviceDiscovery = () => {
  const discoveredDevices = useStore(apiAirconStore, (state) => state.discoveredDevices);
  const registerDevice = useStore(apiAirconStore, (state) => state.registerDevice);
  const dismissDiscovery = useStore(apiAirconStore, (state) => state.dismissDiscovery);

  return { discoveredDevices, registerDevice, dismissDiscovery };
};

// useDeviceSelection.ts
export const useDeviceSelection = (roomId: string) => {
  const devices = useStore(apiAirconStore, (state) => state.getDevicesByRoom(roomId));
  const selectedDevice = useStore(apiAirconStore, (state) => state.getSelectedDevice(roomId));
  const selectDevice = useStore(apiAirconStore, (state) => state.selectDevice);

  return {
    devices,
    selectedDevice,
    selectDevice: (deviceId: string) => selectDevice(roomId, deviceId),
    hasMultipleDevices: devices.length > 1
  };
};

// useDeviceControl.ts (Facade)
export const useDeviceControl = (roomId: string) => {
  const setTemperature = useStore(apiAirconStore, (state) => state.setTemperature);
  const setMode = useStore(apiAirconStore, (state) => state.setMode);

  return {
    setTemperature: (temp: number) => setTemperature(roomId, temp),
    setMode: (mode: string) => setMode(roomId, mode),
    // Simplified interface - hides roomId parameter
  };
};
```

**Acceptance Criteria**:
- Hooks follow ISP (small, focused interfaces)
- Zustand selectors properly isolated
- TypeScript types exported
- Clean device-centric interface (no legacy assumptions)

**Clean Code Validation**:
- ISP: Each hook has single, focused purpose
- Facade: useDeviceControl simplifies interface
- DRY: No logic duplication

---

### Phase 6: UI Components - Device Discovery Notification (2-3 hours)

**Objective**: Create toast notification for discovered devices

**Tasks**:
1. Create DeviceDiscoveryNotification component
2. Integrate with ShadcnUI Toast
3. Add auto-dismiss (30 seconds)
4. Implement localStorage persistence for dismissed devices

**Files to Create**:
- `frontend/src/components/devices/DeviceDiscoveryNotification.tsx`
- `frontend/src/components/devices/DeviceIcon.tsx` - Device type icons

**Context7 Documentation Required**:
```bash
# Fetch ShadcnUI Toast documentation
mcp__context7__resolve-library-id libraryName: "shadcn-ui"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/shadcn/ui" topic: "toast component"
```

**Implementation Details**:
```typescript
interface DeviceDiscoveryNotificationProps {
  device: DiscoveredDevice;
  onRegister: (device: DiscoveredDevice) => void;
  onDismiss: (deviceIdentifier: string) => void;
}

export const DeviceDiscoveryNotification: React.FC<DeviceDiscoveryNotificationProps> = ({
  device,
  onRegister,
  onDismiss
}) => {
  return (
    <Toast duration={30000}> {/* Auto-dismiss after 30 seconds */}
      <div className="flex items-center gap-3">
        <DeviceIcon type={device.deviceType} className="h-5 w-5" />
        <div className="flex-1">
          <p className="text-sm font-medium">New device discovered</p>
          <p className="text-xs text-muted-foreground">{device.deviceIdentifier}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onRegister(device)}>Register</Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(device.deviceIdentifier)}>Dismiss</Button>
        </div>
      </div>
    </Toast>
  );
};
```

**Acceptance Criteria**:
- Toast appears on device discovery
- Auto-dismisses after 30 seconds
- Dismiss action persists to localStorage (24h expiry)
- Mobile-responsive (min 44px touch targets)
- Dark/light theme support

**Clean Code Validation**:
- SRP: Component only handles notification display
- ShadcnUI patterns followed

---

### Phase 7: UI Components - Device Registration Dialog (3-4 hours)

**Objective**: Create modal form for registering discovered devices

**Tasks**:
1. Create DeviceRegistrationDialog component
2. Implement form validation
3. Add error handling and retry logic
4. Integrate with device API client

**Files to Create**:
- `frontend/src/components/devices/DeviceRegistrationDialog.tsx`

**Context7 Documentation Required**:
```bash
# Fetch ShadcnUI Dialog and Form documentation
mcp__context7__get-library-docs context7CompatibleLibraryID: "/shadcn/ui" topic: "dialog form components"

# Fetch React Hook Form documentation
mcp__context7__resolve-library-id libraryName: "react-hook-form"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/react-hook-form/react-hook-form" topic: "validation typescript"
```

**Implementation Details**:
```typescript
interface DeviceRegistrationDialogProps {
  device: DiscoveredDevice;
  rooms: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (request: RegisterDeviceRequest) => Promise<void>;
}

export const DeviceRegistrationDialog: React.FC<DeviceRegistrationDialogProps> = ({
  device,
  rooms,
  open,
  onOpenChange,
  onRegister
}) => {
  const [formData, setFormData] = useState({
    roomId: '',
    deviceName: '',
    manufacturer: '',
    model: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onRegister({
        discoveredDeviceId: device.deviceIdentifier,
        roomId: formData.roomId,
        deviceName: formData.deviceName || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dialog with form fields: roomId (required), deviceName, manufacturer, model (optional)
};
```

**Acceptance Criteria**:
- Form validation: Required roomId
- Error display inline (keep modal open for retry)
- Success closes modal and dismisses discovery
- Auto-populate device identifier and type (read-only)
- Mobile-responsive design

**Clean Code Validation**:
- Controlled component with local state
- Error handling: display inline, allow retry
- Form validation before submission

---

### Phase 8: UI Components - Device Selector (2-3 hours)

**Objective**: Create dropdown for device selection when room has multiple devices

**Tasks**:
1. Create DeviceSelector component
2. Implement conditional rendering (only show if >1 device)
3. Add localStorage persistence via store
4. Integrate with useDeviceSelection hook

**Files to Create**:
- `frontend/src/components/devices/DeviceSelector.tsx`

**Context7 Documentation Required**:
```bash
# Fetch ShadcnUI Select component documentation
mcp__context7__get-library-docs context7CompatibleLibraryID: "/shadcn/ui" topic: "select dropdown"
```

**Implementation Details**:
```typescript
interface DeviceSelectorProps {
  roomId: string;
  devices: Device[];
  selectedDeviceId: string | undefined;
  onSelectDevice: (deviceIdentifier: string) => void;
  className?: string;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = React.memo(({
  roomId,
  devices,
  selectedDeviceId,
  onSelectDevice,
  className
}) => {
  const enabledDevices = useMemo(() => devices.filter(d => d.enabled), [devices]);

  if (enabledDevices.length <= 1) {
    return null; // Don't render if only one device
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor="device-selector" className="text-sm">Device:</Label>
      <Select value={selectedDeviceId} onValueChange={onSelectDevice}>
        <SelectTrigger id="device-selector" className="w-[200px]">
          <SelectValue placeholder="Select device" />
        </SelectTrigger>
        <SelectContent>
          {enabledDevices.map(device => (
            <SelectItem key={device.id} value={device.deviceIdentifier}>
              <div className="flex items-center gap-2">
                <DeviceIcon type={device.deviceType} className="h-4 w-4" />
                <span>{device.deviceName || device.deviceIdentifier}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});
```

**Acceptance Criteria**:
- Conditional render (only if >1 enabled device)
- Selection persisted via store → localStorage
- Device name or identifier displayed
- Mobile-responsive
- React.memo optimization

**Clean Code Validation**:
- Performance: React.memo prevents unnecessary re-renders
- useMemo for filtered device list
- Conditional rendering follows requirements

---

### Phase 9: UI Components - AirConRemote Integration (3-4 hours)

**Objective**: Integrate device selection and control into existing AirConRemote component

**Tasks**:
1. Add DeviceSelector to AirConRemote
2. Update command handlers to use useDeviceControl hook
3. Display selected device name in header
4. Ensure backward compatibility (single device = no selector)

**Files to Modify**:
- `frontend/src/components/AirConRemote.tsx`

**Context7 Documentation Required**:
- None (using existing hooks and components)

**Implementation Details**:
```typescript
const ApiAirConRemote = ({ room: { roomId } }: IApiAirConRemoteProps) => {
  // NEW: Device selection hook
  const {
    devices,
    selectedDevice,
    selectDevice,
    hasMultipleDevices
  } = useDeviceSelection(roomId);

  // NEW: Simplified control interface
  const {
    setTemperature,
    setMode,
    setFan,
    setPower
  } = useDeviceControl(roomId);

  // Existing hooks
  const { getRoomInfo } = useAirconContext();
  const roomInfo = getRoomInfo(roomId);

  // Update handlers to use new hooks
  const handleTemperatureChange = useCallback(async (value: number[]) => {
    try {
      const temperature = value[0];
      if (temperature !== undefined) {
        await setTemperature(temperature); // Simplified - no roomId parameter
      }
    } catch (error) {
      console.error("Failed to change temperature:", error);
    }
  }, [setTemperature]);

  return (
    <Card>
      {/* Existing status bar */}

      {/* NEW: Device selector (conditional) */}
      {hasMultipleDevices && (
        <div className="px-4 py-2 border-b">
          <DeviceSelector
            roomId={roomId}
            devices={devices}
            selectedDeviceId={selectedDevice?.deviceIdentifier}
            onSelectDevice={selectDevice}
          />
        </div>
      )}

      {/* Existing controls - handlers updated to use new hooks */}
      <CardContent>
        {/* Temperature, mode, fan controls */}
      </CardContent>
    </Card>
  );
};
```

**Acceptance Criteria**:
- DeviceSelector shown when hasMultipleDevices === true
- Commands route through useDeviceControl hook
- Selected device name displayed in header (optional)
- Clean device-centric UI (no legacy room-based assumptions)
- No performance regression (React DevTools profiler)

**Clean Code Validation**:
- Facade pattern: Simplified hook interface
- Clean device-centric architecture
- No legacy code remnants

---

### Phase 10: WebSocket Integration - Discovery Messages (2-3 hours)

**Objective**: Handle DEVICE_DISCOVERED WebSocket messages and trigger notifications

**Tasks**:
1. Update websocket-client.ts to handle discovery messages
2. Use DeviceMessageAdapter for transformation
3. Update store on discovery message
4. Trigger toast notification

**Files to Modify**:
- `frontend/src/lib/websocket/websocket-client.ts`
- `frontend/src/components/AirconProvider.tsx` - Add discovery notification logic

**Context7 Documentation Required**:
```bash
# Fetch RxJS documentation for message filtering
mcp__context7__resolve-library-id libraryName: "rxjs"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/ReactiveX/rxjs" topic: "operators filter map"
```

**Implementation Details**:
```typescript
// In websocket-client.ts
private convertMessage(message: WebSocketMessage): WSMessage {
  switch (message.type) {
    case "DEVICE_DISCOVERED":
      const discoveredDevice = DeviceMessageAdapter.adaptDiscoveryMessage(message);
      // Trigger store update
      apiAirconStore.getState().addDiscoveredDevice(discoveredDevice);
      return {
        type: "device-discovered",
        data: discoveredDevice
      };

    case "STATE":
      const stateUpdate = DeviceMessageAdapter.adaptStateMessage(message);
      if (stateUpdate) {
        apiAirconStore.getState().updateDeviceState(stateUpdate.deviceIdentifier, stateUpdate.state);
      }
      return {
        type: "room-state",
        roomId: message.roomId,
        data: stateUpdate?.state
      };

    // ... other cases
  }
}
```

**Acceptance Criteria**:
- DEVICE_DISCOVERED messages handled
- Discovery notifications appear within 500ms
- Device state updates routed to correct device
- Error handling for invalid messages

**Clean Code Validation**:
- Adapter pattern: Message transformation centralized
- Observer pattern: RxJS observable stream
- Error handling: Invalid messages logged, not crashed

---

### Phase 11: Error Handling and Fallback Mechanisms (2-3 hours)

**Objective**: Implement robust error handling and graceful degradation

**Tasks**:
1. Add error toast notifications for failed commands
2. Implement discovery polling fallback (60s interval)
3. Add WebSocket reconnection state restoration
4. Implement retry logic with exponential backoff

**Files to Modify**:
- `frontend/src/stores/api-aircon-store.ts` - Add error state and retry logic
- `frontend/src/hooks/useDeviceDiscovery.ts` - Add polling fallback

**Context7 Documentation Required**:
- None (using existing error handling patterns)

**Implementation Details**:
```typescript
// Error state in store
interface ErrorState {
  deviceErrors: Record<string, string>; // deviceId → error message
  lastCommandError: { roomId: string; command: string; error: string } | null;
  clearError: (deviceId: string) => void;
}

// Retry logic with exponential backoff
const executeCommandWithRetry = async (
  command: () => Promise<void>,
  maxRetries = 3
) => {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await command();
      return;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) throw error;

      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Discovery polling fallback
useEffect(() => {
  const pollInterval = setInterval(async () => {
    try {
      const discovered = await deviceApiClient.getDiscoveredDevices(roomId);
      discovered.forEach(device => {
        if (!discoveredDevices.find(d => d.deviceIdentifier === device.deviceIdentifier)) {
          addDiscoveredDevice(device);
        }
      });
    } catch (error) {
      console.error('Discovery polling failed:', error);
    }
  }, 60000); // Poll every 60 seconds

  return () => clearInterval(pollInterval);
}, [roomId]);
```

**Acceptance Criteria**:
- Failed commands retry up to 3 times with exponential backoff
- Discovery polling fallback active when WebSocket down
- Error toasts display with retry button
- WebSocket reconnection restores device state

**Clean Code Validation**:
- Error handling: Graceful degradation
- NFR-2.3 compliance: Max 3 retries, exponential backoff
- Fallback mechanisms: Polling as backup

---

### Phase 12: Testing and Validation (4-5 hours)

**Objective**: Comprehensive testing of device integration

**Tasks**:
1. Unit tests for DeviceApiClient
2. Unit tests for DeviceMessageAdapter
3. Integration tests for device discovery flow
4. E2E tests for device registration and control
5. Performance testing (React DevTools Profiler)

**Files to Create**:
- `frontend/src/lib/api/__tests__/device-api-client.test.ts`
- `frontend/src/lib/adapters/__tests__/device-message-adapter.test.ts`
- `frontend/src/components/devices/__tests__/DeviceSelector.test.tsx`
- `frontend/src/hooks/__tests__/useDeviceSelection.test.ts`

**Context7 Documentation Required**:
```bash
# Fetch Jest and React Testing Library documentation
mcp__context7__resolve-library-id libraryName: "testing-library"
mcp__context7__get-library-docs context7CompatibleLibraryID: "/testing-library/react-testing-library" topic: "hooks testing"
```

**Test Cases**:

**Unit Tests - DeviceApiClient**:
```typescript
describe('DeviceApiClient', () => {
  it('should register device successfully', async () => {
    const mockResponse = { data: mockDevice };
    mockAxios.post.mockResolvedValue(mockResponse);

    const result = await deviceApiClient.registerDevice(mockRequest);

    expect(mockAxios.post).toHaveBeenCalledWith('/api/devices/discovery/register', mockRequest);
    expect(result).toEqual(mockDevice);
  });

  it('should handle 409 conflict error on duplicate registration', async () => {
    mockAxios.post.mockRejectedValue({ response: { status: 409 } });

    await expect(deviceApiClient.registerDevice(mockRequest)).rejects.toThrow();
  });
});
```

**Unit Tests - DeviceMessageAdapter**:
```typescript
describe('DeviceMessageAdapter', () => {
  it('should adapt state message correctly', () => {
    const wsMessage: DeviceStateMessage = {
      type: 'STATE',
      deviceIdentifier: 'test_device',
      deviceType: DeviceType.AIRCONDITIONER,
      data: mockAirConState,
      timestamp: Date.now()
    };

    const result = DeviceMessageAdapter.adaptStateMessage(wsMessage);

    expect(result).toEqual({
      roomId: expect.any(String),
      deviceIdentifier: 'test_device',
      state: mockAirConState
    });
  });

  it('should validate device identifier format', () => {
    expect(DeviceMessageAdapter.isValidDeviceIdentifier('valid_device_123')).toBe(true);
    expect(DeviceMessageAdapter.isValidDeviceIdentifier('Invalid Device!')).toBe(false);
  });
});
```

**Integration Tests - Device Discovery Flow**:
```typescript
describe('Device Discovery Flow', () => {
  it('should display notification on device discovery', async () => {
    const { getByText } = render(<App />);

    // Simulate WebSocket discovery message
    act(() => {
      mockWebSocket.emit('message', {
        type: 'DEVICE_DISCOVERED',
        deviceIdentifier: 'new_device',
        deviceType: 'airconditioner',
        requiresRegistration: true
      });
    });

    await waitFor(() => {
      expect(getByText('New device discovered')).toBeInTheDocument();
      expect(getByText('new_device')).toBeInTheDocument();
    });
  });
});
```

**Performance Tests**:
```typescript
describe('Performance', () => {
  it('should not cause infinite loops with Zustand selectors', () => {
    const { result } = renderHook(() => useDeviceSelection('room-1'));

    // Should not trigger re-renders unless devices change
    act(() => {
      // Modify unrelated store state
      apiAirconStore.getState().setIsConnected(true);
    });

    // Hook should not re-render
    expect(result.all.length).toBe(1);
  });
});
```

**Acceptance Criteria**:
- Unit test coverage >80%
- All integration tests pass
- No infinite loops detected (React DevTools)
- Performance: <100ms message processing latency
- No console errors during normal operation

**Clean Code Validation**:
- Tests follow AAA pattern (Arrange, Act, Assert)
- Mocks properly isolated
- Test names describe expected behavior

---

## 3. Implementation Sequence

**Recommended Order** (optimized for dependency resolution):

1. **Phase 1**: Foundation - Types and Interfaces
2. **Phase 2**: Data Access Layer - Device API Client
3. **Phase 3**: Message Handling - Device Message Adapter
4. **Phase 4**: State Management - Extend Zustand Store
5. **Phase 5**: UI Abstraction - Custom Hooks
6. **Phase 10**: WebSocket Integration - Discovery Messages
7. **Phase 6**: UI Components - Device Discovery Notification
8. **Phase 7**: UI Components - Device Registration Dialog
9. **Phase 8**: UI Components - Device Selector
10. **Phase 9**: UI Components - AirConRemote Integration
11. **Phase 11**: Error Handling and Fallback Mechanisms
12. **Phase 12**: Testing and Validation

**Rationale**: Bottom-up approach builds foundation before UI, ensures dependencies are resolved in order.

---

## 4. Mandatory Feedback Checkpoints

After completing each phase, use the `mcp__mcp-feedback-enhanced__interactive_feedback` tool to:

1. **Summarize work completed**:
   - List files created/modified
   - Describe functionality implemented
   - Highlight any deviations from plan

2. **Report clean code compliance**:
   - DRY: Duplication eliminated?
   - SOLID: Principles followed?
   - YAGNI: No over-engineering?

3. **Identify technical debt**:
   - Any shortcuts taken?
   - Refactoring opportunities?
   - Missing tests or documentation?

4. **Request user approval** before proceeding to next phase

**Example Feedback Call**:
```typescript
await mcp__mcp-feedback-enhanced__interactive_feedback({
  project_directory: '/mnt/drive/codebases/apps/mitsubishi-remote-control/frontend',
  summary: `Phase 4 Complete: Extended Zustand Store

  ✅ Files Modified:
  - frontend/src/stores/api-aircon-store.ts (added device state, 200 lines)

  ✅ Functionality:
  - Device registration, selection, state updates implemented
  - localStorage persistence for device selection
  - Backward compatible with existing room-based UI

  ✅ Clean Code Compliance:
  - Zustand v5 patterns: Specific selectors only (no infinite loops)
  - DRY: Device selection logic centralized
  - SRP: Store methods focused on single operations

  ⚠️ Technical Debt:
  - Quota validation complexity remains (decision: keep for now)
  - Test coverage pending (Phase 12)

  Ready to proceed to Phase 5?`,
  timeout: 600
});
```

---

## 5. Context7 Documentation Queries

**Required Documentation Lookups**:

1. **Phase 2**: Axios TypeScript patterns
2. **Phase 4**: Zustand v5 selectors and React integration
3. **Phase 5**: React custom hooks best practices
4. **Phase 6**: ShadcnUI Toast component
5. **Phase 7**: ShadcnUI Dialog and Form components, React Hook Form
6. **Phase 8**: ShadcnUI Select component
7. **Phase 10**: RxJS operators (filter, map)
8. **Phase 12**: React Testing Library hooks testing

**Query Pattern**:
```typescript
// Step 1: Resolve library ID
const libraryId = await mcp__context7__resolve-library-id({ libraryName: "axios" });

// Step 2: Get documentation
const docs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: libraryId,
  topic: "typescript interfaces error handling"
});
```

---

## 6. Rollback Plan

**If implementation fails**:

1. **Identify failure point**: Which phase failed?
2. **Revert changes**: Use git to revert to last working state
3. **Analyze root cause**: Type mismatch? WebSocket format? Zustand infinite loop?
4. **Adjust plan**: Update implementation.md with lessons learned
5. **Retry with modifications**: Apply fixes and retry phase

**Git Strategy**:
```bash
# Create feature branch
git checkout -b feature/frontend-device-integration

# Commit after each phase
git add .
git commit -m "Phase 4: Extend Zustand store with device support"

# If rollback needed
git reset --hard HEAD~1  # Revert last commit
```

---

## 7. Success Criteria

**Feature Acceptance**:
- ✅ All 5 user stories acceptance criteria met
- ✅ All 6 functional requirements implemented
- ✅ All 5 non-functional requirements verified

**Technical Acceptance**:
- ✅ TypeScript strict mode compilation succeeds
- ✅ ESLint passes with no warnings
- ✅ No console errors during normal operation
- ✅ WebSocket connection stable for >5 minutes
- ✅ Device commands succeed with <1% failure rate
- ✅ Unit test coverage >80%

**Clean Code Acceptance**:
- ✅ DRY: No code duplication (verified in code review)
- ✅ SOLID: All principles applied (SRP, OCP, ISP, DIP validated)
- ✅ YAGNI: No over-engineering (Strategy/Command patterns deferred)
- ✅ Zustand v5: No infinite loops (React DevTools Profiler verified)
- ✅ Performance: <100ms message processing, <500ms command response

**User Experience Acceptance**:
- ✅ Device discovery flow ≤3 clicks to register
- ✅ Device state updates visible within 1 second
- ✅ No UI layout shifts during device updates
- ✅ Mobile-responsive (min 44px touch targets verified)
- ✅ Dark/light theme support (all components themed)

---

## 8. Risk Mitigation

**Risk 1: Zustand v5 Infinite Loops**
- **Mitigation**: Code review every useStore call, React DevTools profiling
- **Test**: Modify unrelated store state, verify hook doesn't re-render

**Risk 2: WebSocket Message Format Breaking Changes**
- **Mitigation**: DeviceMessageAdapter isolates format changes
- **Test**: Send malformed messages, verify graceful handling

**Risk 3: Device API Endpoint Changes**
- **Mitigation**: Repository pattern allows swapping implementations
- **Test**: Mock API errors, verify fallback behavior

**Risk 4: Performance Regression**
- **Mitigation**: React.memo, useMemo, useCallback for optimization
- **Test**: React DevTools Profiler before/after comparison

---

## 9. Post-Implementation Tasks

1. **Documentation**:
   - Update README with device integration guide
   - Document device discovery and registration flow
   - Add troubleshooting section

2. **Code Review**:
   - Peer review for clean code compliance
   - Zustand v5 pattern validation
   - Performance profiling review

3. **User Acceptance Testing**:
   - Test with real MQTT devices
   - Verify multi-device room behavior
   - Test error scenarios (network failure, duplicate registration)

4. **Deployment**:
   - Create production build
   - Verify bundle size (<12KB increase)
   - Deploy to staging environment
   - Monitor for errors in production logs

---

## 10. Estimated Timeline

**Total Estimated Time**: 30-38 hours

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Foundation - Types | 2-3 hours |
| Phase 2 | Device API Client | 3-4 hours |
| Phase 3 | Message Adapter | 2-3 hours |
| Phase 4 | Extend Store | 4-5 hours |
| Phase 5 | Custom Hooks | 2-3 hours |
| Phase 6 | Discovery Notification | 2-3 hours |
| Phase 7 | Registration Dialog | 3-4 hours |
| Phase 8 | Device Selector | 2-3 hours |
| Phase 9 | AirConRemote Integration | 3-4 hours |
| Phase 10 | WebSocket Integration | 2-3 hours |
| Phase 11 | Error Handling | 2-3 hours |
| Phase 12 | Testing & Validation | 4-5 hours |

**Feedback Checkpoints**: ~30 minutes after each phase (total ~6 hours)

**Buffer**: 20% contingency for unexpected issues

**Total**: 36-45 hours including feedback and buffer

---

## 11. Clean Code Checklist (Per Phase)

Use this checklist during code review after each phase:

### DRY (Don't Repeat Yourself)
- [ ] No duplicate code blocks (>3 lines)
- [ ] Repeated logic extracted into functions
- [ ] Constants defined once, reused

### SOLID Principles
- [ ] **SRP**: Each class/function has single responsibility
- [ ] **OCP**: Code open for extension, closed for modification
- [ ] **LSP**: Subtypes substitutable (if applicable)
- [ ] **ISP**: Interfaces focused, not bloated
- [ ] **DIP**: Depends on abstractions, not concretions

### YAGNI (You Aren't Gonna Need It)
- [ ] No speculative features implemented
- [ ] No unused code or comments
- [ ] Complexity justified by requirements

### Function Design
- [ ] Functions <20 lines
- [ ] Clear, descriptive names
- [ ] Max 3-4 parameters
- [ ] Pure functions preferred (no side effects)

### TypeScript Standards
- [ ] Strict mode enabled
- [ ] No `any` types (use `unknown` if needed)
- [ ] All exports properly typed
- [ ] JSDoc for public APIs

### React/Zustand Patterns
- [ ] Zustand v5: Specific selectors only
- [ ] React.memo where appropriate
- [ ] useMemo/useCallback for optimization
- [ ] No prop drilling (use context/hooks)

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: Claude (AI Assistant)
**Next Step**: Begin Phase 1 implementation after user approval
**Mandatory**: Use feedback tool after each phase completion
