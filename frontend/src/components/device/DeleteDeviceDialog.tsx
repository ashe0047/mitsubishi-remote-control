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
import { useDeviceStore } from '@/stores/device-store';
import type { Device } from '@/types/device';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';

interface DeleteDeviceDialogProps {
  device: Device;
  roomName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const DeleteDeviceDialog: React.FC<DeleteDeviceDialogProps> = ({
  device,
  roomName,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const deleteDevice = useDeviceStore((state) => state.deleteDevice);
  const isLoading = useDeviceStore((state) => state.isLoading);

  const handleDelete = async () => {
    try {
      await deleteDevice(device.id);
      showSuccessToast('Device deleted', `Device "${device.deviceIdentifier}" has been permanently removed.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to delete device:', error);
      showErrorToast('Deletion failed', error?.message || 'Failed to delete device. Please try again.');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Device</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the device{' '}
            <strong>{device.deviceIdentifier}</strong> (
            {device.deviceType.replace(/_/g, ' ')})
            {roomName && (
              <>
                {' '}
                from <strong>{roomName}</strong>
              </>
            )}
            ?
            <br />
            <br />
            This will permanently remove the device from the system. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isLoading ? 'Deleting...' : 'Delete Device'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
