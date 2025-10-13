import { describe, it, expect, beforeEach } from 'vitest';
import { 
  HttpConfigManager, 
  httpConfigSchema,
  WebSocketConfigManager,
  websocketConfigSchema,
  CombinedConfigManager,
  loadHttpConfig,
  loadWebSocketConfig
} from '../index';

describe('HTTP Configuration', () => {
  let httpManager: HttpConfigManager;

  beforeEach(() => {
    httpManager = new HttpConfigManager('test');
  });

  it('should load valid test configuration', () => {
    const config = httpManager.getConfig();
    expect(config.baseURL).toBeDefined();
    expect(config.timeout).toBeGreaterThan(0);
    expect(config.retries).toBeGreaterThanOrEqual(0);
  });

  it('should validate configuration schema', () => {
    const config = httpManager.getConfig();
    const result = httpConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should update configuration', () => {
    const originalTimeout = httpManager.getConfig().timeout;
    httpManager.updateConfig({ timeout: 15000 });
    expect(httpManager.getConfig().timeout).toBe(15000);
    expect(httpManager.getConfig().timeout).not.toBe(originalTimeout);
  });

  it('should handle invalid configuration updates', () => {
    expect(() => {
      httpManager.updateConfig({ timeout: -1000 } as any);
    }).toThrow();
  });

  it('should notify listeners on config change', () => {
    let notified = false;
    const unsubscribe = httpManager.onConfigChange(() => {
      notified = true;
    });

    httpManager.updateConfig({ timeout: 20000 });
    expect(notified).toBe(true);

    unsubscribe();
  });
});

describe('WebSocket Configuration', () => {
  let wsManager: WebSocketConfigManager;

  beforeEach(() => {
    wsManager = new WebSocketConfigManager('test');
  });

  it('should load valid test configuration', () => {
    const config = wsManager.getConfig();
    expect(config.url).toBeDefined();
    expect(config.connectionTimeout).toBeGreaterThan(0);
    expect(config.reconnectionAttempts).toBeGreaterThanOrEqual(0);
  });

  it('should validate configuration schema', () => {
    const config = wsManager.getConfig();
    const result = websocketConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should calculate reconnection delay correctly', () => {
    const delay1 = wsManager.getReconnectionDelay(1);
    const delay2 = wsManager.getReconnectionDelay(2);
    expect(delay2).toBeGreaterThanOrEqual(delay1);
  });

  it('should provide utility methods', () => {
    expect(typeof wsManager.isReconnectionEnabled()).toBe('boolean');
    expect(typeof wsManager.shouldEnableAuth()).toBe('boolean');
    expect(typeof wsManager.shouldEnableMessageQueue()).toBe('boolean');
    expect(typeof wsManager.shouldEnableHeartbeat()).toBe('boolean');
  });

  it('should update auth configuration', () => {
    const originalEnabled = wsManager.getConfig().auth.enabled;
    wsManager.updateAuthConfig({ enabled: !originalEnabled });
    expect(wsManager.getConfig().auth.enabled).toBe(!originalEnabled);
  });
});

describe('Combined Configuration Manager', () => {
  let combinedManager: CombinedConfigManager;

  beforeEach(() => {
    combinedManager = new CombinedConfigManager();
  });

  it('should provide access to both configurations', () => {
    const configs = combinedManager.getAllConfigs();
    expect(configs.http).toBeDefined();
    expect(configs.websocket).toBeDefined();
    expect(configs.app).toBeDefined();
  });

  it('should validate all configurations', () => {
    const validation = combinedManager.validateAllConfigs();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('Configuration Loading', () => {
  it('should load different environment configurations', () => {
    const devConfig = loadHttpConfig('development');
    const prodConfig = loadHttpConfig('production');
    const testConfig = loadHttpConfig('test');

    expect(devConfig.enableLogging).toBe(true);
    expect(prodConfig.enableLogging).toBe(false);
    expect(testConfig.timeout).toBeLessThan(devConfig.timeout);
  });

  it('should load WebSocket configurations for different environments', () => {
    const devConfig = loadWebSocketConfig('development');
    const prodConfig = loadWebSocketConfig('production');
    const testConfig = loadWebSocketConfig('test');

    expect(devConfig.debug).toBe(true);
    expect(prodConfig.debug).toBe(false);
    expect(testConfig.autoConnect).toBe(false);
  });
});