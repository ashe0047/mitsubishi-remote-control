"use client";

import type React from "react";

import { useCallback, useRef } from "react";
import type { MqttClient } from "mqtt";
import {
	MODE_VALUES,
	FAN_VALUES,
	MQTT_TOPICS,
	VALID_VALUES,
	type AirConState,
	type MqttMessageType,
	type MqttTopicsType,
} from "@/lib/mqtt/mqtt-config";
import { publishCommand } from "@/lib/mqtt/mqtt-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Power,
	Thermometer,
	Fan,
	Snowflake,
	Sun,
	Wind,
	Droplets,
	Moon,
	Wifi,
	WifiOff,
	Plus,
	Minus,
	MoonStar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useHaptic } from "@/hooks/use-haptic";
import useAirConPreferences from "@/hooks/use-prefs";
import Image from "next/image";
import { useAirconContext } from "@/hooks/use-aircon";

//TODO: check mode comparison to highligh mode button
// Implement room based control

interface IAirConRemoteProps {
	client: { client: MqttClient | null; isConnected: boolean };
	room: { roomId: string; roomName: string };
}
const AirConRemote = ({
	client: { client, isConnected },
	room: { roomId, roomName },
}: IAirConRemoteProps) => {
	const { updateState, getAirconForRoom } = useAirconContext();
	const airconState = getAirconForRoom(roomId)?.state;
	// Theme mode
	const { theme, setTheme } = useTheme();
	const isMobile = useMobile();
	const triggerHaptic = useHaptic(isMobile);
	const handleThemeToggle = () => {
		setTheme(theme === "dark" ? "light" : "dark");
		triggerHaptic(30);
	};

	// Core state

	const [prefs, setPrefs] = useAirConPreferences();

	// Publish MQTT command and update local state if applicable
	const updateAndSend = useCallback(
		<Topic extends MqttTopicsType>(
			topic: Topic,
			value: MqttMessageType<Topic>
		) => {
			publishCommand(client, topic, value);
			if (
				topic !== MQTT_TOPICS.system &&
				topic !== MQTT_TOPICS.remoteTemp
			) {
				updateState(roomId, {
					[topic.split("/")[2] as keyof AirConState]: value,
				});
			}
		},
		[client, updateState, roomId]
	);

	// Temperature display helper
	const displayTemp = (temp: number) =>
		prefs.useFahrenheit ? Math.round(temp * 1.8 + 32) : temp;

	// Handlers for mode, fan, temperature, power, etc.
	const handleModeChange = (
		mode: MqttMessageType<typeof MQTT_TOPICS.mode>
	) => {
		updateAndSend(MQTT_TOPICS.mode, mode);
		triggerHaptic(50);
	};

	const handleFanChange = (fan: MqttMessageType<typeof MQTT_TOPICS.fan>) => {
		updateAndSend(MQTT_TOPICS.fan, fan);
		triggerHaptic(30);
	};

	// Temperature change handler
	const handleTemperatureChange = (value: number[]) => {
		updateAndSend(MQTT_TOPICS.temp, value[0]);
	};

	// Temperature increment/decrement handler
	const handleTemperatureStep = (step: number) => {
		if (airconState) {
			const newTemp = Math.min(
				Math.max(airconState.temperature + step, 16),
				31
			);
			updateAndSend(MQTT_TOPICS.temp, newTemp);
			triggerHaptic(30);
		}
	};

	// Power toggle handler
	const handlePowerToggle = () => {
		if (airconState) {
			const newMode =
				airconState.mode === MODE_VALUES.OFF
					? MODE_VALUES.COOL
					: MODE_VALUES.OFF;
			updateAndSend(
				MQTT_TOPICS.mode,
				newMode as MqttMessageType<typeof MQTT_TOPICS.mode>
			);
			triggerHaptic(100);
		}
	};

	// Toggle sleep mode
	const handleSleepModeToggle = () => {
		setPrefs((prev) => ({ ...prev, sleepMode: !prev.sleepMode }));

		// In a real implementation, we would send sleep mode setting to the AC unit
		if (!prefs.sleepMode && airconState) {
			// When enabling sleep mode, adjust settings for comfort
			updateAndSend(MQTT_TOPICS.fan, FAN_VALUES.ONE);
			if (airconState.mode === MODE_VALUES.COOL) {
				updateAndSend(
					MQTT_TOPICS.temp,
					Math.min(airconState.temperature + 2, 31)
				);
			} else if (airconState.mode === MODE_VALUES.HEAT) {
				updateAndSend(
					MQTT_TOPICS.temp,
					Math.max(airconState.temperature - 2, 16)
				);
			}
		}
		triggerHaptic(50);
	};

	// Toggle temperature unit
	const handleTemperatureUnitToggle = () => {
		setPrefs((prev) => ({ ...prev, useFahrenheit: !prev.useFahrenheit }));

		triggerHaptic(30);
	};

	// Utility functions for tooltips and icons
	const getFanTooltipDisplay = (
		fan: MqttMessageType<typeof MQTT_TOPICS.fan>
	) => {
		switch (fan) {
			case FAN_VALUES.AUTO:
				return "Auto";
			case FAN_VALUES.ONE:
				return "Low";
			case FAN_VALUES.TWO:
				return "Middle";
			case FAN_VALUES.THREE:
				return "Medium";
			case FAN_VALUES.FOUR:
				return "High";
			case FAN_VALUES.QUIET:
				return "Quiet";
		}
	};
	// Get mode icon
	const getModeIcon = (mode: (typeof VALID_VALUES.mode)[number]) => {
		switch (mode) {
			case MODE_VALUES.HEAT:
				return <Sun className="h-5 w-5" />;
			case MODE_VALUES.COOL:
				return <Snowflake className="h-5 w-5" />;
			case MODE_VALUES.DRY:
				return <Droplets className="h-5 w-5" />;
			case MODE_VALUES.FAN_ONLY:
				return <Fan className="h-5 w-5" />;
			case MODE_VALUES.HEAT_COOL:
				return <Wind className="h-5 w-5" />;
			default:
				return <Power className="h-5 w-5" />;
		}
	};

	const getModeTooltipDisplay = (
		mode: (typeof VALID_VALUES.mode)[number]
	) => {
		switch (mode) {
			case MODE_VALUES.HEAT:
				return "Heat";
			case MODE_VALUES.COOL:
				return "Cool";
			case MODE_VALUES.DRY:
				return "Dry";
			case MODE_VALUES.FAN_ONLY:
				return "Fan";
			case MODE_VALUES.HEAT_COOL:
				return "Auto";
			default:
				return "Off";
		}
	};

	// Get mode color
	const getModeColor = (mode: (typeof VALID_VALUES.mode)[number]) => {
		switch (mode) {
			case MODE_VALUES.HEAT:
				return "bg-orange-500 text-white hover:bg-orange-600";
			case MODE_VALUES.COOL:
				return "bg-blue-500 text-white hover:bg-blue-600";
			case MODE_VALUES.DRY:
				return "bg-teal-500 text-white hover:bg-teal-600";
			case MODE_VALUES.FAN_ONLY:
				return "bg-gray-500 text-white hover:bg-gray-600";
			case MODE_VALUES.HEAT_COOL:
				return "bg-purple-500 text-white hover:bg-purple-600";
			default:
				return "bg-primary text-primary-foreground";
		}
	};

	// Touch gesture handling via refs
	const touchStartY = useRef<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartY.current = e.touches[0].clientY;
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (
			touchStartY.current === null ||
			!airconState ||
			airconState.mode === MODE_VALUES.OFF
		)
			return;

		const touchY = e.touches[0].clientY;
		const diffY = touchStartY.current - touchY;

		// Vertical swipe - adjust temperature
		if (Math.abs(diffY) > 30) {
			if (diffY > 0) {
				// Swipe up - increase temperature
				updateAndSend(
					MQTT_TOPICS.temp,
					Math.min(airconState.temperature + 1, 31)
				);
			} else {
				// Swipe down - decrease temperature
				updateAndSend(
					MQTT_TOPICS.temp,
					Math.max(airconState.temperature - 1, 16)
				);
			}
			touchStartY.current = touchY;

			triggerHaptic(20);
		}
	};

	const handleTouchEnd = () => {
		touchStartY.current = null;
	};

	const isPowerOn = airconState && airconState.mode !== MODE_VALUES.OFF;

	return (
		airconState && (
			<TooltipProvider delayDuration={300}>
				<div
					ref={containerRef}
					className="flex justify-center items-center min-h-screen w-full"
				>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, ease: "easeOut" }}
						className="w-full max-w-sm"
					>
						<Card
							className="overflow-hidden rounded-xl shadow-lg border-0 bg-gradient-to-b from-background to-muted/30"
							onTouchStart={handleTouchStart}
							onTouchMove={handleTouchMove}
							onTouchEnd={handleTouchEnd}
						>
							{/* Status Bar */}
							<div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
								<div className="flex items-center gap-2">
									{isConnected ? (
										<Badge
											variant="outline"
											className="bg-green-500/10 text-green-500 border-green-500/20 h-6"
										>
											<Wifi className="h-3 w-3 mr-1" />
											<span className="text-xs">
												Connected
											</span>
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="bg-red-500/10 text-red-500 border-red-500/20 h-6"
										>
											<WifiOff className="h-3 w-3 mr-1" />
											<span className="text-xs">
												Disconnected
											</span>
										</Badge>
									)}
								</div>
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
											{theme === "dark"
												? "Switch to Light Mode"
												: "Switch to Dark Mode"}
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={
													handleTemperatureUnitToggle
												}
												className="h-8 w-8"
											>
												<Thermometer className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											{prefs.useFahrenheit
												? "Switch to Celsius"
												: "Switch to Fahrenheit"}
										</TooltipContent>
									</Tooltip>
								</div>
							</div>

							<CardContent className="p-6">
								{/* Temperature Display */}
								<div className="mb-8 text-center">
									<div className="flex justify-center items-center mb-2">
										<motion.div
											key={`room-${
												"roomTemperature" in airconState
													? airconState.roomTemperature
													: 0
											}`}
											initial={{ opacity: 0, y: -10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.3 }}
											className="text-sm text-muted-foreground"
										>
											Room:{" "}
											{displayTemp(
												"roomTemperature" in airconState
													? airconState.roomTemperature
													: 0
											)}
											°{prefs.useFahrenheit ? "F" : "C"}
										</motion.div>
									</div>

									<div className="relative flex justify-center items-center">
										<AnimatePresence mode="wait">
											<motion.div
												key={`temp-${airconState.temperature}-${isPowerOn}`}
												initial={{
													opacity: 0,
													scale: 0.8,
												}}
												animate={{
													opacity: 1,
													scale: 1,
												}}
												exit={{
													opacity: 0,
													scale: 0.8,
												}}
												transition={{ duration: 0.4 }}
												className="text-6xl font-light"
											>
												{isPowerOn
													? displayTemp(
															airconState.temperature
													  )
													: "--"}
												<span className="text-2xl ml-1">
													{prefs.useFahrenheit
														? "°F"
														: "°C"}
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
												transition={{
													duration: 0.3,
													delay: 0.1,
												}}
												className="flex items-center justify-center mt-2"
											>
												<div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted/50">
													{getModeIcon(
														airconState.mode
													)}
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
													onClick={() =>
														handleTemperatureStep(
															-1
														)
													}
													disabled={
														!isPowerOn ||
														airconState.temperature <=
															16
													}
													className="h-10 w-10 rounded-full"
												>
													<Minus className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												Decrease Temperature
											</TooltipContent>
										</Tooltip>

										<Slider
											disabled={!isPowerOn}
											min={16}
											max={31}
											step={1}
											value={[airconState.temperature]}
											onValueChange={
												handleTemperatureChange
											}
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
													onClick={() =>
														handleTemperatureStep(1)
													}
													disabled={
														!isPowerOn ||
														airconState.temperature >=
															31
													}
													className="h-10 w-10 rounded-full"
												>
													<Plus className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												Increase Temperature
											</TooltipContent>
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
													isPowerOn
														? "text-white"
														: "text-gray-500 dark:text-gray-400"
												)}
											/>
										</Button>
									</motion.div>
								</div>

								{/* Mode Selection */}
								<div className="mb-8">
									<h3 className="text-sm font-medium mb-3 text-center">
										Mode
									</h3>
									<div className="grid grid-cols-5 gap-2">
										{VALID_VALUES.mode
											.filter((mode) => mode !== "off")
											.map((mode) => (
												<Tooltip key={mode}>
													<TooltipTrigger asChild>
														<motion.div
															whileTap={{
																scale: 0.95,
															}}
														>
															<Button
																variant="outline"
																size="icon"
																onClick={() =>
																	handleModeChange(
																		mode
																	)
																}
																disabled={
																	!isPowerOn
																}
																className={cn(
																	"h-12 w-full rounded-lg transition-all duration-200",
																	airconState.mode ===
																		mode &&
																		getModeColor(
																			mode
																		)
																)}
															>
																{getModeIcon(
																	mode
																)}
															</Button>
														</motion.div>
													</TooltipTrigger>
													<TooltipContent>
														{getModeTooltipDisplay(
															mode
														)}
													</TooltipContent>
												</Tooltip>
											))}
									</div>
								</div>

								{/* Fan Speed Controls */}
								<div className="mb-8">
									<h3 className="text-sm font-medium mb-3 text-center">
										Fan Speed
									</h3>
									<div className="grid grid-cols-6 gap-1">
										{VALID_VALUES.fan
											.reduce<
												(typeof VALID_VALUES.fan)[number][][]
											>((acc, speed, ind) => {
												const midInd =
													VALID_VALUES.fan.length / 2;
												if (ind < midInd) {
													acc.push([
														VALID_VALUES.fan[
															ind
														] as (typeof VALID_VALUES.fan)[number],
														VALID_VALUES.fan[
															midInd + ind
														] as (typeof VALID_VALUES.fan)[number],
													]);
												}
												return acc;
											}, [])
											// .filter(
											// 	(speed) =>
											// 		![
											// 			"auto",
											// 			"low",
											// 			"middle",
											// 			"medium",
											// 			"high",
											// 			"diffuse",
											// 		].includes(speed)
											// )
											.map((speed, ind) => (
												<Tooltip key={ind}>
													<TooltipTrigger asChild>
														<motion.div
															whileTap={{
																scale: 0.95,
															}}
															className="w-full"
														>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleFanChange(
																		speed[0] as MqttMessageType<
																			typeof MQTT_TOPICS.fan
																		>
																	)
																}
																disabled={
																	!isPowerOn
																}
																className={cn(
																	"h-10 w-full rounded-lg p-0 shadow-sm",
																	speed.includes(
																		airconState.fan
																	) &&
																		"bg-primary text-primary-foreground"
																)}
															>
																<span className="text-xs">
																	{speed[0] ===
																	"QUIET"
																		? "Q"
																		: speed[0]}
																</span>
															</Button>
														</motion.div>
													</TooltipTrigger>
													<TooltipContent>
														{getFanTooltipDisplay(
															speed[0]
														)}
													</TooltipContent>
												</Tooltip>
											))}
									</div>
								</div>

								{/* Sleep Mode */}
								<div className="flex justify-center">
									<div className="flex items-center space-x-2">
										<Switch
											id="sleep-mode"
											checked={prefs.sleepMode}
											onCheckedChange={
												handleSleepModeToggle
											}
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

								{/* Gesture Hint */}
								<div className="mt-6 text-center text-xs text-muted-foreground">
									<p>Swipe up/down to adjust temperature</p>
								</div>
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
			</TooltipProvider>
		)
	);
};

export default AirConRemote;
