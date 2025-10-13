# Frontend Device-Room Integration - Technical Design

## 1. Architecture Overview

### 1.1 Design Philosophy

This design follows a clean refactor approach optimized for development phase:
- **Clean Slate Refactoring**: Fresh implementation without legacy constraints
- **Clean Code First**: Apply DRY, SOLID, YAGNI principles throughout
- **Device-Centric Architecture**: All components designed around device abstraction from the start
- **Performance First**: Zustand v5 best practices, optimized selectors, minimal re-renders
- **No Migration Code**: Development phase allows breaking changes

### 1.2 Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Components Layer                     │
│  DeviceDiscoveryNotification │ DeviceRegistrationDialog     │
│  DeviceSelector │ AirConRemote (modified)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Abstraction Layer (Hooks)              │
│  useDeviceDiscovery() │ useDeviceSelection()                │
│  useDeviceControl() (Facade) │ useAircon() (modified)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   State Management Layer                     │
│  device-store.ts (Device state, selection, discovery)       │
│  connection-store.ts (WebSocket/MQTT connection status)     │
│  (Clean refactor - no legacy code)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Message Handling Layer  │  │    Data Access Layer     │
│  DeviceMessageAdapter    │  │  DeviceApiClient         │
│  (Adapter Pattern)       │  │  (Repository Pattern)    │
└──────────────────────────┘  └──────────────────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  WebSocket Client        │  │  HTTP Client (Axios)     │
│  websocket-client.ts     │  │  axios-client.ts         │
└──────────────────────────┘  └──────────────────────────┘
            │                              │
            └──────────────┬───────────────┘
                           ▼
                   Backend Services
```

## 2. Clean Code Principles Analysis

### 2.1 DRY (Don't Repeat Yourself)

**Identified Duplication:**
1. WebSocket message conversions scattered in `websocket-client.ts`
2. Command execution pattern repeated across 6+ methods in `api-aircon-store.ts`
3. Room state update logic duplicated in multiple methods

**DRY Solutions:**
- **DeviceMessageAdapter**: Centralized message transformation
- **executeQuotaAwareCommand**: Reusable command execution pattern (already exists, keep using)
- **Device state update reducer**: Unified state merge logic

### 2.2 SOLID Principles Application

#### Single Responsibility Principle (SRP)

**Clean Refactor Approach:**
- Split into focused stores:
  - `device-store.ts`: Device state, selection, discovery only
  - `connection-store.ts`: WebSocket/MQTT connection status only
- Extract message transformation to `DeviceMessageAdapter` (SRP compliance)
- Create focused hooks for specific concerns (ISP compliance)
- **Remove**: api-aircon-store.ts complexity (quota validation if unused)

#### Open/Closed Principle (OCP)

**Current State:**
- Adding new device types requires modifying multiple files

**Solution:**
- `DeviceApiClient` interface allows new implementations without modifying store
- Message adapter can support new device types via extensible transformation logic
- **Note**: Full Strategy pattern for device types deferred (YAGNI - only AirConditioner initially)

#### Liskov Substitution Principle (LSP)

**Compliance:**
- Current code uses interfaces properly (`WebSocketClient`)
- No inheritance hierarchies to validate

#### Interface Segregation Principle (ISP)

**Current Violation:**
- `AirconData` interface too broad (connection + rooms + commands + discovery)

**Solution:**
- Split into focused hooks:
  - `useDeviceDiscovery()`: Discovery-only interface
  - `useDeviceSelection()`: Device selection interface
  - `useDeviceControl()`: Control commands interface
  - `useConnectionStatus()`: Connection status (already exists)

#### Dependency Inversion Principle (DIP)

**Current State:**
- Components depend on store abstraction via hooks ✅
- Store depends directly on axios client ❌

**Solution:**
- Create `DeviceApiClient` interface
- Store depends on interface, not concrete HTTP client
- Factory pattern for client instantiation

### 2.3 YAGNI (You Aren't Gonna Need It)

**Avoiding Over-Engineering:**
- ❌ **Strategy Pattern for device types**: Deferred until multiple device types needed
- ❌ **Command Pattern with undo**: Rejected - no undo requirement
- ❌ **Multi-protocol support**: Out of scope - MQTT only initially
- ✅ **Device discovery and registration**: Core requirement
- ✅ **Bidirectional communication**: Core requirement

**Quota API Complexity:**
- **Decision**: Keep existing quota validation but make it optional (already configured via flag)
- **Rationale**: Already implemented, potentially used in production, low maintenance cost

## 3. Design Pattern Selection

### 3.1 Adopted Patterns

#### Adapter Pattern (Score: 4.0/5)

**Use Case**: Transform backend WebSocket messages to frontend format

**Implementation**: `DeviceMessageAdapter`
```typescript
export class DeviceMessageAdapter {
  static adaptStateMessage(wsMessage: DeviceStateMessage): {
    roomId: string;
    deviceIdentifier: string;
    state: AirConState;
  } | null;

  static adaptDiscoveryMessage(wsMessage: DeviceDiscoveryMessage): DiscoveredDevice;

  static extractDeviceIdentifier(topic: string): string | null;
}
```

**Trade-offs:**
- ✅ Complexity: Low (2/5) - Simple interface translation
- ✅ Maintainability: High (5/5) - Isolates backend changes
- ✅ Testability: High (5/5) - Easy to mock and unit test
- ✅ Performance: Minimal overhead

**Justification**: Backend message format changes won't ripple through frontend codebase.

#### Repository Pattern (Score: 4.3/5)

**Use Case**: Abstract device REST API operations

**Implementation**: `DeviceApiClient` interface with `HttpDeviceApiClient`
```typescript
export interface DeviceApiClient {
  getDiscoveredDevices(roomId: string): Promise<DiscoveredDevice[]>;
  registerDevice(request: RegisterDeviceRequest): Promise<Device>;
  getDevicesByRoom(roomId: string): Promise<Device[]>;
  updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device>;
  deleteDevice(deviceId: string): Promise<void>;
}

export class HttpDeviceApiClient implements DeviceApiClient {
  constructor(private httpClient: AxiosInstance) {}
  // Implementation methods
}
```

**Trade-offs:**
- ⚠️ Complexity: Medium (3/5) - Adds abstraction layer
- ✅ Maintainability: High (5/5) - Decouples API from store
- ✅ Testability: High (5/5) - Easy to mock for unit tests
- ✅ Flexibility: High (5/5) - Can swap implementations
- ✅ DIP Compliance: Depends on abstraction

**Justification**: Enables testing without backend, supports future API changes.

#### Observer Pattern (Score: 4.0/5)

**Use Case**: Device discovery notifications, state updates

**Implementation**: RxJS observables (already in use)
```typescript
// WebSocket message stream
websocketStream$: Observable<WSMessage>

// Discovery notifications
discoveredDevices$.subscribe(device => {
  // Trigger toast notification
});
```

**Trade-offs:**
- ✅ Complexity: Low (2/5) - Already using RxJS
- ✅ Maintainability: High (4/5) - Reactive, declarative
- ✅ Testability: High (4/5) - Observable streams testable
- ✅ Performance: Efficient event propagation

**Justification**: Already established pattern in codebase, fits reactive architecture.

#### Facade Pattern (Score: 4.0/5)

**Use Case**: Simplified device control interface for components

**Implementation**: `useDeviceControl()` hook
```typescript
export const useDeviceControl = (roomId: string) => {
  const setTemperature = useStore(apiAirconStore, (state) => state.setTemperature);
  const setMode = useStore(apiAirconStore, (state) => state.setMode);

  return {
    setTemperature: (temp: number) => setTemperature(roomId, temp),
    setMode: (mode: string) => setMode(roomId, mode),
    // Hides quota validation, device selection complexity
  };
};
```

**Trade-offs:**
- ✅ Complexity: Low (2/5) - Simple wrapper
- ✅ Maintainability: High (5/5) - Hides internal complexity
- ✅ Testability: Medium (4/5) - Integration-level testing
- ✅ Usability: High - Simple API for components

**Justification**: Components don't need to know about quota validation or device selection logic.

### 3.2 Deferred Patterns

#### Strategy Pattern (Score: 4.6/5) - DEFERRED

**Use Case**: Device-specific rendering and behavior (AirConditioner vs Thermostat)

**Rationale for Deferral:**
- YAGNI: Only AirConditioner devices in scope initially
- High implementation cost (4/5 complexity)
- No immediate benefit
- **Revisit when**: Second device type added

#### Command Pattern (Score: 4.3/5) - REJECTED

**Use Case**: Encapsulate device commands with undo support

**Rationale for Rejection:**
- YAGNI: No undo requirement in spec
- Over-engineering for current needs
- Adds complexity without clear benefit
- Simple function calls sufficient

## 4. Component Architecture

### 4.1 Type System Design

#### Core Domain Types
```typescript
// frontend/src/types/device.ts

export enum DeviceType {
  AIRCONDITIONER = 'airconditioner',
  THERMOSTAT = 'thermostat',
  HUMIDIFIER = 'humidifier',
  FAN = 'fan'
}

export interface Device {
  id: string; // UUID from backend
  roomId: string;
  deviceType: DeviceType;
  deviceIdentifier: string; // protocol-agnostic identifier (lowercase alphanumeric + hyphens/underscores)
  manufacturer?: string;
  model?: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredDevice {
  deviceIdentifier: string;
  deviceType: DeviceType;
  messageType: string; // 'state' | 'settings'
  payload: Record<string, unknown>;
  timestamp: number;
  requiresRegistration: boolean;
}

export interface DeviceState {
  deviceIdentifier: string;
  state: AirConState; // Reuse existing AirConState type
  lastUpdate: number;
}

export interface RegisterDeviceRequest {
  discoveredDeviceId: string; // deviceIdentifier
  roomId: string;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}
```

#### WebSocket Message Types (Updated)
```typescript
// frontend/src/lib/websocket/types.ts

export interface DeviceStateMessage {
  type: 'STATE' | 'SETTINGS';
  deviceIdentifier: string;
  deviceType: DeviceType;
  data: AirConState;
  timestamp: number;
}

export interface DeviceDiscoveryMessage {
  type: 'DEVICE_DISCOVERED';
  deviceIdentifier: string;
  deviceType: DeviceType;
  messageType: string;
  payload: Record<string, unknown>;
  timestamp: number;
  requiresRegistration: boolean;
}

export interface DeviceCommandMessage {
  type: 'SET_TEMPERATURE' | 'SET_MODE' | 'SET_FAN_SPEED' | 'SET_POWER' | 'SET_SWING';
  roomId: string;
  deviceIdentifier?: string; // Optional - backend will use selected device if not provided
  data: Record<string, unknown>;
}
```

### 4.2 State Management Design

#### Device Store (Clean Refactor)
```typescript
// frontend/src/stores/device-store.ts

export interface DeviceStoreState {
  // ===== Device State =====
  devices: Record<string, Device[]>; // roomId → Device[]
  selectedDevices: Record<string, string>; // roomId → deviceIdentifier
  discoveredDevices: DiscoveredDevice[];
  deviceStates: Record<string, DeviceState>; // deviceIdentifier → DeviceState

  // ===== Device Operations =====
  // Discovery
  addDiscoveredDevice: (device: DiscoveredDevice) => void;
  dismissDiscovery: (deviceIdentifier: string) => void;

  // Registration
  registerDevice: (
    discovery: DiscoveredDevice,
    roomId: string,
    metadata?: Partial<RegisterDeviceRequest>
  ) => Promise<Device>;

  // Device queries
  getDevicesByRoom: (roomId: string) => Device[];
  getSelectedDevice: (roomId: string) => Device | undefined;

  // Device selection
  selectDevice: (roomId: string, deviceIdentifier: string) => void;
  loadDeviceSelection: (roomId: string) => void; // From localStorage
  saveDeviceSelection: (roomId: string, deviceIdentifier: string) => void; // To localStorage

  // Device state updates
  updateDeviceState: (deviceIdentifier: string, state: AirConState) => void;

  // Device management
  updateDevice: (deviceId: string, updates: Partial<Device>) => Promise<Device>;
  deleteDevice: (deviceId: string) => Promise<void>;

  // ===== MODIFIED: Control Commands (now use selected device) =====
  // These methods internally resolve selected device for the room
  setTemperature: (roomId: string, temperature: number) => Promise<void>;
  setMode: (roomId: string, mode: string) => Promise<void>;
  setFan: (roomId: string, fan: string) => Promise<void>;
  setPower: (roomId: string, power: string) => Promise<void>;
  // ... other commands
}
```

#### Zustand v5 Critical Patterns

**❌ NEVER DO (Causes infinite loops):**
```typescript
// DON'T: Access entire store object
const storeData = useStore(apiAirconStore);
useEffect(() => {
  storeData.someMethod();
}, [storeData]); // Infinite loop!
```

**✅ ALWAYS DO (Stable selectors):**
```typescript
// DO: Use specific selectors
const selectDevice = useStore(apiAirconStore, (state) => state.selectDevice);
const devices = useStore(apiAirconStore, (state) => state.getDevicesByRoom(roomId));

useEffect(() => {
  selectDevice(roomId, deviceId);
}, []); // eslint-disable-line react-hooks/exhaustive-deps
// Store methods are stable - safe to omit from deps with eslint-disable
```

**✅ For multiple values, use useShallow:**
```typescript
import { useShallow } from 'zustand/react/shallow';

const [devices, selectedDevice, selectDevice] = useStore(
  apiAirconStore,
  useShallow((state) => [
    state.getDevicesByRoom(roomId),
    state.getSelectedDevice(roomId),
    state.selectDevice
  ])
);
```

### 4.3 Data Access Layer (Repository Pattern)

#### DeviceApiClient Interface
```typescript
// frontend/src/lib/api/device-api-client.ts

export interface DeviceApiClient {
  /**
   * Get discovered devices for a room
   */
  getDiscoveredDevices(roomId: string): Promise<DiscoveredDevice[]>;

  /**
   * Register a discovered device
   */
  registerDevice(request: RegisterDeviceRequest): Promise<Device>;

  /**
   * Get all devices for a room
   */
  getDevicesByRoom(roomId: string): Promise<Device[]>;

  /**
   * Update device metadata or enabled status
   */
  updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device>;

  /**
   * Remove a device
   */
  deleteDevice(deviceId: string): Promise<void>;
}

/**
 * HTTP implementation of DeviceApiClient
 */
export class HttpDeviceApiClient implements DeviceApiClient {
  constructor(private httpClient: AxiosInstance) {}

  async getDiscoveredDevices(roomId: string): Promise<DiscoveredDevice[]> {
    const response = await this.httpClient.get(`/api/devices/discovery/room/${roomId}`);
    return response.data;
  }

  async registerDevice(request: RegisterDeviceRequest): Promise<Device> {
    const response = await this.httpClient.post('/api/devices/discovery/register', request);
    return response.data;
  }

  async getDevicesByRoom(roomId: string): Promise<Device[]> {
    const response = await this.httpClient.get(`/api/devices/room/${roomId}`);
    return response.data;
  }

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const response = await this.httpClient.patch(`/api/devices/${deviceId}`, updates);
    return response.data;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.httpClient.delete(`/api/devices/${deviceId}`);
  }
}

/**
 * Factory for dependency injection
 */
export const createDeviceApiClient = (): DeviceApiClient => {
  const httpClient = axiosClient; // from lib/http/axios-client.ts
  return new HttpDeviceApiClient(httpClient);
};

// Singleton instance
export const deviceApiClient = createDeviceApiClient();
```

### 4.4 Message Handling Layer (Adapter Pattern)

#### DeviceMessageAdapter
```typescript
// frontend/src/lib/adapters/device-message-adapter.ts

export class DeviceMessageAdapter {
  /**
   * Adapt backend device state message to frontend format
   */
  static adaptStateMessage(wsMessage: DeviceStateMessage): {
    roomId: string;
    deviceIdentifier: string;
    state: AirConState;
  } | null {
    try {
      return {
        roomId: wsMessage.roomId || '', // Backend should provide roomId
        deviceIdentifier: wsMessage.deviceIdentifier,
        state: wsMessage.data
      };
    } catch (error) {
      console.error('Failed to adapt state message:', error);
      return null;
    }
  }

  /**
   * Adapt backend device discovery message to frontend format
   */
  static adaptDiscoveryMessage(wsMessage: DeviceDiscoveryMessage): DiscoveredDevice {
    return {
      deviceIdentifier: wsMessage.deviceIdentifier,
      deviceType: wsMessage.deviceType,
      messageType: wsMessage.messageType,
      payload: wsMessage.payload,
      timestamp: wsMessage.timestamp,
      requiresRegistration: wsMessage.requiresRegistration
    };
  }

  /**
   * Extract device identifier from MQTT topic
   * Pattern: mitsubishi2mqtt/{deviceId}/state
   */
  static extractDeviceIdentifier(topic: string): string | null {
    const match = topic.match(/mitsubishi2mqtt\/([^\/]+)\//);
    return match?.[1] || null;
  }

  /**
   * Validate device identifier format
   * Must be lowercase alphanumeric with hyphens or underscores
   */
  static isValidDeviceIdentifier(identifier: string): boolean {
    return /^[a-z0-9_-]+$/.test(identifier);
  }
}
```

### 4.5 UI Abstraction Layer (Hooks)

#### useDeviceDiscovery Hook
```typescript
// frontend/src/hooks/useDeviceDiscovery.ts

export const useDeviceDiscovery = () => {
  const discoveredDevices = useStore(
    apiAirconStore,
    (state) => state.discoveredDevices
  );
  const registerDevice = useStore(
    apiAirconStore,
    (state) => state.registerDevice
  );
  const dismissDiscovery = useStore(
    apiAirconStore,
    (state) => state.dismissDiscovery
  );

  return {
    discoveredDevices,
    registerDevice,
    dismissDiscovery
  };
};
```

#### useDeviceSelection Hook
```typescript
// frontend/src/hooks/useDeviceSelection.ts

export const useDeviceSelection = (roomId: string) => {
  const devices = useStore(
    apiAirconStore,
    (state) => state.getDevicesByRoom(roomId)
  );
  const selectedDevice = useStore(
    apiAirconStore,
    (state) => state.getSelectedDevice(roomId)
  );
  const selectDevice = useStore(
    apiAirconStore,
    (state) => state.selectDevice
  );

  const hasMultipleDevices = devices.length > 1;
  const enabledDevices = devices.filter(d => d.enabled);

  return {
    devices,
    enabledDevices,
    selectedDevice,
    selectDevice: (deviceIdentifier: string) => selectDevice(roomId, deviceIdentifier),
    hasMultipleDevices
  };
};
```

#### useDeviceControl Hook (Facade)
```typescript
// frontend/src/hooks/useDeviceControl.ts

export const useDeviceControl = (roomId: string) => {
  const setTemperature = useStore(
    apiAirconStore,
    (state) => state.setTemperature
  );
  const setMode = useStore(
    apiAirconStore,
    (state) => state.setMode
  );
  const setFan = useStore(
    apiAirconStore,
    (state) => state.setFan
  );
  const setPower = useStore(
    apiAirconStore,
    (state) => state.setPower
  );

  // Facade: hide roomId parameter, simplify interface
  return {
    setTemperature: (temp: number) => setTemperature(roomId, temp),
    setMode: (mode: string) => setMode(roomId, mode),
    setFan: (fan: string) => setFan(roomId, fan),
    setPower: (power: string) => setPower(roomId, power)
  };
};
```

## 5. UI Components Design

### 5.1 DeviceDiscoveryNotification Component

**Purpose**: Non-intrusive toast notification for discovered devices

**Design**:
```typescript
// frontend/src/components/devices/DeviceDiscoveryNotification.tsx

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
    <Toast>
      <div className="flex items-center gap-3">
        {/* Device type icon */}
        <DeviceIcon type={device.deviceType} className="h-5 w-5" />

        {/* Discovery info */}
        <div className="flex-1">
          <p className="text-sm font-medium">New device discovered</p>
          <p className="text-xs text-muted-foreground">{device.deviceIdentifier}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onRegister(device)}>
            Register
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDismiss(device.deviceIdentifier)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Toast>
  );
};
```

**ShadcnUI Components**: Toast
**Auto-dismiss**: 30 seconds after appearance
**Persistence**: Dismissed devices stored in localStorage (24h expiry)

### 5.2 DeviceRegistrationDialog Component

**Purpose**: Modal form for registering discovered devices

**Design**:
```typescript
// frontend/src/components/devices/DeviceRegistrationDialog.tsx

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Register Device</DialogTitle>
          <DialogDescription>
            Add {device.deviceIdentifier} to a room
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device info (read-only) */}
          <div className="space-y-2">
            <Label>Device Identifier</Label>
            <Input value={device.deviceIdentifier} disabled />
          </div>

          <div className="space-y-2">
            <Label>Device Type</Label>
            <Input value={device.deviceType} disabled />
          </div>

          {/* Room selection (required) */}
          <div className="space-y-2">
            <Label htmlFor="room">Room *</Label>
            <Select
              value={formData.roomId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
            >
              <SelectTrigger id="room">
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional fields */}
          <div className="space-y-2">
            <Label htmlFor="deviceName">Device Name (Optional)</Label>
            <Input
              id="deviceName"
              value={formData.deviceName}
              onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
              placeholder="e.g., Main AC Unit"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                placeholder="e.g., Mitsubishi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                placeholder="e.g., MSZ-FH"
              />
            </div>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.roomId || isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

**ShadcnUI Components**: Dialog, Form, Input, Select, Button, Alert
**Validation**: Required roomId, optional other fields
**Error Handling**: Display inline errors, keep modal open for retry

### 5.3 DeviceSelector Component

**Purpose**: Dropdown for selecting active device when room has multiple

**Design**:
```typescript
// frontend/src/components/devices/DeviceSelector.tsx

interface DeviceSelectorProps {
  roomId: string;
  devices: Device[];
  selectedDeviceId: string | undefined;
  onSelectDevice: (deviceIdentifier: string) => void;
  className?: string;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  roomId,
  devices,
  selectedDeviceId,
  onSelectDevice,
  className
}) => {
  const enabledDevices = devices.filter(d => d.enabled);

  if (enabledDevices.length <= 1) {
    return null; // Don't render if only one device
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor="device-selector" className="text-sm">
        Device:
      </Label>
      <Select
        value={selectedDeviceId}
        onValueChange={onSelectDevice}
      >
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
};
```

**ShadcnUI Components**: Select, Label
**Conditional Rendering**: Only shown when room has >1 enabled device
**Persistence**: Selection saved to localStorage via store method

### 5.4 AirConRemote Component Modifications

**Changes Required**:
1. Add DeviceSelector below status bar (conditional render)
2. Update command handlers to use `useDeviceControl` hook
3. Display selected device name in header if available
4. Backward compatible: single device = no selector shown

**Modified sections**:
```typescript
// frontend/src/components/AirConRemote.tsx (modified)

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
  const airconState = roomInfo?.state;

  // ... existing state and handlers

  return (
    <div className="flex justify-center items-center min-h-screen w-full">
      <Card className="...">
        {/* Status Bar (existing) */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          {/* Back button, connection status, theme toggle */}
        </div>

        {/* NEW: Device Selector (conditional) */}
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

        {/* Existing control UI */}
        <CardContent className="p-6">
          {/* Temperature display, controls, mode selection, etc. */}
          {/* Commands now use simplified hooks: */}
          {/* setTemperature(temp) instead of setTemperature(roomId, temp) */}
        </CardContent>
      </Card>
    </div>
  );
};
```

## 6. Data Flow Architecture

### 6.1 Device Discovery Flow

```
1. Device powers on/sends MQTT message
   ↓
2. Backend MqttMessageSubscriber receives message
   ↓
3. Backend checks: Device registered? NO → Trigger discovery
   ↓
4. Backend broadcasts WebSocket message:
   {
     type: "DEVICE_DISCOVERED",
     deviceIdentifier: "master_bedroom_aircon",
     deviceType: "airconditioner",
     messageType: "state",
     payload: { temperature: 26, mode: "cool", ... },
     timestamp: 1696512000000,
     requiresRegistration: true
   }
   ↓
5. Frontend websocket-client receives message
   ↓
6. DeviceMessageAdapter.adaptDiscoveryMessage() transforms
   ↓
7. api-aircon-store.addDiscoveredDevice() adds to state
   ↓
8. useDeviceDiscovery hook detects new device
   ↓
9. DeviceDiscoveryNotification toast appears
   ↓
10. User clicks "Register" → DeviceRegistrationDialog opens
   ↓
11. User selects room, enters optional metadata, submits
   ↓
12. deviceApiClient.registerDevice() → POST /api/devices/discovery/register
   ↓
13. Backend creates Device entity, returns to frontend
   ↓
14. api-aircon-store adds device to devices[roomId], dismisses discovery
   ↓
15. Device now available for selection and control
```

### 6.2 Device State Update Flow (Bidirectional)

#### Inbound: Device → UI

```
1. Device state changes (e.g., temperature sensor reading)
   ↓
2. MQTT message → Backend MqttMessageSubscriber
   ↓
3. Backend finds device by identifier → gets roomId
   ↓
4. Backend broadcasts to room via WebSocketSessionRegistry:
   {
     type: "STATE",
     deviceIdentifier: "master_bedroom_aircon",
     deviceType: "airconditioner",
     data: {
       temperature: 26,
       roomTemperature: 28,
       mode: "cool",
       fan: "auto",
       ...
     },
     timestamp: 1696512100000
   }
   ↓
5. Frontend websocket-client receives message
   ↓
6. DeviceMessageAdapter.adaptStateMessage() transforms
   ↓
7. api-aircon-store.updateDeviceState(deviceIdentifier, state)
   ↓
8. Store updates deviceStates[deviceIdentifier]
   ↓
9. UI components re-render (Zustand selector optimized)
   ↓
10. Only components using selected device state re-render
```

#### Outbound: UI → Device

```
1. User adjusts temperature slider → setTemperature(25)
   ↓
2. useDeviceControl hook → api-aircon-store.setTemperature(roomId, 25)
   ↓
3. Store gets selected device: selectedDevices[roomId] → deviceIdentifier
   ↓
4. WebSocket command sent:
   {
     type: "SET_TEMPERATURE",
     roomId: "room-uuid",
     deviceIdentifier: "master_bedroom_aircon",
     temperature: 25
   }
   ↓
5. Backend receives → DeviceService.setDeviceTemperature(deviceIdentifier, 25)
   ↓
6. Backend routes to MqttProtocolPublisher
   ↓
7. MQTT publish: mitsubishi2mqtt/master_bedroom_aircon/temp/set → "25"
   ↓
8. Device receives command and updates state
   ↓
9. Device sends state update → Inbound flow (see above)
```

## 7. Error Handling and Resilience

### 7.1 Error Categories

1. **Network Errors**: WebSocket disconnect, HTTP timeout
2. **Validation Errors**: Duplicate registration, invalid device ID
3. **Backend Errors**: Device not found, MQTT publish failure
4. **State Errors**: Device disabled, room not found

### 7.2 Error Handling Strategies

#### Device Registration Errors

```typescript
// Display error in dialog, keep modal open for retry
catch (error) {
  if (error.response?.status === 409) {
    setError('Device already registered to this room');
  } else if (error.response?.status === 404) {
    setError('Room not found');
  } else {
    setError('Registration failed. Please try again.');
  }
  // Don't close modal - allow user to retry
}
```

#### Command Execution Errors

```typescript
// Toast notification with retry button
catch (error) {
  toast({
    title: 'Command Failed',
    description: error.message,
    action: <Button onClick={retryCommand}>Retry</Button>
  });

  // Exponential backoff for auto-retry (max 3 attempts)
  if (retryCount < 3) {
    setTimeout(() => retryCommand(), 1000 * Math.pow(2, retryCount));
  }
}
```

#### Discovery Message Loss

```typescript
// Fallback polling mechanism
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

#### WebSocket Reconnection

```typescript
// Preserve device state, re-fetch latest state after reconnect
onReconnect: async () => {
  try {
    // Re-fetch devices for all rooms
    for (const roomId of Object.keys(rooms)) {
      const devices = await deviceApiClient.getDevicesByRoom(roomId);
      setRoomDevices(roomId, devices);

      // Fetch latest state for selected devices
      const selectedDevice = getSelectedDevice(roomId);
      if (selectedDevice) {
        // Request current state via WebSocket
        websocketClient.requestDeviceState(selectedDevice.deviceIdentifier);
      }
    }
  } catch (error) {
    console.error('Failed to restore device state after reconnect:', error);
  }
}
```

### 7.3 Graceful Degradation

```typescript
// Fail fast if device API unavailable (no legacy fallback in dev phase)
try {
  const devices = await deviceApiClient.getDevicesByRoom(roomId);
  setRoomDevices(roomId, devices);
} catch (error) {
  console.error('Device API failed:', error);
  // Display error toast, no fallback to legacy mode
  toast.error('Failed to load devices. Please check backend connection.');
  throw error;
}
```

## 8. Performance Optimization

### 8.1 Zustand Selector Optimization

```typescript
// ❌ BAD: Causes re-render on any store change
const store = useStore(apiAirconStore);

// ✅ GOOD: Only re-renders when specific value changes
const devices = useStore(apiAirconStore, (state) => state.devices[roomId]);

// ✅ GOOD: Multiple values with useShallow
const [devices, selected] = useStore(
  apiAirconStore,
  useShallow((state) => [state.devices[roomId], state.selectedDevices[roomId]])
);
```

### 8.2 WebSocket Message Processing

```typescript
// Batch state updates within 50ms window
const messageQueue: DeviceStateMessage[] = [];
let processingTimeout: NodeJS.Timeout | null = null;

const queueStateUpdate = (message: DeviceStateMessage) => {
  messageQueue.push(message);

  if (!processingTimeout) {
    processingTimeout = setTimeout(() => {
      // Batch process all queued messages
      messageQueue.forEach(msg => {
        const adapted = DeviceMessageAdapter.adaptStateMessage(msg);
        if (adapted) {
          updateDeviceState(adapted.deviceIdentifier, adapted.state);
        }
      });

      messageQueue.length = 0;
      processingTimeout = null;
    }, 50);
  }
};
```

### 8.3 Component Optimization

```typescript
// Memoize device selector component
export const DeviceSelector = React.memo<DeviceSelectorProps>(({
  roomId,
  devices,
  selectedDeviceId,
  onSelectDevice
}) => {
  // ... component implementation
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if devices or selection changed
  return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.selectedDeviceId === nextProps.selectedDeviceId &&
    prevProps.devices.length === nextProps.devices.length
  );
});

// Memoize filtered device lists
const enabledDevices = useMemo(
  () => devices.filter(d => d.enabled),
  [devices]
);

// Callback stability
const handleSelectDevice = useCallback(
  (deviceId: string) => selectDevice(roomId, deviceId),
  [roomId, selectDevice]
);
```

### 8.4 LocalStorage Caching

```typescript
// Non-blocking localStorage operations
const saveDeviceSelection = (roomId: string, deviceId: string) => {
  requestIdleCallback(() => {
    try {
      localStorage.setItem(`device_selection_${roomId}`, deviceId);
    } catch (error) {
      console.warn('Failed to save device selection:', error);
    }
  });
};

const loadDeviceSelection = (roomId: string): string | null => {
  try {
    return localStorage.getItem(`device_selection_${roomId}`);
  } catch (error) {
    console.warn('Failed to load device selection:', error);
    return null;
  }
};
```

## 9. Testing Strategy

### 9.1 Unit Tests

**DeviceApiClient**:
- Mock axios responses
- Test error handling (404, 409, 500)
- Verify request payloads

**DeviceMessageAdapter**:
- Test message transformations
- Test device identifier extraction
- Test validation logic

**Store Methods**:
- Test device registration flow
- Test device selection logic
- Test state updates

### 9.2 Integration Tests

**WebSocket Integration**:
- Test discovery message handling
- Test state update propagation
- Test command sending

**Component Integration**:
- Test device selector with multiple devices
- Test registration dialog submission
- Test discovery notification flow

### 9.3 E2E Tests

1. Device discovery → registration → control flow
2. Multi-device room selection
3. Error scenarios (duplicate registration, network failure)


**Device Registration**:
- Validate room ownership before registration
- Validate device identifier format (prevent injection)
- Rate limit registration requests

**WebSocket Authentication**:
- Include JWT token in WebSocket URL
- Backend validates token before accepting connection
- Device commands require valid session

**Input Validation**:
- Sanitize all user inputs (device name, metadata)
- Validate enum values (DeviceType)
- Zod schema validation for API requests

## 11. Documentation Requirements

**Code Documentation**:
- JSDoc for all public interfaces
- Inline comments for complex logic
- README for device integration flow

**User Documentation**:
- Device discovery guide
- Device registration tutorial
- Troubleshooting common issues

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: Claude (AI Assistant)
**Design Patterns Applied**: Adapter, Repository, Observer, Facade
**Clean Code Principles**: DRY, SOLID, YAGNI validated
**Next Step**: Create implementation.md with step-by-step execution plan
