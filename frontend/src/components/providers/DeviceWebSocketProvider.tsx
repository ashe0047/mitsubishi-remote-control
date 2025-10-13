/**
 * Device WebSocket Provider
 *
 * Activates WebSocket integration for device messages.
 * Subscribes to device state and discovery streams and updates device store.
 *
 * This provider should be added to the app's provider tree to enable
 * automatic device message handling throughout the application.
 */

'use client';

import { useDeviceWebSocket } from '@/hooks/useDeviceWebSocket';

interface DeviceWebSocketProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that activates device WebSocket integration
 *
 * @example
 * <DeviceWebSocketProvider>
 *   <App />
 * </DeviceWebSocketProvider>
 */
export function DeviceWebSocketProvider({ children }: DeviceWebSocketProviderProps) {
  // Activate WebSocket integration
  useDeviceWebSocket();

  return <>{children}</>;
}
