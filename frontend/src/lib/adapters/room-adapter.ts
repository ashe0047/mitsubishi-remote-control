import { RoomInfo } from "@/lib/websocket";
import * as changeCase from "change-case";

/**
 * Adapted room structure that matches the existing UI component expectations
 */
export interface AdaptedRoom {
	roomName: string;
	roomId: string;
	online: boolean;
}

/**
 * Adapter function to convert WebSocket RoomInfo to UI-expected format
 * Maps WebSocket structure to existing component interface for compatibility
 * Transforms room names from MQTT topic format to proper capital case for display
 */
export const adaptRoomInfo = (roomInfo: RoomInfo): AdaptedRoom => ({
	roomName: formatRoomNameForDisplay(roomInfo.name),
	roomId: roomInfo.id,
	online: roomInfo.online,
});

/**
 * Adapter function to convert an array of RoomInfo objects to adapted format
 * Useful for converting store data to component-ready format
 */
export const adaptRoomsList = (
	rooms: Record<string, RoomInfo>
): AdaptedRoom[] => Object.values(rooms).map(adaptRoomInfo);

/**
 * Helper function to filter only online rooms from adapted list
 */
export const getOnlineRooms = (
	rooms: Record<string, RoomInfo>
): AdaptedRoom[] =>
	Object.values(rooms)
		.filter((room) => room.online)
		.map(adaptRoomInfo);

/**
 * Helper function to check if a specific room is online
 */
export const isRoomOnline = (
	rooms: Record<string, RoomInfo>,
	roomId: string
): boolean => rooms[roomId]?.online ?? false;

/**
 * Helper function to get room count statistics
 */
export const getRoomStats = (rooms: Record<string, RoomInfo>) => {
	const allRooms = Object.values(rooms);
	return {
		total: allRooms.length,
		online: allRooms.filter((room) => room.online).length,
		offline: allRooms.filter((room) => !room.online).length,
	};
};

/**
 * Format room name from MQTT format to user-friendly display format
 * Handles formats like "master_bedroom_aircon", "livingroom", etc.
 * Backend passes roomId as-is from MQTT, frontend transforms for display
 */
export const formatRoomNameForDisplay = (roomName: string): string => {
	if (!roomName || roomName.trim().length === 0) {
		return "Unknown Room";
	}

	// Remove common suffixes like "_aircon", "_ac", "_unit"
	let cleanName = roomName
		.toLowerCase()
		.replace(/_aircon$|_ac$|_unit$/, "")
		.trim();

	// Replace underscores and hyphens with spaces
	cleanName = cleanName.replace(/[_-]+/g, " ");

	// Use capitalCase for proper formatting
	return changeCase.capitalCase(cleanName);
};
