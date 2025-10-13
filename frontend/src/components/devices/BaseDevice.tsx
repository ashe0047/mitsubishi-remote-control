"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Power, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DeviceState {
  id: string;
  name: string;
  type: string;
  online: boolean;
  lastUpdate: string;
  power: boolean;
}

export interface BaseDeviceProps {
  device: DeviceState;
  onPowerToggle: (deviceId: string, power: boolean) => Promise<void>;
  onSettings?: (deviceId: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export interface DeviceControlProps {
  device: DeviceState;
  onUpdate: (deviceId: string, settings: Record<string, unknown>) => Promise<void>;
}

export const BaseDevice: React.FC<BaseDeviceProps> = ({
  device,
  onPowerToggle,
  onSettings,
  className,
  children,
}) => {
  const handlePowerToggle = async () => {
    try {
      await onPowerToggle(device.id, !device.power);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings(device.id);
    }
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{device.name}</CardTitle>
            <p className="text-sm text-muted-foreground capitalize">{device.type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={device.online ? 'default' : 'secondary'}
              className={cn(
                device.online
                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              )}
            >
              {device.online ? 'Online' : 'Offline'}
            </Badge>
            {!device.online && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  Device offline - Last seen: {new Date(device.lastUpdate).toLocaleTimeString()}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Power Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Power className="h-4 w-4" />
            <span className="text-sm font-medium">Power</span>
          </div>
          <Button
            variant={device.power ? "default" : "outline"}
            size="sm"
            onClick={handlePowerToggle}
            disabled={!device.online}
            className={cn(
              "transition-all duration-200",
              device.power && "bg-green-500 hover:bg-green-600"
            )}
          >
            {device.power ? 'On' : 'Off'}
          </Button>
        </div>

        {/* Device-specific controls */}
        {children}

        {/* Settings Button */}
        {onSettings && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSettings}
              disabled={!device.online}
            >
              <Settings className="h-4 w-4 mr-2" />
              More Controls
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BaseDevice;