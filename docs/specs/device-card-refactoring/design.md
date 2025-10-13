# Device Card Refactoring - Technical Design Document

## 1. Executive Summary

### 1.1 Design Overview
This document presents the technical architecture for refactoring the 645-line `AirConRemote` component into a modular, extensible device card system. The design applies clean code principles (DRY, SOLID, YAGNI) and carefully selected design patterns to create a maintainable, scalable architecture.

### 1.2 Key Design Decisions
- **Composition over Inheritance**: React-based component composition
- **Factory Pattern**: Dynamic device component rendering
- **Hooks Pattern**: Business logic extraction and reusability
- **Strangler Fig Migration**: Gradual, low-risk replacement strategy

### 1.3 Expected Outcomes
- **30% Code Reduction**: 645 lines → ~450 active lines
- **15 Focused Components**: Each < 60 lines, single responsibility
- **Zero Duplication**: Extracted to reusable utilities
- **100% Extensibility**: Add devices without modifying existing code

---

## 2. Clean Code Principles Analysis

### 2.1 DRY (Don't Repeat Yourself) Implementation

#### Current Duplication in AirConRemote
| Code Block | Lines | Duplication Risk | Solution |
|------------|-------|------------------|----------|
| Connection status display | ~15 | High (all devices) | Extract to `ConnectionStatusBadge` component |
| Mode icon mapping | ~30 | High (other controls) | Extract to `utils/device-icons.ts` |
| Mode color mapping | ~30 | High (theming) | Extract to `utils/device-colors.ts` |
| Tooltip formatters | ~40 | Medium (display logic) | Extract to `utils/device-formatters.ts` |
| Temperature conversion | ~5 | High (sensors, thermostats) | Extract to `utils/temperature.ts` |
| **Total** | **~120 lines** | **19% of codebase** | **Reusable utilities** |

#### DRY Strategy
1. **Identify Duplication Early**: During component design, identify shared concerns
2. **Extract to Utilities**: Pure functions for calculations and formatting
3. **Extract to Components**: UI patterns used across devices
4. **Extract to Hooks**: Stateful logic reused across components
5. **Configuration over Code**: Use constants and config files

#### Expected Impact
- **19% immediate reduction** from duplication elimination
- **50% faster** new device type development
- **Single source of truth** for common functionality

### 2.2 SOLID Principles Application

#### Single Responsibility Principle (SRP)

**Current Violation in AirConRemote**:
```typescript
// ONE component doing EVERYTHING:
- Device state management
- MQTT communication
- UI rendering (temperature, mode, fan)
- User interaction handling
- Theme management
- Connection monitoring
- Navigation
```

**Fixed Architecture**:
```typescript
// Each component has ONE reason to change:
BaseDeviceCard        → Card layout and common behavior
AirConditionerDevice  → AC-specific controls only
TemperatureSlider     → Temperature slider UI only
ModeSelector          → Mode selection UI only
PowerButton           → Power toggle only

// Hooks have ONE responsibility:
useAirConditionerState    → Extract AC state
useAirConditionerControls → Provide AC control functions
useDevicePreferences      → Manage user preferences
```

**Validation**:
- ✅ Each component: 1 reason to change
- ✅ Each function: Does one thing well
- ✅ Each hook: Single stateful concern

#### Open/Closed Principle (OCP)

**Implementation**:
```typescript
// OPEN for extension (add new devices)
// CLOSED for modification (don't change factory)

const DEVICE_COMPONENTS: Record<DeviceType, DeviceComponent> = {
  'air-conditioner': AirConditionerDevice,
  'lighting': LightingDevice,        // ADD: No factory change
  'sensor': SensorDevice,             // ADD: No factory change
} as const;

// Adding new device:
// 1. Create new component (extends BaseDeviceProps)
// 2. Add to registry
// 3. NO modification to DeviceFactory logic ✅
```

**Benefits**:
- Add devices without touching core code
- Extend base components via props/composition
- No regression risk when adding features

#### Liskov Substitution Principle (LSP)

**Interface Contract**:
```typescript
// All devices MUST implement this contract
interface BaseDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

// Factory can substitute ANY device component
type DeviceComponent = React.FC<BaseDeviceProps>;

// LSP Guarantee: Swapping devices won't break factory
<DeviceFactory device={{ type: 'air-conditioner', ... }} />
<DeviceFactory device={{ type: 'lighting', ... }} />  // ✅ Works identically
```

**Validation**:
- ✅ All devices implement BaseDeviceProps
- ✅ Factory treats all devices uniformly
- ✅ Substitutability guaranteed by TypeScript

#### Interface Segregation Principle (ISP)

**No Fat Interfaces**:
```typescript
// ❌ BAD: Fat interface forcing unnecessary props
interface DeviceProps {
  // AC props
  temperature?: number;
  mode?: string;
  fan?: string;

  // Lighting props (unused by AC!)
  brightness?: number;
  color?: string;

  // Sensor props (unused by both!)
  humidity?: number;
  motion?: boolean;
}

// ✅ GOOD: Segregated interfaces
interface BaseDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
}

interface AirConditionerDeviceProps extends BaseDeviceProps {
  // Only AC-specific props
}

interface LightingDeviceProps extends BaseDeviceProps {
  // Only lighting-specific props
}
```

**Benefits**:
- Components only receive props they need
- No null/undefined checks for irrelevant props
- Clear, focused interfaces

#### Dependency Inversion Principle (DIP)

**Depend on Abstractions**:
```typescript
// ❌ BAD: High-level depends on low-level
import { useAirconStore } from '@/stores/aircon-store';

const AirConditionerDevice = () => {
  const state = useAirconStore(state => state); // Direct store dependency
  // ...
};

// ✅ GOOD: Depend on abstraction (hook)
import { useAirConditionerState } from '@/hooks/devices/useAirConditionerState';

const AirConditionerDevice = ({ deviceId, roomId }) => {
  const state = useAirConditionerState(deviceId, roomId); // Abstract dependency
  // Store implementation hidden behind hook
};
```

**Architecture**:
```
High-level: Components
    ↓ (depends on)
Abstraction: Hooks (interfaces)
    ↓ (implements)
Low-level: Zustand Store, MQTT Client
```

**Benefits**:
- Components don't know about store implementation
- Easy to swap store (Zustand → Redux → Context)
- Testable with mock hooks

### 2.3 YAGNI (You Aren't Gonna Need It) Validation

#### What We're NOT Building
| Feature | Why Not | When to Add |
|---------|---------|-------------|
| Full Lighting device | Not in requirements | When lighting control needed |
| Full Sensor device | Not in requirements | When sensor display needed |
| Strategy pattern for controls | No current need | When control patterns diverge |
| Abstract factory pattern | Single factory sufficient | When factory logic gets complex |
| Device grouping | Not required | When multi-device control needed |
| Automated scheduling | Out of scope | Future enhancement |

#### What We ARE Building
| Feature | Why | Justification |
|---------|-----|---------------|
| Factory pattern | Multiple device types | Current requirement |
| Base components | Common layout | DRY principle |
| Hooks for AC logic | Reusability | Current code complexity |
| Placeholder devices | Architecture demo | Shows extensibility |

**YAGNI Check**: ✅ Only implementing current requirements, avoiding speculation

---

## 3. Design Pattern Analysis and Trade-offs

### 3.1 Pattern Selection Framework

**Evaluation Criteria**:
```
Pattern Score = (
  Complexity (1-5, lower better) +
  Maintainability (1-5, higher better) +
  Testability (1-5, higher better) +
  Performance (1-5, higher better) +
  Flexibility (1-5, higher better) +
  Team Knowledge (1-5, higher better)
) / 6

Decision Threshold: > 3.5 to adopt
```

### 3.2 Factory Pattern (ADOPTED ✅)

**Score: 4.5/5**

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Complexity | 4 | Simple registry-based implementation |
| Maintainability | 5 | Centralized device creation logic |
| Testability | 5 | Easy to mock device components |
| Performance | 4 | Minimal overhead, component lookup O(1) |
| Flexibility | 5 | Easy to add/remove device types |
| Team Knowledge | 4 | Common pattern in React |

**Implementation**:
```typescript
const DEVICE_COMPONENTS: Record<DeviceType, DeviceComponent> = {
  'air-conditioner': AirConditionerDevice,
  'lighting': LightingDevice,
  'sensor': SensorDevice,
} as const;

const DeviceFactory: React.FC<DeviceFactoryProps> = ({ device }) => {
  const Component = DEVICE_COMPONENTS[device.type] || FallbackDevice;
  return <Component {...device} />;
};
```

**Pros**:
- ✅ Single place to manage device components
- ✅ Type-safe device selection
- ✅ Easy to extend (OCP)
- ✅ Decouples device creation from usage

**Cons**:
- ⚠️ All device components must be imported (code splitting consideration)
- ⚠️ Registry must be kept in sync with device types

**Mitigation**:
- Use dynamic imports for code splitting if needed
- TypeScript enforces registry completeness

### 3.3 Composite Pattern (ADOPTED ✅)

**Score: 4.0/5**

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Complexity | 4 | Tree structure, well-understood |
| Maintainability | 5 | Clear hierarchy, easy to modify |
| Testability | 4 | Test components independently |
| Performance | 3 | Some overhead from nesting |
| Flexibility | 5 | Easy to add/rearrange sections |
| Team Knowledge | 3 | Less common in React (but intuitive) |

**Implementation**:
```typescript
<BaseDeviceCard>
  <DeviceCardHeader>
    <ConnectionStatusBadge />
    <DeviceActions />
  </DeviceCardHeader>

  <DeviceCardContent>
    <AirConditionerDevice />
  </DeviceCardContent>

  <DeviceCardFooter>
    <LastUpdated />
    <QuickActions />
  </DeviceCardFooter>
</BaseDeviceCard>
```

**Pros**:
- ✅ Uniform card structure across devices
- ✅ Easy to add/remove card sections
- ✅ Composable and reusable
- ✅ Clear visual hierarchy

**Cons**:
- ⚠️ Deeper component tree (performance consideration)
- ⚠️ Prop drilling if not careful

**Mitigation**:
- Use React Context for shared state within card
- React.memo for expensive components

### 3.4 Hooks Pattern (ADOPTED ✅)

**Score: 5.0/5**

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Complexity | 5 | Simple, linear logic |
| Maintainability | 5 | Isolated, single responsibility |
| Testability | 5 | Pure logic, easy to test |
| Performance | 5 | Optimized for React |
| Flexibility | 5 | Reusable across components |
| Team Knowledge | 5 | Core React pattern |

**Implementation**:
```typescript
// Hook 1: State extraction
const useAirConditionerState = (deviceId: string, roomId: string) => {
  const { getRoomInfo } = useAirconContext();
  const roomInfo = getRoomInfo(roomId);
  return roomInfo?.state; // ~20 lines
};

// Hook 2: Control functions
const useAirConditionerControls = (deviceId: string, roomId: string) => {
  const { setTemperature, setMode, setFan } = useAirconContext();
  const triggerHaptic = useHaptic();

  return {
    setTemperature: (temp) => { /* ... */ },
    setMode: (mode) => { /* ... */ },
    // ...
  }; // ~40 lines
};

// Hook 3: Preferences
const useDevicePreferences = () => {
  const [prefs, setPrefs] = useAirConPreferences();
  return {
    useFahrenheit: prefs.useFahrenheit,
    toggleUnit: () => { /* ... */ },
    // ...
  }; // ~15 lines
};
```

**Pros**:
- ✅ Extract business logic from UI
- ✅ Reusable across components
- ✅ Testable independently
- ✅ No component nesting overhead

**Cons**:
- ⚠️ Can lead to hook proliferation
- ⚠️ Rules of hooks must be followed

**Mitigation**:
- Keep hooks focused and small (< 50 lines)
- Clear naming convention: `use<Domain><Purpose>`

### 3.5 Observer Pattern (KEEP EXISTING ✅)

**Score: 5.0/5** (already implemented via MQTT + RxJS)

**Current Implementation**:
```typescript
// MQTT client publishes messages
airconStream$.pipe(
  catchError(/* ... */),
  retry(/* ... */)
).subscribe((message) => {
  // Update Zustand store
  updateState(message);
});
```

**Decision**: Keep existing implementation, no changes needed

**Pros**:
- ✅ Real-time updates working perfectly
- ✅ Decoupled MQTT from UI
- ✅ Observable streams well-tested

**Cons**:
- None for current use case

### 3.6 Strategy Pattern (DEFERRED ⏸️)

**Score: 3.5/5** (at threshold, not needed yet)

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Complexity | 3 | Adds abstraction layer |
| Maintainability | 4 | Encapsulates algorithms |
| Testability | 4 | Test strategies independently |
| Performance | 4 | Minimal overhead |
| Flexibility | 4 | Easy to swap strategies |
| Team Knowledge | 3 | Less common pattern |

**When to Add**: If device control patterns significantly diverge (e.g., different communication protocols)

**Current Decision**: YAGNI - not needed now, can add later if needed

### 3.7 Template Method Pattern (REJECTED ❌)

**Score: 2.5/5** (below threshold)

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Complexity | 2 | Inheritance-based, complex |
| Maintainability | 3 | Tight coupling via inheritance |
| Testability | 3 | Harder to mock base class |
| Performance | 4 | Minimal overhead |
| Flexibility | 2 | Rigid inheritance hierarchy |
| Team Knowledge | 2 | Not idiomatic in React |

**Reason for Rejection**: React favors composition over inheritance

**Alternative**: Use Composite pattern + Hooks for shared behavior

---

## 4. Architecture Design

### 4.1 Component Hierarchy

```
DeviceFactory (device type routing)
  └── BaseDeviceCard (common layout/behavior)
      ├── DeviceCardHeader
      │   ├── DeviceTitle
      │   ├── ConnectionStatusBadge
      │   └── DeviceActions (collapse, settings)
      │
      ├── DeviceCardContent (device-specific)
      │   └── AirConditionerDevice (or other device types)
      │       ├── TemperatureDisplay
      │       ├── TemperatureSlider
      │       ├── TemperatureButtons (+/-)
      │       ├── ModeSelector
      │       ├── FanControl
      │       ├── PowerButton
      │       └── SleepModeToggle
      │
      └── DeviceCardFooter
          ├── LastUpdated
          └── QuickActions
```

### 4.2 Data Flow Architecture

```
┌─────────────────────────────────────────────┐
│           Presentation Layer                 │
│  (UI Components - Device-specific views)     │
│                                              │
│  AirConditionerDevice                        │
│  ├── TemperatureSlider                       │
│  ├── ModeSelector                            │
│  └── FanControl                              │
└─────────────────────────────────────────────┘
                      ↓ ↑
                (props) (callbacks)
                      ↓ ↑
┌─────────────────────────────────────────────┐
│          Business Logic Layer                │
│  (Hooks - Abstract business logic)           │
│                                              │
│  useAirConditionerState()                    │
│  useAirConditionerControls()                 │
│  useDevicePreferences()                      │
└─────────────────────────────────────────────┘
                      ↓ ↑
            (state) (actions)
                      ↓ ↑
┌─────────────────────────────────────────────┐
│             Data Layer                       │
│  (State Management & Communication)          │
│                                              │
│  Zustand Store ←→ MQTT Client ←→ API Client │
└─────────────────────────────────────────────┘
                      ↓ ↑
                  (messages)
                      ↓ ↑
┌─────────────────────────────────────────────┐
│          External Systems                    │
│  MQTT Broker, REST API, Backend              │
└─────────────────────────────────────────────┘
```

**Data Flow Principles**:
1. **Unidirectional Flow**: State flows down, actions flow up (Flux pattern)
2. **Layer Separation**: UI doesn't know about MQTT, hooks don't know about UI
3. **Abstraction**: Hooks provide stable interface to state and actions
4. **Encapsulation**: Implementation details hidden behind hooks

### 4.3 Separation of Concerns

| Layer | Responsibility | Dependencies | Exports |
|-------|---------------|--------------|---------|
| **Presentation** | UI rendering, user interactions | Hooks, UI components | React components |
| **Business Logic** | State management, control logic | Zustand store, MQTT client | Hooks |
| **Data** | State persistence, communication | MQTT broker, API | Store, client |

**Benefits**:
- ✅ Clear boundaries between layers
- ✅ Easy to test each layer independently
- ✅ Can swap implementations without affecting other layers
- ✅ Follows Clean Architecture principles

### 4.4 Component Cohesion and Coupling Analysis

#### High Cohesion ✅

**BaseDeviceCard** (Cohesion Score: 9/10)
- All elements related to device card layout
- Single purpose: Provide common card structure
- All methods support card behavior (expand/collapse, status)

**AirConditionerDevice** (Cohesion Score: 10/10)
- All elements related to AC control
- Single purpose: AC user interface
- No unrelated functionality

**useAirConditionerControls** (Cohesion Score: 10/10)
- All functions related to AC control actions
- Single purpose: Provide AC control interface
- Tightly related methods

#### Low Coupling ✅

**Coupling Matrix**:
```
Component              | Dependencies Count | Coupling Score
-----------------------|-------------------|---------------
BaseDeviceCard         | 2 (Card, children) | Low ✅
AirConditionerDevice   | 4 (Base, hooks, icons, utils) | Low ✅
DeviceFactory          | 3 (map, Base, config) | Low ✅
TemperatureSlider      | 3 (Slider, hooks, utils) | Low ✅
useAirConditionerState | 2 (context, selector) | Low ✅
```

**Target**: < 5 dependencies per component
**Actual**: All components within target ✅

#### Dependency Direction ✅

```
BaseDeviceCard
    ↓ (uses)
DeviceCardHeader, Content, Footer
    ↓ (uses)
UI Components (Card, Badge, Button)

AirConditionerDevice
    ↓ (uses)
useAirConditionerState, useAirConditionerControls
    ↓ (uses)
Zustand Store, MQTT Client
```

**Validation**:
- ✅ Dependencies flow inward (toward business logic)
- ✅ No circular dependencies
- ✅ Stable dependencies (UI depends on stable hooks)
- ✅ Acyclic dependency graph

---

## 5. Interface Contracts and Type Definitions

### 5.1 Base Device Interface

```typescript
/**
 * Base props that ALL device components must implement
 * Ensures Liskov Substitution Principle
 */
interface BaseDeviceProps {
  /** Unique device identifier */
  deviceId: string;

  /** Display name for the device */
  deviceName: string;

  /** Room ID where device is located */
  roomId: string;

  /** Current expansion state */
  isExpanded?: boolean;

  /** Callback when expand/collapse toggled */
  onExpandToggle?: () => void;
}

/**
 * Device component type definition
 * All device components must conform to this signature
 */
type DeviceComponent = React.FC<BaseDeviceProps>;
```

### 5.2 Device Factory Configuration

```typescript
/**
 * Supported device types (exhaustive)
 */
type DeviceType = 'air-conditioner' | 'lighting' | 'sensor';

/**
 * Device configuration object
 * Used by DeviceFactory to instantiate devices
 */
interface DeviceConfig {
  /** Type of device to render */
  type: DeviceType;

  /** Unique device identifier */
  id: string;

  /** Display name */
  name: string;

  /** Parent room ID */
  roomId: string;

  /** Device-specific configuration (optional) */
  config?: Record<string, any>;
}

/**
 * Device Factory props
 */
interface DeviceFactoryProps {
  /** Device configuration */
  device: DeviceConfig;

  /** Expansion state (optional, managed by parent) */
  isExpanded?: boolean;

  /** Expansion toggle callback */
  onExpandToggle?: () => void;
}
```

### 5.3 Air Conditioner Device Interface

```typescript
/**
 * Air Conditioner specific props (extends base)
 */
interface AirConditionerDeviceProps extends BaseDeviceProps {
  // AC-specific props can be added here if needed
  // Currently all state comes from hooks
}

/**
 * Air Conditioner state (from hook)
 */
interface AirConditionerState {
  temperature: number;
  mode: string;
  fan: string;
  isActive: boolean;
  currentTemp?: number;
}

/**
 * Air Conditioner controls (from hook)
 */
interface AirConditionerControls {
  setTemperature: (temp: number) => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  setFan: (fan: string) => Promise<void>;
  togglePower: () => Promise<void>;
  toggleSleepMode: () => Promise<void>;
}
```

### 5.4 Device Card Section Interfaces

```typescript
/**
 * Device Card Header props
 */
interface DeviceCardHeaderProps {
  deviceName: string;
  deviceType: DeviceType;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  isExpanded: boolean;
  onExpandToggle: () => void;
  actions?: React.ReactNode;
}

/**
 * Device Card Content props (wrapper only)
 */
interface DeviceCardContentProps {
  children: React.ReactNode;
  isExpanded: boolean;
}

/**
 * Device Card Footer props
 */
interface DeviceCardFooterProps {
  lastUpdated?: Date;
  actions?: React.ReactNode;
  metadata?: Record<string, string>;
}
```

---

## 6. File Structure and Organization

### 6.1 Directory Structure

```
frontend/src/
├── components/
│   ├── devices/
│   │   ├── base/
│   │   │   ├── BaseDeviceCard.tsx              (~50 lines)
│   │   │   ├── DeviceCardHeader.tsx            (~30 lines)
│   │   │   ├── DeviceCardContent.tsx           (~15 lines)
│   │   │   ├── DeviceCardFooter.tsx            (~25 lines)
│   │   │   ├── ConnectionStatusBadge.tsx       (~20 lines)
│   │   │   └── index.ts                        (exports)
│   │   │
│   │   ├── air-conditioner/
│   │   │   ├── AirConditionerDevice.tsx        (~60 lines)
│   │   │   ├── TemperatureDisplay.tsx          (~30 lines)
│   │   │   ├── TemperatureSlider.tsx           (~40 lines)
│   │   │   ├── TemperatureButtons.tsx          (~30 lines)
│   │   │   ├── ModeSelector.tsx                (~50 lines)
│   │   │   ├── FanControl.tsx                  (~40 lines)
│   │   │   ├── PowerButton.tsx                 (~25 lines)
│   │   │   ├── SleepModeToggle.tsx             (~30 lines)
│   │   │   └── index.ts                        (exports)
│   │   │
│   │   ├── lighting/
│   │   │   ├── LightingDevice.tsx              (~50 lines - placeholder)
│   │   │   └── index.ts
│   │   │
│   │   ├── sensor/
│   │   │   ├── SensorDevice.tsx                (~50 lines - placeholder)
│   │   │   └── index.ts
│   │   │
│   │   ├── DeviceFactory.tsx                   (~60 lines)
│   │   └── index.ts                            (main exports)
│   │
│   └── [other components...]
│
├── hooks/
│   ├── devices/
│   │   ├── useAirConditionerState.ts           (~20 lines)
│   │   ├── useAirConditionerControls.ts        (~40 lines)
│   │   ├── useDevicePreferences.ts             (~15 lines)
│   │   └── index.ts                            (exports)
│   │
│   └── [other hooks...]
│
├── utils/
│   ├── devices/
│   │   ├── device-icons.ts                     (~40 lines)
│   │   ├── device-colors.ts                    (~30 lines)
│   │   ├── device-formatters.ts                (~30 lines)
│   │   ├── temperature.ts                      (~15 lines)
│   │   └── index.ts                            (exports)
│   │
│   └── [other utils...]
│
└── types/
    └── devices.ts                              (~50 lines - all interfaces)
```

### 6.2 File Size Targets

| File Type | Target Size | Max Size | Justification |
|-----------|-------------|----------|---------------|
| Component | 30-60 lines | 80 lines | Single responsibility, easy to read |
| Hook | 15-40 lines | 50 lines | Focused logic, minimal complexity |
| Utility | 15-30 lines | 40 lines | Pure functions, one purpose |
| Types | N/A | 100 lines | Interface definitions, can be larger |

### 6.3 Import/Export Strategy

**Base Components** (`components/devices/base/index.ts`):
```typescript
export { BaseDeviceCard } from './BaseDeviceCard';
export { DeviceCardHeader } from './DeviceCardHeader';
export { DeviceCardContent } from './DeviceCardContent';
export { DeviceCardFooter } from './DeviceCardFooter';
export { ConnectionStatusBadge } from './ConnectionStatusBadge';
```

**Device Hooks** (`hooks/devices/index.ts`):
```typescript
export { useAirConditionerState } from './useAirConditionerState';
export { useAirConditionerControls } from './useAirConditionerControls';
export { useDevicePreferences } from './useDevicePreferences';
```

**Device Utilities** (`utils/devices/index.ts`):
```typescript
export * from './device-icons';
export * from './device-colors';
export * from './device-formatters';
export * from './temperature';
```

**Main Device Export** (`components/devices/index.ts`):
```typescript
export { DeviceFactory } from './DeviceFactory';
export * from './base';
export { AirConditionerDevice } from './air-conditioner';
export { LightingDevice } from './lighting';
export { SensorDevice } from './sensor';
```

---

## 7. Implementation Details

### 7.1 BaseDeviceCard Component

**File**: `components/devices/base/BaseDeviceCard.tsx`

**Responsibility**: Provide common card layout and behavior for all devices

**Key Features**:
- Expand/collapse animation
- Error boundary
- Loading state
- Common card styling

**Implementation**:
```typescript
interface BaseDeviceCardProps {
  children: React.ReactNode;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  deviceName: string;
  deviceType: DeviceType;
  connectionStatus: ConnectionStatus;
}

export const BaseDeviceCard: React.FC<BaseDeviceCardProps> = ({
  children,
  isExpanded = false,
  onExpandToggle,
  deviceName,
  deviceType,
  connectionStatus,
}) => {
  return (
    <Card className="overflow-hidden transition-all duration-200">
      <DeviceCardHeader
        deviceName={deviceName}
        deviceType={deviceType}
        connectionStatus={connectionStatus}
        isExpanded={isExpanded}
        onExpandToggle={onExpandToggle}
      />

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DeviceCardContent isExpanded={isExpanded}>
              {children}
            </DeviceCardContent>
          </motion.div>
        )}
      </AnimatePresence>

      <DeviceCardFooter lastUpdated={new Date()} />
    </Card>
  );
};
```

**Estimated Lines**: ~50

### 7.2 DeviceFactory Component

**File**: `components/devices/DeviceFactory.tsx`

**Responsibility**: Select and render appropriate device component based on type

**Implementation**:
```typescript
import { AirConditionerDevice } from './air-conditioner';
import { LightingDevice } from './lighting';
import { SensorDevice } from './sensor';

const DEVICE_COMPONENTS: Record<DeviceType, DeviceComponent> = {
  'air-conditioner': AirConditionerDevice,
  'lighting': LightingDevice,
  'sensor': SensorDevice,
} as const;

const FallbackDevice: React.FC<BaseDeviceProps> = ({ deviceName }) => (
  <Card className="p-4">
    <p className="text-muted-foreground">
      Unknown device type: {deviceName}
    </p>
  </Card>
);

export const DeviceFactory: React.FC<DeviceFactoryProps> = ({
  device,
  isExpanded = false,
  onExpandToggle,
}) => {
  const Component = DEVICE_COMPONENTS[device.type] || FallbackDevice;

  return (
    <Component
      deviceId={device.id}
      deviceName={device.name}
      roomId={device.roomId}
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
      {...device.config}
    />
  );
};
```

**Estimated Lines**: ~60

### 7.3 AirConditionerDevice Component

**File**: `components/devices/air-conditioner/AirConditionerDevice.tsx`

**Responsibility**: Compose AC-specific UI using base card and AC controls

**Implementation**:
```typescript
export const AirConditionerDevice: React.FC<BaseDeviceProps> = ({
  deviceId,
  deviceName,
  roomId,
  isExpanded,
  onExpandToggle,
}) => {
  const state = useAirConditionerState(deviceId, roomId);
  const controls = useAirConditionerControls(deviceId, roomId);
  const { status } = useConnectionStatus();

  return (
    <BaseDeviceCard
      deviceName={deviceName}
      deviceType="air-conditioner"
      connectionStatus={status}
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
    >
      <div className="space-y-4 p-4">
        <TemperatureDisplay
          current={state?.currentTemp}
          target={state?.temperature}
        />

        <TemperatureSlider
          value={state?.temperature}
          onChange={controls.setTemperature}
        />

        <TemperatureButtons
          onIncrement={() => controls.setTemperature(state!.temperature + 1)}
          onDecrement={() => controls.setTemperature(state!.temperature - 1)}
        />

        <ModeSelector
          current={state?.mode}
          onChange={controls.setMode}
        />

        <FanControl
          current={state?.fan}
          onChange={controls.setFan}
        />

        <div className="flex gap-2">
          <PowerButton
            isActive={state?.isActive}
            onToggle={controls.togglePower}
          />

          <SleepModeToggle
            onToggle={controls.toggleSleepMode}
          />
        </div>
      </div>
    </BaseDeviceCard>
  );
};
```

**Estimated Lines**: ~60 (composition only, no logic)

### 7.4 Hook Implementations

**useAirConditionerState** (~20 lines):
```typescript
export const useAirConditionerState = (
  deviceId: string,
  roomId: string
): AirConditionerState | undefined => {
  const { getRoomInfo } = useAirconContext();
  const roomInfo = getRoomInfo(roomId);

  return useMemo(() => {
    if (!roomInfo?.state) return undefined;

    return {
      temperature: roomInfo.state.temperature,
      mode: roomInfo.state.mode,
      fan: roomInfo.state.fan,
      isActive: roomInfo.state.mode !== MODE_VALUES.OFF,
      currentTemp: roomInfo.state.currentTemp,
    };
  }, [roomInfo]);
};
```

**useAirConditionerControls** (~40 lines):
```typescript
export const useAirConditionerControls = (
  deviceId: string,
  roomId: string
): AirConditionerControls => {
  const { setTemperature, setMode, setFan } = useAirconContext();
  const triggerHaptic = useHaptic();

  return useMemo(() => ({
    setTemperature: async (temp: number) => {
      await setTemperature(roomId, temp);
      triggerHaptic(30);
    },

    setMode: async (mode: string) => {
      await setMode(roomId, mode);
      triggerHaptic(50);
    },

    setFan: async (fan: string) => {
      await setFan(roomId, fan);
      triggerHaptic(30);
    },

    togglePower: async () => {
      const state = useAirConditionerState(deviceId, roomId);
      const newMode = state?.isActive ? MODE_VALUES.OFF : MODE_VALUES.COOL;
      await setMode(roomId, newMode);
      triggerHaptic(100);
    },

    toggleSleepMode: async () => {
      // Sleep mode logic
      triggerHaptic(50);
    },
  }), [deviceId, roomId, setTemperature, setMode, setFan, triggerHaptic]);
};
```

### 7.5 Utility Implementations

**device-icons.ts** (~40 lines):
```typescript
export const getModeIcon = (mode: string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    [MODE_VALUES.HEAT]: <Sun className="h-5 w-5" />,
    [MODE_VALUES.COOL]: <Snowflake className="h-5 w-5" />,
    [MODE_VALUES.DRY]: <Droplets className="h-5 w-5" />,
    [MODE_VALUES.FAN_ONLY]: <Fan className="h-5 w-5" />,
    [MODE_VALUES.HEAT_COOL]: <Wind className="h-5 w-5" />,
  };

  return iconMap[mode] || <Power className="h-5 w-5" />;
};

export const getFanIcon = (fan: string): React.ReactNode => {
  // Similar mapping
};
```

**device-colors.ts** (~30 lines):
```typescript
export const getModeColor = (mode: string): string => {
  const colorMap: Record<string, string> = {
    [MODE_VALUES.HEAT]: 'bg-orange-500 hover:bg-orange-600',
    [MODE_VALUES.COOL]: 'bg-blue-500 hover:bg-blue-600',
    [MODE_VALUES.DRY]: 'bg-teal-500 hover:bg-teal-600',
    [MODE_VALUES.FAN_ONLY]: 'bg-gray-500 hover:bg-gray-600',
    [MODE_VALUES.HEAT_COOL]: 'bg-purple-500 hover:bg-purple-600',
  };

  return colorMap[mode] || 'bg-gray-400 hover:bg-gray-500';
};
```

**temperature.ts** (~15 lines):
```typescript
export const celsiusToFahrenheit = (celsius: number): number => {
  return Math.round(celsius * 1.8 + 32);
};

export const fahrenheitToCelsius = (fahrenheit: number): number => {
  return Math.round((fahrenheit - 32) / 1.8);
};

export const displayTemperature = (
  temp: number,
  useFahrenheit: boolean
): string => {
  const displayTemp = useFahrenheit ? celsiusToFahrenheit(temp) : temp;
  const unit = useFahrenheit ? '°F' : '°C';
  return `${displayTemp}${unit}`;
};
```

---

## 8. Migration Strategy

### 8.1 Phased Rollout Plan

**Phase 1: Extract Utilities (Zero Risk)**
- **Duration**: 1-2 hours
- **Tasks**:
  1. Create `utils/devices/` directory
  2. Extract icon mapping to `device-icons.ts`
  3. Extract color mapping to `device-colors.ts`
  4. Extract formatters to `device-formatters.ts`
  5. Extract temperature utils to `temperature.ts`
  6. Update `AirConRemote` imports to use new utils
- **Validation**: Existing AC functionality unchanged
- **Rollback**: Revert import paths

**Phase 2: Create Base Components (Low Risk)**
- **Duration**: 2-3 hours
- **Tasks**:
  1. Create `BaseDeviceCard` component
  2. Create `DeviceCardHeader` component
  3. Create `DeviceCardContent` component
  4. Create `DeviceCardFooter` component
  5. Create `ConnectionStatusBadge` component
  6. Add Storybook stories for visual testing
- **Validation**: Components render correctly in isolation
- **Rollback**: Delete new components, no impact on app

**Phase 3: Build Hooks (Low Risk)**
- **Duration**: 2-3 hours
- **Tasks**:
  1. Create `useAirConditionerState` hook
  2. Create `useAirConditionerControls` hook
  3. Create `useDevicePreferences` hook
  4. Write unit tests for hooks
- **Validation**: Hooks tested independently
- **Rollback**: Delete hooks, no impact on app

**Phase 4: Create AirConditionerDevice (Medium Risk)**
- **Duration**: 2-3 hours
- **Tasks**:
  1. Create AC control components (Temperature, Mode, Fan, etc.)
  2. Create `AirConditionerDevice` using base card + hooks
  3. Add to Storybook
  4. Run parallel to old `AirConRemote` (don't replace yet)
- **Validation**: New component works identically to old
- **Rollback**: Delete new components, keep old

**Phase 5: Create DeviceFactory (Low Risk)**
- **Duration**: 1-2 hours
- **Tasks**:
  1. Create `DeviceFactory` component
  2. Add device registry
  3. Create placeholder `LightingDevice` and `SensorDevice`
  4. Add factory tests
- **Validation**: Factory correctly routes to devices
- **Rollback**: Delete factory, not yet used in app

**Phase 6: Swap Implementation (Controlled)**
- **Duration**: 1 hour
- **Tasks**:
  1. Add feature flag `USE_NEW_DEVICE_COMPONENTS`
  2. Update room detail page to conditionally use DeviceFactory
  3. Deploy with flag OFF
  4. Enable flag in dev/staging
  5. Monitor for issues
  6. Enable in production
  7. Remove old AirConRemote after 1 week
- **Validation**: A/B test old vs new implementation
- **Rollback**: Toggle feature flag OFF

### 8.2 Strangler Fig Pattern

**Concept**: Gradually replace old system with new, running both in parallel

```
┌─────────────────────────────────────┐
│  Room Detail Page                   │
│                                     │
│  if (USE_NEW_DEVICE_COMPONENTS) {   │
│    return <DeviceFactory />         │
│  } else {                           │
│    return <AirConRemote />          │
│  }                                  │
└─────────────────────────────────────┘
```

**Benefits**:
- ✅ Zero downtime migration
- ✅ Easy rollback (feature flag)
- ✅ Gradual rollout (dev → staging → prod)
- ✅ Side-by-side comparison

### 8.3 Validation Strategy

**Unit Tests**:
```typescript
// Hook tests
describe('useAirConditionerState', () => {
  it('extracts AC state from room info', () => {
    const { result } = renderHook(() =>
      useAirConditionerState('device1', 'room1')
    );

    expect(result.current).toEqual({
      temperature: 24,
      mode: 'cool',
      fan: 'auto',
      isActive: true,
      currentTemp: 26,
    });
  });
});

// Component tests
describe('AirConditionerDevice', () => {
  it('renders temperature controls', () => {
    render(<AirConditionerDevice deviceId="1" roomId="room1" />);
    expect(screen.getByText(/24°C/)).toBeInTheDocument();
  });
});
```

**Integration Tests**:
```typescript
describe('DeviceFactory integration', () => {
  it('renders correct device based on type', () => {
    render(
      <DeviceFactory
        device={{ type: 'air-conditioner', id: '1', name: 'AC', roomId: 'room1' }}
      />
    );

    expect(screen.getByText(/AC/)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument(); // Temperature slider
  });
});
```

**Visual Regression Tests** (Storybook + Chromatic):
```typescript
// AirConditionerDevice.stories.tsx
export const Default = {
  args: {
    deviceId: '1',
    deviceName: 'Living Room AC',
    roomId: 'room1',
    isExpanded: true,
  },
};

export const Collapsed = {
  args: {
    ...Default.args,
    isExpanded: false,
  },
};

export const Disconnected = {
  args: {
    ...Default.args,
  },
  parameters: {
    mockConnectionStatus: 'disconnected',
  },
};
```

**Performance Tests**:
```typescript
describe('Performance', () => {
  it('renders 50 device cards in under 1 second', () => {
    const start = performance.now();

    render(
      <>
        {Array.from({ length: 50 }).map((_, i) => (
          <AirConditionerDevice key={i} deviceId={`${i}`} roomId="room1" />
        ))}
      </>
    );

    const end = performance.now();
    expect(end - start).toBeLessThan(1000);
  });
});
```

### 8.4 Rollback Plan

**Immediate Rollback** (< 5 minutes):
1. Toggle feature flag `USE_NEW_DEVICE_COMPONENTS = false`
2. Deploy config change
3. App reverts to old `AirConRemote` component

**If Feature Flag Fails**:
1. Revert to previous Git commit
2. Deploy previous version
3. Restore old `AirConRemote` component

**Data Rollback**:
- No database changes, no data rollback needed
- State management unchanged (Zustand store)
- MQTT messages unchanged

---

## 9. Performance Optimization

### 9.1 React.memo Optimization

**Strategy**: Memoize components that render frequently but have stable props

```typescript
// Expensive component - temperature slider
export const TemperatureSlider = React.memo<TemperatureSliderProps>(
  ({ value, onChange }) => {
    // Render logic
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if value changed
    return prevProps.value === nextProps.value;
  }
);

// Display component - only re-render on temperature change
export const TemperatureDisplay = React.memo<TemperatureDisplayProps>(
  ({ current, target }) => {
    // Render logic
  }
);
```

**Expected Impact**:
- 60% reduction in re-renders for temperature components
- Smoother slider interactions (60fps maintained)

### 9.2 Callback Memoization

**Strategy**: Use `useCallback` for event handlers to prevent child re-renders

```typescript
const AirConditionerDevice = ({ deviceId, roomId }) => {
  const controls = useAirConditionerControls(deviceId, roomId);

  // Memoize callbacks to prevent child re-renders
  const handleTemperatureChange = useCallback(
    (temp: number) => controls.setTemperature(temp),
    [controls.setTemperature]
  );

  const handleModeChange = useCallback(
    (mode: string) => controls.setMode(mode),
    [controls.setMode]
  );

  return (
    <div>
      <TemperatureSlider onChange={handleTemperatureChange} />
      <ModeSelector onChange={handleModeChange} />
    </div>
  );
};
```

### 9.3 State Selector Optimization

**Strategy**: Use specific Zustand selectors to prevent unnecessary re-renders

```typescript
// ❌ BAD: Re-renders on ANY store change
const state = useAirconStore();

// ✅ GOOD: Only re-renders when specific room state changes
const roomState = useAirconStore(
  useCallback(
    (state) => state.rooms[roomId],
    [roomId]
  )
);

// ✅ BEST: Use shallow comparison for multiple values
const { temperature, mode } = useAirconStore(
  useShallow((state) => ({
    temperature: state.rooms[roomId]?.temperature,
    mode: state.rooms[roomId]?.mode,
  }))
);
```

### 9.4 Animation Performance

**Strategy**: Use CSS transforms and GPU acceleration

```typescript
// Expand/collapse animation optimized
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{
    duration: 0.2,
    ease: 'easeInOut',
  }}
  style={{
    transform: 'translateZ(0)', // Force GPU acceleration
    willChange: 'height, opacity', // Hint browser for optimization
  }}
>
  {children}
</motion.div>
```

### 9.5 Code Splitting

**Strategy**: Lazy load device components to reduce initial bundle size

```typescript
// DeviceFactory.tsx - lazy load devices
const AirConditionerDevice = React.lazy(() =>
  import('./air-conditioner/AirConditionerDevice')
);

const LightingDevice = React.lazy(() =>
  import('./lighting/LightingDevice')
);

const DeviceFactory = ({ device }) => {
  const Component = DEVICE_COMPONENTS[device.type];

  return (
    <Suspense fallback={<DeviceLoadingSkeleton />}>
      <Component {...device} />
    </Suspense>
  );
};
```

**Expected Impact**:
- 40% reduction in initial bundle size
- Faster page load (devices loaded on demand)

---

## 10. Testing Strategy

### 10.1 Test Coverage Goals

| Component Type | Target Coverage | Test Types |
|---------------|-----------------|------------|
| Hooks | 100% | Unit tests |
| Utilities | 100% | Unit tests |
| Components | 80% | Unit + Integration |
| DeviceFactory | 100% | Integration tests |
| E2E flows | 60% | Cypress/Playwright |

### 10.2 Unit Test Examples

**Hook Testing**:
```typescript
// useAirConditionerState.test.ts
import { renderHook } from '@testing-library/react';
import { useAirConditionerState } from './useAirConditionerState';

describe('useAirConditionerState', () => {
  it('returns undefined when room not found', () => {
    const { result } = renderHook(() =>
      useAirConditionerState('unknown', 'unknown')
    );

    expect(result.current).toBeUndefined();
  });

  it('extracts state correctly', () => {
    const { result } = renderHook(() =>
      useAirConditionerState('device1', 'room1')
    );

    expect(result.current).toMatchObject({
      temperature: expect.any(Number),
      mode: expect.any(String),
      fan: expect.any(String),
      isActive: expect.any(Boolean),
    });
  });

  it('updates when room state changes', () => {
    const { result, rerender } = renderHook(() =>
      useAirConditionerState('device1', 'room1')
    );

    const initialTemp = result.current?.temperature;

    // Simulate MQTT update
    act(() => {
      updateRoomTemperature('room1', 25);
    });

    rerender();

    expect(result.current?.temperature).toBe(25);
    expect(result.current?.temperature).not.toBe(initialTemp);
  });
});
```

**Component Testing**:
```typescript
// TemperatureSlider.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemperatureSlider } from './TemperatureSlider';

describe('TemperatureSlider', () => {
  it('renders current temperature', () => {
    render(<TemperatureSlider value={24} onChange={jest.fn()} />);
    expect(screen.getByRole('slider')).toHaveValue('24');
  });

  it('calls onChange when slider moved', async () => {
    const handleChange = jest.fn();
    render(<TemperatureSlider value={24} onChange={handleChange} />);

    const slider = screen.getByRole('slider');
    await userEvent.click(slider);
    await userEvent.keyboard('{ArrowRight}');

    expect(handleChange).toHaveBeenCalledWith(25);
  });

  it('respects min/max bounds', () => {
    render(<TemperatureSlider value={16} onChange={jest.fn()} min={16} max={31} />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '16');
    expect(slider).toHaveAttribute('max', '31');
  });
});
```

### 10.3 Integration Test Examples

**DeviceFactory Integration**:
```typescript
// DeviceFactory.integration.test.tsx
describe('DeviceFactory Integration', () => {
  it('renders AC device with full functionality', async () => {
    render(
      <DeviceFactory
        device={{
          type: 'air-conditioner',
          id: 'ac1',
          name: 'Living Room AC',
          roomId: 'room1',
        }}
      />
    );

    // Verify rendering
    expect(screen.getByText('Living Room AC')).toBeInTheDocument();

    // Verify temperature control
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();

    // Verify mode buttons
    expect(screen.getByText('Heat')).toBeInTheDocument();
    expect(screen.getByText('Cool')).toBeInTheDocument();

    // Test interaction
    await userEvent.click(screen.getByText('Cool'));

    // Verify MQTT message sent (mock)
    expect(mockMqttClient.publish).toHaveBeenCalledWith(
      'mitsubishi2mqtt/room1/mode/set',
      'cool'
    );
  });

  it('renders placeholder for unknown device type', () => {
    render(
      <DeviceFactory
        device={{
          type: 'unknown' as any,
          id: 'device1',
          name: 'Unknown Device',
          roomId: 'room1',
        }}
      />
    );

    expect(screen.getByText(/Unknown device type/)).toBeInTheDocument();
  });
});
```

---

## 11. Documentation Requirements

### 11.1 Component Documentation

**All components must include**:
1. JSDoc description
2. Props documentation
3. Usage examples
4. Related components

**Example**:
```typescript
/**
 * Base device card component providing common layout and behavior for all devices.
 *
 * Handles:
 * - Expand/collapse animation
 * - Connection status display
 * - Common card styling
 * - Error boundaries
 *
 * @example
 * ```tsx
 * <BaseDeviceCard
 *   deviceName="Living Room AC"
 *   deviceType="air-conditioner"
 *   connectionStatus="connected"
 *   isExpanded={true}
 *   onExpandToggle={() => setExpanded(!expanded)}
 * >
 *   <AirConditionerDevice />
 * </BaseDeviceCard>
 * ```
 *
 * @see DeviceCardHeader - Card header component
 * @see DeviceCardContent - Card content wrapper
 * @see DeviceCardFooter - Card footer component
 */
export const BaseDeviceCard: React.FC<BaseDeviceCardProps> = ({ ... }) => {
  // Implementation
};
```

### 11.2 Storybook Stories

**All components must have Storybook stories**:

```typescript
// BaseDeviceCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { BaseDeviceCard } from './BaseDeviceCard';

const meta: Meta<typeof BaseDeviceCard> = {
  title: 'Devices/Base/BaseDeviceCard',
  component: BaseDeviceCard,
  tags: ['autodocs'],
  argTypes: {
    connectionStatus: {
      control: 'select',
      options: ['connected', 'disconnected', 'connecting'],
    },
    deviceType: {
      control: 'select',
      options: ['air-conditioner', 'lighting', 'sensor'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseDeviceCard>;

export const Expanded: Story = {
  args: {
    deviceName: 'Living Room AC',
    deviceType: 'air-conditioner',
    connectionStatus: 'connected',
    isExpanded: true,
    children: <div>Device content here</div>,
  },
};

export const Collapsed: Story = {
  args: {
    ...Expanded.args,
    isExpanded: false,
  },
};

export const Disconnected: Story = {
  args: {
    ...Expanded.args,
    connectionStatus: 'disconnected',
  },
};
```

---

## 12. Implementation Timeline

### 12.1 Detailed Schedule

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Extract utilities | 1-2 hours | None |
| **Phase 2** | Build base components | 2-3 hours | Phase 1 |
| **Phase 3** | Create hooks | 2-3 hours | Phase 1 |
| **Phase 4** | Build AC device | 2-3 hours | Phase 2, 3 |
| **Phase 5** | Create factory | 1-2 hours | Phase 4 |
| **Phase 6** | Migration | 1 hour | Phase 5 |
| **Testing** | Unit + Integration tests | 2-3 hours | All phases |
| **Documentation** | Storybook + JSDoc | 1 hour | All phases |

**Total Estimated Effort**: 12-18 hours

### 12.2 Milestones

- [ ] **M1: Utilities Extracted** (2 hours)
  - All icon/color/formatter functions in utils
  - AirConRemote using new utils
  - Tests passing

- [ ] **M2: Base Components Built** (4-5 hours)
  - BaseDeviceCard, Header, Content, Footer complete
  - Storybook stories created
  - Visual regression tests passing

- [ ] **M3: Hooks Implemented** (6-8 hours)
  - All three hooks complete with tests
  - 100% hook coverage

- [ ] **M4: AC Device Complete** (8-11 hours)
  - AirConditionerDevice using base + hooks
  - All AC controls working
  - Tests passing

- [ ] **M5: Factory Ready** (9-13 hours)
  - DeviceFactory complete
  - Placeholder devices created
  - Integration tests passing

- [ ] **M6: Migration Complete** (10-14 hours)
  - Feature flag deployed
  - New components in production
  - Old AirConRemote removed

- [ ] **M7: Documentation Complete** (11-15 hours)
  - All components documented
  - Storybook complete
  - README updated

---

## 13. Risk Assessment and Mitigation

### 13.1 Technical Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|------------|------------|-------|
| **State management complexity** | High | Medium | Use device-specific hooks to isolate state logic | Developer |
| **Performance regression** | High | Low | React.memo, profiling, benchmark tests | Developer |
| **Breaking MQTT integration** | Critical | Low | Keep MQTT client unchanged, test thoroughly | Developer |
| **Incomplete migration** | High | Low | Feature flag, gradual rollout, monitoring | Developer |

### 13.2 Architecture Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|------------|------------|-------|
| **Over-abstraction** | Medium | Medium | Follow YAGNI, only implement current needs | Developer |
| **Tight coupling** | Medium | Low | DIP - depend on abstractions (hooks) | Developer |
| **Interface bloat** | Low | Low | ISP - segregate interfaces by device type | Developer |

### 13.3 Process Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|------------|------------|-------|
| **Scope creep** | Medium | High | Strict adherence to spec, defer non-essentials | Developer + User |
| **Timeline overrun** | Medium | Medium | Phased rollout, can ship incrementally | Developer |
| **Insufficient testing** | High | Low | 80% coverage requirement, automated tests | Developer |

---

## 14. Success Metrics

### 14.1 Code Quality Metrics

| Metric | Target | Measurement | Validation |
|--------|--------|-------------|------------|
| **Lines of Code** | -30% (645 → 450) | File line counts | `wc -l` |
| **Code Duplication** | < 3% | SonarQube | Automated analysis |
| **Cyclomatic Complexity** | < 10 per function | ESLint | CI/CD check |
| **Component Coupling** | < 5 dependencies | Madge | Dependency graph |
| **Test Coverage** | > 80% | Jest coverage | CI/CD check |

### 14.2 Performance Metrics

| Metric | Target | Measurement | Validation |
|--------|--------|-------------|------------|
| **Render Time** | < 16ms (60fps) | React DevTools Profiler | Manual testing |
| **State Update Latency** | < 50ms | Performance API | Automated tests |
| **Bundle Size** | -40% initial | Webpack Bundle Analyzer | Build analysis |
| **Memory Leaks** | 0 leaks | Chrome DevTools | Manual testing |

### 14.3 Developer Experience Metrics

| Metric | Target | Measurement | Validation |
|--------|--------|-------------|------------|
| **New Device Time** | < 2 hours | Time tracking | Developer feedback |
| **Bug Fix Time** | -50% | Git commit timestamps | Before/after comparison |
| **Component Reusability** | > 70% | Code analysis | Manual review |

---

## 15. Appendix

### 15.1 Alternative Architectures Considered

**Option A: Monolithic with Conditionals** (REJECTED)
- Keep single AirConRemote, add if/else for device types
- **Rejected**: Violates SRP, OCP, becomes unmaintainable

**Option B: Higher-Order Components** (REJECTED)
- Use HOCs for common behavior
- **Rejected**: Wrapper hell, less readable than hooks

**Option C: Render Props** (REJECTED)
- Use render props for customization
- **Rejected**: Verbose, callback hell, hooks are cleaner

**Option D: Compound Components** (CONSIDERED)
- Use dot notation for card sections (Card.Header, Card.Content)
- **Deferred**: Good pattern, but adds complexity - can add later

### 15.2 Future Enhancements

**Short-term (1-3 months)**:
- Full Lighting device implementation
- Full Sensor device implementation
- Device grouping functionality
- Quick scenes (e.g., "Movie Mode", "Sleep Mode")

**Medium-term (3-6 months)**:
- Device automation and scheduling
- Energy monitoring per device
- Historical data visualization
- Multi-device control (bulk operations)

**Long-term (6-12 months)**:
- Voice control integration
- Predictive maintenance alerts
- Machine learning for optimization
- Mobile app with same device architecture

### 15.3 References

**Design Patterns**:
- "Design Patterns: Elements of Reusable Object-Oriented Software" - Gang of Four
- "Refactoring" - Martin Fowler
- "Clean Code" - Robert C. Martin

**React Patterns**:
- React Official Docs - Patterns
- Kent C. Dodds - Advanced React Patterns
- Josh Comeau - React Performance

**SOLID Principles**:
- "Agile Principles, Patterns, and Practices in C#" - Robert C. Martin
- "Clean Architecture" - Robert C. Martin

---

**Document Status**: READY FOR REVIEW
**Created**: 2025-10-03
**Last Updated**: 2025-10-03
**Version**: 1.0
**Next Step**: Review and approve design, then create implementation plan (implementation.md)
