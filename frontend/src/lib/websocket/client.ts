/**
 * Simple WebSocket Client
 * Clean, focused WebSocket client for frontend applications
 */

import ReconnectingWebSocket, { ErrorEvent } from 'reconnecting-websocket';
import {
  ConnectionState,
  ConnectionConfig,
  WebSocketClient,
  WebSocketMessage,
  MessageHandler,
  MessageType
} from './types';


export class SimpleWebSocketClient implements WebSocketClient {
  private ws: ReconnectingWebSocket | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private handlers = new Map<MessageType, Set<MessageHandler<WebSocketMessage>>>();
  private config: Required<ConnectionConfig>;

  constructor(config: ConnectionConfig) {
    this.config = {
      maxReconnectAttempts: 10,
      reconnectInterval: 1000,
      timeout: 30000,
      debug: false,
      ...config
    };
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  async connect(): Promise<void> {
    if (this.ws && this.isConnected) {
      return;
    }

    this._connectionState = 'connecting';

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new ReconnectingWebSocket(this.config.url, [], {
          maxReconnectionDelay: this.config.reconnectInterval * 2,
          minReconnectionDelay: this.config.reconnectInterval,
          reconnectionDelayGrowFactor: 1.3,
          maxRetries: this.config.maxReconnectAttempts,
          connectionTimeout: this.config.timeout,
          debug: this.config.debug,
        });

        // Set up event listeners
        const onOpen = () => {
          this._connectionState = 'connected';
          this.log('Connected to WebSocket');
          cleanup();
          resolve();
        };

        const onClose = (event: any) => {
          this.log('WebSocket close event:', { code: event.code, reason: event.reason, wasClean: event.wasClean });

          // Check if close was due to authentication failure (code 1008 = policy violation, or 1011 = server error)
          // Backend closes connection immediately on auth failure
          if (event.code === 1008 || event.code === 1011 || (event.code === 1006 && this._connectionState === 'connecting')) {
            const isAuthError = event.reason?.toLowerCase().includes('auth') ||
                                event.reason?.toLowerCase().includes('jwt') ||
                                event.reason?.toLowerCase().includes('token');

            if (isAuthError || event.code === 1008) {
              this.log('WebSocket authentication failure detected - redirecting to login');
              // Dynamic import to avoid circular dependencies
              import('@/lib/auth/auth-client').then(({ redirectToLogin, clearAuthToken }) => {
                clearAuthToken();
                if (typeof window !== 'undefined') {
                  redirectToLogin(window.location.pathname);
                }
              }).catch(err => {
                this.log('Failed to redirect to login:', err);
              });
            }
          }

          if (this._connectionState === 'connecting') {
            this._connectionState = 'failed';
            cleanup();
            reject(new Error(`Connection failed - ${event.reason || 'server unavailable'}`));
          } else {
            this._connectionState = 'disconnected';
            this.log('Disconnected from WebSocket');
          }
        };

        const onError = (event: ErrorEvent) => {
          this.log('WebSocket error:', event);
          if (this._connectionState === 'connecting') {
            this._connectionState = 'failed';
            cleanup();
            reject(new Error('Connection failed - network error'));
          }
        };

        const onMessage = (event: MessageEvent) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.log('Error parsing message:', error);
          }
        };

        const cleanup = () => {
          if (this.ws) {
            this.ws.removeEventListener('open', onOpen);
            this.ws.removeEventListener('close', onClose);
            this.ws.removeEventListener('error', onError);
          }
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }
        };

        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          this._connectionState = 'failed';
          cleanup();
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        // Add event listeners
        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('close', onClose);
        this.ws.addEventListener('error', onError);
        this.ws.addEventListener('message', onMessage);

      } catch (error) {
        this._connectionState = 'failed';
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connectionState = 'disconnected';
    this.handlers.clear();
  }

  async send(message: WebSocketMessage): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const messageWithId = {
      ...message,
      messageId: message.messageId || this.generateMessageId(),
      timestamp: message.timestamp || Date.now()
    };

    this.ws.send(JSON.stringify(messageWithId));
    this.log('Sent message:', messageWithId);
  }

  subscribe<T extends WebSocketMessage = WebSocketMessage>(
    type: MessageType,
    handler: MessageHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    // Create a wrapper that maintains type safety
    const wrappedHandler: MessageHandler<WebSocketMessage> = (message: WebSocketMessage) => {
      handler(message as T);
    };

    this.handlers.get(type)!.add(wrappedHandler);

    // Return unsubscribe function
    return () => {
      const typeHandlers = this.handlers.get(type);
      if (typeHandlers) {
        typeHandlers.delete(wrappedHandler);
        if (typeHandlers.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    this.log('Received message:', message);

    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.log('Error in message handler:', error);
        }
      });
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// Simple factory function
export function createWebSocketClient(url: string, options: Partial<ConnectionConfig> = {}): WebSocketClient {
  return new SimpleWebSocketClient({ url, ...options });
}