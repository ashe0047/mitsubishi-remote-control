"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VALID_VALUES } from '@/lib/mqtt/mqtt-config';
import { getFanDisplayName } from '@/utils/devices';
import type { AirconFan } from '@/lib/mqtt/mqtt-config';

export interface FanControlProps {
  /** Current fan speed */
  currentFan: AirconFan;
  /** Whether the power is on */
  isPowerOn: boolean;
  /** Callback when fan speed is changed */
  onFanChange: (fan: AirconFan) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Fan speed control with 6-column grid layout
 * Arranges fan speeds in two rows with paired speeds
 */
export const FanControl: React.FC<FanControlProps> = React.memo(({
  currentFan,
  isPowerOn,
  onFanChange,
  className,
}) => {
  return (
    <div className={cn('mb-8', className)}>
      <h3 className="text-sm font-medium mb-3 text-center">Fan Speed</h3>
      <div className="grid grid-cols-6 gap-1">
        {VALID_VALUES.fan
          .reduce<(typeof VALID_VALUES.fan)[number][][]>((acc, speed, ind) => {
            const midInd = VALID_VALUES.fan.length / 2;
            if (ind < midInd) {
              acc.push([
                VALID_VALUES.fan[ind] as (typeof VALID_VALUES.fan)[number],
                VALID_VALUES.fan[midInd + ind] as (typeof VALID_VALUES.fan)[number],
              ]);
            }
            return acc;
          }, [])
          .map((speed, ind) => {
            const firstSpeed = speed[0];
            if (!firstSpeed) return null;

            return (
              <Tooltip key={ind}>
                <TooltipTrigger asChild>
                  <motion.div whileTap={{ scale: 0.95 }} className="w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onFanChange(firstSpeed)}
                      disabled={!isPowerOn}
                      className={cn(
                        'h-10 w-full rounded-lg p-0 shadow-sm',
                        speed.includes(currentFan) && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <span className="text-xs">
                        {firstSpeed === 'QUIET' ? 'Q' : firstSpeed}
                      </span>
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>{getFanDisplayName(firstSpeed)}</TooltipContent>
              </Tooltip>
            );
          })}
      </div>
    </div>
  );
});

FanControl.displayName = 'FanControl';
