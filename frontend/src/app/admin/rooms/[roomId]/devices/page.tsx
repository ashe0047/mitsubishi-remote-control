"use client";

import React, { useState, useEffect } from 'react';
import { RoomDeviceList } from '@/components/device/RoomDeviceList';
import { RegisterDeviceDialog } from '@/components/device/RegisterDeviceDialog';
import { DiscoverDevicesDialog } from '@/components/device/DiscoverDevicesDialog';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Plus, Radio } from 'lucide-react';
import Link from 'next/link';
import { useRoomStore } from '@/stores/room-store';
import { useDeviceStore } from '@/stores/device-store';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';

/**
 * Room-Specific Device Management Page
 *
 * Displays devices for a specific room with search and filtering capabilities.
 * Provides actions to register new devices or discover devices for this room.
 *
 * Features:
 * - RoomDeviceList component filtered by roomId
 * - Register Device dialog (pre-filled with roomId)
 * - Discover Devices dialog (pre-filtered to room)
 * - Device count badge
 * - Breadcrumb navigation: Admin > Rooms > [Room Name] > Devices
 */
export default function RoomDevicesPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);

  // Zustand v5 specific selectors
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);
  const getDevicesByRoom = useDeviceStore((state) => state.getDevicesByRoom);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);

  // Get current room
  const room = rooms.find((r) => r.id === roomId);
  const roomName = room?.name || 'Unknown Room';

  // Get device count for this room
  const deviceCount = getDevicesByRoom(roomId).length;

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle dialog success - refresh devices
  const handleRegisterSuccess = () => {
    fetchDevices(roomId);
    setRegisterDialogOpen(false);
  };

  const handleDiscoverSuccess = () => {
    fetchDevices(roomId);
    setDiscoverDialogOpen(false);
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/rooms">Rooms</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{roomName}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Devices</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with back button and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/rooms">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Rooms</span>
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{roomName} Devices</h1>
              <Badge variant="secondary" className="font-mono">
                {deviceCount}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage devices in {roomName}
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

      {/* Room Device List */}
      <RoomDeviceList
        roomId={roomId}
        roomName={roomName}
        onRegister={() => setRegisterDialogOpen(true)}
        onDiscover={() => setDiscoverDialogOpen(true)}
      />

      {/* Dialogs */}
      <RegisterDeviceDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onSuccess={handleRegisterSuccess}
        defaultRoomId={roomId}
      />

      <DiscoverDevicesDialog
        open={discoverDialogOpen}
        onOpenChange={setDiscoverDialogOpen}
        onSuccess={handleDiscoverSuccess}
        defaultRoomId={roomId}
      />
    </div>
  );
}
