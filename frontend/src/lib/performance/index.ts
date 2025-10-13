/**
 * Performance Monitoring System - Main Export File
 * Comprehensive performance monitoring for HTTP requests, WebSocket connections, and application metrics
 */

// Core performance monitoring
export { 
  performanceMonitor,
  PerformanceMonitor,
  withPerformanceTracking,
  usePerformanceTracking,
  debounce,
  throttle,
  type PerformanceMetric,
} from './performance-monitor';

// HTTP performance monitoring
export {
  performanceInterceptor,
  PerformanceInterceptor,
  setupPerformanceInterceptors,
  type PerformanceInterceptorConfig,
  type RequestDeduplicationEntry,
  type PerformanceMetrics,
  type RequestCancellation,
} from '../http/performance-interceptor';

// WebSocket performance monitoring
export {
  webSocketPerformanceMonitor,
  WebSocketPerformanceMonitor,
  createWebSocketPerformanceMonitor,
  getWebSocketMetrics,
  getWebSocketAlerts,
  getWebSocketPerformanceSummary,
  type WebSocketPerformanceMetrics,
  type WebSocketConnectionEvent,
  type WebSocketPerformanceAlert,
  type WebSocketPerformanceConfig,
} from './websocket-performance-monitor';

// Performance optimization
export {
  performanceOptimizer,
  PerformanceOptimizer,
  getPerformanceRecommendations,
  optimizePerformance,
  getOptimizationStats,
  updateOptimizationConfig,
  type OptimizationResult,
  type PerformanceOptimizationConfig,
  type OptimizationRecommendation,
} from './performance-optimization';

// Performance dashboard component
export {
  PerformanceDashboard,
  default as Dashboard,
} from './performance-dashboard';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Initialize comprehensive performance monitoring
 */
export function initializePerformanceMonitoring(config?: {
  enableHttpMonitoring?: boolean;
  enableWebSocketMonitoring?: boolean;
  enableOptimization?: boolean;
  enableDashboard?: boolean;
}) {
  const {
    enableHttpMonitoring = true,
    enableWebSocketMonitoring = true,
    enableOptimization = true,
  } = config || {};

  console.log('[Performance] Initializing comprehensive performance monitoring...');

  // HTTP monitoring is automatically initialized with axios client
  if (enableHttpMonitoring) {
    console.log('[Performance] HTTP performance monitoring enabled');
  }

  // WebSocket monitoring
  if (enableWebSocketMonitoring) {
    webSocketPerformanceMonitor.updateConfig({ enableMetricsCollection: true });
    console.log('[Performance] WebSocket performance monitoring enabled');
  }

  // Performance optimization
  if (enableOptimization) {
    performanceOptimizer.updateConfig({ enableAutoOptimization: true });
    console.log('[Performance] Automatic performance optimization enabled');
  }

  return {
    httpMonitor: performanceInterceptor,
    websocketMonitor: webSocketPerformanceMonitor,
    optimizer: performanceOptimizer,
    coreMonitor: performanceMonitor,
  };
}

/**
 * Get comprehensive performance summary
 */
export function getComprehensivePerformanceSummary() {
  const httpMetrics = performanceInterceptor.getPerformanceMetrics();
  const websocketMetrics = webSocketPerformanceMonitor.getMetrics();
  const websocketSummary = webSocketPerformanceMonitor.getPerformanceSummary();
  const optimizationStats = performanceOptimizer.getOptimizationStats();
  const coreMetrics = performanceMonitor.getSummary();

  // Calculate overall system health score
  const healthFactors = [
    // HTTP health (based on response time and error rate)
    httpMetrics.averageResponseTime < 1000 ? 100 : Math.max(0, 100 - (httpMetrics.averageResponseTime - 1000) / 50),
    
    // WebSocket health (use existing health score)
    websocketMetrics.connectionHealthScore,
    
    // Memory health (based on memory usage)
    websocketMetrics.memoryUsage < 50 * 1024 * 1024 ? 100 : Math.max(0, 100 - (websocketMetrics.memoryUsage / 1024 / 1024 - 50) * 2),
    
    // Connection stability
    websocketMetrics.connectionStability,
  ];

  const overallHealth = healthFactors.reduce((sum, score) => sum + score, 0) / healthFactors.length;

  return {
    overallHealth: Math.round(overallHealth),
    http: {
      totalRequests: httpMetrics.totalRequests,
      averageResponseTime: httpMetrics.averageResponseTime,
      cacheHitRate: httpMetrics.cacheHitRate,
      concurrentRequests: httpMetrics.concurrentRequests,
      errorRate: httpMetrics.totalRequests > 0 ? 
        (httpMetrics.cancelledRequests / httpMetrics.totalRequests) * 100 : 0,
    },
    websocket: {
      healthScore: websocketMetrics.connectionHealthScore,
      connectionStability: websocketMetrics.connectionStability,
      messagesSent: websocketMetrics.messagesSent,
      messagesReceived: websocketMetrics.messagesReceived,
      networkLatency: websocketMetrics.networkLatency,
      messageQueueSize: websocketMetrics.messageQueueSize,
    },
    memory: {
      usage: websocketMetrics.memoryUsage,
      usageMB: Math.round(websocketMetrics.memoryUsage / 1024 / 1024),
    },
    optimization: {
      totalOptimizations: optimizationStats.totalOptimizations,
      implementedOptimizations: optimizationStats.implementedOptimizations,
      successRate: optimizationStats.successRate,
      lastRun: optimizationStats.lastRun,
    },
    core: {
      totalMetrics: coreMetrics.totalMetrics,
      timingMetrics: coreMetrics.timingMetrics,
      averageTimings: coreMetrics.averageTimings,
    },
    summary: websocketSummary,
    timestamp: Date.now(),
  };
}

/**
 * Export all performance data for analysis
 */
export function exportPerformanceData(format: 'json' | 'csv' = 'json') {
  const data = {
    timestamp: Date.now(),
    summary: getComprehensivePerformanceSummary(),
    httpMetrics: performanceInterceptor.getPerformanceMetrics(),
    websocketMetrics: webSocketPerformanceMonitor.getMetrics(),
    websocketAlerts: webSocketPerformanceMonitor.getAlerts(),
    optimizationResults: performanceOptimizer.getOptimizationResults(),
    recommendations: performanceOptimizer.getRecommendations(),
    coreMetrics: performanceMonitor.getMetrics(),
  };

  if (format === 'csv') {
    // Simplified CSV export for key metrics
    const csvData = [
      ['Metric', 'Value', 'Unit'],
      ['Overall Health', data.summary.overallHealth, '%'],
      ['HTTP Requests', data.summary.http.totalRequests, 'count'],
      ['HTTP Response Time', data.summary.http.averageResponseTime, 'ms'],
      ['WebSocket Health', data.summary.websocket.healthScore, '%'],
      ['Connection Stability', data.summary.websocket.connectionStability, '%'],
      ['Network Latency', data.summary.websocket.networkLatency, 'ms'],
      ['Memory Usage', data.summary.memory.usageMB, 'MB'],
      ['Messages Sent', data.summary.websocket.messagesSent, 'count'],
      ['Messages Received', data.summary.websocket.messagesReceived, 'count'],
      ['Optimizations Implemented', data.summary.optimization.implementedOptimizations, 'count'],
    ];

    return csvData.map(row => row.join(',')).join('\n');
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Reset all performance monitoring data
 */
export function resetAllPerformanceData() {
  performanceMonitor.clearMetrics();
  performanceInterceptor.resetMetrics();
  webSocketPerformanceMonitor.reset();
  performanceOptimizer.clearResults();
  console.log('[Performance] All performance monitoring data has been reset');
}

/**
 * Enable/disable all performance monitoring
 */
export function togglePerformanceMonitoring(enabled: boolean) {
  webSocketPerformanceMonitor.updateConfig({ enableMetricsCollection: enabled });
  performanceOptimizer.updateConfig({ enableAutoOptimization: enabled });
  
  if (enabled) {
    console.log('[Performance] Performance monitoring enabled');
  } else {
    console.log('[Performance] Performance monitoring disabled');
  }
}

// =============================================================================
// TYPES RE-EXPORTS
// =============================================================================

export type {
  // Core performance monitoring types
  PerformanceMetric,
  
  // HTTP performance types
  PerformanceInterceptorConfig,
  PerformanceMetrics as HttpPerformanceMetrics,
  RequestDeduplicationEntry,
  RequestCancellation,
  
  // WebSocket performance types
  WebSocketPerformanceMetrics,
  WebSocketConnectionEvent,
  WebSocketPerformanceAlert,
  WebSocketPerformanceConfig,
  
  // Optimization types
  OptimizationResult,
  PerformanceOptimizationConfig,
  OptimizationRecommendation,
} from './performance-monitor';