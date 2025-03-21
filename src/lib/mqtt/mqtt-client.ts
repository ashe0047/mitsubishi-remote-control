"use client";
// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";
import {
	MQTT_TOPICS,
	mqttMessageSchemas,
	MqttMessageType,
	AirConState,
	MqttTopicsType,
	AirConSettings,
} from "@/lib/mqtt/mqtt-config";
import envData from "../env/config";

export const initializeMQTTClient = (
	onStateReceived: (
		state: React.SetStateAction<AirConState | AirConSettings | undefined>
	) => void,
	onConnectionStatus: (connected: boolean) => void
): MqttClient => {
	const client = mqtt.connect({
		protocol: "mqtt",
		host: envData.MQTT_BROKER_URL,
		hostname: envData.MQTT_BROKER_URL,
		port: envData.MQTT_BROKER_PORT,
		username: envData.MQTT_BROKER_USERNAME,
		password: envData.MQTT_BROKER_PASSWORD,
	});

	client.on("connect", () => {
		onConnectionStatus(true);
		client.subscribe(
			[MQTT_TOPICS.settings, MQTT_TOPICS.state],
			{ qos: 1 },
			(err) => {
				if (err) console.error("Subscription failed:", err);
			}
		);
	});

	client.on("message", (topic, message) => {
		if (topic === MQTT_TOPICS.settings) {
			try {
				const parsed = mqttMessageSchemas[MQTT_TOPICS.settings].parse(
					JSON.parse(message.toString())
				);
				onStateReceived(parsed);
			} catch (error) {
				console.error("Invalid state received:", error);
			}
		} else if (topic === MQTT_TOPICS.state) {
			try {
				const parsed = mqttMessageSchemas[MQTT_TOPICS.state].parse(
					JSON.parse(message.toString())
				);
				onStateReceived((prev) => {
					if (prev) {
						console.log("prev", prev);
						console.log("parsed", parsed);
						return {
							...parsed,
							roomTemperature:
								parsed.roomTemperature === -1 &&
								"roomTemperature" in prev
									? prev?.roomTemperature
									: parsed.roomTemperature,
						};
					}
				});
			} catch (error) {
				console.error("Invalid state received:", error);
			}
		}
	});

	client.on("error", (err) => {
		console.error("MQTT error:", err);
		onConnectionStatus(false);
	});

	return client;
};

export const publishCommand = <Topic extends MqttTopicsType>(
	client: MqttClient | null,
	topic: Topic,
	value: MqttMessageType<Topic>
) => {
	if (!client || !client.connected) {
		console.error("No active MQTT connection");
		return;
	}
	const stringValue =
		typeof value === "string"
			? value
			: typeof value === "number"
			? value.toString()
			: JSON.stringify(value);
	client.publish(topic, stringValue, { qos: 1 }, (err) => {
		if (err) console.error(`Failed to publish to ${topic}:`, err);
		else console.log(`Published to ${topic}: ${stringValue}`);
	});
};
