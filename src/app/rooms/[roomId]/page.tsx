"use client";

import AirConRemote from "@/components/AirConRemote";
import { notFound, useParams } from "next/navigation";
import { useAirconContext } from "@/hooks/use-aircon";
import { useContext } from "react";
import AppConfigContext from "@/components/AppConfig";

export default function RoomPage() {
	const { roomId } = useParams<{
		roomId: string;
	}>();
	const appConfig = useContext(AppConfigContext);
	if (!appConfig) {
		notFound();
	}
	const room = appConfig.rooms.find((room) => room.roomId === roomId);

	if (!room) {
		notFound();
	}

	const { client, isConnected } = useAirconContext();
	return (
		<main>
			<AirConRemote room={room} client={{ client, isConnected }} />
		</main>
	);
}
