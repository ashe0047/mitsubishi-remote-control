# Phase 4: Quota Management System - Technical Design Document

## System Architecture Overview

### Quota Management System Architecture
The quota management system follows a high-performance, event-driven architecture designed for sub-80ms validation response times:

```
Quota Management Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ QuotaController │  │ OverrideCtrl    │  │ StatusCtrl   │ │
│  │ - quota CRUD    │  │ - override req  │  │ - status API │ │
│  │ - validation    │  │ - approval      │  │ - reporting  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ QuotaService    │  │ ValidationSvc   │  │ SessionSvc   │ │
│  │ - quota mgmt    │  │ - <80ms target  │  │ - tracking   │ │
│  │ - calculations  │  │ - cache logic    │  │ - usage calc │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ OverrideService │  │ CacheService    │  │ NotifySvc   │ │
│  │ - request mgmt  │  │ - Redis layer    │  │ - events     │ │
│  │ - approval flow │  │ - 1hr TTL        │  │ - alerts     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                Calculation & Strategy Layer                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ TimeCalculator  │  │ UsageCalculator  │  │ EnergyCalc   │ │
│  │ - duration calc │  │ - count logic    │  │ - power calc │ │
│  │ - session mgmt  │  │ - operation cnt │  │ - rates      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ CostCalculator  │  │ ValidationEngine │  │ SessionMgr   │ │
│  │ - pricing logic │  │ - rule engine    │  │ - state mgmt │ │
│  │ - formulas      │  │ - fail-open      │  │ - persistence│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  Data & Cache Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ QuotaRepository │  │ SessionRepo     │  │ Redis Cache  │ │
│  │ - quota CRUD    │  │ - session CRUD   │  │ - quota data │ │
│  │ - optimized qry│  │ - bulk ops       │  │ - sessions   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Clean Code Principles Analysis

### DRY (Don't Repeat Yourself) Implementation

**Current Duplication Risks Identified**:
- Quota calculation logic across different quota types
- Cache key formatting and TTL management
- Session state management patterns
- Validation rule implementations
- Override approval workflows

**DRY Solutions Design**:

1. **Shared Calculation Engine**
```typescript
// Common quota calculation patterns
export class QuotaCalculationEngine {
  static calculateUsagePercentage(used: number, total: number): number {
    return total > 0 ? (used / total) * 100 : 0;
  }

  static isWarningThreshold(percentage: number, threshold: number = 75): boolean {
    return percentage >= threshold;
  }

  static calculateRemaining(used: number, total: number): number {
    return Math.max(0, total - used);
  }
}
```

2. **Centralized Cache Management**
```typescript
// Shared cache operations
export class QuotaCacheManager {
  static getQuotaKey(quotaId: string): string {
    return `quota:${quotaId}`;
  }

  static getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  static getUserQuotasKey(userId: string): string {
    return `user:${userId}:quotas`;
  }
}
```

3. **Common Validation Patterns**
```typescript
// Reusable validation logic
export class QuotaValidationEngine {
  static validateQuotaAmount(amount: number): ValidationResult {
    return {
      isValid: amount > 0,
      errors: amount <= 0 ? ['Amount must be greater than 0'] : [],
    };
  }

  static validateTimeRange(startDate: Date, endDate: Date): ValidationResult {
    const errors: string[] = [];

    if (startDate >= endDate) {
      errors.push('Start date must be before end date');
    }

    if (startDate < new Date()) {
      errors.push('Start date cannot be in the past');
    }

    return { isValid: errors.length === 0, errors };
  }
}
```

### SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
**Module Separation**:
- **QuotaModule**: Quota CRUD operations and basic management
- **ValidationModule**: High-performance quota validation with caching
- **SessionModule**: Usage session tracking and management
- **OverrideModule**: Override request processing and approval
- **ReportingModule**: Quota status monitoring and analytics

#### Open/Closed Principle (OCP)
**Extension Strategy**:
- **Quota Type Strategies**: Extensible calculation strategies for new quota types
- **Validation Rules**: Extensible rule engine for new validation criteria
- **Override Types**: Extensible override mechanisms
- **Notification Providers**: Multiple notification channels

#### Liskov Substitution Principle (LSP)
**Inheritance Design**:
- **BaseQuota**: Common quota properties and methods
- **TimeBasedQuota**: Extended quota with time-specific functionality
- **UsageBasedQuota**: Extended quota with count-based functionality
- **BaseValidator**: Interchangeable validation implementations

#### Interface Segregation Principle (ISP)
**Focused Interfaces**:
- **IQuotaService**: Quota operations only
- **IValidationService**: Validation operations only
- **ISessionService**: Session management only
- **IOverrideService**: Override operations only

#### Dependency Inversion Principle (DIP)
**Dependency Management**:
- Services depend on interfaces, not concrete implementations
- Repository pattern for data access abstraction
- Cache abstraction for testing flexibility
- Provider pattern for service instantiation

### YAGNI (You Ain't Gonna Need It) Implementation

**Implementation Boundaries**:
- Implement only 4 required quota types (TIME_BASED, USAGE_COUNT, ENERGY_BASED, COST_BASED)
- Skip advanced analytics unless specified
- Basic override system with 3 required types
- Simple notification system (can be extended later)
- Essential reporting without complex analytics

## Design Pattern Analysis and Selection

### Quota Management Pattern Selection Matrix

| Pattern | Complexity | Performance | Maintainability | Scalability | Extensibility | Score | Decision |
|---------|------------|-------------|-----------------|-------------|---------------|-------|----------|
| Strategy | 3 | 5 | 4 | 4 | 5 | 4.2 | ✅ Adopt |
| Observer | 2 | 4 | 5 | 4 | 4 | 3.8 | ✅ Adopt |
| Repository | 2 | 5 | 5 | 5 | 3 | 4.0 | ✅ Adopt |
| Factory | 3 | 4 | 4 | 4 | 5 | 4.0 | ✅ Adopt |
| Command | 3 | 3 | 4 | 3 | 4 | 3.4 | ✅ Adopt |
| Facade | 2 | 4 | 5 | 4 | 3 | 3.6 | ✅ Adopt |
| Decorator | 2 | 4 | 4 | 3 | 4 | 3.4 | ✅ Adopt |
| Cache-Aside | 3 | 5 | 4 | 5 | 3 | 4.0 | ✅ Adopt |

### Selected Design Patterns Implementation

#### 1. Strategy Pattern - Quota Type Calculations
**Purpose**: Different calculation strategies for various quota types
**Implementation**:
```typescript
interface QuotaCalculationStrategy {
  calculateUsage(session: UsageSession, quota: Quota): Promise<number>;
  isValidForOperation(session: UsageSession, operation: DeviceOperation): boolean;
  getRemainingQuota(quota: Quota, currentUsage: number): number;
}

class TimeBasedQuotaStrategy implements QuotaCalculationStrategy {
  async calculateUsage(session: UsageSession, quota: Quota): Promise<number> {
    if (session.status !== SessionStatus.ACTIVE) {
      return session.totalUsage || 0;
    }

    const currentTime = new Date();
    const sessionDuration = currentTime.getTime() - session.startTime.getTime();
    const totalDuration = sessionDuration + (session.totalDuration || 0);

    // Convert milliseconds to minutes
    return Math.floor(totalDuration / (1000 * 60));
  }

  isValidForOperation(session: UsageSession, operation: DeviceOperation): boolean {
    // For time-based quotas, any operation that keeps device ON uses quota
    return operation.type !== 'READ_ONLY';
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    return Math.max(0, quota.allowedAmount - currentUsage);
  }
}

class UsageBasedQuotaStrategy implements QuotaCalculationStrategy {
  async calculateUsage(session: UsageSession, quota: Quota): Promise<number> {
    return session.usageCount || 0;
  }

  isValidForOperation(session: UsageSession, operation: DeviceOperation): boolean {
    // Count specific operations that consume quota
    return this.isCountedOperation(operation);
  }

  getRemainingQuota(quota: Quota, currentUsage: number): number {
    return Math.max(0, quota.allowedAmount - currentUsage);
  }

  private isCountedOperation(operation: DeviceOperation): boolean {
    const countedOperations = ['POWER_ON', 'MODE_CHANGE', 'TEMPERATURE_CHANGE'];
    return countedOperations.includes(operation.type);
  }
}
```

#### 2. Observer Pattern - Real-time Quota Updates
**Purpose**: Real-time quota status change notifications
**Implementation**:
```typescript
interface QuotaObserver {
  onQuotaExhausted(quotaId: string, userId: string): void;
  onWarningThreshold(quotaId: string, userId: string, percentage: number): void;
  onOverrideRequested(request: OverrideRequest): void;
  onOverrideApproved(request: OverrideRequest): void;
  onQuotaUpdated(quota: Quota): void;
}

export class QuotaEventEmitter {
  private observers: QuotaObserver[] = [];

  subscribe(observer: QuotaObserver): void {
    this.observers.push(observer);
  }

  unsubscribe(observer: QuotaObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  emitQuotaExhausted(quotaId: string, userId: string): void {
    this.observers.forEach(observer => observer.onQuotaExhausted(quotaId, userId));
  }

  emitWarningThreshold(quotaId: string, userId: string, percentage: number): void {
    this.observers.forEach(observer => observer.onWarningThreshold(quotaId, userId, percentage));
  }

  emitOverrideRequested(request: OverrideRequest): void {
    this.observers.forEach(observer => observer.onOverrideRequested(request));
  }

  emitOverrideApproved(request: OverrideRequest): void {
    this.observers.forEach(observer => observer.onOverrideApproved(request));
  }

  emitQuotaUpdated(quota: Quota): void {
    this.observers.forEach(observer => observer.onQuotaUpdated(quota));
  }
}
```

#### 3. Cache-Aside Pattern - High-Performance Caching
**Purpose**: Achieve <80ms validation response time with Redis caching
**Implementation**:
```typescript
@Injectable()
export class QuotaCacheService {
  private readonly logger = new Logger(QuotaCacheService.name);
  private readonly DEFAULT_TTL = 3600; // 1 hour

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async getQuotaBalance(quotaId: string): Promise<QuotaBalance | null> {
    const cacheKey = this.getQuotaBalanceKey(quotaId);
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as QuotaBalance;
    } catch (error) {
      this.logger.error(`Failed to parse cached quota balance for ${quotaId}`, error);
      return null;
    }
  }

  async setQuotaBalance(quotaId: string, balance: QuotaBalance, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = this.getQuotaBalanceKey(quotaId);
    const balanceJson = JSON.stringify(balance);

    await this.redis.setex(cacheKey, ttl, balanceJson);
  }

  async invalidateQuotaBalance(quotaId: string): Promise<void> {
    const cacheKey = this.getQuotaBalanceKey(quotaId);
    await this.redis.del(cacheKey);
  }

  async getSession(sessionId: string): Promise<UsageSession | null> {
    const cacheKey = this.getSessionKey(sessionId);
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as UsageSession;
    } catch (error) {
      this.logger.error(`Failed to parse cached session for ${sessionId}`, error);
      return null;
    }
  }

  async setSession(session: UsageSession, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = this.getSessionKey(session.id);
    const sessionJson = JSON.stringify(session);

    await this.redis.setex(cacheKey, ttl, sessionJson);
  }

  async getUserQuotas(userId: string): Promise<string[] | null> {
    const cacheKey = this.getUserQuotasKey(userId);
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as string[];
    } catch (error) {
      this.logger.error(`Failed to parse cached user quotas for ${userId}`, error);
      return null;
    }
  }

  async setUserQuotas(userId: string, quotaIds: string[], ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = this.getUserQuotasKey(userId);
    const quotaIdsJson = JSON.stringify(quotaIds);

    await this.redis.setex(cacheKey, ttl, quotaIdsJson);
  }

  private getQuotaBalanceKey(quotaId: string): string {
    return `quota:balance:${quotaId}`;
  }

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserQuotasKey(userId: string): string {
    return `user:${userId}:quotas`;
  }

  async invalidateUserQuotas(userId: string): Promise<void> {
    const cacheKey = this.getUserQuotasKey(userId);
    await this.redis.del(cacheKey);
  }

  async getCacheHitStats(): Promise<CacheStats> {
    // Implementation would depend on Redis monitoring capabilities
    return {
      hits: 0,
      misses: 0,
      hitRatio: 0,
    };
  }
}

interface QuotaBalance {
  quotaId: string;
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  isWarningThreshold: boolean;
  isExhausted: boolean;
  lastUpdated: Date;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
}
```

#### 4. Repository Pattern - Data Access Abstraction
**Purpose**: Clean separation between business logic and data access
**Implementation**:
```typescript
interface IQuotaRepository {
  findById(id: string): Promise<Quota | null>;
  findByUserAndRoom(userId: string, roomId: string): Promise<Quota[]>;
  create(quotaData: CreateQuotaDto): Promise<Quota>;
  update(id: string, updates: UpdateQuotaDto): Promise<Quota>;
  delete(id: string): Promise<void>;
  findActiveQuotas(userId: string): Promise<Quota[]>;
  updateQuotaStatus(id: string, status: QuotaStatus): Promise<void>;
}

interface IUsageSessionRepository {
  findById(id: string): Promise<UsageSession | null>;
  findByQuota(quotaId: string): Promise<UsageSession[]>;
  create(sessionData: CreateSessionDto): Promise<UsageSession>;
  update(id: string, updates: UpdateSessionDto): Promise<UsageSession>;
  findActiveSession(userId: string, roomId: string): Promise<UsageSession | null>;
  endSession(sessionId: string, endTime: Date): Promise<void>;
  bulkUpdate(sessions: Partial<UsageSession>[]): Promise<void>;
}

@EntityRepository(Quota)
export class QuotaRepository extends Repository<Quota> implements IQuotaRepository {
  async findActiveQuotas(userId: string): Promise<Quota[]> {
    return this.createQueryBuilder('quota')
      .leftJoinAndSelect('quota.user', 'user')
      .leftJoinAndSelect('quota.room', 'room')
      .where('quota.userId = :userId', { userId })
      .andWhere('quota.isActive = true')
      .andWhere('(quota.startDate <= :now AND quota.endDate >= :now)', { now: new Date() })
      .cache(300) // 5 minutes cache
      .getMany();
  }

  async findByUserAndRoom(userId: string, roomId: string): Promise<Quota[]> {
    return this.createQueryBuilder('quota')
      .where('quota.userId = :userId', { userId })
      .andWhere('quota.roomId = :roomId', { roomId })
      .andWhere('quota.isActive = true')
      .cache(300)
      .getMany();
  }

  async updateQuotaStatus(id: string, status: QuotaStatus): Promise<void> {
    await this.createQueryBuilder()
      .update(Quota)
      .set({ status, updatedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id })
      .execute();
  }
}
```

## Performance Architecture Design

### High-Performance Validation Service
```typescript
@Injectable()
export class QuotaValidationService {
  private readonly logger = new Logger(QuotaValidationService.name);
  private readonly performanceMetrics = new Map<string, PerformanceMetric>();

  constructor(
    private readonly quotaCacheService: QuotaCacheService,
    private readonly quotaRepository: QuotaRepository,
    private readonly sessionService: UsageSessionService,
    private readonly calculationEngine: QuotaCalculationEngine,
  ) {}

  async validateQuotaUsage(request: QuotaValidationRequest): Promise<QuotaValidationResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Fast path checks
      const fastPathResult = await this.performFastPathValidation(request);
      if (fastPathResult) {
        this.recordPerformance(requestId, Date.now() - startTime, 'fast_path');
        return fastPathResult;
      }

      // Main validation logic
      const result = await this.performFullValidation(request);
      this.recordPerformance(requestId, Date.now() - startTime, 'full_validation');

      // Check performance target
      const duration = Date.now() - startTime;
      if (duration > 80) {
        this.logger.warn(`Quota validation exceeded 80ms target: ${duration}ms`, {
          requestId,
          userId: request.userId,
          roomId: request.roomId,
          duration,
        });
      }

      return result;
    } catch (error) {
      this.recordPerformance(requestId, Date.now() - startTime, 'error');
      this.logger.error('Quota validation error', error, { requestId, request });

      // Fail-open strategy
      return {
        isValid: true,
        reason: 'fail_open_error',
        warning: 'Quota validation temporarily unavailable',
      };
    }
  }

  private async performFastPathValidation(request: QuotaValidationRequest): Promise<QuotaValidationResult | null> {
    // Check for bypass conditions
    if (this.shouldBypassValidation(request)) {
      return {
        isValid: true,
        reason: 'bypass_condition',
        bypassType: this.getBypassType(request),
      };
    }

    // Try cache first for active quotas
    const cacheKey = this.getValidationCacheKey(request.userId, request.roomId);
    const cachedResult = await this.quotaCacheService.getValidationResult(cacheKey);

    if (cachedResult && this.isCacheValid(cachedResult)) {
      return cachedResult;
    }

    return null;
  }

  private async performFullValidation(request: QuotaValidationRequest): Promise<QuotaValidationResult> {
    // Get active quotas for user and room
    let quotas = await this.quotaCacheService.getUserQuotas(request.userId);

    if (!quotas) {
      // Fallback to database
      quotas = await this.getActiveQuotasForUser(request.userId, request.roomId);
      await this.quotaCacheService.setUserQuotas(request.userId, quotas);
    }

    if (quotas.length === 0) {
      return {
        isValid: true,
        reason: 'no_active_quotas',
      };
    }

    // Check each quota
    for (const quotaId of quotas) {
      const quota = await this.getQuotaWithCache(quotaId);
      if (!quota || quota.roomId !== request.roomId) {
        continue;
      }

      const validationResult = await this.validateIndividualQuota(quota, request);
      if (!validationResult.isValid) {
        return validationResult;
      }
    }

    return {
      isValid: true,
      reason: 'all_quotas_valid',
    };
  }

  private async validateIndividualQuota(quota: Quota, request: QuotaValidationRequest): Promise<QuotaValidationResult> {
    // Get or create session
    const session = await this.sessionService.getOrCreateSession(quota.id, request.userId, request.roomId);

    // Calculate current usage
    const strategy = this.calculationEngine.getStrategy(quota.type);
    const currentUsage = await strategy.calculateUsage(session, quota);

    // Check warning threshold
    const percentage = this.calculationEngine.calculateUsagePercentage(currentUsage, quota.allowedAmount);
    const isWarning = this.calculationEngine.isWarningThreshold(percentage, quota.warningThreshold);

    // Check if quota is exhausted
    if (percentage >= 100) {
      return {
        isValid: false,
        reason: 'quota_exhausted',
        quotaId: quota.id,
        currentUsage,
        remaining: 0,
        percentage: 100,
      };
    }

    // Check warning threshold
    if (isWarning) {
      return {
        isValid: true,
        reason: 'warning_threshold',
        quotaId: quota.id,
        currentUsage,
        remaining: quota.allowedAmount - currentUsage,
        percentage,
        warning: true,
      };
    }

    return {
      isValid: true,
      reason: 'quota_available',
      quotaId: quota.id,
      currentUsage,
      remaining: quota.allowedAmount - currentUsage,
      percentage,
    };
  }

  private shouldBypassValidation(request: QuotaValidationRequest): boolean {
    // Power OFF commands bypass quota
    if (request.operation.type === 'POWER_OFF') {
      return true;
    }

    // Read-only operations bypass quota
    if (request.operation.type === 'READ_ONLY') {
      return true;
    }

    // Emergency overrides bypass quota
    if (request.operation.hasEmergencyOverride) {
      return true;
    }

    return false;
  }

  private getBypassType(request: QuotaValidationRequest): string {
    if (request.operation.type === 'POWER_OFF') return 'power_off';
    if (request.operation.type === 'READ_ONLY') return 'read_only';
    if (request.operation.hasEmergencyOverride) return 'emergency_override';
    return 'unknown';
  }

  private async getActiveQuotasForUser(userId: string, roomId: string): Promise<string[]> {
    const quotas = await this.quotaRepository.findActiveQuotas(userId);
    return quotas
      .filter(quota => quota.roomId === roomId)
      .filter(quota => this.isQuotaCurrentlyActive(quota))
      .map(quota => quota.id);
  }

  private isQuotaCurrentlyActive(quota: Quota): boolean {
    const now = new Date();
    return (
      quota.isActive &&
      quota.startDate <= now &&
      quota.endDate >= now &&
      quota.status === QuotaStatus.ACTIVE
    );
  }

  private async getQuotaWithCache(quotaId: string): Promise<Quota | null> {
    // Try cache first
    const cachedBalance = await this.quotaCacheService.getQuotaBalance(quotaId);
    if (cachedBalance) {
      // Return minimal quota info for validation
      return {
        id: quotaId,
        type: cachedBalance.type,
        allowedAmount: cachedBalance.total,
        warningThreshold: cachedBalance.warningThreshold,
      } as Quota;
    }

    // Fallback to database
    return this.quotaRepository.findOne({ where: { id: quotaId, isActive: true } });
  }

  private getValidationCacheKey(userId: string, roomId: string): string {
    return `validation:${userId}:${roomId}`;
  }

  private isCacheValid(cachedResult: QuotaValidationResult): boolean {
    // Cache results are valid for 30 seconds
    const maxAge = 30000; // 30 seconds
    const age = Date.now() - new Date(cachedResult.timestamp).getTime();
    return age < maxAge;
  }

  private generateRequestId(): string {
    return `quota_val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordPerformance(requestId: string, duration: number, type: string): void {
    this.performanceMetrics.set(requestId, {
      duration,
      type,
      timestamp: new Date(),
    });

    // Clean old metrics (keep last 1000)
    if (this.performanceMetrics.size > 1000) {
      const oldestKey = this.performanceMetrics.keys().next().value;
      this.performanceMetrics.delete(oldestKey);
    }
  }

  getPerformanceMetrics(): PerformanceSummary {
    const metrics = Array.from(this.performanceMetrics.values());

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        cacheHitRate: 0,
      };
    }

    const durations = metrics.map(m => m.duration);
    const cacheHits = metrics.filter(m => m.type === 'fast_path').length;

    durations.sort((a, b) => a - b);

    return {
      totalRequests: metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
      cacheHitRate: (cacheHits / metrics.length) * 100,
    };
  }
}

interface QuotaValidationRequest {
  userId: string;
  roomId: string;
  operation: DeviceOperation;
  sessionId?: string;
}

interface QuotaValidationResult {
  isValid: boolean;
  reason: string;
  quotaId?: string;
  currentUsage?: number;
  remaining?: number;
  percentage?: number;
  warning?: boolean;
  bypassType?: string;
  timestamp?: Date;
}

interface PerformanceMetric {
  duration: number;
  type: string;
  timestamp: Date;
}

interface PerformanceSummary {
  totalRequests: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  cacheHitRate: number;
}
```

## Data Architecture Design

### Database Schema Design

#### Quota Entity
```typescript
@Entity('quotas')
export class Quota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({
    type: 'enum',
    enum: QuotaType,
  })
  type: QuotaType;

  @Column({ name: 'allowed_amount', type: 'decimal', precision: 10, scale: 2 })
  allowedAmount: number;

  @Column({ name: 'warning_threshold', type: 'decimal', precision: 5, scale: 2, default: 75 })
  warningThreshold: number;

  @Column({
    type: 'enum',
    enum: QuotaStatus,
    default: QuotaStatus.ACTIVE,
  })
  status: QuotaStatus;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({
    type: 'enum',
    enum: RecurringType,
    nullable: true,
  })
  recurringType: RecurringType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  settings: QuotaSettings;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.quotas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room, room => room.quotas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => UsageSession, session => session.quota)
  sessions: UsageSession[];

  @OneToMany(() => QuotaOverride, override => override.quota)
  overrides: QuotaOverride[];

  // Computed properties
  get isValid(): boolean {
    const now = new Date();
    return (
      this.isActive &&
      this.status === QuotaStatus.ACTIVE &&
      this.startDate <= now &&
      this.endDate >= now
    );
  }

  get isExpired(): boolean {
    return new Date() > this.endDate;
  }

  get daysRemaining(): number {
    const now = new Date();
    const diffTime = this.endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export enum QuotaType {
  TIME_BASED = 'time_based',
  USAGE_COUNT = 'usage_count',
  ENERGY_BASED = 'energy_based',
  COST_BASED = 'cost_based',
}

export enum QuotaStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PAUSED = 'paused',
}

export enum RecurringType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface QuotaSettings {
  energyRate?: number; // Cost per kWh
  costPerHour?: number; // Cost per hour for time-based
  operationWeights?: Record<string, number>; // Weight for different operations
  exemptOperations?: string[]; // Operations that don't count towards quota
}
```

#### Usage Session Entity
```typescript
@Entity('usage_sessions')
export class UsageSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quota_id' })
  quotaId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'total_duration', type: 'bigint', default: 0 })
  totalDuration: number; // Duration in milliseconds

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'energy_consumed', type: 'decimal', precision: 10, scale: 4, default: 0 })
  energyConsumed: number; // Energy in kWh

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @Column({ name: 'total_usage', type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalUsage: number; // Generic usage value

  @Column({ type: 'json', nullable: true })
  metadata: SessionMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Quota, quota => quota.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quota_id' })
  quota: Quota;

  @ManyToOne(() => User, user => user.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room, room => room.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Device, device => device.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  // Computed properties
  get isActive(): boolean {
    return this.status === SessionStatus.ACTIVE;
  }

  get isCompleted(): boolean {
    return this.status === SessionStatus.COMPLETED;
  }

  get duration(): number {
    if (this.endTime) {
      return this.endTime.getTime() - this.startTime.getTime();
    }
    return Date.now() - this.startTime.getTime();
  }

  get durationMinutes(): number {
    return Math.floor(this.duration / (1000 * 60));
  }
}

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  TERMINATED = 'terminated',
}

export interface SessionMetadata {
  lastOperation?: string;
  operationHistory?: OperationRecord[];
  deviceState?: Record<string, any>;
  pauseReason?: string;
  terminationReason?: string;
}

export interface OperationRecord {
  operation: string;
  timestamp: Date;
  value?: any;
}
```

#### Quota Override Entity
```typescript
@Entity('quota_overrides')
export class QuotaOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quota_id' })
  quotaId: string;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId: string;

  @Column({ name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string;

  @Column({
    type: 'enum',
    enum: OverrideType,
  })
  type: OverrideType;

  @Column({ type: 'json' })
  parameters: OverrideParameters;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: OverrideStatus,
    default: OverrideStatus.PENDING,
  })
  status: OverrideStatus;

  @Column({ name: 'requested_at', type: 'timestamp' })
  requestedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Quota, quota => quota.overrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quota_id' })
  quota: Quota;

  @ManyToOne(() => User, user => user.requestedOverrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;

  @ManyToOne(() => User, user => user.approvedOverrides, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy: User;

  // Computed properties
  get isPending(): boolean {
    return this.status === OverrideStatus.PENDING;
  }

  get isApproved(): boolean {
    return this.status === OverrideStatus.APPROVED;
  }

  get isRejected(): boolean {
    return this.status === OverrideStatus.REJECTED;
  }

  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get isValid(): boolean {
    return (
      this.isApproved &&
      this.isActive &&
      !this.isExpired
    );
  }

  get remainingTime(): number {
    if (!this.expiresAt) return 0;
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.max(0, diffTime);
  }
}

export enum OverrideType {
  ADD_TIME = 'add_time',
  UNLOCK_DAY = 'unlock_day',
  EMERGENCY_OVERRIDE = 'emergency_override',
}

export enum OverrideStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface OverrideParameters {
  amount?: number; // For ADD_TIME
  duration?: number; // Duration in hours
  unlimitedAccess?: boolean; // For EMERGENCY_OVERRIDE
  customSettings?: Record<string, any>;
}
```

This comprehensive technical design for Phase 4 provides a high-performance, scalable, and reliable quota management system that meets the critical <80ms validation response time requirement while following clean code principles and maintaining complete functional equivalence with the Spring Boot backend.