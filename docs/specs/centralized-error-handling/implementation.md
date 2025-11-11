# Centralized Error Handling - Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the centralized error handling system based on the requirements specification and technical design. The implementation will proceed in phases to ensure systematic integration with minimal disruption to existing functionality.

## Phase 1: Foundation Implementation (Week 1)

### Task 1.1: Create Error Handling Utilities

**Objective**: Implement type-safe error processing utilities

**Files to Create**:
- `src/shared/errors/error-handler.service.ts`
- `src/shared/errors/error-extractor.utility.ts`
- `src/shared/errors/types/error.types.ts`

**Implementation Details**:

```typescript
// src/shared/errors/types/error.types.ts
export interface ErrorInfo {
  message: string;
  stack?: string;
  name?: string;
  cause?: Error;
  context?: Record<string, any>;
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path?: string;
  requestId?: string;
  details?: Record<string, any>;
}

// src/shared/errors/error-extractor.utility.ts
export class ErrorExtractor {
  static safeMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
  }

  static safeStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  static isKnownError(error: unknown): error is Error {
    return error instanceof Error;
  }

  static toErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo {
    return {
      message: this.safeMessage(error),
      stack: this.safeStack(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      cause: error instanceof Error && error.cause ? error.cause : undefined,
      context,
    };
  }
}

// src/shared/errors/error-handler.service.ts
@Injectable()
export class ErrorHandlerService {
  constructor(private readonly logger: Logger) {}

  safeMessage(error: unknown): string {
    return ErrorExtractor.safeMessage(error);
  }

  safeStack(error: unknown): string | undefined {
    return ErrorExtractor.safeStack(error);
  }

  createContext(error: unknown, additional?: Record<string, any>): Record<string, any> {
    const baseContext = {
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      hasStack: !!ErrorExtractor.safeStack(error),
    };

    return {
      ...baseContext,
      ...additional,
    };
  }

  logError(message: string, error: unknown, context?: Record<string, any>): void {
    const errorInfo = ErrorExtractor.toErrorInfo(error, context);
    this.logger.error(message, errorInfo.message, errorInfo);
  }
}
```

**Package Documentation Requirements**:
- **TypeScript Error Handling Patterns**: Query latest TypeScript documentation for error handling best practices
- **NestJS Service Patterns**: Query NestJS documentation for @Injectable() service implementation patterns

**Acceptance Criteria**:
- All utility methods have comprehensive unit tests
- Type safety is verified with TypeScript strict mode
- Error extraction works for all common error types
- Logger integration is functional

### Task 1.2: Implement Custom Exception Hierarchy

**Objective**: Create domain-specific exception classes

**Files to Create**:
- `src/shared/errors/exceptions/business.exception.ts`
- `src/shared/errors/exceptions/quota.exception.ts`
- `src/shared/errors/exceptions/validation.exception.ts`
- `src/shared/errors/exceptions/infrastructure.exception.ts`

**Implementation Details**:

```typescript
// src/shared/errors/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  readonly businessCode: string;
  readonly details?: Record<string, any>;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    businessCode?: string,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(message, status, { cause });
    this.businessCode = businessCode || 'BUSINESS_ERROR';
    this.details = details;
  }
}

// src/shared/errors/exceptions/quota.exception.ts
export class QuotaExceededException extends BusinessException {
  constructor(
    quotaId: string,
    currentUsage: number,
    allowedLimit: number,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      `Quota ${quotaId} exceeded. Current usage: ${currentUsage}, Limit: ${allowedLimit}`,
      HttpStatus.BAD_REQUEST,
      'QUOTA_EXCEEDED',
      {
        quotaId,
        currentUsage,
        allowedLimit,
        percentageUsed: (currentUsage / allowedLimit) * 100,
        ...details,
      },
      cause,
    );
  }
}

export class QuotaValidationException extends BusinessException {
  constructor(
    message: string,
    validationErrors?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'QUOTA_VALIDATION_ERROR',
      validationErrors,
      cause,
    );
  }
}

// src/shared/errors/exceptions/validation.exception.ts
export class DetailedValidationException extends BusinessException {
  constructor(
    validationErrors: Record<string, string[]>,
    message: string = 'Validation failed',
    cause?: Error,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      { validationErrors },
      cause,
    );
  }
}

// src/shared/errors/exceptions/infrastructure.exception.ts
export class DatabaseException extends BusinessException {
  constructor(operation: string, cause?: Error) {
    super(
      `Database operation failed: ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'DATABASE_ERROR',
      { operation },
      cause,
    );
  }
}

export class ExternalServiceException extends BusinessException {
  constructor(
    service: string,
    operation: string,
    cause?: Error,
  ) {
    super(
      `External service ${service} failed during ${operation}`,
      HttpStatus.BAD_GATEWAY,
      'EXTERNAL_SERVICE_ERROR',
      { service, operation },
      cause,
    );
  }
}
```

**Package Documentation Requirements**:
- **NestJS Exception Patterns**: Query latest NestJS documentation for HttpException extension patterns
- **TypeScript Class Inheritance**: Query TypeScript documentation for advanced class patterns

**Acceptance Criteria**:
- All exceptions extend HttpException properly
- Business codes and details are included in responses
- Exception hierarchy supports polymorphic usage
- All exceptions have comprehensive test coverage

### Task 1.3: Implement Global Exception Filter

**Objective**: Create centralized exception processing filter

**Files to Create**:
- `src/shared/filters/type-safe-error.filter.ts`
- `src/shared/formatters/response-formatter.service.ts`
- `src/shared/strategies/error-strategy.interface.ts`
- `src/shared/strategies/http-error.strategy.ts`
- `src/shared/strategies/business-error.strategy.ts`
- `src/shared/strategies/unknown-error.strategy.ts`

**Implementation Details**:

```typescript
// src/shared/strategies/error-strategy.interface.ts
export interface IErrorStrategy {
  canHandle(error: unknown): boolean;
  handle(error: unknown, host: ArgumentsHost): Promise<void> | void;
  getStatusCode(error: unknown): number;
}

// src/shared/strategies/http-error.strategy.ts
@Injectable()
export class HttpErrorStrategy implements IErrorStrategy {
  canHandle(error: unknown): boolean {
    return error instanceof HttpException && !(error instanceof BusinessException);
  }

  async handle(error: HttpException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = error.getStatus();

    const errorResponse = {
      statusCode: status,
      message: error.message,
      error: error.name,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  getStatusCode(error: unknown): number {
    return (error as HttpException).getStatus();
  }
}

// src/shared/strategies/business-error.strategy.ts
@Injectable()
export class BusinessErrorStrategy implements IErrorStrategy {
  constructor(private readonly errorHandler: ErrorHandlerService) {}

  canHandle(error: unknown): boolean {
    return error instanceof BusinessException;
  }

  async handle(error: BusinessException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = error.getStatus();

    // Log business error with context
    this.errorHandler.logError('Business error occurred', error, {
      businessCode: error.businessCode,
      details: error.details,
      path: request.url,
      method: request.method,
    });

    const errorResponse = {
      statusCode: status,
      message: error.message,
      businessCode: error.businessCode,
      details: error.details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  getStatusCode(error: unknown): number {
    return (error as BusinessException).getStatus();
  }
}

// src/shared/formatters/response-formatter.service.ts
@Injectable()
export class ResponseFormatterService {
  formatSuccessResponse<T>(data: T, meta?: Record<string, any>): any {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  formatErrorResponse(errorInfo: ErrorInfo, statusCode: number, request?: any): any {
    return {
      success: false,
      error: {
        statusCode,
        message: errorInfo.message,
        code: errorInfo.name || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        path: request?.url,
        requestId: request?.id,
        details: errorInfo.context,
      },
    };
  }
}

// src/shared/filters/type-safe-error.filter.ts
@Catch()
export class TypeSafeErrorFilter implements ExceptionFilter {
  private readonly strategies: IErrorStrategy[];

  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
    httpErrorStrategy: HttpErrorStrategy,
    businessErrorStrategy: BusinessErrorStrategy,
  ) {
    this.strategies = [
      businessErrorStrategy,
      httpErrorStrategy,
      new UnknownErrorStrategy(errorHandler, responseFormatter),
    ];
  }

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    // Log the error with context
    this.errorHandler.logError('Unhandled exception caught', exception);

    // Find appropriate strategy
    const strategy = this.strategies.find(s => s.canHandle(exception));

    if (strategy) {
      await strategy.handle(exception, host);
    } else {
      // Fallback to unknown error handling
      const unknownStrategy = this.strategies[this.strategies.length - 1];
      await unknownStrategy.handle(exception, host);
    }
  }
}

// src/shared/strategies/unknown-error.strategy.ts
@Injectable()
export class UnknownErrorStrategy implements IErrorStrategy {
  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly responseFormatter: ResponseFormatterService,
  ) {}

  canHandle(error: unknown): boolean {
    return true; // Always can handle unknown errors
  }

  async handle(error: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const errorInfo = ErrorExtractor.toErrorInfo(error);

    // Log unknown error with full context
    this.errorHandler.logError('Unknown error occurred', error, {
      requestUrl: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
    });

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = this.responseFormatter.formatErrorResponse(
      errorInfo,
      statusCode,
      request,
    );

    response.status(statusCode).json(errorResponse);
  }

  getStatusCode(error: unknown): number {
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
```

**Package Documentation Requirements**:
- **NestJS Exception Filters**: Query latest NestJS documentation for exception filter implementation
- **Strategy Pattern in NestJS**: Query documentation for strategy pattern implementation with dependency injection
- **ArgumentsHost Usage**: Query documentation for context-aware response handling

**Acceptance Criteria**:
- Global filter catches all exceptions
- Strategy pattern works correctly for different error types
- Response format is consistent across all error types
- All strategies are properly unit tested

### Task 1.4: Register Global Filter and Module Setup

**Objective**: Integrate error handling into application module

**Files to Modify**:
- `src/app.module.ts`
- `src/main.ts`

**Implementation Details**:

```typescript
// src/shared/errors/shared-errors.module.ts
@Module({
  providers: [
    ErrorHandlerService,
    ResponseFormatterService,
    HttpErrorStrategy,
    BusinessErrorStrategy,
    UnknownErrorStrategy,
    {
      provide: APP_FILTER,
      useClass: TypeSafeErrorFilter,
    },
  ],
  exports: [
    ErrorHandlerService,
    ResponseFormatterService,
  ],
})
export class SharedErrorsModule {}

// src/app.module.ts
@Module({
  imports: [
    // ... existing imports
    SharedErrorsModule,
    // ... other modules
  ],
  // ... existing configuration
})
export class AppModule {
  constructor() {
    // Module setup if needed
  }
}
```

**Package Documentation Requirements**:
- **NestJS APP_FILTER Registration**: Query latest documentation for global filter registration
- **Module Configuration**: Query documentation for proper module setup and dependency injection

**Acceptance Criteria**:
- Global filter is properly registered and functional
- All dependencies are correctly injected
- Application starts without errors
- Error handling works across all modules

## Phase 2: Integration with Existing Systems (Week 2)

### Task 2.1: Update Quota Management System

**Objective**: Replace unsafe error handling in quota services

**Files to Modify**:
- `src/modules/quotas/services/quota-validation.service.ts`
- `src/modules/quotas/services/quota-usage.service.ts`
- `src/modules/quotas/quotas.controller.ts`

**Current Problematic Code**:
```typescript
// Current code in quota-validation.service.ts:54
} catch (error) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const errorMessage = error instanceof Error ? error.message : String(error);
  this.logger.error('Quota validation error', errorMessage, { requestId, request });
}
```

**Enhanced Implementation**:
```typescript
constructor(
  private readonly errorHandler: ErrorHandlerService,
  // ... other dependencies
) {}

async validateQuotaUsage(request: QuotaValidationRequest): Promise<QuotaValidationResponse> {
  const startTime = Date.now();
  const requestId = request.id;

  try {
    // ... existing validation logic
    this.recordPerformance(requestId, Date.now() - startTime, 'success');
    return validationResponse;
  } catch (error) {
    this.recordPerformance(requestId, Date.now() - startTime, 'error');

    const errorMessage = this.errorHandler.safeMessage(error);
    const errorContext = this.errorHandler.createContext(error, {
      requestId,
      request,
      operation: 'quota_validation',
    });

    this.logger.error('Quota validation error', errorMessage, errorContext);

    // Throw domain-specific exception
    throw new QuotaValidationException(
      `Quota validation failed: ${errorMessage}`,
      { originalError: errorMessage, requestId },
      error instanceof Error ? error : undefined,
    );
  }
}
```

**Package Documentation Requirements**:
- **Error Handling Best Practices**: Query latest patterns for service-level error handling
- **Quota Management System**: Query existing codebase patterns for quota operations

**Acceptance Criteria**:
- All quota services use type-safe error handling
- No ESLint errors related to unsafe error assignments
- Business logic is preserved with enhanced error reporting
- All quota-related exceptions are properly categorized

### Task 2.2: Update Authentication and Security Services

**Objective**: Enhance error handling in authentication flows

**Files to Modify**:
- `src/shared/guards/ws-jwt.guard.ts`
- `src/auth/services/auth.service.ts`
- `src/users/users.service.ts`

**Current Problematic Code**:
```typescript
// Current code in ws-jwt.guard.ts:23
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const payload = jwt.verify(token, secret) as JwtClaims;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
client.data.user = { id: payload.sub, householdId: payload.householdId };
```

**Enhanced Implementation**:
```typescript
constructor(
  private readonly config: ConfigService,
  private readonly errorHandler: ErrorHandlerService,
) {}

canActivate(context: ExecutionContext): boolean {
  const client: Socket = context.switchToWs().getClient();
  const token = (client.handshake.query?.token as string) || '';

  if (!token) {
    throw new UnauthorizedException('Authentication token is required');
  }

  try {
    const secret = this.config.get<string>('jwt.secret')!;
    const payload = this.jwtService.verify(token) as JwtClaims;

    // Validate payload structure
    if (!payload.sub || !payload.householdId) {
      throw new UnauthorizedException('Invalid token structure');
    }

    client.data.user = {
      id: payload.sub,
      householdId: payload.householdId
    };

    return true;
  } catch (error) {
    const errorMessage = this.errorHandler.safeMessage(error);

    this.logger.warn('JWT authentication failed', errorMessage, {
      tokenPrefix: token.substring(0, 10) + '...',
      clientId: client.id,
    });

    throw new UnauthorizedException('Invalid authentication token');
  }
}
```

**Package Documentation Requirements**:
- **JWT Error Handling**: Query latest patterns for JWT token validation errors
- **WebSocket Authentication**: Query documentation for Socket.IO authentication best practices

**Acceptance Criteria**:
- JWT validation uses type-safe error handling
- Authentication errors provide appropriate detail levels
- WebSocket connections are properly secured
- No sensitive information is leaked in error messages

### Task 2.3: Update Database and External Service Integration

**Objective**: Enhance error handling for data access and external calls

**Files to Modify**:
- `src/shared/database/database.health.ts`
- `src/shared/redis/redis.service.ts` (if exists)
- External service integrations

**Current Problematic Code**:
```typescript
// Current code in database.health.ts:19
const errorMessage = error instanceof Error ? error.message : String(error);
```

**Enhanced Implementation**:
```typescript
constructor(
  private readonly errorHandler: ErrorHandlerService,
) {}

async isHealthy(): Promise<boolean> {
  try {
    await this.dataSource.query('SELECT 1');
    this.logger.debug('Database health check passed');
    return true;
  } catch (error) {
    const errorMessage = this.errorHandler.safeMessage(error);
    const errorContext = this.errorHandler.createContext(error, {
      operation: 'database_health_check',
      database: this.dataSource.options.database,
    });

    this.logger.error('Database health check failed', errorMessage, errorContext);
    return false;
  }
}

async getDetailedStatus(): Promise<DatabaseHealthStatus> {
  try {
    const result = await this.dataSource.query('SELECT 1 as test');
    return {
      status: 'up',
      details: {
        connected: true,
        database: this.dataSource.options.database,
        host: this.dataSource.options.host,
        port: this.dataSource.options.port,
      },
    };
  } catch (error) {
    throw new DatabaseException('health_check', error instanceof Error ? error : undefined);
  }
}
```

**Package Documentation Requirements**:
- **Database Error Handling**: Query TypeORM and NestJS documentation for database error patterns
- **Health Check Implementation**: Query best practices for health check error handling

**Acceptance Criteria**:
- Database operations use type-safe error handling
- Health checks provide meaningful error information
- External service failures are properly categorized
- Connection errors don't expose sensitive information

## Phase 3: Validation and Testing (Week 3)

### Task 3.1: Comprehensive Testing Implementation

**Objective**: Ensure complete test coverage for error handling

**Files to Create**:
- `test/unit/shared/errors/error-handler.service.spec.ts`
- `test/unit/shared/errors/exceptions/*.spec.ts`
- `test/unit/shared/filters/type-safe-error.filter.spec.ts`
- `test/integration/error-handling.spec.ts`

**Test Implementation Details**:

```typescript
// test/unit/shared/errors/error-handler.service.spec.ts
describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let logger: Logger;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ErrorHandlerService,
        {
          provide: Logger,
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ErrorHandlerService>(ErrorHandlerService);
    logger = module.get<Logger>(Logger);
  });

  describe('safeMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error');
      expect(service.safeMessage(error)).toBe('Test error');
    });

    it('should handle string errors', () => {
      const error = 'String error';
      expect(service.safeMessage(error)).toBe('String error');
    });

    it('should handle unknown objects', () => {
      const error = { custom: 'error' };
      expect(service.safeMessage(error)).toBe('[object Object]');
    });

    it('should handle null values', () => {
      expect(service.safeMessage(null)).toBe('null');
    });
  });

  describe('createContext', () => {
    it('should create context with timestamp', () => {
      const error = new Error('Test');
      const context = service.createContext(error, { custom: 'value' });

      expect(context).toHaveProperty('timestamp');
      expect(context).toHaveProperty('errorType', 'Error');
      expect(context).toHaveProperty('hasStack', true);
      expect(context).toHaveProperty('custom', 'value');
    });
  });
});

// test/unit/shared/filters/type-safe-error.filter.spec.ts
describe('TypeSafeErrorFilter', () => {
  let filter: TypeSafeErrorFilter;
  let errorHandler: ErrorHandlerService;
  let responseFormatter: ResponseFormatterService;
  let mockHost: ArgumentsHost;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TypeSafeErrorFilter,
        ErrorHandlerService,
        ResponseFormatterService,
        HttpErrorStrategy,
        BusinessErrorStrategy,
        UnknownErrorStrategy,
      ],
    }).compile();

    filter = module.get<TypeSafeErrorFilter>(TypeSafeErrorFilter);
    errorHandler = module.get<ErrorHandlerService>(ErrorHandlerService);
    responseFormatter = module.get<ResponseFormatterService>(ResponseFormatterService);
  });

  describe('catch', () => {
    it('should handle HttpException correctly', async () => {
      const error = new BadRequestException('Bad request');
      mockHost = createMockArgumentsHost();

      await filter.catch(error, mockHost);

      // Verify response format and status
    });

    it('should handle BusinessException correctly', async () => {
      const error = new QuotaExceededException('quota1', 100, 50);
      mockHost = createMockArgumentsHost();

      await filter.catch(error, mockHost);

      // Verify business error handling
    });

    it('should handle unknown errors correctly', async () => {
      const error = { type: 'unknown' };
      mockHost = createMockArgumentsHost();

      await filter.catch(error, mockHost);

      // Verify unknown error handling
    });
  });
});

// test/integration/error-handling.spec.ts
describe('Error Handling Integration', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Global Error Handling', () => {
    it('should handle quota validation errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/quotas/validate')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('businessCode', 'QUOTA_VALIDATION_ERROR');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle authentication errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/protected')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Unauthorized');
      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error scenario
      const response = await request(app.getHttpServer())
        .get('/api/health/database')
        .expect(500);

      expect(response.body).toHaveProperty('businessCode', 'DATABASE_ERROR');
    });
  });
});
```

**Package Documentation Requirements**:
- **NestJS Testing Documentation**: Query latest testing patterns for exception filters
- **Jest Testing Framework**: Query documentation for advanced testing patterns
- **Mock Testing Patterns**: Query documentation for mocking complex dependencies

**Acceptance Criteria**:
- All error handling components have 95%+ test coverage
- Integration tests verify end-to-end error processing
- Mock testing covers all error scenarios
- Performance tests meet <5ms overhead requirement

### Task 3.2: Performance Validation

**Objective**: Ensure error handling meets performance requirements

**Performance Test Implementation**:

```typescript
// test/performance/error-handling.performance.spec.ts
describe('Error Handling Performance', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] })
      .compile()
      .createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should process errors within 5ms', async () => {
    const iterations = 1000;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await request(app.getHttpServer())
        .post('/api/test/error')
        .send({ triggerError: true })
        .expect(400);

      const end = performance.now();
      times.push(end - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(averageTime).toBeLessThan(5); // Average under 5ms
    expect(maxTime).toBeLessThan(20); // No single request over 20ms
  });

  it('should handle high error volume without performance degradation', async () => {
    const concurrentRequests = 100;
    const requests = Array.from({ length: concurrentRequests }, () =>
      request(app.getHttpServer())
        .post('/api/test/error')
        .send({ triggerError: true })
    );

    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();

    expect(end - start).toBeLessThan(1000); // All requests within 1 second
    results.forEach(response => {
      expect(response.status).toBe(400);
    });
  });
});
```

**Package Documentation Requirements**:
- **Node.js Performance Testing**: Query documentation for performance measurement patterns
- **Load Testing Tools**: Query documentation for concurrent request testing

**Acceptance Criteria**:
- Average error processing time <5ms
- No memory leaks during high error volume
- Concurrent error handling maintains performance
- Error handling doesn't impact successful request performance

### Task 3.3: Documentation and Developer Experience

**Objective**: Provide comprehensive documentation for developers

**Documentation Files to Create**:
- `docs/developer/error-handling-guide.md`
- `docs/developer/custom-exceptions.md`
- `docs/developer/error-patterns.md`

**Documentation Content**:

```markdown
# docs/developer/error-handling-guide.md
# Error Handling Developer Guide

## Quick Start

### Throwing Custom Exceptions
```typescript
import { QuotaExceededException } from '@shared/errors/exceptions';

// In your service
if (currentUsage > allowedLimit) {
  throw new QuotaExceededException(quotaId, currentUsage, allowedLimit);
}
```

### Handling Errors Safely
```typescript
import { ErrorHandlerService } from '@shared/errors/error-handler.service';

constructor(private readonly errorHandler: ErrorHandlerService) {}

async someOperation() {
  try {
    await riskyOperation();
  } catch (error) {
    const message = this.errorHandler.safeMessage(error);
    const context = this.errorHandler.createContext(error, { operation: 'riskyOp' });
    this.logger.error('Operation failed', message, context);
    throw new BusinessException(message, HttpStatus.INTERNAL_SERVER_ERROR, 'OPERATION_FAILED', context);
  }
}
```

## Response Format

All errors follow this consistent format:
```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Quota daily_limit exceeded. Current usage: 100, Limit: 50",
    "businessCode": "QUOTA_EXCEEDED",
    "details": {
      "quotaId": "daily_limit",
      "currentUsage": 100,
      "allowedLimit": 50,
      "percentageUsed": 200
    },
    "timestamp": "2024-11-01T10:00:00.000Z",
    "path": "/api/quotas/check"
  }
}
```

## Best Practices

1. **Always use custom exceptions** for business logic errors
2. **Include relevant context** when throwing exceptions
3. **Never expose sensitive information** in error messages
4. **Use ErrorHandlerService** for safe error processing
5. **Log errors with sufficient context** for debugging
```

**Package Documentation Requirements**:
- **Technical Writing Best Practices**: Query documentation for developer guide patterns
- **Markdown Documentation**: Query documentation for technical documentation standards

**Acceptance Criteria**:
- All error handling patterns are documented
- Examples are provided for common use cases
- Documentation is accessible and easy to follow
- Code examples are tested and verified

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create error handling utilities
- [ ] Implement custom exception hierarchy
- [ ] Build global exception filter
- [ ] Register global filter in application module
- [ ] Add comprehensive unit tests

### Phase 2: Integration
- [ ] Update quota management system
- [ ] Enhance authentication error handling
- [ ] Improve database error handling
- [ ] Update external service integrations
- [ ] Add integration tests

### Phase 3: Validation
- [ ] Complete test coverage (>95%)
- [ ] Performance validation (<5ms overhead)
- [ ] Create developer documentation
- [ ] Conduct code review
- [ ] Deploy to staging environment

## Quality Gates

### TypeScript Validation
```bash
# Must pass with zero errors
pnpm build
pnpm lint
```

### Test Coverage
```bash
# Must achieve 95%+ coverage
pnpm test:cov
```

### Performance Benchmarks
```bash
# Must meet performance requirements
pnpm test:performance
```

### Security Validation
```bash
# Must pass security checks
pnpm audit
pnpm test:security
```

## Risk Mitigation Strategies

### Technical Risks
- **Breaking Changes**: Incremental deployment with feature flags
- **Performance Impact**: Continuous monitoring and rollback procedures
- **Integration Issues**: Comprehensive testing in staging environment

### Operational Risks
- **Deployment Complexity**: Step-by-step deployment guide
- **Knowledge Transfer**: Team training sessions and documentation
- **Monitoring**: Enhanced alerting for error patterns

## Success Metrics

### Primary Metrics
- **Zero TypeScript Errors**: All "Unsafe assignment of an error typed value" errors eliminated
- **Performance**: <5ms average error processing time
- **Coverage**: 95%+ test coverage for error handling code

### Secondary Metrics
- **Developer Satisfaction**: Feedback from development team
- **Code Quality**: Reduction in code duplication for error handling
- **Incident Response**: Improved debugging capabilities with structured error information

## Rollback Plan

If critical issues are discovered during deployment:

1. **Immediate Actions**:
   - Disable new error handling via feature flag
   - Restore previous error handling patterns
   - Monitor system stability

2. **Investigation**:
   - Analyze logs and metrics
   - Identify root cause
   - Develop fix

3. **Recovery**:
   - Test fix in staging environment
   - Deploy corrected version
   - Monitor for issues

## Package Documentation Requirements Summary

Throughout implementation, the following documentation must be queried using Context7:

1. **TypeScript 4.4+ Error Handling**: Latest patterns for unknown catch parameters
2. **NestJS Exception Filters**: Current best practices for filter implementation
3. **Dependency Injection Patterns**: Service registration and injection patterns
4. **Testing Patterns**: Unit and integration testing for error scenarios
5. **Performance Optimization**: Error handling performance best practices
6. **Security Patterns**: Safe error information handling

## Conclusion

This implementation plan provides a comprehensive, phased approach to implementing centralized error handling that eliminates TypeScript "Unsafe assignment of an error typed value" errors while improving code quality, maintainability, and developer experience.

The phased approach ensures minimal disruption to existing systems while providing robust testing and validation at each stage. The result will be a type-safe, performant, and maintainable error handling system that follows NestJS best practices and clean code principles.

---

**Implementation Approved By**: [Technical Lead]
**Date**: November 1, 2024
**Version**: 1.0
**Next Phase**: Development and Implementation