"use client";
import { initializeMQTTClient } from "@/lib/mqtt/mqtt-client";
import { MQTT_TOPICS } from "@/lib/mqtt/mqtt-config";
import { getRoomIdFromTopic } from "@/lib/utils";
import createAirconStore, { AirconStore } from "@/stores/aircon-store";
import { createContext, PropsWithChildren, useEffect, useRef } from "react";

export const AirconContext = createContext<AirconStore | null>(null);

type AirconProviderProps = PropsWithChildren;
// Create a provider component to wrap your app
export const AirconContextProvider: React.FC<AirconProviderProps> = ({
	children,
}) => {
	const airconStore = useRef<AirconStore>(undefined);
	if (!airconStore.current) {
		airconStore.current = createAirconStore();
	}
	const airconState = airconStore.current.getState();
	const { client, airconStream$ } = initializeMQTTClient(
		airconState.setIsConnected
	);

	useEffect(() => {
		const airconState = airconStore.current?.getState();
		airconStream$.subscribe((data) => {
			if (!data) return;
			if (airconState) {
				const { topic, message } = data;
				const roomId = getRoomIdFromTopic(topic);
				if (topic === MQTT_TOPICS.settings) {
					airconState.setAircon(
						roomId,
						message,
						airconState.aircons[roomId]?.state
					);
				} else if (topic === MQTT_TOPICS.state) {
					airconState.setAircon(
						roomId,
						airconState.aircons[roomId]?.settings,
						message
					);
				}
			}
		});
	}, [airconStream$]);
	useEffect(() => {
		if (airconStore.current) {
			airconStore.current.setState({ client });
		}
	}, [client]);

	return (
		<AirconContext.Provider value={airconStore.current}>
			{children}
		</AirconContext.Provider>
	);
};
