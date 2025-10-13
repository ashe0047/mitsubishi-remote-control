"use client";

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TemperatureControlsProps {
  /** Current temperature value */
  temperature: number;
  /** Whether the power is on */
  isPowerOn: boolean;
  /** Callback when temperature is incremented */
  onIncrement: () => void;
  /** Callback when temperature is decremented */
  onDecrement: () => void;
  /** Callback when temperature slider changes */
  onTemperatureChange: (temperature: number) => void;
  /** Minimum temperature (default: 16) */
  minTemp?: number;
  /** Maximum temperature (default: 31) */
  maxTemp?: number;
}

/**
 * Temperature control component with +/- buttons and slider
 * Displays temperature range with disabled state when power is off
 */
export const TemperatureControls: React.FC<TemperatureControlsProps> = React.memo(({
  temperature,
  isPowerOn,
  onIncrement,
  onDecrement,
  onTemperatureChange,
  minTemp = 16,
  maxTemp = 31,
}) => {
  const handleTemperatureChange = useCallback((values: number[]) => {
    onTemperatureChange(values[0]);
  }, [onTemperatureChange]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onDecrement}
              disabled={!isPowerOn || temperature <= minTemp}
              className="h-10 w-10 rounded-full"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Decrease Temperature</TooltipContent>
        </Tooltip>

        <Slider
          disabled={!isPowerOn}
          min={minTemp}
          max={maxTemp}
          step={1}
          value={[temperature]}
          onValueChange={handleTemperatureChange}
          className={cn(
            'w-[60%] cursor-pointer transition-opacity duration-200',
            !isPowerOn && 'opacity-50'
          )}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onIncrement}
              disabled={!isPowerOn || temperature >= maxTemp}
              className="h-10 w-10 rounded-full"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Increase Temperature</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground px-2">
        <span>{minTemp}°</span>
        <span>{maxTemp}°</span>
      </div>
    </div>
  );
});

TemperatureControls.displayName = 'TemperatureControls';
