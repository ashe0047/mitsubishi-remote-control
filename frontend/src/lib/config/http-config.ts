import { z } from 'zod';

// HTTP Configuration Schema
const httpConfigSchema = z.object({
  baseURL: z.string().url(),
  timeout: z.number().min(1000).max(60000).default(10000),
  retries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),
  enableLogging: z.boolean().default(false),
  enablePerformanceMonitoring: z.boolean().default(false),
  enableRequestDeduplication: z.boolean().default(true),
  maxConcurrentRequests: z.number().min(1).max(100).default(10),
  auth: z.object({
    tokenRefreshThreshold: z.number().min(60).max(3600).default(300), // 5 minutes
    maxRetries: z.number().min(1).max(5).default(3),
    autoRefresh: z.boolean().default(true),
    tokenHeader: z.string().default('Authorization'),
    tokenPrefix: z.string().default('Bearer'),
  }),
  performance: z.object({
    enableCaching: z.boolean().default(true),
    enableDeduplication: z.boolean().default(true),
    maxConcurrentRequests: z.number().min(1).max(100).default(10),
    requestTimeout: z.number().min(1000).max(60000).default(10000),
  }),
  headers: z.record(z.string()).default({}),
});

export type HttpConfig = z.infer<typeof httpConfigSchema>;

// Environment-specific configurations
const environmentConfigs = {
  development: {
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081',
    timeout: 15000,
    retries: 2,
    retryDelay: 1000,
    enableLogging: true,
    enablePerformanceMonitoring: true,
    enableRequestDeduplication: true,
    maxConcurrentRequests: 5,
    auth: {
      tokenRefreshThreshold: 300,
      maxRetries: 3,
      autoRefresh: true,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
    },
    performance: {
      enableCaching: true,
      enableDeduplication: true,
      maxConcurrentRequests: 5,
      requestTimeout: 15000,
    },
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': 'development',
    },
  },
  production: {
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.turing.ashelabs.com',
    timeout: 10000,
    retries: 3,
    retryDelay: 2000,
    enableLogging: false,
    enablePerformanceMonitoring: true,
    enableRequestDeduplication: true,
    maxConcurrentRequests: 20,
    auth: {
      tokenRefreshThreshold: 300,
      maxRetries: 3,
      autoRefresh: true,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
    },
    performance: {
      enableCaching: true,
      enableDeduplication: true,
      maxConcurrentRequests: 20,
      requestTimeout: 10000,
    },
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': 'production',
    },
  },
  test: {
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081',
    timeout: 5000,
    retries: 1,
    retryDelay: 500,
    enableLogging: false,
    enablePerformanceMonitoring: false,
    enableRequestDeduplication: false,
    maxConcurrentRequests: 3,
    auth: {
      tokenRefreshThreshold: 60,
      maxRetries: 1,
      autoRefresh: false,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
    },
    performance: {
      enableCaching: false,
      enableDeduplication: false,
      maxConcurrentRequests: 3,
      requestTimeout: 5000,
    },
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': 'test',
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
function loadHttpConfig(environment?: keyof typeof environmentConfigs): HttpConfig {
  const env = environment || getCurrentEnvironment();
  const config = environmentConfigs[env];
  
  try {
    return httpConfigSchema.parse(config);
  } catch (error) {
    console.error(`Invalid HTTP configuration for environment ${env}:`, error);
    throw new Error(`Failed to load HTTP configuration: ${error}`);
  }
}

// Runtime configuration updates
class HttpConfigManager {
  private config: HttpConfig;
  private listeners: Array<(config: HttpConfig) => void> = [];

  constructor(environment?: keyof typeof environmentConfigs) {
    this.config = loadHttpConfig(environment);
  }

  getConfig(): HttpConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<HttpConfig>): void {
    const newConfig = { ...this.config, ...updates };
    
    try {
      this.config = httpConfigSchema.parse(newConfig);
      this.notifyListeners();
    } catch (error) {
      console.error('Invalid configuration update:', error);
      throw new Error(`Failed to update HTTP configuration: ${error}`);
    }
  }

  updateAuthConfig(authUpdates: Partial<HttpConfig['auth']>): void {
    this.updateConfig({
      auth: { ...this.config.auth, ...authUpdates }
    });
  }

  updatePerformanceConfig(perfUpdates: Partial<HttpConfig['performance']>): void {
    this.updateConfig({
      performance: { ...this.config.performance, ...perfUpdates }
    });
  }

  onConfigChange(listener: (config: HttpConfig) => void): () => void {
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
  validateConfig(config: unknown): config is HttpConfig {
    return httpConfigSchema.safeParse(config).success;
  }

  getValidationErrors(config: unknown): string[] {
    const result = httpConfigSchema.safeParse(config);
    if (result.success) return [];
    
    return result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
  }
}

// Export singleton instance
export const httpConfigManager = new HttpConfigManager();

// Export configuration and utilities
export { loadHttpConfig, HttpConfigManager, httpConfigSchema };
export default httpConfigManager.getConfig();