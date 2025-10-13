/**
 * Error Monitoring and Logging System
 * Provides comprehensive error tracking, monitoring, and analytics
 */

import { 
  AppError, 
  AppHttpError, 
  AppWebSocketError,
  isAppError,
  isAppHttpError,
  isAppWebSocketError
} from './error-system';
import {
  ErrorCategory,
  ErrorSeverity,
  ErrorStatistics,
  ErrorMonitoringConfig,
  ErrorAggregationRule,
  ErrorThreshold,
} from '../http/error-types';
import { WebSocketErrorCategory } from '../websocket/websocket-types';

// =============================================================================
// MONITORING CONFIGURATION
// =============================================================================

/**
 * Default monitoring configuration
 */
const DEFAULT_MONITORING_CONFIG: ErrorMonitoringConfig = {
  // Collection settings
  enableCollection: true,
  sampleRate: 1.0, // Collect 100% of errors
  maxErrors: 1000, // Keep last 1000 errors
  
  // Filtering
  excludeCategories: [],
  includeSeverities: ['low', 'medium', 'high', 'critical'],
  excludeUrls: ['/health', '/ping'],
  
  // Aggregation
  aggregationInterval: 60000, // 1 minute
  aggregationRules: [
    {
      name: 'error_count_by_category',
      groupBy: ['category'],
      timeWindow: 300000, // 5 minutes
      aggregateFunction: 'count',
      threshold: 10,
    },
    {
      name: 'error_rate_by_url',
      groupBy: ['url'],
      timeWindow: 300000,
      aggregateFunction: 'rate',
      threshold: 0.1, // 10% error rate
    },
  ],
  
  // Reporting
  enableReporting: true,
  reportingInterval: 300000, // 5 minutes
};

// =============================================================================
// ERROR STORAGE
// =============================================================================

/**
 * Error entry for storage and analysis
 */
interface ErrorEntry {
  id: string;
  error: AppError;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  resolution?: string;
  occurrenceCount: number;
  firstOccurrence: number;
  lastOccurrence: number;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Aggregated error data
 */
interface AggregatedErrorData {
  key: string;
  count: number;
  rate: number;
  firstSeen: number;
  lastSeen: number;
  errors: string[]; // Error IDs
  metadata: Record<string, any>;
}

// =============================================================================
// ERROR MONITOR
// =============================================================================

/**
 * Comprehensive error monitoring system
 */
export class ErrorMonitor {
  private config: ErrorMonitoringConfig;
  private errors = new Map<string, ErrorEntry>();
  private aggregatedData = new Map<string, AggregatedErrorData>();
  private thresholds = new Map<string, ErrorThreshold>();
  private reportingInterval?: NodeJS.Timeout;
  private aggregationInterval?: NodeJS.Timeout;
  private errorSequence = 0;

  constructor(config?: Partial<ErrorMonitoringConfig>) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.setupIntervals();
    this.setupDefaultThresholds();
  }

  /**
   * Record an error for monitoring
   */
  recordError(error: AppError): string {
    if (!this.shouldCollectError(error)) {
      return '';
    }

    const errorId = this.generateErrorId(error);
    const existingEntry = this.errors.get(errorId);

    if (existingEntry) {
      // Update existing error
      existingEntry.occurrenceCount++;
      existingEntry.lastOccurrence = Date.now();
      existingEntry.error = error; // Update with latest error instance
    } else {
      // Create new error entry
      const entry: ErrorEntry = {
        id: errorId,
        error,
        timestamp: Date.now(),
        resolved: false,
        occurrenceCount: 1,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        tags: this.generateErrorTags(error),
        metadata: this.extractErrorMetadata(error),
      };

      this.errors.set(errorId, entry);
    }

    // Trigger callbacks
    if (this.config.onError) {
      try {
        this.config.onError(error);
      } catch (callbackError) {
        console.error('Error in onError callback:', callbackError);
      }
    }

    // Check thresholds
    this.checkThresholds(error);

    // Cleanup old errors if needed
    this.cleanupOldErrors();

    // Log error
    this.logError(error);

    return errorId;
  }

  /**
   * Mark an error as resolved
   */
  resolveError(errorId: string, resolution: string): boolean {
    const entry = this.errors.get(errorId);
    
    if (!entry) {
      return false;
    }

    entry.resolved = true;
    entry.resolvedAt = Date.now();
    entry.resolution = resolution;

    // Trigger callback
    if (this.config.onErrorResolved) {
      try {
        this.config.onErrorResolved(entry.error, resolution);
      } catch (callbackError) {
        console.error('Error in onErrorResolved callback:', callbackError);
      }
    }

    return true;
  }

  /**
   * Get error statistics
   */
  getStatistics(timeRange?: { start: number; end: number }): ErrorStatistics {
    const now = Date.now();
    const start = timeRange?.start || (now - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = timeRange?.end || now;

    const relevantErrors = Array.from(this.errors.values()).filter(
      entry => entry.timestamp >= start && entry.timestamp <= end
    );

    const totalErrors = relevantErrors.reduce((sum, entry) => sum + entry.occurrenceCount, 0);
    const uniqueErrors = relevantErrors.length;
    const resolvedErrors = relevantErrors.filter(entry => entry.resolved).length;

    // Categorize errors
    const errorsByCategory: Record<ErrorCategory | WebSocketErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const errorsByStatus: Record<number, number> = {};

    relevantErrors.forEach(entry => {
      const error = entry.error;
      
      // By category
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + entry.occurrenceCount;
      
      // By severity
      errorsBySeverity[error.severity] += entry.occurrenceCount;
      
      // By status (for HTTP errors)
      if (isAppHttpError(error)) {
        errorsByStatus[error.status] = (errorsByStatus[error.status] || 0) + entry.occurrenceCount;
      }
    });

    // Calculate resolution time
    const resolvedErrorsWithTime = relevantErrors.filter(
      entry => entry.resolved && entry.resolvedAt
    );
    const averageResolutionTime = resolvedErrorsWithTime.length > 0
      ? resolvedErrorsWithTime.reduce(
          (sum, entry) => sum + (entry.resolvedAt! - entry.firstOccurrence),
          0
        ) / resolvedErrorsWithTime.length
      : 0;

    // Calculate error rate
    const timeSpan = end - start;
    const errorRate = timeSpan > 0 ? (totalErrors / (timeSpan / 1000)) : 0;

    // Determine trend
    const midPoint = start + (timeSpan / 2);
    const firstHalfErrors = relevantErrors.filter(
      entry => entry.timestamp < midPoint
    ).reduce((sum, entry) => sum + entry.occurrenceCount, 0);
    const secondHalfErrors = relevantErrors.filter(
      entry => entry.timestamp >= midPoint
    ).reduce((sum, entry) => sum + entry.occurrenceCount, 0);

    let errorTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondHalfErrors > firstHalfErrors * 1.1) {
      errorTrend = 'increasing';
    } else if (secondHalfErrors < firstHalfErrors * 0.9) {
      errorTrend = 'decreasing';
    }

    // Top errors
    const topErrors = relevantErrors
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 10)
      .map(entry => ({
        error: `${entry.error.code}: ${entry.error.message}`,
        count: entry.occurrenceCount,
        percentage: totalErrors > 0 ? (entry.occurrenceCount / totalErrors) * 100 : 0,
      }));

    return {
      totalErrors,
      uniqueErrors,
      resolvedErrors,
      errorsByCategory,
      errorsBySeverity,
      errorsByStatus,
      averageResolutionTime,
      errorRate,
      errorTrend,
      topErrors,
      timeRange: { start, end },
    };
  }

  /**
   * Get aggregated error data
   */
  getAggregatedData(): Map<string, AggregatedErrorData> {
    return new Map(this.aggregatedData);
  }

  /**
   * Add error threshold
   */
  addThreshold(threshold: ErrorThreshold): void {
    this.thresholds.set(threshold.name, threshold);
  }

  /**
   * Remove error threshold
   */
  removeThreshold(name: string): void {
    this.thresholds.delete(name);
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<ErrorMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart intervals if needed
    this.setupIntervals();
  }

  /**
   * Export error data for external analysis
   */
  exportErrorData(format: 'json' | 'csv' = 'json'): string {
    const errors = Array.from(this.errors.values());
    
    if (format === 'csv') {
      return this.exportToCsv(errors);
    } else {
      return JSON.stringify(errors, null, 2);
    }
  }

  /**
   * Clear all error data
   */
  clearErrorData(): void {
    this.errors.clear();
    this.aggregatedData.clear();
  }

  /**
   * Destroy monitor and cleanup resources
   */
  destroy(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    
    this.clearErrorData();
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private shouldCollectError(error: AppError): boolean {
    // Check if collection is enabled
    if (!this.config.enableCollection) {
      return false;
    }

    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      return false;
    }

    // Check excluded categories
    if (this.config.excludeCategories?.includes(error.category as any)) {
      return false;
    }

    // Check included severities
    if (this.config.includeSeverities && 
        !this.config.includeSeverities.includes(error.severity)) {
      return false;
    }

    // Check excluded URLs (for HTTP errors)
    if (isAppHttpError(error) && error.context?.url) {
      const url = error.context.url;
      if (this.config.excludeUrls?.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(url);
        }
        return url.includes(pattern);
      })) {
        return false;
      }
    }

    return true;
  }

  private generateErrorId(error: AppError): string {
    // Generate ID based on error characteristics for deduplication
    const components = [
      error.code,
      error.category,
      error.message.substring(0, 100), // First 100 chars of message
    ];

    // Add HTTP-specific components
    if (isAppHttpError(error)) {
      components.push(
        String(error.status),
        error.context?.url || '',
        error.context?.method || ''
      );
    }

    // Add WebSocket-specific components
    if (isAppWebSocketError(error)) {
      components.push(
        error.connectionId || '',
        error.messageId || ''
      );
    }

    // Create hash-like ID
    const combined = components.join('|');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `err_${Math.abs(hash).toString(36)}`;
  }

  private generateErrorTags(error: AppError): string[] {
    const tags: string[] = [
      `category:${error.category}`,
      `severity:${error.severity}`,
      `retryable:${error.retryable}`,
    ];

    if (isAppHttpError(error)) {
      tags.push(`type:http`, `status:${error.status}`);
      
      if (error.context?.method) {
        tags.push(`method:${error.context.method}`);
      }
    }

    if (isAppWebSocketError(error)) {
      tags.push(`type:websocket`);
      
      if (error.connectionId) {
        tags.push(`connection:${error.connectionId}`);
      }
    }

    return tags;
  }

  private extractErrorMetadata(error: AppError): Record<string, any> {
    const metadata: Record<string, any> = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable,
      recoveryStrategy: error.recoveryStrategy,
      timestamp: error.timestamp,
    };

    if (error.context) {
      metadata.context = {
        url: error.context.url,
        method: error.context.method,
        userAgent: error.context.userAgent,
      };
    }

    if (error.userContext) {
      metadata.userContext = {
        userRole: error.userContext.userRole,
        deviceType: error.userContext.deviceInfo?.type,
        os: error.userContext.deviceInfo?.os,
        browser: error.userContext.deviceInfo?.browser,
      };
    }

    return metadata;
  }

  private checkThresholds(error: AppError): void {
    for (const threshold of this.thresholds.values()) {
      if (this.matchesThresholdCondition(error, threshold.condition)) {
        // Count recent errors matching this condition
        const now = Date.now();
        const windowStart = now - threshold.timeWindow;
        
        const matchingErrors = Array.from(this.errors.values()).filter(entry => 
          entry.lastOccurrence >= windowStart &&
          this.matchesThresholdCondition(entry.error, threshold.condition)
        );

        const totalCount = matchingErrors.reduce((sum, entry) => sum + entry.occurrenceCount, 0);

        if (totalCount >= threshold.threshold) {
          console.warn(`Error threshold exceeded: ${threshold.name} (${totalCount}/${threshold.threshold})`);
          
          if (this.config.onThresholdExceeded) {
            try {
              this.config.onThresholdExceeded(threshold);
            } catch (callbackError) {
              console.error('Error in onThresholdExceeded callback:', callbackError);
            }
          }
        }
      }
    }
  }

  private matchesThresholdCondition(error: AppError, condition: any): boolean {
    // Simplified condition matching - in a real implementation,
    // this would be more sophisticated
    if (condition.category && error.category !== condition.category) {
      return false;
    }
    
    if (condition.severity && error.severity !== condition.severity) {
      return false;
    }
    
    if (condition.code && error.code !== condition.code) {
      return false;
    }

    return true;
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.config.maxErrors) {
      return;
    }

    // Remove oldest errors
    const entries = Array.from(this.errors.entries());
    entries.sort(([, a], [, b]) => a.firstOccurrence - b.firstOccurrence);

    const toRemove = entries.slice(0, entries.length - this.config.maxErrors);
    toRemove.forEach(([id]) => this.errors.delete(id));
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logData = error.toLogObject();

    // Log to console
    console[logLevel](`[ErrorMonitor] ${error.code}: ${error.message}`, logData);

    // Send to external logging service if configured
    if (this.config.reportingEndpoint) {
      this.sendToLoggingService(error, logData);
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }

  private async sendToLoggingService(error: AppError, logData: any): Promise<void> {
    try {
      const response = await fetch(this.config.reportingEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          level: this.getLogLevel(error.severity),
          error: logData,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to send error to logging service:', response.statusText);
      }
    } catch (loggingError) {
      console.warn('Error sending to logging service:', loggingError);
    }
  }

  private setupIntervals(): void {
    // Clear existing intervals
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    // Setup reporting interval
    if (this.config.enableReporting && this.config.reportingInterval > 0) {
      this.reportingInterval = setInterval(() => {
        this.generateReport();
      }, this.config.reportingInterval);
    }

    // Setup aggregation interval
    if (this.config.aggregationInterval > 0) {
      this.aggregationInterval = setInterval(() => {
        this.aggregateErrors();
      }, this.config.aggregationInterval);
    }
  }

  private generateReport(): void {
    const stats = this.getStatistics();
    
    console.log('[ErrorMonitor] Periodic Report:', {
      totalErrors: stats.totalErrors,
      uniqueErrors: stats.uniqueErrors,
      errorRate: stats.errorRate.toFixed(4),
      trend: stats.errorTrend,
      topErrors: stats.topErrors.slice(0, 3),
    });

    // Send report to external service if configured
    if (this.config.reportingEndpoint) {
      this.sendReportToService(stats);
    }
  }

  private async sendReportToService(stats: ErrorStatistics): Promise<void> {
    try {
      const response = await fetch(`${this.config.reportingEndpoint}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          type: 'error_statistics',
          data: stats,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to send report to service:', response.statusText);
      }
    } catch (reportingError) {
      console.warn('Error sending report to service:', reportingError);
    }
  }

  private aggregateErrors(): void {
    const now = Date.now();
    
    this.config.aggregationRules.forEach(rule => {
      const windowStart = now - rule.timeWindow;
      const relevantErrors = Array.from(this.errors.values()).filter(
        entry => entry.lastOccurrence >= windowStart
      );

      // Group errors by specified fields
      const groups = new Map<string, ErrorEntry[]>();
      
      relevantErrors.forEach(entry => {
        const groupKey = rule.groupBy.map(field => {
          switch (field) {
            case 'category':
              return entry.error.category;
            case 'status':
              return isAppHttpError(entry.error) ? String(entry.error.status) : 'N/A';
            case 'url':
              return entry.error.context?.url || 'unknown';
            case 'user':
              return entry.error.userContext?.userId || 'anonymous';
            default:
              return 'unknown';
          }
        }).join('|');

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(entry);
      });

      // Calculate aggregated values
      groups.forEach((entries, key) => {
        const count = entries.reduce((sum, entry) => sum + entry.occurrenceCount, 0);
        const rate = rule.timeWindow > 0 ? count / (rule.timeWindow / 1000) : 0;
        
        const aggregated: AggregatedErrorData = {
          key,
          count,
          rate,
          firstSeen: Math.min(...entries.map(e => e.firstOccurrence)),
          lastSeen: Math.max(...entries.map(e => e.lastOccurrence)),
          errors: entries.map(e => e.id),
          metadata: {
            rule: rule.name,
            timeWindow: rule.timeWindow,
            aggregatedAt: now,
          },
        };

        this.aggregatedData.set(`${rule.name}:${key}`, aggregated);
      });
    });
  }

  private setupDefaultThresholds(): void {
    // High error rate threshold
    this.addThreshold({
      name: 'high_error_rate',
      condition: { severity: 'high' },
      threshold: 10,
      timeWindow: 300000, // 5 minutes
      action: 'alert',
    });

    // Critical error threshold
    this.addThreshold({
      name: 'critical_errors',
      condition: { severity: 'critical' },
      threshold: 1,
      timeWindow: 60000, // 1 minute
      action: 'alert',
    });

    // Authentication failure threshold
    this.addThreshold({
      name: 'auth_failures',
      condition: { category: 'authentication' },
      threshold: 5,
      timeWindow: 300000, // 5 minutes
      action: 'circuit_breaker',
    });
  }

  private exportToCsv(errors: ErrorEntry[]): string {
    const headers = [
      'ID',
      'Code',
      'Message',
      'Category',
      'Severity',
      'Timestamp',
      'Occurrences',
      'Resolved',
      'Resolution',
    ];

    const rows = errors.map(entry => [
      entry.id,
      entry.error.code,
      entry.error.message.replace(/"/g, '""'), // Escape quotes
      entry.error.category,
      entry.error.severity,
      new Date(entry.timestamp).toISOString(),
      entry.occurrenceCount,
      entry.resolved,
      entry.resolution || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global error monitor instance
 */
export const errorMonitor = new ErrorMonitor();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Record an error for monitoring
 */
export function recordError(error: AppError): string {
  return errorMonitor.recordError(error);
}

/**
 * Mark an error as resolved
 */
export function resolveError(errorId: string, resolution: string): boolean {
  return errorMonitor.resolveError(errorId, resolution);
}

/**
 * Get error statistics
 */
export function getErrorStatistics(timeRange?: { start: number; end: number }): ErrorStatistics {
  return errorMonitor.getStatistics(timeRange);
}

/**
 * Add error threshold
 */
export function addErrorThreshold(threshold: ErrorThreshold): void {
  errorMonitor.addThreshold(threshold);
}

/**
 * Update monitoring configuration
 */
export function updateMonitoringConfig(config: Partial<ErrorMonitoringConfig>): void {
  errorMonitor.updateConfig(config);
}

/**
 * Export error data
 */
export function exportErrorData(format: 'json' | 'csv' = 'json'): string {
  return errorMonitor.exportErrorData(format);
}

/**
 * Clear all error data
 */
export function clearErrorData(): void {
  errorMonitor.clearErrorData();
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from './error-system';
export * from './error-recovery';
export * from '../http/error-types';