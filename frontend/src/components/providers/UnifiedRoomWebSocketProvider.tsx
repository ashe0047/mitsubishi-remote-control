/**
 * Unified Room WebSocket Provider
 *
 * Provides WebSocket integration for the unified room store.
 * Automatically manages WebSocket connections and real-time updates.
 */

'use client';

import React, { useEffect } from 'react';
import { useUnifiedRoomWebSocket } from '@/hooks/useUnifiedRoomWebSocket';
import { useUnifiedRoomStore } from '@/stores/unified-room-store';
import { useAuthStore } from '@/stores/auth-store';

interface UnifiedRoomWebSocketProviderProps {
  children: React.ReactNode;
  /**
   * Whether to automatically connect WebSocket on mount.
   * @default true
   */
  autoConnect?: boolean;
  /**
   * Specific room ID to subscribe to.
   * If not provided, subscribes to all rooms.
   */
  roomId?: string;
  /**
   * Whether to show connection status in console.
   * @default true in development
   */
  debug?: boolean;
}

/**
 * Provider component that integrates WebSocket real-time updates with unified room store.
 * 
 * Features:
 * - Automatic WebSocket connection management
 * - Real-time device status updates
 * - Room aggregate status updates
 * - Connection status monitoring
 * - Error handling and recovery
 * 
 * @example
 * ```tsx
 * <UnifiedRoomWebSocketProvider>
 *   <App />
 * </UnifiedRoomWebSocketProvider>
 * ```
 * 
 * @example
 * ```tsx
 * // Subscribe to specific room only
 * <UnifiedRoomWebSocketProvider roomId="room-123">
 *   <RoomDetailPage />
 * </UnifiedRoomWebSocketProvider>
 * ```
 */
export function UnifiedRoomWebSocketProvider({ 
  children, 
  autoConnect = true,
  roomId,
  debug = process.env.NODE_ENV === 'development'
}: UnifiedRoomWebSocketProviderProps) {
  // Store selectors
  const rooms = useUnifiedRoomStore(state => state.rooms);
  const wsConnected = useUnifiedRoomStore(state => state.wsConnected);
  const setWebSocketConnected = useUnifiedRoomStore(state => state.setWebSocketConnected);
  
  // Auth state
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // WebSocket integration
  const { isConnected, connect, disconnect } = useUnifiedRoomWebSocket({
    autoConnect,
    roomId,
    onConnectionChange: (connected) => {
      setWebSocketConnected(connected);
    },
    onError: (error) => {
      console.error('Unified Room WebSocket error:', error);
      
      // Update store with error state
      setWebSocketConnected(false);
    }
  });

  /**
   * Monitor authentication state and reconnect if needed
   */
  useEffect(() => {
    if (isAuthenticated && !isConnected && autoConnect && rooms.length > 0) {
      connect();
    } else if (!isAuthenticated && isConnected) {
      disconnect();
    }
  }, [isAuthenticated, isConnected, autoConnect, rooms.length, connect, disconnect, debug]);

  /**
   * Monitor room changes and reconnect if needed
   */
  useEffect(() => {
    if (isAuthenticated && autoConnect && rooms.length > 0 && !isConnected) {
      connect();
    }
  }, [rooms.length, isAuthenticated, autoConnect, isConnected, connect, debug]);

  /**
   * Sync WebSocket connection status with store
   */
  useEffect(() => {
    if (wsConnected !== isConnected) {
      setWebSocketConnected(isConnected);
    }
  }, [isConnected, wsConnected, setWebSocketConnected]);


  return <>{children}</>;
}

/**
 * Hook to access WebSocket connection status from components
 */
export function useUnifiedRoomWebSocketStatus() {
  const wsConnected = useUnifiedRoomStore(state => state.wsConnected);
  const lastUpdated = useUnifiedRoomStore(state => state.lastUpdated);
  
  return {
    isConnected: wsConnected,
    lastUpdated,
    connectionAge: lastUpdated ? Date.now() - lastUpdated : null
  };
}