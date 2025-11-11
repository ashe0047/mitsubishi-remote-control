import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Observable,
  Subject,
  BehaviorSubject,
  combineLatest,
  merge,
  of,
  throwError,
  timer,
  interval,
  from,
  EMPTY,
} from 'rxjs';
import {
  catchError,
  map,
  switchMap,
  debounceTime,
  throttleTime,
  distinctUntilChanged,
  filter,
  take,
  timeout,
  retry,
  share,
  shareReplay,
  bufferTime,
  mergeMap,
  concatMap,
  exhaustMap,
  defaultIfEmpty,
  finalize,
  startWith,
  delay,
  raceWith,
  tap,
  toArray,
} from 'rxjs/operators';
import { QuotaCacheService } from './quota-cache.service';
import { UsageSessionService } from './usage-session.service';
import { QuotaCalculationEngine } from './quota-calculation-engine.service';
import { Quota } from '../entities/quota.entity';
import { QuotaOverride } from '../entities/quota-override.entity';
import { UsageSession } from '../entities/usage-session.entity';
import {
  QuotaValidationRequest,
  QuotaValidationResult,
} from '../interfaces/device-operation.interface';
import { QuotaViolationsService } from './quota-violations.service';
import { ViolationType, EnforcementAction } from '../enums/violation.enums';
import {
  QuotaType,
  EnforcementAction as QuotaEnforcementAction,
} from '../enums/quota-db.enums';
import { QuotaStatus } from '../enums/quota.enums';
import { OverrideStatus } from '../enums/override.enums';
import { ValidationStatus } from '../interfaces/device-operation.interface';

// Interface matching Spring Boot QuotaBalance (enhanced version)
export interface QuotaBalance {
  userId: string;
  roomId: string;
  timeAllowed?: number; // Total seconds allowed
  timeUsed?: number; // Seconds used today
  remainingSeconds?: number;
  countAllowed?: number;
  countUsed?: number;
  remainingCount?: number;
  energyAllowed?: number; // kWh
  energyUsed?: number;
  remainingEnergy?: number;
  costAllowed?: number; // USD
  costUsed?: number;
  remainingCost?: number;
  warningThreshold?: number;
  gracePeriodMinutes?: number;
  maxGraceUses?: number;
  graceCooldownHours?: number;
  lastGraceUse?: Date;
  isActive: boolean;
  updatedAt: Date;
}

@Injectable()
export class QuotaValidationService {
  private readonly logger = new Logger(QuotaValidationService.name);
  private readonly performanceMetrics = new Map<string, PerformanceMetric>();
  private readonly BALANCE_CACHE_TTL = 3600; // 1 hour for quota balances (Spring Boot match)
  private readonly SHORT_CACHE_TTL = 300; // 5 minutes for short-term cache
  private readonly VALIDATION_TIMEOUT = 100; // 100ms timeout (Spring Boot match)

  // RxJS streams for real-time validation
  private readonly validationRequests$ = new Subject<QuotaValidationRequest>();
  private readonly quotaBalanceCache$ = new Map<
    string,
    BehaviorSubject<QuotaBalance | null>
  >();
  private readonly featureFlagCache$ = new Map<
    string,
    BehaviorSubject<boolean | null>
  >();

  // Backpressure handling - limit concurrent validations
  private readonly MAX_CONCURRENT_VALIDATIONS = 50;
  private readonly validationThrottle$ = this.validationRequests$.pipe(
    bufferTime(1000, null, this.MAX_CONCURRENT_VALIDATIONS), // Buffer max 50 requests per second
    mergeMap((requests) => from(requests)), // Process each request
    concatMap((request) => this.processValidation(request)), // Process sequentially within buffer
  );

  constructor(
    private readonly quotaCacheService: QuotaCacheService,
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    @InjectRepository(QuotaOverride)
    private readonly quotaOverrideRepository: Repository<QuotaOverride>,
    @InjectRepository(UsageSession)
    private readonly usageSessionRepository: Repository<UsageSession>,
    private readonly sessionService: UsageSessionService,
    private readonly calculationEngine: QuotaCalculationEngine,
    private readonly quotaViolationsService: QuotaViolationsService,
  ) {
    // Start the validation stream
    this.validationThrottle$.subscribe({
      error: (error) => this.logger.error('Validation stream error', error),
      complete: () => this.logger.warn('Validation stream completed'),
    });
  }

  validateQuotaUsage(
    request: QuotaValidationRequest,
  ): Promise<QuotaValidationResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Create RxJS observable for validation (exact Spring Boot logic)
    const validation$ = this.isQuotaValidationRequired(request).pipe(
      switchMap((isRequired) => {
        if (!isRequired) {
          return of(this.createAllowResult('Bypass validation', startTime));
        }

        return this.isQuotaEnabledForUser(request.userId).pipe(
          switchMap((enabled) => {
            if (!enabled) {
              return of(
                this.createAllowResult('Quota disabled for user', startTime),
              );
            }

            // Core Spring Boot validation logic
            return this.getCurrentQuotaBalance(
              request.userId,
              request.roomId,
            ).pipe(
              map((balance) => this.evaluateCommand(balance, request)),
              map((result) => this.enrichResultWithDuration(result, startTime)),
              catchError((error) =>
                this.handleValidationError(
                  error,
                  request.userId,
                  request.roomId,
                  startTime,
                ),
              ),
            );
          }),
          timeout(this.VALIDATION_TIMEOUT),
          catchError((error) =>
            this.handleValidationError(
              error,
              request.userId,
              request.roomId,
              startTime,
            ),
          ),
        );
      }),
      timeout(this.VALIDATION_TIMEOUT),
      catchError((error) =>
        this.handleValidationError(
          error,
          request.userId,
          request.roomId,
          startTime,
        ),
      ),
      tap((result) =>
        this.recordMetrics(
          request.userId,
          request.roomId,
          result,
          Date.now() - startTime,
        ),
      ),
    );

    // Convert to Promise and return
    return validation$.toPromise().then((result) => {
      if (!result) {
        return this.createFailOpenResult(
          'Validation failed to produce result',
          startTime,
        );
      }
      return result;
    });
  }

  // RxJS stream processor for backpressure handling
  private processValidation(
    request: QuotaValidationRequest,
  ): Observable<QuotaValidationResult> {
    return from(this.validateQuotaUsage(request)).pipe(
      catchError((error) => {
        this.logger.error('Process validation error', error);
        return of(this.createFailOpenResult('Processing error', Date.now()));
      }),
    );
  }

  // Exact Spring Boot logic: Check if validation is required
  private isQuotaValidationRequired(
    request: QuotaValidationRequest,
  ): Observable<boolean> {
    return of(
      request.operation.type !== 'POWER_OFF' &&
        request.operation.type !== 'READ_ONLY' &&
        !request.operation.hasEmergencyOverride &&
        !request.operation.isBusinessHoursExempt,
    );
  }

  // Exact Spring Boot logic: Check if quota is enabled for user (feature flag system)
  private isQuotaEnabledForUser(userId: string): Observable<boolean> {
    const cacheKey = `feature_flag:${userId}`;

    // Check cache first
    let cachedFlag$ = this.featureFlagCache$.get(cacheKey);
    if (!cachedFlag$) {
      cachedFlag$ = new BehaviorSubject<boolean | null>(null);
      this.featureFlagCache$.set(cacheKey, cachedFlag$);
    }

    // Return cached value if available
    const cachedValue = cachedFlag$.value;
    if (cachedValue !== null) {
      return of(cachedValue);
    }

    // For now, return true (quota enabled) - in real implementation would check feature flags
    // This matches Spring Boot's QuotaFeatureService.isQuotaEnabledForUser()
    const enabled = true; // TODO: Implement actual feature flag service
    cachedFlag$.next(enabled);

    // Cache for 5 minutes
    timer(this.SHORT_CACHE_TTL * 1000).subscribe(() => {
      cachedFlag$.next(null);
    });

    return of(enabled);
  }

  // Exact Spring Boot logic: Get current quota balance
  private getCurrentQuotaBalance(
    userId: string,
    roomId: string,
  ): Observable<QuotaBalance> {
    const cacheKey = this.balanceKey(userId, roomId);

    // Check cache first
    let cachedBalance$ = this.quotaBalanceCache$.get(cacheKey);
    if (!cachedBalance$) {
      cachedBalance$ = new BehaviorSubject<QuotaBalance | null>(null);
      this.quotaBalanceCache$.set(cacheKey, cachedBalance$);
    }

    // Return cached value if available and fresh
    const cachedValue = cachedBalance$.value;
    if (
      cachedValue &&
      this.isCacheFresh(cachedValue.updatedAt, this.BALANCE_CACHE_TTL)
    ) {
      return of(cachedValue);
    }

    // Fetch from database (reactive)
    return from(this.fetchQuotaBalanceFromDatabase(userId, roomId)).pipe(
      tap((balance) => {
        // Update cache
        cachedBalance$.next(balance);

        // Invalidate cache after TTL
        timer(this.BALANCE_CACHE_TTL * 1000).subscribe(() => {
          cachedBalance$.next(null);
        });
      }),
    );
  }

  // Exact Spring Boot logic: Fetch quota balance from database
  private async fetchQuotaBalanceFromDatabase(
    userId: string,
    roomId: string,
  ): Promise<QuotaBalance> {
    try {
      // Primary validation query (matches Spring Boot SQL)
      const quota = await this.quotaRepository
        .createQueryBuilder('quota')
        .where('quota.userId = :userId', { userId })
        .andWhere('quota.roomId = :roomId', { roomId })
        .andWhere('quota.isActive = true')
        .andWhere('quota.status = :status', { status: QuotaStatus.ACTIVE })
        .andWhere('(quota.endDate IS NULL OR quota.endDate >= :currentDate)', {
          currentDate: new Date(),
        })
        .orderBy('quota.createdAt', 'DESC')
        .limit(1)
        .cache(this.SHORT_CACHE_TTL)
        .getOne();

      if (!quota) {
        // Return empty balance when no quota configured
        return {
          userId,
          roomId,
          isActive: false,
          updatedAt: new Date(),
        };
      }

      // Calculate usage for each quota type (matches Spring Boot logic)
      const [timeUsed, countUsed, energyUsed, costUsed] = await Promise.all([
        this.calculateTimeUsage(userId, roomId, quota.quotaType),
        this.calculateCountUsage(userId, roomId, quota.quotaType),
        this.calculateEnergyUsage(userId, roomId, quota.quotaType),
        this.calculateCostUsage(userId, roomId, quota.quotaType),
      ]);

      // Build balance object (exact Spring Boot logic)
      const balance: QuotaBalance = {
        userId,
        roomId,
        isActive: true,
        updatedAt: new Date(),
        warningThreshold: quota.warningThresholds?.[0] || 75,
        gracePeriodMinutes: quota.gracePeriodMinutes || 0,
        maxGraceUses: quota.maxGraceUses || 1,
        graceCooldownHours: quota.graceCooldownHours || 24,
      };

      // Set quota-specific values based on type
      if (quota.quotaType === QuotaType.TIME_BASED) {
        const totalSeconds = Math.floor(Number(quota.allowedAmount) * 3600); // Convert hours to seconds
        const usedSeconds = Math.floor(timeUsed * 3600);
        balance.timeAllowed = totalSeconds;
        balance.timeUsed = usedSeconds;
        balance.remainingSeconds = Math.max(0, totalSeconds - usedSeconds);
      } else if (quota.quotaType === QuotaType.USAGE_COUNT) {
        const totalCount = Math.floor(Number(quota.allowedAmount));
        balance.countAllowed = totalCount;
        balance.countUsed = Math.floor(countUsed);
        balance.remainingCount = Math.max(
          0,
          totalCount - Math.floor(countUsed),
        );
      } else if (quota.quotaType === QuotaType.ENERGY_BASED) {
        balance.energyAllowed = Number(quota.allowedAmount);
        balance.energyUsed = energyUsed;
        balance.remainingEnergy = Math.max(
          0,
          Number(quota.allowedAmount) - energyUsed,
        );
      } else if (quota.quotaType === QuotaType.COST_BASED) {
        balance.costAllowed = Number(quota.allowedAmount);
        balance.costUsed = costUsed;
        balance.remainingCost = Math.max(
          0,
          Number(quota.allowedAmount) - costUsed,
        );
      }

      return balance;
    } catch (error) {
      this.logger.error('Failed to fetch quota balance', error);
      throw error;
    }
  }

  // Exact Spring Boot logic: Evaluate command against quota balance
  private evaluateCommand(
    balance: QuotaBalance,
    request: QuotaValidationRequest,
  ): QuotaValidationResult {
    if (!balance.isActive) {
      return this.createAllowResult('No quota configured', Date.now());
    }

    // Check if any quota is exceeded (Spring Boot: isAnyQuotaExceeded)
    if (this.isAnyQuotaExceeded(balance)) {
      // Check grace period logic
      if (this.isGracePeriodApplicable(balance)) {
        return this.createAllowWithWarningResult(
          'Grace period active',
          Date.now(),
          balance,
        );
      }

      return this.createBlockResult('Quota exceeded', Date.now(), balance);
    }

    // Check warning threshold (Spring Boot: isAtWarningThreshold)
    if (this.isAtWarningThreshold(balance)) {
      const warningMessage = this.buildWarningMessage(balance);
      return this.createAllowWithWarningResult(
        warningMessage,
        Date.now(),
        balance,
      );
    }

    return this.createAllowResult('Quota available', Date.now());
  }

  // Exact Spring Boot logic: Check if any quota type is exceeded
  private isAnyQuotaExceeded(balance: QuotaBalance): boolean {
    return (
      (balance.remainingSeconds !== undefined &&
        balance.remainingSeconds <= 0) ||
      (balance.remainingCount !== undefined && balance.remainingCount <= 0) ||
      (balance.remainingEnergy !== undefined && balance.remainingEnergy <= 0) ||
      (balance.remainingCost !== undefined && balance.remainingCost <= 0)
    );
  }

  // Exact Spring Boot logic: Get maximum usage percentage across all quota types
  private getMaxUsagePercentage(balance: QuotaBalance): number {
    const timePercentage = this.getTimeUsagePercentage(balance);
    const countPercentage = this.getCountUsagePercentage(balance);
    const energyPercentage = this.getEnergyUsagePercentage(balance);
    const costPercentage = this.getCostUsagePercentage(balance);

    return Math.max(
      timePercentage,
      countPercentage,
      energyPercentage,
      costPercentage,
    );
  }

  private getTimeUsagePercentage(balance: QuotaBalance): number {
    if (balance.timeAllowed && balance.timeUsed !== undefined) {
      return Math.min(100, (balance.timeUsed / balance.timeAllowed) * 100);
    }
    return 0;
  }

  private getCountUsagePercentage(balance: QuotaBalance): number {
    if (balance.countAllowed && balance.countUsed !== undefined) {
      return Math.min(100, (balance.countUsed / balance.countAllowed) * 100);
    }
    return 0;
  }

  private getEnergyUsagePercentage(balance: QuotaBalance): number {
    if (balance.energyAllowed && balance.energyUsed !== undefined) {
      return Math.min(100, (balance.energyUsed / balance.energyAllowed) * 100);
    }
    return 0;
  }

  private getCostUsagePercentage(balance: QuotaBalance): number {
    if (balance.costAllowed && balance.costUsed !== undefined) {
      return Math.min(100, (balance.costUsed / balance.costAllowed) * 100);
    }
    return 0;
  }

  // Exact Spring Boot logic: Check if at warning threshold
  private isAtWarningThreshold(balance: QuotaBalance): boolean {
    if (!balance.warningThreshold) return false;
    return this.getMaxUsagePercentage(balance) >= balance.warningThreshold;
  }

  // Exact Spring Boot logic: Check grace period applicability
  private isGracePeriodApplicable(balance: QuotaBalance): boolean {
    if (!balance.gracePeriodMinutes || balance.gracePeriodMinutes <= 0) {
      return false;
    }

    // Check cooldown period
    if (balance.lastGraceUse) {
      const cooldownEnd = new Date(
        balance.lastGraceUse.getTime() +
          (balance.graceCooldownHours || 24) * 60 * 60 * 1000,
      );
      if (new Date() < cooldownEnd) {
        return false; // Still in cooldown
      }
    }

    // TODO: Check actual grace period usage count logic
    // This would require tracking grace period uses per user/room
    return true; // Simplified for now
  }

  // Exact Spring Boot logic: Build warning message
  private buildWarningMessage(balance: QuotaBalance): string {
    let message = 'AC usage approaching daily limit. ';

    if (balance.remainingSeconds && balance.remainingSeconds > 0) {
      const hours = Math.floor(balance.remainingSeconds / 3600);
      const minutes = Math.floor((balance.remainingSeconds % 3600) / 60);
      message += `${hours}h ${minutes}m remaining today.`;
    } else if (balance.remainingCount && balance.remainingCount > 0) {
      message += `${balance.remainingCount} uses remaining today.`;
    } else if (balance.remainingEnergy && balance.remainingEnergy > 0) {
      message += `${balance.remainingEnergy.toFixed(2)} kWh remaining today.`;
    } else if (balance.remainingCost && balance.remainingCost > 0) {
      message += `$${balance.remainingCost.toFixed(2)} remaining today.`;
    }

    return message;
  }

  // Helper methods for creating validation results (matching Spring Boot)
  private createAllowResult(
    reason: string,
    startTime: number,
  ): QuotaValidationResult {
    return {
      isValid: true,
      reason,
      status: ValidationStatus.ALLOW,
      warning: false,
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  private createAllowWithWarningResult(
    reason: string,
    startTime: number,
    balance: QuotaBalance,
  ): QuotaValidationResult {
    return {
      isValid: true,
      reason,
      status: ValidationStatus.ALLOW_WITH_WARNING,
      warning: true,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      balance: this.mapToInterfaceBalance(balance),
      usagePercentage: this.getMaxUsagePercentage(balance),
    };
  }

  private createBlockResult(
    reason: string,
    startTime: number,
    balance: QuotaBalance,
  ): QuotaValidationResult {
    return {
      isValid: false,
      reason,
      status: ValidationStatus.BLOCK,
      warning: false,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      balance: this.mapToInterfaceBalance(balance),
      usagePercentage: this.getMaxUsagePercentage(balance),
    };
  }

  // Map internal QuotaBalance to interface QuotaBalance for compatibility
  private mapToInterfaceBalance(internal: QuotaBalance): any {
    return {
      quotaId: 'unknown', // Would be set from actual quota in full implementation
      userId: internal.userId,
      roomId: internal.roomId,
      quotaType: 'TIME_BASED', // Would be set from actual quota
      scope: 'USER_ROOM',
      status: internal.isActive ? 'ACTIVE' : 'INACTIVE',
      allowedAmount:
        internal.timeAllowed ||
        internal.countAllowed ||
        internal.energyAllowed ||
        internal.costAllowed ||
        0,
      usedAmount:
        internal.timeUsed ||
        internal.countUsed ||
        internal.energyUsed ||
        internal.costUsed ||
        0,
      remainingAmount:
        internal.remainingSeconds ||
        internal.remainingCount ||
        internal.remainingEnergy ||
        internal.remainingCost ||
        0,
      warningThresholds: internal.warningThreshold
        ? [internal.warningThreshold]
        : [75],
      notificationMethods: [],
      enforcementAction: 'WARN',
      overrides: [],
      updatedAt: internal.updatedAt,
    };
  }

  private createFailOpenResult(
    reason: string,
    startTime: number,
  ): QuotaValidationResult {
    return {
      isValid: true,
      reason,
      status: ValidationStatus.FAIL_OPEN,
      warning: true,
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  private enrichResultWithDuration(
    result: QuotaValidationResult,
    startTime: number,
  ): QuotaValidationResult {
    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  // Exact Spring Boot logic: Handle validation errors with fail-safe behavior
  private handleValidationError(
    error: any,
    userId: string,
    roomId: string,
    startTime: number,
  ): Observable<QuotaValidationResult> {
    if (error.name === 'TimeoutError') {
      this.logger.warn(
        `Quota validation timeout for user ${userId} room ${roomId}, failing open`,
      );
      return of(this.createFailOpenResult('Validation timeout', startTime));
    }

    this.logger.error(
      `Quota validation error for user ${userId} room ${roomId}, failing open`,
      error,
    );
    return of(
      this.createFailOpenResult(`Service error: ${error.message}`, startTime),
    );
  }

  // Exact Spring Boot logic: Calculate time usage for daily quota
  private async calculateTimeUsage(
    userId: string,
    roomId: string,
    quotaType: QuotaType,
  ): Promise<number> {
    if (quotaType !== QuotaType.TIME_BASED) return 0;

    try {
      // Daily usage calculation with active session handling (matches Spring Boot SQL)
      const result = await this.usageSessionRepository
        .createQueryBuilder('session')
        .select(
          'COALESCE(SUM(' +
            'CASE ' +
            'WHEN session.endTime IS NULL THEN ' +
            'EXTRACT(EPOCH FROM (NOW() - session.startTime))::INTEGER ' +
            'ELSE session.durationSeconds ' +
            'END' +
            '), 0)::BIGINT',
          'totalSeconds',
        )
        .where('session.userId = :userId', { userId })
        .andWhere('session.roomId = :roomId', { roomId })
        .andWhere('DATE(session.startTime) = :date', { date: new Date() })
        .getRawOne();

      return result.totalSeconds / 3600; // Convert seconds to hours
    } catch (error) {
      this.logger.error('Failed to calculate time usage', error);
      return 0;
    }
  }

  // Exact Spring Boot logic: Calculate count usage for daily quota
  private async calculateCountUsage(
    userId: string,
    roomId: string,
    quotaType: QuotaType,
  ): Promise<number> {
    if (quotaType !== QuotaType.USAGE_COUNT) return 0;

    try {
      const count = await this.usageSessionRepository
        .createQueryBuilder('session')
        .where('session.userId = :userId', { userId })
        .andWhere('session.roomId = :roomId', { roomId })
        .andWhere('DATE(session.startTime) = :date', { date: new Date() })
        .getCount();

      return count;
    } catch (error) {
      this.logger.error('Failed to calculate count usage', error);
      return 0;
    }
  }

  // Exact Spring Boot logic: Calculate energy usage for daily quota
  private async calculateEnergyUsage(
    userId: string,
    roomId: string,
    quotaType: QuotaType,
  ): Promise<number> {
    if (quotaType !== QuotaType.ENERGY_BASED) return 0;

    try {
      // This would require energy tracking in usage sessions
      // For now, return 0 - would need integration with energy monitoring
      return 0;
    } catch (error) {
      this.logger.error('Failed to calculate energy usage', error);
      return 0;
    }
  }

  // Exact Spring Boot logic: Calculate cost usage for daily quota
  private async calculateCostUsage(
    userId: string,
    roomId: string,
    quotaType: QuotaType,
  ): Promise<number> {
    if (quotaType !== QuotaType.COST_BASED) return 0;

    try {
      // This would require cost calculation based on energy usage and rates
      // For now, return 0 - would need integration with billing system
      return 0;
    } catch (error) {
      this.logger.error('Failed to calculate cost usage', error);
      return 0;
    }
  }

  // Helper methods
  private balanceKey(userId: string, roomId: string): string {
    return `quota:balance:${userId}:${roomId}`;
  }

  private isCacheFresh(updatedAt: Date, ttlSeconds: number): boolean {
    const age = Date.now() - updatedAt.getTime();
    return age < ttlSeconds * 1000;
  }

  private recordMetrics(
    userId: string,
    roomId: string,
    result: QuotaValidationResult,
    duration: number,
  ): void {
    const requestId = this.generateRequestId();
    this.recordPerformance(requestId, duration, result.status || 'UNKNOWN');

    // Performance monitoring (matches Spring Boot: <100ms target)
    if (duration > this.VALIDATION_TIMEOUT) {
      this.logger.warn(
        `Quota validation exceeded ${this.VALIDATION_TIMEOUT}ms target: ${duration}ms`,
        {
          requestId,
          userId,
          roomId,
          status: result.status,
          duration,
        },
      );
    }
  }

  // Real-time quota monitoring with backpressure handling
  createQuotaMonitoringStream(
    userId: string,
    roomId: string,
  ): Observable<QuotaBalance> {
    return interval(5000).pipe(
      // Check every 5 seconds
      switchMap(() => this.getCurrentQuotaBalance(userId, roomId)),
      distinctUntilChanged(
        (prev, curr) =>
          prev?.remainingSeconds === curr?.remainingSeconds &&
          prev?.remainingCount === curr?.remainingCount &&
          prev?.remainingEnergy === curr?.remainingEnergy &&
          prev?.remainingCost === curr?.remainingCost,
      ),
      shareReplay(1), // Share with multiple subscribers
    );
  }

  // Batch validation for multiple requests (backpressure optimization)
  validateBatch(
    requests: QuotaValidationRequest[],
  ): Observable<QuotaValidationResult[]> {
    return from(requests).pipe(
      mergeMap((request) => this.validateQuotaUsage(request), 10), // Max 10 concurrent
      toArray(),
      share(),
    );
  }

  // Enhanced cache invalidation with RxJS
  invalidateUserCache$(userId: string, roomId: string): Observable<void> {
    const balanceKey = this.balanceKey(userId, roomId);
    const featureFlagKey = `feature_flag:${userId}`;

    // Invalidate cache streams
    const balanceCache$ = this.quotaBalanceCache$.get(balanceKey);
    const flagCache$ = this.featureFlagCache$.get(featureFlagKey);

    if (balanceCache$) balanceCache$.next(null);
    if (flagCache$) flagCache$.next(null);

    // Also invalidate Redis cache
    return from(
      this.quotaCacheService.invalidateValidationResults(
        `validation:${userId}:${roomId}:*`,
      ),
    ).pipe(
      map(() => {}),
      catchError((error) => {
        this.logger.error('Failed to invalidate user cache', error);
        return EMPTY;
      }),
    );
  }

  // Preload user quotas with RxJS for better performance
  preloadUserQuotas$(
    userId: string,
    roomIds: string[],
  ): Observable<QuotaBalance[]> {
    return from(roomIds).pipe(
      mergeMap((roomId) => this.getCurrentQuotaBalance(userId, roomId), 5), // Max 5 concurrent
      toArray(),
      share(),
    );
  }

  private recordPerformance(
    requestId: string,
    duration: number,
    type: string,
  ): void {
    this.performanceMetrics.set(requestId, {
      duration,
      type,
      timestamp: new Date(),
    });

    // Clean old metrics (keep last 1000)
    if (this.performanceMetrics.size > 1000) {
      const oldestKey = this.performanceMetrics.keys().next().value as string;
      this.performanceMetrics.delete(oldestKey);
    }
  }

  // Enhanced performance metrics with RxJS stream
  getPerformanceMetrics$(): Observable<PerformanceSummary> {
    return interval(30000).pipe(
      // Update every 30 seconds
      map(() => this.calculatePerformanceSummary()),
      distinctUntilChanged(),
      shareReplay(1),
    );
  }

  private calculatePerformanceSummary(): PerformanceSummary {
    const metrics = Array.from(this.performanceMetrics.values());

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    const durations = metrics.map((m) => m.duration);
    const cacheHits = metrics.filter((m) => m.type === 'cache_hit').length;
    const errors = metrics.filter((m) => m.type === 'error').length;

    durations.sort((a, b) => a - b);

    return {
      totalRequests: metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
      cacheHitRate: (cacheHits / metrics.length) * 100,
      errorRate: (errors / metrics.length) * 100,
    };
  }

  getPerformanceMetrics(): PerformanceSummary {
    return this.calculatePerformanceSummary();
  }

  // Legacy method for backward compatibility
  async preloadUserQuotas(userId: string, roomIds: string[]): Promise<void> {
    await this.preloadUserQuotas$(userId, roomIds).toPromise();
  }

  // Legacy method for backward compatibility
  async invalidateUserCache(userId: string, roomId: string): Promise<void> {
    await this.invalidateUserCache$(userId, roomId).toPromise();
  }

  // Helper method for request ID generation
  private generateRequestId(): string {
    return `quota_val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Grace period violation recording (Spring Boot logic)
  private async recordGracePeriodUse(
    balance: QuotaBalance,
    request: QuotaValidationRequest,
  ): Promise<void> {
    try {
      // TODO: Implement grace period tracking in database
      // This would update the quota record with lastGraceUse timestamp
      // and increment grace period usage count
      this.logger.log(
        `Grace period used for user ${request.userId} room ${request.roomId}`,
      );
    } catch (error) {
      this.logger.error('Failed to record grace period use', error);
    }
  }

  // Cleanup method for service shutdown
  onModuleDestroy(): void {
    // Complete all observables
    this.validationRequests$.complete();

    // Clear all caches
    this.quotaBalanceCache$.clear();
    this.featureFlagCache$.clear();
    this.performanceMetrics.clear();

    this.logger.log('QuotaValidationService cleanup completed');
  }
}

interface PerformanceMetric {
  duration: number;
  type: string;
  timestamp: Date;
}

export interface PerformanceSummary {
  totalRequests: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  cacheHitRate: number;
  errorRate: number;
}
