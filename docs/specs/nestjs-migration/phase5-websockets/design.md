# Phase 5: Real-time Communication (WebSockets) - Technical Design

## Phase Overview

**Objective**: Design comprehensive WebSocket-based real-time communication architecture using NestJS patterns that maintains 100% functional compatibility with Spring Boot backend while achieving <1s latency targets.

**Duration**: 5-7 days
**Priority**: Critical
**Dependencies**: Phase 1-4 completion and approval

## Architecture Overview

### Core WebSocket Architecture

```typescript
// High-level architecture diagram
WebSocket Client → NestJS Gateway → Authentication Guard → Message Router → Command Handler → Business Logic → Event Broadcaster → All Connected Clients
```

### Technology Stack

**Core Framework**: NestJS WebSocket Gateway with @WebSocketGateway
**Authentication**: JWT-based WebSocket authentication using custom guards
**Message Processing**: Command pattern with validation and routing
**Real-time Broadcasting**: Event-driven broadcasting with room-based filtering
**Connection Management**: Lifecycle management with resource limits
**Performance**: Optimized processing with <1s latency targets

## System Architecture

### 1. WebSocket Gateway Architecture

#### 1.1 Gateway Structure Design

**Architecture Pattern**: Gateway Pattern with Namespace Isolation
**Clean Code Application**: Single Responsibility Principle - each gateway handles one domain

```typescript
// Base WebSocket Gateway Interface
interface IBaseWebSocketGateway {
  handleConnection(client: Socket, ...args: any[]): Promise<void>;
  handleDisconnect(client: Socket): Promise<void>;
  authenticateConnection(client: Socket, token: string): Promise<UserContext>;
  broadcastEvent(event: string, payload: any, targetClients?: Socket[]): void;
}

// Air Conditioner WebSocket Gateway
@WebSocketGateway({
  namespace: 'airconditioner',
  cors: { origin: '*' },
  transports: ['websocket']
})
export class AirConditionerWebSocketGateway implements IBaseWebSocketGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly messageProcessor: MessageProcessorService,
    private readonly eventBroadcaster: EventBroadcasterService,
    private readonly connectionManager: ConnectionManagerService
  ) {}

  @SubscribeMessage('command')
  async handleAirConditionerCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AirConditionerCommandPayload
  ): Promise<WebSocketResponse> {
    // Command processing pipeline
  }
}

// Quota WebSocket Gateway
@WebSocketGateway({
  namespace: 'quota',
  cors: { origin: '*' },
  transports: ['websocket']
})
export class QuotaWebSocketGateway implements IBaseWebSocketGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly quotaService: QuotaService,
    private readonly eventBroadcaster: EventBroadcasterService,
    private readonly connectionManager: ConnectionManagerService
  ) {}
}
```

#### 1.2 Connection Management Architecture

**Design Pattern**: Singleton Pattern for connection state management
**Clean Code Application**: DRY principle - centralized connection logic

```typescript
// Connection Manager Service
@Injectable()
export class ConnectionManagerService {
  private readonly connections = new Map<string, ConnectionContext>();
  private readonly roomConnections = new Map<string, Set<string>>();
  private readonly quotaConnections = new Map<string, Set<string>>();

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
    private readonly logger: Logger
  ) {}

  // Connection registration with metadata
  async registerConnection(
    client: Socket,
    context: ConnectionContext
  ): Promise<void> {
    this.connections.set(client.id, context);

    // Register in appropriate groups
    if (context.roomId) {
      this.addToRoom(client.id, context.roomId);
    }

    if (context.quotaId) {
      this.addToQuota(client.id, context.quotaId);
    }

    // Log connection for monitoring
    this.logger.log(`Connection registered: ${client.id} for room: ${context.roomId}`);
  }

  // Connection cleanup with resource management
  async unregisterConnection(client: Socket): Promise<void> {
    const context = this.connections.get(client.id);
    if (context) {
      this.removeFromRoom(client.id, context.roomId);
      this.removeFromQuota(client.id, context.quotaId);
      this.connections.delete(client.id);

      this.logger.log(`Connection unregistered: ${client.id}`);
    }
  }

  // Get connections by criteria
  getConnectionsByRoom(roomId: string): ConnectionContext[] {
    const clientIds = this.roomConnections.get(roomId) || new Set();
    return Array.from(clientIds)
      .map(id => this.connections.get(id))
      .filter(Boolean);
  }

  getConnectionsByQuota(quotaId: string): ConnectionContext[] {
    const clientIds = this.quotaConnections.get(quotaId) || new Set();
    return Array.from(clientIds)
      .map(id => this.connections.get(id))
      .filter(Boolean);
  }
}
```

### 2. Authentication Integration Architecture

#### 2.1 WebSocket Authentication Design

**Design Pattern**: Strategy Pattern for authentication strategies
**Clean Code Application**: Interface Segregation - focused authentication interfaces

```typescript
// WebSocket Authentication Interface
interface IWebSocketAuthenticator {
  authenticate(client: Socket, token: string): Promise<AuthenticationResult>;
  validateAccess(context: ConnectionContext, resource: string): Promise<boolean>;
  refreshAuth(client: Socket): Promise<AuthenticationResult>;
}

// JWT WebSocket Authentication Guard
@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromConnection(client);

    if (!token) {
      client.disconnect();
      return false;
    }

    try {
      const authResult = await this.authService.validateToken(token);

      // Attach user context to client
      client.data.user = authResult.user;
      client.data.householdId = authResult.householdId;

      return true;
    } catch (error) {
      client.disconnect();
      return false;
    }
  }

  private extractTokenFromConnection(client: Socket): string | null {
    // Extract token from query parameters (matching Spring Boot pattern)
    const token = client.handshake.query.token as string;
    return token || null;
  }
}

// Enhanced Gateway with Authentication
@WebSocketGateway({ namespace: 'airconditioner' })
@UseGuards(WebSocketAuthGuard)
export class AirConditionerWebSocketGateway {

  @SubscribeMessage('authenticate')
  async handleAuthentication(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AuthPayload
  ): Promise<AuthResponse> {
    const connectionContext: ConnectionContext = {
      client: client,
      user: client.data.user,
      householdId: client.data.householdId,
      roomId: payload.roomId,
      familyMemberId: payload.familyMemberId,
      connectedAt: new Date()
    };

    await this.connectionManager.registerConnection(client, connectionContext);

    return {
      success: true,
      clientId: client.id,
      authenticatedAt: new Date()
    };
  }
}
```

#### 2.2 Access Control Integration

**Design Pattern**: Chain of Responsibility for authorization checks
**Clean Code Application**: Dependency Inversion - depend on authorization abstractions

```typescript
// Authorization Chain
interface IAuthorizationChain {
  check(context: ConnectionContext, operation: string, resource: string): Promise<AuthorizationResult>;
  setNext(handler: IAuthorizationChain): IAuthorizationChain;
}

// Room Access Authorization
@Injectable()
export class RoomAccessAuthorization implements IAuthorizationChain {
  private next: IAuthorizationChain;

  constructor(private readonly roomService: RoomService) {}

  async check(context: ConnectionContext, operation: string, resource: string): Promise<AuthorizationResult> {
    if (resource.startsWith('room:')) {
      const roomId = resource.replace('room:', '');
      const hasAccess = await this.roomService.isUserInRoom(context.user.id, roomId);

      return {
        allowed: hasAccess,
        reason: hasAccess ? null : 'User not authorized for this room'
      };
    }

    if (this.next) {
      return this.next.check(context, operation, resource);
    }

    return { allowed: false, reason: 'No authorization handler found' };
  }

  setNext(handler: IAuthorizationChain): IAuthorizationChain {
    this.next = handler;
    return handler;
  }
}

// Quota Access Authorization
@Injectable()
export class QuotaAccessAuthorization implements IAuthorizationChain {
  private next: IAuthorizationChain;

  constructor(private readonly quotaService: QuotaService) {}

  async check(context: ConnectionContext, operation: string, resource: string): Promise<AuthorizationResult> {
    if (resource.startsWith('quota:')) {
      const quotaId = resource.replace('quota:', '');
      const hasAccess = await this.quotaService.canUserAccessQuota(context.user.id, quotaId);

      return {
        allowed: hasAccess,
        reason: hasAccess ? null : 'User not authorized for this quota'
      };
    }

    if (this.next) {
      return this.next.check(context, operation, resource);
    }

    return { allowed: false, reason: 'No authorization handler found' };
  }

  setNext(handler: IAuthorizationChain): IAuthorizationChain {
    this.next = handler;
    return handler;
  }
}
```

### 3. Message Processing Architecture

#### 3.1 Command Processing Pipeline

**Design Pattern**: Command Pattern with Factory for command creation
**Clean Code Application**: Open/Closed Principle - extensible command system

```typescript
// Command Interface
interface IWebSocketCommand<T = any> {
  validate(payload: T): ValidationResult;
  execute(context: ExecutionContext, payload: T): Promise<CommandResult>;
  getType(): string;
}

// Base Command Implementation
export abstract class BaseWebSocketCommand<T = any> implements IWebSocketCommand<T> {
  constructor(
    protected readonly validator: ValidationPipe,
    protected readonly logger: Logger
  ) {}

  abstract validate(payload: T): ValidationResult;
  abstract execute(context: ExecutionContext, payload: T): Promise<CommandResult>;
  abstract getType(): string;

  protected createResponse(success: boolean, data?: any, error?: string): CommandResult {
    return {
      success,
      data,
      error,
      timestamp: new Date(),
      commandType: this.getType()
    };
  }
}

// Air Conditioner Commands
export class SetTemperatureCommand extends BaseWebSocketCommand<SetTemperaturePayload> {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly eventBroadcaster: EventBroadcasterService
  ) {
    super(new ValidationPipe(), new Logger(SetTemperatureCommand.name));
  }

  getType(): string {
    return 'SET_TEMPERATURE';
  }

  validate(payload: SetTemperaturePayload): ValidationResult {
    const schema = Joi.object({
      temperature: Joi.number().min(16).max(30).required(),
      roomId: Joi.string().required()
    });

    const { error, value } = schema.validate(payload);
    return {
      isValid: !error,
      errors: error?.details.map(d => d.message) || [],
      validatedPayload: value
    };
  }

  async execute(context: ExecutionContext, payload: SetTemperaturePayload): Promise<CommandResult> {
    try {
      const validation = this.validate(payload);
      if (!validation.isValid) {
        return this.createResponse(false, null, validation.errors.join(', '));
      }

      // Execute business logic
      const result = await this.deviceService.setTemperature(
        payload.roomId,
        payload.temperature,
        context.user.id
      );

      // Broadcast status change
      await this.eventBroadcaster.broadcastToRoom(
        payload.roomId,
        'temperature-changed',
        {
          roomId: payload.roomId,
          temperature: payload.temperature,
          changedBy: context.user.id,
          timestamp: new Date()
        }
      );

      return this.createResponse(true, result);
    } catch (error) {
      this.logger.error(`Failed to execute SET_TEMPERATURE: ${error.message}`);
      return this.createResponse(false, null, error.message);
    }
  }
}

// Command Factory
@Injectable()
export class WebSocketCommandFactory {
  private readonly commands = new Map<string, IWebSocketCommand>();

  constructor(
    private readonly deviceService: DeviceService,
    private readonly quotaService: QuotaService,
    private readonly eventBroadcaster: EventBroadcasterService
  ) {
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // Air Conditioner Commands
    this.commands.set('SET_TEMPERATURE', new SetTemperatureCommand(this.deviceService, this.eventBroadcaster));
    this.commands.set('SET_MODE', new SetModeCommand(this.deviceService, this.eventBroadcaster));
    this.commands.set('SET_FAN_SPEED', new SetFanSpeedCommand(this.deviceService, this.eventBroadcaster));
    this.commands.set('SET_POWER', new SetPowerCommand(this.deviceService, this.eventBroadcaster));
    this.commands.set('SET_SWING', new SetSwingCommand(this.deviceService, this.eventBroadcaster));
    this.commands.set('GET_STATUS', new GetStatusCommand(this.deviceService));

    // Quota Commands
    this.commands.set('SUBSCRIBE', new SubscribeCommand(this.quotaService, this.eventBroadcaster));
    this.commands.set('UNSUBSCRIBE', new UnsubscribeCommand(this.quotaService));
    this.commands.set('OVERRIDE_REQUEST', new OverrideRequestCommand(this.quotaService, this.eventBroadcaster));
    this.commands.set('OVERRIDE_APPROVAL', new OverrideApprovalCommand(this.quotaService, this.eventBroadcaster));
    this.commands.set('HEALTH_CHECK', new HealthCheckCommand(this.quotaService));
  }

  createCommand(commandType: string): IWebSocketCommand | null {
    return this.commands.get(commandType) || null;
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}
```

#### 3.2 Message Router Design

**Design Pattern**: Router Pattern for message dispatch
**Clean Code Application**: Single Responsibility - focused routing logic

```typescript
// Message Router Service
@Injectable()
export class MessageRouterService {
  constructor(
    private readonly commandFactory: WebSocketCommandFactory,
    private readonly connectionManager: ConnectionManagerService,
    private readonly logger: Logger
  ) {}

  async routeMessage(
    client: Socket,
    messageType: string,
    payload: any
  ): Promise<WebSocketResponse> {
    try {
      const connectionContext = this.connectionManager.getConnection(client.id);
      if (!connectionContext) {
        throw new Error('Connection not authenticated');
      }

      const command = this.commandFactory.createCommand(messageType);
      if (!command) {
        throw new Error(`Unknown command type: ${messageType}`);
      }

      const executionContext: ExecutionContext = {
        client,
        user: connectionContext.user,
        householdId: connectionContext.householdId,
        roomId: connectionContext.roomId,
        quotaId: connectionContext.quotaId,
        familyMemberId: connectionContext.familyMemberId
      };

      const result = await command.execute(executionContext, payload);

      return {
        type: 'response',
        messageId: this.generateMessageId(),
        command: messageType,
        success: result.success,
        data: result.data,
        error: result.error,
        timestamp: result.timestamp
      };
    } catch (error) {
      this.logger.error(`Message routing failed: ${error.message}`);
      return {
        type: 'error',
        messageId: this.generateMessageId(),
        command: messageType,
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 4. Real-time Event Broadcasting Architecture

#### 4.1 Event Broadcasting System

**Design Pattern**: Observer Pattern with pub/sub
**Clean Code Application**: DRY principle - unified broadcasting logic

```typescript
// Event Broadcaster Interface
interface IEventBroadcaster {
  broadcastToRoom(roomId: string, event: string, payload: any): Promise<void>;
  broadcastToQuota(quotaId: string, event: string, payload: any): Promise<void>;
  broadcastToClient(clientId: string, event: string, payload: any): Promise<void>;
  broadcastToHousehold(householdId: string, event: string, payload: any): Promise<void>;
}

// Redis-backed Event Broadcaster
@Injectable()
export class EventBroadcasterService implements IEventBroadcaster {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
    private readonly connectionManager: ConnectionManagerService,
    private readonly logger: Logger
  ) {}

  async broadcastToRoom(roomId: string, event: string, payload: any): Promise<void> {
    const connections = this.connectionManager.getConnectionsByRoom(roomId);

    const broadcastPayload = {
      event,
      payload,
      targetRoom: roomId,
      timestamp: new Date(),
      recipientCount: connections.length
    };

    // Publish to Redis for cross-instance broadcasting
    await this.pubSub.publish(`room:${roomId}`, broadcastPayload);

    // Local broadcasting
    for (const connection of connections) {
      connection.client.emit(event, payload);
    }

    this.logger.log(`Broadcasted event ${event} to room ${roomId} (${connections.length} clients)`);
  }

  async broadcastToQuota(quotaId: string, event: string, payload: any): Promise<void> {
    const connections = this.connectionManager.getConnectionsByQuota(quotaId);

    const broadcastPayload = {
      event,
      payload,
      targetQuota: quotaId,
      timestamp: new Date(),
      recipientCount: connections.length
    };

    await this.pubSub.publish(`quota:${quotaId}`, broadcastPayload);

    for (const connection of connections) {
      connection.client.emit(event, payload);
    }

    this.logger.log(`Broadcasted event ${event} to quota ${quotaId} (${connections.length} clients)`);
  }

  async broadcastToClient(clientId: string, event: string, payload: any): Promise<void> {
    const connection = this.connectionManager.getConnection(clientId);
    if (connection) {
      connection.client.emit(event, payload);
      this.logger.log(`Broadcasted event ${event} to client ${clientId}`);
    }
  }

  async broadcastToHousehold(householdId: string, event: string, payload: any): Promise<void> {
    // Implementation for household-wide broadcasting
    const allConnections = this.connectionManager.getAllConnections();
    const householdConnections = allConnections.filter(
      conn => conn.householdId === householdId
    );

    for (const connection of householdConnections) {
      connection.client.emit(event, payload);
    }

    this.logger.log(`Broadcasted event ${event} to household ${householdId} (${householdConnections.length} clients)`);
  }
}
```

#### 4.2 Event Subscription Management

**Design Pattern**: Observer Pattern for event subscriptions
**Clean Code Application**: Interface Segregation - focused subscription interfaces

```typescript
// Event Subscription Manager
@Injectable()
export class EventSubscriptionManager {
  private readonly subscriptions = new Map<string, Set<string>>(); // event -> clientIds

  constructor(
    private readonly eventBroadcaster: EventBroadcasterService,
    private readonly connectionManager: ConnectionManagerService
  ) {}

  async subscribeToEvent(clientId: string, eventPattern: string): Promise<void> {
    if (!this.subscriptions.has(eventPattern)) {
      this.subscriptions.set(eventPattern, new Set());
    }

    this.subscriptions.get(eventPattern).add(clientId);

    const connection = this.connectionManager.getConnection(clientId);
    if (connection) {
      connection.subscriptions = connection.subscriptions || new Set();
      connection.subscriptions.add(eventPattern);
    }
  }

  async unsubscribeFromEvent(clientId: string, eventPattern: string): Promise<void> {
    const eventSubscriptions = this.subscriptions.get(eventPattern);
    if (eventSubscriptions) {
      eventSubscriptions.delete(clientId);

      if (eventSubscriptions.size === 0) {
        this.subscriptions.delete(eventPattern);
      }
    }

    const connection = this.connectionManager.getConnection(clientId);
    if (connection && connection.subscriptions) {
      connection.subscriptions.delete(eventPattern);
    }
  }

  async unsubscribeAll(clientId: string): Promise<void> {
    for (const [eventPattern, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(clientId);

      if (subscribers.size === 0) {
        this.subscriptions.delete(eventPattern);
      }
    }

    const connection = this.connectionManager.getConnection(clientId);
    if (connection) {
      connection.subscriptions.clear();
    }
  }

  getSubscribers(eventPattern: string): string[] {
    const subscribers = this.subscriptions.get(eventPattern);
    return subscribers ? Array.from(subscribers) : [];
  }
}
```

### 5. Performance Optimization Architecture

#### 5.1 Connection Optimization

**Design Pattern**: Pool Pattern for connection management
**Clean Code Application**: YAGNI principle - optimized but not over-engineered

```typescript
// Connection Pool Manager
@Injectable()
export class ConnectionPoolManager {
  private readonly connectionPools = new Map<string, ConnectionPool>();
  private readonly maxConnectionsPerRoom = 100;
  private readonly maxConnectionsPerQuota = 50;

  constructor(private readonly metricsService: MetricsService) {}

  async canAcceptConnection(roomId: string, quotaId: string): Promise<boolean> {
    const roomConnections = this.connectionPools.get(`room:${roomId}`);
    const quotaConnections = this.connectionPools.get(`quota:${quotaId}`);

    const roomCount = roomConnections?.size || 0;
    const quotaCount = quotaConnections?.size || 0;

    return roomCount < this.maxConnectionsPerRoom && quotaCount < this.maxConnectionsPerQuota;
  }

  async addToPool(poolKey: string, client: Socket): Promise<void> {
    if (!this.connectionPools.has(poolKey)) {
      this.connectionPools.set(poolKey, new ConnectionPool());
    }

    const pool = this.connectionPools.get(poolKey);
    await pool.addConnection(client);

    // Record metrics
    this.metricsService.recordGauge('websocket_pool_size', pool.size, { pool: poolKey });
  }

  async removeFromPool(poolKey: string, clientId: string): Promise<void> {
    const pool = this.connectionPools.get(poolKey);
    if (pool) {
      await pool.removeConnection(clientId);

      if (pool.size === 0) {
        this.connectionPools.delete(poolKey);
      }
    }
  }
}

// Optimized Message Processing
@Injectable()
export class OptimizedMessageProcessor {
  private readonly messageQueue = new Queue<WebSocketMessage>();
  private readonly batchSize = 10;
  private readonly batchTimeout = 50; // ms

  constructor(
    private readonly commandFactory: WebSocketCommandFactory,
    private readonly eventBroadcaster: EventBroadcasterService
  ) {
    this.startBatchProcessor();
  }

  async processMessage(message: WebSocketMessage): Promise<void> {
    this.messageQueue.enqueue(message);
  }

  private startBatchProcessor(): void {
    setInterval(() => {
      this.processBatch();
    }, this.batchTimeout);
  }

  private async processBatch(): Promise<void> {
    if (this.messageQueue.isEmpty()) return;

    const batch = this.messageQueue.dequeueBatch(this.batchSize);

    // Process messages in parallel
    const results = await Promise.allSettled(
      batch.map(msg => this.processSingleMessage(msg))
    );

    // Handle results and broadcasting
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    // Batch broadcast events
    await this.batchBroadcastEvents(successfulResults);
  }

  private async processSingleMessage(message: WebSocketMessage): Promise<any> {
    const command = this.commandFactory.createCommand(message.type);
    if (!command) {
      throw new Error(`Unknown command: ${message.type}`);
    }

    return command.execute(message.context, message.payload);
  }

  private async batchBroadcastEvents(results: any[]): Promise<void> {
    // Group events by target for efficient broadcasting
    const eventsByRoom = new Map<string, any[]>();
    const eventsByQuota = new Map<string, any[]>();

    for (const result of results) {
      if (result.broadcastEvent) {
        if (result.targetRoom) {
          if (!eventsByRoom.has(result.targetRoom)) {
            eventsByRoom.set(result.targetRoom, []);
          }
          eventsByRoom.get(result.targetRoom).push(result.broadcastEvent);
        }

        if (result.targetQuota) {
          if (!eventsByQuota.has(result.targetQuota)) {
            eventsByQuota.set(result.targetQuota, []);
          }
          eventsByQuota.get(result.targetQuota).push(result.broadcastEvent);
        }
      }
    }

    // Batch broadcast
    const broadcastPromises = [
      ...Array.from(eventsByRoom.entries()).map(([room, events]) =>
        this.eventBroadcaster.broadcastToRoom(room, 'batch-update', { events })
      ),
      ...Array.from(eventsByQuota.entries()).map(([quota, events]) =>
        this.eventBroadcaster.broadcastToQuota(quota, 'batch-update', { events })
      )
    ];

    await Promise.allSettled(broadcastPromises);
  }
}
```

### 6. Integration Architecture

#### 6.1 Cross-Service Integration

**Design Pattern**: Adapter Pattern for service integration
**Clean Code Application**: Dependency Inversion - depend on service interfaces

```typescript
// Service Integration Adapters
@Injectable()
export class DeviceServiceAdapter {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly quotaService: QuotaService,
    private readonly eventBroadcaster: EventBroadcasterService
  ) {}

  async processDeviceCommand(
    roomId: string,
    command: string,
    payload: any,
    userId: string
  ): Promise<any> {
    // Check quota if required
    if (this.requiresQuotaCheck(command)) {
      const quotaResult = await this.quotaService.validateUsage(roomId, userId, command);
      if (!quotaResult.allowed) {
        throw new Error(`Quota limit exceeded: ${quotaResult.reason}`);
      }
    }

    // Execute device command
    const result = await this.deviceService.executeCommand(roomId, command, payload);

    // Broadcast status change
    await this.eventBroadcaster.broadcastToRoom(roomId, 'device-status-changed', {
      roomId,
      command,
      result,
      executedBy: userId,
      timestamp: new Date()
    });

    return result;
  }

  private requiresQuotaCheck(command: string): boolean {
    // Power OFF and read-only commands bypass quota validation
    return !['SET_POWER_OFF', 'GET_STATUS'].includes(command);
  }
}

// Quota Service Integration
@Injectable()
export class QuotaServiceAdapter {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly notificationService: NotificationService,
    private readonly eventBroadcaster: EventBroadcasterService
  ) {}

  async processQuotaEvent(
    quotaId: string,
    eventType: QuotaEventType,
    payload: any
  ): Promise<void> {
    // Process quota event
    const result = await this.quotaService.processEvent(quotaId, eventType, payload);

    // Broadcast to subscribers
    await this.eventBroadcaster.broadcastToQuota(quotaId, 'quota-event', {
      quotaId,
      eventType,
      payload: result,
      timestamp: new Date()
    });

    // Send notifications if needed
    if (result.requiresNotification) {
      await this.notificationService.sendQuotaNotification(result);
    }
  }
}
```

#### 6.2 Error Handling Integration

**Design Pattern**: Circuit Breaker Pattern for resilience
**Clean Code Application**: Single Responsibility - focused error handling

```typescript
// WebSocket Error Handler
@Catch()
export class WebSocketExceptionFilter implements WsExceptionFilter {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient();
    const event = host.switchToWs().getData();

    const errorResponse = this.handleError(exception, event);

    client.emit('error', errorResponse);
    client.disconnect();
  }

  private handleError(exception: unknown, event: any): WebSocketErrorResponse {
    if (exception instanceof WsException) {
      return {
        type: 'websocket_error',
        message: exception.message,
        event: event?.type || 'unknown',
        timestamp: new Date(),
        recoverable: false
      };
    }

    if (exception instanceof UnauthorizedException) {
      return {
        type: 'authentication_error',
        message: 'Authentication failed',
        recoverable: false,
        timestamp: new Date()
      };
    }

    return {
      type: 'internal_error',
      message: 'Internal server error',
      timestamp: new Date(),
      recoverable: true
    };
  }
}

// Circuit Breaker for External Service Calls
@Injectable()
export class WebSocketCircuitBreaker {
  private readonly breakers = new Map<string, CircuitBreaker>();

  getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker({
        timeout: 60000, // 1 minute
        errorThresholdPercentage: 50,
        resetTimeout: 30000 // 30 seconds
      }));
    }
    return this.breakers.get(serviceName);
  }

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceName);
    return breaker.execute(operation);
  }
}
```

## Message Flow Architecture

### 1. Air Conditioner Control Flow

```
Client Connect → JWT Validation → Connection Registration → Command Received →
Command Validation → Quota Check (if needed) → Device Execution →
Status Update → Event Broadcasting → Client Response
```

### 2. Quota Management Flow

```
Client Connect → JWT Validation → Quota Access Check → Subscription Management →
Real-time Monitoring → Event Notifications → Status Updates →
Override Processing → Client Response
```

## Performance Architecture

### 1. Latency Optimization

- **Connection Establishment**: <2s target with optimized handshake
- **Message Processing**: <500ms with command queuing and parallel processing
- **Event Broadcasting**: <1s with batched broadcasting and Redis pub/sub
- **Command Execution**: <200ms with direct service integration

### 2. Scalability Architecture

- **Connection Limits**: 100+ concurrent connections per endpoint
- **Memory Management**: <512MB for 1000 connections with connection pooling
- **CPU Optimization**: <30% usage under normal load with event-driven processing
- **Network Efficiency**: Message batching and compression for high-frequency updates

### 3. Monitoring and Metrics

```typescript
// WebSocket Metrics Service
@Injectable()
export class WebSocketMetricsService {
  constructor(
    private readonly prometheus: PrometheusService,
    private readonly logger: Logger
  ) {}

  recordConnectionEstablished(endpoint: string): void {
    this.prometheus.incrementCounter('websocket_connections_total', { endpoint });
    this.prometheus.recordGauge('websocket_active_connections', 1, { endpoint });
  }

  recordConnectionClosed(endpoint: string): void {
    this.prometheus.incrementCounter('websocket_disconnections_total', { endpoint });
    this.prometheus.recordGauge('websocket_active_connections', -1, { endpoint });
  }

  recordMessageProcessed(commandType: string, processingTime: number): void {
    this.prometheus.incrementCounter('websocket_messages_total', { command: commandType });
    this.prometheus.recordHistogram('websocket_message_processing_duration', processingTime, { command: commandType });
  }

  recordEventBroadcast(eventType: string, recipientCount: number): void {
    this.prometheus.incrementCounter('websocket_events_broadcast_total', { event: eventType });
    this.prometheus.recordHistogram('websocket_broadcast_recipients', recipientCount, { event: eventType });
  }
}
```

## Security Architecture

### 1. Connection Security

- **JWT Authentication**: Token validation for all connections
- **Rate Limiting**: Connection rate limiting per IP and user
- **Access Control**: Room and quota-based access validation
- **Message Validation**: Input validation and sanitization

### 2. Message Security

- **Command Authorization**: Role-based access control for commands
- **Content Validation**: Zod schemas for message validation
- **Size Limits**: Message size restrictions to prevent abuse
- **Injection Prevention**: Input sanitization and SQL injection prevention

## Data Models

### 1. Connection Context

```typescript
interface ConnectionContext {
  client: Socket;
  user: User;
  householdId: string;
  roomId?: string;
  quotaId?: string;
  familyMemberId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}
```

### 2. Message Models

```typescript
interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  context: ExecutionContext;
  timestamp: Date;
}

interface WebSocketResponse {
  type: 'response' | 'error' | 'broadcast';
  messageId: string;
  command: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}
```

### 3. Command Models

```typescript
interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
  commandType: string;
  broadcastEvent?: any;
  targetRoom?: string;
  targetQuota?: string;
}
```

## Testing Architecture

### 1. Unit Testing Strategy

- **Gateway Testing**: Mock WebSocket clients for gateway testing
- **Command Testing**: Individual command validation and execution testing
- **Service Testing**: Authentication, message routing, and broadcasting testing
- **Error Handling Testing**: Exception scenarios and recovery testing

### 2. Integration Testing Strategy

- **End-to-End Flow Testing**: Complete message flow testing
- **Multi-Client Testing**: Concurrent connection and broadcasting testing
- **Performance Testing**: Load testing with simulated connections
- **Security Testing**: Authentication bypass and injection testing

## Deployment Architecture

### 1. Scaling Strategy

- **Horizontal Scaling**: Multiple WebSocket instances with Redis adapter
- **Load Balancing**: Sticky sessions or Redis-based session management
- **Resource Management**: Connection limits and resource monitoring
- **High Availability**: Circuit breakers and failover mechanisms

### 2. Configuration Management

```typescript
// WebSocket Configuration
interface WebSocketConfig {
  airConditioner: {
    namespace: string;
    maxConnections: number;
    heartbeatInterval: number;
    disconnectTimeout: number;
  };
  quota: {
    namespace: string;
    maxConnections: number;
    heartbeatInterval: number;
    disconnectTimeout: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  performance: {
    batchSize: number;
    batchTimeout: number;
    maxConcurrentProcessing: number;
  };
}
```

This comprehensive technical design provides a robust, scalable, and maintainable WebSocket architecture that maintains complete compatibility with the Spring Boot backend while achieving the performance targets specified in the requirements. The architecture follows clean code principles and uses appropriate design patterns to ensure long-term maintainability and extensibility.