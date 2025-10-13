/**
 * Device Registration Form Component
 * 
 * Example component demonstrating proper error handling for device registration
 * with user-friendly error messages and recovery actions.
 */

import React, { useState } from 'react';
import { useDeviceStore } from '@/stores/device-store';
import { DeviceErrorAlert, useDeviceErrorAlert } from '@/components/ui/DeviceErrorAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceAlreadyExistsError, DeviceUnavailableError } from '@/lib/errors/device-errors';
import type { RegisterDeviceRequest, DeviceType } from '@/types/device';

interface DeviceRegistrationFormProps {
    roomId: string;
    onSuccess?: (deviceId: string) => void;
    onCancel?: () => void;
}

export function DeviceRegistrationForm({
    roomId,
    onSuccess,
    onCancel
}: DeviceRegistrationFormProps) {
    const [formData, setFormData] = useState<Partial<RegisterDeviceRequest>>({
        roomId,
        deviceType: 'AIR_CONDITIONER',
        deviceIdentifier: '',
        manufacturer: 'Mitsubishi',
        model: '',
        metadata: {}
    });

    const createDevice = useDeviceStore((state) => state.createDevice);
    const isLoading = useDeviceStore((state) => state.isLoading);
    const storeError = useDeviceStore((state) => state.error);
    const errorType = useDeviceStore((state) => state.errorType);
    const errorDetails = useDeviceStore((state) => state.errorDetails);
    const clearError = useDeviceStore((state) => state.clearError);

    const { error: localError, showError, clearError: clearLocalError, ErrorAlert } = useDeviceErrorAlert();

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.deviceIdentifier?.trim()) {
            showError('Device identifier is required', 'validation');
            return;
        }

        setIsSubmitting(true);
        clearError();
        clearLocalError();

        try {
            const device = await createDevice(formData as RegisterDeviceRequest);
            onSuccess?.(device.id);
        } catch (error) {
            // Error is already handled by the store, but we can add local handling if needed
            console.error('Device registration failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        clearError();
        clearLocalError();
        handleSubmit(new Event('submit') as any);
    };

    const handleUpdateExisting = () => {
        // Navigate to device update form or show update modal
        console.log('Update existing device:', errorDetails?.deviceIdentifier);
        // This would typically open an update form or modal
    };

    const currentError = storeError || localError?.message;
    const currentErrorType = errorType || localError?.type;
    const currentErrorDetails = errorDetails || localError?.details;

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Register New Device</CardTitle>
                <CardDescription>
                    Add a new device to this room
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Error Alert */}
                {currentError && (
                    <DeviceErrorAlert
                        error={currentError}
                        errorType={currentErrorType}
                        errorDetails={currentErrorDetails}
                        onRetry={handleRetry}
                        onDismiss={() => {
                            clearError();
                            clearLocalError();
                        }}
                        onUpdateExisting={currentErrorType === 'device_exists' ? handleUpdateExisting : undefined}
                    />
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Device Type */}
                    <div className="space-y-2">
                        <Label htmlFor="deviceType">Device Type</Label>
                        <Select
                            value={formData.deviceType}
                            onValueChange={(value: DeviceType) =>
                                setFormData(prev => ({ ...prev, deviceType: value }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select device type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AIR_CONDITIONER">Air Conditioner</SelectItem>
                                <SelectItem value="HEAT_PUMP">Heat Pump</SelectItem>
                                <SelectItem value="VENTILATION">Ventilation</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Device Identifier */}
                    <div className="space-y-2">
                        <Label htmlFor="deviceIdentifier">Device Identifier *</Label>
                        <Input
                            id="deviceIdentifier"
                            type="text"
                            placeholder="e.g., living-room-ac-01"
                            value={formData.deviceIdentifier}
                            onChange={(e) =>
                                setFormData(prev => ({ ...prev, deviceIdentifier: e.target.value }))
                            }
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Unique identifier for this device (letters, numbers, hyphens only)
                        </p>
                    </div>

                    {/* Manufacturer */}
                    <div className="space-y-2">
                        <Label htmlFor="manufacturer">Manufacturer</Label>
                        <Input
                            id="manufacturer"
                            type="text"
                            placeholder="e.g., Mitsubishi"
                            value={formData.manufacturer}
                            onChange={(e) =>
                                setFormData(prev => ({ ...prev, manufacturer: e.target.value }))
                            }
                        />
                    </div>

                    {/* Model */}
                    <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Input
                            id="model"
                            type="text"
                            placeholder="e.g., MSZ-FH12NA"
                            value={formData.model}
                            onChange={(e) =>
                                setFormData(prev => ({ ...prev, model: e.target.value }))
                            }
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-4">
                        <Button
                            type="submit"
                            disabled={isSubmitting || isLoading || !formData.deviceIdentifier?.trim()}
                            className="flex-1"
                        >
                            {isSubmitting || isLoading ? 'Registering...' : 'Register Device'}
                        </Button>

                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={isSubmitting || isLoading}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

/**
 * Example usage in a parent component:
 * 
 * ```tsx
 * function RoomDevicesPage({ roomId }: { roomId: string }) {
 *   const [showRegistrationForm, setShowRegistrationForm] = useState(false);
 * 
 *   return (
 *     <div>
 *       {showRegistrationForm ? (
 *         <DeviceRegistrationForm
 *           roomId={roomId}
 *           onSuccess={(deviceId) => {
 *             console.log('Device registered:', deviceId);
 *             setShowRegistrationForm(false);
 *           }}
 *           onCancel={() => setShowRegistrationForm(false)}
 *         />
 *       ) : (
 *         <Button onClick={() => setShowRegistrationForm(true)}>
 *           Add Device
 *         </Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */