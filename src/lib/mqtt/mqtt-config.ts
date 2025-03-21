// lib/mqttConfig.ts
import { z } from "zod";
import envData from "../env/config";

export const MQTT_BASE_TOPIC = "mitsubishi2mqtt/second_bedroom_aircon"; // Adjust as needed

export const MQTT_TOPICS = {
	mode: `${MQTT_BASE_TOPIC}/mode/set` as const,
	temp: `${MQTT_BASE_TOPIC}/temp/set` as const,
	fan: `${MQTT_BASE_TOPIC}/fan/set` as const,
	vane: `${MQTT_BASE_TOPIC}/vane/set` as const,
	wideVane: `${MQTT_BASE_TOPIC}/wideVane/set` as const,
	remoteTemp: `${MQTT_BASE_TOPIC}/remote_temp/set` as const,
	state: `${MQTT_BASE_TOPIC}/state` as const,
	settings: `${MQTT_BASE_TOPIC}/settings` as const,
	system: `${MQTT_BASE_TOPIC}/system/set` as const,
};

export type MqttTopicsType = {
	[key in keyof typeof MQTT_TOPICS]: (typeof MQTT_TOPICS)[key];
}[keyof typeof MQTT_TOPICS];

// Valid values as const arrays
export const VALID_VALUES = {
	mode: ["off", "heat_cool", "cool", "dry", "heat", "fan_only"] as const,
	fan: [
		"AUTO",
		"1",
		"2",
		"3",
		"4",
		"QUIET",
		"auto",
		"low",
		"middle",
		"medium",
		"high",
		"diffuse",
	] as const,
	vane: ["AUTO", "1", "2", "3", "4", "5", "SWING"] as const,
	wideVane: ["<<", "<", "|", ">", ">>", "SWING"] as const, // "<>" omitted unless confirmed
	system: ["reboot"] as const,
} as const;

export const MODE_VALUES = {
	OFF: "off",
	HEAT_COOL: "heat_cool",
	COOL: "cool",
	DRY: "dry",
	HEAT: "heat",
	FAN_ONLY: "fan_only",
} as const;

export const FAN_VALUES = {
	AUTO: "AUTO",
	ONE: "1",
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	QUIET: "QUIET",
} as const;

export const FAN_SETTINGS_TO_STATE_VALUE_MAP = {
	auto: FAN_VALUES.AUTO,
	low: FAN_VALUES.ONE,
	middle: FAN_VALUES.TWO,
	medium: FAN_VALUES.THREE,
	high: FAN_VALUES.FOUR,
	diffuse: FAN_VALUES.QUIET,
};
export const VANE_VALUES = {
	AUTO: "AUTO",
	ONE: "1",
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	FIVE: "5",
	SWING: "SWING",
} as const;

export const WIDE_VANE_VALUES = {
	LEFT: "<<",
	LEFT_CENTER: "<",
	CENTER: "|",
	RIGHT_CENTER: ">",
	RIGHT: ">>",
	SWING: "SWING",
} as const;

export const SYSTEM_VALUES = {
	REBOOT: "reboot",
} as const;

// Zod schemas for each topic's message shape
export const mqttMessageSchemas = {
	[MQTT_TOPICS.mode]: z.enum(VALID_VALUES.mode),
	[MQTT_TOPICS.temp]: z.string().transform((val) => parseFloat(val)),
	[MQTT_TOPICS.fan]: z.enum(VALID_VALUES.fan),
	[MQTT_TOPICS.vane]: z.enum(VALID_VALUES.vane),
	[MQTT_TOPICS.wideVane]: z.enum(VALID_VALUES.wideVane),
	[MQTT_TOPICS.remoteTemp]: z.string().transform((val) => parseFloat(val)),
	[MQTT_TOPICS.system]: z.enum(VALID_VALUES.system),
	[MQTT_TOPICS.settings]: z.object({
		temperature: z.number().min(16).max(31),
		fan: z.enum(VALID_VALUES.fan),
		vane: z.enum(VALID_VALUES.vane),
		wideVane: z.enum(VALID_VALUES.wideVane),
		mode: z.enum(VALID_VALUES.mode),
	}),
	[MQTT_TOPICS.state]: z.object({
		roomTemperature: z.preprocess((val) => (!val ? -1 : val), z.number()),
		temperature: z.number().min(16).max(31),
		fan: z.enum(VALID_VALUES.fan),
		vane: z.enum(VALID_VALUES.vane),
		wideVane: z.enum(VALID_VALUES.wideVane),
		mode: z.enum(VALID_VALUES.mode),
		action: z.string().optional(),
		compressorFrequency: z.number().optional(),
	}),
};

// Type inference for message payloads based on topic
export type MqttMessageType<Topic extends keyof typeof mqttMessageSchemas> =
	z.infer<(typeof mqttMessageSchemas)[Topic]>;

// Common state type
export type AirConState = MqttMessageType<typeof MQTT_TOPICS.state>;
export type AirConSettings = MqttMessageType<typeof MQTT_TOPICS.settings>;

export const BROKER_URL = envData.MQTT_BROKER_URL; // Replace with your broker
