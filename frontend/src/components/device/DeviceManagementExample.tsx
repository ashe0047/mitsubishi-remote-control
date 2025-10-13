"use client";

/**
 * Example component demonstrating how to integrate DiscoverDevicesDialog
 *
 * This component shows the recommended pattern for using device discovery
 * in your pages. It can be used as a reference when implementing Phase 6
 * admin pages.
 *
 * @example
 * // In your page component:
 * import { DeviceManagementExample } from '@/components/device/DeviceManagementExample';
 *
 * export default function DevicesPage() {
 *   return <DeviceManagementExample roomId="room-123" />;
 * }
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { DiscoverDevicesDialog } from './DiscoverDevicesDialog';
import { RegisterDeviceDialog } from './RegisterDeviceDialog';
import { RoomDeviceList } from './RoomDeviceList';

interface DeviceManagementExampleProps {
  /** Room ID for filtering devices */
  roomId: string;
  /** Room name for display */
  roomName?: string;
}

/**
 * Example component showing how to integrate device discovery workflow.
 *
 * Pattern:
 * 1. Manage dialog open states with useState
 * 2. Pass defaultRoomId to pre-select room in dialogs
 * 3. Handle success callbacks to refresh device list
 * 4. Provide both "Register" and "Discover" actions
 */
export const DeviceManagementExample: React.FC<DeviceManagementExampleProps> = ({
  roomId,
  roomName,
}) => {
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const handleDiscoverSuccess = () => {
    // Dialog handles list refresh internally via store
    // You can add additional success handling here if needed
    console.log('Device discovered and assigned successfully');
  };

  const handleRegisterSuccess = () => {
    // Dialog handles list refresh internally via store
    // You can add additional success handling here if needed
    console.log('Device registered successfully');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {roomName ? `${roomName} Devices` : 'Devices'}
          </h1>
          <p className="text-muted-foreground">
            Manage devices in this room
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setDiscoverDialogOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Discover Devices
          </Button>
          <Button onClick={() => setRegisterDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register Device
          </Button>
        </div>
      </div>

      {/* Device List with integrated dialogs */}
      <RoomDeviceList
        roomId={roomId}
        roomName={roomName}
        onRegister={() => setRegisterDialogOpen(true)}
        onDiscover={() => setDiscoverDialogOpen(true)}
      />

      {/* Discovery Dialog */}
      <DiscoverDevicesDialog
        open={discoverDialogOpen}
        onOpenChange={setDiscoverDialogOpen}
        defaultRoomId={roomId}
        onSuccess={handleDiscoverSuccess}
      />

      {/* Register Dialog */}
      <RegisterDeviceDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        defaultRoomId={roomId}
        onSuccess={handleRegisterSuccess}
      />
    </div>
  );
};

export default DeviceManagementExample;
