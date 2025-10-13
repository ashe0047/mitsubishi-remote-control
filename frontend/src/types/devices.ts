import type React from 'react';

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
  config?: Record<string, unknown>;
}

export interface DeviceFactoryProps {
  device: DeviceConfig;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export type DeviceComponent = React.FC<BaseDeviceProps>;
