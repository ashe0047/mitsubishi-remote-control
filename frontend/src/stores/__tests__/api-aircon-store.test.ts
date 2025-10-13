import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import createApiAirconStore from '../api-aircon-store';
import type { ApiAirconStore } from '../api-aircon-store';

// Mock the websocket client
jest.mock('@/lib/websocket/websocket-client', () => ({
  websocketClient: {
    isConnected: jest.fn(() => false),
    getMqttStatus: jest.fn(() => Promise.resolve(false)),
    subscribeToRoomState: jest.fn(),
    sendPowerCommand: jest.fn(() => Promise.resolve()),
    sendTemperatureCommand: jest.fn(() => Promise.resolve()),
    sendModeCommand: jest.fn(() => Promise.resolve()),
    sendFanCommand: jest.fn(() => Promise.resolve()),
    sendVaneCommand: jest.fn(() => Promise.resolve()),
    sendWideVaneCommand: jest.fn(() => Promise.resolve()),
    sendSettingsCommand: jest.fn(() => Promise.resolve()),
  },
}));

describe('ApiAirconStore', () => {
  let store: ApiAirconStore;

  beforeEach(() => {
    store = createApiAirconStore();
  });

  afterEach(() => {
    // Clean up any polling intervals
    const state = store.getState();
    if (state.statusPollingInterval) {
      state.stopStatusPolling();
    }
  });

  describe('Connection Status Management', () => {
    it('should initialize with default connection status', () => {
      const state = store.getState();
      expect(state.connectionStatus.websocket.state).toBe('disconnected');
      expect(state.connectionStatus.mqtt.state).toBe('unknown');
      expect(state.connectionStatus.overall).toBe('disconnected');
    });

    it('should update WebSocket connection status', () => {
      const { setIsConnected } = store.getState();
      
      setIsConnected(true);
      
      const state = store.getState();
      expect(state.isConnected).toBe(true);
      expect(state.connectionStatus.websocket.state).toBe('connected');
      expect(state.connectionStatus.websocket.lastConnected).toBeDefined();
      expect(state.connectionStatus.websocket.reconnectAttempts).toBe(0);
    });

    it('should update MQTT connection status', () => {
      const { setIsMqttConnected } = store.getState();
      
      setIsMqttConnected(true);
      
      const state = store.getState();
      expect(state.isMqttConnected).toBe(true);
      expect(state.connectionStatus.mqtt.state).toBe('connected');
      expect(state.connectionStatus.mqtt.lastUpdate).toBeDefined();
    });

    it('should calculate overall status correctly', () => {
      const { setIsConnected, setIsMqttConnected } = store.getState();
      
      // Both connected = healthy
      setIsConnected(true);
      setIsMqttConnected(true);
      expect(store.getState().connectionStatus.overall).toBe('healthy');
      
      // WebSocket connected, MQTT disconnected = degraded
      setIsMqttConnected(false);
      expect(store.getState().connectionStatus.overall).toBe('degraded');
      
      // WebSocket disconnected = disconnected
      setIsConnected(false);
      expect(store.getState().connectionStatus.overall).toBe('disconnected');
    });

    it('should update connection status manually', () => {
      const { updateConnectionStatus } = store.getState();
      
      updateConnectionStatus({
        websocket: {
          state: 'connecting',
          reconnectAttempts: 3,
        },
      });
      
      const state = store.getState();
      expect(state.connectionStatus.websocket.state).toBe('connecting');
      expect(state.connectionStatus.websocket.reconnectAttempts).toBe(3);
    });
  });

  describe('Navigation State Management', () => {
    it('should initialize with default navigation state', () => {
      const state = store.getState();
      expect(state.navigationState.currentRoute).toBe('/');
      expect(state.navigationState.previousRoute).toBe(null);
      expect(state.navigationState.canGoBack).toBe(false);
      expect(state.navigationState.isNavigating).toBe(false);
    });

    it('should update navigation state', () => {
      const { updateNavigationState } = store.getState();
      
      updateNavigationState({
        currentRoute: '/rooms/test-room',
        previousRoute: '/',
        canGoBack: true,
      });
      
      const state = store.getState();
      expect(state.navigationState.currentRoute).toBe('/rooms/test-room');
      expect(state.navigationState.previousRoute).toBe('/');
      expect(state.navigationState.canGoBack).toBe(true);
    });
  });

  describe('Status Polling', () => {
    it('should start and stop status polling', () => {
      const { startStatusPolling, stopStatusPolling } = store.getState();
      
      startStatusPolling();
      let state = store.getState();
      expect(state.statusPollingInterval).not.toBe(null);
      
      stopStatusPolling();
      state = store.getState();
      expect(state.statusPollingInterval).toBe(null);
    });

    it('should not create multiple polling intervals', () => {
      const { startStatusPolling } = store.getState();
      
      startStatusPolling();
      const firstInterval = store.getState().statusPollingInterval;
      
      startStatusPolling(); // Try to start again
      const secondInterval = store.getState().statusPollingInterval;
      
      expect(firstInterval).toBe(secondInterval);
      
      // Clean up
      store.getState().stopStatusPolling();
    });
  });
});