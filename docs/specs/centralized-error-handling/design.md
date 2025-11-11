# Centralized Error Handling - Technical Design

## Overview

This document defines the technical architecture for implementing a centralized error handling system in NestJS that eliminates TypeScript "Unsafe assignment of an error typed value" errors and provides type-safe, consistent error processing across the application.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Application                      │
├─────────────────────────────────────────────────────────────┤
│  Controllers/Services/Repositories (Business Logic)         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   Quota Service │ │  User Service   │ │   Auth Service  ││
│  │                 │ │                 │ │                 ││
│  │ throw new       │ │ throw new       │ │ throw new       ││
│  │ QuotaException │ │ UserException   │ │ AuthException   ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                Global Exception Filter                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           TypeSafeErrorFilter                           ││
│  │                                                         ││
│  │  @Catch()                                               ││
│  │  catch(exception: unknown, host: ArgumentsHost)        ││
│  │  - Extract error details safely                         ││
│  │  - Determine HTTP status code                          ││
│  │  - Format standardized response                        ││
│  │  - Log error with context                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 Error Handling Infrastructure                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   ErrorHandler  │ │ Custom Exceptions│ │   Response      ││
│  │   Utilities     │ │   Hierarchy     │ │   Formatter     ││
│  │                 │ │                 │ │                 ││
│  │ - safeMessage() │ │ - BusinessException│ │ - formatJSON()  ││
│  │ - safeStack()   │ │ - QuotaException │ │ - headers()     ││
│  │ - isKnownError()│ │ - AuthException  │ │ - status()      ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. ErrorHandler Utility Service
**Purpose**: Centralized, type-safe error processing utilities
**Key Methods**:
- `safeMessage(error: unknown): string` - Extract error message safely
- `safeStack(error: unknown): string | undefined` - Extract stack trace safely
- `isKnownError(error: unknown): boolean` - Type guard for Error objects
- `toErrorResponse(error: unknown): ErrorResponse` - Convert to response format

#### 2. Custom Exception Hierarchy
**Purpose**: Domain-specific exceptions with proper metadata
**Base Classes**:
- `BusinessException` - Base for all business logic errors
- `ValidationException` - Data validation errors
- `InfrastructureException` - External service errors

#### 3. Global Exception Filter
**Purpose**: Intercepts all exceptions and standardizes responses
**Features**:
- Type-safe error processing
- Context-aware response handling (HTTP, WebSocket, RPC)
- Structured logging with request tracing
- Performance monitoring integration

## Clean Code Principles Analysis

### DRY (Don't Repeat Yourself)

**Current Issues**:
```typescript
// Repeated in multiple services - DRY violation
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  this.logger.error('Operation failed', errorMessage);
}
```

**Solution**: Centralized ErrorHandler utilities
```typescript
// Single source of truth - DRY compliant
} catch (error) {
  const errorMessage = this.errorHandler.safeMessage(error);
  this.logger.error('Operation failed', errorMessage);
}
```

**Benefits**:
- Eliminates duplicate error processing logic
- Single location for error handling patterns
- Consistent error message extraction across all services
- Easier maintenance and updates

### SOLID Principles

#### Single Responsibility Principle (SRP)
**Applied Design**:
- `ErrorHandler`: Only handles error type safety and extraction
- `BusinessException`: Only represents business logic errors
- `TypeSafeErrorFilter`: Only handles exception filtering and response formatting
- `ResponseFormatter`: Only handles response structure standardization

**Benefits**:
- Each class has one clear purpose
- Easier to test and maintain
- Clear separation of concerns

#### Open/Closed Principle (OCP)
**Applied Design**:
```typescript
// Open for extension, closed for modification
export abstract class BusinessException extends HttpException {
  constructor(message: string, status: HttpStatus, cause?: Error) {
    super(message, status, { cause });
  }
}

// New exception types can extend without modifying base
export class QuotaExceededException extends BusinessException {
  constructor(quotaId: string, currentUsage: number, limit: number) {
    super(`Quota ${quotaId} exceeded. Current: ${currentUsage}, Limit: ${limit}`,
          HttpStatus.BAD_REQUEST);
  }
}
```

**Benefits**:
- New exception types can be added without changing existing code
- Error handling logic can be extended without modification
- Plugin architecture for custom error processors

#### Liskov Substitution Principle (LSP)
**Applied Design**:
```typescript
// All custom exceptions can be used as HttpException
function handleException(error: HttpException) {
  // Works for BusinessException, QuotaException, etc.
  return error.getStatus();
}
```

**Benefits**:
- All custom exceptions are substitutable for HttpException
- Polymorphic behavior maintains contract compatibility
- Existing NestJS exception handling continues to work

#### Interface Segregation Principle (ISP)
**Applied Design**:
```typescript
// Focused interfaces for specific error handling needs
export interface IErrorExtractor {
  safeMessage(error: unknown): string;
  safeStack(error: unknown): string | undefined;
}

export interface IResponseFormatter {
  formatError(exception: unknown, host: ArgumentsHost): any;
}

export interface ILogger {
  logError(message: string, context: any): void;
}
```

**Benefits**:
- Clients only depend on methods they actually use
- Smaller, focused interfaces are easier to implement
- Better testability and mockability

#### Dependency Inversion Principle (DIP)
**Applied Design**:
```typescript
@Injectable()
export class TypeSafeErrorFilter implements ExceptionFilter {
  constructor(
    private readonly errorHandler: IErrorExtractor,
    private readonly responseFormatter: IResponseFormatter,
    private readonly logger: ILogger,
  ) {}
}
```

**Benefits**:
- Filter depends on abstractions, not concretions
- Easy to swap implementations for testing
- Better modularity and testability

### YAGNI (You Ain't Gonna Need It)

**Applied Decisions**:
- **Implemented**: Essential error handling utilities (safeMessage, safeStack)
- **Avoided**: Complex error classification system with machine learning
- **Implemented**: Basic custom exception hierarchy
- **Avoided**: Advanced error analytics and reporting dashboard
- **Implemented**: Standardized response formatting
- **Avoided**: Multiple response format support (JSON, XML, etc.)

**Benefits**:
- Focused on solving current problems
- Reduced complexity and maintenance burden
- Faster implementation and delivery
- Easier to understand and use

## Design Pattern Analysis

### Strategy Pattern Implementation

**Problem**: Different error types require different handling strategies
**Solution**: Strategy pattern for error processing

```typescript
// Strategy interface
export interface IErrorStrategy {
  canHandle(error: unknown): boolean;
  handle(error: unknown, host: ArgumentsHost): void;
}

// Concrete strategies
export class HttpExceptionStrategy implements IErrorStrategy {
  canHandle(error: unknown): boolean {
    return error instanceof HttpException;
  }

  handle(error: HttpException, host: ArgumentsHost): void {
    // Handle HTTP exceptions
  }
}

export class BusinessExceptionStrategy implements IErrorStrategy {
  canHandle(error: unknown): boolean {
    return error instanceof BusinessException;
  }

  handle(error: BusinessException, host: ArgumentsHost): void {
    // Handle business exceptions with additional context
  }
}

// Context
export class ErrorContext {
  private strategies: IErrorStrategy[] = [
    new HttpExceptionStrategy(),
    new BusinessExceptionStrategy(),
    new UnknownErrorStrategy(),
  ];

  handleError(error: unknown, host: ArgumentsHost): void {
    const strategy = this.strategies.find(s => s.canHandle(error));
    strategy?.handle(error, host);
  }
}
```

**Trade-off Analysis**:
- **Pros**: Extensible, follows OCP, easy to add new error types
- **Cons**: More complex than simple if/else, additional classes
- **Decision**: Use strategy pattern for complex error handling scenarios

### Template Method Pattern Implementation

**Problem**: Standardize error processing flow while allowing customization
**Solution**: Template method for error processing

```typescript
export abstract class BaseErrorProcessor {
  // Template method
  public processError(error: unknown, host: ArgumentsHost): void {
    const errorInfo = this.extractErrorInfo(error);
    const response = this.formatResponse(errorInfo, host);
    this.logError(errorInfo, host);
    this.sendResponse(response, host);
  }

  // Steps to be implemented by subclasses
  protected abstract extractErrorInfo(error: unknown): ErrorInfo;
  protected abstract formatResponse(errorInfo: ErrorInfo, host: ArgumentsHost): any;

  // Common steps
  protected logError(errorInfo: ErrorInfo, host: ArgumentsHost): void {
    this.logger.error('Error occurred', errorInfo);
  }

  protected sendResponse(response: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    ctx.getResponse().status(response.statusCode).json(response);
  }
}
```

**Trade-off Analysis**:
- **Pros**: Standardized process, customizable steps, code reuse
- **Cons**: Inheritance complexity, rigid structure
- **Decision**: Use template method for consistent error processing flow

### Factory Pattern Implementation

**Problem**: Create appropriate exception objects based on context
**Solution**: Factory for exception creation

```typescript
export class ExceptionFactory {
  static createBusinessError(
    type: 'QUOTA_EXCEEDED' | 'VALIDATION_FAILED' | 'INSUFFICIENT_PERMISSIONS',
    details: Record<string, any>,
    cause?: Error,
  ): BusinessException {
    switch (type) {
      case 'QUOTA_EXCEEDED':
        return new QuotaExceededException(details.quotaId, details.currentUsage, details.limit, cause);
      case 'VALIDATION_FAILED':
        return new ValidationException(details.field, details.value, details.constraint, cause);
      case 'INSUFFICIENT_PERMISSIONS':
        return new InsufficientPermissionsException(details.resource, details.action, cause);
      default:
        return new BusinessException('Unknown business error', HttpStatus.INTERNAL_SERVER_ERROR, cause);
    }
  }
}
```

**Trade-off Analysis**:
- **Pros**: Centralized creation logic, type safety, consistent object creation
- **Cons**: Additional factory class, potential over-engineering for simple cases
- **Decision**: Use factory for complex exception creation with multiple parameters

## NestJS Implementation Research and Comparison

### Exception Filter Registration Approaches

#### Approach 1: APP_FILTER Provider Token
```typescript
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: TypeSafeErrorFilter,
    },
  ],
})
export class AppModule {}
```

**Pros**:
- Supports dependency injection
- NestJS manages lifecycle
- Can inject other services
- Framework standard approach

**Cons**:
- Requires module configuration
- Slightly more setup

**Score**: 5/5

#### Approach 2: Global Filter Registration
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new TypeSafeErrorFilter());
  await app.listen(3000);
}
```

**Pros**:
- Simple setup
- No module configuration needed
- Immediate availability

**Cons**:
- No dependency injection support
- Manual instance management
- Limited flexibility

**Score**: 3/5

#### Approach 3: Hybrid Approach with HTTP Adapter
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new TypeSafeErrorFilter(httpAdapter));
  await app.listen(3000);
}
```

**Pros**:
- Works with BaseExceptionFilter
- Platform-agnostic
- Good for extending base filters

**Cons**:
- Complex setup
- Manual dependency management

**Score**: 4/5

**Decision**: Use APP_FILTER approach for full dependency injection support and NestJS convention compliance.

### Error Context Handling Patterns

#### Approach 1: ArgumentsHost Switching
```typescript
catch(exception: unknown, host: ArgumentsHost): void {
  if (host.getType() === 'http') {
    const ctx = host.switchToHttp();
    // Handle HTTP errors
  } else if (host.getType() === 'ws') {
    const ctx = host.switchToWs();
    // Handle WebSocket errors
  }
}
```

**Pros**:
- Built-in NestJS support
- Type-safe context switching
- Handles multiple transport types

**Cons**:
- Manual type checking
- Repetitive context handling

**Score**: 4/5

#### Approach 2: Specialized Filters
```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    // HTTP-specific handling
  }
}

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost): void {
    // WebSocket-specific handling
  }
}
```

**Pros**:
- Specialized handling per context
- Clear separation of concerns
- Type-safe parameters

**Cons**:
- Multiple filter classes
- More code to maintain

**Score**: 4/5

#### Approach 3: Unified Filter with Context Strategy
```typescript
@Injectable()
export class TypeSafeErrorFilter implements ExceptionFilter {
  constructor(
    private readonly httpStrategy: IHttpErrorStrategy,
    private readonly wsStrategy: IWebSocketErrorStrategy,
    private readonly rpcStrategy: IRpcErrorStrategy,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const strategy = this.getStrategy(host.getType());
    strategy.handle(exception, host);
  }
}
```

**Pros**:
- Clean architecture
- Strategy pattern benefits
- Extensible to new contexts

**Cons**:
- More complex setup
- Multiple strategy classes

**Score**: 5/5

**Decision**: Use unified filter with context strategy for maximum flexibility and maintainability.

## Architecture Quality Assessment

### Cohesion Analysis
**High Cohesion Achieved**:
- ErrorHandler service focuses solely on type-safe error operations
- Custom exceptions each represent specific error domains
- Global filter handles only exception processing and response formatting
- Response formatter deals only with response structure standardization

**Benefits**:
- Related functionality is grouped together
- Easy to understand and maintain
- Clear boundaries between responsibilities

### Coupling Analysis
**Low Coupling Achieved**:
- Exception filter depends on abstractions (interfaces) not concretions
- Error utilities are self-contained with no external dependencies
- Custom exceptions extend framework classes but don't depend on business logic
- Response formatter is independent of error processing logic

**Benefits**:
- Components can be tested in isolation
- Easy to swap implementations
- Reduced impact of changes

### Separation of Concerns Validation
**Clear Boundaries**:
- **Error Type Safety**: ErrorHandler utilities
- **Business Logic**: Custom exception classes
- **Response Processing**: Global exception filter
- **Formatting**: Response formatter utilities
- **Logging**: Structured logging integration

**Benefits**:
- Each component has a single, well-defined responsibility
- Changes in one area don't affect others
- Easy to locate and fix issues

### Dependency Direction Analysis
**Proper Dependency Flow**:
```
Controllers/Services → Custom Exceptions → HttpException
                     ↓
Global Exception Filter → ErrorHandler (Interface) → ErrorHandler (Implementation)
                     ↓
Response Formatter (Interface) → Response Formatter (Implementation)
```
**Benefits**:
- Dependencies point inward toward business logic
- Framework dependencies are externalized
- Clear dependency hierarchy

## Integration with Existing Systems

### Quota Management System Integration
**Current Issues**:
```typescript
// Current problematic code in quota-validation.service.ts
} catch (error) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const errorMessage = error instanceof Error ? error.message : String(error);
  this.logger.error('Quota validation error', errorMessage, { requestId, request });
}
```

**Enhanced Solution**:
```typescript
// Updated code with centralized error handling
} catch (error) {
  const errorMessage = this.errorHandler.safeMessage(error);
  const errorContext = this.errorHandler.createContext(error, { requestId, request });
  this.logger.error('Quota validation error', errorMessage, errorContext);
  throw new QuotaValidationException(errorMessage, errorContext);
}
```

### Authentication System Integration
**Current Issues**:
```typescript
// Current problematic code in ws-jwt.guard.ts
try {
  const payload = jwt.verify(token, secret) as JwtClaims;
  // Unsafe member access on payload
} catch {
  throw new UnauthorizedException('Invalid token');
}
```

**Enhanced Solution**:
```typescript
// Updated code with proper error handling
try {
  const payload = this.jwtService.verify(token) as JwtClaims;
  client.data.user = { id: payload.sub, householdId: payload.householdId };
  return true;
} catch (error) {
  const errorMessage = this.errorHandler.safeMessage(error);
  this.logger.warn('JWT verification failed', errorMessage, { token: token.substring(0, 10) + '...' });
  throw new UnauthorizedException('Invalid authentication token');
}
```

## Performance Considerations

### Error Processing Overhead
**Target**: <5ms additional overhead for error processing
**Optimizations**:
- Cache error response templates
- Use object pooling for frequent error objects
- Lazy load expensive error processing operations
- Minimize string operations in error handling

### Memory Usage
**Considerations**:
- Error object creation should be minimized
- Stack trace collection should be configurable
- Error context should be bounded in size
- Use weak references for error context where possible

### Scaling Considerations
**High Volume Error Scenarios**:
- Implement error rate limiting
- Use asynchronous logging for error events
- Consider sampling for detailed error reporting
- Implement circuit breakers for external error dependencies

## Testing Strategy

### Unit Testing
**Coverage Requirements**:
- ErrorHandler utilities: 100% coverage
- Custom exception classes: 100% coverage
- Global exception filter: 95% coverage
- Response formatter: 100% coverage

### Integration Testing
**Test Scenarios**:
- HTTP context error handling
- WebSocket context error handling
- RPC context error handling
- Cross-module error propagation
- Performance benchmarks

### Error Injection Testing
**Test Approach**:
- Use dependency injection to mock error scenarios
- Test all error types and contexts
- Validate response format consistency
- Verify logging and monitoring integration

## Security Considerations

### Information Disclosure Prevention
**Safe Error Responses**:
- Sanitize stack traces for production
- Limit error detail exposure in client responses
- Implement error rate limiting to prevent information harvesting
- Use generic error messages for security-sensitive operations

### Error Logging Security
**Secure Logging Practices**:
- Sanitize PII from error logs
- Use secure log storage and transmission
- Implement log rotation and retention policies
- Monitor for error-based attack patterns

## Monitoring and Observability

### Error Metrics
**Key Performance Indicators**:
- Error rate by endpoint and service
- Error processing latency
- Error type distribution
- Error recovery success rate

### Alerting
**Alert Conditions**:
- Sudden spike in error rate
- New error types introduced
- Error processing latency exceeding thresholds
- Critical system errors affecting core functionality

### Distributed Tracing
**Integration Points**:
- Correlate errors across service boundaries
- Track error propagation through call chains
- Maintain request context through error handling
- Integrate with existing observability platform

## Decision Rationale

### Architecture Decisions

**1. Global Exception Filter Approach**
**Decision**: Use APP_FILTER with dependency injection
**Rationale**: Maximum flexibility, follows NestJS conventions, supports testing
**Trade-offs**: Slightly more complex setup vs. better maintainability

**2. Error Utility Service Design**
**Decision**: Centralized ErrorHandler with type-safe methods
**Rationale**: Eliminates code duplication, provides consistent error processing
**Trade-offs**: Additional service layer vs. significant DRY improvements

**3. Custom Exception Hierarchy**
**Decision**: Extend HttpException for business logic errors
**Rationale**: Framework compatibility, type safety, domain-specific error handling
**Trade-offs**: More classes vs. better error semantics and type safety

**4. Strategy Pattern for Context Handling**
**Decision**: Use strategy pattern for different transport types
**Rationale**: Extensibility, maintainability, clean separation of concerns
**Trade-offs**: Increased complexity vs. better architecture and future-proofing

### Technology Decisions

**1. TypeScript Integration**
**Decision**: Leverage TypeScript 4.4+ unknown catch parameters
**Rationale**: Type safety, elimination of linting errors, better developer experience
**Trade-offs**: Learning curve vs. significant error handling improvements

**2. NestJS Framework Features**
**Decision**: Use built-in exception filter mechanism
**Rationale**: Framework compatibility, community support, proven patterns
**Trade-offs**: Framework lock-in vs. robust, well-tested patterns

**3. Logging Integration**
**Decision**: Integrate with existing structured logging
**Rationale**: Consistency, observability, debugging capabilities
**Trade-offs**: Additional dependency vs. essential monitoring capabilities

## Conclusion

This technical design provides a comprehensive, type-safe, and maintainable centralized error handling system that eliminates TypeScript "Unsafe assignment of an error typed value" errors while following clean code principles and NestJS best practices.

**Key Benefits**:
- **Type Safety**: Eliminates all TypeScript error handling linting errors
- **Consistency**: Standardized error processing across the entire application
- **Maintainability**: Centralized error logic with clear separation of concerns
- **Extensibility**: Easy to add new error types and handling strategies
- **Performance**: Minimal overhead with optimized error processing
- **Developer Experience**: Intuitive patterns and comprehensive documentation

The architecture successfully balances clean code principles, design patterns, and practical implementation considerations to deliver a robust solution that addresses current problems while providing a foundation for future growth.

---

**Design Approved By**: [Architecture Review Board]
**Date**: November 1, 2024
**Version**: 1.0