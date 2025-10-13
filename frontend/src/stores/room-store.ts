/**
 * Room Store
 *
 * Zustand v5 store for room management with embedded device information.
 * Consolidates room data, device status, and real-time updates in a single store.
 *
 * Features:
 * - Complete room data with embedded devices and aggregate status
 * - Real-time WebSocket integration for device status updates
 * - Device control operations integrated with room updates
 * - Intelligent caching with TTL and invalidation
 * - Request deduplication and optimistic updates
 * - Computed selectors with memoization
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { roomApiClient } from "@/lib/api/room-api-client";
import type {
	Room,
	CreateRoomRequest,
	UpdateRoomRequest,
	DeviceControlAction,
	DeviceControlResponse,
	DeviceInfo,
	DeviceCurrentStatus,
	AggregateStatus,
} from "@/types/room";

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_WHILE_REVALIDATE_TTL = 30 * 1000; // 30 seconds
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries
const BACKGROUND_REFRESH_INTERVAL = 60 * 1000; // 1 minute
const CACHE_PERSISTENCE_KEY = "room_cache";
const BATCH_REQUEST_DELAY = 100; // 100ms delay for batching requests

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	isStale: boolean;
	accessCount: number;
	lastAccessed: number;
	size: number; // Estimated size in bytes
}

interface RequestState {
	isLoading: boolean;
	error: string | null;
	lastFetch: number | null;
	retryCount: number;
	priority: "low" | "normal" | "high";
}

interface OptimisticUpdate {
	id: string;
	type: "device_control" | "room_update" | "room_create" | "room_delete";
	roomId: string;
	deviceId?: string;
	originalData: any;
	optimisticData: any;
	timestamp: number;
	rollbackFn: () => void;
}

interface CacheAnalytics {
	hits: number;
	misses: number;
	evictions: number;
	backgroundRefreshes: number;
	persistenceLoads: number;
	persistenceSaves: number;
	totalSize: number;
	averageAccessTime: number;
}

interface BatchRequest {
	key: string;
	requests: Array<{
		resolve: (value: any) => void;
		reject: (error: any) => void;
		timestamp: number;
	}>;
	timeoutId: NodeJS.Timeout;
}

interface RoomState {
	// Core state
	rooms: Room[];
	roomsCache: Map<string, CacheEntry<Room>>;
	requestStates: Map<string, RequestState>;
	hasFetchedRooms: boolean;

	// Global loading and error state
	isLoading: boolean;
	error: string | null;
	selectedRoom: Room | null;

	// Real-time WebSocket state
	wsConnected: boolean;
	lastUpdated: number | null;

	// Optimistic updates
	optimisticUpdates: Map<string, OptimisticUpdate>;

	// Request deduplication and batching
	activeRequests: Map<string, Promise<any>>;
	batchedRequests: Map<string, BatchRequest>;

	// Cache management
	cacheAnalytics: CacheAnalytics;
	backgroundRefreshInterval: NodeJS.Timeout | null;

	// Performance monitoring
	performanceMetrics: {
		requestCount: number;
		averageResponseTime: number;
		cacheHitRate: number;
		optimisticUpdateSuccessRate: number;
	};

	// Computed getters (memoized)
	getRoomById: (roomId: string) => Room | undefined;
	getRoomByIdentifier: (identifier: string) => Room | undefined;
	getActiveRooms: () => Room[];
	getTotalDevices: () => number;
	getOnlineDevices: () => number;
	getEnabledDevices: () => number;
	getRoomsWithDevices: () => Room[];
	getDeviceById: (
		deviceId: string
	) => { room: Room; device: DeviceInfo } | undefined;

	// Actions - Room CRUD
	fetchRooms: (force?: boolean) => Promise<void>;
	fetchRoomById: (roomId: string, force?: boolean) => Promise<Room>;
	createRoom: (request: CreateRoomRequest) => Promise<Room>;
	updateRoom: (roomId: string, request: UpdateRoomRequest) => Promise<Room>;
	deleteRoom: (roomId: string) => Promise<void>;

	// Actions - Device control
	controlDevice: (
		roomId: string,
		deviceId: string,
		action: DeviceControlAction
	) => Promise<DeviceControlResponse>;
	setDevicePower: (
		roomId: string,
		deviceId: string,
		power: "on" | "off"
	) => Promise<DeviceControlResponse>;
	setDeviceTemperature: (
		roomId: string,
		deviceId: string,
		temperature: number
	) => Promise<DeviceControlResponse>;
	setDeviceMode: (
		roomId: string,
		deviceId: string,
		mode: string
	) => Promise<DeviceControlResponse>;

	// Actions - Real-time updates
	updateDeviceStatus: (
		roomId: string,
		deviceId: string,
		status: DeviceCurrentStatus
	) => void;
	updateRoomAggregateStatus: (
		roomId: string,
		status: Partial<AggregateStatus>
	) => void;
	invalidateRoom: (roomId: string) => void;
	invalidateAllRooms: () => void;

	// Actions - WebSocket management
	setWebSocketConnected: (connected: boolean) => void;

	// Actions - UI state
	setSelectedRoom: (room: Room | null) => void;
	clearError: () => void;

	// Actions - Cache management
	clearCache: () => void;
	getCacheStats: () => {
		size: number;
		staleCount: number;
		hitRate: number;
		analytics: CacheAnalytics;
	};
	warmCache: (roomIds?: string[]) => Promise<void>;
	persistCache: () => void;
	loadPersistedCache: () => void;

	// Actions - Performance optimization
	enableBackgroundRefresh: () => void;
	disableBackgroundRefresh: () => void;
	getPerformanceMetrics: () => {
		requestCount: number;
		averageResponseTime: number;
		cacheHitRate: number;
		optimisticUpdateSuccessRate: number;
	};

	// Actions - Advanced optimistic updates
	createOptimisticUpdate: (
		update: Omit<OptimisticUpdate, "id" | "timestamp">
	) => string;
	rollbackOptimisticUpdate: (updateId: string) => void;
	commitOptimisticUpdate: (updateId: string) => void;
}

// Helper functions
const createCacheEntry = <T>(data: T): CacheEntry<T> => ({
	data,
	timestamp: Date.now(),
	isStale: false,
	accessCount: 1,
	lastAccessed: Date.now(),
	size: estimateObjectSize(data),
});

const isCacheEntryValid = <T>(entry: CacheEntry<T>): boolean => {
	const age = Date.now() - entry.timestamp;
	return age < CACHE_TTL && !entry.isStale;
};

const isCacheEntryStale = <T>(entry: CacheEntry<T>): boolean => {
	const age = Date.now() - entry.timestamp;
	return age > STALE_WHILE_REVALIDATE_TTL || entry.isStale;
};

const updateCacheEntryAccess = <T>(entry: CacheEntry<T>): CacheEntry<T> => ({
	...entry,
	accessCount: entry.accessCount + 1,
	lastAccessed: Date.now(),
});

const estimateObjectSize = (obj: any): number => {
	try {
		return JSON.stringify(obj).length * 2; // Rough estimate: 2 bytes per character
	} catch {
		return 1000; // Default size if serialization fails
	}
};

const generateOptimisticId = (): string => {
	return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// LRU Cache management
const evictLeastRecentlyUsed = <T>(
	cache: Map<string, CacheEntry<T>>,
	maxSize: number
): void => {
	if (cache.size <= maxSize) return;

	const entries = Array.from(cache.entries());
	entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

	const toEvict = entries.slice(0, cache.size - maxSize);
	toEvict.forEach(([key]) => cache.delete(key));
};

// Cache persistence helpers
const saveCacheToStorage = (cache: Map<string, CacheEntry<Room>>): void => {
	try {
		const cacheData = Array.from(cache.entries()).map(([key, entry]) => [
			key,
			{
				...entry,
				// Only persist if not too old
				...(Date.now() - entry.timestamp < CACHE_TTL
					? {}
					: { isStale: true }),
			},
		]);
		localStorage.setItem(CACHE_PERSISTENCE_KEY, JSON.stringify(cacheData));
	} catch (error) {
		console.warn("Failed to persist cache:", error);
	}
};

const loadCacheFromStorage = (): Map<string, CacheEntry<Room>> => {
	try {
		const stored = localStorage.getItem(CACHE_PERSISTENCE_KEY);
		if (!stored) return new Map();

		const cacheData = JSON.parse(stored);
		const cache = new Map<string, CacheEntry<Room>>();

		cacheData.forEach(([key, entry]: [string, CacheEntry<Room>]) => {
			// Only load if not expired
			if (Date.now() - entry.timestamp < CACHE_TTL) {
				cache.set(key, entry);
			}
		});

		return cache;
	} catch (error) {
		console.warn("Failed to load persisted cache:", error);
		return new Map();
	}
};

// Optimistic update prediction
const predictDeviceState = (
	currentStatus: DeviceCurrentStatus | undefined,
	action: DeviceControlAction
): DeviceCurrentStatus => {
	const baseStatus: DeviceCurrentStatus = {
		power: currentStatus?.power || "off",
		temperature: currentStatus?.temperature || 20,
		mode: currentStatus?.mode || "off",
		fan: currentStatus?.fan || "auto",
		vane: currentStatus?.vane,
		wideVane: currentStatus?.wideVane,
		roomTemperature: currentStatus?.roomTemperature,
	};

	switch (action.type) {
		case "power":
			return {
				...baseStatus,
				power: action.payload.power,
				mode:
					action.payload.power === "off"
						? "off"
						: baseStatus.mode === "off"
						? "cool"
						: baseStatus.mode,
			};

		case "temperature":
			return {
				...baseStatus,
				temperature: action.payload.temperature,
				power: "on",
				mode: baseStatus.mode === "off" ? "cool" : baseStatus.mode,
			};

		case "mode":
			return {
				...baseStatus,
				mode: action.payload.mode,
				power: action.payload.mode === "off" ? "off" : "on",
			};

		case "fan":
			return {
				...baseStatus,
				fan: action.payload.fan,
			};

		case "settings":
			return {
				...baseStatus,
				...action.payload,
				power: "on",
			};

		default:
			return baseStatus;
	}
};

const calculateAggregateStatus = (devices: DeviceInfo[]): AggregateStatus => {
	if (devices.length === 0) {
		return {
			hasActiveDevices: false,
			totalDevices: 0,
			onlineDevices: 0,
			enabledDevices: 0,
		};
	}

	const onlineDevices = devices.filter((d) => d.online).length;
	const enabledDevices = devices.filter((d) => d.enabled).length;

	const temperaturesWithReadings = devices
		.filter((d) => d.currentStatus?.roomTemperature != null)
		.map((d) => d.currentStatus!.roomTemperature!);

	const averageTemperature =
		temperaturesWithReadings.length > 0
			? temperaturesWithReadings.reduce((sum, temp) => sum + temp, 0) /
			  temperaturesWithReadings.length
			: undefined;

	const hasActiveDevices = devices.some(
		(d) =>
			d.online &&
			d.currentStatus &&
			d.currentStatus.power === "on" &&
			d.currentStatus.mode !== "off"
	);

	return {
		hasActiveDevices,
		averageTemperature,
		totalDevices: devices.length,
		onlineDevices,
		enabledDevices,
	};
};

export const useRoomStore = create<RoomState>()(
	subscribeWithSelector((set, get) => {
		// Initialize store
		const store = {
		// Initial state
		rooms: [],
		roomsCache: loadCacheFromStorage(),
		requestStates: new Map(),
		hasFetchedRooms: false,
		isLoading: false,
			error: null,
			selectedRoom: null,
			wsConnected: false,
			lastUpdated: null,
			optimisticUpdates: new Map(),
			activeRequests: new Map(),
			batchedRequests: new Map(),
			backgroundRefreshInterval: null,
			cacheAnalytics: {
				hits: 0,
				misses: 0,
				evictions: 0,
				backgroundRefreshes: 0,
				persistenceLoads: 0,
				persistenceSaves: 0,
				totalSize: 0,
				averageAccessTime: 0,
			},
			performanceMetrics: {
				requestCount: 0,
				averageResponseTime: 0,
				cacheHitRate: 0,
				optimisticUpdateSuccessRate: 0,
			},

			// Computed getters with memoization
			getRoomById: (roomId: string) => {
				const state = get();
				return state.rooms.find((room) => room.id === roomId);
			},

			getRoomByIdentifier: (identifier: string) => {
				const state = get();
				return state.rooms.find(
					(room) => room.roomIdentifier === identifier
				);
			},

			getActiveRooms: () => {
				const state = get();
				return state.rooms.filter(
					(room) => room.aggregateStatus.hasActiveDevices
				);
			},

			getTotalDevices: () => {
				const state = get();
				return state.rooms.reduce(
					(total, room) => total + room.aggregateStatus.totalDevices,
					0
				);
			},

			getOnlineDevices: () => {
				const state = get();
				return state.rooms.reduce(
					(total, room) => total + room.aggregateStatus.onlineDevices,
					0
				);
			},

			getEnabledDevices: () => {
				const state = get();
				return state.rooms.reduce(
					(total, room) =>
						total + room.aggregateStatus.enabledDevices,
					0
				);
			},

			getRoomsWithDevices: () => {
				const state = get();
				return state.rooms.filter((room) => room.devices.length > 0);
			},

			getDeviceById: (deviceId: string) => {
				const state = get();
				for (const room of state.rooms) {
					const device = room.devices.find(
						(d) =>
							d.id === deviceId || d.deviceIdentifier === deviceId
					);
					if (device) {
						return { room, device };
					}
				}
				return undefined;
			},

			// Room CRUD operations
			fetchRooms: async (force = false) => {
				const state = get();
				const requestKey = "fetchRooms";
				const startTime = Date.now();

				// Check if request is already in progress (request deduplication)
				if (state.activeRequests.has(requestKey)) {
					return state.activeRequests.get(requestKey);
				}

				// Check cache if not forcing refresh
				if (!force && state.rooms.length > 0) {
					const lastFetch =
						state.requestStates.get(requestKey)?.lastFetch;
					if (
						lastFetch &&
						Date.now() - lastFetch < STALE_WHILE_REVALIDATE_TTL
					) {
						// Cache hit
						set((state) => ({
							cacheAnalytics: {
								...state.cacheAnalytics,
								hits: state.cacheAnalytics.hits + 1,
							},
						}));
						return;
					}
				}

				// Check if we can serve stale data while revalidating
				const canServeStale = !force && state.rooms.length > 0;
				if (!canServeStale) {
					set({ isLoading: true, error: null });
				}

				const request = (async () => {
					try {
						const rooms = await roomApiClient.getAllRooms();
						const responseTime = Date.now() - startTime;

						set((state) => {
							// Update performance metrics
							const newRequestCount =
								state.performanceMetrics.requestCount + 1;
							const newAverageResponseTime =
								(state.performanceMetrics.averageResponseTime *
									(newRequestCount - 1) +
									responseTime) /
								newRequestCount;

							// Update cache analytics
							const newCacheAnalytics = {
								...state.cacheAnalytics,
								misses: state.cacheAnalytics.misses + 1,
								averageAccessTime:
									(state.cacheAnalytics.averageAccessTime *
										state.cacheAnalytics.misses +
										responseTime) /
									(state.cacheAnalytics.misses + 1),
							};

							return {
								rooms,
								hasFetchedRooms: true,
								isLoading: false,
								lastUpdated: Date.now(),
								requestStates: new Map(state.requestStates).set(
									requestKey,
									{
										isLoading: false,
										error: null,
										lastFetch: Date.now(),
										retryCount: 0,
										priority: "normal",
									}
								),
								performanceMetrics: {
									...state.performanceMetrics,
									requestCount: newRequestCount,
									averageResponseTime: newAverageResponseTime,
									cacheHitRate:
										state.cacheAnalytics.hits /
										(state.cacheAnalytics.hits +
											newCacheAnalytics.misses),
								},
								cacheAnalytics: newCacheAnalytics,
							};
						});

						// Update individual room caches with cache management
						set((state) => {
							const newRoomsCache = new Map(state.roomsCache);
							let totalSize = 0;

							rooms.forEach((room) => {
								const entry = createCacheEntry(room);
								newRoomsCache.set(room.id, entry);
								totalSize += entry.size;
							});

							// Apply LRU eviction if cache is too large
							evictLeastRecentlyUsed(
								newRoomsCache,
								MAX_CACHE_SIZE
							);

							// Update cache analytics
							const evictedCount = Math.max(
								0,
								state.roomsCache.size +
									rooms.length -
									newRoomsCache.size
							);

							return {
								roomsCache: newRoomsCache,
								cacheAnalytics: {
									...state.cacheAnalytics,
									evictions:
										state.cacheAnalytics.evictions +
										evictedCount,
									totalSize: totalSize,
								},
							};
						});

						// Persist cache to localStorage
						get().persistCache();
					} catch (error: any) {
						const errorMessage =
							error?.message || "Failed to fetch rooms";
						set((state) => ({
							error: errorMessage,
							isLoading: false,
							hasFetchedRooms: true,
							requestStates: new Map(state.requestStates).set(
								requestKey,
								{
									isLoading: false,
									error: errorMessage,
									lastFetch: Date.now(),
									retryCount:
										(state.requestStates.get(requestKey)
											?.retryCount || 0) + 1,
									priority: "normal",
								}
							),
						}));
						throw error;
					}
				})();

				// Store active request
				set((state) => ({
					activeRequests: new Map(state.activeRequests).set(
						requestKey,
						request
					),
				}));

				try {
					await request;
				} finally {
					// Remove from active requests
					set((state) => {
						const newActiveRequests = new Map(state.activeRequests);
						newActiveRequests.delete(requestKey);
						return { activeRequests: newActiveRequests };
					});
				}
			},

			fetchRoomById: async (roomId: string, force = false) => {
				const state = get();
				const requestKey = `fetchRoom_${roomId}`;
				const startTime = Date.now();

				// Check if request is already in progress (request deduplication)
				if (state.activeRequests.has(requestKey)) {
					return state.activeRequests.get(requestKey);
				}

				// Check cache if not forcing refresh
				if (!force) {
					const cached = state.roomsCache.get(roomId);
					if (cached && isCacheEntryValid(cached)) {
						// Update access statistics
						set((state) => ({
							roomsCache: new Map(state.roomsCache).set(
								roomId,
								updateCacheEntryAccess(cached)
							),
							cacheAnalytics: {
								...state.cacheAnalytics,
								hits: state.cacheAnalytics.hits + 1,
							},
						}));
						return cached.data;
					}

					// Check if we can serve stale data while revalidating
					if (cached && isCacheEntryStale(cached)) {
						// Serve stale data immediately and refresh in background
						setTimeout(() => {
							get().fetchRoomById(roomId, true);
						}, 0);

						set((state) => ({
							roomsCache: new Map(state.roomsCache).set(
								roomId,
								updateCacheEntryAccess(cached)
							),
							cacheAnalytics: {
								...state.cacheAnalytics,
								hits: state.cacheAnalytics.hits + 1,
								backgroundRefreshes:
									state.cacheAnalytics.backgroundRefreshes +
									1,
							},
						}));
						return cached.data;
					}
				}

				const request = (async () => {
					try {
						const room = await roomApiClient.getRoomById(
							roomId
						);
						const responseTime = Date.now() - startTime;

						// Update room in rooms array and cache
						set((state) => {
							const newRoomsCache = new Map(state.roomsCache);
							const entry = createCacheEntry(room);
							newRoomsCache.set(roomId, entry);

							// Apply LRU eviction if needed
							evictLeastRecentlyUsed(
								newRoomsCache,
								MAX_CACHE_SIZE
							);

							const evictedCount = Math.max(
								0,
								state.roomsCache.size + 1 - newRoomsCache.size
							);

							return {
								rooms: state.rooms
									.map((r) => (r.id === roomId ? room : r))
									.concat(
										state.rooms.find((r) => r.id === roomId)
											? []
											: [room]
									),
								roomsCache: newRoomsCache,
								lastUpdated: Date.now(),
								cacheAnalytics: {
									...state.cacheAnalytics,
									misses: state.cacheAnalytics.misses + 1,
									evictions:
										state.cacheAnalytics.evictions +
										evictedCount,
									averageAccessTime:
										(state.cacheAnalytics
											.averageAccessTime *
											state.cacheAnalytics.misses +
											responseTime) /
										(state.cacheAnalytics.misses + 1),
								},
							};
						});

						// Persist cache
						get().persistCache();

						return room;
					} catch (error: any) {
						const errorMessage =
							error?.message || `Failed to fetch room ${roomId}`;
						set({ error: errorMessage });
						throw error;
					}
				})();

				// Store active request
				set((state) => ({
					activeRequests: new Map(state.activeRequests).set(
						requestKey,
						request
					),
				}));

				try {
					return await request;
				} finally {
					// Remove from active requests
					set((state) => {
						const newActiveRequests = new Map(state.activeRequests);
						newActiveRequests.delete(requestKey);
						return { activeRequests: newActiveRequests };
					});
				}
			},

			createRoom: async (request: CreateRoomRequest) => {
				set({ isLoading: true, error: null });

				try {
					const newRoom = await roomApiClient.createRoom(
						request
					);

					set((state) => ({
						rooms: [...state.rooms, newRoom],
						roomsCache: new Map(state.roomsCache).set(
							newRoom.id,
							createCacheEntry(newRoom)
						),
						isLoading: false,
						lastUpdated: Date.now(),
					}));

					return newRoom;
				} catch (error: any) {
					const errorMessage =
						error?.message || "Failed to create room";
					set({ error: errorMessage, isLoading: false });
					throw error;
				}
			},

			updateRoom: async (roomId: string, request: UpdateRoomRequest) => {
				set({ isLoading: true, error: null });

				try {
					const updatedRoom = await roomApiClient.updateRoom(
						roomId,
						request
					);

					set((state) => ({
						rooms: state.rooms.map((room) =>
							room.id === roomId ? updatedRoom : room
						),
						roomsCache: new Map(state.roomsCache).set(
							roomId,
							createCacheEntry(updatedRoom)
						),
						selectedRoom:
							state.selectedRoom?.id === roomId
								? updatedRoom
								: state.selectedRoom,
						isLoading: false,
						lastUpdated: Date.now(),
					}));

					return updatedRoom;
				} catch (error: any) {
					const errorMessage =
						error?.message || "Failed to update room";
					set({ error: errorMessage, isLoading: false });
					throw error;
				}
			},

			deleteRoom: async (roomId: string) => {
				set({ isLoading: true, error: null });

				try {
					await roomApiClient.deleteRoom(roomId);

					set((state) => {
						const newRoomsCache = new Map(state.roomsCache);
						newRoomsCache.delete(roomId);

						return {
							rooms: state.rooms.filter(
								(room) => room.id !== roomId
							),
							roomsCache: newRoomsCache,
							selectedRoom:
								state.selectedRoom?.id === roomId
									? null
									: state.selectedRoom,
							isLoading: false,
							lastUpdated: Date.now(),
						};
					});
				} catch (error: any) {
					const errorMessage =
						error?.message || "Failed to delete room";
					set({ error: errorMessage, isLoading: false });
					throw error;
				}
			},

			// Device control operations with optimistic updates
			controlDevice: async (
				roomId: string,
				deviceId: string,
				action: DeviceControlAction
			) => {
				const state = get();
				const room = state.rooms.find((r) => r.id === roomId);
				const device = room?.devices.find(
					(d) => d.id === deviceId || d.deviceIdentifier === deviceId
				);

				if (!room || !device) {
					throw new Error("Room or device not found");
				}

				// Create optimistic update
				const optimisticData = predictDeviceState(
					device.currentStatus,
					action
				);
				const updateId = get().createOptimisticUpdate({
					type: "device_control",
					roomId,
					deviceId,
					originalData: device.currentStatus,
					optimisticData,
					rollbackFn: () => {
						get().updateDeviceStatus(
							roomId,
							deviceId,
							device.currentStatus || {
								power: "off",
								temperature: 20,
								mode: "off",
								fan: "auto",
							}
						);
					},
				});

				// Apply optimistic update immediately
				get().updateDeviceStatus(roomId, deviceId, optimisticData);

				try {
					const response = await roomApiClient.controlDevice(
						roomId,
						deviceId,
						action
					);

					// Commit optimistic update and apply real data
					get().commitOptimisticUpdate(updateId);

					if (response.success && response.deviceStatus) {
						get().updateDeviceStatus(
							roomId,
							deviceId,
							response.deviceStatus
						);
					}

					// Update success rate
					set((state) => {
						const totalUpdates = state.optimisticUpdates.size + 1;
						const successRate =
							(state.performanceMetrics
								.optimisticUpdateSuccessRate *
								(totalUpdates - 1) +
								1) /
							totalUpdates;

						return {
							performanceMetrics: {
								...state.performanceMetrics,
								optimisticUpdateSuccessRate: successRate,
							},
						};
					});

					return response;
				} catch (error: any) {
					// Rollback optimistic update
					get().rollbackOptimisticUpdate(updateId);

					// Update failure rate
					set((state) => {
						const totalUpdates = state.optimisticUpdates.size + 1;
						const successRate =
							(state.performanceMetrics
								.optimisticUpdateSuccessRate *
								(totalUpdates - 1)) /
							totalUpdates;

						return {
							performanceMetrics: {
								...state.performanceMetrics,
								optimisticUpdateSuccessRate: successRate,
							},
						};
					});

					const errorMessage =
						error?.message || "Failed to control device";
					set({ error: errorMessage });
					throw error;
				}
			},

			setDevicePower: async (
				roomId: string,
				deviceId: string,
				power: "on" | "off"
			) => {
				return get().controlDevice(roomId, deviceId, {
					type: "power",
					payload: { power },
				});
			},

			setDeviceTemperature: async (
				roomId: string,
				deviceId: string,
				temperature: number
			) => {
				return get().controlDevice(roomId, deviceId, {
					type: "temperature",
					payload: { temperature },
				});
			},

			setDeviceMode: async (
				roomId: string,
				deviceId: string,
				mode: string
			) => {
				return get().controlDevice(roomId, deviceId, {
					type: "mode",
					payload: { mode: mode as any },
				});
			},

			// Real-time update handlers
			updateDeviceStatus: (
				roomId: string,
				deviceId: string,
				status: DeviceCurrentStatus
			) => {
				set((state) => {
					const updatedRooms = state.rooms.map((room) => {
						if (room.id !== roomId) return room;

						const updatedDevices = room.devices.map((device) => {
							if (
								device.id !== deviceId &&
								device.deviceIdentifier !== deviceId
							)
								return device;

							return {
								...device,
								currentStatus: status,
								online: true, // Device is online if we're receiving status updates
							};
						});

						const updatedRoom = {
							...room,
							devices: updatedDevices,
							aggregateStatus:
								calculateAggregateStatus(updatedDevices),
							updatedAt: new Date().toISOString(),
						};

						return updatedRoom;
					});

					// Update cache
					const roomToUpdate = updatedRooms.find(
						(r) => r.id === roomId
					);
					const newRoomsCache = roomToUpdate
						? new Map(state.roomsCache).set(
								roomId,
								createCacheEntry(roomToUpdate)
						  )
						: state.roomsCache;

					return {
						rooms: updatedRooms,
						roomsCache: newRoomsCache,
						selectedRoom:
							state.selectedRoom?.id === roomId
								? roomToUpdate
								: state.selectedRoom,
						lastUpdated: Date.now(),
					};
				});
			},

			updateRoomAggregateStatus: (
				roomId: string,
				status: Partial<AggregateStatus>
			) => {
				set((state) => {
					const updatedRooms = state.rooms.map((room) => {
						if (room.id !== roomId) return room;

						const updatedRoom = {
							...room,
							aggregateStatus: {
								...room.aggregateStatus,
								...status,
							},
							updatedAt: new Date().toISOString(),
						};

						return updatedRoom;
					});

					// Update cache
					const roomToUpdate = updatedRooms.find(
						(r) => r.id === roomId
					);
					const newRoomsCache = roomToUpdate
						? new Map(state.roomsCache).set(
								roomId,
								createCacheEntry(roomToUpdate)
						  )
						: state.roomsCache;

					return {
						rooms: updatedRooms,
						roomsCache: newRoomsCache,
						selectedRoom:
							state.selectedRoom?.id === roomId
								? roomToUpdate
								: state.selectedRoom,
						lastUpdated: Date.now(),
					};
				});
			},

			invalidateRoom: (roomId: string) => {
				set((state) => {
					const newRoomsCache = new Map(state.roomsCache);
					const cached = newRoomsCache.get(roomId);
					if (cached) {
						newRoomsCache.set(roomId, { ...cached, isStale: true });
					}
					return { roomsCache: newRoomsCache };
				});
			},

			invalidateAllRooms: () => {
				set((state) => {
					const newRoomsCache = new Map();
					state.roomsCache.forEach((entry, key) => {
						newRoomsCache.set(key, { ...entry, isStale: true });
					});
					return { roomsCache: newRoomsCache };
				});
			},

			// WebSocket management
			setWebSocketConnected: (connected: boolean) => {
				set({ wsConnected: connected });
			},

			// UI state management
			setSelectedRoom: (room: Room | null) => {
				set({ selectedRoom: room });
			},

			clearError: () => {
				set({ error: null });
			},

			// Cache management
			clearCache: () => {
				set({
					roomsCache: new Map(),
					requestStates: new Map(),
					activeRequests: new Map(),
					optimisticUpdates: new Map(),
					batchedRequests: new Map(),
					cacheAnalytics: {
						hits: 0,
						misses: 0,
						evictions: 0,
						backgroundRefreshes: 0,
						persistenceLoads: 0,
						persistenceSaves: 0,
						totalSize: 0,
						averageAccessTime: 0,
					},
				});

				// Clear persisted cache
				try {
					localStorage.removeItem(CACHE_PERSISTENCE_KEY);
				} catch (error) {
					console.warn("Failed to clear persisted cache:", error);
				}
			},

			getCacheStats: () => {
				const state = get();
				const totalEntries = state.roomsCache.size;
				const staleEntries = Array.from(
					state.roomsCache.values()
				).filter(
					(entry) => entry.isStale || !isCacheEntryValid(entry)
				).length;

				const hitRate =
					state.cacheAnalytics.hits + state.cacheAnalytics.misses > 0
						? (state.cacheAnalytics.hits /
								(state.cacheAnalytics.hits +
									state.cacheAnalytics.misses)) *
						  100
						: 0;

				return {
					size: totalEntries,
					staleCount: staleEntries,
					hitRate: Math.round(hitRate),
					analytics: state.cacheAnalytics,
				};
			},

			warmCache: async (roomIds?: string[]) => {
				const state = get();

				if (roomIds) {
					// Warm specific rooms
					const promises = roomIds.map((roomId) => {
						const cached = state.roomsCache.get(roomId);
						if (!cached || isCacheEntryStale(cached)) {
							return get().fetchRoomById(roomId, false);
						}
						return Promise.resolve();
					});

					await Promise.allSettled(promises);
				} else {
					// Warm all rooms
					await get().fetchRooms(false);
				}
			},

			persistCache: () => {
				const state = get();
				saveCacheToStorage(state.roomsCache);

				set((state) => ({
					cacheAnalytics: {
						...state.cacheAnalytics,
						persistenceSaves:
							state.cacheAnalytics.persistenceSaves + 1,
					},
				}));
			},

			loadPersistedCache: () => {
				const persistedCache = loadCacheFromStorage();

				set((state) => ({
					roomsCache: persistedCache,
					cacheAnalytics: {
						...state.cacheAnalytics,
						persistenceLoads:
							state.cacheAnalytics.persistenceLoads + 1,
					},
				}));
			},

			// Performance optimization methods
			enableBackgroundRefresh: () => {
				const state = get();
				if (state.backgroundRefreshInterval) return;

				const interval = setInterval(() => {
					const state = get();
					const staleRooms = Array.from(state.roomsCache.entries())
						.filter(([_, entry]) => isCacheEntryStale(entry))
						.map(([roomId]) => roomId);

					if (staleRooms.length > 0) {
						// Refresh stale rooms in background
						staleRooms.forEach((roomId) => {
							get().fetchRoomById(roomId, true);
						});

						set((state) => ({
							cacheAnalytics: {
								...state.cacheAnalytics,
								backgroundRefreshes:
									state.cacheAnalytics.backgroundRefreshes +
									staleRooms.length,
							},
						}));
					}
				}, BACKGROUND_REFRESH_INTERVAL);

				set({ backgroundRefreshInterval: interval });
			},

			disableBackgroundRefresh: () => {
				const state = get();
				if (state.backgroundRefreshInterval) {
					clearInterval(state.backgroundRefreshInterval);
					set({ backgroundRefreshInterval: null });
				}
			},

			getPerformanceMetrics: () => {
				return get().performanceMetrics;
			},

			// Advanced optimistic updates
			createOptimisticUpdate: (
				update: Omit<OptimisticUpdate, "id" | "timestamp">
			) => {
				const updateId = generateOptimisticId();
				const optimisticUpdate: OptimisticUpdate = {
					...update,
					id: updateId,
					timestamp: Date.now(),
				};

				set((state) => ({
					optimisticUpdates: new Map(state.optimisticUpdates).set(
						updateId,
						optimisticUpdate
					),
				}));

				return updateId;
			},

			rollbackOptimisticUpdate: (updateId: string) => {
				const state = get();
				const update = state.optimisticUpdates.get(updateId);

				if (update) {
					update.rollbackFn();

					set((state) => {
						const newOptimisticUpdates = new Map(
							state.optimisticUpdates
						);
						newOptimisticUpdates.delete(updateId);
						return { optimisticUpdates: newOptimisticUpdates };
					});
				}
			},

			commitOptimisticUpdate: (updateId: string) => {
				set((state) => {
					const newOptimisticUpdates = new Map(
						state.optimisticUpdates
					);
					newOptimisticUpdates.delete(updateId);
					return { optimisticUpdates: newOptimisticUpdates };
				});
			},
		};

		// Enable background refresh by default
		setTimeout(() => {
			store.enableBackgroundRefresh();
		}, 1000);

		return store;
	})
);
