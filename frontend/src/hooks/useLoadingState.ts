import { useContext, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from 'zustand';
import { ApiAirconContext } from '@/components/AirconProvider';

/**
 * Result object returned by useLoadingState hook.
 * Provides all necessary flags for loading UI logic.
 */
export interface LoadingStateResult {
  // ===== CONNECTION STATUS =====

  /** WebSocket connection is active */
  isConnected: boolean;

  /** MQTT broker connection is active (via WebSocket) */
  isMqttConnected: boolean;

  // ===== DATA AVAILABILITY =====

  /** Room has received ANY data (state, settings, or devices) */
  hasRoomData: boolean;

  /** Room has received state data specifically */
  hasStateData: boolean;

  /** Room has received settings data specifically */
  hasSettingsData: boolean;

  // ===== DERIVED FLAGS =====

  /** Connected but no data received yet (show skeletons) */
  isInitialLoading: boolean;

  /** Can show controls (connected, data optional) */
  canShowControls: boolean;

  /** Can interact with controls (connected AND has data) */
  canInteract: boolean;

  // ===== METADATA =====

  /** Milliseconds since first data received, or null if no data */
  dataAge: number | null;
}

/**
 * Hook to manage loading state for air conditioner controls.
 *
 * Provides flags for:
 * - Connection status (WebSocket, MQTT)
 * - Data availability (has data been received?)
 * - Derived states (should show controls? should show skeletons?)
 *
 * CRITICAL: Uses Zustand v5 safe selectors with useShallow to prevent
 * infinite re-render loops.
 *
 * @param roomId - The room identifier to check loading state for
 * @returns LoadingStateResult with all loading flags
 *
 * @example
 * const { canShowControls, hasStateData } = useLoadingState(roomId);
 *
 * if (!canShowControls) {
 *   return <ConnectionError />;
 * }
 *
 * return (
 *   <div>
 *     {hasStateData ? (
 *       <div>{temperature}°C</div>
 *     ) : (
 *       <Skeleton className="h-8 w-24" />
 *     )}
 *   </div>
 * );
 */
export function useLoadingState(roomId: string): LoadingStateResult {
  const apiAirconStore = useContext(ApiAirconContext);

  if (!apiAirconStore) {
    throw new Error('useLoadingState must be used within ApiAirconProvider');
  }

  // CRITICAL: Use useShallow to select multiple values safely
  // This prevents infinite re-render loops in Zustand v5
  // NEVER use useStore(store) without selector!
  const [
    isConnected,
    isMqttConnected,
    hasReceivedRoomData,
    hasReceivedRoomState,
    hasReceivedRoomSettings,
    getRoomDataAge,
  ] = useStore(
    apiAirconStore,
    useShallow((state) => [
      state.isConnected,
      state.isMqttConnected,
      state.hasReceivedRoomData,
      state.hasReceivedRoomState,
      state.hasReceivedRoomSettings,
      state.getRoomDataAge,
    ])
  );

  // Calculate derived values
  // Use useMemo to prevent recalculation on every render
  const result = useMemo((): LoadingStateResult => {
    // Query data availability for this specific room
    const hasRoomData = hasReceivedRoomData(roomId);
    const hasStateData = hasReceivedRoomState(roomId);
    const hasSettingsData = hasReceivedRoomSettings(roomId);
    const dataAge = getRoomDataAge(roomId);

    // Calculate derived flags
    const isInitialLoading = isConnected && !hasRoomData;
    const canShowControls = isConnected; // Show controls when connected
    const canInteract = isConnected && hasRoomData; // Need data to interact

    return {
      // Connection status
      isConnected,
      isMqttConnected,

      // Data availability
      hasRoomData,
      hasStateData,
      hasSettingsData,

      // Derived flags
      isInitialLoading,
      canShowControls,
      canInteract,

      // Metadata
      dataAge,
    };
  }, [
    roomId,
    isConnected,
    isMqttConnected,
    hasReceivedRoomData,
    hasReceivedRoomState,
    hasReceivedRoomSettings,
    getRoomDataAge,
  ]);

  return result;
}
