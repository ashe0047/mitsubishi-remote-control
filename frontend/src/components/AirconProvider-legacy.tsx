"use client";

/**
 * @deprecated This is a legacy provider kept for reference only.
 * Use the updated AirconProvider.tsx which requires a roomId parameter.
 * This file should be removed once all legacy code is migrated.
 */

import { createContext, PropsWithChildren, useEffect, useRef } from "react";
import createApiAirconStore, { ApiAirconStore } from "@/stores/api-aircon-store";
import { websocketClient } from "@/lib/websocket/websocket-client";
import { RoomInfo } from "@/lib/websocket/types";
import { AirConState, AirConSettings } from "@/lib/mqtt/mqtt-config";

export const ApiAirconContext = createContext<ApiAirconStore | null>(null);

type ApiAirconProviderProps = PropsWithChildren;

export const ApiAirconProvider: React.FC<ApiAirconProviderProps> = ({
  children,
}) => {
  const airconStore = useRef<ApiAirconStore | undefined>(undefined);

  if (!airconStore.current) {
    airconStore.current = createApiAirconStore();
  }

  useEffect(() => {
    const store = airconStore.current!;
    const state = store.getState();

    // Initialize WebSocket connection with placeholder roomId (legacy - should not be used)
    console.warn('Using legacy AirconProvider - this should be migrated to use the updated provider with roomId');
    const websocketStream$ = websocketClient.connect('LEGACY_NO_ROOM', state.setIsConnected);
    
    // Store the stream reference for potential use
    store.setState({ websocketStream$ });

    // Subscribe to WebSocket messages
    const subscription = websocketStream$.subscribe((message) => {
      const { type, roomId, data } = message;
      
      switch (type) {
        case 'room-state':
          if (roomId) {
            state.updateRoomState(roomId, data as AirConState);
          }
          break;
        case 'room-settings':
          if (roomId) {
            state.updateRoomSettings(roomId, data as AirConSettings);
          }
          break;
        case 'mqtt-status':
          state.setIsMqttConnected(data as boolean);
          break;
        case 'rooms':
          state.setRooms(data as RoomInfo[]);
          break;
        case 'command-response':
          state.setIsProcessingCommands(false);
          console.log(`Command response: ${data}`);
          break;
      }
    });

    // Room data is loaded automatically via WebSocket when connected
    // No more REST API polling - WebSocket provides real-time updates

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      websocketClient.disconnect();
    };
  }, []);

  return (
    <ApiAirconContext.Provider value={airconStore.current}>
      {children}
    </ApiAirconContext.Provider>
  );
};