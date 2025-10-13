# Design Document

## Overview

This design document outlines the architecture for refactoring the frontend communication layer to use axios for REST API calls and reconnecting-websocket for WebSocket connections. The migration will improve reliability, error handling, and developer experience while modernizing the communication infrastructure and maintaining backward compatibility with existing components.

**Design Decision Rationale:** The choice of reconnecting-websocket over socket.io-client aligns with the project's need for lightweight, reliable WebSocket connections without the overhead of socket.io's additional features. This approach maintains simplicity while providing automatic reconnection capabilities essential for real-time air conditioning control and quota monitoring.

## Architecture

### High-Level Architecture

The new architecture separates concerns between REST API communication (axios) and real-time communication (reconnecting-websocket), with centralized configuration and error handling.

**Core Components:**
- **Axios Client Layer**: Centralized HTTP client with interceptors and authentication
- **Reconnecting-WebSocket Client Layer**: Real-time communication with automatic reconnection and message queuing
- **Configuration Management**: Centralized config for both HTTP and WebSocket with environment support
- **Error Handling**: Consistent error handling and logging across both communication types
- **Type Safety Layer**: Comprehensive TypeScript support with enhanced developer experience
- **Performance Monitoring**: Bundle size optimization and runtime performance tracking
- **Testing Infrastructure**: Comprehensive testing support for both HTTP and WebSocket clients

### REST API Architecture (Axios)

**Components:**
1. **Core Axios Client** (`lib/http/axios-client.ts`)
   - Centralized axios instance
   - Request/response interceptors
   - Authentication integration
   - Error transformation

2. **API Client Adapters**
   - Family API Client
   - Quota API Client  
   - Auth API Client

3. **Interceptors**
   - Authentication interceptor with automatic token refresh
   - Error handling interceptor with consistent error transformation
   - Logging interceptor with debug mode support
   - Retry interceptor with exponential backoff
   - Request cancellation and deduplication support
   - Performance monitoring interceptor for request timing

### WebSocket Architecture (Reconnecting-WebSocket)

**Components:**
1. **Core Reconnecting-WebSocket Client** (`lib/websocket/reconnecting-websocket-client.ts`)
   - Connection management
   - Authentication integration
   - Message handling
   - Automatic reconnection logic

2. **WebSocket Adapters**
   - General WebSocket client
   - Quota-specific WebSocket
   - Custom React hooks

3. **Message Management**
   - Message queuing during disconnection periods
   - Connection state tracking with React integration
   - Error handling and automatic recovery
   - Message acknowledgment and validation

## Components and Interfaces

### 1. Core Axios Client

**File:** `lib/http/axios-client.ts`

**Purpose:** Centralized axios instance with comprehensive interceptor support.

**Key Features:**
- Automatic authentication header injection with Bearer token support
- Token refresh handling with automatic retry of failed requests
- Request/response transformation and validation
- Error standardization with consistent ApiError format
- Retry logic with exponential backoff and configurable limits
- Request/response logging with debug mode support
- Request cancellation and deduplication for concurrent requests
- Configurable timeout handling
- Performance monitoring with request timing metrics
- Bundle size optimization through tree-shaking support

**Interface:**
```typescript
interface AxiosClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableRequestDeduplication: boolean;
  maxConcurrentRequests: number;
}

class AxiosClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  cancelRequest(requestId: string): void;
  getPerformanceMetrics(): RequestMetrics;
  clearCache(): void;
}
```

### 2. Core Reconnecting-WebSocket Client

**File:** `lib/websocket/reconnecting-websocket-client.ts`

**Purpose:** Centralized reconnecting-websocket client with authentication and connection management.

**Key Features:**
- Automatic reconnection with exponential backoff and configurable retry strategies
- JWT authentication integration with token refresh support
- Message-based communication handling with validation
- Connection state management with React hooks integration
- Message queuing during disconnection periods
- Configurable retry strategies and connection limits
- Connection status updates for UI components
- Memory leak prevention and proper cleanup
- Performance monitoring for connection health and message throughput
- TypeScript support with comprehensive type definitions

**Interface:**
```typescript
interface ReconnectingWebSocketConfig {
  url: string;
  maxReconnectionDelay: number;
  minReconnectionDelay: number;
  reconnectionDelayGrowFactor: number;
  maxRetries: number;
  connectionTimeout: number;
  debug: boolean;
  auth: {
    enabled: boolean;
    tokenHeader: string;
    autoRefresh: boolean;
  };
  messageQueue: {
    enabled: boolean;
    maxSize: number;
  };
}

class ReconnectingWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: string | object): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  isConnected(): boolean;
  getConnectionState(): ConnectionState;
  getRetryCount(): number;
  clearMessageQueue(): void;
  getQueuedMessageCount(): number;
  authenticate(token: string): Promise<void>;
  refreshAuthentication(): Promise<void>;
  getPerformanceMetrics(): ConnectionMetrics;
  enableDebugMode(enabled: boolean): void;
}
```

### 3. Enhanced API Clients

#### Family API Client
- Migrated to use centralized axios client with full backward compatibility
- Improved error handling with axios interceptors and consistent error transformation
- Enhanced TypeScript support with better type inference
- Automatic retry for transient failures with exponential backoff
- Request cancellation support for concurrent operations
- Performance monitoring for family management operations
- Comprehensive testing support with mockable interfaces

#### Quota API Client  
- Axios-based HTTP requests with enhanced validation
- Integration with reconnecting-websocket for real-time quota updates
- Enhanced error handling and response validation
- Request deduplication to prevent duplicate quota operations
- Performance optimization for frequent quota checks
- Bundle size optimization through selective feature imports
- Comprehensive error typing for better developer experience

#### Auth Client
- Axios interceptors for automatic token management
- Integrated token refresh logic with retry of failed requests
- Enhanced security features with secure token storage
- Improved error handling with consistent auth error responses
- Logout handling with proper cleanup of both HTTP and WebSocket connections
- Performance monitoring for authentication operations
- Comprehensive testing support with authentication mocking

### 4. Configuration Management

**Design Decision:** Centralized configuration management enables easy environment-specific settings and reduces code duplication across HTTP and WebSocket clients.

**HTTP Configuration:**
```typescript
interface HttpConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableLogging: boolean;
  auth: {
    tokenRefreshThreshold: number;
    maxRetries: number;
    autoRefresh: boolean;
  };
  performance: {
    enableCaching: boolean;
    enableDeduplication: boolean;
    maxConcurrentRequests: number;
  };
}
```

**WebSocket Configuration:**
```typescript
interface WebSocketConfig {
  url: string;
  autoConnect: boolean;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  maxReconnectionDelay: number;
  reconnectionDelayGrowFactor: number;
  connectionTimeout: number;
  debug: boolean;
  auth: {
    enabled: boolean;
    tokenHeader: string;
    autoRefresh: boolean;
  };
  messageQueue: {
    enabled: boolean;
    maxSize: number;
    persistOnDisconnect: boolean;
  };
}
```

**Environment Configuration:**
```typescript
interface EnvironmentConfig {
  development: {
    http: HttpConfig;
    websocket: WebSocketConfig;
    enableDebugLogging: boolean;
  };
  production: {
    http: HttpConfig;
    websocket: WebSocketConfig;
    enableDebugLogging: boolean;
  };
  test: {
    http: HttpConfig;
    websocket: WebSocketConfig;
    enableDebugLogging: boolean;
  };
}
```

## Data Models

### Enhanced Request/Response Models

**Design Decision:** Standardized response and error models ensure consistent handling across all API clients and improve TypeScript support.

```typescript
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: number;
  requestId?: string;
  version?: string;
}

interface ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  timestamp: number;
  retryable: boolean;
  requestId?: string;
  context?: Record<string, any>;
}

interface ApiRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  deduplicationKey?: string;
  priority?: 'low' | 'normal' | 'high';
}
```

### WebSocket Message Models

**Design Decision:** Structured message models with validation ensure type safety and consistent message handling across WebSocket communications.

```typescript
interface WebSocketMessage<T = any> {
  id: string;
  type: string;
  data: T;
  timestamp: number;
  userId?: string;
  roomId?: string;
  version?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface WebSocketResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId?: string;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  retryCount: number;
  lastConnected?: number;
  lastError?: string;
  queuedMessages: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
}

interface ConnectionMetrics {
  connectionUptime: number;
  reconnectionCount: number;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  queuedMessagesPeak: number;
}
```

## Error Handling

### Axios Error Handling

**Design Decision:** Comprehensive error handling with consistent patterns improves debugging and user experience while maintaining type safety.

**Strategy:**
1. **Request Interceptor**: Handle authentication, validation, and request preparation errors
2. **Response Interceptor**: Transform HTTP errors to consistent ApiError format with proper typing
3. **Retry Logic**: Automatic retry for transient failures with exponential backoff
4. **Error Classification**: Categorize errors as retryable/non-retryable with context information
5. **Logging Integration**: Comprehensive error logging with debug mode support

**Implementation:**
- Convert axios errors to standardized ApiError format with TypeScript support
- Implement exponential backoff for retries with configurable limits
- Handle token expiration with automatic refresh and request retry
- Provide user-friendly error messages with proper localization support
- Add error context and debugging information for development
- Implement error boundaries for React components

### Reconnecting-WebSocket Error Handling

**Strategy:**
1. **Connection Errors**: Handle network and authentication issues
2. **Message Errors**: Validate and handle malformed messages
3. **Timeout Handling**: Manage connection timeouts and retries
4. **Recovery Logic**: Automatic reconnection and message queuing

**Implementation:**
- Exponential backoff for reconnection attempts
- Message queuing during disconnection
- Configurable retry strategies and limits
- Comprehensive error logging and monitoring

## Testing Strategy

**Design Decision:** Comprehensive testing strategy ensures migration success and maintains code quality while providing confidence in the new communication layer.

### Unit Testing
- Mock axios and reconnecting-websocket clients with Jest/Vitest
- Test interceptor behavior and authentication flows
- Validate error handling logic and transformation
- Test retry and reconnection mechanisms
- Test configuration management and validation
- Test TypeScript type safety and inference

### Integration Testing
- Test with real backend services using Testcontainers
- Validate authentication flows and token refresh
- Test error scenarios and recovery mechanisms
- Performance and load testing with realistic data
- Test WebSocket connection lifecycle and message handling
- Cross-browser compatibility testing

### End-to-End Testing
- Complete user workflows with Playwright
- Real-time communication testing scenarios
- Error recovery and resilience testing
- Performance benchmarking and monitoring
- Bundle size validation and optimization testing

### Testing Infrastructure
- Mockable interfaces for both HTTP and WebSocket clients
- Test utilities for authentication and error simulation
- Performance testing harness with metrics collection
- Automated testing pipeline integration

## Performance Considerations

### Bundle Size Optimization
- Tree shaking for unused features
- Code splitting for WebSocket clients
- Dynamic imports for large dependencies
- Optimized builds for production
- Bundle analysis and size monitoring
- Selective feature imports to minimize footprint
- Lazy loading of non-critical communication features

### Runtime Performance
- Request deduplication and caching
- Connection pooling and reuse
- Memory leak prevention
- Efficient event handling
- Performance metrics collection and monitoring
- Automatic performance optimization strategies
- Resource cleanup and garbage collection optimization

## Security Considerations

### Authentication Security
- Secure token storage and management
- Automatic token refresh
- HTTPS/WSS enforcement
- Request validation and sanitization

### WebSocket Security
- Authentication on connection
- Message validation and sanitization
- Rate limiting and abuse prevention
- Secure message transmission

## Documentation and Migration Strategy

**Design Decision:** Phased migration approach minimizes risk and ensures backward compatibility while providing comprehensive documentation for developers.

### Documentation Requirements
- Comprehensive API documentation with examples
- Migration guide with step-by-step instructions
- Troubleshooting guide for common issues
- Configuration reference with all options
- Performance optimization recommendations
- TypeScript usage examples and best practices

### Migration Strategy

#### Phase 1: Infrastructure Setup
1. Install axios and reconnecting-websocket dependencies
2. Create core axios client with interceptors
3. Create core reconnecting-websocket client with authentication
4. Set up configuration management
5. Establish testing infrastructure

#### Phase 2: REST API Migration
1. Migrate auth client (foundational for other clients)
2. Migrate family client (complex endpoints with validation)
3. Migrate quota client (WebSocket integration preparation)
4. Update error handling throughout application
5. Performance monitoring implementation

#### Phase 3: WebSocket Migration
1. Migrate websocket-client.ts to reconnecting-websocket
2. Migrate quota-websocket.tsx with React integration
3. Update custom hooks (useQuoteWebsocket.ts)
4. Implement proper cleanup and memory management
5. Connection state management integration

#### Phase 4: Testing and Optimization
1. Comprehensive testing suite implementation
2. Performance optimization and bundle size analysis
3. Documentation completion and review
4. Migration guide validation and examples
5. Final integration testing and deployment preparation

### Backward Compatibility Strategy
- Maintain existing API interfaces during transition
- Gradual migration with feature flags
- Comprehensive testing at each phase
- Rollback procedures for each migration step