"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, AlertCircle } from 'lucide-react';
import { deviceDiscoveryApiClient } from '@/lib/api/device-discovery-api-client';
import type { DiscoveredDevice } from '@/types/device';
import { DeviceType } from '@/types/device';
import { showErrorToast } from '@/lib/utils/toast';
import { AssignDeviceForm } from './AssignDeviceForm';
import { DeviceTypeIcon } from './DeviceTypeIcon';
import { formatRelativeTime } from '@/lib/utils/date-formatter';

interface DiscoverDevicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRoomId?: string;
  onSuccess?: () => void;
}

type ViewState = 'discovery' | 'assignment';

export const DiscoverDevicesDialog: React.FC<DiscoverDevicesDialogProps> = ({
  open,
  onOpenChange,
  defaultRoomId,
  onSuccess,
}) => {
  const [viewState, setViewState] = useState<ViewState>('discovery');
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch discovered devices when dialog opens
  useEffect(() => {
    if (open) {
      fetchDiscoveredDevices();
    } else {
      // Reset state when dialog closes
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchDiscoveredDevices = async () => {
    if (!defaultRoomId) {
      setError('Room ID is required for device discovery');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const devices = await deviceDiscoveryApiClient.getDiscoveredDevices(defaultRoomId);
      setDiscoveredDevices(devices);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to discover devices';
      console.error('Failed to fetch discovered devices:', err);
      setError(errorMessage);
      showErrorToast('Discovery failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignDevice = (device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setViewState('assignment');
  };

  const handleIgnoreDevice = async (deviceIdentifier: string) => {
    try {
      await deviceDiscoveryApiClient.dismissDiscoveredDevice(deviceIdentifier);
      setDiscoveredDevices((prev) =>
        prev.filter((d) => d.deviceIdentifier !== deviceIdentifier)
      );
    } catch (error) {
      console.error('Failed to dismiss discovery:', error);
      showErrorToast('Dismiss failed', 'Unable to dismiss discovered device. Please try again.');
    }
  };

  const handleAssignmentSuccess = () => {
    // Remove assigned device from discovery list
    if (selectedDevice) {
      setDiscoveredDevices((prev) =>
        prev.filter((d) => d.deviceIdentifier !== selectedDevice.deviceIdentifier)
      );
    }

    // Return to discovery view
    setViewState('discovery');
    setSelectedDevice(null);

    // Notify parent
    onSuccess?.();
  };

  const handleAssignmentCancel = () => {
    setViewState('discovery');
    setSelectedDevice(null);
  };

  const resetState = () => {
    setViewState('discovery');
    setDiscoveredDevices([]);
    setSelectedDevice(null);
    setIsLoading(false);
    setError(null);
  };

  const renderDiscoveryView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Scanning for devices...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center space-y-2">
            <p className="font-medium">Discovery Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={fetchDiscoveredDevices} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (discoveredDevices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Wifi className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-2">
            <p className="font-medium">No Devices Discovered</p>
            <p className="text-sm text-muted-foreground max-w-md">
              No new devices were found. Make sure devices are powered on and connected to the network.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchDiscoveredDevices} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="default">
              Close
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Found {discoveredDevices.length} unregistered device{discoveredDevices.length !== 1 ? 's' : ''}
          </p>
          <Button onClick={fetchDiscoveredDevices} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {discoveredDevices.map((device) => {
            const displayType = device.deviceType ?? DeviceType.AIR_CONDITIONER;
            const lastSeen = device.lastSeenAt ?? device.firstSeenAt;

            return (
              <div
                key={device.deviceIdentifier}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <DeviceTypeIcon deviceType={displayType} className="h-5 w-5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{device.deviceIdentifier}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {displayType.replace(/_/g, ' ')}
                      </Badge>
                      {lastSeen && (
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(lastSeen)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleIgnoreDevice(device.deviceIdentifier)}
                  >
                    Ignore
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAssignDevice(device)}
                  >
                    Assign to Room
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAssignmentView = () => {
    if (!selectedDevice) return null;

    return (
      <AssignDeviceForm
        discoveredDevice={selectedDevice}
        defaultRoomId={defaultRoomId}
        onSuccess={handleAssignmentSuccess}
        onCancel={handleAssignmentCancel}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {viewState === 'discovery' ? 'Discover Devices' : 'Assign Device'}
          </DialogTitle>
          <DialogDescription>
            {viewState === 'discovery'
              ? 'Scan for unregistered devices on your network and assign them to rooms.'
              : `Assign "${selectedDevice?.deviceIdentifier}" to a room.`}
          </DialogDescription>
        </DialogHeader>

        {viewState === 'discovery' && renderDiscoveryView()}
        {viewState === 'assignment' && renderAssignmentView()}
      </DialogContent>
    </Dialog>
  );
};
