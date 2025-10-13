"use client";

import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DeviceCardFooterProps {
  lastUpdated?: Date;
  actions?: React.ReactNode;
  metadata?: Record<string, string>;
  className?: string;
}

/**
 * Footer section of a device card
 * Displays last updated time, metadata, and action buttons
 */
export const DeviceCardFooter: React.FC<DeviceCardFooterProps> = ({
  lastUpdated,
  actions,
  metadata,
  className,
}) => {
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (!lastUpdated && !actions && !metadata) return null;

  return (
    <div className={cn('flex items-center justify-between px-4 py-2 border-t bg-muted/20', className)}>
      {lastUpdated && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatLastUpdated(lastUpdated)}</span>
        </div>
      )}

      {metadata && (
        <div className="flex gap-2">
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key} className="text-xs text-muted-foreground">
              {key}: {value}
            </span>
          ))}
        </div>
      )}

      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
};
