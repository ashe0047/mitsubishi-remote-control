"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getModeIcon } from '@/utils/devices';

export interface TemperatureDisplayProps {
  currentTemp?: number;
  targetTemp: number;
  mode: string;
  isPowerOn: boolean;
  useFahrenheit: boolean;
  displayTemp: (temp: number) => number;
}

/**
 * Temperature Display Component
 * Shows current room temperature, target temperature, and current mode
 */
export const TemperatureDisplay = React.memo<TemperatureDisplayProps>(
  ({ currentTemp, targetTemp, mode, isPowerOn, useFahrenheit, displayTemp }) => {
    return (
      <div className="mb-8 text-center">
        {/* Room Temperature */}
        <div className="flex justify-center items-center mb-2">
          <motion.div
            key={`room-${currentTemp}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            Room: {currentTemp ? displayTemp(currentTemp) : '--'}°{useFahrenheit ? 'F' : 'C'}
          </motion.div>
        </div>

        {/* Target Temperature */}
        <div className="relative flex justify-center items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`temp-${targetTemp}-${isPowerOn}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
              className="text-6xl font-light"
            >
              {isPowerOn ? displayTemp(targetTemp) : '--'}
              <span className="text-2xl ml-1">
                {useFahrenheit ? '°F' : '°C'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mode Badge */}
        <AnimatePresence>
          {isPowerOn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex items-center justify-center mt-2"
            >
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted/50">
                {getModeIcon(mode)}
                <span className="text-sm font-medium ml-1">{mode}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

TemperatureDisplay.displayName = 'TemperatureDisplay';
