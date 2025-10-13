/**
 * Error Recovery and Retry Strategies
 * Provides comprehensive error recovery mechanisms for both HTTP and WebSocket errors
 */

import { 
  AppError, 
  AppHttpError, 
  AppWebSocketError,
  isAppHttpError,
  isAppWebSocketError
} from './error-system';
import { 
  ErrorRecoveryStrategy, 
  ErrorRecoveryConfig, 
  ErrorRecoveryResult,
  ErrorRecoveryHandler
} from '../http/error-types';

// =============================================================================
// RECOVERY CONFIGURATION
// =============================================================================

/**
 * Default recovery configuration
 */
const DEFAULT_RECOVERY_CONFIG: ErrorRecoveryConfig = {
  // Retry configuration
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  maxRetryDelay: 10000,
  
  // Fallback configuration
  enableFallback: false,
  fallbackTimeout: 5000,
  
  // Cache configuration
  enableCache: true,
  cacheTimeout: 300000, // 5 minutes
  
  // Queue configuration
  enableQueue: true,
  queueTimeout: 30000, // 30 seconds
  maxQueueSize: 100,
  
  // Notification configuration
  enableNotification: true,
  notificationLevel: 'error',
};

// =============================================================================
// RECOVERY MANAGER
// =============================================================================

/**
 * Centralized error recovery manager
 */
export class ErrorRecoveryManager {
  private config: ErrorRecoveryConfig;
  private retryAttempts = new Map<string, number>();
  private recoveryCache = new Map<string, { data: any; timestamp: number }>();
  private recoveryQueue = new Map<string, { 
    operation: () => Promise<any>; 
    timestamp: number; 
    priority: number;
  }>();
  private customRecoveryHandlers = new Map<ErrorRecoveryStrategy, ErrorRecoveryHandler>();

  constructor(config?: Partial<ErrorRecoveryConfig>) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.setupDefaultRecoveryHandlers();
    this.startQueueProcessor();
  }

  /**
   * Recover from an error using appropriate strategy
   */
  async recover(error: AppError, operation?: () => Promise<any>): Promise<ErrorRecoveryResult> {
    const startTime = Date.now();
    const errorKey = this.getErrorKey(error);
    
    try {
      // Get recovery strategy
      const strategy = this.determineRecoveryStrategy(error);
      
      // Get recovery handler
      const handler = this.getRecoveryHandler(strategy);
      
      if (!handler) {
        throw new Error(`No recovery handler found for strategy: ${strategy}`);
      }

      // Execute recovery
      const result = await handler(error, this.config);
      
      // Track successful recovery
      this.retryAttempts.delete(errorKey);
      
      return {
        success: true,
        data: result,
        strategy,
        attempts: this.getAttemptCount(errorKey),
        duration: Date.now() - startTime,
      };
    } catch (recoveryError) {
      // Track failed recovery
      this.incrementAttemptCount(errorKey);
      
      return {
        success: false,
        strategy: error.recoveryStrategy,
        attempts: this.getAttemptCount(errorKey),
        duration: Date.now() - startTime,
        error: recoveryError instanceof Error ? 
          new AppHttpError(
            recoveryError.message,
            'RECOVERY_FAILED',
            500,
            'server',
            'high',
            false,
            'escalate'
          ) : error,
      };
    }
  }

  /**
   * Register custom recovery handler
   */
  registerRecoveryHandler(strategy: ErrorRecoveryStrategy, handler: ErrorRecoveryHandler): void {
    this.customRecoveryHandlers.set(strategy, handler);
  }

  /**
   * Update recovery configuration
   */
  updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    activeRetries: number;
    cacheSize: number;
    queueSize: number;
    successRate: number;
  } {
    const totalAttempts = Array.from(this.retryAttempts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalAttempts,
      activeRetries: this.retryAttempts.size,
      cacheSize: this.recoveryCache.size,
      queueSize: this.recoveryQueue.size,
      successRate: 0, // Would need to track successes to calculate this
    };
  }

  /**
   * Clear recovery state
   */
  clearRecoveryState(): void {
    this.retryAttempts.clear();
    this.recoveryCache.clear();
    this.recoveryQueue.clear();
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private setupDefaultRecoveryHandlers(): void {
    // Retry handler
    this.customRecoveryHandlers.set('retry', async (error, config) => {
      return this.handleRetryRecovery(error, config);
    });

    // Refresh token handler
    this.customRecoveryHandlers.set('refresh_token', async (error, config) => {
      return this.handleTokenRefreshRecovery(error, config);
    });

    // Redirect to login handler
    this.customRecoveryHandlers.set('redirect_login', async (error, config) => {
      return this.handleLoginRedirectRecovery(error, config);
    });

    // Fallback handler
    this.customRecoveryHandlers.set('fallback', async (error, config) => {
      return this.handleFallbackRecovery(error, config);
    });

    // Cache handler
    this.customRecoveryHandlers.set('cache', async (error, config) => {
      return this.handleCacheRecovery(error, config);
    });

    // Queue handler
    this.customRecoveryHandlers.set('queue', async (error, config) => {
      return this.handleQueueRecovery(error, config);
    });

    // Notification handler
    this.customRecoveryHandlers.set('notify_user', async (error, config) => {
      return this.handleNotificationRecovery(error, config);
    });

    // Ignore handler
    this.customRecoveryHandlers.set('ignore', async (error, config) => {
      return null;
    });

    // Escalate handler
    this.customRecoveryHandlers.set('escalate', async (error, config) => {
      throw error;
    });
  }

  private determineRecoveryStrategy(error: AppError): ErrorRecoveryStrategy {
    // Use error's preferred recovery strategy
    if (error.recoveryStrategy) {
      return error.recoveryStrategy;
    }

    // Determine strategy based on error type and category
    if (isAppHttpError(error)) {
      return this.determineHttpRecoveryStrategy(error);
    } else if (isAppWebSocketError(error)) {
      return this.determineWebSocketRecoveryStrategy(error);
    }

    return 'notify_user';
  }

  private determineHttpRecoveryStrategy(error: AppHttpError): ErrorRecoveryStrategy {
    if (error.status === 401) return 'refresh_token';
    if (error.status === 403) return 'notify_user';
    if (error.retryable) return 'retry';
    return 'notify_user';
  }

  private determineWebSocketRecoveryStrategy(error: AppWebSocketError): ErrorRecoveryStrategy {
    switch (error.category) {
      case 'authentication':
        return 'refresh_token';
      case 'connection':
      case 'network':
      case 'timeout':
        return 'retry';
      case 'authorization':
        return 'notify_user';
      default:
        return error.retryable ? 'retry' : 'notify_user';
    }
  }

  private getRecoveryHandler(strategy: ErrorRecoveryStrategy): ErrorRecoveryHandler | undefined {
    return this.customRecoveryHandlers.get(strategy);
  }

  private getErrorKey(error: AppError): string {
    return `${error.code}_${error.requestId || error.correlationId || 'unknown'}`;
  }

  private getAttemptCount(errorKey: string): number {
    return this.retryAttempts.get(errorKey) || 0;
  }

  private incrementAttemptCount(errorKey: string): void {
    const current = this.getAttemptCount(errorKey);
    this.retryAttempts.set(errorKey, current + 1);
  }

  // =============================================================================
  // RECOVERY HANDLERS
  // =============================================================================

  private async handleRetryRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    const errorKey = this.getErrorKey(error);
    const attemptCount = this.getAttemptCount(errorKey);

    if (attemptCount >= config.maxRetries) {
      throw new Error(`Maximum retry attempts (${config.maxRetries}) exceeded`);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      config.retryDelay * Math.pow(config.retryMultiplier, attemptCount),
      config.maxRetryDelay
    );

    // Add jitter to prevent thundering herd
    const jitteredDelay = delay + Math.random() * 1000;

    console.log(`Retrying operation after ${jitteredDelay}ms (attempt ${attemptCount + 1}/${config.maxRetries})`);

    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, jitteredDelay));

    // Increment attempt count
    this.incrementAttemptCount(errorKey);

    // Return indication that retry should be attempted
    return { retry: true, attempt: attemptCount + 1 };
  }

  private async handleTokenRefreshRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    try {
      // Import auth client dynamically to avoid circular dependencies
      const { refreshAuthToken, getAuthToken } = await import('../auth/auth-client');
      
      const newToken = await refreshAuthToken();
      
      if (!newToken) {
        throw new Error('Token refresh failed');
      }

      console.log('Token refreshed successfully');
      return { tokenRefreshed: true, newToken };
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      
      // Redirect to login if refresh fails
      return this.handleLoginRedirectRecovery(error, config);
    }
  }

  private async handleLoginRedirectRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const loginUrl = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
      
      console.log('Redirecting to login page');
      window.location.href = loginUrl;
    }

    return { redirected: true };
  }

  private async handleFallbackRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    if (!config.enableFallback) {
      throw new Error('Fallback recovery is disabled');
    }

    // Return fallback data if available
    if (config.fallbackData) {
      console.log('Using fallback data');
      return config.fallbackData;
    }

    // Try fallback service if configured
    if (config.fallbackService) {
      try {
        console.log(`Trying fallback service: ${config.fallbackService}`);
        
        // This would be implemented based on specific fallback service
        // For now, return a placeholder
        return { fallbackUsed: true, service: config.fallbackService };
      } catch (fallbackError) {
        console.error('Fallback service failed:', fallbackError);
        throw fallbackError;
      }
    }

    throw new Error('No fallback options available');
  }

  private async handleCacheRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    if (!config.enableCache) {
      throw new Error('Cache recovery is disabled');
    }

    const cacheKey = config.cacheKey || this.getErrorKey(error);
    const cached = this.recoveryCache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      if (age < config.cacheTimeout) {
        console.log(`Using cached data (age: ${age}ms)`);
        return { ...cached.data, cacheUsed: true, cacheAge: age };
      } else {
        // Remove expired cache entry
        this.recoveryCache.delete(cacheKey);
      }
    }

    throw new Error('No valid cached data available');
  }

  private async handleQueueRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    if (!config.enableQueue) {
      throw new Error('Queue recovery is disabled');
    }

    const queueKey = this.getErrorKey(error);
    
    // Check if already queued
    if (this.recoveryQueue.has(queueKey)) {
      throw new Error('Operation already queued');
    }

    // Check queue size
    if (this.recoveryQueue.size >= config.maxQueueSize) {
      throw new Error('Recovery queue is full');
    }

    // Add to queue (operation would be provided by caller)
    const queueEntry = {
      operation: async () => {
        // Placeholder - actual operation would be provided
        return { queued: true };
      },
      timestamp: Date.now(),
      priority: error.severity === 'critical' ? 1 : error.severity === 'high' ? 2 : 3,
    };

    this.recoveryQueue.set(queueKey, queueEntry);
    
    console.log(`Operation queued for later execution (queue size: ${this.recoveryQueue.size})`);
    
    return { queueUsed: true, queuePosition: this.recoveryQueue.size };
  }

  private async handleNotificationRecovery(error: AppError, config: ErrorRecoveryConfig): Promise<any> {
    if (!config.enableNotification) {
      return null;
    }

    // Create user notification
    const notification = {
      title: 'Error Occurred',
      message: error.getUserMessage(),
      level: config.notificationLevel,
      actions: error.getUserActions(),
      timestamp: Date.now(),
    };

    // Show notification (implementation depends on notification system)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/icons/error.png',
          });
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/icons/error.png',
            });
          }
        }
      } catch (notificationError) {
        console.warn('Failed to show browser notification:', notificationError);
      }
    }

    // Also log to console for development
    console.error('Error notification:', notification);

    return { notificationShown: true, notification };
  }

  // =============================================================================
  // QUEUE PROCESSOR
  // =============================================================================

  private startQueueProcessor(): void {
    // Process queue every 5 seconds
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private async processQueue(): Promise<void> {
    if (this.recoveryQueue.size === 0) {
      return;
    }

    // Sort by priority and age
    const entries = Array.from(this.recoveryQueue.entries()).sort(([, a], [, b]) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      return a.timestamp - b.timestamp; // Older first
    });

    // Process up to 3 items at a time
    const toProcess = entries.slice(0, 3);

    for (const [key, entry] of toProcess) {
      try {
        // Check if entry has expired
        if (Date.now() - entry.timestamp > this.config.queueTimeout) {
          console.warn(`Queue entry expired: ${key}`);
          this.recoveryQueue.delete(key);
          continue;
        }

        // Execute operation
        const result = await entry.operation();
        
        // Cache result if successful
        if (this.config.enableCache) {
          this.recoveryCache.set(key, {
            data: result,
            timestamp: Date.now(),
          });
        }

        // Remove from queue
        this.recoveryQueue.delete(key);
        
        console.log(`Queue entry processed successfully: ${key}`);
      } catch (error) {
        console.error(`Queue entry failed: ${key}`, error);
        
        // Remove failed entry
        this.recoveryQueue.delete(key);
      }
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global error recovery manager instance
 */
export const errorRecoveryManager = new ErrorRecoveryManager();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Recover from error using global recovery manager
 */
export async function recoverFromError(
  error: AppError, 
  operation?: () => Promise<any>
): Promise<ErrorRecoveryResult> {
  return errorRecoveryManager.recover(error, operation);
}

/**
 * Register custom recovery handler
 */
export function registerRecoveryHandler(
  strategy: ErrorRecoveryStrategy, 
  handler: ErrorRecoveryHandler
): void {
  errorRecoveryManager.registerRecoveryHandler(strategy, handler);
}

/**
 * Update global recovery configuration
 */
export function updateRecoveryConfig(config: Partial<ErrorRecoveryConfig>): void {
  errorRecoveryManager.updateConfig(config);
}

/**
 * Get recovery statistics
 */
export function getRecoveryStats(): {
  totalAttempts: number;
  activeRetries: number;
  cacheSize: number;
  queueSize: number;
  successRate: number;
} {
  return errorRecoveryManager.getRecoveryStats();
}

/**
 * Clear all recovery state
 */
export function clearRecoveryState(): void {
  errorRecoveryManager.clearRecoveryState();
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from './error-system';
export * from '../http/error-types';