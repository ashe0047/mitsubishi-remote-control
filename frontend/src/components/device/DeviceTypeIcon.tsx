"use client";

import React from 'react';
import {
  AirVent,
  Thermometer,
  Droplets,
  Fan,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { DeviceType } from '@/types/device';
import { cn } from '@/lib/utils';

/**
 * Icon mapping for device types using Strategy Pattern
 */
const DEVICE_TYPE_ICONS: Record<DeviceType, LucideIcon> = {
  [DeviceType.AIR_CONDITIONER]: AirVent,
  [DeviceType.THERMOSTAT]: Thermometer,
  [DeviceType.HUMIDIFIER]: Droplets,
  [DeviceType.FAN]: Fan,
};

/**
 * Props for DeviceTypeIcon component
 */
export interface DeviceTypeIconProps {
  /** Device type to display icon for */
  deviceType: DeviceType;
  /** Additional CSS classes for icon customization */
  className?: string;
  /** ARIA label for accessibility (optional, defaults to device type label) */
  'aria-label'?: string;
}

/**
 * Display icon for device type using Strategy Pattern.
 * Maps device types to appropriate Lucide icons with fallback support.
 *
 * @example
 * <DeviceTypeIcon deviceType={DeviceType.AIR_CONDITIONER} className="h-6 w-6" />
 */
export const DeviceTypeIcon: React.FC<DeviceTypeIconProps> = React.memo(({
  deviceType,
  className,
  'aria-label': ariaLabel,
}) => {
  // Get icon component using strategy pattern, fallback to HelpCircle
  const IconComponent = DEVICE_TYPE_ICONS[deviceType] || HelpCircle;

  return (
    <IconComponent
      className={cn('h-4 w-4', className)}
      aria-label={ariaLabel || `${deviceType} icon`}
      aria-hidden={!ariaLabel}
    />
  );
});

DeviceTypeIcon.displayName = 'DeviceTypeIcon';

export default DeviceTypeIcon;
