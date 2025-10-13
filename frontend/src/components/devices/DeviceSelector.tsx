/**
 * Device Selector Component
 *
 * Dropdown for selecting active device when room has multiple devices.
 * Conditionally rendered only when room has >1 enabled device.
 *
 * Uses ShadcnUI Select component with proper mobile optimization.
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DeviceIcon } from './DeviceIcon';
import { cn } from '@/lib/utils';
import type { Device } from '@/types';

interface DeviceSelectorProps {
  /** Room ID */
  roomId: string;

  /** All devices in room */
  devices: Device[];

  /** Currently selected device identifier */
  selectedDeviceId: string | undefined;

  /** Callback when device selected */
  onSelectDevice: (deviceIdentifier: string) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Device selector component
 * Shows dropdown for device selection when room has multiple devices
 */
export const DeviceSelector: React.FC<DeviceSelectorProps> = React.memo(
  ({ roomId, devices, selectedDeviceId, onSelectDevice, className }) => {
    // Filter enabled devices only
    const enabledDevices = useMemo(
      () => devices.filter((d) => d.enabled),
      [devices]
    );

    // Don't render if only one device
    if (enabledDevices.length <= 1) {
      return null;
    }

    // Callback stability
    const handleValueChange = useCallback(
      (value: string) => {
        onSelectDevice(value);
      },
      [onSelectDevice]
    );

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Label htmlFor="device-selector" className="text-sm text-muted-foreground">
          Device:
        </Label>
        <Select value={selectedDeviceId} onValueChange={handleValueChange}>
          <SelectTrigger id="device-selector" className="w-[200px] h-9">
            <SelectValue placeholder="Select device" />
          </SelectTrigger>
          <SelectContent>
            {enabledDevices.map((device) => (
              <SelectItem key={device.id} value={device.deviceIdentifier}>
                <div className="flex items-center gap-2">
                  <DeviceIcon type={device.deviceType} className="h-4 w-4" />
                  <span className="text-sm">
                    {device.manufacturer || device.deviceIdentifier}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
  // Custom comparison: only re-render if devices or selection changed
  (prevProps, nextProps) => {
    return (
      prevProps.roomId === nextProps.roomId &&
      prevProps.selectedDeviceId === nextProps.selectedDeviceId &&
      prevProps.devices.length === nextProps.devices.length &&
      prevProps.devices.every((d, i) => d.id === nextProps.devices[i]?.id)
    );
  }
);

DeviceSelector.displayName = 'DeviceSelector';
