"use client";

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SleepModeToggleProps {
  /** Whether sleep mode is active */
  sleepMode: boolean;
  /** Whether the power is on */
  isPowerOn: boolean;
  /** Callback when sleep mode is toggled */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Sleep mode toggle switch with moon icon
 * Disabled when power is off
 */
export const SleepModeToggle: React.FC<SleepModeToggleProps> = React.memo(({
  sleepMode,
  isPowerOn,
  onToggle,
  className,
}) => {
  return (
    <div className={cn('flex justify-center', className)}>
      <div className="flex items-center space-x-2">
        <Switch
          id="sleep-mode"
          checked={sleepMode}
          onCheckedChange={onToggle}
          disabled={!isPowerOn}
        />
        <label
          htmlFor="sleep-mode"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
        >
          <Moon className="h-4 w-4 mr-2" />
          Sleep Mode
        </label>
      </div>
    </div>
  );
});

SleepModeToggle.displayName = 'SleepModeToggle';
