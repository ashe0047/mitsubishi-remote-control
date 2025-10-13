# WebSocket Client Refactoring - Implementation Plan

## Executive Summary

This implementation plan details the step-by-step execution of refactoring the monolithic `ReconnectingWebSocketClient` into a clean, maintainable architecture following SOLID principles, proper `reconnecting-websocket` package utilization, and comprehensive type safety.

## Implementation Strategy

### Phased Approach
- **Phase 1**: Foundation and Type Safety (Week 1)
- **Phase 2**: Component Implementation (Week 2)
- **Phase 3**: Integration and Optimization (Week 3)
- **Phase 4**: Replacement and Validation (Week 4)

### Clean Code Implementation Checklist

**DRY (Don't Repeat Yourself) Elimination:**
- [ ] Abstract timeout/clearTimeout patterns into utility classes
- [ ] Consolidate message validation logic into single validator
- [ ] Unify subscription management across room types
- [ ] Create reusable command templates

**SOLID Principles Application:**
- [ ] **SRP**: Each class has single, well-defined responsibility
- [ ] **OCP**: Strategy pattern enables extension without modification
- [ ] **LSP**: All implementations substitutable through interfaces
- [ ] **ISP**: Client-specific focused interfaces
- [ ] **DIP**: Dependency injection with abstractions

**YAGNI Implementation:**
- [ ] Remove over-engineered performance monitoring
- [ ] Eliminate complex metrics collection
- [ ] Simplify to essential features only
- [ ] Focus on current requirements

## Phase 1: Foundation and Type Safety (Week 1)

### Task 1.1: Create Core Type Definitions
**Duration**: 1 day
**Priority**: Critical

```typescript
// File: src/lib/websocket/types/index.ts
export interface WebSocketMessage {
  type: MessageType;
  messageId: string;
  roomId?: string;
  payload?: unknown;
  timestamp?: number;
}

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected: number | null;
  reconnectAttempts: number;
  error?: string;
}

export type MessageType =
  | 'room.state.stream'
  | 'room.settings.stream'
  | 'command.power'
  | 'command.temperature'
  | 'command.mode'
  | 'command.fan'
  | 'command.vane'
  | 'command.wideVane'
  | 'mqtt.status'
  | 'health.check';

export interface ConnectionStatus {
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

**Clean Code Focus**: Eliminate all `any` types and deprecated interfaces

### Task 1.2: Create Core Interfaces
**Duration**: 1 day
**Priority**: Critical

```typescript
// File: src/lib/websocket/interfaces/index.ts
export interface IWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getConnectionStatus$(): Observable<ConnectionStatus['websocket']>;
  subscribeToRoomState(roomId: string): Promise<void>;
  sendCommand<T>(command: BaseCommand): Promise<T>;
}

export interface IConnectionManager {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  send(message: string): void;
  onMessage(handler: (message: any) => void): void;
  onStateChange(handler: (state: ConnectionState) => void): void;
}

export interface IAuthenticationStrategy {
  getAuthenticatedUrl(baseUrl: string): Promise<string>;
  refreshToken(): Promise<void>;
  isTokenValid(): boolean;
}

export interface IMessageProcessor {
  sendMessage<T>(message: WebSocketMessage): Promise<T>;
  processIncomingMessage(message: any): void;
  getMessages$(): Observable<WSMessage>;
}

export interface ISubscriptionManager {
  subscribe(roomId: string): Promise<void>;
  unsubscribe(roomId: string): Promise<void>;
  resubscribeAll(): Promise<void>;
  getActiveSubscriptions(): Set<string>;
}

export interface IConnectionMonitor {
  recordConnection(): void;
  recordMessage(): void;
  getBasicMetrics(): ConnectionMetrics;
  cleanup(): void;
}
```

**Interface Segregation**: Each interface serves specific client needs

### Task 1.3: Set Up Dependency Injection Infrastructure
**Duration**: 1 day
**Priority**: High

```typescript
// File: src/lib/websocket/di/container.ts
export const TOKENS = {
  AuthStrategy: Symbol('AuthStrategy'),
  MessageValidator: Symbol('MessageValidator'),
  ConnectionManager: Symbol('ConnectionManager'),
  MessageProcessor: Symbol('MessageProcessor'),
  SubscriptionManager: Symbol('SubscriptionManager'),
  ConnectionMonitor: Symbol('ConnectionMonitor')
} as const;

export interface DIContainer {
  register<T>(token: symbol, implementation: T): void;
  resolve<T>(token: symbol): T;
}

export class SimpleDIContainer implements DIContainer {
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
```

**Dependency Inversion**: All components depend on abstractions

### Task 1.4: Create Error Handling System
**Duration**: 1 day
**Priority**: Medium

```typescript
// File: src/lib/websocket/errors/index.ts
export class WebSocketError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

export const ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  MESSAGE_TIMEOUT: 'MESSAGE_TIMEOUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
} as const;

export class ErrorHandler {
  static handle(error: unknown, context: string): void {
    if (error instanceof WebSocketError) {
      console.error(`WebSocket error in ${context}:`, error.code, error.message);
    } else {
      console.error(`Unexpected error in ${context}:`, error);
    }
  }
}
```

### Task 1.5: Set Up Testing Infrastructure
**Duration**: 1 day
**Priority**: High

```typescript
// File: src/lib/websocket/__tests__/mocks/index.ts
export class MockAuthenticationStrategy implements IAuthenticationStrategy {
  getAuthenticatedUrl = jest.fn();
  refreshToken = jest.fn();
  isTokenValid = jest.fn();
}

export class MockMessageProcessor implements IMessageProcessor {
  sendMessage = jest.fn();
  processIncomingMessage = jest.fn();
  getMessages$ = jest.fn();
}

// Test factory
export class TestWebSocketClientFactory {
  static create(mocks: Partial<TestMocks>): WebSocketClient {
    const container = new SimpleDIContainer();

    container.register(TOKENS.AuthStrategy,
      mocks.authStrategy || new MockAuthenticationStrategy()
    );

    return new WebSocketClient(container);
  }
}
```

**Testability**: All components mockable through dependency injection

## Phase 2: Component Implementation (Week 2)

### Task 2.1: Implement AuthenticationStrategy
**Duration**: 2 days
**Priority**: Critical

```typescript
// File: src/lib/websocket/auth/jwt-authentication-strategy.ts
export class JwtAuthenticationStrategy implements IAuthenticationStrategy {
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
      throw new WebSocketError(
        'Failed to obtain valid authentication token',
        ERROR_CODES.AUTHENTICATION_FAILED
      );
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

  async refreshToken(): Promise<void> {
    await this.tokenRefresher();
  }

  isTokenValid(): boolean {
    // Implementation for current token validation
    return true;
  }
}
```

**Strategy Pattern**: Authentication method is extensible without core changes

**Package Documentation Requirements**: Use Context7 to fetch latest `reconnecting-websocket` documentation for optimal configuration

### Task 2.2: Implement ConnectionManager with Package Optimization
**Duration**: 2 days
**Priority**: Critical

**Context7 Documentation Fetch**: Retrieve latest `reconnecting-websocket` package documentation

```typescript
// File: src/lib/websocket/connection/connection-manager.ts
export class ConnectionManager implements IConnectionManager {
  private ws: ReconnectingWebSocket | null = null;
  private connectionState$ = new BehaviorSubject<ConnectionState>({
    status: 'disconnected',
    lastConnected: null,
    reconnectAttempts: 0
  });
  private messageHandlers = new Set<(message: any) => void>();
  private stateChangeHandlers = new Set<(state: ConnectionState) => void>();

  constructor(
    private authStrategy: IAuthenticationStrategy,
    private config: WebSocketConfig
  ) {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Leverage package's async URL provider capability
    const urlProvider = async (): Promise<string> => {
      try {
        return await this.authStrategy.getAuthenticatedUrl(this.config.baseUrl);
      } catch (error) {
        throw new WebSocketError(
          'Authentication failed during connection',
          ERROR_CODES.AUTHENTICATION_FAILED,
          error
        );
      }
    };

    // Use package's built-in configuration - eliminates custom reconnection logic
    this.ws = new ReconnectingWebSocket(urlProvider, [], {
      maxReconnectionDelay: 30000,     // Maximum delay between reconnections
      minReconnectionDelay: 1000,      // Minimum delay between reconnections
      reconnectionDelayGrowFactor: 2,   // Exponential backoff factor
      connectionTimeout: 10000,         // Connection timeout (eliminates custom Promise races)
      maxRetries: 10,                  // Maximum reconnection attempts
      minUptime: 5000,                 // Minimum uptime to consider connection stable
      debug: this.config.debug         // Debug logging
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws!.addEventListener('open', this.handleOpen.bind(this));
    this.ws!.addEventListener('close', this.handleClose.bind(this));
    this.ws!.addEventListener('error', this.handleError.bind(this));
    this.ws!.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleOpen(): void {
    const newState: ConnectionState = {
      status: 'connected',
      lastConnected: Date.now(),
      reconnectAttempts: 0
    };
    this.updateConnectionState(newState);
  }

  private handleClose(): void {
    this.updateConnectionState({
      status: 'disconnected',
      lastConnected: this.connectionState$.value.lastConnected,
      reconnectAttempts: this.connectionState$.value.reconnectAttempts
    });
  }

  private handleError(event: Event): void {
    this.updateConnectionState({
      status: 'error',
      error: 'WebSocket connection error',
      lastConnected: this.connectionState$.value.lastConnected,
      reconnectAttempts: this.connectionState$.value.reconnectAttempts
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      this.messageHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      throw new WebSocketError(
        'Cannot send message: WebSocket not connected',
        ERROR_CODES.CONNECTION_FAILED
      );
    }
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.add(handler);
  }

  onStateChange(handler: (state: ConnectionState) => void): void {
    this.stateChangeHandlers.add(handler);
    // Send current state immediately
    handler(this.connectionState$.value);
  }

  private updateConnectionState(newState: Partial<ConnectionState>): void {
    const currentState = this.connectionState$.value;
    const updatedState = { ...currentState, ...newState };
    this.connectionState$.next(updatedState);

    this.stateChangeHandlers.forEach(handler => handler(updatedState));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageHandlers.clear();
    this.stateChangeHandlers.clear();

    this.updateConnectionState({
      status: 'disconnected',
      reconnectAttempts: 0
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

**Package Optimization Benefits**: Eliminates 400+ lines of custom reconnection logic

### Task 2.3: Implement MessageProcessor with Command Pattern
**Duration**: 2 days
**Priority**: Critical

```typescript
// File: src/lib/websocket/messaging/message-processor.ts
export class MessageProcessor implements IMessageProcessor {
  private pendingRequests = new Map<string, PendingRequest>();
  private messageSubject = new Subject<WSMessage>();
  private readonly MESSAGE_TIMEOUT = 30000;

  constructor(private validator: IMessageValidator) {}

  async sendMessage<T>(message: WebSocketMessage): Promise<T> {
    const messageId = this.generateMessageId();
    const messageWithId = { ...message, messageId, timestamp: Date.now() };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new WebSocketError(
          `Message timeout: ${messageId}`,
          ERROR_CODES.MESSAGE_TIMEOUT,
          { messageId, type: message.type }
        ));
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
      ErrorHandler.handle(error, 'MessageProcessor.processIncomingMessage');
    }
  }

  private routeMessage(message: WSMessage): void {
    if (this.isResponse(message) && message.messageId) {
      this.handleResponse(message);
    } else {
      this.messageSubject.next(message);
    }
  }

  private handleResponse(message: WSMessage): void {
    const pending = this.pendingRequests.get(message.messageId!);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.messageId!);

      if (message.error) {
        pending.reject(new WebSocketError(
          message.error.message || 'Request failed',
          message.error.code || ERROR_CODES.MESSAGE_TIMEOUT
        ));
      } else {
        pending.resolve(message.payload);
      }
    }
  }

  private isResponse(message: WSMessage): boolean {
    return message.messageId !== undefined &&
           (message.type === 'response' || message.error !== undefined);
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  getMessages$(): Observable<WSMessage> {
    return this.messageSubject.asObservable();
  }

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

// Command pattern implementation
export abstract class BaseCommand {
  abstract readonly type: MessageType;
  abstract execute(processor: IMessageProcessor): Promise<any>;
}

export class PowerCommand extends BaseCommand {
  readonly type = 'command.power' as const;

  constructor(private roomId: string, private power: boolean) {
    super();
  }

  async execute(processor: IMessageProcessor): Promise<void> {
    return processor.sendMessage({
      type: this.type,
      roomId: this.roomId,
      payload: { power: this.power }
    });
  }
}

export class TemperatureCommand extends BaseCommand {
  readonly type = 'command.temperature' as const;

  constructor(private roomId: string, private temperature: number) {
    super();
  }

  async execute(processor: IMessageProcessor): Promise<void> {
    return processor.sendMessage({
      type: this.type,
      roomId: this.roomId,
      payload: { temperature: this.temperature }
    });
  }
}
```

**DRY Implementation**: Eliminates duplicate command patterns through Command base class

### Task 2.4: Implement SubscriptionManager
**Duration**: 1 day
**Priority**: High

```typescript
// File: src/lib/websocket/subscription/subscription-manager.ts
export class SubscriptionManager implements ISubscriptionManager {
  private activeSubscriptions = new Set<string>();

  constructor(private messageProcessor: IMessageProcessor) {}

  async subscribe(roomId: string): Promise<void> {
    if (this.activeSubscriptions.has(roomId)) {
      return; // Already subscribed
    }

    // DRY: Consolidate subscription logic using command pattern
    const subscriptionCommands = [
      new SubscribeCommand('room.state.stream', roomId),
      new SubscribeCommand('room.settings.stream', roomId)
    ];

    try {
      for (const command of subscriptionCommands) {
        await command.execute(this.messageProcessor);
      }

      this.activeSubscriptions.add(roomId);
    } catch (error) {
      throw new WebSocketError(
        `Failed to subscribe to room: ${roomId}`,
        ERROR_CODES.CONNECTION_FAILED,
        error
      );
    }
  }

  async unsubscribe(roomId: string): Promise<void> {
    if (!this.activeSubscriptions.has(roomId)) {
      return; // Not subscribed
    }

    const unsubscribeCommands = [
      new UnsubscribeCommand('room.state.stream', roomId),
      new UnsubscribeCommand('room.settings.stream', roomId)
    ];

    try {
      for (const command of unsubscribeCommands) {
        await command.execute(this.messageProcessor);
      }

      this.activeSubscriptions.delete(roomId);
    } catch (error) {
      console.error(`Failed to unsubscribe from room: ${roomId}`, error);
      // Still remove from active subscriptions to prevent stuck state
      this.activeSubscriptions.delete(roomId);
    }
  }

  async resubscribeAll(): Promise<void> {
    const subscriptions = Array.from(this.activeSubscriptions);
    this.activeSubscriptions.clear();

    for (const roomId of subscriptions) {
      try {
        await this.subscribe(roomId);
      } catch (error) {
        console.error(`Failed to resubscribe to room: ${roomId}`, error);
      }
    }
  }

  getActiveSubscriptions(): Set<string> {
    return new Set(this.activeSubscriptions);
  }
}

// Subscription commands
class SubscribeCommand extends BaseCommand {
  readonly type: MessageType;

  constructor(subscriptionType: MessageType, private roomId: string) {
    super();
    this.type = subscriptionType;
  }

  async execute(processor: IMessageProcessor): Promise<void> {
    return processor.sendMessage({
      type: this.type,
      roomId: this.roomId,
      payload: { action: 'subscribe' }
    });
  }
}

class UnsubscribeCommand extends BaseCommand {
  readonly type: MessageType;

  constructor(subscriptionType: MessageType, private roomId: string) {
    super();
    this.type = subscriptionType;
  }

  async execute(processor: IMessageProcessor): Promise<void> {
    return processor.sendMessage({
      type: this.type,
      roomId: this.roomId,
      payload: { action: 'unsubscribe' }
    });
  }
}
```

### Task 2.5: Implement ConnectionMonitor (YAGNI-compliant)
**Duration**: 1 day
**Priority**: Low

```typescript
// File: src/lib/websocket/monitoring/connection-monitor.ts
export interface ConnectionMetrics {
  connectTime: number;
  messageCount: number;
  lastHealthCheck: number | null;
}

export class ConnectionMonitor implements IConnectionMonitor {
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
    this.metrics = {
      connectTime: 0,
      messageCount: 0,
      lastHealthCheck: null
    };
  }
}
```

**YAGNI Implementation**: Removes 200+ lines of complex performance monitoring

## Phase 3: Integration and Optimization (Week 3)

### Task 3.1: Create WebSocketClient Facade
**Duration**: 2 days
**Priority**: Critical

```typescript
// File: src/lib/websocket/client/websocket-client.ts
export class WebSocketClient implements IWebSocketClient, Disposable {
  private resourceManager = new ResourceManager();

  constructor(
    private connectionManager: IConnectionManager,
    private messageProcessor: IMessageProcessor,
    private subscriptionManager: ISubscriptionManager,
    private monitor: IConnectionMonitor
  ) {
    this.wireComponents();
    this.registerResources();
  }

  private wireComponents(): void {
    // Event-driven component communication
    this.connectionManager.onMessage(message => {
      this.monitor.recordMessage();
      this.messageProcessor.processIncomingMessage(message);
    });

    this.connectionManager.onStateChange(state => {
      if (state.status === 'connected') {
        this.monitor.recordConnection();
        // Automatically resubscribe on connection
        this.subscriptionManager.resubscribeAll().catch(error => {
          console.error('Failed to resubscribe on reconnection:', error);
        });
      }
    });
  }

  private registerResources(): void {
    this.resourceManager.register(this.connectionManager);
    this.resourceManager.register(this.messageProcessor);
    this.resourceManager.register(this.subscriptionManager);
    this.resourceManager.register(this.monitor);
  }

  // Public API - delegates to appropriate components
  async connect(): Promise<void> {
    return this.connectionManager.connect();
  }

  disconnect(): void {
    this.connectionManager.disconnect();
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  getConnectionStatus$(): Observable<ConnectionStatus['websocket']> {
    return this.connectionManager.getConnectionState$().pipe(
      map(state => ({
        state: state.status,
        lastConnected: state.lastConnected,
        reconnectAttempts: state.reconnectAttempts
      }))
    );
  }

  async subscribeToRoomState(roomId: string): Promise<void> {
    return this.subscriptionManager.subscribe(roomId);
  }

  async sendCommand<T>(command: BaseCommand): Promise<T> {
    return command.execute(this.messageProcessor);
  }

  // Convenience methods for common commands
  async sendPowerCommand(roomId: string, power: boolean): Promise<void> {
    return this.sendCommand(new PowerCommand(roomId, power));
  }

  async sendTemperatureCommand(roomId: string, temperature: number): Promise<void> {
    return this.sendCommand(new TemperatureCommand(roomId, temperature));
  }

  async sendModeCommand(roomId: string, mode: string): Promise<void> {
    return this.sendCommand(new ModeCommand(roomId, mode));
  }

  async sendFanCommand(roomId: string, fan: string): Promise<void> {
    return this.sendCommand(new FanCommand(roomId, fan));
  }

  async sendVaneCommand(roomId: string, vane: string): Promise<void> {
    return this.sendCommand(new VaneCommand(roomId, vane));
  }

  async sendWideVaneCommand(roomId: string, wideVane: string): Promise<void> {
    return this.sendCommand(new WideVaneCommand(roomId, wideVane));
  }

  getMessages$(): Observable<WSMessage> {
    return this.messageProcessor.getMessages$();
  }

  getBasicMetrics(): ConnectionMetrics {
    return this.monitor.getBasicMetrics();
  }

  dispose(): void {
    this.resourceManager.dispose();
  }
}
```

**Facade Pattern**: Provides simplified interface while hiding component complexity

### Task 3.2: Create Factory with Dependency Injection
**Duration**: 1 day
**Priority**: High

```typescript
// File: src/lib/websocket/factory/websocket-client-factory.ts
export interface WebSocketConfig {
  baseUrl: string;
  tokenProvider: () => Promise<string | null>;
  tokenRefresher: () => Promise<string>;
  debug?: boolean;
  schemas?: ValidationSchemas;
}

export class WebSocketClientFactory {
  static create(config: WebSocketConfig): WebSocketClient {
    const container = new SimpleDIContainer();

    // Register authentication strategy
    const authStrategy = new JwtAuthenticationStrategy(
      config.tokenProvider,
      config.tokenRefresher
    );
    container.register(TOKENS.AuthStrategy, authStrategy);

    // Register message validator
    const messageValidator = new ZodMessageValidator(config.schemas);
    container.register(TOKENS.MessageValidator, messageValidator);

    // Register connection manager
    const connectionManager = new ConnectionManager(authStrategy, {
      baseUrl: config.baseUrl,
      debug: config.debug || false
    });
    container.register(TOKENS.ConnectionManager, connectionManager);

    // Register message processor
    const messageProcessor = new MessageProcessor(messageValidator);
    container.register(TOKENS.MessageProcessor, messageProcessor);

    // Register subscription manager
    const subscriptionManager = new SubscriptionManager(messageProcessor);
    container.register(TOKENS.SubscriptionManager, subscriptionManager);

    // Register connection monitor
    const connectionMonitor = new ConnectionMonitor();
    container.register(TOKENS.ConnectionMonitor, connectionMonitor);

    return new WebSocketClient(
      connectionManager,
      messageProcessor,
      subscriptionManager,
      connectionMonitor
    );
  }

  static createForTesting(mocks: Partial<ComponentMocks>): WebSocketClient {
    return new WebSocketClient(
      mocks.connectionManager || new MockConnectionManager(),
      mocks.messageProcessor || new MockMessageProcessor(),
      mocks.subscriptionManager || new MockSubscriptionManager(),
      mocks.connectionMonitor || new MockConnectionMonitor()
    );
  }
}
```

### Task 3.3: Implement Resource Management
**Duration**: 1 day
**Priority**: Medium

```typescript
// File: src/lib/websocket/utils/resource-manager.ts
export interface Disposable {
  dispose(): void;
}

export class ResourceManager implements Disposable {
  private resources = new Set<Disposable>();

  register(resource: Disposable): void {
    this.resources.add(resource);
  }

  unregister(resource: Disposable): void {
    this.resources.delete(resource);
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
```

**Memory Leak Prevention**: Ensures proper cleanup of all resources

### Task 3.4: Update Integration Points
**Duration**: 1 day
**Priority**: High

```typescript
// File: src/lib/websocket/index.ts
export { WebSocketClient } from './client/websocket-client';
export { WebSocketClientFactory } from './factory/websocket-client-factory';
export { createWebSocketClient } from './factory/websocket-client-factory';

// Export types
export type {
  IWebSocketClient,
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  MessageType,
  WebSocketMessage
} from './types';

// Export commands
export {
  BaseCommand,
  PowerCommand,
  TemperatureCommand,
  ModeCommand,
  FanCommand,
  VaneCommand,
  WideVaneCommand
} from './commands';

// Export errors
export { WebSocketError, ERROR_CODES } from './errors';

// Backwards compatibility alias
export { WebSocketClient as ReconnectingWebSocketClient } from './client/websocket-client';
```

**Direct Replacement Strategy**: Update all usage points to use the new implementation

## Phase 4: Replacement and Validation (Week 4)

### Task 4.1: Replace Existing Implementation
**Duration**: 1 day
**Priority**: Critical

```typescript
// File: src/lib/websocket/index.ts
// Direct replacement factory
export const createWebSocketClient = (config: WebSocketConfig) => {
  return WebSocketClientFactory.create(config);
};

// Update existing usage points
// Replace: new ReconnectingWebSocketClient(config)
// With: createWebSocketClient({
//   baseUrl: config.url,
//   tokenProvider: () => getAuthToken(),
//   tokenRefresher: () => refreshAuthToken(),
//   debug: config.debug
// })
```

**Configuration Migration**: Update existing configuration to new format

### Task 4.2: Write Comprehensive Tests
**Duration**: 2 days
**Priority**: Critical

```typescript
// File: src/lib/websocket/__tests__/websocket-client.test.ts
describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mocks: ComponentMocks;

  beforeEach(() => {
    mocks = {
      connectionManager: new MockConnectionManager(),
      messageProcessor: new MockMessageProcessor(),
      subscriptionManager: new MockSubscriptionManager(),
      connectionMonitor: new MockConnectionMonitor()
    };

    client = WebSocketClientFactory.createForTesting(mocks);
  });

  describe('connect', () => {
    it('should delegate to connection manager', async () => {
      await client.connect();
      expect(mocks.connectionManager.connect).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      mocks.connectionManager.connect.mockRejectedValue(
        new WebSocketError('Auth failed', ERROR_CODES.AUTHENTICATION_FAILED)
      );

      await expect(client.connect()).rejects.toThrow('Auth failed');
    });
  });

  describe('subscribeToRoomState', () => {
    it('should delegate to subscription manager', async () => {
      await client.subscribeToRoomState('room1');
      expect(mocks.subscriptionManager.subscribe).toHaveBeenCalledWith('room1');
    });
  });

  describe('sendCommand', () => {
    it('should execute command through message processor', async () => {
      const command = new PowerCommand('room1', true);
      await client.sendCommand(command);

      expect(mocks.messageProcessor.sendMessage).toHaveBeenCalledWith({
        type: 'command.power',
        roomId: 'room1',
        payload: { power: true }
      });
    });
  });

  describe('resource cleanup', () => {
    it('should dispose all resources on disconnect', () => {
      client.dispose();

      expect(mocks.connectionManager.dispose).toHaveBeenCalled();
      expect(mocks.messageProcessor.dispose).toHaveBeenCalled();
      expect(mocks.subscriptionManager.dispose).toHaveBeenCalled();
      expect(mocks.connectionMonitor.cleanup).toHaveBeenCalled();
    });
  });
});

// Integration tests
describe('WebSocketClient Integration', () => {
  it('should provide complete functionality', async () => {
    const config = {
      baseUrl: 'ws://test.com',
      tokenProvider: async () => 'mock-token',
      tokenRefresher: async () => 'refreshed-token'
    };

    const client = WebSocketClientFactory.create(config);

    // Test that client provides expected interface
    expect(typeof client.connect).toBe('function');
    expect(typeof client.subscribeToRoomState).toBe('function');
    expect(typeof client.sendPowerCommand).toBe('function');
    expect(typeof client.sendTemperatureCommand).toBe('function');
    expect(typeof client.getConnectionStatus$).toBe('function');
  });
});
```

**Test Coverage Target**: >80% code coverage

### Task 4.3: Performance Benchmarking
**Duration**: 1 day
**Priority**: Medium

```typescript
// File: src/lib/websocket/__tests__/performance.test.ts
describe('Performance Benchmarks', () => {
  it('should connect within 2 seconds', async () => {
    const client = WebSocketClientFactory.create(testConfig);

    const start = Date.now();
    await client.connect();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });

  it('should process messages within 100ms', async () => {
    const client = WebSocketClientFactory.create(testConfig);
    await client.connect();

    const start = Date.now();
    await client.sendCommand(new PowerCommand('room1', true));
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should have reduced memory footprint', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    const client = WebSocketClientFactory.create(testConfig);
    // Perform operations
    client.dispose();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Should use less memory than legacy implementation
    expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
  });
});
```

### Task 4.4: Update Integration Points
**Duration**: 1 day
**Priority**: Critical

```typescript
// File: src/lib/websocket/index.ts
export { WebSocketClient } from './client/websocket-client';
export { WebSocketClientFactory } from './factory/websocket-client-factory';
export { LegacyWebSocketClientAdapter } from './adapter/legacy-adapter';
export { createWebSocketClient } from './config/feature-flags';

// Export types
export type {
  IWebSocketClient,
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  MessageType,
  WebSocketMessage
} from './types';

// Export commands
export {
  BaseCommand,
  PowerCommand,
  TemperatureCommand,
  ModeCommand,
  FanCommand,
  VaneCommand,
  WideVaneCommand
} from './commands';

// Export errors
export { WebSocketError, ERROR_CODES } from './errors';
```

**Use Context7 for Documentation**: Fetch latest package documentation to ensure optimal implementation

## Testing and Quality Assurance

### Unit Testing Strategy
- **Isolated Testing**: Each component tested independently with mocks
- **Interface Testing**: Verify all interfaces work correctly
- **Error Handling**: Test error scenarios and edge cases
- **Memory Leaks**: Validate proper resource cleanup

### Integration Testing Strategy
- **Component Integration**: Test component interactions
- **Feature Parity**: Ensure modern client matches legacy behavior
- **Real WebSocket**: Test against actual WebSocket connections
- **Performance**: Validate performance improvements

### Code Quality Validation
```bash
# TypeScript compilation
npm run type-check

# ESLint validation
npm run lint

# Test coverage
npm run test:coverage

# Performance benchmarks
npm run test:performance
```

**Clean Code Validation Checklist**:
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] All functions <20 lines
- [ ] All classes <200 lines
- [ ] >80% test coverage
- [ ] SOLID principles compliance
- [ ] DRY violations eliminated
- [ ] YAGNI principles applied

## Development Integration

### Implementation Replacement
1. **Direct File Replacement**: Replace `reconnecting-websocket-client.ts` with new modular components
2. **Update Import Statements**: Update all files importing the old client
3. **Configuration Updates**: Update WebSocket client instantiation with new factory pattern
4. **Testing**: Run all existing tests to ensure functionality

### Performance Validation
```typescript
// Performance metrics to validate during development
const VALIDATION_METRICS = {
  connectionTime: 'time to establish connection should be <2s',
  messageLatency: 'message processing should be <100ms',
  memoryUsage: 'heap usage should be reduced vs old implementation',
  bundleSize: 'no significant increase in bundle size',
  typeErrors: 'zero TypeScript compilation errors'
};
```

## Documentation Updates

### API Documentation
```typescript
// File: docs/api/websocket-client.md
/**
 * WebSocket Client API Documentation
 *
 * The modernized WebSocket client provides a clean, type-safe interface
 * for real-time communication with the backend.
 *
 * @example
 * const client = createWebSocketClient({
 *   baseUrl: 'ws://localhost:8081/ws',
 *   tokenProvider: () => getAuthToken(),
 *   tokenRefresher: () => refreshAuthToken()
 * });
 *
 * await client.connect();
 * await client.subscribeToRoomState('room1');
 */
```

### Implementation Guide
```typescript
// File: docs/implementation/websocket-client-implementation.md
/**
 * Implementation Guide: New WebSocket Client Architecture
 *
 * This guide explains the new modular WebSocket client architecture
 * and how to use it effectively.
 *
 * Key Features:
 * - Improved type safety with zero TypeScript errors
 * - Better error handling with proper error types
 * - Automatic resource cleanup preventing memory leaks
 * - Optimized reconnecting-websocket package usage
 * - SOLID principles compliance
 * - Command pattern for type-safe operations
 */
```

## Success Metrics and Validation

### Code Quality Metrics (Target vs Baseline)
| Metric | Baseline | Target | Success Criteria |
|--------|----------|---------|------------------|
| Lines of Code | 1650+ | 500-600 | 60-70% reduction |
| TypeScript Errors | 47+ | 0 | Zero errors |
| Cyclomatic Complexity | High | <10 per function | Maintainable code |
| Test Coverage | 0% | >80% | Comprehensive testing |
| Memory Leaks | Present | None | Proper cleanup |

### Performance Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Connection Time | <2 seconds | Time to establish connection |
| Message Latency | <100ms | Request/response time |
| Memory Usage | 30% reduction | Heap memory consumption |
| Bundle Size | No increase | Build output size |

### Architecture Quality
- **SOLID Compliance**: All components follow SOLID principles
- **DRY Implementation**: No duplicate code patterns
- **YAGNI Application**: Only essential features implemented
- **Package Optimization**: Proper use of reconnecting-websocket capabilities
- **Type Safety**: Comprehensive TypeScript coverage

## Risk Mitigation and Contingency

### Identified Risks and Mitigations
1. **Integration Failures**: Comprehensive testing and gradual rollout
2. **Performance Regression**: Benchmarking and monitoring
3. **Feature Regression**: Feature parity validation
4. **Memory Leaks**: Resource management and testing
5. **TypeScript Errors**: Strict compilation and validation

### Contingency Plans
1. **Feature Flag Rollback**: Instant rollback to legacy client
2. **Performance Issues**: Optimization patches or rollback
3. **Critical Bugs**: Hotfix deployment process
4. **User Impact**: Communication and status page updates

This implementation plan provides a comprehensive roadmap for refactoring the WebSocket client while ensuring clean code principles, proper package utilization, and zero-risk migration through careful planning and execution.