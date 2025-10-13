"use client";

import { DeviceFactory } from "@/components/devices";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QuotaStatusWidget } from "@/components/quota/QuotaStatusWidget";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { ApiAirconProvider } from "@/components/AirconProvider";
import { QuotaWebSocketContextProvider } from "@/lib/quota/quota-websocket";

export default function RoomPage() {
	const { roomId } = useParams<{
		roomId: string;
	}>();
	const user = useAuthStore((state) => state.user);
	const [isExpanded, setIsExpanded] = useState(true);
	
	// Get rooms from API
	const rooms = useRoomStore((state) => state.rooms);
	const isLoading = useRoomStore((state) => state.isLoading);
	const fetchRooms = useRoomStore((state) => state.fetchRooms);
	const hasFetchedRooms = useRoomStore((state) => state.hasFetchedRooms);
	const error = useRoomStore((state) => state.error);

	// Fetch rooms on component mount
	useEffect(() => {
		if (!hasFetchedRooms) {
			fetchRooms();
		}
	}, [fetchRooms, hasFetchedRooms]);

	// Show loading state
	if (!hasFetchedRooms || (isLoading && rooms.length === 0)) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading room...</p>
				</div>
			</div>
		);
	}

	if (error && rooms.length === 0) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Alert className="max-w-md">
					<Info className="h-4 w-4" />
					<AlertDescription>
						Unable to load rooms right now. Please try refreshing the page.
					</AlertDescription>
				</Alert>
			</div>
		);
	}
	
	const room = rooms.find((room) => room.roomIdentifier === roomId);

	if (!room) {
		notFound();
	}

	// Transform room data to match expected format
    const transformedRoom = {
        roomName: room.name,
        roomId: room.id, // Use UUID for backend WS where needed
    };

	// Content component that may or may not need quota WebSocket
    const content = (
        // Pass the UUID to the WebSocket provider (backend expects a UUID roomId)
        <ApiAirconProvider roomId={room.id}>
			<main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
				<div className="container mx-auto px-4 py-6 space-y-6">
					{/* Quota Status Integration */}
					{user && (
						<div className="space-y-4">
							{/* Prominent quota status for authenticated users */}
							<QuotaStatusWidget
								userId={user.id}
								roomId={roomId}
								showDetails={true}
								showActions={true}
								onRequestOverride={() => {
									// Handle override request - will be implemented in Phase 3
									console.log('Override request for', user.id, roomId);
								}}
							/>
						</div>
					)}
					
					{/* Show info for unauthenticated users */}
					{!user && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>
								Log in to view quota status and access advanced AC controls with usage tracking.
							</AlertDescription>
						</Alert>
					)}
					
					{/* Main AC Remote Control - New Device Factory */}
                    <DeviceFactory
                        device={{
                            type: 'air-conditioner',
                            id: room.roomIdentifier,
                            name: transformedRoom.roomName,
                            roomId: room.id, // use UUID for store/WS lookups
                        }}
						isExpanded={isExpanded}
						onExpandToggle={() => setIsExpanded(!isExpanded)}
					/>
				</div>
			</main>
		</ApiAirconProvider>
	);

	// Only wrap with QuotaWebSocketProvider if user is authenticated
	if (user) {
		return (
			<QuotaWebSocketContextProvider familyMemberId={user.id}>
				{content}
			</QuotaWebSocketContextProvider>
		);
	}

	// Return unwrapped content for unauthenticated users
	return content;
}
