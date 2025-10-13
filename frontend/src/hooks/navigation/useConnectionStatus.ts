"use client";

import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { UseConnectionStatusReturn } from '@/types/navigation';
import { ApiAirconContext } from '@/components/AirconProvider';
import { websocketClient } from '@/lib/websocket/websocket-client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ErrorCode } from '@/lib/error-handling/error-utils';

export const useConnectionStatus = (): UseConnectionStatusReturn => {
  const [lastError, setLastError] = useState<string | null>(null);
  const apiAirconStore = useContext(ApiAirconContext);
  
  // Error handling
  const { handleException, clearError } = useErrorHandler({
    autoClearAfter: 10000, // Clear errors after 10 seconds
    onError: (error) => {
      setLastError(error.message);
    }
  });
  
  if (!apiAirconStore) {
    throw new Error("useConnectionStatus must be used within ApiAirconProvider");
  }
  
  // Use proper selectors to avoid infinite loops in Zustand v5
  const status = useStore(apiAirconStore, (state) => state.connectionStatus);
  const startStatusPolling = useStore(apiAirconStore, (state) => state.startStatusPolling);
  const stopStatusPolling = useStore(apiAirconStore, (state) => state.stopStatusPolling);
  const updateConnectionStatus = useStore(apiAirconStore, (state) => state.updateConnectionStatus);
  
  // Track previous status using ref to avoid stale closure issues
  const previousStatusRef = useRef(status);
  
  // Memoize derived values to prevent unnecessary re-renders
  const isOnline = useMemo(() => 
    status.overall === 'healthy' || status.overall === 'degraded',
    [status.overall]
  );

  // Initialize status polling when hook mounts
  useEffect(() => {
    startStatusPolling();
    
    return () => {
      stopStatusPolling();
    };
    // Using eslint-disable for store methods that should be stable in Zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const retryConnection = useCallback(async () => {
    try {
      setLastError(null);
      clearError();
      
      // Update connection status to show retry attempt
      updateConnectionStatus({
        websocket: {
          state: 'connecting',
          lastConnected: status.websocket.lastConnected,
          reconnectAttempts: status.websocket.reconnectAttempts + 1,
        },
      });

      // If WebSocket is disconnected, try to force reconnection
      if (!websocketClient.isConnected()) {
        console.log('Attempting WebSocket reconnection...');
        await websocketClient.forceReconnect();
      }

      // Try to get MQTT status to verify connectivity
      await websocketClient.getMqttStatus();
      
      console.log('Connection retry completed successfully');
      
    } catch (error) {
      console.error('Connection retry failed:', error);
      
      // Handle the error using our error handling system
      handleException(error, ErrorCode.WEBSOCKET_RECONNECTION_FAILED, 'useConnectionStatus.retryConnection');
      
      // Update status to reflect retry failure
      updateConnectionStatus({
        websocket: {
          state: 'error',
          lastConnected: status.websocket.lastConnected,
          reconnectAttempts: status.websocket.reconnectAttempts,
        },
      });
    }
  }, [status.websocket.reconnectAttempts, status.websocket.lastConnected, clearError, handleException, updateConnectionStatus]);

  // Monitor connection status changes and detect errors
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    
    // Check for error conditions
    if (status.websocket.state === 'error') {
      setLastError('WebSocket connection error');
    } else if (status.mqtt.state === 'disconnected' && status.websocket.state === 'connected') {
      setLastError('MQTT connection lost');
    } else if (status.overall === 'disconnected' && previousStatus.overall !== 'disconnected') {
      setLastError('Connection lost');
    } else if (status.overall === 'healthy' && lastError) {
      // Clear error when connection is restored
      setLastError(null);
    }
    
    // Update the previous status ref for next render
    previousStatusRef.current = status;
  }, [status, lastError]);

  // Handle offline/online events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser came online, attempting to reconnect...');
      retryConnection();
    };

    const handleOffline = () => {
      console.log('Browser went offline');
      setLastError('Browser is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [retryConnection]);

  return {
    status,
    isOnline,
    retryConnection,
    lastError,
  };
};

export default useConnectionStatus;