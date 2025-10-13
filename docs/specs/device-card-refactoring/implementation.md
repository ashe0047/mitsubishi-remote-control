# Device Card Refactoring - Implementation Plan

## 1. Executive Summary

### 1.1 Implementation Overview
This document provides the step-by-step implementation plan for refactoring the 645-line `AirConRemote` component into a modular device card architecture. The plan follows the phased rollout strategy defined in the design document, ensuring zero-risk migration.

### 1.2 Implementation Phases
1. **Phase 1**: Extract utilities (1-2 hours) - Zero risk
2. **Phase 2**: Create base components (2-3 hours) - Low risk
3. **Phase 3**: Build hooks (2-3 hours) - Low risk
4. **Phase 4**: Create AirConditionerDevice (2-3 hours) - Medium risk
5. **Phase 5**: Implement DeviceFactory (1-2 hours) - Low risk
6. **Phase 6**: Migration and cleanup (1 hour) - Controlled risk

### 1.3 Prerequisites
- ✅ Requirements specification approved (spec.md)
- ✅ Technical design approved (design.md)
- ✅ Development environment ready
- ✅ Git feature branch created
- ✅ Test environment configured

---

## 2. Phase 1: Extract Utilities (Zero Risk)

### 2.1 Objective
Extract reusable utility functions from `AirConRemote` to eliminate code duplication and prepare for modular architecture.

### 2.2 Duration
**Estimated**: 1-2 hours

### 2.3 Tasks

#### Task 1.1: Create Utility Directory Structure
```bash
mkdir -p frontend/src/utils/devices
touch frontend/src/utils/devices/device-icons.ts
touch frontend/src/utils/devices/device-colors.ts
touch frontend/src/utils/devices/device-formatters.ts
touch frontend/src/utils/devices/temperature.ts
touch frontend/src/utils/devices/index.ts
```

#### Task 1.2: Extract Icon Mapping (`device-icons.ts`)
**Source**: Lines 206-221 in `AirConRemote.tsx`

```typescript
import {
  Sun,
  Snowflake,
  Droplets,
  Fan,
  Wind,
  Power,
  type LucideIcon,
} from 'lucide-react';
import { MODE_VALUES } from '@/lib/mqtt/mqtt-config';

export const getModeIcon = (mode: string): LucideIcon => {
  const iconMap: Record<string, LucideIcon> = {
    [MODE_VALUES.HEAT]: Sun,
    [MODE_VALUES.COOL]: Snowflake,
    [MODE_VALUES.DRY]: Droplets,
    [MODE_VALUES.FAN_ONLY]: Fan,
    [MODE_VALUES.HEAT_COOL]: Wind,
  };

  return iconMap[mode] || Power;
};

export const getFanIcon = (fan: string): LucideIcon => {
  // Add fan icon mapping when needed
  return Fan;
};
```

**Validation**: ✅ No logic changes, pure extraction

#### Task 1.3: Extract Color Mapping (`device-colors.ts`)
**Source**: Lines 240-258 in `AirConRemote.tsx`

```typescript
import { MODE_VALUES } from '@/lib/mqtt/mqtt-config';

export const getModeColor = (mode: string): string => {
  const colorMap: Record<string, string> = {
    [MODE_VALUES.HEAT]: 'bg-orange-500 text-white hover:bg-orange-600',
    [MODE_VALUES.COOL]: 'bg-blue-500 text-white hover:bg-blue-600',
    [MODE_VALUES.DRY]: 'bg-teal-500 text-white hover:bg-teal-600',
    [MODE_VALUES.FAN_ONLY]: 'bg-gray-500 text-white hover:bg-gray-600',
    [MODE_VALUES.HEAT_COOL]: 'bg-purple-500 text-white hover:bg-purple-600',
  };

  return colorMap[mode] || 'bg-gray-400 text-white hover:bg-gray-500';
};

export const getModeTextColor = (mode: string): string => {
  const colorMap: Record<string, string> = {
    [MODE_VALUES.HEAT]: 'text-orange-600 dark:text-orange-400',
    [MODE_VALUES.COOL]: 'text-blue-600 dark:text-blue-400',
    [MODE_VALUES.DRY]: 'text-teal-600 dark:text-teal-400',
    [MODE_VALUES.FAN_ONLY]: 'text-gray-600 dark:text-gray-400',
    [MODE_VALUES.HEAT_COOL]: 'text-purple-600 dark:text-purple-400',
  };

  return colorMap[mode] || 'text-gray-600 dark:text-gray-400';
};
```

**Validation**: ✅ Pure functions, no side effects

#### Task 1.4: Extract Display Formatters (`device-formatters.ts`)
**Source**: Lines 187-238 in `AirConRemote.tsx`

```typescript
import { FAN_VALUES, MODE_VALUES } from '@/lib/mqtt/mqtt-config';

export const getFanDisplayName = (fan: string): string => {
  const displayMap: Record<string, string> = {
    [FAN_VALUES.AUTO]: 'Auto',
    [FAN_VALUES.ONE]: 'Low',
    [FAN_VALUES.TWO]: 'Middle',
    [FAN_VALUES.THREE]: 'Medium',
    [FAN_VALUES.FOUR]: 'High',
    [FAN_VALUES.QUIET]: 'Quiet',
  };

  return displayMap[fan] || fan;
};

export const getModeDisplayName = (mode: string): string => {
  const displayMap: Record<string, string> = {
    [MODE_VALUES.HEAT]: 'Heat',
    [MODE_VALUES.COOL]: 'Cool',
    [MODE_VALUES.DRY]: 'Dry',
    [MODE_VALUES.FAN_ONLY]: 'Fan',
    [MODE_VALUES.HEAT_COOL]: 'Auto',
    [MODE_VALUES.OFF]: 'Off',
  };

  return displayMap[mode] || mode;
};
```

**Validation**: ✅ Pure mapping functions

#### Task 1.5: Extract Temperature Utils (`temperature.ts`)
**Source**: Lines 176-178 in `AirConRemote.tsx`

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

export const getTemperatureColor = (temp: number): string => {
  if (temp <= 18) return 'text-blue-600 dark:text-blue-400';
  if (temp <= 22) return 'text-green-600 dark:text-green-400';
  if (temp <= 26) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};
```

**Validation**: ✅ Pure calculation functions

#### Task 1.6: Create Barrel Export (`index.ts`)

```typescript
export * from './device-icons';
export * from './device-colors';
export * from './device-formatters';
export * from './temperature';
```

#### Task 1.7: Update AirConRemote Imports

**Before**:
```typescript
// Lines 187-258 - Functions defined inline
const getFanTooltipDisplay = (fan: string) => { /* ... */ };
const getModeIcon = (mode: string) => { /* ... */ };
const getModeTooltipDisplay = (mode: string) => { /* ... */ };
const getModeColor = (mode: string) => { /* ... */ };
```

**After**:
```typescript
import {
  getFanDisplayName,
  getModeIcon,
  getModeDisplayName,
  getModeColor,
  getModeTextColor,
  displayTemperature,
  getTemperatureColor,
} from '@/utils/devices';
```

### 2.4 Validation Checklist
- [ ] All utility files created
- [ ] All functions extracted from AirConRemote
- [ ] Imports updated in AirConRemote
- [ ] No linting errors (`pnpm lint`)
- [ ] No type errors (`pnpm type-check`)
- [ ] Existing AC functionality unchanged
- [ ] Git commit: `feat: extract device utilities for reusability`

### 2.5 Rollback Plan
If issues arise, revert the commit:
```bash
git revert HEAD
```

---

## 3. Phase 2: Create Base Components (Low Risk)

### 3.1 Objective
Build reusable base components that provide common device card layout and behavior.

### 3.2 Duration
**Estimated**: 2-3 hours

### 3.3 Tasks

#### Task 2.1: Create Component Directory Structure
```bash
mkdir -p frontend/src/components/devices/base
touch frontend/src/components/devices/base/BaseDeviceCard.tsx
touch frontend/src/components/devices/base/DeviceCardHeader.tsx
touch frontend/src/components/devices/base/DeviceCardContent.tsx
touch frontend/src/components/devices/base/DeviceCardFooter.tsx
touch frontend/src/components/devices/base/ConnectionStatusBadge.tsx
touch frontend/src/components/devices/base/index.ts
```

#### Task 2.2: Implement ConnectionStatusBadge Component

**File**: `frontend/src/components/devices/base/ConnectionStatusBadge.tsx`

```typescript
"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  className,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          label: 'Disconnected',
          variant: 'destructive' as const,
          className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        };
      case 'connecting':
        return {
          icon: Loader2,
          label: 'Connecting',
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'connecting' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
};
```

**Lines**: ~55
**Dependencies**: Badge, lucide-react, cn utility
**Validation**: ✅ Pure presentational component

#### Task 2.3: Implement DeviceCardHeader Component

**File**: `frontend/src/components/devices/base/DeviceCardHeader.tsx`

```typescript
"use client";

import React from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge, type ConnectionStatus } from './ConnectionStatusBadge';
import { cn } from '@/lib/utils';

export interface DeviceCardHeaderProps {
  deviceName: string;
  deviceType: string;
  connectionStatus: ConnectionStatus;
  isExpanded: boolean;
  onExpandToggle?: () => void;
  actions?: React.ReactNode;
}

export const DeviceCardHeader: React.FC<DeviceCardHeaderProps> = ({
  deviceName,
  deviceType,
  connectionStatus,
  isExpanded,
  onExpandToggle,
  actions,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{deviceName}</h3>
          <p className="text-xs text-muted-foreground capitalize">{deviceType.replace('-', ' ')}</p>
        </div>
        <ConnectionStatusBadge status={connectionStatus} />
      </div>

      <div className="flex items-center gap-2 ml-4">
        {actions}
        {onExpandToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpandToggle}
            className="h-8 w-8 p-0"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
            />
          </Button>
        )}
      </div>
    </div>
  );
};
```

**Lines**: ~50
**Validation**: ✅ Presentational with clear props

#### Task 2.4: Implement DeviceCardContent Component

**File**: `frontend/src/components/devices/base/DeviceCardContent.tsx`

```typescript
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface DeviceCardContentProps {
  children: React.ReactNode;
  isExpanded: boolean;
  className?: string;
}

export const DeviceCardContent: React.FC<DeviceCardContentProps> = ({
  children,
  isExpanded,
  className,
}) => {
  return (
    <div className={cn('p-4', !isExpanded && 'hidden', className)}>
      {children}
    </div>
  );
};
```

**Lines**: ~20
**Validation**: ✅ Simple wrapper component

#### Task 2.5: Implement DeviceCardFooter Component

**File**: `frontend/src/components/devices/base/DeviceCardFooter.tsx`

```typescript
"use client";

import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DeviceCardFooterProps {
  lastUpdated?: Date;
  actions?: React.ReactNode;
  metadata?: Record<string, string>;
  className?: string;
}

export const DeviceCardFooter: React.FC<DeviceCardFooterProps> = ({
  lastUpdated,
  actions,
  metadata,
  className,
}) => {
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (!lastUpdated && !actions && !metadata) return null;

  return (
    <div className={cn('flex items-center justify-between px-4 py-2 border-t bg-muted/20', className)}>
      {lastUpdated && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatLastUpdated(lastUpdated)}</span>
        </div>
      )}

      {metadata && (
        <div className="flex gap-2">
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key} className="text-xs text-muted-foreground">
              {key}: {value}
            </span>
          ))}
        </div>
      )}

      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
};
```

**Lines**: ~50
**Validation**: ✅ Presentational with formatting logic

#### Task 2.6: Implement BaseDeviceCard Component

**File**: `frontend/src/components/devices/base/BaseDeviceCard.tsx`

```typescript
"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceCardHeader } from './DeviceCardHeader';
import { DeviceCardContent } from './DeviceCardContent';
import { DeviceCardFooter } from './DeviceCardFooter';
import type { ConnectionStatus } from './ConnectionStatusBadge';

export interface BaseDeviceCardProps {
  children: React.ReactNode;
  deviceName: string;
  deviceType: string;
  connectionStatus: ConnectionStatus;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  lastUpdated?: Date;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  metadata?: Record<string, string>;
}

export const BaseDeviceCard: React.FC<BaseDeviceCardProps> = ({
  children,
  deviceName,
  deviceType,
  connectionStatus,
  isExpanded = false,
  onExpandToggle,
  lastUpdated,
  headerActions,
  footerActions,
  metadata,
}) => {
  return (
    <Card className="overflow-hidden shadow-none">
      <DeviceCardHeader
        deviceName={deviceName}
        deviceType={deviceType}
        connectionStatus={connectionStatus}
        isExpanded={isExpanded}
        onExpandToggle={onExpandToggle}
        actions={headerActions}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <DeviceCardContent isExpanded={isExpanded}>
              {children}
            </DeviceCardContent>
          </motion.div>
        )}
      </AnimatePresence>

      <DeviceCardFooter
        lastUpdated={lastUpdated}
        actions={footerActions}
        metadata={metadata}
      />
    </Card>
  );
};
```

**Lines**: ~60
**Validation**: ✅ Composition pattern, clean props

#### Task 2.7: Create Barrel Export

**File**: `frontend/src/components/devices/base/index.ts`

```typescript
export { BaseDeviceCard, type BaseDeviceCardProps } from './BaseDeviceCard';
export { DeviceCardHeader, type DeviceCardHeaderProps } from './DeviceCardHeader';
export { DeviceCardContent, type DeviceCardContentProps } from './DeviceCardContent';
export { DeviceCardFooter, type DeviceCardFooterProps } from './DeviceCardFooter';
export { ConnectionStatusBadge, type ConnectionStatusBadgeProps, type ConnectionStatus } from './ConnectionStatusBadge';
```

### 3.4 Validation Checklist
- [ ] All base components created
- [ ] No linting errors
- [ ] No type errors
- [ ] Components render in Storybook (optional)
- [ ] Git commit: `feat: create base device card components`

### 3.5 Rollback Plan
Revert commit - no impact on app as components not yet used:
```bash
git revert HEAD
```

---

## 4. Phase 3: Build Hooks (Low Risk)

### 4.1 Objective
Extract business logic from AirConRemote into reusable hooks.

### 4.2 Duration
**Estimated**: 2-3 hours

### 4.3 Tasks

#### Task 3.1: Create Hooks Directory Structure
```bash
mkdir -p frontend/src/hooks/devices
touch frontend/src/hooks/devices/useAirConditionerState.ts
touch frontend/src/hooks/devices/useAirConditionerControls.ts
touch frontend/src/hooks/devices/useDevicePreferences.ts
touch frontend/src/hooks/devices/index.ts
```

#### Task 3.2: Implement useAirConditionerState Hook

**File**: `frontend/src/hooks/devices/useAirConditionerState.ts`

**Source**: Extract from lines 54-62 in AirConRemote

```typescript
import { useMemo } from 'react';
import { useAirconContext } from '@/hooks/useAircon';
import { MODE_VALUES } from '@/lib/mqtt/mqtt-config';

export interface AirConditionerState {
  temperature: number;
  mode: string;
  fan: string;
  isActive: boolean;
  currentTemp?: number;
  vane?: string;
  wideVane?: string;
}

export const useAirConditionerState = (
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
      vane: roomInfo.state.vane,
      wideVane: roomInfo.state.wideVane,
    };
  }, [roomInfo]);
};
```

**Lines**: ~35
**Validation**: ✅ Pure hook, no side effects

#### Task 3.3: Implement useAirConditionerControls Hook

**File**: `frontend/src/hooks/devices/useAirConditionerControls.ts`

**Source**: Extract from lines 105-174 in AirConRemote

```typescript
import { useCallback, useMemo } from 'react';
import { useAirconContext } from '@/hooks/useAircon';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobile } from '@/hooks/useMobile';
import { MODE_VALUES, FAN_VALUES } from '@/lib/mqtt/mqtt-config';
import { useAirConditionerState } from './useAirConditionerState';

export interface AirConditionerControls {
  setTemperature: (temp: number) => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  setFan: (fan: string) => Promise<void>;
  togglePower: () => Promise<void>;
  incrementTemperature: () => Promise<void>;
  decrementTemperature: () => Promise<void>;
}

export const useAirConditionerControls = (
  roomId: string
): AirConditionerControls => {
  const { setTemperature: setTempApi, setMode: setModeApi, setFan: setFanApi } = useAirconContext();
  const state = useAirConditionerState(roomId);
  const isMobile = useMobile();
  const triggerHaptic = useHaptic(isMobile);

  const setTemperature = useCallback(
    async (temp: number) => {
      try {
        await setTempApi(roomId, temp);
        triggerHaptic(30);
      } catch (error) {
        console.error('Failed to set temperature:', error);
      }
    },
    [roomId, setTempApi, triggerHaptic]
  );

  const setMode = useCallback(
    async (mode: string) => {
      try {
        await setModeApi(roomId, mode);
        triggerHaptic(50);
      } catch (error) {
        console.error('Failed to set mode:', error);
      }
    },
    [roomId, setModeApi, triggerHaptic]
  );

  const setFan = useCallback(
    async (fan: string) => {
      try {
        await setFanApi(roomId, fan);
        triggerHaptic(30);
      } catch (error) {
        console.error('Failed to set fan:', error);
      }
    },
    [roomId, setFanApi, triggerHaptic]
  );

  const togglePower = useCallback(
    async () => {
      if (!state) return;
      const newMode = state.isActive ? MODE_VALUES.OFF : MODE_VALUES.COOL;
      try {
        await setModeApi(roomId, newMode);
        triggerHaptic(100);
      } catch (error) {
        console.error('Failed to toggle power:', error);
      }
    },
    [state, roomId, setModeApi, triggerHaptic]
  );

  const incrementTemperature = useCallback(
    async () => {
      if (!state) return;
      const newTemp = Math.min(state.temperature + 1, 31);
      await setTemperature(newTemp);
    },
    [state, setTemperature]
  );

  const decrementTemperature = useCallback(
    async () => {
      if (!state) return;
      const newTemp = Math.max(state.temperature - 1, 16);
      await setTemperature(newTemp);
    },
    [state, setTemperature]
  );

  return useMemo(
    () => ({
      setTemperature,
      setMode,
      setFan,
      togglePower,
      incrementTemperature,
      decrementTemperature,
    }),
    [setTemperature, setMode, setFan, togglePower, incrementTemperature, decrementTemperature]
  );
};
```

**Lines**: ~100
**Validation**: ✅ Business logic extracted, dependencies clear

#### Task 3.4: Implement useDevicePreferences Hook

**File**: `frontend/src/hooks/devices/useDevicePreferences.ts`

**Source**: Extract from lines 102, 177-184 in AirConRemote

```typescript
import { useCallback } from 'react';
import useAirConPreferences from '@/hooks/usePrefs';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobile } from '@/hooks/useMobile';

export interface DevicePreferences {
  useFahrenheit: boolean;
  sleepMode: boolean;
  toggleTemperatureUnit: () => void;
  toggleSleepMode: () => void;
}

export const useDevicePreferences = (): DevicePreferences => {
  const [prefs, setPrefs] = useAirConPreferences();
  const isMobile = useMobile();
  const triggerHaptic = useHaptic(isMobile);

  const toggleTemperatureUnit = useCallback(() => {
    setPrefs((prev) => ({ ...prev, useFahrenheit: !prev.useFahrenheit }));
    triggerHaptic(30);
  }, [setPrefs, triggerHaptic]);

  const toggleSleepMode = useCallback(() => {
    setPrefs((prev) => ({ ...prev, sleepMode: !prev.sleepMode }));
    triggerHaptic(50);
  }, [setPrefs, triggerHaptic]);

  return {
    useFahrenheit: prefs.useFahrenheit,
    sleepMode: prefs.sleepMode,
    toggleTemperatureUnit,
    toggleSleepMode,
  };
};
```

**Lines**: ~35
**Validation**: ✅ Preferences abstraction

#### Task 3.5: Create Barrel Export

**File**: `frontend/src/hooks/devices/index.ts`

```typescript
export { useAirConditionerState, type AirConditionerState } from './useAirConditionerState';
export { useAirConditionerControls, type AirConditionerControls } from './useAirConditionerControls';
export { useDevicePreferences, type DevicePreferences } from './useDevicePreferences';
```

### 4.4 Validation Checklist
- [ ] All hooks created
- [ ] Hook unit tests written
- [ ] No linting errors
- [ ] No type errors
- [ ] Hooks tested independently
- [ ] Git commit: `feat: create device control hooks`

### 4.5 Testing

**Hook Tests**: `frontend/src/hooks/devices/__tests__/useAirConditionerControls.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAirConditionerControls } from '../useAirConditionerControls';

// Mock dependencies
jest.mock('@/hooks/useAircon');
jest.mock('@/hooks/useHaptic');
jest.mock('@/hooks/useMobile');

describe('useAirConditionerControls', () => {
  it('provides temperature control functions', () => {
    const { result } = renderHook(() => useAirConditionerControls('room1'));

    expect(result.current).toHaveProperty('setTemperature');
    expect(result.current).toHaveProperty('setMode');
    expect(result.current).toHaveProperty('setFan');
    expect(result.current).toHaveProperty('togglePower');
  });

  it('calls API with correct parameters', async () => {
    const mockSetTemp = jest.fn();
    jest.mocked(useAirconContext).mockReturnValue({
      setTemperature: mockSetTemp,
    });

    const { result } = renderHook(() => useAirConditionerControls('room1'));

    await act(async () => {
      await result.current.setTemperature(24);
    });

    expect(mockSetTemp).toHaveBeenCalledWith('room1', 24);
  });
});
```

### 4.6 Rollback Plan
Revert commit - hooks not yet used in app:
```bash
git revert HEAD
```

---

## 5. Phase 4: Create AirConditionerDevice (Medium Risk)

### 5.1 Objective
Build new AirConditionerDevice component using base components and hooks.

### 5.2 Duration
**Estimated**: 2-3 hours

### 5.3 Tasks

#### Task 4.1: Create AC Component Directory
```bash
mkdir -p frontend/src/components/devices/air-conditioner
touch frontend/src/components/devices/air-conditioner/AirConditionerDevice.tsx
touch frontend/src/components/devices/air-conditioner/TemperatureDisplay.tsx
touch frontend/src/components/devices/air-conditioner/TemperatureControls.tsx
touch frontend/src/components/devices/air-conditioner/ModeSelector.tsx
touch frontend/src/components/devices/air-conditioner/FanControl.tsx
touch frontend/src/components/devices/air-conditioner/PowerButton.tsx
touch frontend/src/components/devices/air-conditioner/index.ts
```

#### Task 4.2: Implement Small Control Components

**TemperatureDisplay.tsx** (~30 lines):
```typescript
"use client";

import React from 'react';
import { Thermometer } from 'lucide-react';
import { displayTemperature, getTemperatureColor } from '@/utils/devices';
import { cn } from '@/lib/utils';

export interface TemperatureDisplayProps {
  current?: number;
  target: number;
  useFahrenheit?: boolean;
}

export const TemperatureDisplay = React.memo<TemperatureDisplayProps>(
  ({ current, target, useFahrenheit = false }) => {
    return (
      <div className="flex items-center justify-between">
        {current !== undefined && (
          <div className="flex items-center gap-2">
            <Thermometer className={cn('h-4 w-4', getTemperatureColor(current))} />
            <span className={cn('text-sm font-medium', getTemperatureColor(current))}>
              {displayTemperature(current, useFahrenheit)}
            </span>
          </div>
        )}
        <div className="text-2xl font-bold">
          {displayTemperature(target, useFahrenheit)}
        </div>
      </div>
    );
  }
);

TemperatureDisplay.displayName = 'TemperatureDisplay';
```

**TemperatureControls.tsx** (~50 lines):
```typescript
"use client";

import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export interface TemperatureControlsProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export const TemperatureControls = React.memo<TemperatureControlsProps>(
  ({ value, min = 16, max = 31, onChange, onIncrement, onDecrement }) => {
    return (
      <div className="space-y-4">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={1}
          onValueChange={(values) => onChange(values[0])}
          className="w-full"
        />
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onDecrement}
            disabled={value <= min}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onIncrement}
            disabled={value >= max}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
);

TemperatureControls.displayName = 'TemperatureControls';
```

Continue implementation for ModeSelector, FanControl, PowerButton...

#### Task 4.3: Implement AirConditionerDevice Main Component

**File**: `frontend/src/components/devices/air-conditioner/AirConditionerDevice.tsx`

```typescript
"use client";

import React from 'react';
import { BaseDeviceCard } from '../base';
import { useAirConditionerState, useAirConditionerControls, useDevicePreferences } from '@/hooks/devices';
import { useConnectionStatus } from '@/hooks/navigation/useConnectionStatus';
import { TemperatureDisplay } from './TemperatureDisplay';
import { TemperatureControls } from './TemperatureControls';
import { ModeSelector } from './ModeSelector';
import { FanControl } from './FanControl';
import { PowerButton } from './PowerButton';

export interface AirConditionerDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export const AirConditionerDevice: React.FC<AirConditionerDeviceProps> = ({
  deviceId,
  deviceName,
  roomId,
  isExpanded = false,
  onExpandToggle,
}) => {
  const state = useAirConditionerState(roomId);
  const controls = useAirConditionerControls(roomId);
  const { useFahrenheit } = useDevicePreferences();
  const { status } = useConnectionStatus();

  if (!state) {
    return (
      <BaseDeviceCard
        deviceName={deviceName}
        deviceType="air-conditioner"
        connectionStatus={status}
        isExpanded={isExpanded}
        onExpandToggle={onExpandToggle}
      >
        <div className="text-center text-muted-foreground py-8">
          No data available
        </div>
      </BaseDeviceCard>
    );
  }

  return (
    <BaseDeviceCard
      deviceName={deviceName}
      deviceType="air-conditioner"
      connectionStatus={status}
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
      lastUpdated={new Date()}
    >
      <div className="space-y-6">
        {/* Temperature Display */}
        <TemperatureDisplay
          current={state.currentTemp}
          target={state.temperature}
          useFahrenheit={useFahrenheit}
        />

        {/* Temperature Controls */}
        <TemperatureControls
          value={state.temperature}
          onChange={controls.setTemperature}
          onIncrement={controls.incrementTemperature}
          onDecrement={controls.decrementTemperature}
        />

        {/* Mode Selector */}
        <ModeSelector
          current={state.mode}
          onChange={controls.setMode}
        />

        {/* Fan Control */}
        <FanControl
          current={state.fan}
          onChange={controls.setFan}
        />

        {/* Power Button */}
        <PowerButton
          isActive={state.isActive}
          onToggle={controls.togglePower}
        />
      </div>
    </BaseDeviceCard>
  );
};
```

**Lines**: ~85 (composition only)
**Validation**: ✅ Uses base components and hooks, no duplicate logic

### 5.4 Validation Checklist
- [ ] All AC components created
- [ ] Component renders correctly
- [ ] All controls functional
- [ ] No linting errors
- [ ] No type errors
- [ ] Git commit: `feat: create AirConditionerDevice component`

### 5.5 Rollback Plan
Component not yet used in app, can safely revert:
```bash
git revert HEAD
```

---

## 6. Phase 5: Implement DeviceFactory (Low Risk)

### 6.1 Objective
Create DeviceFactory component with device registry and placeholder devices.

### 6.2 Duration
**Estimated**: 1-2 hours

### 6.3 Tasks

#### Task 6.1: Create Device Type Definitions

**File**: `frontend/src/types/devices.ts`

```typescript
export type DeviceType = 'air-conditioner' | 'lighting' | 'sensor';

export interface BaseDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export interface DeviceConfig {
  type: DeviceType;
  id: string;
  name: string;
  roomId: string;
  config?: Record<string, any>;
}

export interface DeviceFactoryProps {
  device: DeviceConfig;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export type DeviceComponent = React.FC<BaseDeviceProps>;
```

#### Task 6.2: Create Placeholder Devices

**LightingDevice.tsx** (~30 lines):
```typescript
"use client";

import React from 'react';
import { BaseDeviceCard } from '../base';
import type { BaseDeviceProps } from '@/types/devices';

export const LightingDevice: React.FC<BaseDeviceProps> = ({
  deviceId,
  deviceName,
  roomId,
  isExpanded,
  onExpandToggle,
}) => {
  return (
    <BaseDeviceCard
      deviceName={deviceName}
      deviceType="lighting"
      connectionStatus="connected"
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
    >
      <div className="text-center text-muted-foreground py-8">
        Lighting controls coming soon
      </div>
    </BaseDeviceCard>
  );
};
```

**SensorDevice.tsx** - Similar placeholder

#### Task 6.3: Implement DeviceFactory

**File**: `frontend/src/components/devices/DeviceFactory.tsx`

```typescript
"use client";

import React from 'react';
import { AirConditionerDevice } from './air-conditioner';
import { LightingDevice } from './lighting';
import { SensorDevice } from './sensor';
import type { DeviceFactoryProps, DeviceComponent, DeviceType } from '@/types/devices';
import { Card } from '@/components/ui/card';

const DEVICE_COMPONENTS: Record<DeviceType, DeviceComponent> = {
  'air-conditioner': AirConditionerDevice,
  'lighting': LightingDevice,
  'sensor': SensorDevice,
} as const;

const FallbackDevice: React.FC<{ deviceName: string }> = ({ deviceName }) => (
  <Card className="p-4">
    <p className="text-muted-foreground text-center">
      Unknown device type: {deviceName}
    </p>
  </Card>
);

export const DeviceFactory: React.FC<DeviceFactoryProps> = ({
  device,
  isExpanded = false,
  onExpandToggle,
}) => {
  const Component = DEVICE_COMPONENTS[device.type];

  if (!Component) {
    return <FallbackDevice deviceName={device.name} />;
  }

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

**Lines**: ~40
**Validation**: ✅ Type-safe factory pattern

### 6.4 Validation Checklist
- [ ] DeviceFactory created
- [ ] All device types registered
- [ ] Placeholder devices created
- [ ] Factory tests passing
- [ ] Git commit: `feat: implement DeviceFactory with placeholders`

---

## 7. Phase 6: Migration and Cleanup

### 7.1 Objective
Migrate from old AirConRemote to new DeviceFactory using feature flag.

### 7.2 Duration
**Estimated**: 1 hour

### 7.3 Tasks

#### Task 7.1: Add Feature Flag

**File**: `frontend/src/lib/env/config.ts`

```typescript
export const USE_NEW_DEVICE_COMPONENTS = process.env.NEXT_PUBLIC_USE_NEW_DEVICES === 'true';
```

**File**: `.env.local`

```bash
NEXT_PUBLIC_USE_NEW_DEVICES=false
```

#### Task 7.2: Update Room Detail Page

**File**: `frontend/src/app/app/rooms/[roomId]/page.tsx`

```typescript
import { AirConRemote } from '@/components/AirConRemote'; // Old
import { DeviceFactory } from '@/components/devices/DeviceFactory'; // New
import { USE_NEW_DEVICE_COMPONENTS } from '@/lib/env/config';

// Inside component
{USE_NEW_DEVICE_COMPONENTS ? (
  <DeviceFactory
    device={{
      type: 'air-conditioner',
      id: roomId,
      name: roomName,
      roomId,
    }}
  />
) : (
  <AirConRemote room={{ roomId, roomName }} />
)}
```

#### Task 7.3: Gradual Rollout

**Step 1**: Deploy with flag OFF (default old component)
```bash
# Already OFF in .env.local
git commit -m "feat: add feature flag for new device components"
git push
```

**Step 2**: Enable in development
```bash
# Update .env.local
NEXT_PUBLIC_USE_NEW_DEVICES=true
# Test thoroughly
```

**Step 3**: Enable in staging
```bash
# Update staging env vars
# Monitor for issues
```

**Step 4**: Enable in production
```bash
# Update production env vars
# Monitor metrics
```

**Step 5**: Remove old component (after 1 week)
```bash
# Delete AirConRemote.tsx
# Remove feature flag
# Update imports
git commit -m "refactor: remove old AirConRemote component"
```

### 7.4 Validation Checklist
- [ ] Feature flag added
- [ ] Room page updated
- [ ] Old and new components work identically
- [ ] Flag tested in all states
- [ ] Deployed with flag OFF
- [ ] Gradual rollout successful
- [ ] Old component removed
- [ ] Git commit: `feat: complete migration to new device components`

---

## 8. Testing Checklist

### 8.1 Unit Tests
- [ ] All hooks tested (useAirConditionerState, useAirConditionerControls, useDevicePreferences)
- [ ] All utilities tested (icons, colors, formatters, temperature)
- [ ] Component tests for base components
- [ ] DeviceFactory tests

### 8.2 Integration Tests
- [ ] Full AC device flow (temp change, mode change, power toggle)
- [ ] DeviceFactory routing to correct components
- [ ] MQTT message flow end-to-end

### 8.3 Visual Tests
- [ ] Storybook stories for all components
- [ ] Visual regression tests (optional: Chromatic)
- [ ] Mobile responsive testing

### 8.4 Performance Tests
- [ ] Render performance (< 16ms)
- [ ] State update latency (< 50ms)
- [ ] Memory leak check
- [ ] Bundle size analysis

---

## 9. Documentation Checklist

### 9.1 Code Documentation
- [ ] JSDoc for all exported components
- [ ] JSDoc for all hooks
- [ ] JSDoc for all utilities
- [ ] Inline comments for complex logic

### 9.2 Storybook
- [ ] Stories for all base components
- [ ] Stories for AC components
- [ ] Stories for DeviceFactory
- [ ] Interactive controls (knobs)

### 9.3 README Updates
- [ ] Update architecture diagram
- [ ] Document device addition process
- [ ] Add troubleshooting guide
- [ ] Update component list

---

## 10. Rollback Procedures

### 10.1 Immediate Rollback (< 5 min)
```bash
# Toggle feature flag
NEXT_PUBLIC_USE_NEW_DEVICES=false

# Deploy config
npm run deploy:config
```

### 10.2 Git Rollback (< 10 min)
```bash
# Revert to previous commit
git revert HEAD~6..HEAD

# Force push (if needed)
git push --force-with-lease
```

### 10.3 Full Rollback (< 30 min)
```bash
# Restore from backup
git checkout <backup-branch>

# Redeploy
npm run build && npm run deploy
```

---

## 11. Success Criteria

### 11.1 Functional Requirements
- ✅ All AC functionality preserved
- ✅ MQTT integration working
- ✅ No regressions in existing features
- ✅ DeviceFactory supports all device types
- ✅ Placeholder devices render correctly

### 11.2 Code Quality
- ✅ 30% code reduction achieved
- ✅ < 3% code duplication
- ✅ All components < 100 lines
- ✅ All functions < 20 lines
- ✅ 80% test coverage

### 11.3 Performance
- ✅ Render time < 16ms
- ✅ State update < 50ms
- ✅ Bundle size reduced by 40%
- ✅ No memory leaks

---

## 12. Post-Implementation Tasks

### 12.1 Monitoring
- [ ] Set up error tracking for new components
- [ ] Monitor performance metrics
- [ ] Track user feedback
- [ ] Analyze bundle size changes

### 12.2 Optimization
- [ ] Code splitting analysis
- [ ] Lazy loading opportunities
- [ ] Memoization optimization
- [ ] Bundle optimization

### 12.3 Future Enhancements
- [ ] Implement full Lighting device
- [ ] Implement full Sensor device
- [ ] Add device grouping
- [ ] Add automation features

---

**Document Status**: READY FOR IMPLEMENTATION
**Created**: 2025-10-03
**Last Updated**: 2025-10-03
**Version**: 1.0
**Next Step**: Begin Phase 1 - Extract Utilities
