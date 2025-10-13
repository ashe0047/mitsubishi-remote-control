"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Home, Users } from 'lucide-react';
import { DeviceFactory } from '../devices/DeviceFactory';
import { DeviceState } from '../devices/BaseDevice';
import { AirConState } from '../devices/AirConDevice';
import { LightingState } from '../devices/LightingDevice';
import { SensorState } from '../devices/SensorDevice';

export interface RoomInfo {
  id: string;
  name: string;
  description?: string;
  devices: DeviceState[];
}

export interface RoomDevicesProps {
  room: RoomInfo;
  onDevicePowerToggle: (deviceId: string, power: boolean) => Promise<void>;
  onDeviceUpdate: (deviceId: string, settings: Record<string, any>) => Promise<void>;
  onDeviceSettings?: (deviceId: string) => void;
  onAddDevice?: (roomId: string) => void;
  className?: string;
}

const RoomDevices: React.FC<RoomDevicesProps> = ({
  room,
  onDevicePowerToggle,
  onDeviceUpdate,
  onDeviceSettings,
  onAddDevice,
  className,
}) => {
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const handleAddDevice = () => {
    if (onAddDevice) {
      setIsAddingDevice(true);
      onAddDevice(room.id);
      setIsAddingDevice(false);
    }
  };

  const deviceCounts = room.devices.reduce((acc, device) => {
    acc[device.type] = (acc[device.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const onlineDevices = room.devices.filter(device => device.online).length;
  const activeDevices = room.devices.filter(device => device.power && device.online).length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Room Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Home className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{room.name}</h1>
              {room.description && (
                <p className="text-muted-foreground">{room.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{room.devices.length} devices</span>
            </Badge>
          </div>
        </div>

        {/* Room Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{onlineDevices}</div>
                <div className="text-sm text-muted-foreground">Online</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{activeDevices}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{deviceCounts.aircon || 0}</div>
                <div className="text-sm text-muted-foreground">A/C Units</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{deviceCounts.lighting || 0}</div>
                <div className="text-sm text-muted-foreground">Lights</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Devices Grid */}
      {room.devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {room.devices.map((device) => (
            <DeviceFactory
              key={device.id}
              device={device}
              onPowerToggle={onDevicePowerToggle}
              onUpdate={onDeviceUpdate}
              onSettings={onDeviceSettings}
            />
          ))}

          {/* Add Device Card */}
          {onAddDevice && (
            <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleAddDevice}
                  disabled={isAddingDevice}
                  className="h-auto flex-col space-y-2"
                >
                  <Plus className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {isAddingDevice ? 'Adding...' : 'Add Device'}
                  </span>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No devices in this room</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by adding your first device to control from this room.
            </p>
            {onAddDevice && (
              <Button onClick={handleAddDevice} disabled={isAddingDevice}>
                <Plus className="h-4 w-4 mr-2" />
                {isAddingDevice ? 'Adding...' : 'Add First Device'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoomDevices;