"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Thermometer, Power, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAirconContext } from "@/hooks/use-aircon";

interface RoomCardProps {
	room: { roomName: string; roomId: string };
}

export default function RoomCard({
	room: { roomName, roomId },
}: RoomCardProps) {
	const airconStore = useAirconContext();
	const { aircons } = airconStore;
	const airconInfo = aircons[roomId];
	const router = useRouter();

	const handleRoomSelect = () => {
		router.push(`/rooms/${roomId}`);
	};

	// Get temperature color based on value
	const getTempColor = (temp: number) => {
		if (temp >= 26) return "text-orange-500 dark:text-orange-400";
		if (temp <= 20) return "text-blue-500 dark:text-blue-400";
		return "text-emerald-500 dark:text-emerald-400";
	};

	return (
		airconInfo && airconInfo.state && (
			<motion.div
				whileHover={{ scale: 1.02, y: -2 }}
				whileTap={{ scale: 0.98 }}
				transition={{ type: "spring", stiffness: 400, damping: 17 }}
			>
				<Card
					className={cn(
						"overflow-hidden cursor-pointer transition-all duration-300",
						"bg-background/50 backdrop-blur-sm hover:bg-background",
						"border border-border/40 hover:border-border",
						"shadow-sm hover:shadow-md"
					)}
					onClick={handleRoomSelect}
				>
					<div className="p-5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								{/* Room icon/image */}
								<div
									className={cn(
										"relative h-12 w-12 rounded-xl overflow-hidden",
										"bg-muted flex items-center justify-center",
										"shadow-sm"
									)}
								>
									{/* {room.icon ? (
									<room.icon className="h-6 w-6 text-muted-foreground" />
								) : (
									<Image
										src={
											room.image ||
											`/placeholder.svg?height=48&width=48&text=${roomName.charAt(
												0
											)}`
										}
										alt={roomName}
										fill
										className="object-cover"
									/>
								)} */}
								</div>

								{/* Room info */}
								<div>
									<h3 className="font-medium text-lg">
										{roomName}
									</h3>
									<div className="flex items-center mt-1 gap-3">
										{/* Temperature */}
										<div className="flex items-center text-sm">
											{airconInfo.state?.roomTemperature && (
												<>
													<Thermometer
														className={cn(
															"h-3.5 w-3.5 mr-1",
															getTempColor(
																airconInfo.state
																	.roomTemperature ||
																	airconInfo
																		.settings
																		.temperature
															)
														)}
													/>
													<span
														className={cn(
															"font-medium",
															getTempColor(
																airconInfo.state
																	.roomTemperature ||
																	airconInfo
																		.settings
																		.temperature
															)
														)}
													>
														{airconInfo.state
															.roomTemperature ||
															airconInfo.settings
																.temperature}
														°
													</span>
												</>
											)}
										</div>

										{/* AC Status */}
										{airconInfo.state.mode && (
											<Badge
												variant="outline"
												className={cn(
													"h-5 px-2 text-xs font-normal border-0",
													airconInfo.state.mode !==
														"off"
														? "bg-green-500/10 text-green-600 dark:text-green-400"
														: "bg-gray-500/10 text-gray-500"
												)}
											>
												<Power
													className={cn(
														"h-3 w-3 mr-1",
														airconInfo.state
															.mode !== "off" &&
															"animate-pulse"
													)}
												/>
												{airconInfo.state.mode !== "off"
													? "Active"
													: "Off"}
											</Badge>
										)}
									</div>
								</div>
							</div>

							{/* Chevron */}
							<ChevronRight className="h-5 w-5 text-muted-foreground/50" />
						</div>
					</div>
				</Card>
			</motion.div>
		)
	);
}
