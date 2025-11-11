import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, filter, distinctUntilChanged, share } from 'rxjs/operators';
import {
  IDeviceStrategy,
  StrategyEvent,
} from '../../../devices/websocket/interfaces/device-strategy.interface';

/**
 * Registry statistics information
 */
export interface RegistryStats {
  readonly totalStrategies: number;
  readonly registeredStrategies: readonly string[];
  readonly activeStrategies: readonly string[];
  readonly lastUpdated: Date;
  readonly totalRegistrations: number;
  readonly totalUnregistrations: number;
}

/**
 * Strategy performance metrics
 */
export interface StrategyPerformanceMetrics {
  readonly deviceType: string;
  readonly totalCommands: number;
  readonly averageProcessingTime: number;
  readonly successRate: number;
  readonly commandsPerSecond: number;
  readonly memoryUsage: number;
  readonly activeConnections: number;
  readonly lastCommandAt?: Date;
  readonly uptime: number;
}

/**
 * Strategy change event for reactive updates
 */
export interface StrategyChangeEvent extends StrategyEvent {
  readonly previousState?: {
    readonly registered: boolean;
    readonly active: boolean;
  };
  readonly currentState: {
    readonly registered: boolean;
    readonly active: boolean;
  };
}

/**
 * Strategy registration options
 */
export interface StrategyRegistrationOptions {
  readonly priority?: number;
  readonly autoInitialize?: boolean;
  readonly healthCheckInterval?: number;
  readonly maxRetries?: number;
  readonly retryDelay?: number;
}

/**
 * Strategy health check result
 */
export interface StrategyHealthCheck {
  readonly deviceType: string;
  readonly healthy: boolean;
  readonly status: string;
  readonly lastCheck: Date;
  readonly nextCheck: Date;
  readonly consecutiveFailures: number;
  readonly dependencies: Record<
    string,
    {
      readonly available: boolean;
      readonly lastCheck: Date;
      readonly responseTime?: number;
      readonly error?: string;
    }
  >;
}

/**
 * Main strategy registry interface
 * Manages device strategy lifecycle with reactive monitoring
 */
export interface IStrategyRegistry {
  /**
   * Registers a new strategy with the registry
   * @param strategy Strategy instance to register
   * @param options Registration options
   * @returns Promise resolving when registration is complete
   */
  registerStrategy(
    strategy: IDeviceStrategy,
    options?: StrategyRegistrationOptions,
  ): Promise<void>;

  /**
   * Retrieves a strategy by device type
   * @param deviceType Device type identifier
   * @returns Strategy instance or undefined if not found
   */
  getStrategy(deviceType: string): IDeviceStrategy | undefined;

  /**
   * Gets all registered device types
   * @returns Array of registered device type strings
   */
  getSupportedDeviceTypes(): readonly string[];

  /**
   * Gets all registered strategies
   * @returns Array of registered strategy instances
   */
  getRegisteredStrategies(): readonly IDeviceStrategy[];

  /**
   * Gets active strategies (initialized and healthy)
   * @returns Array of active strategy instances
   */
  getActiveStrategies(): readonly IDeviceStrategy[];

  /**
   * Unregisters a strategy by device type
   * @param deviceType Device type to unregister
   * @returns Promise resolving with unregistration success status
   */
  unregisterStrategy(deviceType: string): Promise<boolean>;

  /**
   * Checks if a strategy is registered
   * @param deviceType Device type to check
   * @returns True if strategy is registered
   */
  isStrategyRegistered(deviceType: string): boolean;

  /**
   * Checks if a strategy is active (initialized and healthy)
   * @param deviceType Device type to check
   * @returns True if strategy is active
   */
  isStrategyActive(deviceType: string): boolean;

  /**
   * Gets registry statistics
   * @returns Current registry statistics
   */
  getRegistryStats(): RegistryStats;

  /**
   * Gets performance metrics for all strategies
   * @returns Array of strategy performance metrics
   */
  getStrategyMetrics(): readonly StrategyPerformanceMetrics[];

  /**
   * Gets performance metrics for a specific strategy
   * @param deviceType Device type identifier
   * @returns Strategy performance metrics or undefined if not found
   */
  getStrategyMetrics(
    deviceType: string,
  ): StrategyPerformanceMetrics | undefined;

  /**
   * Gets observable stream of strategy change events
   * @returns Observable of strategy change events
   */
  watchStrategyChanges(): Observable<StrategyChangeEvent>;

  /**
   * Gets observable stream of strategy metrics
   * @param deviceType Optional device type identifier for specific strategy metrics
   * @returns Observable of strategy performance metrics updates (all strategies or specific strategy)
   */
  watchStrategyMetrics(
    deviceType: string,
  ): Observable<StrategyPerformanceMetrics>;
  watchStrategyMetrics(): Observable<readonly StrategyPerformanceMetrics[]>;
  watchStrategyMetrics(
    deviceType?: string,
  ):
    | Observable<readonly StrategyPerformanceMetrics[]>
    | Observable<StrategyPerformanceMetrics>;

  /**
   * Gets observable stream of health check results
   * @param deviceType Optional device type identifier for specific strategy health checks
   * @returns Observable of strategy health check results (all strategies or specific strategy)
   */
  watchHealthChecks(deviceType: string): Observable<StrategyHealthCheck>;
  watchHealthChecks(): Observable<readonly StrategyHealthCheck[]>;
  watchHealthChecks(
    deviceType?: string,
  ):
    | Observable<readonly StrategyHealthCheck[]>
    | Observable<StrategyHealthCheck>;

  /**
   * Performs health check on all registered strategies
   * @returns Promise resolving with health check results
   */
  performHealthCheck(): Promise<readonly StrategyHealthCheck[]>;

  /**
   * Performs health check on a specific strategy
   * @param deviceType Device type identifier
   * @returns Promise resolving with health check result
   */
  performHealthCheck(deviceType: string): Promise<StrategyHealthCheck>;

  /**
   * Gets strategy by device type with type safety
   * @param deviceType Device type identifier
   * @returns Strategy instance (throws if not found)
   * @throws Error if strategy is not registered
   */
  requireStrategy(deviceType: string): IDeviceStrategy;

  /**
   * Initializes all registered strategies
   * @returns Promise resolving when all strategies are initialized
   */
  initializeAllStrategies(): Promise<void>;

  /**
   * Disposes all registered strategies
   * @returns Promise resolving when all strategies are disposed
   */
  disposeAllStrategies(): Promise<void>;

  /**
   * Clears all metrics and resets counters
   */
  resetMetrics(): void;

  /**
   * Exports registry state for backup/restore
   * @returns Promise resolving with registry state data
   */
  exportState(): Promise<{
    readonly strategies: Array<{
      readonly deviceType: string;
      readonly displayName: string;
      readonly registeredAt: Date;
      readonly metrics: StrategyPerformanceMetrics;
    }>;
    readonly stats: RegistryStats;
  }>;

  /**
   * Imports registry state from backup
   * @param state Registry state data to import
   * @returns Promise resolving when import is complete
   */
  importState(state: {
    strategies: Array<{
      readonly deviceType: string;
      readonly displayName: string;
      readonly registeredAt: Date;
      readonly metrics: StrategyPerformanceMetrics;
    }>;
    readonly stats: RegistryStats;
  }): Promise<void>;
}

/**
 * Default implementation of strategy registry with RxJS support
 * Implements common reactive functionality while leaving core methods abstract
 */
export abstract class BaseStrategyRegistry
  implements Partial<IStrategyRegistry>
{
  protected readonly strategies = new Map<string, IDeviceStrategy>();
  protected readonly strategyStates = new Map<
    string,
    {
      registered: boolean;
      initialized: boolean;
      active: boolean;
      healthy: boolean;
      lastHealthCheck?: Date;
      registrationTime: Date;
      initializationTime?: Date;
      consecutiveFailures: number;
    }
  >();

  protected readonly strategySubject = new Subject<StrategyChangeEvent>();
  protected readonly metricsSubject = new BehaviorSubject<
    readonly StrategyPerformanceMetrics[]
  >([]);
  protected readonly healthCheckSubject = new BehaviorSubject<
    readonly StrategyHealthCheck[]
  >([]);

  protected readonly logger: {
    log: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };

  constructor(logger?: {
    log: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  }) {
    this.logger = logger || console;
  }

  /**
   * Creates observable stream for strategy change events
   */
  watchStrategyChanges(): Observable<StrategyChangeEvent> {
    return this.strategySubject.asObservable().pipe(
      distinctUntilChanged(
        (prev, curr) =>
          prev.deviceType === curr.deviceType &&
          prev.type === curr.type &&
          prev.timestamp.getTime() === curr.timestamp.getTime(),
      ),
      share(),
    );
  }

  /**
   * Creates observable stream for strategy metrics (all strategies or specific strategy)
   */
  // Overloads implementation
  watchStrategyMetrics(
    deviceType: string,
  ): Observable<StrategyPerformanceMetrics>;
  watchStrategyMetrics(): Observable<readonly StrategyPerformanceMetrics[]>;
  watchStrategyMetrics(
    deviceType?: string,
  ):
    | Observable<readonly StrategyPerformanceMetrics[]>
    | Observable<StrategyPerformanceMetrics> {
    if (deviceType) {
      const single$: Observable<StrategyPerformanceMetrics> =
        this.metricsSubject.asObservable().pipe(
          map((metrics) =>
            metrics.find((metric) => metric.deviceType === deviceType),
          ),
          filter(
            (metric): metric is StrategyPerformanceMetrics =>
              metric !== undefined,
          ),
          distinctUntilChanged(
            (prev, curr) =>
              prev.totalCommands === curr.totalCommands &&
              prev.averageProcessingTime === curr.averageProcessingTime,
          ),
          share(),
        );
      return single$;
    }

    const all$: Observable<readonly StrategyPerformanceMetrics[]> =
      this.metricsSubject.asObservable().pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev.length === curr.length &&
            prev.every(
              (metric, index) =>
                metric.deviceType === curr[index].deviceType &&
                metric.totalCommands === curr[index].totalCommands,
            ),
        ),
        share(),
      );
    return all$;
  }

  /**
   * Creates observable stream for health check results (all strategies or specific strategy)
   */
  // Overloads implementation
  watchHealthChecks(deviceType: string): Observable<StrategyHealthCheck>;
  watchHealthChecks(): Observable<readonly StrategyHealthCheck[]>;
  watchHealthChecks(
    deviceType?: string,
  ):
    | Observable<readonly StrategyHealthCheck[]>
    | Observable<StrategyHealthCheck> {
    if (deviceType) {
      const single$: Observable<StrategyHealthCheck> = this.healthCheckSubject
        .asObservable()
        .pipe(
          map((checks) =>
            checks.find((check) => check.deviceType === deviceType),
          ),
          filter((check): check is StrategyHealthCheck => check !== undefined),
          distinctUntilChanged(
            (prev, curr) =>
              prev.healthy === curr.healthy &&
              prev.lastCheck.getTime() === curr.lastCheck.getTime(),
          ),
          share(),
        );
      return single$;
    }

    const all$: Observable<readonly StrategyHealthCheck[]> =
      this.healthCheckSubject.asObservable().pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev.length === curr.length &&
            prev.every(
              (check, index) =>
                check.deviceType === curr[index].deviceType &&
                check.healthy === curr[index].healthy &&
                check.lastCheck.getTime() === curr[index].lastCheck.getTime(),
            ),
        ),
        share(),
      );
    return all$;
  }

  /**
   * Emits strategy change event
   */
  protected emitStrategyEvent(event: StrategyChangeEvent): void {
    this.strategySubject.next(event);
    this.logger.debug(`Strategy event: ${event.type} for ${event.deviceType}`);
  }

  /**
   * Updates metrics for a strategy
   */
  protected updateStrategyMetrics(
    deviceType: string,
    metrics: StrategyPerformanceMetrics,
  ): void {
    const currentMetrics = this.metricsSubject.value;
    const updatedMetrics = currentMetrics.filter(
      (m) => m.deviceType !== deviceType,
    );
    updatedMetrics.push(metrics);
    this.metricsSubject.next(updatedMetrics);
  }

  /**
   * Updates health check results
   */
  protected updateHealthChecks(checks: readonly StrategyHealthCheck[]): void {
    this.healthCheckSubject.next(checks);
  }
}
