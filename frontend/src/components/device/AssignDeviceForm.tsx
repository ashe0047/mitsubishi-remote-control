"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore } from '@/stores/device-store';
import { useRoomStore } from '@/stores/room-store';
import { DeviceType, type DiscoveredDevice } from '@/types/device';
import { deviceDiscoveryApiClient } from '@/lib/api/device-discovery-api-client';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';
import { DeviceTypeIcon } from './DeviceTypeIcon';

interface AssignDeviceFormProps {
  discoveredDevice: DiscoveredDevice;
  defaultRoomId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  roomId: string;
  deviceType: DeviceType;
  manufacturer: string;
  model: string;
}

interface FormErrors {
  roomId?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;
}

export const AssignDeviceForm: React.FC<AssignDeviceFormProps> = ({
  discoveredDevice,
  defaultRoomId,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<FormData>({
    roomId: defaultRoomId || 'placeholder',
    deviceType: discoveredDevice.deviceType ?? DeviceType.AIR_CONDITIONER,
    manufacturer: '',
    model: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Fetch rooms on mount if not already loaded
  useEffect(() => {
    if (rooms.length === 0) {
      fetchRooms().catch((error) => {
        console.error('Failed to fetch rooms:', error);
        showErrorToast('Failed to load rooms', 'Please try again.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.roomId) {
      newErrors.roomId = 'Room is required';
    }

    if (!formData.deviceType) {
      newErrors.deviceType = 'Device type is required';
    }

    // Manufacturer and model are optional
    if (formData.manufacturer && formData.manufacturer.length > 100) {
      newErrors.manufacturer = 'Manufacturer must be less than 100 characters';
    }

    if (formData.model && formData.model.length > 100) {
      newErrors.model = 'Model must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showErrorToast('Validation error', 'Please fix the form errors before submitting.');
      return;
    }

    setIsLoading(true);

    try {
      await deviceDiscoveryApiClient.registerDiscoveredDevice(
        formData.roomId,
        discoveredDevice.deviceIdentifier,
        formData.deviceType,
        {
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
        }
      );

      // Refresh device list
      await fetchDevices();

      showSuccessToast(
        'Device assigned',
        `Device "${discoveredDevice.deviceIdentifier}" has been successfully assigned.`
      );

      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign device. Please try again.';
      console.error('Failed to assign device:', error);
      showErrorToast('Assignment failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Device Identifier (Read-only) */}
      <div className="grid gap-2">
        <Label htmlFor="deviceIdentifier">Device Identifier</Label>
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
          <DeviceTypeIcon deviceType={discoveredDevice.deviceType ?? DeviceType.AIR_CONDITIONER} className="h-4 w-4" />
          <span className="font-mono text-sm">{discoveredDevice.deviceIdentifier}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This identifier was detected from the network and cannot be changed.
        </p>
      </div>

      {/* Room Selection */}
      <div className="grid gap-2">
        <Label htmlFor="roomId">
          Room <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.roomId === 'placeholder' ? undefined : formData.roomId}
          onValueChange={(value) => setFormData({ ...formData, roomId: value })}
          disabled={isLoading}
        >
          <SelectTrigger
            id="roomId"
            className={errors.roomId ? 'border-red-500' : ''}
          >
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
        {errors.roomId && (
          <p className="text-sm text-red-500">{errors.roomId}</p>
        )}
      </div>

      {/* Device Type (Pre-filled, editable) */}
      <div className="grid gap-2">
        <Label htmlFor="deviceType">
          Device Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.deviceType}
          onValueChange={(value) =>
            setFormData({ ...formData, deviceType: value as DeviceType })
          }
          disabled={isLoading}
        >
          <SelectTrigger
            id="deviceType"
            className={errors.deviceType ? 'border-red-500' : ''}
          >
            <SelectValue placeholder="Confirm device type" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(DeviceType).map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The device type was auto-detected. Confirm or change if needed.
        </p>
        {errors.deviceType && (
          <p className="text-sm text-red-500">{errors.deviceType}</p>
        )}
      </div>

      {/* Manufacturer (Optional) */}
      <div className="grid gap-2">
        <Label htmlFor="manufacturer">Manufacturer</Label>
        <Input
          id="manufacturer"
          placeholder="e.g., Mitsubishi"
          value={formData.manufacturer}
          onChange={(e) =>
            setFormData({ ...formData, manufacturer: e.target.value })
          }
          className={errors.manufacturer ? 'border-red-500' : ''}
          disabled={isLoading}
        />
        {errors.manufacturer && (
          <p className="text-sm text-red-500">{errors.manufacturer}</p>
        )}
      </div>

      {/* Model (Optional) */}
      <div className="grid gap-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          placeholder="e.g., MSZ-FH25VE"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          className={errors.model ? 'border-red-500' : ''}
          disabled={isLoading}
        />
        {errors.model && (
          <p className="text-sm text-red-500">{errors.model}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Assigning...' : 'Assign Device'}
        </Button>
      </div>
    </form>
  );
};
