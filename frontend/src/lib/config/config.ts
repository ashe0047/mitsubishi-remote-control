// lib/config.ts
import { z } from "zod";

// Define the structure of your configuration with a TypeScript interface
// Note: rooms are now loaded from API, this is kept for backwards compatibility
const appConfigSchema = z.object({
	rooms: z.array(
		z.object({
			roomName: z.string(),
			roomId: z.string(),
		})
	),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

// Provide default empty config since rooms are now loaded from API
function loadConfig(): AppConfig {
	return {
		rooms: [], // Empty array - rooms are now loaded from API
	};
}

// Export the config as a singleton
const appConfig = loadConfig();

export default appConfig;
