import { z, ZodFormattedError } from "zod";

export const formatErrors = (
	errors: ZodFormattedError<Map<string, string>, string>
) =>
	Object.entries(errors)
		?.map(([name, value]) => {
			if (value && "_errors" in value)
				return `${name}: ${value._errors.join(", ")}\n`;
		})
		.filter(Boolean);

const envSchema = z.object({
	MQTT_BROKER_URL: z.string(),
	MQTT_BROKER_PORT: z.string().transform((val) => parseInt(val)),
	MQTT_BROKER_USERNAME: z.string(),
	MQTT_BROKER_PASSWORD: z.string(),
	APP_CONFIG_PATH: z.string().optional(),
	BACKEND_WEBSOCKET_URL: z.string().optional(),
});

const unvalidatedEnv = {
	MQTT_BROKER_URL: process.env.NEXT_PUBLIC_MQTT_BROKER_URL,
	MQTT_BROKER_PORT: process.env.NEXT_PUBLIC_MQTT_BROKER_PORT,
	MQTT_BROKER_USERNAME: process.env.NEXT_PUBLIC_MQTT_BROKER_USERNAME,
	MQTT_BROKER_PASSWORD: process.env.NEXT_PUBLIC_MQTT_BROKER_PASSWORD,
	APP_CONFIG_PATH: process.env.NEXT_PUBLIC_APP_CONFIG_PATH,
	BACKEND_WEBSOCKET_URL: process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL,
};
const env = envSchema.safeParse(unvalidatedEnv);

if (!env.success) {
	console.error(
		"❌ Invalid environment variables:\n",
		...formatErrors(env.error.format())
	);
	throw new Error("Invalid environment variables");
}

const envData = env.data;
export default envData;
