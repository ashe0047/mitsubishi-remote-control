import { z } from 'zod';

// WebSocket Configuration Schema
const websocketConfigSchema = z.object({
  url: z.string().url(),
  autoConnect: z.boolean().default(true),
  reconnection: z.boolean().default(true),
  reconnectionAttempts: z.number().min(0).max(50).default(10),
  reconnectionDelay: z.number().min(100).max(30000).default(1000),
  maxReconnectionDelay: z.number().min(1000).max(300000).default(30000),
  reconnectionDelayGrowFactor: z.number().min(1).max(5).default(1.5),
  connectionTimeout: z.number().min(1000).max(60000).default(20000),
  debug: z.boolean().default(false),
  enablePerformanceMonitoring: z.boolean().default(false),
  auth: z.object({
    enabled: z.boolean().default(true),
    tokenHeader: z.string().default('Authorization'),
    tokenPrefix: z.string().default('Bearer'),
    autoRefresh: z.boolean().default(true),
    refreshThreshold: z.number().min(60).max(3600).default(300), // 5 minutes
    maxAuthRetries: z.number().min(1).max(5).default(3),
  }),
  messageQueue: z.object({
    enabled: z.boolean().default(true),
    maxSize: z.number().min(10).max(10000).default(100),
    persistOnDisconnect: z.boolean().default(true),
    flushOnReconnect: z.boolean().default(true),
    messageTimeout: z.number().min(1000).max(60000).default(30000),
  }),
  heartbeat: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(5000).max(300000).default(30000), // 30 seconds
    timeout: z.number().min(1000).max(60000).default(10000),
    maxMissed: z.number().min(1).max(10).default(3),
  }),
  compression: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().min(100).max(10000).default(1024),
  }),
  protocols: z.array(z.string()).default([]),
  headers: z.record(z.string()).default({}),
});

export type WebSocketConfig = z.infer<typeof websocketConfigSchema>;

// Environment-specific configurations
const environmentConfigs = {
  development: {
    url: process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || 'ws://localhost:8081/ws/airconditioner',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    maxReconnectionDelay: 10000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 10000,
    debug: true,
    enablePerformanceMonitoring: true,
    auth: {
      enabled: true,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
      autoRefresh: true,
      refreshThreshold: 300,
      maxAuthRetries: 3,
    },
    messageQueue: {
      enabled: true,
      maxSize: 50,
      persistOnDisconnect: true,
      flushOnReconnect: true,
      messageTimeout: 15000,
    },
    heartbeat: {
      enabled: true,
      interval: 15000, // More frequent in dev for testing
      timeout: 5000,
      maxMissed: 2,
    },
    compression: {
      enabled: false, // Disabled in dev for easier debugging
      threshold: 1024,
    },
    protocols: [],
    headers: {
      'X-Environment': 'development',
      'X-Client-Type': 'web',
    },
  },
  production: {
    url: process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || 'wss://api.turing.ashelabs.com/ws/airconditioner',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    connectionTimeout: 20000,
    debug: false,
    enablePerformanceMonitoring: true,
    auth: {
      enabled: true,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
      autoRefresh: true,
      refreshThreshold: 300,
      maxAuthRetries: 3,
    },
    messageQueue: {
      enabled: true,
      maxSize: 100,
      persistOnDisconnect: true,
      flushOnReconnect: true,
      messageTimeout: 30000,
    },
    heartbeat: {
      enabled: true,
      interval: 30000,
      timeout: 10000,
      maxMissed: 3,
    },
    compression: {
      enabled: true,
      threshold: 1024,
    },
    protocols: [],
    headers: {
      'X-Environment': 'production',
      'X-Client-Type': 'web',
    },
  },
  test: {
    url: process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || 'ws://localhost:8081/ws/airconditioner',
    autoConnect: false, // Manual control in tests
    reconnection: false, // Disabled for predictable test behavior
    reconnectionAttempts: 0,
    reconnectionDelay: 1000,
    maxReconnectionDelay: 5000,
    reconnectionDelayGrowFactor: 1.0,
    connectionTimeout: 5000,
    debug: false,
    enablePerformanceMonitoring: false,
    auth: {
      enabled: false, // Simplified for testing
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
      autoRefresh: false,
      refreshThreshold: 60,
      maxAuthRetries: 1,
    },
    messageQueue: {
      enabled: false, // Simplified for testing
      maxSize: 10,
      persistOnDisconnect: false,
      flushOnReconnect: false,
      messageTimeout: 5000,
    },
    heartbeat: {
      enabled: false, // Disabled for test stability
      interval: 60000,
      timeout: 5000,
      maxMissed: 1,
    },
    compression: {
      enabled: false,
      threshold: 1024,
    },
    protocols: [],
    headers: {
      'X-Environment': 'test',
      'X-Client-Type': 'web',
    },
  },
} as const;

// Get current environment
function getCurrentEnvironment(): keyof typeof environmentConfigs {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

// Load and validate configuration
function loadWebSocketConfig(environment?: keyof typeof environmentConfigs): WebSocketConfig {
  const env = environment || getCurrentEnvironment();
  const config = environmentConfigs[env];
  
  try {
    return websocketConfigSchema.parse(config);
  } catch (error) {
    console.error(`Invalid WebSocket configuration for environment ${env}:`, error);
    throw new Error(`Failed to load WebSocket configuration: ${error}`);
  }
}

// Runtime configuration updates
class WebSocketConfigManager {
  private config: WebSocketConfig;
  private listeners: Array<(config: WebSocketConfig) => void> = [];

  constructor(environment?: keyof typeof environmentConfigs) {
    this.config = loadWebSocketConfig(environment);
  }

  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<WebSocketConfig>): void {
    const newConfig = { ...this.config, ...updates };
    
    try {
      this.config = websocketConfigSchema.parse(newConfig);
      this.notifyListeners();
    } catch (error) {
      console.error('Invalid configuration update:', error);
      throw new Error(`Failed to update WebSocket configuration: ${error}`);
    }
  }

  updateAuthConfig(authUpdates: Partial<WebSocketConfig['auth']>): void {
    this.updateConfig({
      auth: { ...this.config.auth, ...authUpdates }
    });
  }

  updateMessageQueueConfig(queueUpdates: Partial<WebSocketConfig['messageQueue']>): void {
    this.updateConfig({
      messageQueue: { ...this.config.messageQueue, ...queueUpdates }
    });
  }

  updateHeartbeatConfig(heartbeatUpdates: Partial<WebSocketConfig['heartbeat']>): void {
    this.updateConfig({
      heartbeat: { ...this.config.heartbeat, ...heartbeatUpdates }
    });
  }

  updateReconnectionConfig(reconnectionUpdates: Partial<Pick<WebSocketConfig, 
    'reconnectionAttempts' | 'reconnectionDelay' | 'maxReconnectionDelay' | 'reconnectionDelayGrowFactor'>>): void {
    this.updateConfig(reconnectionUpdates);
  }

  onConfigChange(listener: (config: WebSocketConfig) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    });
  }

  // Validation helpers
  validateConfig(config: unknown): config is WebSocketConfig {
    return websocketConfigSchema.safeParse(config).success;
  }

  getValidationErrors(config: unknown): string[] {
    const result = websocketConfigSchema.safeParse(config);
    if (result.success) return [];
    
    return result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
  }

  // Utility methods for common operations
  isReconnectionEnabled(): boolean {
    return this.config.reconnection && this.config.reconnectionAttempts > 0;
  }

  getReconnectionDelay(attempt: number): number {
    const delay = this.config.reconnectionDelay * Math.pow(this.config.reconnectionDelayGrowFactor, attempt - 1);
    return Math.min(delay, this.config.maxReconnectionDelay);
  }

  shouldEnableAuth(): boolean {
    return this.config.auth.enabled;
  }

  shouldEnableMessageQueue(): boolean {
    return this.config.messageQueue.enabled;
  }

  shouldEnableHeartbeat(): boolean {
    return this.config.heartbeat.enabled;
  }

  getConnectionOptions(): {
    protocols?: string[];
    headers?: Record<string, string>;
  } {
    return {
      protocols: this.config.protocols.length > 0 ? this.config.protocols : undefined,
      headers: Object.keys(this.config.headers).length > 0 ? this.config.headers : undefined,
    };
  }
}

// Export singleton instance
export const websocketConfigManager = new WebSocketConfigManager();

// Export configuration and utilities
export { loadWebSocketConfig, WebSocketConfigManager, websocketConfigSchema };
export default websocketConfigManager.getConfig();