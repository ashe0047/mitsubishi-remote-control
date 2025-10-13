"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Power } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PowerButtonProps {
  /** Whether the power is currently on */
  isPowerOn: boolean;
  /** Callback when power button is clicked */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Circular power button with red/gray states
 * Shows red when on, gray when off with smooth transitions
 */
export const PowerButton: React.FC<PowerButtonProps> = React.memo(({
  isPowerOn,
  onToggle,
  className,
}) => {
  return (
    <div className={cn('flex justify-center mb-8', className)}>
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button
          size="lg"
          onClick={onToggle}
          className={cn(
            'rounded-full w-16 h-16 transition-all duration-300 shadow-lg',
            isPowerOn
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700'
          )}
        >
          <Power
            className={cn(
              'h-8 w-8',
              isPowerOn ? 'text-white' : 'text-gray-500 dark:text-gray-400'
            )}
          />
        </Button>
      </motion.div>
    </div>
  );
});

PowerButton.displayName = 'PowerButton';
