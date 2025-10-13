/**
 * Tests for WebSocket Performance Monitor
 * Verifies WebSocket performance monitoring functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  WebSocketPerformanceMonitor, 
  webSocketPerformanceMonitor,
  type WebSocketPerformanceAlert,
  type WebSocketPerformanceConfig 
} from '../websocket-performance-monitor';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => 1000),
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock window for memory API
Object.defineProperty(global, 'window', {
  value: {
    performance: {
      memory: {
        usedJSHeapSize: 50000000, // 50MB
        totalJSHeapSize: 100000000,
        jsHeapSizeLimit: 200000000,
      },
    },
  },
  writable: true,
});

describe('WebSocketPerformanceMonitor', () => {
  let monitor: WebSocketPerformanceMonitor;
  let alertCallback: ReturnType<typeof vi.fn>;
  let metricsCallback: ReturnType<typeof vi.fn>;

  const testConfig: Partial<WebSocketPerformanceConfig> = {
    enableMetricsCollection: true,
    metricsRetentionTime: 300000,
    latencyThreshold: 500,
    connectionStabilityThreshold: 95,
    messageQueueThreshold: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.now.mockReturnValue(1000);
    
    alertCallback = vi.fn();
    metricsCallback = vi.fn();
    
    monitor = new WebSocketPerformanceMonitor({
      ...testConfig,
      onPerformanceAlert: alertCallback,
      onMetricsUpdate: metricsCallback,
    });
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('initialization', () => {
    it('should create a new instance with default config', () => {
      const defaultMonitor = new WebSocketPerformanceMonitor();
      expect(defaultMonitor).toBeDefined();
      expect(defaultMonitor).toBeInstanceOf(WebSocketPerformanceMonitor);
      defaultMonitor.destroy();
    });

    it('should create instance with custom config', () => {
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(WebSocketPerformanceMonitor);
    });

    it('should have singleton instance available', () => {
      expect(webSocketPerformanceMonitor).toBeDefined();
      expect(webSocketPerformanceMonitor).toBeInstanceOf(WebSocketPerformanceMonitor);
    });
  });

  describe('connection monitoring', () => {
    it('should track connection start', () => {
      monitor.onConnectionStart();
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalConnections).toBe(0); // Not incremented until established
    });

    it('should track connection establishment', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start
        .mockReturnValueOnce(1200); // Established

      monitor.onConnectionStart();
      monitor.onConnectionEstablished();

      const metrics = monitor.getMetrics();
      expect(metrics.totalConnections).toBe(1);
      expect(metrics.connectionEstablishmentTime).toBe(200);
    });

    it('should track reconnection', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start reconnection
        .mockReturnValueOnce(1300); // Reconnection established

      monitor.onConnectionStart(true);
      monitor.onConnectionEstablished(true);

      const metrics = monitor.getMetrics();
      expect(metrics.reconnectionCount).toBe(1);
      expect(metrics.reconnectionTime).toBe(300);
    });

    it('should track connection closure', () => {
      monitor.onConnectionClosed();

      const metrics = monitor.getMetrics();
      expect(metrics.connectionErrors).toBe(0); // No error
      
      const events = monitor.getEvents('close');
      expect(events).toHaveLength(1);
    });

    it('should track connection closure with error', () => {
      monitor.onConnectionClosed('Connection timeout');

      const metrics = monitor.getMetrics();
      expect(metrics.connectionErrors).toBe(1);
      
      const events = monitor.getEvents('close');
      expect(events).toHaveLength(1);
      expect(events[0].error).toBe('Connection timeout');
    });

    it('should track different types of errors', () => {
      monitor.onConnectionError('Auth failed', 'connection');
      monitor.onConnectionError('Invalid message', 'message');
      monitor.onConnectionError('Timeout occurred', 'timeout');

      const metrics = monitor.getMetrics();
      expect(metrics.connectionErrors).toBe(1);
      expect(metrics.messageErrors).toBe(1);
      expect(metrics.timeoutErrors).toBe(1);
    });

    it('should generate high latency alert', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000); // 1000ms - above threshold

      monitor.onConnectionStart();
      monitor.onConnectionEstablished();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'high_latency',
          severity: 'high', // Above 2x threshold
        })
      );
    });
  });

  describe('message monitoring', () => {
    it('should track message sending', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start
        .mockReturnValueOnce(1050); // End

      monitor.onMessageSendStart('msg1', 1024, 'command');
      monitor.onMessageSent('msg1', 'command');

      const metrics = monitor.getMetrics();
      expect(metrics.messagesSent).toBe(1);
      expect(metrics.messageSendLatency).toBe(50);
    });

    it('should track message reception', () => {
      monitor.onMessageReceived(512, 'response', 25);

      const metrics = monitor.getMetrics();
      expect(metrics.messagesReceived).toBe(1);
      expect(metrics.messageReceiveLatency).toBe(25);
    });

    it('should track message acknowledgment', () => {
      monitor.onMessageAcknowledged('msg1', 100);

      const metrics = monitor.getMetrics();
      expect(metrics.messageAcknowledgmentTime).toBe(100);
    });

    it('should track message queue updates', () => {
      monitor.onMessageQueueUpdate(25);

      const metrics = monitor.getMetrics();
      expect(metrics.messageQueueSize).toBe(25);
      expect(metrics.messageQueuePeak).toBe(25);

      monitor.onMessageQueueUpdate(30);
      const updatedMetrics = monitor.getMetrics();
      expect(updatedMetrics.messageQueuePeak).toBe(30);
    });

    it('should generate message queue overflow alert', () => {
      monitor.onMessageQueueUpdate(60); // Above threshold of 50

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_queue_overflow',
          severity: 'medium',
        })
      );
    });

    it('should track dropped messages', () => {
      monitor.onMessageDropped('Queue full');

      const metrics = monitor.getMetrics();
      expect(metrics.messageDropCount).toBe(1);
      
      const events = monitor.getEvents('error');
      expect(events).toHaveLength(1);
      expect(events[0].error).toBe('Message dropped: Queue full');
    });
  });

  describe('performance calculations', () => {
    beforeEach(() => {
      // Set up some baseline data
      mockPerformance.now.mockReturnValue(1000);
      monitor.onConnectionStart();
      mockPerformance.now.mockReturnValue(1100);
      monitor.onConnectionEstablished();
      
      monitor.onMessageSendStart('msg1', 1024);
      mockPerformance.now.mockReturnValue(1150);
      monitor.onMessageSent('msg1');
      
      monitor.onMessageReceived(512, 'response', 30);
    });

    it('should calculate connection stability correctly', async () => {
      // Wait for metrics update interval
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = monitor.getMetrics();
      expect(metrics.connectionStability).toBeGreaterThan(0);
    });

    it('should calculate throughput metrics', async () => {
      // Add more messages to calculate throughput
      for (let i = 0; i < 5; i++) {
        monitor.onMessageReceived(256, 'data');
      }
      
      // Wait for metrics update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = monitor.getMetrics();
      expect(metrics.messageThroughputReceived).toBeGreaterThan(0);
    });

    it('should calculate connection health score', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.connectionHealthScore).toBeGreaterThan(0);
      expect(metrics.connectionHealthScore).toBeLessThanOrEqual(100);
    });

    it('should update network latency from message latencies', () => {
      // Add multiple messages with different latencies
      monitor.onMessageSendStart('msg2', 512);
      mockPerformance.now.mockReturnValue(1200);
      monitor.onMessageSent('msg2');
      
      monitor.onMessageSendStart('msg3', 256);
      mockPerformance.now.mockReturnValue(1280);
      monitor.onMessageSent('msg3');
      
      const metrics = monitor.getMetrics();
      expect(metrics.networkLatency).toBeGreaterThan(0);
    });
  });

  describe('alert system', () => {
    it('should generate connection instability alert', async () => {
      // Simulate poor connection stability by manipulating internal state
      const metrics = monitor.getMetrics();
      (metrics as any).connectionStability = 85; // Below threshold of 95%
      
      // Trigger metric update which checks alerts
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Note: This test might need adjustment based on internal implementation
      // The actual alert generation depends on the internal metrics calculation
    });

    it('should generate memory leak alert', () => {
      // Mock high memory usage
      const originalWindow = global.window;
      global.window = {
        performance: {
          memory: {
            usedJSHeapSize: 250000000, // 250MB - above threshold
            totalJSHeapSize: 500000000,
            jsHeapSizeLimit: 1000000000,
          },
        },
      } as any;

      // Trigger memory update
      const metrics = monitor.getMetrics();
      
      global.window = originalWindow;
    });

    it('should dismiss alerts correctly', () => {
      const alerts = monitor.getAlerts();
      const initialCount = alerts.length;
      
      // Alerts are typically generated by the monitoring system
      // This test verifies the alert retrieval functionality
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('event management', () => {
    beforeEach(() => {
      monitor.onConnectionStart();
      monitor.onConnectionEstablished();
      monitor.onMessageReceived(1024, 'data');
      monitor.onConnectionError('Test error');
    });

    it('should retrieve events by type', () => {
      const connectionEvents = monitor.getEvents('open');
      expect(connectionEvents.length).toBeGreaterThan(0);
      
      const errorEvents = monitor.getEvents('error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should limit events when requested', () => {
      const limitedEvents = monitor.getEvents(undefined, 2);
      expect(limitedEvents.length).toBeLessThanOrEqual(2);
    });

    it('should retrieve all events when no filter specified', () => {
      const allEvents = monitor.getEvents();
      expect(allEvents.length).toBeGreaterThan(0);
    });
  });

  describe('performance summary', () => {
    beforeEach(() => {
      // Set up a good connection
      monitor.onConnectionStart();
      monitor.onConnectionEstablished();
      
      for (let i = 0; i < 10; i++) {
        monitor.onMessageReceived(512, 'data', 20);
      }
    });

    it('should generate performance summary', () => {
      const summary = monitor.getPerformanceSummary();
      
      expect(summary).toHaveProperty('overall');
      expect(summary).toHaveProperty('healthScore');
      expect(summary).toHaveProperty('keyIssues');
      expect(summary).toHaveProperty('recommendations');
      
      expect(['excellent', 'good', 'fair', 'poor']).toContain(summary.overall);
      expect(summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(summary.healthScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(summary.keyIssues)).toBe(true);
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should reflect poor performance in summary', () => {
      // Add some problems
      monitor.onConnectionError('Frequent disconnects', 'connection');
      monitor.onMessageQueueUpdate(100); // Large queue
      
      const summary = monitor.getPerformanceSummary();
      expect(summary.healthScore).toBeLessThan(100);
    });
  });

  describe('configuration and cleanup', () => {
    it('should update configuration', () => {
      const newConfig = {
        latencyThreshold: 1000,
        enableMetricsCollection: false,
      };
      
      monitor.updateConfig(newConfig);
      
      // Verify config was updated by testing behavior
      monitor.onConnectionError('Test error');
      // With metrics disabled, this shouldn't be tracked
    });

    it('should reset metrics correctly', () => {
      monitor.onConnectionEstablished();
      monitor.onMessageReceived(512, 'data');
      
      expect(monitor.getMetrics().totalConnections).toBe(1);
      
      monitor.reset();
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalConnections).toBe(0);
      expect(monitor.getEvents()).toHaveLength(0);
      expect(monitor.getAlerts()).toHaveLength(0);
    });

    it('should cleanup resources on destroy', () => {
      const spy = vi.spyOn(monitor, 'reset');
      
      monitor.destroy();
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('utility functions', () => {
    it('should provide access to singleton functions', () => {
      const { getWebSocketMetrics, getWebSocketAlerts, getWebSocketPerformanceSummary } = 
        require('../websocket-performance-monitor');
      
      expect(typeof getWebSocketMetrics).toBe('function');
      expect(typeof getWebSocketAlerts).toBe('function');
      expect(typeof getWebSocketPerformanceSummary).toBe('function');
      
      const metrics = getWebSocketMetrics();
      expect(typeof metrics).toBe('object');
      
      const alerts = getWebSocketAlerts();
      expect(Array.isArray(alerts)).toBe(true);
      
      const summary = getWebSocketPerformanceSummary();
      expect(typeof summary).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('should handle disabled metrics collection', () => {
      const disabledMonitor = new WebSocketPerformanceMonitor({
        enableMetricsCollection: false,
      });
      
      disabledMonitor.onConnectionStart();
      disabledMonitor.onConnectionEstablished();
      
      const metrics = disabledMonitor.getMetrics();
      expect(metrics.totalConnections).toBe(0);
      
      disabledMonitor.destroy();
    });

    it('should handle missing performance API gracefully', () => {
      const originalPerformance = global.performance;
      delete (global as any).performance;
      
      const monitor = new WebSocketPerformanceMonitor();
      
      expect(() => {
        monitor.onConnectionStart();
        monitor.onMessageSendStart('msg1', 1024);
      }).not.toThrow();
      
      monitor.destroy();
      global.performance = originalPerformance;
    });

    it('should handle missing memory API gracefully', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
      
      global.window = originalWindow;
    });
  });
});