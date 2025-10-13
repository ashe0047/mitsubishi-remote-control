import { AirConSettings, AirConState, MODE_VALUES } from "@/lib/mqtt/mqtt-config";
import { websocketClient } from "@/lib/websocket/websocket-client";
import { WSMessage, RoomInfo, RoomStatusSettingsPayload, RoomStatusUpdatePayload } from "@/lib/websocket";
import { ConnectionStatus, NavigationState } from "@/types/navigation";
import { createStore } from "zustand";
import { Observable } from "rxjs";
import { AdaptedRoom, RoomStats } from "@/types/rooms";
import { adaptRoomsList, getRoomStats, isRoomOnline } from "@/lib/adapters/room-adapter";
import { getQuotaApiClient, QuotaExceededException, QuotaValidationResult } from "@/lib/api/quota-api-factory";
import { roomApiClient } from "@/lib/api/room-api-client";
import { useRoomStore } from "@/stores/room-store";
import { DeviceType } from "@/types/device";
import type { DeviceControlAction, DeviceInfo } from "@/types/room";

type RoomsType = Record<string, RoomInfo>;

type ControlParams = Record<string, any>;

/**
 * Tracks when data was received for a specific room.
 * Used to determine loading state independently of connection status.
 */
export interface RoomDataTimestamps {
  /** Timestamp when state (temperature, mode, etc.) was received */
  stateReceived: number | null;

  /** Timestamp when settings (configuration) were received */
  settingsReceived: number | null;

  /** Timestamp when device list was received */
  devicesReceived: number | null;

  /** Timestamp of first message of any type (used for timeout logic) */
  firstMessageReceived: number | null;
}

const FAN_SPEED_MAP: Record<string, string> = {
  auto: "AUTO",
  quiet: "QUIET",
  low: "1",
  medium: "3",
  middle: "2",
  high: "4"
};

const normalizeFanSpeedForApi = (fan: string): string => {
  const normalized = fan.trim().toLowerCase();
  return FAN_SPEED_MAP[normalized] ?? fan.toUpperCase();
};

const normalizeVaneForApi = (vane: string): string => vane.trim().toUpperCase();

const normalizeWideVaneForApi = (wideVane: string): string => wideVane.trim().toUpperCase();

const isAirConditionerDevice = (device?: DeviceInfo | null): boolean => {
  if (!device) {
    return false;
  }

  const type = typeof device.type === "string" ? device.type.toLowerCase() : "";
  return type === DeviceType.AIR_CONDITIONER || type === "air_conditioner";
};

const pickPrimaryDevice = (devices?: DeviceInfo[] | null): DeviceInfo | undefined => {
  if (!devices || devices.length === 0) {
    return undefined;
  }

  const enabledAirCon = devices.find((device) => device.enabled && isAirConditionerDevice(device));
  if (enabledAirCon) {
    return enabledAirCon;
  }

  const anyAirCon = devices.find((device) => isAirConditionerDevice(device));
  if (anyAirCon) {
    return anyAirCon;
  }

  const enabledDevice = devices.find((device) => device.enabled);
  return enabledDevice ?? devices[0];
};

const resolveDeviceIdentifier = (roomId: string, state: { rooms: RoomsType }): string | null => {
  const roomInfo = state.rooms[roomId];
  const deviceFromWs = pickPrimaryDevice(roomInfo?.devices);
  if (deviceFromWs?.deviceIdentifier) {
    return deviceFromWs.deviceIdentifier;
  }

  const roomStoreState = useRoomStore.getState();
  const fallbackRoom =
    roomStoreState.rooms.find((room) => room.id === roomId) ||
    roomStoreState.rooms.find((room) => room.roomIdentifier === roomId);

  const fallbackDevice = pickPrimaryDevice(fallbackRoom?.devices);
  return fallbackDevice?.deviceIdentifier ?? null;
};

const mapActionToDeviceControl = (action: string, params: ControlParams): DeviceControlAction => {
  switch (action) {
    case "power": {
      const rawPower = params.power;
      if (typeof rawPower !== "string") {
        throw new Error("Power value is required for power command");
      }

      const normalized = rawPower.toLowerCase();
      if (normalized !== "on" && normalized !== "off") {
        throw new Error(`Unsupported power value: ${rawPower}`);
      }

      return {
        type: "power",
        payload: { power: normalized as "on" | "off" }
      };
    }
    case "set_temperature": {
      const temperatureValue = params.targetTemperature ?? params.temperature ?? params.value;
      const temperature = Number(temperatureValue);
      if (!Number.isFinite(temperature)) {
        throw new Error("Temperature value is required for set_temperature");
      }

      return {
        type: "temperature",
        payload: { temperature }
      };
    }
    case "set_mode": {
      const mode = params.mode;
      if (typeof mode !== "string") {
        throw new Error("Mode value is required for set_mode");
      }
      return {
        type: "mode",
        payload: { mode }
      };
    }
    case "set_fan": {
      const fanSpeed = params.fanSpeed ?? params.fan;
      if (typeof fanSpeed !== "string") {
        throw new Error("Fan speed is required for set_fan");
      }
      return {
        type: "fan",
        payload: { fan: normalizeFanSpeedForApi(fanSpeed) }
      };
    }
    case "set_vane": {
      const vane = params.vanePosition ?? params.vane;
      if (typeof vane !== "string") {
        throw new Error("Vane position is required for set_vane");
      }
      return {
        type: "vane",
        payload: { vane: normalizeVaneForApi(vane) }
      };
    }
    case "set_wide_vane": {
      const wideVane = params.wideVanePosition ?? params.wideVane;
      if (typeof wideVane !== "string") {
        throw new Error("Wide vane position is required for set_wide_vane");
      }
      return {
        type: "wideVane",
        payload: { wideVane: normalizeWideVaneForApi(wideVane) }
      };
    }
    case "update_settings": {
      const settings = params.settings;
      if (!settings || typeof settings !== "object") {
        throw new Error("Settings payload is required for update_settings");
      }
      return {
        type: "settings",
        payload: settings
      };
    }
    default:
      throw new Error(`Unsupported control action: ${action}`);
  }
};

const executeDeviceControlViaRoomApi = async (
  roomId: string,
  action: string,
  params: ControlParams,
  state: { rooms: RoomsType }
): Promise<void> => {
  const deviceIdentifier = resolveDeviceIdentifier(roomId, state);
  if (!deviceIdentifier) {
    throw new Error(`No controllable air conditioner device found for room ${roomId}`);
  }

  const controlAction = mapActionToDeviceControl(action, params);
  await roomApiClient.controlDevice(roomId, deviceIdentifier, controlAction);
};


export interface ApiAirconProps {
  isConnected: boolean;
  isMqttConnected: boolean;
  isProcessingCommands: boolean;
}

// Default connection status
const DEFAULT_CONNECTION_STATUS: ConnectionStatus = {
  websocket: {
    state: 'disconnected',
    lastConnected: null,
    reconnectAttempts: 0,
  },
  mqtt: {
    state: 'unknown',
    lastUpdate: null,
  },
  overall: 'disconnected',
};

// Default navigation state
const DEFAULT_NAVIGATION_STATE: NavigationState = {
  currentRoute: '/',
  previousRoute: null,
  canGoBack: false,
  isNavigating: false,
};

export interface ApiAirconStoreState extends ApiAirconProps {
  // Connection management
  setIsConnected: (connected: boolean) => void;
  setIsMqttConnected: (connected: boolean) => void;
  setIsProcessingCommands: (processing: boolean) => void;
  
  // Room data
  rooms: RoomsType;
  setRooms: (rooms: RoomInfo[]) => void;
  updateRoomState: (roomId: string, state: AirConState) => void;
  updateRoomSettings: (roomId: string, settings: AirConSettings) => void;
  applyRoomStatusUpdate: (update: RoomStatusUpdatePayload) => void;
  getRoomInfo: (roomId: string) => RoomInfo | undefined;
  
  // Room discovery state management
  isDiscoveringRooms: boolean;
  roomDiscoveryError: string | null;
  roomsLastUpdated: number | null;
  setIsDiscoveringRooms: (discovering: boolean) => void;
  setRoomDiscoveryError: (error: string | null) => void;
  setRoomsLastUpdated: (timestamp: number | null) => void;
  
  // Room helper methods for UI consumption
  getRoomsList: () => AdaptedRoom[];
  isRoomOnline: (roomId: string) => boolean;
  getRoomCount: () => number;
  getOnlineRoomCount: () => number;
  getRoomStats: () => RoomStats;
  
  // Enhanced connection status tracking
  connectionStatus: ConnectionStatus;
  updateConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  
  // Navigation state management
  navigationState: NavigationState;
  updateNavigationState: (state: Partial<NavigationState>) => void;
  
  // Status polling
  statusPollingInterval: NodeJS.Timeout | null;
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
  
  // Control commands (with quota validation)
  setPower: (roomId: string, power: string) => Promise<void>;
  setTemperature: (roomId: string, temperature: number) => Promise<void>;
  setMode: (roomId: string, mode: string) => Promise<void>;
  setFan: (roomId: string, fan: string) => Promise<void>;
  setVane: (roomId: string, vane: string) => Promise<void>;
  setWideVane: (roomId: string, wideVane: string) => Promise<void>;
  updateSettings: (roomId: string, settings: AirConSettings) => Promise<void>;

  // Quota management
  quotaValidationEnabled: boolean;
  setQuotaValidationEnabled: (enabled: boolean) => void;
  lastQuotaValidation: QuotaValidationResult | null;
  setLastQuotaValidation: (result: QuotaValidationResult | null) => void;

  // Command validation
  validateCommand: (roomId: string, action: string, params?: Record<string, any>) => Promise<QuotaValidationResult>;

  // Session management
  currentUsageSessions: Record<string, string>; // roomId -> sessionId
  startUsageSession: (roomId: string, initialSettings: AirConSettings) => Promise<string>;
  endUsageSession: (roomId: string) => Promise<void>;

  // Internal helper method for quota-aware command execution
  executeQuotaAwareCommand: (
    roomId: string,
    action: string,
    params: Record<string, any>,
    fallbackWebSocketCommand: () => Promise<void>
  ) => Promise<void>;

  // WebSocket stream
  websocketStream$?: Observable<WSMessage>;

  // ===== LOADING STATE TRACKING =====

  /**
   * Tracks when data was received for each room.
   * Key: roomId, Value: timestamp record
   */
  roomDataTimestamps: Record<string, RoomDataTimestamps>;

  /**
   * Mark that room state data was received.
   * Called when updateRoomState() processes a message.
   */
  markRoomStateReceived: (roomId: string) => void;

  /**
   * Mark that room settings data was received.
   * Called when updateRoomSettings() processes a message.
   */
  markRoomSettingsReceived: (roomId: string) => void;

  /**
   * Mark that device list was received for room.
   * Called when room info includes devices array.
   */
  markRoomDevicesReceived: (roomId: string) => void;

  /**
   * Check if room has received ANY data (state, settings, or devices).
   * @returns true if any data type has been received
   */
  hasReceivedRoomData: (roomId: string) => boolean;

  /**
   * Check if room has received state data specifically.
   */
  hasReceivedRoomState: (roomId: string) => boolean;

  /**
   * Check if room has received settings data specifically.
   */
  hasReceivedRoomSettings: (roomId: string) => boolean;

  /**
   * Get age of room data in milliseconds since first message.
   * @returns milliseconds since first data, or null if no data received
   */
  getRoomDataAge: (roomId: string) => number | null;
}

export type ApiAirconStore = ReturnType<typeof createApiAirconStore>;

const createApiAirconStore = (initProps?: Partial<ApiAirconProps>) => {
  const DEFAULT_PROPS: ApiAirconProps = {
    isConnected: false,
    isMqttConnected: false,
    isProcessingCommands: false,
  };

  return createStore<ApiAirconStoreState>()((set, get) => ({
    ...DEFAULT_PROPS,
    ...initProps,
    rooms: {},
    connectionStatus: DEFAULT_CONNECTION_STATUS,
    navigationState: DEFAULT_NAVIGATION_STATE,

    // Quota management initial state
    quotaValidationEnabled: true, // Enable quota validation by default
    lastQuotaValidation: null,
    currentUsageSessions: {},
    statusPollingInterval: null,
    
    // Room discovery state initialization
    isDiscoveringRooms: false,
    roomDiscoveryError: null,
    roomsLastUpdated: null,

    // Loading state tracking initialization
    roomDataTimestamps: {},

    // Loading state tracking methods
    markRoomStateReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              stateReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    markRoomSettingsReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              settingsReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    markRoomDevicesReceived: (roomId) => {
      set((state) => {
        const timestamps = state.roomDataTimestamps[roomId] ?? {
          stateReceived: null,
          settingsReceived: null,
          devicesReceived: null,
          firstMessageReceived: null,
        };

        const now = Date.now();

        return {
          roomDataTimestamps: {
            ...state.roomDataTimestamps,
            [roomId]: {
              ...timestamps,
              devicesReceived: now,
              firstMessageReceived: timestamps.firstMessageReceived ?? now,
            },
          },
        };
      });
    },

    hasReceivedRoomData: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      if (!timestamps) return false;

      return (
        timestamps.stateReceived !== null ||
        timestamps.settingsReceived !== null ||
        timestamps.devicesReceived !== null
      );
    },

    hasReceivedRoomState: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      return timestamps?.stateReceived !== null;
    },

    hasReceivedRoomSettings: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      return timestamps?.settingsReceived !== null;
    },

    getRoomDataAge: (roomId) => {
      const timestamps = get().roomDataTimestamps[roomId];
      const firstReceived = timestamps?.firstMessageReceived;

      if (!firstReceived) return null;

      return Date.now() - firstReceived;
    },

    setIsConnected: (connected) => {
      set({ isConnected: connected });
      // Update connection status when WebSocket connection changes
      get().updateConnectionStatus({
        websocket: {
          state: connected ? 'connected' : 'disconnected',
          lastConnected: connected ? Date.now() : get().connectionStatus.websocket.lastConnected,
          reconnectAttempts: connected ? 0 : get().connectionStatus.websocket.reconnectAttempts,
        },
      });
    },
    
    setIsMqttConnected: (connected) => {
      set({ isMqttConnected: connected });
      // Update connection status when MQTT connection changes
      get().updateConnectionStatus({
        mqtt: {
          state: connected ? 'connected' : 'disconnected',
          lastUpdate: Date.now(),
        },
      });
    },
    
    setIsProcessingCommands: (processing) => set({ isProcessingCommands: processing }),

    setRooms: (roomList) => {
      const rooms: RoomsType = {};
      roomList.forEach(room => {
        rooms[room.id] = room;
        // Subscribe to this room's WebSocket state stream
        websocketClient.subscribeToRoomState(room.id);

        // Track that devices were received if available
        if (room.devices && room.devices.length > 0) {
          get().markRoomDevicesReceived(room.id);
        }
      });
      set({
        rooms,
        isDiscoveringRooms: false,
        roomDiscoveryError: null,
        roomsLastUpdated: Date.now()
      });
    },

    updateRoomState: (roomId, state) => {
      const rooms = get().rooms;
      if (rooms[roomId]) {
        rooms[roomId] = { ...rooms[roomId], state };
        set({ rooms: { ...rooms } });

        // Track that state was received
        get().markRoomStateReceived(roomId);
      }
    },

    updateRoomSettings: (roomId, settings) => {
      const rooms = get().rooms;
      if (rooms[roomId]) {
        rooms[roomId] = { ...rooms[roomId], settings };
        set({ rooms: { ...rooms } });

        // Track that settings were received
        get().markRoomSettingsReceived(roomId);
      }
    },

    applyRoomStatusUpdate: (update) => {
      set((state) => {
        const rooms = { ...state.rooms };
        const existing = rooms[update.roomId];
        const primaryDevice =
          update.deviceUpdates?.find((device) => device.currentStatus) ??
          update.deviceUpdates?.[0];
        const stateFromPayload = deriveAirConStateFromPayload(update);
        const stateFromDevice = deriveAirConStateFromDevice(primaryDevice);
        const stateFromDeviceList = deriveAirConStateFromDeviceList(update.deviceUpdates);
        const derivedState =
          stateFromPayload ??
          stateFromDevice ??
          stateFromDeviceList ??
          existing?.state ??
          createFallbackState(update);

        const derivedSettings =
          deriveSettingsFromPayload(update.settings ?? null) ??
          existing?.settings ??
          (derivedState ? deriveSettingsFromState(derivedState) : existing?.settings) ??
          createFallbackSettings(derivedState);

        rooms[update.roomId] = {
          id: update.roomId,
          name: update.roomName,
          online: deriveOnlineStatus(update),
          aggregateStatus: update.aggregateStatus ?? null,
          devices: update.deviceUpdates ?? existing?.devices ?? [],
          updatedAt: Date.parse(update.timestamp),
          state: derivedState ?? existing?.state,
          settings: derivedSettings ?? existing?.settings,
        };

        return {
          rooms,
          roomsLastUpdated: Date.now(),
        };
      });
    },

    getRoomInfo: (roomId) => {
      return get().rooms[roomId];
    },

    // Room discovery state management methods
    setIsDiscoveringRooms: (discovering) => {
      set({ isDiscoveringRooms: discovering });
    },

    setRoomDiscoveryError: (error) => {
      set({ roomDiscoveryError: error });
    },

    setRoomsLastUpdated: (timestamp) => {
      set({ roomsLastUpdated: timestamp });
    },

    // Room helper methods for UI consumption
    getRoomsList: () => {
      return adaptRoomsList(get().rooms);
    },

    isRoomOnline: (roomId) => {
      return isRoomOnline(get().rooms, roomId);
    },

    getRoomCount: () => {
      return Object.keys(get().rooms).length;
    },

    getOnlineRoomCount: () => {
      return Object.values(get().rooms).filter(room => room.online).length;
    },

    getRoomStats: () => {
      return getRoomStats(get().rooms);
    },

    // Enhanced connection status management
    updateConnectionStatus: (statusUpdate) => {
      const current = get().connectionStatus;
      const updated: ConnectionStatus = {
        websocket: { ...current.websocket, ...statusUpdate.websocket },
        mqtt: { ...current.mqtt, ...statusUpdate.mqtt },
        overall: current.overall,
      };
      
      // Update overall status based on individual connection states
      if (updated.websocket.state === 'connected' && updated.mqtt.state === 'connected') {
        updated.overall = 'healthy';
      } else if (updated.websocket.state === 'connected' && updated.mqtt.state !== 'connected') {
        updated.overall = 'degraded';
      } else {
        updated.overall = 'disconnected';
      }
      
      set({ connectionStatus: updated });
    },

    // Navigation state management
    updateNavigationState: (stateUpdate) => {
      const current = get().navigationState;
      const updated = { ...current, ...stateUpdate };
      set({ navigationState: updated });
    },

    // Status polling functionality
    startStatusPolling: () => {
      const state = get();
      if (state.statusPollingInterval) {
        return; // Already polling
      }
      
      const interval = setInterval(async () => {
        try {
          // Request MQTT status update from WebSocket server
          await websocketClient.getMqttStatus();
        } catch (error) {
          console.error('Status polling error:', error);
        }
      }, 30000); // Poll every 30 seconds
      
      set({ statusPollingInterval: interval });
    },

    stopStatusPolling: () => {
      const state = get();
      if (state.statusPollingInterval) {
        clearInterval(state.statusPollingInterval);
        set({ statusPollingInterval: null });
      }
    },

    // Quota management methods
    setQuotaValidationEnabled: (enabled: boolean) => {
      set({ quotaValidationEnabled: enabled });
    },

    setLastQuotaValidation: (result: QuotaValidationResult | null) => {
      set({ lastQuotaValidation: result });
    },

    validateCommand: async (roomId: string, action: string, params: Record<string, any> = {}) => {
      const quotaClient = getQuotaApiClient();

      const request = {
        roomId,
        action,
        ...params
      };

      try {
        const validationResult = await quotaClient.validateCommand(request);
        get().setLastQuotaValidation(validationResult);
        return validationResult;
      } catch (error) {
        console.error('Quota validation failed:', error);
        // Return fail-safe result
        const failSafeResult: QuotaValidationResult = {
          status: 'FAIL_OPEN',
          message: 'Validation service unavailable - command allowed',
          reason: error instanceof Error ? error.message : 'Unknown error'
        };
        get().setLastQuotaValidation(failSafeResult);
        return failSafeResult;
      }
    },

    startUsageSession: async (roomId: string, initialSettings: AirConSettings) => {
      const quotaClient = getQuotaApiClient();

      try {
        const response = await quotaClient.startUsageSession({
          roomId,
          initialSettings: initialSettings as Record<string, any>
        });

        if (response.sessionId) {
          const sessions = { ...get().currentUsageSessions };
          sessions[roomId] = response.sessionId;
          set({ currentUsageSessions: sessions });
          return response.sessionId;
        }

        throw new Error('No session ID returned');
      } catch (error) {
        console.error('Failed to start usage session:', error);
        throw error;
      }
    },

    endUsageSession: async (roomId: string) => {
      const quotaClient = getQuotaApiClient();
      const sessions = get().currentUsageSessions;
      const sessionId = sessions[roomId];

      if (!sessionId) {
        console.warn(`No active session found for room ${roomId}`);
        return;
      }

      try {
        await quotaClient.endUsageSession(sessionId, { roomId });

        // Remove session from active sessions
        const updatedSessions = { ...sessions };
        delete updatedSessions[roomId];
        set({ currentUsageSessions: updatedSessions });
      } catch (error) {
        console.error('Failed to end usage session:', error);
        throw error;
      }
    },

    // Helper function for quota-aware command execution
    executeQuotaAwareCommand: async (
      roomId: string,
      action: string,
      params: Record<string, any>,
      fallbackWebSocketCommand: () => Promise<void>
    ) => {
      const state = get();

      const executeViaRoomApi = async () => executeDeviceControlViaRoomApi(roomId, action, params, state);

      const runFallback = async (cause: unknown) => {
        console.warn('Legacy fallback execution triggered for device control:', {
          action,
          roomId,
          originalError: cause instanceof Error ? cause.message : cause
        });
        await fallbackWebSocketCommand();
      };

      if (!state.quotaValidationEnabled) {
        console.log('Quota validation disabled, executing command via Room API');
        try {
          await executeViaRoomApi();
          return;
        } catch (httpError) {
          console.warn('Room API command failed while quota validation disabled:', httpError);
          await runFallback(httpError);
          return;
        }
      }

      const quotaClient = getQuotaApiClient();

      try {
        const commandRequest = {
          roomId,
          action,
          ...params
        };

        const result = await quotaClient.validateAndExecuteCommand(commandRequest, {
          onValidationResult: (validationResult) => {
            state.setLastQuotaValidation(validationResult);

            if (validationResult.status === 'ALLOW_WITH_WARNING') {
              console.warn('Command allowed with warning:', validationResult.message);
            }
          },
          onQuotaExceeded: (error) => {
            console.error('Command blocked by quota:', error.message);
            throw error;
          }
        });

        console.log('Command executed successfully via quota API:', result.executionResult);
      } catch (error) {
        if (error instanceof QuotaExceededException) {
          throw error;
        }

        console.warn('Quota API failed, attempting Room API fallback:', error);

        try {
          await executeViaRoomApi();
        } catch (httpError) {
          console.error('Room API fallback failed:', httpError);
          await runFallback(httpError);
        }
      }
    },

    // Control commands - Quota-aware with WebSocket fallback
    setPower: async (roomId: string, power: string) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'power',
        { power },
        () => websocketClient.sendPowerCommand(roomId, power as 'on' | 'off')
      );
    },

    setTemperature: async (roomId: string, temperature: number) => {
      const state = get();
      const previousRoomInfo = state.rooms[roomId];
      const previousState = previousRoomInfo?.state
        ? { ...previousRoomInfo.state }
        : undefined;
      const previousSettings = previousRoomInfo?.settings
        ? { ...previousRoomInfo.settings }
        : undefined;

      const applyLocalTemperature = (nextTemperature: number) => {
        set((current) => {
          const rooms = { ...current.rooms };
          const existing = rooms[roomId];
          const roomStoreState = useRoomStore.getState();
          const fallbackRoom =
            roomStoreState.rooms.find((room) => room.id === roomId) ||
            roomStoreState.rooms.find((room) => room.roomIdentifier === roomId);

          const baseState =
            existing?.state ??
            deriveAirConStateFromDeviceList(existing?.devices) ??
            (fallbackRoom
              ? deriveAirConStateFromDeviceList(fallbackRoom.devices)
              : undefined) ??
            createDefaultState();

          const baseSettings =
            existing?.settings ??
            (fallbackRoom
              ? deriveSettingsFromState(
                  deriveAirConStateFromDeviceList(fallbackRoom.devices) ??
                    baseState
                )
              : undefined) ??
            deriveSettingsFromState(baseState);

          const updatedState: AirConState = {
            ...baseState,
            temperature: nextTemperature,
          };

          const updatedSettings: AirConSettings = {
            ...baseSettings,
            temperature: nextTemperature,
          };

          const nameFallback =
            existing?.name ??
            fallbackRoom?.name ??
            `Room ${roomId.substring(0, 4)}`;
          const onlineFallback =
            existing?.online ??
            (fallbackRoom?.aggregateStatus
              ? fallbackRoom.aggregateStatus.onlineDevices > 0
              : true);

          rooms[roomId] = {
            id: existing?.id ?? roomId,
            name: nameFallback,
            online: onlineFallback,
            state: updatedState,
            settings: updatedSettings,
            devices: existing?.devices ?? fallbackRoom?.devices,
            aggregateStatus:
              existing?.aggregateStatus ?? fallbackRoom?.aggregateStatus,
            updatedAt: Date.now(),
          };

          return { rooms };
        });
      };

      const restorePreviousState = () => {
        set((current) => {
          const rooms = { ...current.rooms };
          const existing = rooms[roomId];
          if (!existing) {
            return { rooms };
          }

          rooms[roomId] = {
            ...existing,
            state: previousState ?? existing.state,
            settings: previousSettings ?? existing.settings,
            updatedAt: Date.now(),
          };

          return { rooms };
        });
      };

      // Optimistic update for immediate UI feedback
      applyLocalTemperature(temperature);

      try {
        await state.executeQuotaAwareCommand(
          roomId,
          'set_temperature',
          { targetTemperature: temperature },
          () => websocketClient.sendTemperatureCommand(roomId, temperature)
        );
      } catch (error) {
        // Restore previous state if the command fails
        restorePreviousState();
        throw error;
      }
    },

    setMode: async (roomId: string, mode: string) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'set_mode',
        { mode },
        () => websocketClient.sendModeCommand(roomId, mode as 'heat' | 'cool' | 'auto' | 'dry' | 'fan')
      );
    },

    setFan: async (roomId: string, fan: string) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'set_fan',
        { fanSpeed: fan },
        async () => {
          console.warn('Legacy WebSocket fallback not available for fan command');
          throw new Error('WebSocket fallback not available for fan command');
        }
      );
    },

    setVane: async (roomId: string, vane: string) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'set_vane',
        { vanePosition: vane },
        async () => {
          console.warn('Legacy WebSocket fallback not available for vane command');
          throw new Error('WebSocket fallback not available for vane command');
        }
      );
    },

    setWideVane: async (roomId: string, wideVane: string) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'set_wide_vane',
        { wideVanePosition: wideVane },
        async () => {
          console.warn('Legacy WebSocket fallback not available for wide vane command');
          throw new Error('WebSocket fallback not available for wide vane command');
        }
      );
    },

    updateSettings: async (roomId: string, settings: AirConSettings) => {
      const state = get();
      return state.executeQuotaAwareCommand(
        roomId,
        'update_settings',
        { settings },
        async () => {
          console.warn('Legacy WebSocket fallback not available for settings command');
          throw new Error('WebSocket fallback not available for settings command');
        }
      );
    },
  }));
};

// Helper function to get initial connection status from WebSocket client
export const getInitialConnectionStatus = (): ConnectionStatus => {
  const isConnected = websocketClient.isConnected();
  return {
    websocket: {
      state: isConnected ? 'connected' : 'disconnected',
      lastConnected: isConnected ? Date.now() : null,
      reconnectAttempts: 0,
    },
    mqtt: {
      state: 'unknown', // Will be updated via WebSocket messages
      lastUpdate: null,
    },
    overall: isConnected ? 'degraded' : 'disconnected',
  };
};

export function deriveOnlineStatus(update: RoomStatusUpdatePayload): boolean {
  if (update.aggregateStatus) {
    return update.aggregateStatus.onlineDevices > 0;
  }
  return (update.deviceUpdates ?? []).some((device) => device.online);
}

function normalizeFanValue(fan?: string | null): AirConState["fan"] {
  if (!fan) return "AUTO";
  const upper = fan.toUpperCase();
  const allowed: AirConState["fan"][] = ["AUTO", "1", "2", "3", "4", "QUIET"];
  if (allowed.includes(upper as AirConState["fan"])) {
    return upper as AirConState["fan"];
  }
  const mapped: Record<string, AirConState["fan"]> = {
    LOW: "1",
    MIDDLE: "2",
    MEDIUM: "3",
    HIGH: "4",
    DIFFUSE: "QUIET",
  };
  return mapped[upper] ?? "AUTO";
}

function normalizeModeValue(mode?: string | null): AirConState["mode"] {
  if (!mode) return "off";
  const lower = mode.toLowerCase();
  const allowed: AirConState["mode"][] = ["off", "heat_cool", "cool", "dry", "heat", "fan_only"];
  if (allowed.includes(lower as AirConState["mode"])) {
    return lower as AirConState["mode"];
  }
  const mapping: Record<string, AirConState["mode"]> = {
    "heat-cool": "heat_cool",
    fan: "fan_only",
  };
  return mapping[lower] ?? "off";
}

function normalizeVaneValue(vane?: string | null): AirConState["vane"] {
  if (!vane) return "AUTO";
  const upper = vane.toUpperCase();
  const allowed: AirConState["vane"][] = ["AUTO", "1", "2", "3", "4", "5", "SWING"];
  return allowed.includes(upper as AirConState["vane"]) ? (upper as AirConState["vane"]) : "AUTO";
}

function normalizeWideVaneValue(wideVane?: string | null): AirConState["wideVane"] {
  if (!wideVane) return "|";
  const allowed: AirConState["wideVane"][] = ["<<", "<", "|", ">", ">>", "SWING"];
  return allowed.includes(wideVane as AirConState["wideVane"]) ? (wideVane as AirConState["wideVane"]) : "|";
}

export function deriveAirConStateFromPayload(update: RoomStatusUpdatePayload): AirConState | undefined {
  const state = update.state ?? null;
  const settings = update.settings ?? null;
  if (!state && !settings) {
    return undefined;
  }

  const temperature = state?.temperature ?? settings?.temperature ?? 24;
  const roomTemperature = state?.roomTemperature ?? -1;
  const mode = normalizeModeValue(state?.mode ?? settings?.mode);
  const fan = normalizeFanValue(state?.fan ?? settings?.fan);
  const vane = normalizeVaneValue(state?.vane ?? settings?.vane);
  const wideVane = normalizeWideVaneValue(state?.wideVane ?? settings?.wideVane);
  const power = settings?.power?.toLowerCase();

  return {
    roomTemperature,
    temperature,
    fan,
    vane,
    wideVane,
    mode,
    action: state?.action ?? (power === "on" || mode !== MODE_VALUES.OFF ? "running" : "idle"),
    compressorFrequency: state?.compressorFrequency ?? undefined,
  };
}

export function deriveAirConStateFromDeviceList(devices?: DeviceInfo[] | null): AirConState | undefined {
  if (!devices || devices.length === 0) {
    return undefined;
  }

  const candidateWithStatus = devices.find((device) => device.currentStatus);
  if (candidateWithStatus) {
    return deriveAirConStateFromDevice(candidateWithStatus);
  }

  // Fall back to first device without status by creating a neutral state
  return createDefaultState();
}

export function deriveAirConStateFromDevice(device?: DeviceInfo): AirConState | undefined {
  if (!device || !device.currentStatus) {
    return undefined;
  }

  const { currentStatus } = device;

  return {
    roomTemperature: currentStatus.roomTemperature ?? -1,
    temperature: currentStatus.temperature ?? currentStatus.roomTemperature ?? 24,
    fan: normalizeFanValue(currentStatus.fan),
    vane: normalizeVaneValue(currentStatus.vane),
    wideVane: normalizeWideVaneValue(currentStatus.wideVane),
    mode: normalizeModeValue(currentStatus.mode),
    action: currentStatus.power?.toLowerCase() === "on" ? "running" : "idle",
    compressorFrequency: currentStatus.compressorFrequency ?? undefined,
  };
}

export function deriveSettingsFromPayload(settings?: RoomStatusSettingsPayload | null): AirConSettings | undefined {
  if (!settings) {
    return undefined;
  }

  return {
    temperature: settings.temperature ?? 24,
    fan: normalizeFanValue(settings.fan),
    vane: normalizeVaneValue(settings.vane),
    wideVane: normalizeWideVaneValue(settings.wideVane),
    mode: normalizeModeValue(settings.mode),
  };
}

export function deriveSettingsFromState(state: AirConState): AirConSettings {
  return {
    temperature: state.temperature,
    fan: state.fan,
    vane: state.vane,
    wideVane: state.wideVane,
    mode: state.mode,
  };
}

function createFallbackState(update: RoomStatusUpdatePayload): AirConState {
  const aggregate = update.aggregateStatus;
  const avgTemp = aggregate?.averageTemperature;

  return {
    roomTemperature: avgTemp ?? -1,
    temperature: avgTemp ?? 24,
    fan: "AUTO",
    vane: "AUTO",
    wideVane: "|",
    mode: MODE_VALUES.OFF,
    action: "idle",
    compressorFrequency: undefined,
  };
}

function createFallbackSettings(state: AirConState | undefined): AirConSettings {
  return deriveSettingsFromState(state ?? createDefaultState());
}

function createDefaultState(): AirConState {
  return {
    roomTemperature: -1,
    temperature: 24,
    fan: "AUTO",
    vane: "AUTO",
    wideVane: "|",
    mode: MODE_VALUES.OFF,
    action: "idle",
    compressorFrequency: undefined,
  };
}

export default createApiAirconStore;
