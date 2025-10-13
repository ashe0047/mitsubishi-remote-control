// Configuration exports
export {
  httpConfigManager,
  loadHttpConfig,
  HttpConfigManager,
  httpConfigSchema,
  type HttpConfig,
} from './http-config';

export {
  websocketConfigManager,
  loadWebSocketConfig,
  WebSocketConfigManager,
  websocketConfigSchema,
  type WebSocketConfig,
} from './websocket-config';

// Re-export existing config
export { default as appConfig, type AppConfig } from './config';

// Combined configuration manager for both HTTP and WebSocket
export class CombinedConfigManager {
  constructor(
    public readonly http = httpConfigManager,
    public readonly websocket = websocketConfigManager
  ) {}

  // Update both configurations based on environment
  updateEnvironment(environment: 'development' | 'production' | 'test'): void {
    this.http.updateConfig(loadHttpConfig(environment));
    this.websocket.updateConfig(loadWebSocketConfig(environment));
  }

  // Get all configurations
  getAllConfigs() {
    return {
      http: this.http.getConfig(),
      websocket: this.websocket.getConfig(),
      app: appConfig,
    };
  }

  // Validate all configurations
  validateAllConfigs(): { isValid: boolean; errors: string[] } {
    const httpErrors = this.http.getValidationErrors(this.http.getConfig());
    const websocketErrors = this.websocket.getValidationErrors(this.websocket.getConfig());
    
    const allErrors = [...httpErrors, ...websocketErrors];
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}

// Export singleton instance
export const configManager = new CombinedConfigManager();