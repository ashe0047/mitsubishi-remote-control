"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Edit, Trash2, Power } from 'lucide-react';
import { Device } from '@/types/device';
import { DeviceTypeIcon } from './DeviceTypeIcon';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { DeviceTypeBadge } from './DeviceTypeBadge';
import { formatDeviceIdentifier, generateDeviceDisplayName } from '@/lib/utils/device-utils';
import { cn } from '@/lib/utils';

/**
 * Props for DeviceCard component
 */
export interface DeviceCardProps {
  /** Device data to display */
  device: Device;
  /** Room name for display (optional) */
  roomName?: string;
  /** Callback when edit button clicked */
  onEdit?: (device: Device) => void;
  /** Callback when toggle enabled/disabled */
  onToggle?: (device: Device) => void;
  /** Callback when delete button clicked */
  onDelete?: (device: Device) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show action buttons */
  showActions?: boolean;
}

/**
 * Device card component displaying device information and actions.
 * Presentational component with no business logic - emits events via callbacks.
 *
 * Layout:
 * - Header: Icon + Device identifier
 * - Body: Room name, Manufacturer + Model
 * - Footer: Status badge + action buttons (Edit, Toggle, Delete)
 *
 * @example
 * <DeviceCard
 *   device={device}
 *   roomName="Living Room"
 *   onEdit={handleEdit}
 *   onToggle={handleToggle}
 *   onDelete={handleDelete}
 * />
 */
export const DeviceCard: React.FC<DeviceCardProps> = React.memo(({
  device,
  roomName,
  onEdit,
  onToggle,
  onDelete,
  className,
  showActions = true,
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const displayName = generateDeviceDisplayName(device);
  const formattedIdentifier = formatDeviceIdentifier(device.deviceIdentifier);

  const handleToggle = async () => {
    if (isToggling || !onToggle) return;
    setIsToggling(true);
    try {
      await onToggle(device);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300',
        'bg-background/50 backdrop-blur-sm hover:bg-background',
        'border border-border/40 hover:border-border',
        'shadow-sm hover:shadow-md',
        className
      )}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header: Icon + Identifier */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 overflow-hidden">
            {/* Device Icon */}
            <div
              className={cn(
                'relative h-10 w-10 sm:h-12 sm:w-12 rounded-xl overflow-hidden',
                'bg-muted flex items-center justify-center flex-shrink-0',
                'shadow-sm'
              )}
            >
              <DeviceTypeIcon
                deviceType={device.deviceType}
                className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground"
              />
            </div>

            {/* Device Info */}
            <div className="flex-1 overflow-hidden">
              <h3 className="font-medium text-base sm:text-lg break-words">
                {displayName}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                {formattedIdentifier}
              </p>
            </div>
          </div>

          {/* Device Type Badge (Desktop) */}
          <div className="hidden sm:block flex-shrink-0">
            <DeviceTypeBadge deviceType={device.deviceType} />
          </div>
        </div>

        {/* Device Type Badge (Mobile) */}
        <div className="sm:hidden">
          <DeviceTypeBadge deviceType={device.deviceType} />
        </div>

        {/* Body: Room & Metadata */}
        <div className="space-y-2">
          {roomName && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Room</span>
              <span className="font-medium">{roomName}</span>
            </div>
          )}

          {(device.manufacturer || device.model) && (
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-muted-foreground flex-shrink-0">Device</span>
              <span className="font-medium text-right break-words flex-1">
                {device.manufacturer && device.model
                  ? `${device.manufacturer} ${device.model}`
                  : device.manufacturer || device.model}
              </span>
            </div>
          )}
        </div>

        {/* Footer: Status + Actions */}
        {showActions && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            {/* Status Badge */}
            <DeviceStatusBadge enabled={device.enabled} />

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Edit Button */}
              {onEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(device)}
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Edit device"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit device</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Toggle Enabled/Disabled Button */}
              {onToggle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggle}
                      disabled={isToggling}
                      className={cn(
                        'h-8 w-8 sm:h-9 sm:w-9 p-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0',
                        device.enabled
                          ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                          : 'text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                      aria-label={device.enabled ? 'Disable device' : 'Enable device'}
                    >
                      <Power className={cn('h-4 w-4', isToggling && 'animate-pulse')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{device.enabled ? 'Disable device' : 'Enable device'}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Delete Button */}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(device)}
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label="Delete device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete device</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

DeviceCard.displayName = 'DeviceCard';

export default DeviceCard;
