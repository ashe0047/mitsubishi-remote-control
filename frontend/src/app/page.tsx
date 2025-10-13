"use client";

import RoomsList from "@/components/room/RoomList";
import { useAirconContext } from "@/hooks/useAircon";
import { RequireAuth } from "@/components/providers/AuthProvider";
import { QuotaWebSocketContextProvider } from "@/lib/quota/quota-websocket";
import { useAuthStore } from "@/stores/auth-store";

export default function Home() {
	return (
		<RequireAuth>
			<HomeContent />
		</RequireAuth>
	);
}

function HomeContent() {
	const airconData = useAirconContext();
	const user = useAuthStore((state) => state.user);

	// Use normalized interface - much simpler!
	const isReady = airconData.isConnected;

	const content = (
		<main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
			<div className="flex flex-col items-center px-6 py-6">
				{isReady ? (
					<RoomsList />
				) : (
					<div className="flex items-center justify-center min-h-[50vh]">
						<div className="text-center">
							<h2 className="text-lg font-semibold mb-2">Connecting...</h2>
							<p className="text-muted-foreground">Establishing connection to air conditioning units</p>
						</div>
					</div>
				)}
			</div>
		</main>
	);

	// Wrap with QuotaWebSocketProvider if user is authenticated
	if (user) {
		return (
			<QuotaWebSocketContextProvider familyMemberId={user.id}>
				{content}
			</QuotaWebSocketContextProvider>
		);
	}

	return content;
}
