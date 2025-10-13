"use client";

console.log('[AirconProvider.tsx] MODULE LOADED');

import { createContext, PropsWithChildren, useEffect, useRef } from "react";
import createApiAirconStore, { ApiAirconStore } from "@/stores/api-aircon-store";
import { websocketClient } from "@/lib/websocket/websocket-client";
import { RoomInfo, RoomStatusUpdatePayload } from "@/lib/websocket";
import { deriveAirConStateFromDevice, deriveAirConStateFromPayload, deriveSettingsFromPayload, deriveSettingsFromState } from "@/stores/api-aircon-store";
import type { DeviceInfo } from "@/types/room";
import { AirConState, AirConSettings } from "@/lib/mqtt/mqtt-config";

export const ApiAirconContext = createContext<ApiAirconStore | null>(null);

type ApiAirconProviderProps = PropsWithChildren<{
  roomId: string;
}>;

export const ApiAirconProvider: React.FC<ApiAirconProviderProps> = ({
  roomId,
  children,
}) => {
  console.log('[ApiAirconProvider] Component rendering with roomId:', roomId);

  const airconStore = useRef<ApiAirconStore | undefined>(undefined);

  if (!airconStore.current) {
    console.log('[ApiAirconProvider] Creating new aircon store');
    airconStore.current = createApiAirconStore();
  }

  console.log('[ApiAirconProvider] About to run useEffect, roomId:', roomId);

  // CRITICAL: Force useEffect to run by temporarily removing deps
  useEffect(() => {
    console.log('========================================');
    console.log('[ApiAirconProvider] useEffect RUNNING for roomId:', roomId);
    console.log('========================================');

    try {
      const store = airconStore.current!;
      console.log('[ApiAirconProvider] Got store:', !!store);

      const state = store.getState();
      console.log('[ApiAirconProvider] Got state:', !!state);

      console.log('AirconProvider: Initializing with new WebSocket client for room:', roomId);

    // Initialize WebSocket connection using the new client with roomId
    const websocketStream$ = websocketClient.connect(roomId, state.setIsConnected);
    console.log('AirconProvider: WebSocket stream created:', websocketStream$);

    // Store the stream reference for potential use
    store.setState({ websocketStream$ });

    // Subscribe to WebSocket messages
    console.log('AirconProvider: Setting up subscription to websocketStream$');
    const subscription = websocketStream$.subscribe({
      next: (message) => {
        const { type, roomId, data } = message;
        console.log('AirconProvider: Received message:', { type, roomId, data });

        switch (type) {
        case 'room-state':
          if (roomId) {
            state.updateRoomState(roomId, data as AirConState);
            console.debug('AirconProvider: Legacy room-state applied', { roomId, data });
          }
          break;
        case 'room-settings':
          if (roomId) {
            state.updateRoomSettings(roomId, data as AirConSettings);
            console.debug('AirconProvider: Legacy room-settings applied', { roomId, data });
          }
          break;
        case 'room-status-update':
          if (data) {
            state.applyRoomStatusUpdate(data as RoomStatusUpdatePayload);
            const payload = data as RoomStatusUpdatePayload;
            const primaryDevice: DeviceInfo | undefined = payload.deviceUpdates?.find((device) => device.currentStatus);
            const derivedState =
              deriveAirConStateFromPayload(payload) ??
              deriveAirConStateFromDevice(primaryDevice);
            console.debug('AirconProvider: Room status update received', {
              roomId: payload.roomId,
              updateType: payload.updateType,
              deviceCount: payload.deviceUpdates?.length ?? 0,
              derivedStateExists: !!derivedState,
            });
            if (derivedState) {
              console.debug('AirconProvider: Derived state evaluated', { roomId: payload.roomId, derivedState });
              state.updateRoomState(payload.roomId, derivedState);
              state.updateRoomSettings(
                payload.roomId,
                deriveSettingsFromPayload(payload.settings) ?? deriveSettingsFromState(derivedState)
              );
            } else if (payload.settings) {
              const derivedSettings = deriveSettingsFromPayload(payload.settings);
              if (derivedSettings) {
                state.updateRoomSettings(payload.roomId, derivedSettings);
              }
            }
          }
          break;
        case 'mqtt-status':
          state.setIsMqttConnected(data as boolean);
          break;
        case 'rooms':
          // Handle rooms list update
          const roomsData = data as RoomInfo[];
          if (Array.isArray(roomsData)) {
            state.setRooms(roomsData);
          }
          break;
        case 'heartbeat':
          // Handle heartbeat for connection health
          console.log('AirconProvider: Heartbeat received');
          break;
        case 'error':
          console.error('AirconProvider: WebSocket error:', data);
          break;
        default:
          console.log('AirconProvider: Unknown message type:', type, data);
        }
      },
      error: (error) => {
        console.error('AirconProvider: Subscription error:', error);
      },
      complete: () => {
        console.log('AirconProvider: Subscription completed');
      }
    });

    // Cleanup function
    return () => {
      console.log('AirconProvider: Cleaning up WebSocket connection for room:', roomId);
      subscription.unsubscribe();
      websocketClient.disconnect().catch(console.error);
    };
    } catch (error) {
      console.error('[ApiAirconProvider] useEffect ERROR:', error);
      throw error;
    }
  }, [roomId]); // Reconnect when roomId changes

  return (
    <ApiAirconContext.Provider value={airconStore.current!}>
      {children}
    </ApiAirconContext.Provider>
  );
};
