/**
 * Performance Optimization Utilities
 * Provides automatic performance optimizations and recommendations
 */

import { performanceMonitor } from './performance-monitor';
import { performanceInterceptor } from '../http/performance-interceptor';
import { webSocketPerformanceMonitor } from './websocket-performance-monitor';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface OptimizationResult {
  type: 'bundle' | 'memory' | 'network' | 'cache' | 'connection';
  action: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  implemented: boolean;
  error?: string;
}

export interface PerformanceOptimizationConfig {
  enableAutoOptimization: boolean;
  bundleOptimization: {
    enabled: boolean;
    maxChunkSize: number; // KB
    splitThreshold: number; // KB
  };
  memoryOptimization: {
    enabled: boolean;
    gcThreshold: number; // MB
    memoryLeakThreshold: number; // MB
  };
  networkOptimization: {
    enabled: boolean;
    compressionThreshold: number; // bytes
    cacheMaxAge: number; // seconds
  };
  connectionOptimization: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number; // ms
    keepAliveInterval: number; // ms
  };
}

export interface OptimizationRecommendation {
  category: 'performance' | 'memory' | 'network' | 'user-experience';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: string;
  codeExample?: string;
}

// =============================================================================
// PERFORMANCE OPTIMIZER
// =============================================================================

export class PerformanceOptimizer {
  private config: PerformanceOptimizationConfig;
  private optimizationResults: OptimizationResult[] = [];
  private lastOptimizationRun: number = 0;
  private optimizationInterval?: NodeJS.Timeout;

  constructor(config: Partial<PerformanceOptimizationConfig> = {}) {
    this.config = {
      enableAutoOptimization: true,
      bundleOptimization: {
        enabled: true,
        maxChunkSize: 250, // 250KB
        splitThreshold: 500, // 500KB
      },
      memoryOptimization: {
        enabled: true,
        gcThreshold: 100, // 100MB
        memoryLeakThreshold: 200, // 200MB
      },
      networkOptimization: {
        enabled: true,
        compressionThreshold: 1024, // 1KB
        cacheMaxAge: 3600, // 1 hour
      },
      connectionOptimization: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 1000,
        keepAliveInterval: 30000, // 30 seconds
      },
      ...config,
    };

    if (this.config.enableAutoOptimization) {
      this.startAutoOptimization();
    }
  }

  /**
   * Start automatic optimization monitoring
   */
  private startAutoOptimization(): void {
    this.optimizationInterval = setInterval(() => {
      this.runOptimizations();
    }, 60000); // Run every minute
  }

  /**
   * Run all enabled optimizations
   */
  async runOptimizations(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    this.lastOptimizationRun = Date.now();

    try {
      // Bundle optimization
      if (this.config.bundleOptimization.enabled) {
        const bundleResults = await this.optimizeBundle();
        results.push(...bundleResults);
      }

      // Memory optimization
      if (this.config.memoryOptimization.enabled) {
        const memoryResults = await this.optimizeMemory();
        results.push(...memoryResults);
      }

      // Network optimization
      if (this.config.networkOptimization.enabled) {
        const networkResults = await this.optimizeNetwork();
        results.push(...networkResults);
      }

      // Connection optimization
      if (this.config.connectionOptimization.enabled) {
        const connectionResults = await this.optimizeConnections();
        results.push(...connectionResults);
      }

      this.optimizationResults = [...this.optimizationResults, ...results];
      
      // Keep only recent results
      if (this.optimizationResults.length > 100) {
        this.optimizationResults = this.optimizationResults.slice(-100);
      }

    } catch (error) {
      console.error('Performance optimization error:', error);
    }

    return results;
  }

  /**
   * Bundle size optimization
   */
  private async optimizeBundle(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    try {
      // Check current bundle size estimation
      const httpMetrics = performanceInterceptor.getPerformanceMetrics();
      const estimatedBundleSize = httpMetrics.bundleSize / 1024; // Convert to KB

      if (estimatedBundleSize > this.config.bundleOptimization.maxChunkSize) {
        results.push({
          type: 'bundle',
          action: 'split_chunks',
          description: `Bundle size (${estimatedBundleSize.toFixed(0)}KB) exceeds recommended size (${this.config.bundleOptimization.maxChunkSize}KB)`,
          impact: 'high',
          implemented: false,
        });
      }

      // Check for unused imports (simplified detection)
      if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as any;
        if (navigation && navigation.loadEventEnd - navigation.fetchStart > 3000) {
          results.push({
            type: 'bundle',
            action: 'remove_unused_code',
            description: 'Slow initial load detected, consider removing unused code',
            impact: 'medium',
            implemented: false,
          });
        }
      }

    } catch (error) {
      results.push({
        type: 'bundle',
        action: 'optimization_error',
        description: 'Failed to analyze bundle optimization',
        impact: 'low',
        implemented: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  /**
   * Memory usage optimization
   */
  private async optimizeMemory(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    try {
      const websocketMetrics = webSocketPerformanceMonitor.getMetrics();
      const memoryUsageMB = websocketMetrics.memoryUsage / 1024 / 1024;

      // Check for potential memory leaks
      if (memoryUsageMB > this.config.memoryOptimization.memoryLeakThreshold) {
        results.push({
          type: 'memory',
          action: 'memory_leak_detection',
          description: `High memory usage detected (${memoryUsageMB.toFixed(1)}MB), potential memory leak`,
          impact: 'high',
          implemented: false,
        });
      }

      // Trigger garbage collection if available and needed
      if (memoryUsageMB > this.config.memoryOptimization.gcThreshold) {
        if (typeof window !== 'undefined' && (window as any).gc) {
          try {
            (window as any).gc();
            results.push({
              type: 'memory',
              action: 'garbage_collection',
              description: `Triggered garbage collection (memory was ${memoryUsageMB.toFixed(1)}MB)`,
              impact: 'medium',
              implemented: true,
            });
          } catch (error) {
            results.push({
              type: 'memory',
              action: 'garbage_collection',
              description: 'Failed to trigger garbage collection',
              impact: 'low',
              implemented: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        } else {
          results.push({
            type: 'memory',
            action: 'garbage_collection',
            description: 'Garbage collection not available, consider memory cleanup',
            impact: 'medium',
            implemented: false,
          });
        }
      }

      // Clear performance monitor metrics if too many are stored
      const performanceMetrics = performanceMonitor.getMetrics();
      if (performanceMetrics.length > 500) {
        performanceMonitor.clearMetrics();
        results.push({
          type: 'memory',
          action: 'clear_metrics',
          description: `Cleared ${performanceMetrics.length} performance metrics to free memory`,
          impact: 'low',
          implemented: true,
        });
      }

    } catch (error) {
      results.push({
        type: 'memory',
        action: 'optimization_error',
        description: 'Failed to analyze memory optimization',
        impact: 'low',
        implemented: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  /**
   * Network performance optimization
   */
  private async optimizeNetwork(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    try {
      const httpMetrics = performanceInterceptor.getPerformanceMetrics();
      const websocketMetrics = webSocketPerformanceMonitor.getMetrics();

      // Check for slow requests
      if (httpMetrics.averageResponseTime > 2000) {
        results.push({
          type: 'network',
          action: 'optimize_requests',
          description: `Slow HTTP requests detected (avg ${httpMetrics.averageResponseTime.toFixed(0)}ms)`,
          impact: 'high',
          implemented: false,
        });
      }

      // Check WebSocket latency
      if (websocketMetrics.networkLatency > 1000) {
        results.push({
          type: 'network',
          action: 'optimize_websocket',
          description: `High WebSocket latency detected (${websocketMetrics.networkLatency.toFixed(0)}ms)`,
          impact: 'high',
          implemented: false,
        });
      }

      // Check cache hit rate
      if (httpMetrics.cacheHitRate < 0.3) {
        results.push({
          type: 'cache',
          action: 'improve_caching',
          description: `Low cache hit rate (${(httpMetrics.cacheHitRate * 100).toFixed(1)}%)`,
          impact: 'medium',
          implemented: false,
        });
      }

      // Optimize request deduplication
      if (httpMetrics.deduplicatedRequests < httpMetrics.totalRequests * 0.1) {
        performanceInterceptor.updateConfig({
          enableRequestDeduplication: true,
          deduplicationTTL: 10000, // Increase TTL
        });
        
        results.push({
          type: 'network',
          action: 'enable_deduplication',
          description: 'Enabled request deduplication to reduce redundant calls',
          impact: 'medium',
          implemented: true,
        });
      }

    } catch (error) {
      results.push({
        type: 'network',
        action: 'optimization_error',
        description: 'Failed to analyze network optimization',
        impact: 'low',
        implemented: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  /**
   * Connection optimization
   */
  private async optimizeConnections(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    try {
      const websocketMetrics = webSocketPerformanceMonitor.getMetrics();

      // Check connection stability
      if (websocketMetrics.connectionStability < 95) {
        results.push({
          type: 'connection',
          action: 'improve_stability',
          description: `Poor connection stability (${websocketMetrics.connectionStability.toFixed(1)}%)`,
          impact: 'high',
          implemented: false,
        });
      }

      // Check for too many reconnections
      if (websocketMetrics.reconnectionCount > 10) {
        results.push({
          type: 'connection',
          action: 'reduce_reconnections',
          description: `High reconnection count (${websocketMetrics.reconnectionCount})`,
          impact: 'medium',
          implemented: false,
        });
      }

      // Optimize message queue if it's getting large
      if (websocketMetrics.messageQueueSize > 50) {
        results.push({
          type: 'connection',
          action: 'optimize_queue',
          description: `Large message queue detected (${websocketMetrics.messageQueueSize} messages)`,
          impact: 'medium',
          implemented: false,
        });
      }

    } catch (error) {
      results.push({
        type: 'connection',
        action: 'optimization_error',
        description: 'Failed to analyze connection optimization',
        impact: 'low',
        implemented: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  /**
   * Get performance optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      const httpMetrics = performanceInterceptor.getPerformanceMetrics();
      const websocketMetrics = webSocketPerformanceMonitor.getMetrics();

      // Performance recommendations
      if (httpMetrics.averageResponseTime > 1000) {
        recommendations.push({
          category: 'performance',
          priority: 'high',
          title: 'Optimize HTTP Request Performance',
          description: 'HTTP requests are taking longer than recommended (>1s)',
          implementation: 'Implement request optimization, caching, and CDN usage',
          estimatedImpact: '30-50% faster load times',
          codeExample: `
// Enable request caching
axiosClient.defaults.cache = true;

// Implement request timeout
axiosClient.defaults.timeout = 5000;
`,
        });
      }

      if (websocketMetrics.networkLatency > 500) {
        recommendations.push({
          category: 'network',
          priority: 'high',
          title: 'Reduce WebSocket Latency',
          description: 'WebSocket communication latency is high (>500ms)',
          implementation: 'Optimize message size, implement message compression',
          estimatedImpact: '40-60% latency reduction',
          codeExample: `
// Enable message compression
const ws = new ReconnectingWebSocket(url, [], {
  connectionOptions: {
    compression: 'permessage-deflate'
  }
});
`,
        });
      }

      // Memory recommendations
      if (websocketMetrics.memoryUsage > 50 * 1024 * 1024) {
        recommendations.push({
          category: 'memory',
          priority: 'medium',
          title: 'Optimize Memory Usage',
          description: 'Application memory usage is high (>50MB)',
          implementation: 'Implement memory cleanup, reduce cached data',
          estimatedImpact: '20-30% memory reduction',
          codeExample: `
// Clear unused performance metrics
performanceMonitor.clearMetrics();

// Implement automatic cleanup
setInterval(() => {
  // Cleanup old data
}, 300000); // Every 5 minutes
`,
        });
      }

      // User experience recommendations
      if (httpMetrics.concurrentRequests > 8) {
        recommendations.push({
          category: 'user-experience',
          priority: 'medium',
          title: 'Implement Request Throttling',
          description: 'High concurrent requests may impact user experience',
          implementation: 'Implement request throttling and queueing',
          estimatedImpact: 'Smoother user interface, reduced server load',
          codeExample: `
// Configure maximum concurrent requests
performanceInterceptor.updateConfig({
  maxConcurrentRequests: 6
});
`,
        });
      }

      if (websocketMetrics.messageQueueSize > 20) {
        recommendations.push({
          category: 'user-experience',
          priority: 'medium',
          title: 'Optimize Message Processing',
          description: 'Message queue is backing up, affecting real-time updates',
          implementation: 'Implement message prioritization and batching',
          estimatedImpact: 'More responsive real-time updates',
        });
      }

    } catch (error) {
      console.error('Error generating recommendations:', error);
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get optimization results
   */
  getOptimizationResults(): OptimizationResult[] {
    return [...this.optimizationResults];
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalOptimizations: number;
    implementedOptimizations: number;
    lastRun: number;
    successRate: number;
  } {
    const total = this.optimizationResults.length;
    const implemented = this.optimizationResults.filter(r => r.implemented).length;
    
    return {
      totalOptimizations: total,
      implementedOptimizations: implemented,
      lastRun: this.lastOptimizationRun,
      successRate: total > 0 ? (implemented / total) * 100 : 0,
    };
  }

  /**
   * Update optimizer configuration
   */
  updateConfig(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-optimization if setting changed
    if (newConfig.enableAutoOptimization !== undefined) {
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
      }
      
      if (newConfig.enableAutoOptimization) {
        this.startAutoOptimization();
      }
    }
  }

  /**
   * Clear optimization results
   */
  clearResults(): void {
    this.optimizationResults = [];
  }

  /**
   * Destroy optimizer
   */
  destroy(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    this.clearResults();
  }
}

// =============================================================================
// SINGLETON INSTANCE AND UTILITIES
// =============================================================================

/**
 * Global performance optimizer instance
 */
export const performanceOptimizer = new PerformanceOptimizer();

/**
 * Get performance optimization recommendations
 */
export function getPerformanceRecommendations(): OptimizationRecommendation[] {
  return performanceOptimizer.getRecommendations();
}

/**
 * Run performance optimizations
 */
export async function optimizePerformance(): Promise<OptimizationResult[]> {
  return performanceOptimizer.runOptimizations();
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats() {
  return performanceOptimizer.getOptimizationStats();
}

/**
 * Update performance optimization configuration
 */
export function updateOptimizationConfig(config: Partial<PerformanceOptimizationConfig>): void {
  performanceOptimizer.updateConfig(config);
}

export default PerformanceOptimizer;