"use client";

/**
 * Performance monitoring utilities
 */

// Type definitions for performance monitoring
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'counter' | 'memory';
  context?: string | undefined;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private timers = new Map<string, number>();
  private maxMetrics = 1000; // Keep last 1000 metrics

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing a performance metric
   */
  startTiming(name: string, context?: string): void {
    const key = context ? `${name}:${context}` : name;
    this.timers.set(key, performance.now());
  }

  /**
   * End timing and record the metric
   */
  endTiming(name: string, context?: string): number {
    const key = context ? `${name}:${context}` : name;
    const startTime = this.timers.get(key);
    
    if (!startTime) {
      console.warn(`No start time found for metric: ${key}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(key);

    this.recordMetric({
      name,
      value: duration,
      timestamp: Date.now(),
      type: 'timing',
      context,
    });

    return duration;
  }

  /**
   * Record a counter metric
   */
  recordCounter(name: string, value: number = 1, context?: string): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      type: 'counter',
      context,
    });
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(name: string, context?: string): void {
    if ('memory' in performance) {
      const memory = (performance as PerformanceWithMemory).memory;
      this.recordMetric({
        name: `${name}.usedJSHeapSize`,
        value: memory.usedJSHeapSize,
        timestamp: Date.now(),
        type: 'memory',
        context,
      });
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.unshift(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance: ${metric.name} = ${metric.value}${metric.type === 'timing' ? 'ms' : ''}${metric.context ? ` (${metric.context})` : ''}`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(filter?: {
    name?: string;
    type?: 'timing' | 'counter' | 'memory';
    context?: string;
    since?: number;
    limit?: number;
  }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter) {
      if (filter.name) {
        filtered = filtered.filter(m => m.name.includes(filter.name!));
      }
      if (filter.type) {
        filtered = filtered.filter(m => m.type === filter.type);
      }
      if (filter.context) {
        filtered = filtered.filter(m => m.context?.includes(filter.context!));
      }
      if (filter.since) {
        filtered = filtered.filter(m => m.timestamp >= filter.since!);
      }
      if (filter.limit) {
        filtered = filtered.slice(0, filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get average timing for a metric
   */
  getAverageTiming(name: string, context?: string): number {
    const timings = this.getMetrics({
      name,
      type: 'timing',
      context,
    });

    if (timings.length === 0) return 0;

    const sum = timings.reduce((acc, metric) => acc + metric.value, 0);
    return sum / timings.length;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalMetrics: number;
    timingMetrics: number;
    counterMetrics: number;
    memoryMetrics: number;
    averageTimings: { [key: string]: number };
  } {
    const timingMetrics = this.metrics.filter(m => m.type === 'timing');
    const counterMetrics = this.metrics.filter(m => m.type === 'counter');
    const memoryMetrics = this.metrics.filter(m => m.type === 'memory');

    // Calculate average timings for each unique metric name
    const timingNames = [...new Set(timingMetrics.map(m => m.name))];
    const averageTimings: { [key: string]: number } = {};
    
    timingNames.forEach(name => {
      const metrics = timingMetrics.filter(m => m.name === name);
      const sum = metrics.reduce((acc, m) => acc + m.value, 0);
      averageTimings[name] = sum / metrics.length;
    });

    return {
      totalMetrics: this.metrics.length,
      timingMetrics: timingMetrics.length,
      counterMetrics: counterMetrics.length,
      memoryMetrics: memoryMetrics.length,
      averageTimings,
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Higher-order function to measure component render time
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => unknown>(
  fn: T,
  metricName: string,
  context?: string
): T {
  return ((...args: Parameters<T>) => {
    performanceMonitor.startTiming(metricName, context);
    const result = fn(...args);
    performanceMonitor.endTiming(metricName, context);
    return result;
  }) as T;
}

/**
 * Hook for measuring React component performance
 */
export function usePerformanceTracking(componentName: string) {
  return {
    startTiming: (operation: string) => {
      performanceMonitor.startTiming(`${componentName}.${operation}`);
    },
    endTiming: (operation: string) => {
      return performanceMonitor.endTiming(`${componentName}.${operation}`);
    },
    recordCounter: (metric: string, value?: number) => {
      performanceMonitor.recordCounter(`${componentName}.${metric}`, value);
    },
  };
}

/**
 * Debounce function to optimize frequent calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

/**
 * Throttle function to limit call frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}