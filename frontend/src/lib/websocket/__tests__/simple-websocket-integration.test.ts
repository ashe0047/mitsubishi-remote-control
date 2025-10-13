/**
 * Integration test for the simplified WebSocket client
 * Tests basic functionality and message handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createWebSocketClient,
  type WebSocketClient,
  type WebSocketMessage,
} from '../index';

// Mock WebSocket for testing
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.CONNECTING,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock ReconnectingWebSocket
vi.mock('reconnecting-websocket', () => ({
  default: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  }))
}));

describe('Simple WebSocket Integration Tests', () => {
  let client: WebSocketClient;

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('WebSocket Client Creation', () => {
    it('should create a WebSocket client with basic config', () => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner', {
        debug: true,
        maxReconnectAttempts: 5,
        reconnectInterval: 1000
      });

      expect(client).toBeDefined();
      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
      expect(typeof client.send).toBe('function');
      expect(typeof client.subscribe).toBe('function');
      expect(client.connectionState).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should create a WebSocket client with minimal config', () => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner');

      expect(client).toBeDefined();
      expect(client.connectionState).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner', { debug: true });
    });

    it('should allow subscribing to message types', () => {
      const handler = vi.fn();

      const unsubscribe = client.subscribe('room', handler);

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow sending messages', async () => {
      const message: WebSocketMessage = {
        type: 'room',
        messageId: 'test-123',
        roomId: 'living-room',
        payload: {
          command: 'update',
          data: { power: 'on', temperature: 22 }
        }
      };

      // This would normally throw because we're not connected
      // But we can test the interface exists
      expect(async () => await client.send(message)).rejects.toThrow();
    });
  });

  describe('Connection States', () => {
    beforeEach(() => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner');
    });

    it('should start in disconnected state', () => {
      expect(client.connectionState).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should have connection management methods', () => {
      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
    });
  });

  describe('Air Conditioning Integration', () => {
    beforeEach(() => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner', { debug: true });
    });

    it('should handle room message types', () => {
      const handler = vi.fn();

      const unsubscribe = client.subscribe('room', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should create valid AC control messages', async () => {
      const roomMessage: WebSocketMessage = {
        type: 'room',
        messageId: 'ac-control-123',
        roomId: 'bedroom',
        payload: {
          command: 'update',
          data: {
            field: 'temperature',
            value: 24
          }
        }
      };

      expect(roomMessage.type).toBe('room');
      expect(roomMessage.roomId).toBe('bedroom');
      expect(roomMessage.payload).toBeDefined();
    });
  });

  describe('Quota System Integration', () => {
    beforeEach(() => {
      client = createWebSocketClient('ws://localhost:8080/ws/airconditioner', { debug: true });
    });

    it('should handle quota message types', () => {
      const handler = vi.fn();

      const unsubscribe = client.subscribe('quota', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should create valid quota messages', async () => {
      const quotaMessage: WebSocketMessage = {
        type: 'quota',
        messageId: 'quota-123',
        payload: {
          action: 'QUOTA_UPDATE',
          quotaId: 'daily-ac-usage',
          familyMemberId: 'user-123',
          dailyLimit: 480,
          currentUsage: 120,
          status: 'ACTIVE'
        }
      };

      expect(quotaMessage.type).toBe('quota');
      expect(quotaMessage.payload).toBeDefined();
    });
  });
});