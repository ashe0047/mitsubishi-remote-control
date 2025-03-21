// lib/config.ts
import fs from "fs";
import { parse } from "yaml";
import { z } from "zod";
import envData from "./env/config";

// Define the structure of your configuration with a TypeScript interface
const appConfigSchema = z.object({
	rooms: z.array(
		z.object({
			roomName: z.string(),
			roomId: z.string(),
		})
	),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

// Load and parse the YAML file
function loadConfig(): AppConfig {
	try {
		const fileContents = fs.readFileSync(
			envData.APP_CONFIG_PATH,
			"utf8"
		);
		const config = appConfigSchema.safeParse(parse(fileContents));

		// Optional: Validate the config (e.g., ensure required fields exist)
		if (!config.success) {
			throw new Error("Invalid config file");
		}

		return config.data;
	} catch (error) {
		console.error("Error loading YAML config:", error);
		throw error; // Or provide a default config as a fallback
	}
}

// Export the config as a singleton
const appConfig = loadConfig();

export default appConfig;