"use client";

import { motion, AnimatePresence } from "framer-motion";
import RoomCard from "@/components/room/RoomCard";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useEffect } from "react";
import { useRoomStore } from "@/stores/room-store";

export interface RoomListProps {
	title?: string;           // NEW: Override default title
	description?: string;     // NEW: Override default description
	className?: string;       // For future styling needs
}

/**
 * RoomsList Component
 *
 * Displays a list of available rooms from the room API.
 * Does not require ApiAirconProvider as it shows all rooms without WebSocket connection.
 * Individual room pages handle their own WebSocket connections.
 */
export default function RoomsList({ title, description, className }: RoomListProps = {}) {
	const { theme, setTheme } = useTheme();
	
	// Use room store to fetch rooms from API
	const rooms = useRoomStore((state) => state.rooms);
	const isLoading = useRoomStore((state) => state.isLoading);
	const error = useRoomStore((state) => state.error);
	const fetchRooms = useRoomStore((state) => state.fetchRooms);

	// Fetch rooms on component mount
	useEffect(() => {
		fetchRooms();
	}, [fetchRooms]);

	// Transform API room data to match expected format
	const transformedRooms = rooms.map(room => ({
		roomName: room.name,
		roomId: room.roomIdentifier, // Use roomIdentifier as the roomId for routing
	}));

	const isEmpty = transformedRooms.length === 0;

	// Get display content - use props or fallback to defaults
	const displayTitle = title || "My Spaces";
	const displayDescription = description || "Select a room to control its climate";

    return (
		<div className="space-y-8 w-full max-w-md mx-auto">
			{/* Header with theme toggle */}
			<div className="flex justify-between items-center pt-6">
				<Button
					variant="ghost"
					size="icon"
					onClick={() =>
						setTheme(theme === "dark" ? "light" : "dark")
					}
					className="rounded-full h-10 w-10"
					aria-label={
						theme === "dark"
							? "Switch to light mode"
							: "Switch to dark mode"
					}
				>
					{theme === "dark" ? (
						<Sun className="h-5 w-5" />
					) : (
						<Moon className="h-5 w-5" />
					)}
				</Button>
			</div>

			{/* Title section with subtle animation */}
			<motion.div
				className="text-left"
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<h1 className="text-3xl font-light tracking-tight mb-2">
					{displayTitle}
				</h1>
				<p className="text-muted-foreground text-sm">
					{displayDescription}
				</p>
			</motion.div>

			{/* Loading state */}
			{isLoading && (
				<motion.div
					className="flex flex-col items-center justify-center py-12 text-center"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground text-sm">Loading rooms...</p>
				</motion.div>
			)}

			{/* Error state */}
			{error && !isLoading && (
				<motion.div
					className="flex flex-col items-center justify-center py-12 text-center"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<p className="text-red-500 text-sm mb-2">Failed to load rooms</p>
					<p className="text-muted-foreground text-xs mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={() => fetchRooms()}>
						Try Again
					</Button>
				</motion.div>
			)}

			{/* Empty state */}
			{isEmpty && !isLoading && !error && (
				<motion.div
					className="flex flex-col items-center justify-center py-12 text-center"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<p className="text-muted-foreground text-sm mb-2">No rooms found</p>
					<p className="text-muted-foreground text-xs">
						Contact your administrator to add rooms
					</p>
				</motion.div>
			)}

			{/* Room cards with staggered animation */}
			{transformedRooms.length > 0 && !isLoading && (
				<div className="space-y-4">
					<AnimatePresence>
						{transformedRooms.map(({ roomName, roomId }, index) => (
							<motion.div
								key={roomId}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{
									duration: 0.4,
									delay: index * 0.1,
									ease: [0.22, 1, 0.36, 1],
								}}
							>
								<RoomCard room={{ roomName, roomId }} />
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			)}

		</div>
	);
}
