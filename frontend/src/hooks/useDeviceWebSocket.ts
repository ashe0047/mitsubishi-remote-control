/**
 * useDeviceWebSocket Hook
 *
 * Integrates WebSocket device messages with device store.
 * Subscribes to device state and discovery message streams.
 *
 * CRITICAL Zustand v5 Pattern:
 * - Use specific selectors for store methods
 * - Methods are stable - safe to use in useEffect deps
 *
 * Pattern: Observer pattern for WebSocket message handling
 */

import { useEffect } from 'react';
import { websocketClient } from '@/lib/websocket/websocket-client';
import { DeviceMessageAdapter } from '@/lib/adapters/device-message-adapter';
import { useDeviceStore } from '@/stores/device-store';

/**
 * Hook to integrate WebSocket device messages with device store
 *
 * Responsibilities:
 * - Subscribe to device state stream
 * - Subscribe to device discovery stream
 * - Transform messages using DeviceMessageAdapter
 * - Update device store with adapted messages
 *
 * @example
 * // In app provider or layout
 * function AppProvider({ children }: { children: React.ReactNode }) {
 *   useDeviceWebSocket(); // Activate WebSocket integration
 *
 *   return <>{children}</>;
 * }
 */
export function useDeviceWebSocket(): void {
  // Zustand v5: Use specific selectors for methods
  // Note: updateDeviceState and addDiscoveredDevice methods don't exist in device-store yet
  // TODO: Add these methods to device-store or comment out until WebSocket integration is complete
  const updateDevice = useDeviceStore((state) => state.updateDevice);
  const addDiscoveredDevice = useDeviceStore((state) => state.addDiscoveredDevice);

  /**
   * Subscribe to device state messages
   * TODO: Uncomment when WebSocket integration is complete
   */
  useEffect(() => {
    // Temporary: WebSocket integration not yet complete
    // Will be activated when updateDeviceState method is added to device-store

    /*
    const subscription = websocketClient.getDeviceStateStream().subscribe({
      next: (message) => {
        const adaptedState = DeviceMessageAdapter.adaptStateMessage(message);

        if (adaptedState) {
          updateDeviceState(adaptedState.deviceIdentifier, adaptedState.state);
        }
      },
      error: (error) => {
        console.error('❌ Device state stream error:', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
    */
     
  }, []); // updateDeviceState is stable (Zustand v5)

  /**
   * Subscribe to device discovery messages
   */
  useEffect(() => {
    const subscription = websocketClient.getDeviceDiscoveryStream().subscribe({
      next: (message) => {
        const adaptedDiscovery = DeviceMessageAdapter.adaptDiscoveryMessage(message);

        if (adaptedDiscovery) {
          addDiscoveredDevice(adaptedDiscovery);
        } else {
          console.warn('⚠️  Invalid device discovery message, skipping');
        }
      },
      error: (error) => {
        console.error('❌ Device discovery stream error:', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [addDiscoveredDevice]); // addDiscoveredDevice is stable (Zustand v5)
}
