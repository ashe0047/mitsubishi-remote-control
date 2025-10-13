"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useDeviceStore } from '@/stores/device-store';
import { DeviceSearchFilter, DeviceFilters } from './DeviceSearchFilter';
import { DeviceList } from './DeviceList';
import { filterDevices, getDefaultFilters } from '@/lib/utils/device-filter';
import { Badge } from '@/components/ui/badge';
import { Device } from '@/types/device';
import { cn } from '@/lib/utils';
import { EditDeviceDialog } from './EditDeviceDialog';
import { DeleteDeviceDialog } from './DeleteDeviceDialog';

/**
 * Props for GlobalDeviceList component
 */
export interface GlobalDeviceListProps {
  /** Room name lookup function */
  getRoomName?: (roomId: string) => string;
  /** Callback when edit button clicked */
  onEdit?: (device: Device) => void;
  /** Callback when delete button clicked */
  onDelete?: (device: Device) => void;
  /** Callback when register device button clicked */
  onRegister?: () => void;
  /** Callback when discover devices button clicked */
  onDiscover?: () => void;
  /** Show device count badge */
  showCount?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Global device list with search and filtering across all rooms.
 * Integration component that connects to Zustand store and manages client-side filtering.
 *
 * Features:
 * - Fetches all devices on mount
 * - Client-side search and filtering across all rooms
 * - Debounced search input (300ms)
 * - Device count badge
 * - Optimistic updates for toggle enabled
 * - Loading and empty states
 *
 * @example
 * <GlobalDeviceList
 *   getRoomName={(roomId) => rooms.find(r => r.id === roomId)?.name}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onRegister={handleRegister}
 *   onDiscover={handleDiscover}
 *   showCount
 * />
 */
export const GlobalDeviceList: React.FC<GlobalDeviceListProps> = React.memo(({
  getRoomName,
  onEdit,
  onDelete,
  onRegister,
  onDiscover,
  showCount = true,
  className,
}) => {
  // Zustand v5 specific selectors (prevent infinite loops)
  const devices = useDeviceStore((state) => state.devices);
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

  // Apply client-side filtering
  const filteredDevices = useMemo(
    () => filterDevices(devices, filters),
    [devices, filters]
  );

  // Fetch all devices on mount
  useEffect(() => {
    fetchDevices(); // No roomId = fetch all devices
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

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
    fetchDevices();
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
    fetchDevices(); // Refresh list after update/delete
  };

  // Custom empty message for global view
  const emptyMessage = filters.searchTerm || filters.deviceType
    ? 'No devices found matching your filters'
    : 'No devices found';

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with device count */}
      {showCount && devices.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Devices</h3>
            <Badge variant="secondary" className="font-mono">
              {filteredDevices.length} / {devices.length}
            </Badge>
          </div>
        </div>
      )}

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
        getRoomName={getRoomName}
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
            roomName={getRoomName?.(selectedDevice.roomId)}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onSuccess={handleDialogSuccess}
          />
        </>
      )}
    </div>
  );
});

GlobalDeviceList.displayName = 'GlobalDeviceList';

export default GlobalDeviceList;
