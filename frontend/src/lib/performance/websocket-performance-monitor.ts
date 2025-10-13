/**
 * WebSocket Performance Monitoring System
 * Provides comprehensive performance tracking for WebSocket connections, messages, and health metrics
 */

import { performanceMonitor } from './performance-monitor';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface WebSocketPerformanceMetrics {
  // Connection metrics
  connectionEstablishmentTime: number;
  totalConnections: number;
  reconnectionCount: number;
  reconnectionTime: number;
  connectionUptime: number;
  connectionStability: number; // Ratio of uptime to total time
  
  // Message metrics
  messagesSent: number;
  messagesReceived: number;
  messageSendLatency: number;
  messageReceiveLatency: number;
  messageAcknowledgmentTime: number;
  messageQueueSize: number;
  messageQueuePeak: number;
  messageDropCount: number;
  messageThroughputSent: number; // Messages per second
  messageThroughputReceived: number;
  
  // Memory and resource metrics
  memoryUsage: number;
  connectionHealthScore: number; // 0-100 score based on various factors
  
  // Error metrics
  connectionErrors: number;
  messageErrors: number;
  timeoutErrors: number;
  
  // Network metrics
  networkLatency: number;
  bandwidthUsage: number;
  protocolOverhead: number;
}

export interface WebSocketConnectionEvent {
  type: 'open' | 'close' | 'error' | 'message' | 'reconnect';
  timestamp: number;
  latency?: number;
  error?: string;
  messageSize?: number;
  messageType?: string;
  reconnectionAttempt?: number;
}

export interface WebSocketPerformanceAlert {
  type: 'high_latency' | 'connection_instability' | 'memory_leak' | 'message_queue_overflow' | 'high_error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
  recommendations: string[];
}

export interface WebSocketPerformanceConfig {
  // Monitoring settings
  enableMetricsCollection: boolean;
  metricsRetentionTime: number; // ms
  maxEventsToStore: number;
  
  // Thresholds for alerts
  latencyThreshold: number; // ms
  connectionStabilityThreshold: number; // percentage
  messageQueueThreshold: number;
  memoryUsageThreshold: number; // bytes
  errorRateThreshold: number; // percentage
  
  // Performance optimization
  enableAutoOptimization: boolean;
  messageBufferSize: number;
  compressionEnabled: boolean;
  
  // Callbacks
  onPerformanceAlert?: (alert: WebSocketPerformanceAlert) => void;
  onMetricsUpdate?: (metrics: WebSocketPerformanceMetrics) => void;
}

// =============================================================================
// WEBSOCKET PERFORMANCE MONITOR
// =============================================================================

export class WebSocketPerformanceMonitor {
  private config: WebSocketPerformanceConfig;
  private metrics: WebSocketPerformanceMetrics;
  private events: WebSocketConnectionEvent[] = [];
  private alerts: WebSocketPerformanceAlert[] = [];
  private timers = new Map<string, number>();
  private messageLatencies: number[] = [];
  private connectionStartTime: number = 0;
  private lastConnectionTime: number = 0;
  private connectionHistory: { start: number; end?: number }[] = [];
  private cleanupInterval?: NodeJS.Timeout;
  private metricsUpdateInterval?: NodeJS.Timeout;

  constructor(config: Partial<WebSocketPerformanceConfig> = {}) {
    this.config = {
      enableMetricsCollection: true,
      metricsRetentionTime: 300000, // 5 minutes
      maxEventsToStore: 1000,
      latencyThreshold: 1000, // 1 second
      connectionStabilityThreshold: 95, // 95%
      messageQueueThreshold: 100,
      memoryUsageThreshold: 50 * 1024 * 1024, // 50MB
      errorRateThreshold: 5, // 5%
      enableAutoOptimization: true,
      messageBufferSize: 1024,
      compressionEnabled: true,
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.setupIntervals();
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): WebSocketPerformanceMetrics {
    return {
      connectionEstablishmentTime: 0,
      totalConnections: 0,
      reconnectionCount: 0,
      reconnectionTime: 0,
      connectionUptime: 0,
      connectionStability: 100,
      messagesSent: 0,
      messagesReceived: 0,
      messageSendLatency: 0,
      messageReceiveLatency: 0,
      messageAcknowledgmentTime: 0,
      messageQueueSize: 0,
      messageQueuePeak: 0,
      messageDropCount: 0,
      messageThroughputSent: 0,
      messageThroughputReceived: 0,
      memoryUsage: 0,
      connectionHealthScore: 100,
      connectionErrors: 0,
      messageErrors: 0,
      timeoutErrors: 0,
      networkLatency: 0,
      bandwidthUsage: 0,
      protocolOverhead: 0,
    };
  }

  /**
   * Setup performance monitoring intervals
   */
  private setupIntervals(): void {
    // Cleanup expired events
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEvents();
    }, 60000); // Every minute

    // Update metrics periodically
    this.metricsUpdateInterval = setInterval(() => {
      this.updateCalculatedMetrics();
      if (this.config.onMetricsUpdate) {
        this.config.onMetricsUpdate(this.getMetrics());
      }
    }, 5000); // Every 5 seconds
  }

  // =============================================================================
  // CONNECTION MONITORING
  // =============================================================================

  /**
   * Track connection establishment start
   */
  onConnectionStart(reconnection = false): void {
    if (!this.config.enableMetricsCollection) return;

    const now = performance.now();
    this.connectionStartTime = now;
    
    if (reconnection) {
      this.metrics.reconnectionCount++;
      performanceMonitor.startTiming('websocket.reconnection');
    } else {
      performanceMonitor.startTiming('websocket.connection');
    }

    this.recordEvent({
      type: reconnection ? 'reconnect' : 'open',
      timestamp: Date.now(),
    });
  }

  /**
   * Track successful connection establishment
   */
  onConnectionEstablished(reconnection = false): void {
    if (!this.config.enableMetricsCollection) return;

    const now = performance.now();
    const establishmentTime = now - this.connectionStartTime;
    
    if (reconnection) {
      this.metrics.reconnectionTime = establishmentTime;
      performanceMonitor.endTiming('websocket.reconnection');
    } else {
      this.metrics.connectionEstablishmentTime = establishmentTime;
      performanceMonitor.endTiming('websocket.connection');
    }

    this.metrics.totalConnections++;
    this.lastConnectionTime = Date.now();
    this.connectionHistory.push({ start: this.lastConnectionTime });

    // Track connection establishment performance
    performanceMonitor.recordMetric({
      name: 'websocket.connection.establishment',
      value: establishmentTime,
      timestamp: Date.now(),
      type: 'timing',
      context: reconnection ? 'reconnection' : 'initial',
    });

    this.recordEvent({
      type: 'open',
      timestamp: Date.now(),
      latency: establishmentTime,
    });

    this.checkLatencyAlert(establishmentTime);
  }

  /**
   * Track connection closure
   */
  onConnectionClosed(error?: string): void {
    if (!this.config.enableMetricsCollection) return;

    const now = Date.now();
    
    // Update connection history
    const lastConnection = this.connectionHistory[this.connectionHistory.length - 1];
    if (lastConnection && !lastConnection.end) {
      lastConnection.end = now;
    }

    if (error) {
      this.metrics.connectionErrors++;
    }

    this.recordEvent({
      type: 'close',
      timestamp: now,
      error,
    });

    performanceMonitor.recordCounter('websocket.connection.closed');
    if (error) {
      performanceMonitor.recordCounter('websocket.connection.error');
    }
  }

  /**
   * Track connection error
   */
  onConnectionError(error: string, type: 'connection' | 'message' | 'timeout' = 'connection'): void {
    if (!this.config.enableMetricsCollection) return;

    switch (type) {
      case 'connection':
        this.metrics.connectionErrors++;
        break;
      case 'message':
        this.metrics.messageErrors++;
        break;
      case 'timeout':
        this.metrics.timeoutErrors++;
        break;
    }

    this.recordEvent({
      type: 'error',
      timestamp: Date.now(),
      error,
    });

    performanceMonitor.recordCounter(`websocket.error.${type}`);
    
    // Check error rate alert
    this.checkErrorRateAlert();
  }

  // =============================================================================
  // MESSAGE MONITORING
  // =============================================================================

  /**
   * Track message sending start
   */
  onMessageSendStart(messageId: string, messageSize: number, messageType?: string): void {
    if (!this.config.enableMetricsCollection) return;

    this.timers.set(`send:${messageId}`, performance.now());
    
    performanceMonitor.startTiming('websocket.message.send', messageType);
    performanceMonitor.recordCounter('websocket.message.sent');
    
    this.recordEvent({
      type: 'message',
      timestamp: Date.now(),
      messageSize,
      messageType: `send:${messageType || 'unknown'}`,
    });
  }

  /**
   * Track message sending completion
   */
  onMessageSent(messageId: string, messageType?: string): void {
    if (!this.config.enableMetricsCollection) return;

    const startTime = this.timers.get(`send:${messageId}`);
    if (!startTime) return;

    const latency = performance.now() - startTime;
    this.metrics.messagesSent++;
    this.updateMessageLatency(latency, 'send');
    
    this.timers.delete(`send:${messageId}`);
    
    performanceMonitor.endTiming('websocket.message.send', messageType);
    performanceMonitor.recordMetric({
      name: 'websocket.message.send.latency',
      value: latency,
      timestamp: Date.now(),
      type: 'timing',
      context: messageType,
    });
  }

  /**
   * Track message reception
   */
  onMessageReceived(messageSize: number, messageType?: string, processingTime?: number): void {
    if (!this.config.enableMetricsCollection) return;

    this.metrics.messagesReceived++;
    
    if (processingTime) {
      this.updateMessageLatency(processingTime, 'receive');
    }

    performanceMonitor.recordCounter('websocket.message.received');
    performanceMonitor.recordMetric({
      name: 'websocket.message.size',
      value: messageSize,
      timestamp: Date.now(),
      type: 'counter',
      context: messageType,
    });

    if (processingTime) {
      performanceMonitor.recordMetric({
        name: 'websocket.message.processing',
        value: processingTime,
        timestamp: Date.now(),
        type: 'timing',
        context: messageType,
      });
    }

    this.recordEvent({
      type: 'message',
      timestamp: Date.now(),
      messageSize,
      messageType: `receive:${messageType || 'unknown'}`,
      latency: processingTime,
    });
  }

  /**
   * Track message acknowledgment
   */
  onMessageAcknowledged(messageId: string, acknowledgmentTime: number): void {
    if (!this.config.enableMetricsCollection) return;

    this.metrics.messageAcknowledgmentTime = 
      (this.metrics.messageAcknowledgmentTime + acknowledgmentTime) / 2;

    performanceMonitor.recordMetric({
      name: 'websocket.message.acknowledgment',
      value: acknowledgmentTime,
      timestamp: Date.now(),
      type: 'timing',
    });
  }

  /**
   * Track message queue status
   */
  onMessageQueueUpdate(queueSize: number): void {
    if (!this.config.enableMetricsCollection) return;

    this.metrics.messageQueueSize = queueSize;
    this.metrics.messageQueuePeak = Math.max(this.metrics.messageQueuePeak, queueSize);

    performanceMonitor.recordMetric({
      name: 'websocket.message.queue.size',
      value: queueSize,
      timestamp: Date.now(),
      type: 'counter',
    });

    // Check queue overflow alert
    if (queueSize > this.config.messageQueueThreshold) {
      this.createAlert({
        type: 'message_queue_overflow',
        severity: queueSize > this.config.messageQueueThreshold * 2 ? 'high' : 'medium',
        message: `Message queue size (${queueSize}) exceeds threshold (${this.config.messageQueueThreshold})`,
        timestamp: Date.now(),
        value: queueSize,
        threshold: this.config.messageQueueThreshold,
        recommendations: [
          'Increase message processing speed',
          'Implement message prioritization',
          'Consider increasing queue size limit',
          'Check for message processing bottlenecks',
        ],
      });
    }
  }

  /**
   * Track dropped messages
   */
  onMessageDropped(reason: string): void {
    if (!this.config.enableMetricsCollection) return;

    this.metrics.messageDropCount++;
    
    performanceMonitor.recordCounter('websocket.message.dropped');
    
    this.recordEvent({
      type: 'error',
      timestamp: Date.now(),
      error: `Message dropped: ${reason}`,
    });
  }

  // =============================================================================
  // PERFORMANCE CALCULATIONS
  // =============================================================================

  /**
   * Update calculated metrics
   */
  private updateCalculatedMetrics(): void {
    if (!this.config.enableMetricsCollection) return;

    // Update connection uptime and stability
    this.updateConnectionMetrics();
    
    // Update throughput metrics
    this.updateThroughputMetrics();

    // Update memory usage
    // TODO: Implement updateMemoryMetrics method
    // this.updateMemoryMetrics();

    // Update network metrics
    this.updateNetworkMetrics();
    
    // Update health score
    this.updateConnectionHealthScore();
    
    // Check for performance issues
    this.checkPerformanceAlerts();
  }

  /**
   * Update connection-related metrics
   */
  private updateConnectionMetrics(): void {
    const now = Date.now();
    
    // Calculate uptime
    if (this.lastConnectionTime > 0) {
      this.metrics.connectionUptime = now - this.lastConnectionTime;
    }

    // Calculate connection stability
    if (this.connectionHistory.length > 0) {
      const totalTime = now - this.connectionHistory[0].start;
      const connectedTime = this.connectionHistory.reduce((total, conn) => {
        const start = conn.start;
        const end = conn.end || now;
        return total + (end - start);
      }, 0);
      
      this.metrics.connectionStability = totalTime > 0 ? (connectedTime / totalTime) * 100 : 100;
    }
  }

  /**
   * Update throughput metrics
   */
  private updateThroughputMetrics(): void {
    const timeWindow = 60000; // 1 minute window
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const recentEvents = this.events.filter(event => event.timestamp >= cutoff);
    const sentMessages = recentEvents.filter(event => 
      event.type === 'message' && event.messageType?.startsWith('send:')
    ).length;
    const receivedMessages = recentEvents.filter(event => 
      event.type === 'message' && event.messageType?.startsWith('receive:')
    ).length;

    this.metrics.messageThroughputSent = sentMessages / (timeWindow / 1000);
    this.metrics.messageThroughputReceived = receivedMessages / (timeWindow / 1000);
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
      
      performanceMonitor.recordMemoryUsage('websocket.memory');
    }
  }

  /**
   * Update network-related metrics
   */
  private updateNetworkMetrics(): void {
    // Calculate average network latency from recent message latencies
    if (this.messageLatencies.length > 0) {
      const recentLatencies = this.messageLatencies.slice(-10); // Last 10 measurements
      this.metrics.networkLatency = recentLatencies.reduce((sum, latency) => sum + latency, 0) / recentLatencies.length;
    }

    // Calculate bandwidth usage (simplified estimation)
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const recentMessageEvents = this.events.filter(event => 
      event.timestamp >= cutoff && event.type === 'message' && event.messageSize
    );
    
    const totalBytes = recentMessageEvents.reduce((sum, event) => sum + (event.messageSize || 0), 0);
    this.metrics.bandwidthUsage = totalBytes / (timeWindow / 1000); // bytes per second
    
    // Estimate protocol overhead (WebSocket frame overhead is typically small)
    this.metrics.protocolOverhead = recentMessageEvents.length * 6; // Rough estimate of frame overhead
  }

  /**
   * Update connection health score
   */
  private updateConnectionHealthScore(): void {
    let score = 100;
    
    // Deduct points for high latency
    if (this.metrics.networkLatency > this.config.latencyThreshold) {
      score -= Math.min(30, (this.metrics.networkLatency / this.config.latencyThreshold - 1) * 20);
    }
    
    // Deduct points for low connection stability
    if (this.metrics.connectionStability < this.config.connectionStabilityThreshold) {
      score -= (this.config.connectionStabilityThreshold - this.metrics.connectionStability);
    }
    
    // Deduct points for high error rate
    const totalOperations = this.metrics.messagesSent + this.metrics.messagesReceived + this.metrics.totalConnections;
    const totalErrors = this.metrics.connectionErrors + this.metrics.messageErrors + this.metrics.timeoutErrors;
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    
    if (errorRate > this.config.errorRateThreshold) {
      score -= Math.min(40, errorRate * 2);
    }
    
    // Deduct points for message queue issues
    if (this.metrics.messageQueueSize > this.config.messageQueueThreshold) {
      score -= Math.min(20, (this.metrics.messageQueueSize / this.config.messageQueueThreshold - 1) * 10);
    }
    
    this.metrics.connectionHealthScore = Math.max(0, Math.round(score));
  }

  /**
   * Update message latency statistics
   */
  private updateMessageLatency(latency: number, type: 'send' | 'receive'): void {
    this.messageLatencies.push(latency);
    
    // Keep only recent measurements
    if (this.messageLatencies.length > 100) {
      this.messageLatencies = this.messageLatencies.slice(-100);
    }
    
    // Update metrics
    if (type === 'send') {
      this.metrics.messageSendLatency = 
        (this.metrics.messageSendLatency + latency) / 2;
    } else {
      this.metrics.messageReceiveLatency = 
        (this.metrics.messageReceiveLatency + latency) / 2;
    }
  }

  // =============================================================================
  // ALERT SYSTEM
  // =============================================================================

  /**
   * Check for latency alerts
   */
  private checkLatencyAlert(latency: number): void {
    if (latency > this.config.latencyThreshold) {
      this.createAlert({
        type: 'high_latency',
        severity: latency > this.config.latencyThreshold * 2 ? 'high' : 'medium',
        message: `High latency detected: ${latency.toFixed(0)}ms (threshold: ${this.config.latencyThreshold}ms)`,
        timestamp: Date.now(),
        value: latency,
        threshold: this.config.latencyThreshold,
        recommendations: [
          'Check network connection quality',
          'Consider using a CDN or closer server',
          'Optimize message size and frequency',
          'Implement message compression',
        ],
      });
    }
  }

  /**
   * Check for error rate alerts
   */
  private checkErrorRateAlert(): void {
    const totalOperations = this.metrics.messagesSent + this.metrics.messagesReceived + this.metrics.totalConnections;
    const totalErrors = this.metrics.connectionErrors + this.metrics.messageErrors + this.metrics.timeoutErrors;
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    if (errorRate > this.config.errorRateThreshold) {
      this.createAlert({
        type: 'high_error_rate',
        severity: errorRate > this.config.errorRateThreshold * 2 ? 'high' : 'medium',
        message: `High error rate detected: ${errorRate.toFixed(1)}% (threshold: ${this.config.errorRateThreshold}%)`,
        timestamp: Date.now(),
        value: errorRate,
        threshold: this.config.errorRateThreshold,
        recommendations: [
          'Check server health and availability',
          'Review error logs for patterns',
          'Implement better error handling',
          'Consider connection retry strategies',
        ],
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(): void {
    // Check connection stability
    if (this.metrics.connectionStability < this.config.connectionStabilityThreshold) {
      this.createAlert({
        type: 'connection_instability',
        severity: this.metrics.connectionStability < 80 ? 'high' : 'medium',
        message: `Connection stability is low: ${this.metrics.connectionStability.toFixed(1)}% (threshold: ${this.config.connectionStabilityThreshold}%)`,
        timestamp: Date.now(),
        value: this.metrics.connectionStability,
        threshold: this.config.connectionStabilityThreshold,
        recommendations: [
          'Check network connection quality',
          'Review reconnection logic',
          'Consider increasing connection timeout',
          'Implement connection health checks',
        ],
      });
    }

    // Check memory usage
    if (this.metrics.memoryUsage > this.config.memoryUsageThreshold) {
      this.createAlert({
        type: 'memory_leak',
        severity: this.metrics.memoryUsage > this.config.memoryUsageThreshold * 2 ? 'critical' : 'high',
        message: `High memory usage detected: ${(this.metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB (threshold: ${(this.config.memoryUsageThreshold / 1024 / 1024).toFixed(1)}MB)`,
        timestamp: Date.now(),
        value: this.metrics.memoryUsage,
        threshold: this.config.memoryUsageThreshold,
        recommendations: [
          'Review message handling for memory leaks',
          'Implement proper cleanup of event listeners',
          'Consider message buffer size limits',
          'Review connection cleanup procedures',
        ],
      });
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(alert: WebSocketPerformanceAlert): void {
    this.alerts.unshift(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // Trigger callback if configured
    if (this.config.onPerformanceAlert) {
      this.config.onPerformanceAlert(alert);
    }

    // Log alert
    const logLevel = alert.severity === 'critical' ? 'error' : 
                    alert.severity === 'high' ? 'warn' : 'info';
    console[logLevel](`[WebSocketPerformanceMonitor] ${alert.type}: ${alert.message}`, {
      value: alert.value,
      threshold: alert.threshold,
      recommendations: alert.recommendations,
    });
  }

  /**
   * Record performance event
   */
  private recordEvent(event: WebSocketConnectionEvent): void {
    this.events.unshift(event);
    
    // Keep only recent events
    if (this.events.length > this.config.maxEventsToStore) {
      this.events = this.events.slice(0, this.config.maxEventsToStore);
    }
  }

  /**
   * Clean up expired events
   */
  private cleanupExpiredEvents(): void {
    const cutoff = Date.now() - this.config.metricsRetentionTime;
    this.events = this.events.filter(event => event.timestamp >= cutoff);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Get current performance metrics
   */
  getMetrics(): WebSocketPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent performance alerts
   */
  getAlerts(severity?: WebSocketPerformanceAlert['severity']): WebSocketPerformanceAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Get recent performance events
   */
  getEvents(type?: WebSocketConnectionEvent['type'], limit?: number): WebSocketConnectionEvent[] {
    let events = this.events;
    
    if (type) {
      events = events.filter(event => event.type === type);
    }
    
    if (limit) {
      events = events.slice(0, limit);
    }
    
    return events;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    healthScore: number;
    keyIssues: string[];
    recommendations: string[];
  } {
    const score = this.metrics.connectionHealthScore;
    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (score >= 90) overall = 'excellent';
    else if (score >= 75) overall = 'good';
    else if (score >= 50) overall = 'fair';
    else overall = 'poor';

    const recentAlerts = this.alerts.filter(alert => 
      Date.now() - alert.timestamp < 300000 // Last 5 minutes
    );
    
    const keyIssues = recentAlerts
      .filter(alert => alert.severity === 'high' || alert.severity === 'critical')
      .map(alert => alert.message)
      .slice(0, 5);

    const recommendations = recentAlerts
      .flatMap(alert => alert.recommendations)
      .filter((rec, index, arr) => arr.indexOf(rec) === index)
      .slice(0, 5);

    return {
      overall,
      healthScore: score,
      keyIssues,
      recommendations,
    };
  }

  /**
   * Reset all metrics and events
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.events = [];
    this.alerts = [];
    this.timers.clear();
    this.messageLatencies = [];
    this.connectionHistory = [];
  }

  /**
   * Update monitor configuration
   */
  updateConfig(newConfig: Partial<WebSocketPerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup and destroy monitor
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.reset();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global WebSocket performance monitor instance
 */
export const webSocketPerformanceMonitor = new WebSocketPerformanceMonitor();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create WebSocket performance monitor with configuration
 */
export function createWebSocketPerformanceMonitor(config?: Partial<WebSocketPerformanceConfig>): WebSocketPerformanceMonitor {
  return new WebSocketPerformanceMonitor(config);
}

/**
 * Get WebSocket performance metrics
 */
export function getWebSocketMetrics(): WebSocketPerformanceMetrics {
  return webSocketPerformanceMonitor.getMetrics();
}

/**
 * Get WebSocket performance alerts
 */
export function getWebSocketAlerts(severity?: WebSocketPerformanceAlert['severity']): WebSocketPerformanceAlert[] {
  return webSocketPerformanceMonitor.getAlerts(severity);
}

/**
 * Get WebSocket performance summary
 */
export function getWebSocketPerformanceSummary() {
  return webSocketPerformanceMonitor.getPerformanceSummary();
}

export default WebSocketPerformanceMonitor;