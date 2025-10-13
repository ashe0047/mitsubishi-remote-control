/**
 * Simple WebSocket Library
 * Clean, focused WebSocket client for frontend applications
 */

// Export everything from types
export * from './types';

// Export client and factory
export { SimpleWebSocketClient, createWebSocketClient } from './client';

// Convenience re-exports for common patterns
export type {
  WebSocketClient as IWebSocketClient, // Alias for backward compatibility
  ConnectionState,
  WebSocketMessage,
  MessageHandler,
  MessageType,
  RoomInfo,
  AirConState,
  WSMessage, // Legacy compatibility
  WebSocketResponse // Legacy compatibility
} from './types';