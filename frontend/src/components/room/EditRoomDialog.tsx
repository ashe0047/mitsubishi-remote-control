"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRoomStore } from '@/stores/room-store';
import type { Room, UpdateRoomRequest } from '@/types/room';

interface EditRoomDialogProps {
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditRoomDialog: React.FC<EditRoomDialogProps> = ({
  room,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<UpdateRoomRequest>({
    name: room.name,
    location: room.location || '',
    description: room.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateRoom = useRoomStore((state) => state.updateRoom);
  const isLoading = useRoomStore((state) => state.isLoading);

  // Reset form when room changes
  useEffect(() => {
    setFormData({
      name: room.name,
      location: room.location || '',
      description: room.description || '',
    });
    setErrors({});
  }, [room]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name && formData.name.trim().length < 2) {
      newErrors.name = 'Room name must be at least 2 characters';
    } else if (formData.name && formData.name.length > 100) {
      newErrors.name = 'Room name cannot exceed 100 characters';
    }

    if (formData.location && formData.location.length > 100) {
      newErrors.location = 'Location cannot exceed 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Only send fields that have changed
      const updates: UpdateRoomRequest = {};
      if (formData.name && formData.name.trim() !== room.name) {
        updates.name = formData.name.trim();
      }
      if (formData.location !== undefined && formData.location.trim() !== (room.location || '')) {
        updates.location = formData.location.trim() || undefined;
      }
      if (formData.description !== undefined && formData.description.trim() !== (room.description || '')) {
        updates.description = formData.description.trim() || undefined;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await updateRoom(room.id, updates);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update room:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update room details. Changes will be reflected immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Room Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={errors.location ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.location && (
                <p className="text-sm text-red-500">{errors.location}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={errors.description ? 'border-red-500' : ''}
                disabled={isLoading}
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
