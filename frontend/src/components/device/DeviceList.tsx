"use client";

import React from 'react';
import { Device } from '@/types/device';
import { DeviceCard } from './DeviceCard';
import { LoadingDeviceCard } from './LoadingDeviceCard';
import { EmptyDeviceState } from './EmptyDeviceState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for DeviceList component
 */
export interface DeviceListProps {
  /** Array of devices to display */
  devices: Device[];
  /** Loading state */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Room name lookup function */
  getRoomName?: (roomId: string) => string;
  /** Callback when edit button clicked */
  onEdit?: (device: Device) => void;
  /** Callback when toggle enabled/disabled */
  onToggle?: (device: Device) => void;
  /** Callback when delete button clicked */
  onDelete?: (device: Device) => void;
  /** Callback when register device button clicked (empty state) */
  onRegister?: () => void;
  /** Callback when discover devices button clicked (empty state) */
  onDiscover?: () => void;
  /** Callback when retry button clicked (error state) */
  onRetry?: () => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pure presentational component for displaying device list.
 * Handles loading, error, and empty states automatically.
 *
 * Layout:
 * - Mobile (<768px): 1 column
 * - Tablet (768-1024px): 2 columns
 * - Desktop (>1024px): 3 columns
 *
 * @example
 * <DeviceList
 *   devices={filteredDevices}
 *   isLoading={isLoading}
 *   error={error}
 *   getRoomName={(roomId) => rooms.find(r => r.id === roomId)?.name}
 *   onEdit={handleEdit}
 *   onToggle={handleToggle}
 *   onDelete={handleDelete}
 *   onRegister={handleRegister}
 *   onDiscover={handleDiscover}
 * />
 */
export const DeviceList: React.FC<DeviceListProps> = React.memo(({
  devices,
  isLoading,
  error,
  getRoomName,
  onEdit,
  onToggle,
  onDelete,
  onRegister,
  onDiscover,
  onRetry,
  emptyMessage,
  className,
}) => {
  // Error state
  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="flex-shrink-0"
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state (show skeletons if no devices loaded yet)
  if (isLoading && devices.length === 0) {
    return (
      <div
        className={cn(
          'grid gap-4',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingDeviceCard key={`loading-${index}`} />
        ))}
      </div>
    );
  }

  // Empty state (no devices after loading)
  if (!isLoading && devices.length === 0) {
    return (
      <div className={className}>
        <EmptyDeviceState
          message={emptyMessage}
          onRegister={onRegister}
          onDiscover={onDiscover}
        />
      </div>
    );
  }

  // Device grid
  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          roomName={getRoomName ? getRoomName(device.roomId) : undefined}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}

      {/* Show loading skeletons for additional items while loading */}
      {isLoading &&
        Array.from({ length: 3 }).map((_, index) => (
          <LoadingDeviceCard key={`loading-more-${index}`} />
        ))}
    </div>
  );
});

DeviceList.displayName = 'DeviceList';

export default DeviceList;
