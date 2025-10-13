"use client";

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge, type ConnectionStatus } from './ConnectionStatusBadge';
import { cn } from '@/lib/utils';

export interface DeviceCardHeaderProps {
  deviceName: string;
  deviceType: string;
  connectionStatus: ConnectionStatus;
  isExpanded: boolean;
  onExpandToggle?: () => void;
  actions?: React.ReactNode;
}

/**
 * Header section of a device card
 * Displays device name, type, connection status, and expand/collapse control
 */
export const DeviceCardHeader: React.FC<DeviceCardHeaderProps> = ({
  deviceName,
  deviceType,
  connectionStatus,
  isExpanded,
  onExpandToggle,
  actions,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{deviceName}</h3>
          <p className="text-xs text-muted-foreground capitalize">
            {deviceType.replace('-', ' ')}
          </p>
        </div>
        <ConnectionStatusBadge status={connectionStatus} />
      </div>

      <div className="flex items-center gap-2 ml-4">
        {actions}
        {onExpandToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpandToggle}
            className="h-8 w-8 p-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
            />
          </Button>
        )}
      </div>
    </div>
  );
};
