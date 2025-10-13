"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRoomStore } from '@/stores/room-store';
import type { Room } from '@/types/room';

interface DeleteConfirmDialogProps {
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  room,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const deleteRoom = useRoomStore((state) => state.deleteRoom);
  const isLoading = useRoomStore((state) => state.isLoading);

  const handleDelete = async () => {
    try {
      await deleteRoom(room.id);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Room</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{room.name}</strong>?
            <br />
            <br />
            This action cannot be undone. Any devices or assignments associated with this room
            may be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
