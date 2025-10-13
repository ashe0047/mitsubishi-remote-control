"use client";

import React, { useEffect, useState } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { useDeviceStore } from '@/stores/device-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, MapPin, Calendar, Settings } from 'lucide-react';
import { EditRoomDialog } from './EditRoomDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import Link from 'next/link';
import type { Room } from '@/types/room';

export const RoomManagementList: React.FC = () => {
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  // Zustand v5 specific selectors
  const rooms = useRoomStore((state) => state.rooms);
  const isLoading = useRoomStore((state) => state.isLoading);
  const error = useRoomStore((state) => state.error);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Device store selectors for device count
  const getDevicesByRoom = useDeviceStore((state) => state.getDevicesByRoom);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);

  useEffect(() => {
    fetchRooms();
    fetchDevices(); // Fetch all devices for device count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get device count for a room
  const getDeviceCount = (roomId: string): number => {
    return getDevicesByRoom(roomId).length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading && (!rooms || rooms.length === 0)) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading rooms...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground mb-2">No rooms found</p>
        <p className="text-sm text-muted-foreground">
          Click &quot;Add Room&quot; to create your first room
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Card key={room.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{room.name}</CardTitle>
                  {room.location && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {room.location}
                    </CardDescription>
                  )}
                </div>
                <Badge variant="outline" className="ml-2">
                  {room.roomIdentifier}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {room.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {room.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created {formatDate(room.createdAt)}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getDeviceCount(room.id)} {getDeviceCount(room.id) === 1 ? 'device' : 'devices'}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link href={`/admin/rooms/${room.id}/devices`} className="w-full">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Settings className="h-3 w-3" />
                    Manage Devices
                  </Button>
                </Link>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingRoom(room)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeletingRoom(room)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingRoom && (
        <EditRoomDialog
          room={editingRoom}
          open={!!editingRoom}
          onOpenChange={(open) => !open && setEditingRoom(null)}
          onSuccess={() => setEditingRoom(null)}
        />
      )}

      {deletingRoom && (
        <DeleteConfirmDialog
          room={deletingRoom}
          open={!!deletingRoom}
          onOpenChange={(open) => !open && setDeletingRoom(null)}
          onSuccess={() => setDeletingRoom(null)}
        />
      )}
    </>
  );
};
