/**
 * useUnifiedRoomWebSocket Hook
 *
 * Integrates WebSocket real-time updates with the unified room store.
 * Handles device status updates and room aggregate status changes.
 *
 * Features:
 * - Real-time device status updates
 * - Room aggregate status recalculation
 * - Connection status management
 * - Automatic reconnection handling
 * - Message filtering and validation
 */

import { useEffect, useRef, useCallback } from 'react';
import { websocketClient } from '@/lib/websocket/websocket-client';
import { useUnifiedRoomStore } from '@/stores/unified-room-store';
import { useAuthStore } from '@/stores/auth-store';
import type { DeviceCurrentStatus } from '@/types/room';

interface DeviceStatusUpdate {
  roomId: string;
  deviceId: string;
  deviceIdentifier: string;
  status: DeviceCurrentStatus;
  timestamp: number;
}

interface RoomStatusUpdate {
  roomId: string;
  aggregateStatus: {
    hasActiveDevices: boolean;
    averageTemperature?: number;
    totalDevices: number;
    onlineDevices: number;
    enabledDevices: number;
  };
  timestamp: number;
}

/**
 * Hook to integrate WebSocket real-time updates with unified room store
 *
 * @param options Configuration options
 * @param options.autoConnect Whether to automatically connect on mount
 * @param options.roomId Specific room ID to subscribe to (optional, subscribes to all rooms if not provided)
 * @param options.onConnectionChange Callback for connection status changes
 * @param options.onError Callback for WebSocket errors
 */
export function useUnifiedRoomWebSocket(options: {
  autoConnect?: boolean;
  roomId?: string;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
} = {}) {
  const {
    autoConnect = true,
    roomId,
    onConnectionChange,
    onError
  } = options;

  // Store selectors
  const updateDeviceStatus = useUnifiedRoomStore(state => state.updateDeviceStatus);
  const updateRoomAggregateStatus = useUnifiedRoomStore(state => state.updateRoomAggregateStatus);
  const setWebSocketConnected = useUnifiedRoomStore(state => state.setWebSocketConnected);
  const rooms = useUnifiedRoomStore(state => state.rooms);
  
  // Auth store
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  // Connection state
  const connectionRef = useRef<{
    isConnected: boolean;
    subscription?: any;
    reconnectTimer?: NodeJS.Timeout;
  }>({ isConnected: false });

  /**
   * Process device status update message
   */
  const processDeviceStatusUpdate = useCallback((message: any) => {
    try {
      // Extract device status update from WebSocket message
      const update = extractDeviceStatusUpdate(message);
      if (!update) {
        console.warn('Invalid device status update message:', message);
        return;
      }


      // Update device status in store
      updateDeviceStatus(update.roomId, update.deviceId, update.status);

    } catch (error) {
      console.error('Error processing device status update:', error);
      onError?.(error as Error);
    }
  }, [updateDeviceStatus, onError]);

  /**
   * Process room status update message
   */
  const processRoomStatusUpdate = useCallback((message: any) => {
    try {
      // Extract room status update from WebSocket message
      const update = extractRoomStatusUpdate(message);
      if (!update) {
        console.warn('Invalid room status update message:', message);
        return;
      }


      // Update room aggregate status in store
      updateRoomAggregateStatus(update.roomId, update.aggregateStatus);

    } catch (error) {
      console.error('Error processing room status update:', error);
      onError?.(error as Error);
    }
  }, [updateRoomAggregateStatus, onError]);

  /**
   * Handle WebSocket message
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    // Route message based on type
    switch (message.type) {
      case 'device-status':
      case 'device':
        processDeviceStatusUpdate(message);
        break;
      
      case 'room-status':
      case 'room':
        processRoomStatusUpdate(message);
        break;
      
      case 'room-state':
        // Legacy format - convert to device status update
        if (message.roomId && message.data) {
          const deviceUpdate = convertLegacyRoomStateToDeviceUpdate(message);
          if (deviceUpdate) {
            processDeviceStatusUpdate(deviceUpdate);
          }
        }
        break;
      
      default:
        console.debug('Unhandled WebSocket message type:', message.type);
    }
  }, [processDeviceStatusUpdate, processRoomStatusUpdate]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping WebSocket connection');
      return;
    }

    if (connectionRef.current.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log('🔌 Connecting to WebSocket for unified room updates...');

      // Use first room ID if no specific room is provided
      const targetRoomId = roomId || rooms[0]?.id;
      if (!targetRoomId) {
        console.log('No room ID available for WebSocket connection');
        return;
      }

      // Connect to WebSocket
      const messageStream = websocketClient.connect(targetRoomId, (connected) => {
        connectionRef.current.isConnected = connected;
        setWebSocketConnected(connected);
        onConnectionChange?.(connected);
        
        if (connected) {
          console.log('✅ WebSocket connected for unified room updates');
        } else {
          console.log('❌ WebSocket disconnected');
          
          // Schedule reconnection if auto-connect is enabled
          if (autoConnect && !connectionRef.current.reconnectTimer) {
            connectionRef.current.reconnectTimer = setTimeout(() => {
              connectionRef.current.reconnectTimer = undefined;
              connect();
            }, 5000);
          }
        }
      });

      // Subscribe to messages
      connectionRef.current.subscription = messageStream.subscribe({
        next: handleWebSocketMessage,
        error: (error) => {
          console.error('WebSocket stream error:', error);
          connectionRef.current.isConnected = false;
          setWebSocketConnected(false);
          onError?.(error);
        }
      });

      // Also subscribe to device state stream for more specific updates
      const deviceStateStream = websocketClient.getDeviceStateStream();
      const deviceSubscription = deviceStateStream.subscribe({
        next: (deviceMessage) => {
          console.log('📱 Received device state message:', deviceMessage);
          processDeviceStatusUpdate(deviceMessage);
        },
        error: (error) => {
          console.error('Device state stream error:', error);
          onError?.(error);
        }
      });

      // Store both subscriptions
      connectionRef.current.subscription = {
        unsubscribe: () => {
          connectionRef.current.subscription?.unsubscribe();
          deviceSubscription.unsubscribe();
        }
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      connectionRef.current.isConnected = false;
      setWebSocketConnected(false);
      onError?.(error as Error);
    }
  }, [
    isAuthenticated, 
    roomId, 
    rooms, 
    autoConnect, 
    handleWebSocketMessage, 
    processDeviceStatusUpdate,
    setWebSocketConnected, 
    onConnectionChange, 
    onError
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(async () => {
    console.log('🔌 Disconnecting WebSocket...');

    // Clear reconnect timer
    if (connectionRef.current.reconnectTimer) {
      clearTimeout(connectionRef.current.reconnectTimer);
      connectionRef.current.reconnectTimer = undefined;
    }

    // Unsubscribe from messages
    if (connectionRef.current.subscription) {
      connectionRef.current.subscription.unsubscribe();
      connectionRef.current.subscription = undefined;
    }

    // Disconnect WebSocket client
    await websocketClient.disconnect();

    connectionRef.current.isConnected = false;
    setWebSocketConnected(false);
    onConnectionChange?.(false);
  }, [setWebSocketConnected, onConnectionChange]);

  /**
   * Auto-connect on mount and when authentication changes
   */
  useEffect(() => {
    if (autoConnect && isAuthenticated && rooms.length > 0) {
      connect();
    }

    return () => {
      // Cleanup on unmount
      if (connectionRef.current.reconnectTimer) {
        clearTimeout(connectionRef.current.reconnectTimer);
      }
    };
  }, [autoConnect, isAuthenticated, rooms.length, connect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected: connectionRef.current.isConnected,
    connect,
    disconnect
  };
}

/**
 * Extract device status update from WebSocket message
 */
function extractDeviceStatusUpdate(message: any): DeviceStatusUpdate | null {
  try {
    // Handle different message formats
    if (message.type === 'device' && message.payload) {
      const payload = message.payload;
      
      if (payload.messageType === 'STATE' || payload.messageType === 'SETTINGS') {
        return {
          roomId: message.roomId || '',
          deviceId: payload.deviceId || payload.deviceIdentifier,
          deviceIdentifier: payload.deviceIdentifier,
          status: payload.data,
          timestamp: Date.now()
        };
      }
    }

    // Handle legacy format
    if (message.type === 'device-status') {
      return {
        roomId: message.roomId,
        deviceId: message.deviceId,
        deviceIdentifier: message.deviceIdentifier,
        status: message.status,
        timestamp: message.timestamp || Date.now()
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting device status update:', error);
    return null;
  }
}

/**
 * Extract room status update from WebSocket message
 */
function extractRoomStatusUpdate(message: any): RoomStatusUpdate | null {
  try {
    if (message.type === 'room-status') {
      return {
        roomId: message.roomId,
        aggregateStatus: message.aggregateStatus,
        timestamp: message.timestamp || Date.now()
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting room status update:', error);
    return null;
  }
}

/**
 * Convert legacy room state message to device status update
 */
function convertLegacyRoomStateToDeviceUpdate(message: any): DeviceStatusUpdate | null {
  try {
    if (message.type === 'room-state' && message.roomId && message.data) {
      // Extract device status from room state data
      const status: DeviceCurrentStatus = {
        power: message.data.power || 'off',
        temperature: message.data.temperature || 20,
        mode: message.data.mode || 'off',
        fan: message.data.fan || 'auto',
        vane: message.data.vane,
        wideVane: message.data.wideVane,
        roomTemperature: message.data.roomTemperature
      };

      return {
        roomId: message.roomId,
        deviceId: message.data.deviceId || 'unknown',
        deviceIdentifier: message.data.deviceIdentifier || 'unknown',
        status,
        timestamp: Date.now()
      };
    }

    return null;
  } catch (error) {
    console.error('Error converting legacy room state:', error);
    return null;
  }
}