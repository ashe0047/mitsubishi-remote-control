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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useDeviceStore } from '@/stores/device-store';
import { useRoomStore } from '@/stores/room-store';
import { DeviceType } from '@/types/device';
import { registerDeviceSchema } from '@/lib/validation/device-schemas';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';

interface RegisterDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultRoomId?: string;
}

interface FormData {
  roomId: string;
  deviceType: DeviceType | '';
  deviceIdentifier: string;
  manufacturer: string;
  model: string;
  enabled: boolean;
}

interface FormErrors {
  roomId?: string;
  deviceType?: string;
  deviceIdentifier?: string;
  manufacturer?: string;
  model?: string;
}

export const RegisterDeviceDialog: React.FC<RegisterDeviceDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  defaultRoomId,
}) => {
  const [formData, setFormData] = useState<FormData>({
    roomId: defaultRoomId || '',
    deviceType: '',
    deviceIdentifier: '',
    manufacturer: '',
    model: '',
    enabled: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const createDevice = useDeviceStore((state) => state.createDevice);
  const isLoading = useDeviceStore((state) => state.isLoading);
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Fetch rooms on mount if not already loaded
  useEffect(() => {
    if (open && rooms.length === 0) {
      fetchRooms().catch((error) => {
        console.error('Failed to fetch rooms:', error);
        showErrorToast('Failed to load rooms', 'Please try again.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update roomId if defaultRoomId changes
  useEffect(() => {
    if (defaultRoomId) {
      setFormData((prev) => ({ ...prev, roomId: defaultRoomId }));
    }
  }, [defaultRoomId]);

  const validateForm = (): boolean => {
    // Check for empty required fields first
    const newErrors: FormErrors = {};
    
    if (!formData.roomId || formData.roomId === 'placeholder') {
      newErrors.roomId = 'Please select a room';
    }
    
    if (!formData.deviceType || formData.deviceType === 'placeholder') {
      newErrors.deviceType = 'Please select a device type';
    }
    
    if (!formData.deviceIdentifier.trim()) {
      newErrors.deviceIdentifier = 'Device identifier is required';
    }

    // If we have basic validation errors, return early
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    // Now validate with Zod schema
    const validationResult = registerDeviceSchema.safeParse({
      roomId: formData.roomId,
      deviceType: formData.deviceType as DeviceType,
      deviceIdentifier: formData.deviceIdentifier,
      manufacturer: formData.manufacturer || undefined,
      model: formData.model || undefined,
      enabled: formData.enabled,
    });

    if (!validationResult.success) {
      validationResult.error.errors.forEach((error) => {
        const field = error.path[0] as keyof FormErrors;
        newErrors[field] = error.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showErrorToast('Validation error', 'Please fix the form errors before submitting.');
      return;
    }

    try {
      await createDevice({
        roomId: formData.roomId,
        deviceType: formData.deviceType as DeviceType,
        deviceIdentifier: formData.deviceIdentifier,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        enabled: formData.enabled,
      });

      showSuccessToast('Device registered', `Device "${formData.deviceIdentifier}" has been successfully registered.`);
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to register device:', error);
      showErrorToast('Registration failed', error?.message || 'Failed to register device. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      roomId: defaultRoomId || '',
      deviceType: '',
      deviceIdentifier: '',
      manufacturer: '',
      model: '',
      enabled: true,
    });
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register New Device</DialogTitle>
            <DialogDescription>
              Register a device to a room. Make sure the device is powered on and connected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="roomId">
                Room <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.roomId || undefined}
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

            <div className="grid gap-2">
              <Label htmlFor="deviceType">
                Device Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.deviceType || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, deviceType: value as DeviceType })
                }
                disabled={isLoading}
              >
                <SelectTrigger
                  id="deviceType"
                  className={errors.deviceType ? 'border-red-500' : ''}
                >
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DeviceType).map(([key, value]) => (
                    <SelectItem key={value} value={value}>
                      {key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.deviceType && (
                <p className="text-sm text-red-500">{errors.deviceType}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deviceIdentifier">
                Device Identifier <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deviceIdentifier"
                placeholder="e.g., living-room-ac-01"
                value={formData.deviceIdentifier}
                onChange={(e) =>
                  setFormData({ ...formData, deviceIdentifier: e.target.value })
                }
                className={errors.deviceIdentifier ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens, and underscores only
              </p>
              {errors.deviceIdentifier && (
                <p className="text-sm text-red-500">{errors.deviceIdentifier}</p>
              )}
            </div>

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

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled" className="cursor-pointer">
                Enable device
              </Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
