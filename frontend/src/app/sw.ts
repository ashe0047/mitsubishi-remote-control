// app/sw.ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Declare global types for TypeScript
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST ?? [], // Automatically precaches assets from Next.js build
	skipWaiting: true, // Immediately activates new service worker
	clientsClaim: true, // Takes control of clients immediately
	navigationPreload: true, // Improves navigation performance
	runtimeCaching: defaultCache, // Default caching strategies from Serwist
	fallbacks: {
		entries: [
			{
				url: "/offline", // Fallback page for offline navigation
				matcher({ request }) {
					return request.destination === "document";
				},
			},
		],
	},
});

serwist.addEventListeners();
