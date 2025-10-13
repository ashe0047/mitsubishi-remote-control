/**
 * Tests for Performance Monitor
 * Verifies core performance monitoring functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor, performanceMonitor } from '../performance-monitor';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => 1000),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 50000000,
    jsHeapSizeLimit: 100000000,
  },
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.now.mockReturnValue(1000);
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  describe('initialization', () => {
    it('should create a new instance', () => {
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should have singleton instance available', () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('timing measurements', () => {
    it('should start and end timing correctly', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time

      monitor.startTiming('test-operation');
      const duration = monitor.endTiming('test-operation');

      expect(duration).toBe(500);
    });

    it('should handle timing with context', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200);

      monitor.startTiming('test-operation', 'context-1');
      const duration = monitor.endTiming('test-operation', 'context-1');

      expect(duration).toBe(200);
    });

    it('should return 0 for missing start time', () => {
      const duration = monitor.endTiming('non-existent-operation');
      expect(duration).toBe(0);
    });

    it('should record timing metric when ending', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1300);

      monitor.startTiming('test-operation');
      monitor.endTiming('test-operation');

      const metrics = monitor.getMetrics({ name: 'test-operation', type: 'timing' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(300);
      expect(metrics[0].type).toBe('timing');
    });
  });

  describe('counter measurements', () => {
    it('should record counter with default value', () => {
      monitor.recordCounter('test-counter');

      const metrics = monitor.getMetrics({ name: 'test-counter', type: 'counter' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1);
    });

    it('should record counter with custom value', () => {
      monitor.recordCounter('test-counter', 5);

      const metrics = monitor.getMetrics({ name: 'test-counter', type: 'counter' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(5);
    });

    it('should record counter with context', () => {
      monitor.recordCounter('test-counter', 3, 'api-call');

      const metrics = monitor.getMetrics({ context: 'api-call' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].context).toBe('api-call');
    });
  });

  describe('memory measurements', () => {
    it('should record memory usage when memory API is available', () => {
      monitor.recordMemoryUsage('heap-check');

      const metrics = monitor.getMetrics({ type: 'memory' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('heap-check.usedJSHeapSize');
      expect(metrics[0].value).toBe(10000000);
    });

    it('should handle memory API not being available', () => {
      const originalMemory = mockPerformance.memory;
      delete (mockPerformance as any).memory;

      monitor.recordMemoryUsage('heap-check');

      const metrics = monitor.getMetrics({ type: 'memory' });
      expect(metrics).toHaveLength(0);

      mockPerformance.memory = originalMemory;
    });
  });

  describe('metric filtering', () => {
    beforeEach(() => {
      monitor.recordCounter('counter-1', 1, 'context-1');
      monitor.recordCounter('counter-2', 2, 'context-2');
      monitor.startTiming('timing-1');
      mockPerformance.now.mockReturnValue(1100);
      monitor.endTiming('timing-1');
      monitor.recordMemoryUsage('memory-1');
    });

    it('should filter by name', () => {
      const metrics = monitor.getMetrics({ name: 'counter-1' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('counter-1');
    });

    it('should filter by type', () => {
      const timingMetrics = monitor.getMetrics({ type: 'timing' });
      expect(timingMetrics).toHaveLength(1);
      expect(timingMetrics[0].type).toBe('timing');

      const counterMetrics = monitor.getMetrics({ type: 'counter' });
      expect(counterMetrics).toHaveLength(2);
    });

    it('should filter by context', () => {
      const metrics = monitor.getMetrics({ context: 'context-1' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].context).toBe('context-1');
    });

    it('should filter by time range', () => {
      const since = Date.now() - 1000;
      const metrics = monitor.getMetrics({ since });
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should limit results', () => {
      const metrics = monitor.getMetrics({ limit: 2 });
      expect(metrics).toHaveLength(2);
    });
  });

  describe('average timing calculation', () => {
    beforeEach(() => {
      mockPerformance.now
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // 100ms
        .mockReturnValueOnce(1200).mockReturnValueOnce(1400) // 200ms
        .mockReturnValueOnce(1500).mockReturnValueOnce(1800); // 300ms

      monitor.startTiming('api-call');
      monitor.endTiming('api-call');
      
      monitor.startTiming('api-call');
      monitor.endTiming('api-call');
      
      monitor.startTiming('api-call');
      monitor.endTiming('api-call');
    });

    it('should calculate average timing correctly', () => {
      const average = monitor.getAverageTiming('api-call');
      expect(average).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should return 0 for non-existent metrics', () => {
      const average = monitor.getAverageTiming('non-existent');
      expect(average).toBe(0);
    });

    it('should calculate average with context', () => {
      mockPerformance.now
        .mockReturnValueOnce(2000).mockReturnValueOnce(2050);

      monitor.startTiming('api-call', 'user-context');
      monitor.endTiming('api-call', 'user-context');

      const averageWithContext = monitor.getAverageTiming('api-call', 'user-context');
      expect(averageWithContext).toBe(50);

      const averageWithoutContext = monitor.getAverageTiming('api-call');
      expect(averageWithoutContext).toBe(200); // Should still be the original average
    });
  });

  describe('metric management', () => {
    it('should clear all metrics', () => {
      monitor.recordCounter('test-counter');
      monitor.startTiming('test-timing');
      monitor.endTiming('test-timing');

      expect(monitor.getMetrics()).toHaveLength(2);

      monitor.clearMetrics();

      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should limit stored metrics to prevent memory leaks', () => {
      // Create a monitor with a small limit for testing
      const testMonitor = new PerformanceMonitor();
      (testMonitor as any).maxMetrics = 3;

      testMonitor.recordCounter('counter-1');
      testMonitor.recordCounter('counter-2');
      testMonitor.recordCounter('counter-3');
      testMonitor.recordCounter('counter-4'); // This should cause the oldest to be removed

      const metrics = testMonitor.getMetrics();
      expect(metrics).toHaveLength(3);
      
      // The oldest metric should be removed
      const names = metrics.map(m => m.name);
      expect(names).not.toContain('counter-1');
      expect(names).toContain('counter-4');
    });
  });

  describe('performance summary', () => {
    beforeEach(() => {
      monitor.recordCounter('api-calls', 5);
      monitor.recordCounter('errors', 1);
      
      mockPerformance.now
        .mockReturnValueOnce(1000).mockReturnValueOnce(1150) // 150ms
        .mockReturnValueOnce(1200).mockReturnValueOnce(1450); // 250ms

      monitor.startTiming('request-time');
      monitor.endTiming('request-time');
      
      monitor.startTiming('request-time');
      monitor.endTiming('request-time');

      monitor.recordMemoryUsage('heap');
    });

    it('should generate correct performance summary', () => {
      const summary = monitor.getSummary();

      expect(summary.totalMetrics).toBe(5); // 2 counters + 2 timings + 1 memory
      expect(summary.timingMetrics).toBe(2);
      expect(summary.counterMetrics).toBe(2);
      expect(summary.memoryMetrics).toBe(1);
      expect(summary.averageTimings['request-time']).toBe(200); // (150 + 250) / 2
    });

    it('should handle empty metrics gracefully', () => {
      monitor.clearMetrics();
      const summary = monitor.getSummary();

      expect(summary.totalMetrics).toBe(0);
      expect(summary.timingMetrics).toBe(0);
      expect(summary.counterMetrics).toBe(0);
      expect(summary.memoryMetrics).toBe(0);
      expect(Object.keys(summary.averageTimings)).toHaveLength(0);
    });
  });

  describe('utility functions', () => {
    describe('withPerformanceTracking', () => {
      it('should track function execution time', () => {
        const testFunction = (x: number) => x * 2;
        const trackedFunction = require('../performance-monitor').withPerformanceTracking(
          testFunction,
          'test-function'
        );

        mockPerformance.now
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1050);

        const result = trackedFunction(5);

        expect(result).toBe(10);
        
        const metrics = monitor.getMetrics({ name: 'test-function' });
        expect(metrics).toHaveLength(1);
        expect(metrics[0].value).toBe(50);
      });
    });

    describe('debounce', () => {
      it('should debounce function calls', async () => {
        const mockFn = vi.fn();
        const debouncedFn = require('../performance-monitor').debounce(mockFn, 100);

        debouncedFn('arg1');
        debouncedFn('arg2');
        debouncedFn('arg3');

        expect(mockFn).not.toHaveBeenCalled();

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('arg3');
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', async () => {
        const mockFn = vi.fn();
        const throttledFn = require('../performance-monitor').throttle(mockFn, 100);

        throttledFn('arg1');
        throttledFn('arg2');
        throttledFn('arg3');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('arg1');

        await new Promise(resolve => setTimeout(resolve, 150));

        throttledFn('arg4');
        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenLastCalledWith('arg4');
      });
    });
  });

  describe('development mode logging', () => {
    it('should log metrics in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      monitor.recordCounter('test-counter', 5, 'test-context');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Performance: test-counter = 5 (test-context)')
      );

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should not log in production mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      monitor.recordCounter('test-counter', 5, 'test-context');

      expect(consoleSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });
});