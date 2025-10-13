/**
 * Device Discovery Notification Component
 *
 * Toast notification for newly discovered devices.
 * Provides quick actions: Register or Dismiss.
 *
 * Features:
 * - Auto-dismisses after 10 seconds
 * - Shows device identifier and type
 * - Quick register button (opens registration dialog)
 * - Dismiss button (adds to dismissed list)
 * - Only shows for devices requiring registration
 *
 * Uses ShadcnUI Toast component pattern.
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeviceIcon } from './DeviceIcon';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiscoveredDevice } from '@/types';

interface DeviceDiscoveryNotificationProps {
  /** Discovered device */
  device: DiscoveredDevice;

  /** Callback when register clicked */
  onRegister: (device: DiscoveredDevice) => void;

  /** Callback when dismiss clicked */
  onDismiss: (deviceIdentifier: string) => void;

  /** Auto-dismiss timeout in ms (default: 10000) */
  autoHideDuration?: number;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Device discovery notification component
 * Toast-style notification for newly discovered devices
 */
export const DeviceDiscoveryNotification: React.FC<DeviceDiscoveryNotificationProps> =
  React.memo(({ device, onRegister, onDismiss, autoHideDuration = 10000, className }) => {
    /**
     * Handle register button click
     */
    const handleRegister = useCallback(() => {
      onRegister(device);
    }, [device, onRegister]);

    /**
     * Handle dismiss button click
     */
    const handleDismiss = useCallback(() => {
      onDismiss(device.deviceIdentifier);
    }, [device.deviceIdentifier, onDismiss]);

    /**
     * Auto-dismiss after timeout
     */
    useEffect(() => {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);

      return () => {
        clearTimeout(timer);
      };
    }, [autoHideDuration, handleDismiss]);

    // Don't render if device doesn't require registration
    if (!device.requiresRegistration) {
      return null;
    }

    return (
      <Card
        className={cn(
          'w-full sm:w-[380px]',
          'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
          'shadow-lg',
          'animate-in slide-in-from-top-2 fade-in',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <DeviceIcon
                type={device.deviceType}
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
              />
              <CardTitle className="text-base font-semibold">New Device Discovered</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 pb-3">
          {/* Device Identifier */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Device:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {device.deviceIdentifier}
            </Badge>
          </div>

          {/* Device Type */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {device.deviceType}
            </Badge>
          </div>

          {/* Message Type (for debugging) */}
          {device.messageType && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Protocol:</span>
              <span className="text-xs text-muted-foreground">{device.messageType}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2 pt-0">
          <Button
            onClick={handleRegister}
            size="sm"
            className="flex-1"
            variant="default"
            aria-label={`Register device ${device.deviceIdentifier}`}
          >
            Register
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="outline"
            className="flex-1"
            aria-label={`Dismiss device ${device.deviceIdentifier}`}
          >
            Dismiss
          </Button>
        </CardFooter>
      </Card>
    );
  });

DeviceDiscoveryNotification.displayName = 'DeviceDiscoveryNotification';

/**
 * Container component for multiple discovery notifications
 * Manages stacking and positioning of notifications
 */
export const DeviceDiscoveryNotificationContainer: React.FC<{
  /** Array of discovered devices */
  devices: DiscoveredDevice[];

  /** Callback when register clicked */
  onRegister: (device: DiscoveredDevice) => void;

  /** Callback when dismiss clicked */
  onDismiss: (deviceIdentifier: string) => void;

  /** Additional CSS classes */
  className?: string;
}> = ({ devices, onRegister, onDismiss, className }) => {
  // Filter only devices requiring registration
  const devicesToShow = devices.filter((d) => d.requiresRegistration);

  if (devicesToShow.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50',
        'flex flex-col gap-2',
        'max-h-[calc(100vh-2rem)] overflow-y-auto',
        className
      )}
      aria-label="Device discovery notifications"
    >
      {devicesToShow.map((device) => (
        <DeviceDiscoveryNotification
          key={device.deviceIdentifier}
          device={device}
          onRegister={onRegister}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

DeviceDiscoveryNotificationContainer.displayName = 'DeviceDiscoveryNotificationContainer';
