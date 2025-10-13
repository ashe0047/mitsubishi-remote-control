"use client";
// lib/mqttClient.ts
import mqtt, {
	MqttClient,
	OnCloseCallback,
	OnMessageCallback,
} from "mqtt";
import { fromEvent, Observable } from "rxjs";
import { map, share, takeUntil } from "rxjs/operators";
import {
	MQTT_TOPICS,
	mqttMessageSchemas,
	MqttMessageType,
	MqttTopicsType,
} from "@/lib/mqtt/mqtt-config";
import envData from "../env/config";

export const initializeMQTTClient = (
	
	onConnectionStatus: (connected: boolean) => void
) => {
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

	client.on("error", (err) => {
		console.error("MQTT error:", err);
		onConnectionStatus(false);
	});

	// Create the stream using fromEvent with validation and error handling in map
	const genericMqttStream$ = fromEvent(
		client,
		"message"
	) as unknown as Observable<Parameters<OnMessageCallback>>;
	const genericMqttStreamUnsubscribe$ = fromEvent(
		client,
		"close"
	) as unknown as Observable<Parameters<OnCloseCallback>>;
	const airconStream$ = genericMqttStream$
		.pipe(takeUntil(genericMqttStreamUnsubscribe$))
		.pipe(
			map(([topic, message]) => {
				try {
					const parsedMessage = 
					JSON.parse(message.toString());
					if (topic === MQTT_TOPICS.settings) {
						const parsed =
							mqttMessageSchemas[MQTT_TOPICS.settings].parse(
								parsedMessage
							);
						return { topic, message: parsed };
					} else if (topic === MQTT_TOPICS.state) {
						const parsed =
							mqttMessageSchemas[MQTT_TOPICS.state].parse(
								parsedMessage
							);
						return { topic, message: parsed };
					}
					throw new Error('Message must be either Settings/State') // Skip if topic doesn't match expected ones
				} catch (error) {
					console.error("Invalid message received:", error);
					return null; // Return null for invalid messages
				}
			}),
			share() // Share the stream among multiple subscribers
		);

	return { client, airconStream$ };
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
