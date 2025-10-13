"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DeviceType } from '@/types/device';
import { getDeviceTypeLabel, getDeviceTypeColor } from '@/lib/utils/device-utils';
import { DeviceTypeIcon } from './DeviceTypeIcon';
import { cn } from '@/lib/utils';

/**
 * Props for DeviceTypeBadge component
 */
export interface DeviceTypeBadgeProps {
  /** Device type to display */
  deviceType: DeviceType;
  /** Show icon alongside label */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display device type badge with icon and semantic colors.
 * Uses outline variant for subtle appearance in device cards.
 *
 * @example
 * <DeviceTypeBadge deviceType={DeviceType.AIRCONDITIONER} />
 * <DeviceTypeBadge deviceType={DeviceType.LIGHT} showIcon={false} />
 */
export const DeviceTypeBadge: React.FC<DeviceTypeBadgeProps> = React.memo(({
  deviceType,
  showIcon = true,
  className,
}) => {
  const label = getDeviceTypeLabel(deviceType);
  const colorClass = getDeviceTypeColor(deviceType);

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 h-5 px-2 text-xs font-normal transition-colors',
        colorClass,
        className
      )}
      aria-label={`Device type: ${label}`}
    >
      {showIcon && (
        <DeviceTypeIcon
          deviceType={deviceType}
          className="h-3 w-3"
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </Badge>
  );
});

DeviceTypeBadge.displayName = 'DeviceTypeBadge';

export default DeviceTypeBadge;
