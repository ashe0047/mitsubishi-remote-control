import { createStore } from 'zustand/vanilla';
import { MODE_VALUES, FAN_VALUES, type AirConSettings, type AirConState } from '@/lib/mqtt/mqtt-config';
import type { ApiAirconStoreState } from './api-aircon-store';

interface RoomInfo {
  settings: AirConSettings;
  state: AirConState;
  name?: string;
  online?: boolean;
}

export interface DemoAirconState extends Partial<ApiAirconStoreState> {
  isConnected: boolean;
  isMqttConnected: boolean;
  isProcessingCommands: boolean;
  rooms: Record<string, RoomInfo>;

  // Actions
  setIsConnected: (connected: boolean) => void;
  setIsMqttConnected: (connected: boolean) => void;
  setIsProcessingCommands: (processing: boolean) => void;
  setRooms: (rooms: unknown[]) => void;
  updateRoomState: (roomId: string, state: Partial<AirConState>) => void;
  updateRoomSettings: (roomId: string, settings: Partial<AirConSettings>) => void;
  getRoomInfo: (roomId: string) => RoomInfo | undefined;
  setPower: (roomId: string, power: string) => Promise<void>;
  setTemperature: (roomId: string, temperature: number) => Promise<void>;
  setMode: (roomId: string, mode: string) => Promise<void>;
  setFan: (roomId: string, fan: string) => Promise<void>;
  setVane: (roomId: string, vane: string) => Promise<void>;
  setWideVane: (roomId: string, wideVane: string) => Promise<void>;
  updateSettings: (roomId: string, settings: AirConSettings) => Promise<void>;

  // Query methods
  getRoomsList: () => Array<{ roomName: string; roomId: string; online: boolean }>;
  isRoomOnline: (roomId: string) => boolean;
  getRoomCount: () => number;
  getOnlineRoomCount: () => number;
  isDiscoveringRooms: boolean;
  roomDiscoveryError: string | null;
  roomsLastUpdated: number | null;
  setIsDiscoveringRooms: (discovering: boolean) => void;
  setRoomDiscoveryError: (error: string | null) => void;
  setRoomsLastUpdated: (timestamp: number | null) => void;
}

const initialDemoRooms: Record<string, RoomInfo> = {
  'living-room': {
    settings: {
      mode: MODE_VALUES.COOL,
      temperature: 24,
      fan: FAN_VALUES.AUTO,
      vane: 'AUTO',
      wideVane: '|',
    },
    state: {
      mode: MODE_VALUES.COOL,
      temperature: 24,
      fan: FAN_VALUES.AUTO,
      vane: 'AUTO',
      wideVane: '|',
      roomTemperature: 26,
    },
    name: 'Living Room',
    online: true,
  },
  'bedroom': {
    settings: {
      mode: MODE_VALUES.HEAT,
      temperature: 22,
      fan: FAN_VALUES.QUIET,
      vane: 'AUTO',
      wideVane: '|',
    },
    state: {
      mode: MODE_VALUES.HEAT,
      temperature: 22,
      fan: FAN_VALUES.QUIET,
      vane: 'AUTO',
      wideVane: '|',
      roomTemperature: 20,
    },
    name: 'Bedroom',
    online: true,
  },
  'kitchen': {
    settings: {
      mode: MODE_VALUES.DRY,
      temperature: 25,
      fan: FAN_VALUES.ONE,
      vane: 'AUTO',
      wideVane: '|',
    },
    state: {
      mode: MODE_VALUES.DRY,
      temperature: 25,
      fan: FAN_VALUES.ONE,
      vane: 'AUTO',
      wideVane: '|',
      roomTemperature: 27,
    },
    name: 'Kitchen',
    online: true,
  },
};

export type DemoAirconStore = ReturnType<typeof createDemoAirconStore>;

const createDemoAirconStore = () => {
  return createStore<DemoAirconState>((set, get) => ({
    isConnected: true,
    isMqttConnected: true,
    isProcessingCommands: false,
    rooms: initialDemoRooms,
    isDiscoveringRooms: false,
    roomDiscoveryError: null,
    roomsLastUpdated: Date.now(),

    // Connection status for demo
    connectionStatus: {
      overall: 'healthy' as const,
      websocket: {
        state: 'connected' as const,
        lastConnected: Date.now(),
        reconnectAttempts: 0,
      },
      mqtt: {
        state: 'connected' as const,
        lastMessage: Date.now(),
      },
    },

    // Navigation state for demo
    navigationState: {
      currentPath: '/app/demo',
      previousPath: null,
      isNavigating: false,
    },

    setIsConnected: (connected: boolean) => set({ isConnected: connected }),

    setIsMqttConnected: (connected: boolean) => set({ isMqttConnected: connected }),

    setIsProcessingCommands: (processing: boolean) => set({ isProcessingCommands: processing }),

    setRooms: () => {
      // No-op for demo mode
    },

    getRoomInfo: (roomId: string) => get().rooms[roomId],

    setIsDiscoveringRooms: (discovering: boolean) => set({ isDiscoveringRooms: discovering }),

    setRoomDiscoveryError: (error: string | null) => set({ roomDiscoveryError: error }),

    setRoomsLastUpdated: (timestamp: number | null) => set({ roomsLastUpdated: timestamp }),

    isRoomOnline: (roomId: string) => get().rooms[roomId]?.online || false,

    updateConnectionStatus: () => {
      // No-op for demo mode - status is always healthy
    },

    updateNavigationState: () => {
      // No-op for demo mode
    },

    startStatusPolling: () => {
      // No-op for demo mode
    },

    stopStatusPolling: () => {
      // No-op for demo mode
    },

    statusPollingInterval: null,

    updateRoomState: (roomId: string, stateUpdate: Partial<AirConState>) => {
      const rooms = get().rooms;
      const room = rooms[roomId];
      if (!room) return;

      set({
        rooms: {
          ...rooms,
          [roomId]: {
            ...room,
            state: { ...room.state, ...stateUpdate },
          },
        },
      });
    },

    updateRoomSettings: (roomId: string, settingsUpdate: Partial<AirConSettings>) => {
      const rooms = get().rooms;
      const room = rooms[roomId];
      if (!room) return;

      set({
        rooms: {
          ...rooms,
          [roomId]: {
            ...room,
            settings: { ...room.settings, ...settingsUpdate },
          },
        },
      });
    },

    setPower: async (roomId: string, power: string) => {
      console.log(`[DEMO] Setting power for ${roomId}:`, power);
      get().updateRoomState(roomId, { mode: power as AirConState['mode'] });
      get().updateRoomSettings(roomId, { mode: power as AirConSettings['mode'] });
    },

    setTemperature: async (roomId: string, temperature: number) => {
      console.log(`[DEMO] Setting temperature for ${roomId}:`, temperature);
      get().updateRoomState(roomId, { temperature });
      get().updateRoomSettings(roomId, { temperature });
    },

    setMode: async (roomId: string, mode: string) => {
      console.log(`[DEMO] Setting mode for ${roomId}:`, mode);
      get().updateRoomState(roomId, { mode: mode as AirConState['mode'] });
      get().updateRoomSettings(roomId, { mode: mode as AirConSettings['mode'] });
    },

    setFan: async (roomId: string, fan: string) => {
      console.log(`[DEMO] Setting fan for ${roomId}:`, fan);
      get().updateRoomState(roomId, { fan: fan as AirConState['fan'] });
      get().updateRoomSettings(roomId, { fan: fan as AirConSettings['fan'] });
    },

    setVane: async (roomId: string, vane: string) => {
      console.log(`[DEMO] Setting vane for ${roomId}:`, vane);
      get().updateRoomState(roomId, { vane: vane as AirConState['vane'] });
      get().updateRoomSettings(roomId, { vane: vane as AirConSettings['vane'] });
    },

    setWideVane: async (roomId: string, wideVane: string) => {
      console.log(`[DEMO] Setting wideVane for ${roomId}:`, wideVane);
      get().updateRoomState(roomId, { wideVane: wideVane as AirConState['wideVane'] });
      get().updateRoomSettings(roomId, { wideVane: wideVane as AirConSettings['wideVane'] });
    },

    updateSettings: async (roomId: string, settings: AirConSettings) => {
      console.log(`[DEMO] Updating settings for ${roomId}:`, settings);
      get().updateRoomSettings(roomId, settings);
      get().updateRoomState(roomId, settings);
    },

    getRoomsList: () => {
      const rooms = get().rooms;
      return Object.entries(rooms).map(([roomId, room]) => ({
        roomId,
        roomName: room.name || roomId,
        online: room.online || false,
      }));
    },

    getRoomCount: () => Object.keys(get().rooms).length,

    getOnlineRoomCount: () =>
      Object.values(get().rooms).filter(room => room.online).length,
  }));
};

export default createDemoAirconStore;
