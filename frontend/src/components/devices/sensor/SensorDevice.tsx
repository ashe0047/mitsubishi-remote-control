"use client";

import React from 'react';
import { BaseDeviceCard } from '../base';
import type { BaseDeviceProps } from '@/types/devices';

/**
 * Sensor device placeholder component
 * TODO: Implement sensor data display
 */
export const SensorDevice: React.FC<BaseDeviceProps> = ({
  deviceName,
  roomId,
  isExpanded,
  onExpandToggle,
}) => {
  return (
    <BaseDeviceCard
      deviceName={deviceName}
      deviceType="sensor"
      connectionStatus="connected"
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
    >
      <div className="text-center text-muted-foreground py-8">
        <p className="text-sm">Sensor data display coming soon</p>
        <p className="text-xs mt-2">Room: {roomId}</p>
      </div>
    </BaseDeviceCard>
  );
};
