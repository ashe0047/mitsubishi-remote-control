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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useDeviceStore } from '@/stores/device-store';
import type { Device } from '@/types/device';
import { updateDeviceMetadataSchema } from '@/lib/validation/device-schemas';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/utils/toast';

interface EditDeviceDialogProps {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  manufacturer: string;
  model: string;
  enabled: boolean;
}

interface FormErrors {
  manufacturer?: string;
  model?: string;
}

export const EditDeviceDialog: React.FC<EditDeviceDialogProps> = ({
  device,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>({
    manufacturer: device.manufacturer || '',
    model: device.model || '',
    enabled: device.enabled,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateDevice = useDeviceStore((state) => state.updateDevice);
  const isLoading = useDeviceStore((state) => state.isLoading);

  // Reset form when device changes
  useEffect(() => {
    setFormData({
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      enabled: device.enabled,
    });
    setErrors({});
  }, [device]);

  const validateForm = (): boolean => {
    const validationResult = updateDeviceMetadataSchema.safeParse({
      manufacturer: formData.manufacturer || undefined,
      model: formData.model || undefined,
      enabled: formData.enabled,
    });

    if (!validationResult.success) {
      const newErrors: FormErrors = {};
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
      // Only send fields that have changed
      const updates: {
        manufacturer?: string;
        model?: string;
        enabled?: boolean;
      } = {};

      if (formData.manufacturer !== (device.manufacturer || '')) {
        updates.manufacturer = formData.manufacturer || undefined;
      }
      if (formData.model !== (device.model || '')) {
        updates.model = formData.model || undefined;
      }
      if (formData.enabled !== device.enabled) {
        updates.enabled = formData.enabled;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await updateDevice(device.id, updates);
        showSuccessToast('Device updated', `Device "${device.deviceIdentifier}" has been successfully updated.`);
      } else {
        showInfoToast('No changes', 'No changes were made to the device.');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to update device:', error);
      showErrorToast('Update failed', error?.message || 'Failed to update device. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device metadata. Device type and identifier cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Read-only fields */}
            <div className="grid gap-2">
              <Label>Device Identifier</Label>
              <div className="flex items-center gap-2">
                <Input value={device.deviceIdentifier} disabled className="bg-muted" />
                <Badge variant="outline">Read-only</Badge>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Device Type</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={device.deviceType.replace(/_/g, ' ')}
                  disabled
                  className="bg-muted"
                />
                <Badge variant="outline">Read-only</Badge>
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid gap-2">
              <Label htmlFor="edit-manufacturer">Manufacturer</Label>
              <Input
                id="edit-manufacturer"
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
              <Label htmlFor="edit-model">Model</Label>
              <Input
                id="edit-model"
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
              <Label htmlFor="edit-enabled" className="cursor-pointer">
                Enable device
              </Label>
              <Switch
                id="edit-enabled"
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
