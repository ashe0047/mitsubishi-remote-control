"use client";

import React from 'react';
import { BaseDevice, DeviceState, DeviceControlProps } from './BaseDevice';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Lightbulb, Palette, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LightingState extends DeviceState {
  type: 'lighting';
  brightness: number;
  color: string;
  colorMode: 'white' | 'color';
  warmth: number; // 0-100, only for white mode
}

export interface LightingDeviceProps extends Omit<DeviceControlProps, 'device'> {
  device: LightingState;
  onPowerToggle: (deviceId: string, power: boolean) => Promise<void>;
  onSettings?: (deviceId: string) => void;
  className?: string;
}

const LightingDevice: React.FC<LightingDeviceProps> = ({
  device,
  onUpdate,
  onPowerToggle,
  onSettings,
  className,
}) => {
  const handleBrightnessChange = async (value: number[]) => {
    const brightness = value[0];
    if (brightness !== undefined) {
      await onUpdate(device.id, { brightness });
    }
  };

  const handleWarmthChange = async (value: number[]) => {
    const warmth = value[0];
    if (warmth !== undefined) {
      await onUpdate(device.id, { warmth });
    }
  };

  const handleColorModeChange = async (colorMode: string) => {
    await onUpdate(device.id, { colorMode });
  };

  const handleColorChange = async (color: string) => {
    await onUpdate(device.id, { color, colorMode: 'color' });
  };

  const presetColors = [
    '#ff0000', // Red
    '#00ff00', // Green
    '#0000ff', // Blue
    '#ffff00', // Yellow
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ff8000', // Orange
    '#8000ff', // Purple
  ];

  return (
    <BaseDevice
      device={device}
      onPowerToggle={onPowerToggle}
      onSettings={onSettings}
      className={className}
    >
      {device.power && (
        <>
          {/* Brightness Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-4 w-4" />
                <span className="text-sm font-medium">Brightness</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {device.brightness}%
              </span>
            </div>
            <Slider
              value={[device.brightness]}
              onValueChange={handleBrightnessChange}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Color Mode Selection */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4" />
              <span className="text-sm font-medium">Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={device.colorMode === 'white' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleColorModeChange('white')}
                className="flex items-center space-x-2"
              >
                <Sun className="h-4 w-4" />
                <span>White</span>
              </Button>
              <Button
                variant={device.colorMode === 'color' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleColorModeChange('color')}
                className="flex items-center space-x-2"
              >
                <Palette className="h-4 w-4" />
                <span>Color</span>
              </Button>
            </div>
          </div>

          {/* White Mode Controls */}
          {device.colorMode === 'white' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Moon className="h-3 w-3 text-blue-400" />
                    <span className="text-sm font-medium">Warmth</span>
                    <Sun className="h-3 w-3 text-yellow-400" />
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {device.warmth}%
                </span>
              </div>
              <Slider
                value={[device.warmth]}
                onValueChange={handleWarmthChange}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cool</span>
                <span>Warm</span>
              </div>
            </div>
          )}

          {/* Color Mode Controls */}
          {device.colorMode === 'color' && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Palette className="h-4 w-4" />
                <span className="text-sm font-medium">Color</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {presetColors.map((color) => (
                  <Tooltip key={color}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleColorChange(color)}
                        className={cn(
                          "h-8 w-full transition-all duration-200",
                          device.color === color && "ring-2 ring-primary ring-offset-2"
                        )}
                        style={{ backgroundColor: color }}
                      >
                        <span className="sr-only">Color {color}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{color}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Current color display */}
              <div className="flex items-center space-x-2 text-sm">
                <span>Current:</span>
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: device.color }}
                />
                <span className="text-muted-foreground">{device.color}</span>
              </div>
            </div>
          )}
        </>
      )}
    </BaseDevice>
  );
};

export default LightingDevice;