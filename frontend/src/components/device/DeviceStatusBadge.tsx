"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for DeviceStatusBadge component
 */
export interface DeviceStatusBadgeProps {
  /** Whether device is enabled */
  enabled: boolean;
  /** Badge variant (default: full label, compact: icon only) */
  variant?: 'default' | 'compact';
  /** Additional CSS classes */
  className?: string;
  /** Show icon alongside text */
  showIcon?: boolean;
}

/**
 * Display device enabled/disabled status badge with semantic colors.
 * Supports both light and dark modes with accessible color contrast.
 *
 * @example
 * <DeviceStatusBadge enabled={true} />
 * <DeviceStatusBadge enabled={false} variant="compact" />
 */
export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = React.memo(({
  enabled,
  variant = 'default',
  className,
  showIcon = true,
}) => {
  const Icon = enabled ? Power : PowerOff;
  const label = enabled ? 'Enabled' : 'Disabled';
  const colorClass = enabled
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 h-5 px-2 text-xs font-normal transition-colors',
        colorClass,
        className
      )}
      aria-label={`Device status: ${label}`}
    >
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {variant === 'default' && <span>{label}</span>}
    </Badge>
  );
});

DeviceStatusBadge.displayName = 'DeviceStatusBadge';

export default DeviceStatusBadge;
