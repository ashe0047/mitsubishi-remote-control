# WebSocket Client Refactoring - Technical Design Document

## Architecture Overview

This design refactors the monolithic `ReconnectingWebSocketClient` (1650+ lines) into a clean, maintainable architecture following SOLID principles, proper package utilization, and modern TypeScript practices.

### Core Design Principles

**Clean Code Principles Applied:**
- **DRY (Don't Repeat Yourself)**: Eliminate duplicate timeout patterns, message validation, and subscription logic
- **SOLID Principles**: Comprehensive application of all five principles with focused interfaces and dependency injection
- **YAGNI (You Ain't Gonna Need It)**: Remove over-engineered performance monitoring and complex metrics collection

**Design Pattern Analysis and Selection:**
- **Facade Pattern**: WebSocketClient provides simplified interface hiding component complexity
- **Strategy Pattern**: AuthenticationStrategy allows different auth methods without core changes
- **Observer Pattern**: RxJS observables for state changes and message streams
- **Command Pattern**: Type-safe message handling with BaseCommand hierarchy
- **Factory Pattern**: WebSocketClientFactory for dependency injection and configuration
- **Adapter Pattern**: Legacy compatibility during migration phase

## Component Architecture

### 1. WebSocketClient (Facade)
**Responsibility**: Main client interface orchestrating all components
**Size**: ~100 lines (vs 1650+ current)

```typescript
interface IWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getConnectionStatus$(): Observable<ConnectionStatus>;
  subscribeToRoomState(roomId: string): Promise<void>;
  sendCommand<T>(command: BaseCommand): Promise<T>;
}

class WebSocketClient implements IWebSocketClient {
  constructor(
    private connectionManager: IConnectionManager,
    private messageProcessor: IMessageProcessor,
    private subscriptionManager: ISubscriptionManager,
    private monitor: IConnectionMonitor
  ) {
    this.wireComponents();
  }

  private wireComponents(): void {
    // Event-driven component communication
    this.connectionManager.onMessage(msg =>
      this.messageProcessor.processIncomingMessage(msg)
    );

    this.connectionManager.onStateChange(state => {
      if (state.status === 'connected') {
        this.subscriptionManager.resubscribeAll();
      }
    });
  }
}
```

**Architecture Quality Assessment:**
- **Cohesion**: High - focuses solely on component orchestration
- **Coupling**: Low - depends only on abstractions through interfaces
- **Separation of Concerns**: Clear - delegates specific responsibilities to focused components

### 2. ConnectionManager
**Responsibility**: WebSocket connection lifecycle using reconnecting-websocket package
**Size**: ~150 lines

```typescript
interface IConnectionManager {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  send(message: string): void;
  onMessage(handler: (message: any) => void): void;
  onStateChange(handler: (state: ConnectionState) => void): void;
}

class ConnectionManager implements IConnectionManager {
  private ws: ReconnectingWebSocket | null = null;
  private connectionState$ = new BehaviorSubject<ConnectionState>({
    status: 'disconnected',
    lastConnected: null,
    reconnectAttempts: 0
  });

  constructor(
    private authStrategy: IAuthenticationStrategy,
    private config: WebSocketConfig
  ) {}

  async connect(): Promise<void> {
    // Leverage package's async URL provider capability
    const urlProvider = async () => {
      return await this.authStrategy.getAuthenticatedUrl(this.config.baseUrl);
    };

    // Use package's built-in configuration instead of custom logic
    this.ws = new ReconnectingWebSocket(urlProvider, [], {
      maxReconnectionDelay: 30000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 2,
      connectionTimeout: 10000,
      maxRetries: 10,
      minUptime: 5000, // Consider connection stable after 5s
      debug: this.config.debug
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws!.addEventListener('open', () => {
      this.updateConnectionState({
        status: 'connected',
        lastConnected: Date.now(),
        reconnectAttempts: 0
      });
    });

    this.ws!.addEventListener('close', () => {
      this.updateConnectionState({ status: 'disconnected' });
    });

    this.ws!.addEventListener('message', (event) => {
      this.messageHandlers.forEach(handler => handler(JSON.parse(event.data)));
    });
  }
}
```

**Package Optimization Benefits:**
- **Eliminates 400+ lines** of custom reconnection logic
- **Built-in timeout handling** replaces Promise race conditions
- **Automatic retry mechanisms** with configurable backoff
- **Connection stability detection** through `minUptime`

### 3. AuthenticationStrategy (Strategy Pattern)
**Responsibility**: JWT token management and dynamic URL generation
**Size**: ~80 lines

```typescript
interface IAuthenticationStrategy {
  getAuthenticatedUrl(baseUrl: string): Promise<string>;
  refreshToken(): Promise<void>;
  isTokenValid(): boolean;
}

class JwtAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private tokenProvider: () => Promise<string | null>,
    private tokenRefresher: () => Promise<string>
  ) {}

  async getAuthenticatedUrl(baseUrl: string): Promise<string> {
    const token = await this.getValidToken();
    return `${baseUrl}?token=${token}`;
  }

  private async getValidToken(): Promise<string> {
    let token = await this.tokenProvider();

    if (!token || this.isTokenExpired(token)) {
      token = await this.tokenRefresher();
    }

    if (!token) {
      throw new Error('Failed to obtain valid authentication token');
    }

    return token;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  isTokenValid(): boolean {
    // Implementation for token validation
    return true;
  }
}
```

**Strategy Pattern Benefits:**
- **Open/Closed Principle**: New auth methods can be added without modifying core
- **Single Responsibility**: Focuses only on authentication concerns
- **Testable**: Easy to mock for unit tests

### 4. MessageProcessor (Command Pattern)
**Responsibility**: Message validation, routing, and response correlation
**Size**: ~120 lines

```typescript
interface IMessageProcessor {
  sendMessage<T>(message: WebSocketMessage): Promise<T>;
  processIncomingMessage(message: any): void;
  getMessages$(): Observable<WSMessage>;
}

class MessageProcessor implements IMessageProcessor {
  private pendingRequests = new Map<string, PendingRequest>();
  private messageSubject = new Subject<WSMessage>();
  private readonly MESSAGE_TIMEOUT = 30000;

  constructor(private validator: IMessageValidator) {}

  async sendMessage<T>(message: WebSocketMessage): Promise<T> {
    const messageId = this.generateMessageId();
    const messageWithId = { ...message, messageId };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Message timeout: ${messageId}`));
      }, this.MESSAGE_TIMEOUT);

      this.pendingRequests.set(messageId, { resolve, reject, timeout });
      this.connectionManager.send(JSON.stringify(messageWithId));
    });
  }

  processIncomingMessage(rawMessage: any): void {
    try {
      const message = this.validator.validate(rawMessage);
      this.routeMessage(message);
    } catch (error) {
      console.error('Message validation failed:', error);
    }
  }

  private routeMessage(message: WSMessage): void {
    if (this.isResponse(message) && this.pendingRequests.has(message.messageId)) {
      this.handleResponse(message);
    } else {
      this.messageSubject.next(message);
    }
  }

  private handleResponse(message: WSMessage): void {
    const pending = this.pendingRequests.get(message.messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.messageId);
      pending.resolve(message.payload);
    }
  }
}
```

**Command Pattern Implementation:**
```typescript
abstract class BaseCommand {
  abstract readonly type: MessageType;
  abstract execute(processor: IMessageProcessor): Promise<any>;
}

class PowerCommand extends BaseCommand {
  readonly type = 'command.power' as const;

  constructor(private roomId: string, private power: boolean) { super(); }

  async execute(processor: IMessageProcessor): Promise<void> {
    return processor.sendMessage({
      type: this.type,
      roomId: this.roomId,
      payload: { power: this.power }
    });
  }
}
```

### 5. SubscriptionManager (Observer Pattern)
**Responsibility**: Room subscription lifecycle management
**Size**: ~90 lines

```typescript
interface ISubscriptionManager {
  subscribe(roomId: string): Promise<void>;
  unsubscribe(roomId: string): Promise<void>;
  resubscribeAll(): Promise<void>;
  getActiveSubscriptions(): Set<string>;
}

class SubscriptionManager implements ISubscriptionManager {
  private activeSubscriptions = new Set<string>();

  constructor(private messageProcessor: IMessageProcessor) {}

  async subscribe(roomId: string): Promise<void> {
    if (this.activeSubscriptions.has(roomId)) {
      return; // Already subscribed
    }

    // DRY: Consolidate subscription logic
    const subscriptionCommands = [
      new SubscribeCommand('room.state.stream', roomId),
      new SubscribeCommand('room.settings.stream', roomId)
    ];

    for (const command of subscriptionCommands) {
      await command.execute(this.messageProcessor);
    }

    this.activeSubscriptions.add(roomId);
  }

  async resubscribeAll(): Promise<void> {
    const subscriptions = Array.from(this.activeSubscriptions);
    this.activeSubscriptions.clear();

    // Resubscribe to all previously active subscriptions
    for (const roomId of subscriptions) {
      await this.subscribe(roomId);
    }
  }
}
```

### 6. ConnectionMonitor (Lightweight Monitoring)
**Responsibility**: Basic connection health tracking
**Size**: ~60 lines

```typescript
interface IConnectionMonitor {
  recordConnection(): void;
  recordMessage(): void;
  getBasicMetrics(): ConnectionMetrics;
  cleanup(): void;
}

class ConnectionMonitor implements IConnectionMonitor {
  private metrics: ConnectionMetrics = {
    connectTime: 0,
    messageCount: 0,
    lastHealthCheck: null
  };

  recordConnection(): void {
    this.metrics.connectTime = Date.now();
  }

  recordMessage(): void {
    this.metrics.messageCount++;
  }

  getBasicMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  cleanup(): void {
    this.metrics = { connectTime: 0, messageCount: 0, lastHealthCheck: null };
  }
}
```

**YAGNI Implementation:**
- Removes complex performance monitoring (200+ lines eliminated)
- Eliminates sophisticated metrics collection
- Focuses on essential health tracking only

## Type Safety and Error Handling

### Comprehensive Type System

```typescript
// Eliminate deprecated types with modern alternatives
interface WebSocketMessage {
  type: MessageType;
  messageId: string;
  roomId?: string;
  payload?: unknown;
  timestamp?: number;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected: number | null;
  reconnectAttempts: number;
  error?: string;
}

// Discriminated unions for type safety
type MessageType =
  | 'room.state.stream'
  | 'room.settings.stream'
  | 'command.power'
  | 'command.temperature'
  | 'mqtt.status'
  | 'health.check';

// Connection status types
interface ConnectionStatus {
  websocket: {
    state: 'error' | 'connecting' | 'connected' | 'disconnected';
    lastConnected: number | null;
    reconnectAttempts: number;
  };
  mqtt: {
    state: 'connected' | 'disconnected' | 'unknown';
    lastUpdate: number | null;
  };
  overall: 'healthy' | 'degraded' | 'disconnected';
}
```

### Error Handling Strategy

```typescript
// Centralized error handling
class WebSocketError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

// Error types
const ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  MESSAGE_TIMEOUT: 'MESSAGE_TIMEOUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
} as const;

// Error boundary implementation
class ErrorHandler {
  static handle(error: unknown, context: string): void {
    if (error instanceof WebSocketError) {
      console.error(`WebSocket error in ${context}:`, error.code, error.message);
    } else {
      console.error(`Unexpected error in ${context}:`, error);
    }
  }
}
```

## Dependency Injection and Testing

### DI Container Design

```typescript
// Service tokens for dependency injection
const TOKENS = {
  AuthStrategy: Symbol('AuthStrategy'),
  MessageValidator: Symbol('MessageValidator'),
  ConnectionManager: Symbol('ConnectionManager'),
  MessageProcessor: Symbol('MessageProcessor'),
  SubscriptionManager: Symbol('SubscriptionManager'),
  ConnectionMonitor: Symbol('ConnectionMonitor')
} as const;

interface DIContainer {
  register<T>(token: symbol, implementation: T): void;
  resolve<T>(token: symbol): T;
}

class SimpleDIContainer implements DIContainer {
  private services = new Map<symbol, any>();

  register<T>(token: symbol, implementation: T): void {
    this.services.set(token, implementation);
  }

  resolve<T>(token: symbol): T {
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`Service not registered: ${token.toString()}`);
    }
    return service;
  }
}

// Factory for production configuration
class WebSocketClientFactory {
  static create(config: WebSocketConfig): WebSocketClient {
    const container = new SimpleDIContainer();

    // Register dependencies
    container.register(TOKENS.AuthStrategy,
      new JwtAuthenticationStrategy(config.tokenProvider, config.tokenRefresher)
    );

    container.register(TOKENS.MessageValidator,
      new ZodMessageValidator(config.schemas)
    );

    const connectionManager = new ConnectionManager(
      container.resolve(TOKENS.AuthStrategy),
      config
    );
    container.register(TOKENS.ConnectionManager, connectionManager);

    const messageProcessor = new MessageProcessor(
      container.resolve(TOKENS.MessageValidator)
    );
    container.register(TOKENS.MessageProcessor, messageProcessor);

    container.register(TOKENS.SubscriptionManager,
      new SubscriptionManager(messageProcessor)
    );

    container.register(TOKENS.ConnectionMonitor,
      new ConnectionMonitor()
    );

    return new WebSocketClient(
      connectionManager,
      messageProcessor,
      container.resolve(TOKENS.SubscriptionManager),
      container.resolve(TOKENS.ConnectionMonitor)
    );
  }
}
```

### Testing Strategy

```typescript
// Mockable interfaces for unit testing
interface IWebSocketConnection {
  send(data: string): void;
  close(): void;
  addEventListener(event: string, handler: Function): void;
  removeEventListener(event: string, handler: Function): void;
  readyState: number;
}

// Test factory for dependency injection
class TestWebSocketClientFactory {
  static create(mocks: Partial<TestMocks>): WebSocketClient {
    const container = new SimpleDIContainer();

    // Register mock implementations
    container.register(TOKENS.AuthStrategy,
      mocks.authStrategy || new MockAuthStrategy()
    );

    container.register(TOKENS.MessageValidator,
      mocks.messageValidator || new MockMessageValidator()
    );

    // ... register other mocks

    return new WebSocketClient(/* inject mocks */);
  }
}

// Example unit test
describe('ConnectionManager', () => {
  it('should connect using authentication strategy', async () => {
    const mockAuth = new MockAuthStrategy();
    mockAuth.getAuthenticatedUrl.mockResolvedValue('ws://test.com?token=abc');

    const manager = new ConnectionManager(mockAuth, testConfig);
    await manager.connect();

    expect(mockAuth.getAuthenticatedUrl).toHaveBeenCalledWith('ws://test.com');
  });
});
```

## Direct Replacement Strategy

### Development Environment Approach

Since this is an active development codebase without production dependencies, we can perform a direct replacement without the need for backward compatibility:

```typescript
// Direct replacement - no legacy compatibility needed
export const createWebSocketClient = (config: WebSocketConfig) => {
  return WebSocketClientFactory.create(config);
};

// Update all existing usage points
export { WebSocketClient as ReconnectingWebSocketClient } from './client/websocket-client';
```

### Configuration Migration

```typescript
// Update existing configuration to new format
const updateWebSocketConfig = (oldConfig: any): WebSocketConfig => {
  return {
    baseUrl: oldConfig.url || 'ws://localhost:8081/ws',
    tokenProvider: oldConfig.getToken || (() => Promise.resolve(null)),
    tokenRefresher: oldConfig.refreshToken || (() => Promise.reject('No refresh')),
    debug: oldConfig.debug || false
  };
};

// Factory for creating configured instances
export class WebSocketClientFactory {
  static create(config: WebSocketConfig): WebSocketClient {
    const container = new SimpleDIContainer();

    // Register dependencies
    container.register(TOKENS.AuthStrategy,
      new JwtAuthenticationStrategy(config.tokenProvider, config.tokenRefresher)
    );

    container.register(TOKENS.MessageValidator,
      new ZodMessageValidator(config.schemas)
    );

    const connectionManager = new ConnectionManager(
      container.resolve(TOKENS.AuthStrategy),
      config
    );

    const messageProcessor = new MessageProcessor(
      container.resolve(TOKENS.MessageValidator)
    );

    const subscriptionManager = new SubscriptionManager(messageProcessor);
    const connectionMonitor = new ConnectionMonitor();

    return new WebSocketClient(
      connectionManager,
      messageProcessor,
      subscriptionManager,
      connectionMonitor
    );
  }
}
```

## Performance and Memory Optimization

### Resource Management

```typescript
// Disposable pattern for resource cleanup
interface Disposable {
  dispose(): void;
}

class ResourceManager implements Disposable {
  private resources = new Set<Disposable>();

  register(resource: Disposable): void {
    this.resources.add(resource);
  }

  dispose(): void {
    for (const resource of this.resources) {
      try {
        resource.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    }
    this.resources.clear();
  }
}

// Apply to WebSocket client
class WebSocketClient implements Disposable {
  private resourceManager = new ResourceManager();

  constructor(/* ... */) {
    // Register all components for cleanup
    this.resourceManager.register(this.connectionManager);
    this.resourceManager.register(this.messageProcessor);
    this.resourceManager.register(this.subscriptionManager);
    this.resourceManager.register(this.monitor);
  }

  dispose(): void {
    this.resourceManager.dispose();
  }
}
```

### Memory Leak Prevention

```typescript
class MessageProcessor implements Disposable {
  private pendingRequests = new Map<string, PendingRequest>();
  private messageSubject = new Subject<WSMessage>();

  dispose(): void {
    // Clear all pending timeouts to prevent memory leaks
    for (const [messageId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
    }
    this.pendingRequests.clear();

    // Complete observables
    this.messageSubject.complete();
  }
}
```

## Package Configuration Optimization

### Maximizing reconnecting-websocket Capabilities

```typescript
// Optimal package configuration
const createOptimalWebSocketConfig = (config: WebSocketConfig) => ({
  // Connection behavior
  maxReconnectionDelay: 30000,     // Maximum delay between reconnections
  minReconnectionDelay: 1000,      // Minimum delay between reconnections
  reconnectionDelayGrowFactor: 2,   // Exponential backoff factor

  // Connection stability
  connectionTimeout: 10000,         // Connection timeout (eliminates custom timeout logic)
  maxRetries: 10,                  // Maximum reconnection attempts
  minUptime: 5000,                 // Minimum uptime to consider connection stable

  // Debugging and monitoring
  debug: config.debug,             // Debug logging

  // Custom WebSocket constructor for testing
  WebSocket: config.customWebSocket || globalThis.WebSocket
});

// Async URL provider for dynamic authentication
const createAuthenticatedUrlProvider = (authStrategy: IAuthenticationStrategy, baseUrl: string) => {
  return async (): Promise<string> => {
    try {
      return await authStrategy.getAuthenticatedUrl(baseUrl);
    } catch (error) {
      console.error('Failed to generate authenticated URL:', error);
      throw new Error('Authentication failed');
    }
  };
};
```

## Quality Assurance and Validation

### Architecture Compliance Checklist

**SOLID Principles Validation:**
- ✅ **Single Responsibility**: Each class has one reason to change
- ✅ **Open/Closed**: New features can be added without modifying existing code
- ✅ **Liskov Substitution**: Implementations are substitutable through interfaces
- ✅ **Interface Segregation**: Focused, client-specific interfaces
- ✅ **Dependency Inversion**: Depends on abstractions, not concretions

**Clean Code Compliance:**
- ✅ **DRY**: Duplicate code eliminated through proper abstraction
- ✅ **Functions <20 lines**: All methods focused and concise
- ✅ **Classes <200 lines**: Single responsibility maintained
- ✅ **Meaningful names**: Clear, intention-revealing names
- ✅ **No side effects**: Pure functions where possible

**Package Optimization:**
- ✅ **Built-in features utilized**: Async URL provider, reconnection config
- ✅ **Custom logic eliminated**: Timeout handling, retry mechanisms
- ✅ **Configuration optimized**: All relevant options utilized
- ✅ **Event handling standardized**: WebSocket API compliance

### Performance Metrics

**Expected Improvements:**
- **Code Reduction**: 60-70% fewer lines (1650+ → ~500-600 lines)
- **TypeScript Errors**: 47+ errors → 0 errors
- **Memory Usage**: 30% reduction through proper cleanup
- **Bundle Size**: No significant impact due to same dependencies
- **Connection Time**: <2 seconds average
- **Message Processing**: <100ms latency

### Risk Mitigation

**Technical Risks:**
- **Integration Changes**: Mitigated by maintaining similar API surface
- **Performance Regression**: Addressed through benchmarking and monitoring
- **Development Workflow**: Minimized by comprehensive testing

**Development Risks:**
- **Implementation Complexity**: Reduced by modular architecture and clear interfaces
- **Testing Coverage**: Ensured by dependency injection and comprehensive mocking
- **Documentation Gaps**: Prevented by thorough API documentation

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. Create core interfaces and type definitions
2. Implement dependency injection container
3. Set up comprehensive testing infrastructure with mocks
4. Define clean architecture boundaries

### Phase 2: Component Implementation (Week 2)
1. Implement ConnectionManager with proper package usage
2. Create AuthenticationStrategy with JWT handling
3. Build MessageProcessor with command pattern
4. Develop SubscriptionManager for room handling

### Phase 3: Integration (Week 3)
1. Create WebSocketClient facade
2. Implement resource management and cleanup
3. Build factory for dependency injection
4. Complete integration testing

### Phase 4: Replacement and Validation (Week 4)
1. Replace existing implementation completely
2. Update all integration points
3. Comprehensive testing and performance validation
4. Documentation updates and deployment

This architecture design provides a clean, maintainable, and well-tested foundation that addresses all identified issues while maintaining feature parity and ensuring smooth migration.