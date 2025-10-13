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

/**
 * Displays the connection status of a device with an icon and label
 * @param status - Current connection status
 * @param className - Optional additional CSS classes
 */
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
      default:
        // Fallback for undefined or unknown status
        return {
          icon: WifiOff,
          label: 'Unknown',
          variant: 'secondary' as const,
          className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
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
