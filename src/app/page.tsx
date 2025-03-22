"use client";

import RoomsList from "@/components/room/RoomList";
import { useAirconContext } from "@/hooks/use-aircon";

export default function Home() {
	const airconStore = useAirconContext();

	return (
		airconStore &&
		airconStore.client &&
		airconStore.isConnected && (
			<main className="flex min-h-screen flex-col items-center p-6 bg-gradient-to-b from-background to-muted/30">
				<RoomsList />
			</main>
		)
	);
}
