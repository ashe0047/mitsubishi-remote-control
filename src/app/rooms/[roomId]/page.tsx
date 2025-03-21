"use client";

import AirConRemote from "@/components/AirConRemote";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import useMQTTClient from "@/hooks/use-mqtt";
import { AirConSettings, AirConState } from "@/lib/mqtt/mqtt-config";
import appConfig from "@/lib/config";
import { notFound } from "next/navigation";

interface RoomPageProps {
	params: {
		roomId: string;
	};
}

export default function RoomPage({ params }: RoomPageProps) {
	const room = appConfig.rooms.find((room) => room.roomId === params.roomId);

	if (!room) {
		notFound();
	}

	const [state, setState] = useState<
		AirConState | AirConSettings | undefined
	>(undefined);
	const [isConnected, setIsConnected] = useState(false);
	// MQTT client via custom hook
	const client = useMQTTClient(setState, setIsConnected);
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<main>
				<AirConRemote
					room={room}
					client={{ client, isConnected }}
					airconState={[state, setState]}
				/>
			</main>
		</ThemeProvider>
	);
}
