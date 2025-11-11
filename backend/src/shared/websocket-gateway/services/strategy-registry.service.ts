import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  IStrategyRegistry,
  IDeviceStrategy,
  RegistryStats,
  StrategyPerformanceMetrics,
  StrategyChangeEvent,
  StrategyHealthCheck,
  StrategyRegistrationOptions,
} from '../interfaces';
import { BaseStrategyRegistry } from '../interfaces/strategy-registry.interface';

/**
 * Strategy Registry Service
 * Manages registration and resolution of device strategies with reactive monitoring
 * Provides centralized strategy management with performance optimization
 */
@Injectable()
export class StrategyRegistryService
  extends BaseStrategyRegistry
  implements IStrategyRegistry, OnModuleInit
{
  protected readonly logger = new Logger(StrategyRegistryService.name);
  private readonly deviceStrategies = new Map<string, IDeviceStrategy>();
  private readonly strategyCache = new Map<string, IDeviceStrategy>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalRegistrations = 0;
  private totalUnregistrations = 0;

  onModuleInit(): void {
    this.logger.log('Strategy Registry initialized');
  }

  /**
   * Registers a new strategy with the registry
   */
  async registerStrategy(
    strategy: IDeviceStrategy,
    options?: StrategyRegistrationOptions,
  ): Promise<void> {
    if (!strategy || !strategy.deviceType) {
      throw new Error('Invalid device strategy: missing deviceType');
    }

    const deviceType = strategy.deviceType.toLowerCase();
    const previousState = this.deviceStrategies.has(deviceType);

    if (this.deviceStrategies.has(deviceType)) {
      this.logger.warn(
        `Overriding existing device strategy for type: ${deviceType}`,
      );
    }

    this.deviceStrategies.set(deviceType, strategy);
    this.clearCacheForStrategyType(deviceType);
    this.totalRegistrations++;

    // Update strategy state tracking
    this.strategyStates.set(deviceType, {
      registered: true,
      initialized: false,
      active: false,
      healthy: false,
      registrationTime: new Date(),
      consecutiveFailures: 0,
    });

    // Emit strategy change event
    this.emitStrategyEvent({
      type: 'registered',
      deviceType,
      timestamp: new Date(),
      metadata: { strategyName: strategy.constructor.name },
      previousState: previousState
        ? {
            registered: true,
            active: this.strategyStates.get(deviceType)?.active || false,
          }
        : undefined,
      currentState: {
        registered: true,
        active: false,
      },
    });

    // Auto-initialize if requested
    if (options?.autoInitialize) {
      try {
        await this.initializeStrategy(deviceType);
      } catch (error) {
        this.logger.error(
          `Failed to auto-initialize strategy ${deviceType}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Device strategy registered: ${deviceType} (${strategy.constructor.name})`,
    );
  }

  /**
   * Retrieves a strategy by device type
   */
  getStrategy(deviceType: string): IDeviceStrategy | undefined {
    const cacheKey = `device:${deviceType.toLowerCase()}`;

    // Check cache first
    if (this.strategyCache.has(cacheKey)) {
      this.cacheHits++;
      return this.strategyCache.get(cacheKey) as IDeviceStrategy;
    }

    // Resolve from registry
    const strategy = this.deviceStrategies.get(deviceType.toLowerCase());

    // Cache the result (even if undefined to avoid repeated lookups)
    this.strategyCache.set(cacheKey, strategy as IDeviceStrategy);
    this.cacheMisses++;

    if (!strategy) {
      this.logger.warn(`Device strategy not found: ${deviceType}`);
    }

    return strategy;
  }

  /**
   * Gets all registered device types
   */
  getSupportedDeviceTypes(): readonly string[] {
    return Array.from(this.deviceStrategies.keys());
  }

  /**
   * Gets all registered strategies
   */
  getRegisteredStrategies(): readonly IDeviceStrategy[] {
    return Array.from(this.deviceStrategies.values());
  }

  /**
   * Gets active strategies (initialized and healthy)
   */
  getActiveStrategies(): readonly IDeviceStrategy[] {
    return Array.from(this.deviceStrategies.values()).filter((strategy) => {
      const state = this.strategyStates.get(strategy.deviceType.toLowerCase());
      return state?.initialized && state?.active && state?.healthy;
    });
  }

  /**
   * Unregisters a strategy by device type
   */
  async unregisterStrategy(deviceType: string): Promise<boolean> {
    const normalizedType = deviceType.toLowerCase();
    const strategy = this.deviceStrategies.get(normalizedType);

    if (!strategy) {
      return false;
    }

    // Dispose strategy if it has cleanup methods
    if (typeof (strategy as any).dispose === 'function') {
      try {
        await (strategy as any).dispose();
      } catch (error) {
        this.logger.error(`Error disposing strategy ${normalizedType}:`, error);
      }
    }

    const removed = this.deviceStrategies.delete(normalizedType);

    if (removed) {
      this.clearCacheForStrategyType(normalizedType);
      this.totalUnregistrations++;

      // Update strategy state
      const previousState = this.strategyStates.get(normalizedType);
      this.strategyStates.delete(normalizedType);

      // Emit strategy change event
      this.emitStrategyEvent({
        type: 'unregistered',
        deviceType: normalizedType,
        timestamp: new Date(),
        metadata: { strategyName: strategy.constructor.name },
        previousState: previousState
          ? {
              registered: true,
              active: previousState.active,
            }
          : undefined,
        currentState: {
          registered: false,
          active: false,
        },
      });

      this.logger.log(`Device strategy unregistered: ${deviceType}`);
    }

    return removed;
  }

  /**
   * Checks if a strategy is registered
   */
  isStrategyRegistered(deviceType: string): boolean {
    return this.deviceStrategies.has(deviceType.toLowerCase());
  }

  /**
   * Checks if a strategy is active (initialized and healthy)
   */
  isStrategyActive(deviceType: string): boolean {
    const state = this.strategyStates.get(deviceType.toLowerCase());
    return (
      state?.initialized === true &&
      state?.active === true &&
      state?.healthy === true
    );
  }

  /**
   * Gets registry statistics
   */
  getRegistryStats(): RegistryStats {
    const activeStrategies = this.getActiveStrategies();

    return {
      totalStrategies: this.deviceStrategies.size,
      registeredStrategies: this.getSupportedDeviceTypes(),
      activeStrategies: activeStrategies.map((s) => s.deviceType),
      lastUpdated: new Date(),
      totalRegistrations: this.totalRegistrations,
      totalUnregistrations: this.totalUnregistrations,
    };
  }

  /**
   * Gets performance metrics for all strategies or a specific strategy
   */
  getStrategyMetrics(): readonly StrategyPerformanceMetrics[];
  getStrategyMetrics(
    deviceType: string,
  ): StrategyPerformanceMetrics | undefined;
  getStrategyMetrics(
    deviceType?: string,
  ):
    | readonly StrategyPerformanceMetrics[]
    | StrategyPerformanceMetrics
    | undefined {
    if (deviceType) {
      return Array.from(this.deviceStrategies.values())
        .map((strategy) => ({
          deviceType: strategy.deviceType,
          totalCommands: 0, // TODO: Implement command tracking
          averageProcessingTime: 0, // TODO: Implement timing
          successRate: 100, // TODO: Calculate from actual data
          commandsPerSecond: 0, // TODO: Calculate from actual data
          memoryUsage: 0, // TODO: Implement memory tracking
          activeConnections: 0, // TODO: Implement connection tracking
          uptime:
            Date.now() -
            (this.strategyStates
              .get(strategy.deviceType.toLowerCase())
              ?.registrationTime.getTime() || Date.now()),
        }))
        .find((metrics) => metrics.deviceType === deviceType.toLowerCase());
    }

    return Array.from(this.deviceStrategies.values()).map((strategy) => ({
      deviceType: strategy.deviceType,
      totalCommands: 0, // TODO: Implement command tracking
      averageProcessingTime: 0, // TODO: Implement timing
      successRate: 100, // TODO: Calculate from actual data
      commandsPerSecond: 0, // TODO: Calculate from actual data
      memoryUsage: 0, // TODO: Implement memory tracking
      activeConnections: 0, // TODO: Implement connection tracking
      uptime:
        Date.now() -
        (this.strategyStates
          .get(strategy.deviceType.toLowerCase())
          ?.registrationTime.getTime() || Date.now()),
    }));
  }

  /**
   * Performs health check on all registered strategies or a specific strategy
   */
  async performHealthCheck(): Promise<readonly StrategyHealthCheck[]>;
  async performHealthCheck(deviceType: string): Promise<StrategyHealthCheck>;
  async performHealthCheck(
    deviceType?: string,
  ): Promise<StrategyHealthCheck | readonly StrategyHealthCheck[]> {
    if (deviceType) {
      return this.performSingleStrategyHealthCheck(deviceType);
    }

    return this.performAllStrategiesHealthCheck();
  }

  private async performAllStrategiesHealthCheck(): Promise<
    readonly StrategyHealthCheck[]
  > {
    const healthChecks: StrategyHealthCheck[] = [];

    for (const [deviceType, strategy] of this.deviceStrategies) {
      try {
        const healthCheck =
          await this.performSingleStrategyHealthCheck(deviceType);
        healthChecks.push(healthCheck);
      } catch (error) {
        this.logger.error(
          `Health check failed for strategy ${deviceType}:`,
          error,
        );
        healthChecks.push({
          deviceType,
          healthy: false,
          status: 'error',
          lastCheck: new Date(),
          nextCheck: new Date(Date.now() + 60000), // Retry in 1 minute
          consecutiveFailures:
            (this.strategyStates.get(deviceType)?.consecutiveFailures || 0) + 1,
          dependencies: {},
        });
      }
    }

    this.updateHealthChecks(healthChecks);
    return healthChecks;
  }

  private async performSingleStrategyHealthCheck(
    deviceType: string,
  ): Promise<StrategyHealthCheck> {
    const normalizedType = deviceType.toLowerCase();
    const strategy = this.deviceStrategies.get(normalizedType);

    if (!strategy) {
      throw new Error(`Strategy not found: ${deviceType}`);
    }

    const now = new Date();
    const state = this.strategyStates.get(normalizedType);
    let healthy = true;
    let status = 'healthy';
    let consecutiveFailures = state?.consecutiveFailures || 0;

    try {
      // Basic health check - verify strategy has required methods
      const requiredMethods = [
        'validateCommand',
        'processCommand',
        'broadcastUpdate',
        'getDeviceCapabilities',
      ];
      for (const method of requiredMethods) {
        if (typeof (strategy as any)[method] !== 'function') {
          throw new Error(`Missing required method: ${method}`);
        }
      }

      // Update state if healthy
      if (state) {
        state.healthy = true;
        state.lastHealthCheck = now;
        state.consecutiveFailures = 0;
      }
    } catch (error) {
      healthy = false;
      status = 'unhealthy';
      consecutiveFailures++;

      if (state) {
        state.healthy = false;
        state.lastHealthCheck = now;
        state.consecutiveFailures = consecutiveFailures;
      }

      this.logger.error(
        `Health check failed for strategy ${deviceType}:`,
        error,
      );
    }

    return {
      deviceType: normalizedType,
      healthy,
      status,
      lastCheck: now,
      nextCheck: new Date(now.getTime() + 60000), // Next check in 1 minute
      consecutiveFailures,
      dependencies: {}, // TODO: Implement dependency tracking
    };
  }

  /**
   * Gets strategy by device type with type safety (throws if not found)
   */
  requireStrategy(deviceType: string): IDeviceStrategy {
    const strategy = this.getStrategy(deviceType);
    if (!strategy) {
      throw new Error(`Required strategy not found: ${deviceType}`);
    }
    return strategy;
  }

  /**
   * Initializes all registered strategies
   */
  async initializeAllStrategies(): Promise<void> {
    const initPromises = Array.from(this.deviceStrategies.keys()).map(
      (deviceType) =>
        this.initializeStrategy(deviceType).catch((error) => {
          this.logger.error(
            `Failed to initialize strategy ${deviceType}:`,
            error,
          );
        }),
    );

    await Promise.allSettled(initPromises);
  }

  /**
   * Disposes all registered strategies
   */
  async disposeAllStrategies(): Promise<void> {
    const disposePromises = Array.from(this.deviceStrategies.entries()).map(
      async ([deviceType, strategy]) => {
        try {
          if (typeof (strategy as any).dispose === 'function') {
            await (strategy as any).dispose();
          }
          this.strategyStates.delete(deviceType);
        } catch (error) {
          this.logger.error(`Error disposing strategy ${deviceType}:`, error);
        }
      },
    );

    await Promise.allSettled(disposePromises);
    this.deviceStrategies.clear();
    this.clearCache();
  }

  /**
   * Clears all metrics and resets counters
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalRegistrations = 0;
    this.totalUnregistrations = 0;

    // Reset metrics subject
    this.metricsSubject.next([]);

    this.logger.debug('Metrics reset');
  }

  /**
   * Exports registry state for backup/restore
   */
  async exportState(): Promise<{
    readonly strategies: Array<{
      readonly deviceType: string;
      readonly displayName: string;
      readonly registeredAt: Date;
      readonly metrics: StrategyPerformanceMetrics;
    }>;
    readonly stats: RegistryStats;
  }> {
    const strategies = Array.from(this.deviceStrategies.values()).map(
      (strategy) => ({
        deviceType: strategy.deviceType,
        displayName: strategy.displayName,
        registeredAt:
          this.strategyStates.get(strategy.deviceType.toLowerCase())
            ?.registrationTime || new Date(),
        metrics: (this.getStrategyMetrics(
          strategy.deviceType,
        ) as StrategyPerformanceMetrics) || {
          deviceType: strategy.deviceType,
          totalCommands: 0,
          averageProcessingTime: 0,
          successRate: 100,
          commandsPerSecond: 0,
          memoryUsage: 0,
          activeConnections: 0,
          uptime: 0,
        },
      }),
    );

    return {
      strategies,
      stats: this.getRegistryStats(),
    };
  }

  /**
   * Imports registry state from backup
   */
  async importState(state: {
    readonly strategies: Array<{
      readonly deviceType: string;
      readonly displayName: string;
      readonly registeredAt: Date;
      readonly metrics: StrategyPerformanceMetrics;
    }>;
    readonly stats: RegistryStats;
  }): Promise<void> {
    // Clear current state
    await this.disposeAllStrategies();

    // TODO: Implement strategy recreation from exported state
    // This would require strategy factory or serialization mechanism
    this.logger.warn(
      'State import not fully implemented - strategies need to be registered manually',
    );
  }

  /**
   * Initializes a specific strategy
   */
  private async initializeStrategy(deviceType: string): Promise<void> {
    const strategy = this.deviceStrategies.get(deviceType.toLowerCase());
    if (!strategy) {
      throw new Error(`Strategy not found: ${deviceType}`);
    }

    const state = this.strategyStates.get(deviceType.toLowerCase());
    if (state?.initialized) {
      return; // Already initialized
    }

    try {
      // Call initialize method if strategy has one
      if (typeof (strategy as any).initialize === 'function') {
        await (strategy as any).initialize();
      }

      // Update state
      if (state) {
        state.initialized = true;
        state.active = true;
        state.initializationTime = new Date();
      }

      this.logger.debug(`Strategy initialized: ${deviceType}`);
    } catch (error) {
      this.logger.error(`Failed to initialize strategy ${deviceType}:`, error);
      throw error;
    }
  }

  /**
   * Clears cache for a specific strategy type
   */
  private clearCacheForStrategyType(type: string): void {
    const cacheKey = `device:${type}`;
    this.strategyCache.delete(cacheKey);
  }

  /**
   * Clears strategy cache
   */
  private clearCache(): void {
    this.strategyCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.debug('Strategy cache cleared');
  }
}
