"use client";

import React, { useState, useEffect } from 'react';
import { GlobalDeviceList } from '@/components/device/GlobalDeviceList';
import { RegisterDeviceDialog } from '@/components/device/RegisterDeviceDialog';
import { DiscoverDevicesDialog } from '@/components/device/DiscoverDevicesDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Radio } from 'lucide-react';
import Link from 'next/link';
import { useRoomStore } from '@/stores/room-store';
import { useDeviceStore } from '@/stores/device-store';
import { Badge } from '@/components/ui/badge';

/**
 * Global Device Management Page
 *
 * Displays all devices across all rooms with search and filtering capabilities.
 * Provides actions to register new devices or discover devices automatically.
 *
 * Features:
 * - GlobalDeviceList component with search/filter
 * - Register Device dialog
 * - Discover Devices dialog
 * - Device count badge
 * - Navigation breadcrumb
 */
export default function DevicesPage() {
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);

  // Zustand v5 specific selectors
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);
  const devices = useDeviceStore((state) => state.devices);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);

  // Fetch rooms on mount for room name lookup
  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get room name by roomId
  const getRoomName = (roomId: string): string => {
    const room = rooms.find((r) => r.id === roomId);
    return room?.name || 'Unknown Room';
  };

  // Handle dialog success - refresh devices
  const handleRegisterSuccess = () => {
    fetchDevices();
    setRegisterDialogOpen(false);
  };

  const handleDiscoverSuccess = () => {
    fetchDevices();
    setDiscoverDialogOpen(false);
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Header with back button and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Admin</span>
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Device Management</h1>
              {devices.length > 0 && (
                <Badge variant="secondary" className="font-mono">
                  {devices.length}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Manage all devices across your household
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setDiscoverDialogOpen(true)}
          >
            <Radio className="h-4 w-4" />
            Discover Devices
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setRegisterDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Register Device
          </Button>
        </div>
      </div>

      {/* Global Device List */}
      <GlobalDeviceList
        getRoomName={getRoomName}
        onRegister={() => setRegisterDialogOpen(true)}
        onDiscover={() => setDiscoverDialogOpen(true)}
        showCount={false} // Already showing count in header
      />

      {/* Dialogs */}
      <RegisterDeviceDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onSuccess={handleRegisterSuccess}
      />

      <DiscoverDevicesDialog
        open={discoverDialogOpen}
        onOpenChange={setDiscoverDialogOpen}
        onSuccess={handleDiscoverSuccess}
      />
    </div>
  );
}
