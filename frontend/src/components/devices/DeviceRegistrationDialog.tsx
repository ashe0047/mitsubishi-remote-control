/**
 * Device Registration Dialog Component
 *
 * Modal dialog for registering discovered devices to rooms.
 * Provides form with room selection and optional metadata fields.
 *
 * Features:
 * - Room selection (required)
 * - Optional device metadata (name, manufacturer, model)
 * - Inline validation errors
 * - Conflict handling (duplicate registration)
 * - Keeps modal open on error for retry
 *
 * Uses ShadcnUI Dialog component with proper accessibility.
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeviceIcon } from './DeviceIcon';
import { cn } from '@/lib/utils';
import type { DiscoveredDevice } from '@/types';

interface DeviceRegistrationDialogProps {
  /** Discovered device to register */
  device: DiscoveredDevice | null;

  /** Available rooms for selection */
  rooms: Array<{ id: string; name: string }>;

  /** Whether dialog is open */
  open: boolean;

  /** Callback when dialog close requested */
  onOpenChange: (open: boolean) => void;

  /** Callback when registration submitted */
  onRegister: (
    device: DiscoveredDevice,
    roomId: string,
    metadata?: {
      deviceName?: string;
      manufacturer?: string;
      model?: string;
    }
  ) => Promise<void>;
}

/**
 * Device registration dialog component
 * Modal form for registering discovered devices to rooms
 */
export const DeviceRegistrationDialog: React.FC<DeviceRegistrationDialogProps> = ({
  device,
  rooms,
  open,
  onOpenChange,
  onRegister,
}) => {
  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [model, setModel] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setSelectedRoomId('');
    setDeviceName('');
    setManufacturer('');
    setModel('');
    setError(null);
    setIsSubmitting(false);
  }, []);

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!device) return;

      // Validation
      if (!selectedRoomId) {
        setError('Please select a room');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Build metadata object (only include if provided)
        const metadata: {
          deviceName?: string;
          manufacturer?: string;
          model?: string;
        } = {};

        if (deviceName.trim()) {
          metadata.deviceName = deviceName.trim();
        }
        if (manufacturer.trim()) {
          metadata.manufacturer = manufacturer.trim();
        }
        if (model.trim()) {
          metadata.model = model.trim();
        }

        await onRegister(
          device,
          selectedRoomId,
          Object.keys(metadata).length > 0 ? metadata : undefined
        );

        // Success - close dialog
        handleClose();
      } catch (err) {
        // Keep modal open on error for retry
        const errorMessage = err instanceof Error ? err.message : 'Registration failed';

        // Handle specific error cases
        if (errorMessage.includes('Conflict') || errorMessage.includes('duplicate')) {
          setError('This device is already registered. Please select a different room.');
        } else if (errorMessage.includes('not found')) {
          setError('Selected room not found. Please select another room.');
        } else if (errorMessage.includes('Network error')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(errorMessage);
        }

        console.error('Device registration failed:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [device, selectedRoomId, deviceName, manufacturer, model, onRegister, handleClose]
  );

  // Don't render if no device
  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DeviceIcon type={device.deviceType} className="h-5 w-5" />
            Register Device
          </DialogTitle>
          <DialogDescription>
            Register discovered device: <strong>{device.deviceIdentifier}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Room Selection (Required) */}
            <div className="space-y-2">
              <Label htmlFor="room-select" className="text-sm font-medium">
                Room <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger id="room-select" className="w-full">
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedRoomId && error?.includes('room') && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            {/* Device Name (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="device-name" className="text-sm font-medium">
                Device Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="device-name"
                type="text"
                placeholder="e.g., Living Room AC"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>

            {/* Manufacturer (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="manufacturer" className="text-sm font-medium">
                Manufacturer <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="manufacturer"
                type="text"
                placeholder="e.g., Mitsubishi"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>

            {/* Model (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="model" className="text-sm font-medium">
                Model <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="model"
                type="text"
                placeholder="e.g., MSZ-FH12NA"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>

            {/* Error Display */}
            {error && !error.includes('room') && (
              <div
                className={cn(
                  'rounded-md border p-3',
                  'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                )}
              >
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedRoomId}>
              {isSubmitting ? 'Registering...' : 'Register Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

DeviceRegistrationDialog.displayName = 'DeviceRegistrationDialog';
