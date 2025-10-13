"use client";

import React from 'react';
import { AirConditionerDevice } from './air-conditioner';
import { LightingDevice } from './lighting/LightingDevice';
import { SensorDevice } from './sensor/SensorDevice';
import type { DeviceFactoryProps, DeviceComponent, DeviceType } from '@/types/devices';
import { Card } from '@/components/ui/card';

/**
 * Device component registry
 * Maps device types to their corresponding components
 */
const DEVICE_COMPONENTS: Record<DeviceType, DeviceComponent> = {
  'air-conditioner': AirConditionerDevice,
  'lighting': LightingDevice,
  'sensor': SensorDevice,
} as const;

/**
 * Fallback component for unknown device types
 */
const FallbackDevice: React.FC<{ deviceName: string }> = ({ deviceName }) => (
  <Card className="p-4">
    <p className="text-muted-foreground text-center">
      Unknown device type: {deviceName}
    </p>
  </Card>
);

/**
 * Device Factory component
 *
 * Dynamically renders the appropriate device component based on device type
 * Implements the Factory pattern for extensibility
 *
 * @example
 * ```tsx
 * <DeviceFactory
 *   device={{
 *     type: 'air-conditioner',
 *     id: 'ac1',
 *     name: 'Living Room AC',
 *     roomId: 'living-room'
 *   }}
 *   isExpanded={true}
 *   onExpandToggle={() => setExpanded(!expanded)}
 * />
 * ```
 */
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
