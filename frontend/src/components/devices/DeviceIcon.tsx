/**
 * Device Icon Component
 *
 * Displays appropriate icon for device type
 */

import React from 'react';
import { Wind, Droplets, Fan as FanIcon, Thermometer } from 'lucide-react';
import { DeviceType } from '@/types';
import { cn } from '@/lib/utils';

interface DeviceIconProps {
  type: DeviceType | string;
  className?: string;
}

export const DeviceIcon: React.FC<DeviceIconProps> = ({ type, className }) => {
  const iconClass = cn('h-4 w-4', className);

  switch (type) {
    case DeviceType.AIRCONDITIONER:
    case 'airconditioner':
      return <Wind className={iconClass} />;
    case DeviceType.THERMOSTAT:
    case 'thermostat':
      return <Thermometer className={iconClass} />;
    case DeviceType.HUMIDIFIER:
    case 'humidifier':
      return <Droplets className={iconClass} />;
    case DeviceType.FAN:
    case 'fan':
      return <FanIcon className={iconClass} />;
    default:
      return <Wind className={iconClass} />;
  }
};
