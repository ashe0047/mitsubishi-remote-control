"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VALID_VALUES } from '@/lib/mqtt/mqtt-config';
import {
  getModeIcon,
  getModeColor,
  getModeDisplayName,
} from '@/utils/devices';
import type { AirconMode } from '@/lib/mqtt/mqtt-config';

export interface ModeSelectorProps {
  /** Current selected mode */
  currentMode: AirconMode;
  /** Whether the power is on */
  isPowerOn: boolean;
  /** Callback when mode is selected */
  onModeChange: (mode: AirconMode) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Mode selector grid with 5 columns (excluding 'off' mode)
 * Displays mode icons with color highlighting for active mode
 */
export const ModeSelector: React.FC<ModeSelectorProps> = React.memo(({
  currentMode,
  isPowerOn,
  onModeChange,
  className,
}) => {
  return (
    <div className={cn('mb-8', className)}>
      <h3 className="text-sm font-medium mb-3 text-center">Mode</h3>
      <div className="grid grid-cols-5 gap-2">
        {VALID_VALUES.mode
          .filter((mode) => mode !== 'off')
          .map((mode) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onModeChange(mode)}
                    disabled={!isPowerOn}
                    className={cn(
                      'h-12 w-full rounded-lg transition-all duration-200',
                      currentMode === mode && getModeColor(mode)
                    )}
                  >
                    {getModeIcon(mode)}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{getModeDisplayName(mode)}</TooltipContent>
            </Tooltip>
          ))}
      </div>
    </div>
  );
});

ModeSelector.displayName = 'ModeSelector';
