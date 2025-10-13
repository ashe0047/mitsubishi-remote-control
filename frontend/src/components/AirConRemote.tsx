"use client";

import type React from "react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODE_VALUES,
  FAN_VALUES,
  VALID_VALUES,
} from "@/lib/mqtt/mqtt-config";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Power,
  Thermometer,
  Moon,
  Wifi,
  WifiOff,
  Plus,
  Minus,
  MoonStar,
  ArrowLeft,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobile } from "@/hooks/useMobile";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useHaptic } from "@/hooks/useHaptic";
import useAirConPreferences from "@/hooks/usePrefs";
import Image from "next/image";
import { useAirconContext } from "@/hooks/useAircon";
import { useConnectionStatus } from "@/hooks/navigation/useConnectionStatus";
import { useDeviceSelection } from "@/hooks/useDeviceSelection";
import { DeviceSelector } from "@/components/devices";
import {
  getModeIcon,
  getModeColor,
  getModeDisplayName,
  getFanDisplayName,
  displayTemperature,
} from "@/utils/devices";

interface IApiAirConRemoteProps {
  room: { roomId: string; roomName: string };
}

const ApiAirConRemote = ({
  room: { roomId },
}: IApiAirConRemoteProps) => {
  const {
    getRoomInfo,
    setTemperature,
    setMode,
    setFan,
  } = useAirconContext();

  const roomInfo = getRoomInfo(roomId);
  const airconState = roomInfo?.state;

  // Device selection for multi-device rooms
  const {
    devices,
    selectedDevice,
    selectDevice,
    hasMultipleEnabledDevices,
  } = useDeviceSelection(roomId);

  // Direct navigation to home page
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateBack = useCallback(async () => {
    if (isNavigating) {
      console.log('Navigation already in progress, ignoring');
      return;
    }
    
    console.log('Starting navigation to home page');
    setIsNavigating(true);
    
    try {
      // Use replace instead of push to prevent back navigation issues
      await router.replace('/');
      console.log('Navigation completed successfully');
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      // Add slight delay to prevent rapid re-triggers
      setTimeout(() => {
        setIsNavigating(false);
        console.log('Navigation state reset');
      }, 100);
    }
  }, [router, isNavigating]);
  const { status, retryConnection, lastError } = useConnectionStatus();

  // Theme mode
  const { theme, setTheme } = useTheme();
  const isMobile = useMobile();
  const triggerHaptic = useHaptic(isMobile);
  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    triggerHaptic(30);
  };

  const [prefs, setPrefs] = useAirConPreferences();

  // Command handlers using the API store
  const handleModeChange = useCallback(async (mode: string) => {
    try {
      await setMode(roomId, mode);
      triggerHaptic(50);
    } catch (error) {
      console.error("Failed to change mode:", error);
    }
  }, [roomId, setMode, triggerHaptic]);

  const handleFanChange = useCallback(async (fan: string) => {
    try {
      await setFan(roomId, fan);
      triggerHaptic(30);
    } catch (error) {
      console.error("Failed to change fan:", error);
    }
  }, [roomId, setFan, triggerHaptic]);

  const handleTemperatureChange = useCallback(async (value: number[]) => {
    try {
      const temperature = value[0];
      if (temperature !== undefined) {
        await setTemperature(roomId, temperature);
      }
    } catch (error) {
      console.error("Failed to change temperature:", error);
    }
  }, [roomId, setTemperature]);

  const handleTemperatureStep = useCallback(async (step: number) => {
    if (airconState) {
      const newTemp = Math.min(Math.max(airconState.temperature + step, 16), 31);
      try {
        await setTemperature(roomId, newTemp);
        triggerHaptic(30);
      } catch (error) {
        console.error("Failed to change temperature:", error);
      }
    }
  }, [airconState, roomId, setTemperature, triggerHaptic]);

  const handlePowerToggle = useCallback(async () => {
    if (airconState) {
      const newMode = airconState.mode === MODE_VALUES.OFF ? MODE_VALUES.COOL : MODE_VALUES.OFF;
      try {
        await setMode(roomId, newMode);
        triggerHaptic(100);
      } catch (error) {
        console.error("Failed to toggle power:", error);
      }
    }
  }, [airconState, roomId, setMode, triggerHaptic]);

  const handleSleepModeToggle = useCallback(async () => {
    setPrefs((prev) => ({ ...prev, sleepMode: !prev.sleepMode }));

    if (!prefs.sleepMode && airconState) {
      try {
        await setFan(roomId, FAN_VALUES.ONE);
        if (airconState.mode === MODE_VALUES.COOL) {
          await setTemperature(roomId, Math.min(airconState.temperature + 2, 31));
        } else if (airconState.mode === MODE_VALUES.HEAT) {
          await setTemperature(roomId, Math.max(airconState.temperature - 2, 16));
        }
      } catch (error) {
        console.error("Failed to toggle sleep mode:", error);
      }
    }
    triggerHaptic(50);
  }, [prefs.sleepMode, airconState, roomId, setFan, setTemperature, setPrefs, triggerHaptic]);

  // Temperature display helper (now using utility)
  const displayTemp = (temp: number) => displayTemperature(temp, prefs.useFahrenheit);

  // Toggle temperature unit
  const handleTemperatureUnitToggle = () => {
    setPrefs((prev) => ({ ...prev, useFahrenheit: !prev.useFahrenheit }));
    triggerHaptic(30);
  };

  const isPowerOn = airconState && airconState.mode !== MODE_VALUES.OFF;

  // Loading state
  if (!roomInfo) {
    return (
      <div className="flex justify-center items-center min-h-screen w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading room data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="overflow-hidden rounded-xl shadow-lg border-0 bg-gradient-to-b from-background to-muted/30">
          {/* Status Bar with Navigation */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={navigateBack}
                    disabled={isNavigating}
                    className="h-8 w-8 hover:scale-105 transition-transform duration-200"
                  >
                    {isNavigating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                    ) : (
                      <ArrowLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back to rooms</TooltipContent>
              </Tooltip>
            </div>

            {/* Center: Connection Status */}
            <div className="flex items-center gap-2">
              {status.overall === 'healthy' ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-500 border-green-500/20 h-6"
                >
                  <Wifi className="h-3 w-3 mr-1" />
                  <span className="text-xs">Connected</span>
                </Badge>
              ) : status.overall === 'degraded' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 h-6 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                      onClick={retryConnection}
                    >
                      <Wifi className="h-3 w-3 mr-1" />
                      <span className="text-xs">Degraded</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>WebSocket connected, MQTT issue. Tap to retry.</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-500 border-red-500/20 h-6 cursor-pointer hover:bg-red-500/20 transition-colors"
                      onClick={retryConnection}
                    >
                      <WifiOff className="h-3 w-3 mr-1" />
                      <span className="text-xs">Disconnected</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{lastError || 'Connection failed. Tap to retry.'}</TooltipContent>
                </Tooltip>
              )}
              {roomInfo.online && (
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-500 border-blue-500/20 h-6"
                >
                  <span className="text-xs">Room Online</span>
                </Badge>
              )}
            </div>

            {/* Right: Settings */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleThemeToggle}
                    className="h-8 w-8"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <MoonStar className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleTemperatureUnitToggle}
                    className="h-8 w-8"
                  >
                    <Thermometer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {prefs.useFahrenheit ? "Switch to Celsius" : "Switch to Fahrenheit"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Device Selector - Only shows if room has multiple devices */}
          {hasMultipleEnabledDevices && (
            <div className="px-4 py-3 border-b border-border/30 bg-muted/20">
              <DeviceSelector
                roomId={roomId}
                devices={devices}
                selectedDeviceId={selectedDevice?.deviceIdentifier}
                onSelectDevice={selectDevice}
              />
            </div>
          )}

          <CardContent className="p-6">
            {!airconState ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No data available for this room</p>
              </div>
            ) : (
              <>
                {/* Temperature Display */}
                <div className="mb-8 text-center">
                  <div className="flex justify-center items-center mb-2">
                    <motion.div
                      key={`room-${"roomTemperature" in airconState ? airconState.roomTemperature : 0}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-muted-foreground"
                    >
                      Room:{" "}
                      {displayTemp("roomTemperature" in airconState ? airconState.roomTemperature : 0)}
                      °{prefs.useFahrenheit ? "F" : "C"}
                    </motion.div>
                  </div>

                  <div className="relative flex justify-center items-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`temp-${airconState.temperature}-${isPowerOn}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.4 }}
                        className="text-6xl font-light"
                      >
                        {isPowerOn ? displayTemp(airconState.temperature) : "--"}
                        <span className="text-2xl ml-1">
                          {prefs.useFahrenheit ? "°F" : "°C"}
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
                          {getModeIcon(airconState.mode)}
                          <span className="text-sm font-medium ml-1">
                            {airconState.mode}
                          </span>
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
                          disabled={!isPowerOn || airconState.temperature <= 16}
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
                      value={[airconState.temperature]}
                      onValueChange={handleTemperatureChange}
                      className={cn(
                        "w-[60%] cursor-pointer transition-opacity duration-200",
                        !isPowerOn && "opacity-50"
                      )}
                    />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTemperatureStep(1)}
                          disabled={!isPowerOn || airconState.temperature >= 31}
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
                        "rounded-full w-16 h-16 transition-all duration-300 shadow-lg",
                        isPowerOn
                          ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                          : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                      )}
                    >
                      <Power
                        className={cn(
                          "h-8 w-8",
                          isPowerOn ? "text-white" : "text-gray-500 dark:text-gray-400"
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
                      .filter((mode) => mode !== "off")
                      .map((mode) => (
                        <Tooltip key={mode}>
                          <TooltipTrigger asChild>
                            <motion.div whileTap={{ scale: 0.95 }}>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleModeChange(mode)}
                                disabled={!isPowerOn}
                                className={cn(
                                  "h-12 w-full rounded-lg transition-all duration-200",
                                  airconState.mode === mode && getModeColor(mode)
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
                                    "h-10 w-full rounded-lg p-0 shadow-sm",
                                    speed.includes(airconState.fan) &&
                                    "bg-primary text-primary-foreground"
                                  )}
                                >
                                  <span className="text-xs">
                                    {firstSpeed === "QUIET" ? "Q" : firstSpeed}
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
                      checked={prefs.sleepMode}
                      onCheckedChange={handleSleepModeToggle}
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
              </>
            )}
          </CardContent>

          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
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

export default ApiAirConRemote;