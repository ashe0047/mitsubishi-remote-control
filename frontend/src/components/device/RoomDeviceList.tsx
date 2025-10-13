"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useDeviceStore } from '@/stores/device-store';
import { DeviceSearchFilter, DeviceFilters } from './DeviceSearchFilter';
import { DeviceList } from './DeviceList';
import { filterDevices, getDefaultFilters } from '@/lib/utils/device-filter';
import { Device } from '@/types/device';
import { cn } from '@/lib/utils';
import { EditDeviceDialog } from './EditDeviceDialog';
import { DeleteDeviceDialog } from './DeleteDeviceDialog';

/**
 * Props for RoomDeviceList component
 */
export interface RoomDeviceListProps {
  /** Room ID to filter devices */
  roomId: string;
  /** Room name for display */
  roomName?: string;
  /** Callback when edit button clicked */
  onEdit?: (device: Device) => void;
  /** Callback when delete button clicked */
  onDelete?: (device: Device) => void;
  /** Callback when register device button clicked */
  onRegister?: () => void;
  /** Callback when discover devices button clicked */
  onDiscover?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Room-specific device list with search and filtering.
 * Integration component that connects to Zustand store and manages client-side filtering.
 *
 * Features:
 * - Fetches devices for specific room on mount
 * - Client-side search and filtering
 * - Debounced search input (300ms)
 * - Optimistic updates for toggle enabled
 * - Loading and empty states
 *
 * @example
 * <RoomDeviceList
 *   roomId="room-123"
 *   roomName="Living Room"
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onRegister={handleRegister}
 *   onDiscover={handleDiscover}
 * />
 */
export const RoomDeviceList: React.FC<RoomDeviceListProps> = React.memo(({
  roomId,
  roomName,
  onEdit,
  onDelete,
  onRegister,
  onDiscover,
  className,
}) => {
  // Zustand v5 specific selectors (prevent infinite loops)
  // Subscribe directly to devices array to ensure reactivity
  const allDevices = useDeviceStore((state) => state.devices);
  const isLoading = useDeviceStore((state) => state.isLoading);
  const error = useDeviceStore((state) => state.error);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const toggleEnabled = useDeviceStore((state) => state.toggleEnabled);
  const clearError = useDeviceStore((state) => state.clearError);

  // Local filter state
  const [filters, setFilters] = useState<DeviceFilters>(getDefaultFilters());

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Filter devices for this room (reactive to allDevices changes)
  const roomDevices = useMemo(
    () => allDevices.filter((device) => device.roomId === roomId),
    [allDevices, roomId]
  );

  // Apply client-side filtering
  const filteredDevices = useMemo(
    () => filterDevices(roomDevices, filters),
    [roomDevices, filters]
  );

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // Only re-fetch when roomId changes

  // Handle toggle enabled
  const handleToggle = async (device: Device) => {
    try {
      await toggleEnabled(device.id);
    } catch (error) {
      // Error is already set in store and shown in DeviceList
      console.error('Failed to toggle device:', error);
    }
  };

  // Handle retry (clear error and refetch)
  const handleRetry = () => {
    clearError();
    fetchDevices(roomId);
  };

  // Handle edit dialog
  const handleEdit = (device: Device) => {
    setSelectedDevice(device);
    setEditDialogOpen(true);
    onEdit?.(device);
  };

  // Handle delete dialog
  const handleDelete = (device: Device) => {
    setSelectedDevice(device);
    setDeleteDialogOpen(true);
    onDelete?.(device);
  };

  // Handle dialog success
  const handleDialogSuccess = () => {
    fetchDevices(roomId); // Refresh list after update/delete
  };

  // Custom empty message for room-specific view
  const emptyMessage = filters.searchTerm || filters.deviceType
    ? `No devices found matching your filters in ${roomName || 'this room'}`
    : `No devices found in ${roomName || 'this room'}`;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Filter */}
      <DeviceSearchFilter
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Device List */}
      <DeviceList
        devices={filteredDevices}
        isLoading={isLoading}
        error={error}
        getRoomName={() => roomName || ''}
        onEdit={handleEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onRegister={onRegister}
        onDiscover={onDiscover}
        onRetry={handleRetry}
        emptyMessage={emptyMessage}
      />

      {/* Dialogs */}
      {selectedDevice && (
        <>
          <EditDeviceDialog
            device={selectedDevice}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={handleDialogSuccess}
          />
          <DeleteDeviceDialog
            device={selectedDevice}
            roomName={roomName}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onSuccess={handleDialogSuccess}
          />
        </>
      )}
    </div>
  );
});

RoomDeviceList.displayName = 'RoomDeviceList';

export default RoomDeviceList;
