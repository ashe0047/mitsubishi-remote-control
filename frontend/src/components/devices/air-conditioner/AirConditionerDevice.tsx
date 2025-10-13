"use client";

import React, { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useAirConditionerState,
  useAirConditionerControls,
  useDevicePreferences,
} from '@/hooks/devices';
import { useConnectionStatus } from '@/hooks/navigation/useConnectionStatus';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TemperatureDisplay } from './TemperatureDisplay';
import { TemperatureControls } from './TemperatureControls';
import { PowerButton } from './PowerButton';
import { ModeSelector } from './ModeSelector';
import { FanControl } from './FanControl';
import { SleepModeToggle } from './SleepModeToggle';

export interface AirConditionerDeviceProps {
  deviceId: string;
  deviceName: string;
  roomId: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

/**
 * Air conditioner device component matching original AirConRemote layout
 * Uses new modular architecture with hooks and utilities
 */
export const AirConditionerDevice: React.FC<AirConditionerDeviceProps> = ({
  deviceName,
  roomId,
}) => {
  const router = useRouter();
  const state = useAirConditionerState(roomId);
  const controls = useAirConditionerControls(roomId);
  const { useFahrenheit, sleepMode, toggleSleepMode } = useDevicePreferences();
  const { status } = useConnectionStatus();

  const isPowerOn = state?.isActive ?? false;

  // Map connection status for badge display
  const connectionBadge = useMemo(() => {
    if (status.overall === 'disconnected') {
      return { icon: WifiOff, label: 'Disconnected', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
    }
    if (status.websocket.state === 'connecting') {
      return { icon: Loader2, label: 'Connecting', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' };
    }
    return { icon: Wifi, label: 'Connected', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' };
  }, [status.overall, status.websocket.state]);

  const displayTemp = useCallback((temp: number) => {
    return useFahrenheit ? Math.round(temp * 1.8 + 32) : temp;
  }, [useFahrenheit]);

  const handleTemperatureChange = useCallback((temperature: number) => {
    controls.setTemperature(temperature);
  }, [controls]);

  const Icon = connectionBadge.icon;

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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.back()}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
              </Tooltip>
              <h2 className="text-lg font-semibold">{deviceName}</h2>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={cn('flex items-center gap-1', connectionBadge.className)}>
                <Icon className={cn('h-3 w-3', status.websocket.state === 'connecting' && 'animate-spin')} />
                {connectionBadge.label}
              </Badge>
            </div>
          </div>

          <CardContent className="p-6">
            {!state ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No data available for this room</p>
              </div>
            ) : (
              <>
                {/* Temperature Display */}
                <TemperatureDisplay
                  currentTemp={state.currentTemp}
                  targetTemp={state.temperature}
                  mode={state.mode}
                  isPowerOn={isPowerOn}
                  useFahrenheit={useFahrenheit}
                  displayTemp={displayTemp}
                />

                {/* Temperature Controls */}
                <TemperatureControls
                  temperature={state.temperature}
                  isPowerOn={isPowerOn}
                  onIncrement={controls.incrementTemperature}
                  onDecrement={controls.decrementTemperature}
                  onTemperatureChange={handleTemperatureChange}
                />

                {/* Power Button */}
                <PowerButton
                  isPowerOn={isPowerOn}
                  onToggle={controls.togglePower}
                />

                {/* Mode Selection */}
                <ModeSelector
                  currentMode={state.mode}
                  isPowerOn={isPowerOn}
                  onModeChange={controls.setMode}
                />

                {/* Fan Speed Controls */}
                <FanControl
                  currentFan={state.fan}
                  isPowerOn={isPowerOn}
                  onFanChange={controls.setFan}
                />

                {/* Sleep Mode */}
                <SleepModeToggle
                  sleepMode={sleepMode}
                  isPowerOn={isPowerOn}
                  onToggle={toggleSleepMode}
                />
              </>
            )}
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
