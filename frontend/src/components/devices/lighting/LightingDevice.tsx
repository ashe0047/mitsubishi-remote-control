"use client";

import React from 'react';
import { BaseDeviceCard } from '../base';
import type { BaseDeviceProps } from '@/types/devices';

/**
 * Lighting device placeholder component
 * TODO: Implement full lighting controls
 */
export const LightingDevice: React.FC<BaseDeviceProps> = ({
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
        <p className="text-sm">Lighting controls coming soon</p>
        <p className="text-xs mt-2">Room: {roomId}</p>
      </div>
    </BaseDeviceCard>
  );
};
