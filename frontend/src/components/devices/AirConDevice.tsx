"use client";

import React from 'react';
import { BaseDevice, DeviceState, DeviceControlProps } from './BaseDevice';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Thermometer, Wind, Snowflake, Sun, Droplets, Fan, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AirConState extends DeviceState {
  type: 'aircon';
  temperature: number;
  roomTemperature: number;
  mode: 'off' | 'heat' | 'cool' | 'dry' | 'fan_only' | 'heat_cool';
  fanSpeed: 'auto' | 'low' | 'medium' | 'high' | 'quiet';
}

export interface AirConDeviceProps extends Omit<DeviceControlProps, 'device'> {
  device: AirConState;
  onPowerToggle: (deviceId: string, power: boolean) => Promise<void>;
  onSettings?: (deviceId: string) => void;
  className?: string;
}

const AirConDevice: React.FC<AirConDeviceProps> = ({
  device,
  onUpdate,
  onPowerToggle,
  onSettings,
  className,
}) => {
  const handleTemperatureChange = async (value: number[]) => {
    const temperature = value[0];
    if (temperature !== undefined) {
      await onUpdate(device.id, { temperature });
    }
  };

  const handleTemperatureStep = async (step: number) => {
    const newTemp = Math.min(Math.max(device.temperature + step, 16), 30);
    await onUpdate(device.id, { temperature: newTemp });
  };

  const handleModeChange = async (mode: string) => {
    await onUpdate(device.id, { mode });
  };

  const handleFanChange = async (fanSpeed: string) => {
    await onUpdate(device.id, { fanSpeed });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'heat':
        return <Sun className="h-4 w-4" />;
      case 'cool':
        return <Snowflake className="h-4 w-4" />;
      case 'dry':
        return <Droplets className="h-4 w-4" />;
      case 'fan_only':
        return <Fan className="h-4 w-4" />;
      case 'heat_cool':
        return <Wind className="h-4 w-4" />;
      default:
        return <Wind className="h-4 w-4" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'heat':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'cool':
        return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'dry':
        return 'bg-teal-500 text-white hover:bg-teal-600';
      case 'fan_only':
        return 'bg-gray-500 text-white hover:bg-gray-600';
      case 'heat_cool':
        return 'bg-purple-500 text-white hover:bg-purple-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const modes = ['heat', 'cool', 'dry', 'fan_only', 'heat_cool'];
  const fanSpeeds = ['auto', 'low', 'medium', 'high', 'quiet'];

  return (
    <BaseDevice
      device={device}
      onPowerToggle={onPowerToggle}
      onSettings={onSettings}
      className={className}
    >
      {/* Room Temperature Display */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <Thermometer className="h-4 w-4" />
          <span>Room Temperature</span>
        </div>
        <Badge variant="outline">
          {device.roomTemperature}°C
        </Badge>
      </div>

      {/* Target Temperature Control */}
      {device.power && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4" />
                <span className="text-sm font-medium">Target Temperature</span>
              </div>
              <div className="flex items-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTemperatureStep(-1)}
                      disabled={device.temperature <= 16}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Decrease</TooltipContent>
                </Tooltip>

                <span className="text-sm font-medium min-w-[3rem] text-center">
                  {device.temperature}°C
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTemperatureStep(1)}
                      disabled={device.temperature >= 30}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Increase</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Slider
              value={[device.temperature]}
              onValueChange={handleTemperatureChange}
              min={16}
              max={30}
              step={1}
              className="w-full"
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>16°C</span>
              <span>30°C</span>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Wind className="h-4 w-4" />
              <span className="text-sm font-medium">Mode</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((mode) => (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleModeChange(mode)}
                      className={cn(
                        "h-10 transition-all duration-200",
                        device.mode === mode && getModeColor(mode)
                      )}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        {getModeIcon(mode)}
                        <span className="text-xs capitalize">
                          {mode.replace('_', ' ')}
                        </span>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{mode.replace('_', ' ')}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Fan Speed */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Fan className="h-4 w-4" />
              <span className="text-sm font-medium">Fan Speed</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {fanSpeeds.map((speed) => (
                <Tooltip key={speed}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFanChange(speed)}
                      className={cn(
                        "h-8 text-xs transition-all duration-200",
                        device.fanSpeed === speed && "bg-primary text-primary-foreground"
                      )}
                    >
                      {speed === 'quiet' ? 'Q' : speed.charAt(0).toUpperCase()}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{speed}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </>
      )}
    </BaseDevice>
  );
};

export default AirConDevice;