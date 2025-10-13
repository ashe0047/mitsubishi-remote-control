"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomCardProps {
	room: { roomName: string; roomId: string };
}

/**
 * RoomCard Component
 *
 * Displays a room card in the rooms list.
 * Shows basic room info without real-time data since it's used in list views
 * without WebSocket connection. Real-time data is available on the individual
 * room page which has its own WebSocket connection.
 */
export default function RoomCard({
	room: { roomName, roomId },
}: RoomCardProps) {
	const router = useRouter();

	const handleRoomSelect = () => {
		router.push(`/app/rooms/${roomId}`);
	};

	return (
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
							{/* Room icon placeholder */}
							<div
								className={cn(
									"relative h-12 w-12 rounded-xl overflow-hidden",
									"bg-muted flex items-center justify-center",
									"shadow-sm"
								)}
							>
								<span className="text-xl font-semibold text-muted-foreground">
									{roomName.charAt(0).toUpperCase()}
								</span>
							</div>

							{/* Room info */}
							<div>
								<h3 className="font-medium text-lg">
									{roomName}
								</h3>
								<p className="text-sm text-muted-foreground mt-1">
									Tap to control
								</p>
							</div>
						</div>

						{/* Chevron */}
						<ChevronRight className="h-5 w-5 text-muted-foreground/50" />
					</div>
				</div>
			</Card>
		</motion.div>
	);
}
