import { ApiAirconContext } from "@/components/AirconProvider";
import { useContext, useMemo } from "react";
import { useStore } from "zustand";
import { AirConSettings } from "@/lib/mqtt/mqtt-config";
import type { RoomInfo } from "@/lib/websocket";

// Interface for WebSocket API aircon data
export interface AirconData {
	// Connection status
	isConnected: boolean;
	isMqttConnected?: boolean;
	isProcessingCommands?: boolean;

	// Room data structure - directly use RoomInfo type from store
	rooms: Record<string, RoomInfo>;

	// Control methods
	setPower: (roomId: string, power: string) => Promise<void>;
	setTemperature: (roomId: string, temperature: number) => Promise<void>;
	setMode: (roomId: string, mode: string) => Promise<void>;
	setFan: (roomId: string, fan: string) => Promise<void>;
	setVane: (roomId: string, vane: string) => Promise<void>;
	setWideVane: (roomId: string, wideVane: string) => Promise<void>;
	updateSettings: (roomId: string, settings: AirConSettings) => Promise<void>;

	// Data access methods
	getRoomInfo: (roomId: string) => RoomInfo | undefined;

	// Room discovery methods
	getRoomsList: () => Array<{ roomName: string; roomId: string; online: boolean }>;
	getRoomCount: () => number;
	getOnlineRoomCount: () => number;
	isDiscoveringRooms: boolean;
	roomDiscoveryError: string | null;
}

export const useAirconContext = (): AirconData => {
	const apiAirconStore = useContext(ApiAirconContext);

	if (!apiAirconStore) throw new Error("Missing ApiAirconContext.Provider in tree");

	// ✅ CORRECT: Use specific selectors for Zustand v5 to ensure reactivity
	const isConnected = useStore(apiAirconStore, (state) => state.isConnected);
	const isMqttConnected = useStore(apiAirconStore, (state) => state.isMqttConnected);
	const isProcessingCommands = useStore(apiAirconStore, (state) => state.isProcessingCommands);
	const rooms = useStore(apiAirconStore, (state) => state.rooms);
	const isDiscoveringRooms = useStore(apiAirconStore, (state) => state.isDiscoveringRooms);
	const roomDiscoveryError = useStore(apiAirconStore, (state) => state.roomDiscoveryError);

	// Store methods are stable - can be selected once
	const setPower = useStore(apiAirconStore, (state) => state.setPower);
	const setTemperature = useStore(apiAirconStore, (state) => state.setTemperature);
	const setMode = useStore(apiAirconStore, (state) => state.setMode);
	const setFan = useStore(apiAirconStore, (state) => state.setFan);
	const setVane = useStore(apiAirconStore, (state) => state.setVane);
	const setWideVane = useStore(apiAirconStore, (state) => state.setWideVane);
	const updateSettings = useStore(apiAirconStore, (state) => state.updateSettings);
	const getRoomsList = useStore(apiAirconStore, (state) => state.getRoomsList);
	const getRoomCount = useStore(apiAirconStore, (state) => state.getRoomCount);
	const getOnlineRoomCount = useStore(apiAirconStore, (state) => state.getOnlineRoomCount);
	const getRoomInfo = useStore(apiAirconStore, (state) => state.getRoomInfo);

	// Return the WebSocket API store data with proper memoization based on actual state values
	return useMemo(() => ({
		isConnected,
		isMqttConnected,
		isProcessingCommands,
		rooms, // Direct reference - Zustand will handle reactivity
		setPower,
		setTemperature,
		setMode,
		setFan,
		setVane,
		setWideVane,
		updateSettings,
		getRoomInfo,
		getRoomsList,
		getRoomCount,
		getOnlineRoomCount,
		isDiscoveringRooms,
		roomDiscoveryError,
	}), [
		isConnected,
		isMqttConnected,
		isProcessingCommands,
		rooms,
		isDiscoveringRooms,
		roomDiscoveryError,
		setPower,
		setTemperature,
		setMode,
		setFan,
		setVane,
		setWideVane,
		updateSettings,
		getRoomInfo,
		getRoomsList,
		getRoomCount,
		getOnlineRoomCount,
	]);
};
