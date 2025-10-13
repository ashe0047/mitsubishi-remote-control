
/**
 * Room types for the application
 * Provides type definitions for room-related data structures
 */

/**
 * Adapted room structure that matches existing UI component expectations
 * This maintains compatibility with components that expect roomName/roomId format
 */
export interface AdaptedRoom {
  roomName: string;
  roomId: string;
  online: boolean;
}

/**
 * Static room configuration structure (from YAML config)
 * Used for backward compatibility with existing configuration
 */
export interface StaticRoomConfig {
  roomName: string;
  roomId: string;
}

/**
 * Room statistics for dashboard display
 */
export interface RoomStats {
  total: number;
  online: number;
  offline: number;
}

/**
 * Room discovery state tracking
 */
export interface RoomDiscoveryState {
  isDiscovering: boolean;
  error: string | null;
  lastUpdated: number | null;
}

/**
 * Combined room data source interface
 * Supports both static and dynamic room sources
 */
export interface RoomDataSource {
  rooms: AdaptedRoom[];
  isLoading: boolean;
  error: string | null;
  source: 'static' | 'dynamic' | 'hybrid';
  stats: RoomStats;
}

/**
 * Room loading states for UI feedback
 */
export enum RoomLoadingState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  DISCOVERING = 'discovering',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Room error types for specific error handling
 */
export enum RoomErrorType {
  CONNECTION_FAILED = 'connection_failed',
  DISCOVERY_TIMEOUT = 'discovery_timeout',
  NO_ROOMS_FOUND = 'no_rooms_found',
  WEBSOCKET_ERROR = 'websocket_error'
}

export default AdaptedRoom;