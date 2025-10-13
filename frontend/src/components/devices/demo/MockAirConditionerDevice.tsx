"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Power, Plus, Minus, Moon, Wifi, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MODE_VALUES, FAN_VALUES, VALID_VALUES } from '@/lib/mqtt/mqtt-config';
import {
  getModeIcon,
  getModeColor,
  getModeDisplayName,
  getFanDisplayName,
} from '@/utils/devices';
import Image from 'next/image';

export interface MockAirConditionerDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  initialMode?: string;
  initialTemp?: number;
  initialCurrentTemp?: number;
}

/**
 * Mock Air Conditioner Device matching original AirConRemote layout exactly
 */
export const MockAirConditionerDevice: React.FC<MockAirConditionerDeviceProps> = ({
  deviceName,
  initialMode = MODE_VALUES.COOL,
  initialTemp = 24,
  initialCurrentTemp = 26,
}) => {
  const [temperature, setTemperature] = useState(initialTemp);
  const [currentTemp] = useState(initialCurrentTemp);
  const [mode, setMode] = useState(initialMode);
  const [fan, setFan] = useState(FAN_VALUES.AUTO);
  const [sleepMode, setSleepMode] = useState(false);
  const [useFahrenheit] = useState(false);

  const isPowerOn = mode !== MODE_VALUES.OFF;

  const displayTemp = useCallback((temp: number) => {
    return useFahrenheit ? Math.round(temp * 1.8 + 32) : temp;
  }, [useFahrenheit]);

  const handleTemperatureChange = useCallback((values: number[]) => {
    setTemperature(values[0]);
  }, []);

  const handleTemperatureStep = useCallback((step: number) => {
    setTemperature(prev => {
      const newTemp = prev + step;
      return Math.max(16, Math.min(31, newTemp));
    });
  }, []);

  const handlePowerToggle = useCallback(() => {
    if (isPowerOn) {
      setMode(MODE_VALUES.OFF);
    } else {
      setMode(MODE_VALUES.COOL);
    }
  }, [isPowerOn]);

  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode);
  }, []);

  const handleFanChange = useCallback((newFan: string) => {
    setFan(newFan);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
              </Tooltip>
              <h2 className="text-lg font-semibold">{deviceName}</h2>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <Wifi className="h-3 w-3" />
                Connected
              </Badge>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Temperature Display */}
            <div className="mb-8 text-center">
              <div className="flex justify-center items-center mb-2">
                <motion.div
                  key={`room-${currentTemp}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  Room: {displayTemp(currentTemp)}°{useFahrenheit ? 'F' : 'C'}
                </motion.div>
              </div>

              <div className="relative flex justify-center items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`temp-${temperature}-${isPowerOn}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.4 }}
                    className="text-6xl font-light"
                  >
                    {isPowerOn ? displayTemp(temperature) : '--'}
                    <span className="text-2xl ml-1">
                      {useFahrenheit ? '°F' : '°C'}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

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

            {/* Temperature Controls */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleTemperatureStep(-1)}
                      disabled={!isPowerOn || temperature <= 16}
                      className="h-10 w-10 rounded-full"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Decrease Temperature</TooltipContent>
                </Tooltip>

                <Slider
                  disabled={!isPowerOn}
                  min={16}
                  max={31}
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
                      onClick={() => handleTemperatureStep(1)}
                      disabled={!isPowerOn || temperature >= 31}
                      className="h-10 w-10 rounded-full"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Increase Temperature</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground px-2">
                <span>16°</span>
                <span>31°</span>
              </div>
            </div>

            {/* Power Button */}
            <div className="flex justify-center mb-8">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  onClick={handlePowerToggle}
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

            {/* Mode Selection */}
            <div className="mb-8">
              <h3 className="text-sm font-medium mb-3 text-center">Mode</h3>
              <div className="grid grid-cols-5 gap-2">
                {VALID_VALUES.mode
                  .filter((m) => m !== 'off')
                  .map((m) => (
                    <Tooltip key={m}>
                      <TooltipTrigger asChild>
                        <motion.div whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleModeChange(m)}
                            disabled={!isPowerOn}
                            className={cn(
                              'h-12 w-full rounded-lg transition-all duration-200',
                              mode === m && getModeColor(m)
                            )}
                          >
                            {getModeIcon(m)}
                          </Button>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent>{getModeDisplayName(m)}</TooltipContent>
                    </Tooltip>
                  ))}
              </div>
            </div>

            {/* Fan Speed Controls */}
            <div className="mb-8">
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
                              onClick={() => handleFanChange(firstSpeed)}
                              disabled={!isPowerOn}
                              className={cn(
                                'h-10 w-full rounded-lg p-0 shadow-sm',
                                speed.includes(fan) && 'bg-primary text-primary-foreground'
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

            {/* Sleep Mode */}
            <div className="flex justify-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sleep-mode"
                  checked={sleepMode}
                  onCheckedChange={setSleepMode}
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
          </CardContent>

          {/* Footer - Mitsubishi Branding */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
            <Image
              className="ml-auto mr-2"
              src="/icons/brand-logo.svg"
              alt="brand"
              unoptimized
              width={25}
              height={25}
            />
            <h4 className="text-2xl mr-auto">Mitsubishi</h4>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
