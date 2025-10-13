// Simple verification script to ensure configurations load correctly
import { httpConfigManager, websocketConfigManager, configManager } from './index';

export function verifyConfigurations() {
  try {
    // Test HTTP configuration
    const httpConfig = httpConfigManager.getConfig();
    console.log('HTTP Config loaded:', {
      baseURL: httpConfig.baseURL,
      timeout: httpConfig.timeout,
      retries: httpConfig.retries,
    });

    // Test WebSocket configuration
    const wsConfig = websocketConfigManager.getConfig();
    console.log('WebSocket Config loaded:', {
      url: wsConfig.url,
      autoConnect: wsConfig.autoConnect,
      reconnectionAttempts: wsConfig.reconnectionAttempts,
    });

    // Test combined configuration
    const allConfigs = configManager.getAllConfigs();
    console.log('All configs loaded successfully');

    // Test validation
    const validation = configManager.validateAllConfigs();
    console.log('Configuration validation:', validation);

    return {
      success: true,
      httpConfig,
      wsConfig,
      validation,
    };
  } catch (error) {
    console.error('Configuration verification failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export for use in other parts of the application
export default verifyConfigurations;