import { initializeMQTTClient } from "@/lib/mqtt/mqtt-client";
import { AirConSettings, AirConState } from "@/lib/mqtt/mqtt-config";
import { MqttClient } from "mqtt";
import { useEffect, useState } from "react";

/* Custom Hook: MQTT Client Initialization */
export default function useMQTTClient(
	onStateUpdate: (
		update: React.SetStateAction<AirConState | AirConSettings | undefined>
	) => void,
	onConnectionUpdate: (connected: boolean) => void
) {
	const [client, setClient] = useState<MqttClient | null>(null);
	useEffect(() => {
		const mqttClient = initializeMQTTClient(
			onStateUpdate,
			onConnectionUpdate
		);
		setClient(mqttClient);
		return () => {
			mqttClient.end();
		};
	}, [onStateUpdate, onConnectionUpdate]);
	return client;
}
