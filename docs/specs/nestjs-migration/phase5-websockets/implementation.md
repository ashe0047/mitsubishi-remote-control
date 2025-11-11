# Phase 5: Real-time Communication (WebSockets) - Implementation Plan

## Phase Overview

**Objective**: Implement comprehensive WebSocket-based real-time communication system using NestJS that maintains 100% functional compatibility with Spring Boot backend while achieving <1s latency targets.

**Duration**: 5-7 days
**Priority**: Critical
**Dependencies**: Phase 1-4 completion and approval

## Implementation Strategy

### Development Approach

**Incremental Implementation**: Build WebSocket functionality incrementally with testing at each stage
**Spec-Driven Development**: Follow the technical design document exactly
**Performance-First**: Optimize for <1s latency targets throughout implementation
**Clean Code Standards**: Apply DRY, SOLID, and YAGNI principles consistently
**Testing-First**: Write tests before implementation for critical components

## Phase-by-Phase Implementation

### Phase 5.1: Core WebSocket Infrastructure (Days 1-2)

#### 5.1.1 Project Setup and Dependencies

**Required Packages Installation**:
> **Package Documentation**: Core WebSocket packages for NestJS real-time communication
>
> **@nestjs/websockets**: WebSocket gateway framework for NestJS
> - Decorator-based gateway creation
> - Lifecycle hooks and event handling
> - Integration with NestJS modules
>
> **@nestjs/platform-socket.io**: Socket.IO adapter for NestJS
> - Real-time bidirectional communication
> - Room-based broadcasting
> - Automatic reconnection handling
> - Cross-instance scaling with Redis adapter
>
> **socket.io**: WebSocket library with fallbacks
> - Browser and server compatibility
> - Automatic transport detection
> - Built-in ping/pong and reconnection

```bash
# Core WebSocket packages
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @nestjs/platform-ws ws

# Redis for cross-instance communication
npm install redis @redis/json @redis/search
npm install @nestjs/cache-manager cache-manager-redis-store

# Validation and transformation
npm install class-validator class-transformer
npm install @nestjs/throttler

# Monitoring and metrics
npm install prom-client

# Development dependencies
npm install -D @types/ws
```

**Project Structure**:
```
src/
├── websockets/
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── interfaces/
│   ├── airconditioner/
│   │   ├── dto/
│   │   ├── commands/
│   │   └── airconditioner.gateway.ts
│   ├── quota/
│   │   ├── dto/
│   │   ├── commands/
│   │   └── quota.gateway.ts
│   └── services/
│       ├── connection-manager.service.ts
│       ├── message-router.service.ts
│       ├── event-broadcaster.service.ts
│       └── websocket-metrics.service.ts
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
└── config/
    └── websocket.config.ts
```

#### 5.1.2 Core WebSocket Module Implementation

**Step 1: Create WebSocket Module** (`src/websockets/websocket.module.ts`)
```typescript
import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway.module';
import { ServicesModule } from './services/services.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    GatewayModule,
    ServicesModule,
    RedisModule,
  ],
  exports: [
    GatewayModule,
    ServicesModule,
  ],
})
export class WebSocketModule {}
```

**Step 2: Implement Connection Manager Service** (`src/websockets/services/connection-manager.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

export interface ConnectionContext {
  client: Socket;
  user: any;
  householdId: string;
  roomId?: string;
  quotaId?: string;
  familyMemberId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}

@Injectable()
export class ConnectionManagerService {
  private readonly connections = new Map<string, ConnectionContext>();
  private readonly roomConnections = new Map<string, Set<string>>();
  private readonly quotaConnections = new Map<string, Set<string>>();
  private readonly logger = new Logger(ConnectionManagerService.name);

  async registerConnection(
    client: Socket,
    context: ConnectionContext
  ): Promise<void> {
    this.connections.set(client.id, context);

    if (context.roomId) {
      this.addToRoom(client.id, context.roomId);
    }

    if (context.quotaId) {
      this.addToQuota(client.id, context.quotaId);
    }

    this.logger.log(`Connection registered: ${client.id} for room: ${context.roomId}`);
  }

  async unregisterConnection(client: Socket): Promise<void> {
    const context = this.connections.get(client.id);
    if (context) {
      this.removeFromRoom(client.id, context.roomId);
      this.removeFromQuota(client.id, context.quotaId);
      this.connections.delete(client.id);
      this.logger.log(`Connection unregistered: ${client.id}`);
    }
  }

  getConnection(clientId: string): ConnectionContext | null {
    return this.connections.get(clientId) || null;
  }

  getConnectionsByRoom(roomId: string): ConnectionContext[] {
    const clientIds = this.roomConnections.get(roomId) || new Set();
    return Array.from(clientIds)
      .map(id => this.connections.get(id))
      .filter(Boolean) as ConnectionContext[];
  }

  getConnectionsByQuota(quotaId: string): ConnectionContext[] {
    const clientIds = this.quotaConnections.get(quotaId) || new Set();
    return Array.from(clientIds)
      .map(id => this.connections.get(id))
      .filter(Boolean) as ConnectionContext[];
  }

  getAllConnections(): ConnectionContext[] {
    return Array.from(this.connections.values());
  }

  private addToRoom(clientId: string, roomId: string): void {
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(clientId);
  }

  private removeFromRoom(clientId: string, roomId?: string): void {
    if (roomId) {
      this.roomConnections.get(roomId)?.delete(clientId);
    }
  }

  private addToQuota(clientId: string, quotaId: string): void {
    if (!this.quotaConnections.has(quotaId)) {
      this.quotaConnections.set(quotaId, new Set());
    }
    this.quotaConnections.get(quotaId)!.add(clientId);
  }

  private removeFromQuota(clientId: string, quotaId?: string): void {
    if (quotaId) {
      this.quotaConnections.get(quotaId)?.delete(clientId);
    }
  }
}
```

**Step 3: Implement WebSocket Authentication Guard** (`src/websockets/common/guards/websocket-auth.guard.ts`)
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromConnection(client);

    if (!token) {
      this.logger.warn(`Connection rejected: no token provided for client ${client.id}`);
      client.disconnect();
      return false;
    }

    try {
      const authResult = await this.authService.validateToken(token);

      // Attach user context to client
      client.data.user = authResult.user;
      client.data.householdId = authResult.householdId;

      this.logger.log(`Client ${client.id} authenticated for user ${authResult.user.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
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
```

**Step 4: Implement Redis Configuration** (`src/redis/redis.module.ts`)
```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const Redis = require('redis');

        const publisher = Redis.createClient({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
          },
          password: configService.get('REDIS_PASSWORD'),
        });

        const subscriber = publisher.duplicate();

        await publisher.connect();
        await subscriber.connect();

        return { publisher, subscriber };
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
```

**Step 5: Implement Redis Service** (`src/redis/redis.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClients: any
  ) {}

  get publisher() {
    return this.redisClients.publisher;
  }

  get subscriber() {
    return this.redisClients.subscriber;
  }

  async publish(channel: string, message: any): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}: ${error.message}`);
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: any, channel: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, (message: string, subscribedChannel: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage, subscribedChannel);
        } catch (parseError) {
          this.logger.error(`Failed to parse message from channel ${subscribedChannel}: ${parseError.message}`);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}: ${error.message}`);
      throw error;
    }
  }
}
```

#### 5.1.3 Testing Core Infrastructure

**Unit Test for Connection Manager** (`src/websockets/services/connection-manager.service.spec.ts`)
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionManagerService, ConnectionContext } from './connection-manager.service';
import { Socket } from 'socket.io';

describe('ConnectionManagerService', () => {
  let service: ConnectionManagerService;
  let mockClient: jest.Mocked<Socket>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectionManagerService],
    }).compile();

    service = module.get<ConnectionManagerService>(ConnectionManagerService);

    mockClient = {
      id: 'test-client-id',
    } as any;
  });

  it('should register connection successfully', () => {
    const context: ConnectionContext = {
      client: mockClient,
      user: { id: 'user1', householdId: 'household1' },
      householdId: 'household1',
      roomId: 'room1',
      familyMemberId: 'member1',
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
    };

    service.registerConnection(mockClient, context);

    const retrievedContext = service.getConnection(mockClient.id);
    expect(retrievedContext).toEqual(context);
  });

  it('should retrieve connections by room', () => {
    const context1: ConnectionContext = {
      client: { id: 'client1' } as any,
      user: { id: 'user1', householdId: 'household1' },
      householdId: 'household1',
      roomId: 'room1',
      familyMemberId: 'member1',
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
    };

    const context2: ConnectionContext = {
      client: { id: 'client2' } as any,
      user: { id: 'user2', householdId: 'household1' },
      householdId: 'household1',
      roomId: 'room1',
      familyMemberId: 'member2',
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
    };

    const context3: ConnectionContext = {
      client: { id: 'client3' } as any,
      user: { id: 'user3', householdId: 'household1' },
      householdId: 'household1',
      roomId: 'room2',
      familyMemberId: 'member3',
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
    };

    service.registerConnection({ id: 'client1' } as any, context1);
    service.registerConnection({ id: 'client2' } as any, context2);
    service.registerConnection({ id: 'client3' } as any, context3);

    const room1Connections = service.getConnectionsByRoom('room1');
    expect(room1Connections).toHaveLength(2);
    expect(room1Connections.map(c => c.client.id)).toEqual(['client1', 'client2']);

    const room2Connections = service.getConnectionsByRoom('room2');
    expect(room2Connections).toHaveLength(1);
    expect(room2Connections[0].client.id).toBe('client3');
  });
});
```

### Phase 5.2: Air Conditioner WebSocket Implementation (Days 2-3)

#### 5.2.1 Air Conditioner Gateway Implementation

**Step 1: Create DTOs** (`src/websockets/airconditioner/dto/airconditioner.dto.ts`)
```typescript
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class AirConditionerCommandDto {
  @IsString()
  command: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  familyMemberId?: string;

  @IsOptional()
  temperature?: number;

  @IsOptional()
  mode?: string;

  @IsOptional()
  fanSpeed?: string;

  @IsOptional()
  power?: boolean;

  @IsOptional()
  swing?: boolean;
}

export class SetTemperatureDto {
  @IsNumber()
  @Min(16)
  @Max(30)
  temperature: number;
}

export class SetModeDto {
  @IsString()
  mode: 'off' | 'heat' | 'cool' | 'auto' | 'dry' | 'fan_only';
}

export class SetFanSpeedDto {
  @IsString()
  fanSpeed: 'auto' | 'quiet' | 'low' | 'medium' | 'high';
}

export class SetPowerDto {
  @IsString()
  power: 'on' | 'off';
}

export class SetSwingDto {
  @IsString()
  swing: 'auto' | 'highest' | 'high' | 'middle' | 'low' | 'lowest';
}

export class GetStatusDto {
  @IsString()
  roomId: string;
}
```

**Step 2: Implement Air Conditioner Gateway** (`src/websockets/airconditioner/airconditioner.gateway.ts`)
```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  WsException,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WebSocketAuthGuard } from '../common/guards/websocket-auth.guard';
import { ValidationPipe } from '@nestjs/common';
import { ConnectionManagerService, ConnectionContext } from '../services/connection-manager.service';
import { MessageRouterService } from '../services/message-router.service';
import { EventBroadcasterService } from '../services/event-broadcaster.service';
import { WebSocketMetricsService } from '../services/websocket-metrics.service';
import {
  AirConditionerCommandDto,
  SetTemperatureDto,
  SetModeDto,
  SetFanSpeedDto,
  SetPowerDto,
  SetSwingDto,
  GetStatusDto,
} from './dto/airconditioner.dto';

@WebSocketGateway({
  namespace: 'airconditioner',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})
@UseGuards(WebSocketAuthGuard)
export class AirConditionerWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AirConditionerWebSocketGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly messageRouter: MessageRouterService,
    private readonly eventBroadcaster: EventBroadcasterService,
    private readonly metricsService: WebSocketMetricsService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('Air Conditioner WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      this.metricsService.recordConnectionEstablished('airconditioner');

      // Extract connection parameters from query
      const roomId = client.handshake.query.roomId as string;
      const familyMemberId = client.handshake.query.familyMemberId as string;

      if (!roomId || !familyMemberId) {
        client.disconnect();
        return;
      }

      const connectionContext: ConnectionContext = {
        client,
        user: client.data.user,
        householdId: client.data.householdId,
        roomId,
        familyMemberId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
      };

      await this.connectionManager.registerConnection(client, connectionContext);

      client.emit('connected', {
        clientId: client.id,
        roomId,
        timestamp: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} for room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.connectionManager.unregisterConnection(client);
      this.metricsService.recordConnectionClosed('airconditioner');
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  @SubscribeMessage('command')
  async handleCommand(
    @MessageBody(new ValidationPipe({ transform: true })) payload: AirConditionerCommandDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Received command: ${payload.command} from client: ${client.id}`);

      const response = await this.messageRouter.routeMessage(
        client,
        payload.command,
        payload,
      );

      const processingTime = Date.now() - startTime;
      this.metricsService.recordMessageProcessed(payload.command, processingTime);

      return response;
    } catch (error) {
      this.logger.error(`Command processing error: ${error.message}`);

      const processingTime = Date.now() - startTime;
      this.metricsService.recordMessageProcessed(payload.command, processingTime);

      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('set_temperature')
  async handleSetTemperature(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SetTemperatureDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SET_TEMPERATURE',
        temperature: payload.temperature,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('set_mode')
  async handleSetMode(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SetModeDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SET_MODE',
        mode: payload.mode,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('set_fan_speed')
  async handleSetFanSpeed(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SetFanSpeedDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SET_FAN_SPEED',
        fanSpeed: payload.fanSpeed,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('set_power')
  async handleSetPower(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SetPowerDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SET_POWER',
        power: payload.power,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('set_swing')
  async handleSetSwing(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SetSwingDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SET_SWING',
        swing: payload.swing,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('get_status')
  async handleGetStatus(
    @MessageBody(new ValidationPipe({ transform: true })) payload: GetStatusDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'GET_STATUS',
        roomId: payload.roomId,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket): Promise<{ pong: number }> {
    return { pong: Date.now() };
  }
}
```

#### 5.2.2 Air Conditioner Command Implementation

**Step 1: Create Command Interfaces** (`src/websockets/airconditioner/commands/interfaces/command.interface.ts`)
```typescript
export interface ExecutionContext {
  client: any;
  user: any;
  householdId: string;
  roomId?: string;
  quotaId?: string;
  familyMemberId: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validatedPayload?: any;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
  commandType: string;
  broadcastEvent?: any;
  targetRoom?: string;
  targetQuota?: string;
}

export interface IWebSocketCommand<T = any> {
  validate(payload: T): ValidationResult;
  execute(context: ExecutionContext, payload: T): Promise<CommandResult>;
  getType(): string;
}
```

**Step 2: Implement Base Command** (`src/websockets/airconditioner/commands/base.command.ts`)
```typescript
import { Logger, ValidationPipe } from '@nestjs/common';
import { IWebSocketCommand, ExecutionContext, ValidationResult, CommandResult } from './interfaces/command.interface';

export abstract class BaseWebSocketCommand<T = any> implements IWebSocketCommand<T> {
  protected readonly logger: Logger;
  protected readonly validator: ValidationPipe;

  constructor(commandName: string) {
    this.logger = new Logger(commandName);
    this.validator = new ValidationPipe({ transform: true });
  }

  abstract validate(payload: T): ValidationResult;
  abstract execute(context: ExecutionContext, payload: T): Promise<CommandResult>;
  abstract getType(): string;

  protected createResponse(success: boolean, data?: any, error?: string): CommandResult {
    return {
      success,
      data,
      error,
      timestamp: new Date(),
      commandType: this.getType(),
    };
  }

  protected createBroadcastResponse(
    success: boolean,
    data?: any,
    error?: string,
    broadcastEvent?: any,
    targetRoom?: string,
  ): CommandResult {
    return {
      success,
      data,
      error,
      timestamp: new Date(),
      commandType: this.getType(),
      broadcastEvent,
      targetRoom,
    };
  }
}
```

**Step 3: Implement Set Temperature Command** (`src/websockets/airconditioner/commands/set-temperature.command.ts`)
```typescript
import { Injectable } from '@nestjs/common';
import { DeviceService } from '../../devices/device.service';
import { EventBroadcasterService } from '../../services/event-broadcaster.service';
import { BaseWebSocketCommand } from './base.command';
import { ExecutionContext, ValidationResult, CommandResult } from './interfaces/command.interface';
import { SetTemperatureDto } from '../dto/airconditioner.dto';

@Injectable()
export class SetTemperatureCommand extends BaseWebSocketCommand<SetTemperatureDto> {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly eventBroadcaster: EventBroadcasterService,
  ) {
    super(SetTemperatureCommand.name);
  }

  getType(): string {
    return 'SET_TEMPERATURE';
  }

  validate(payload: SetTemperatureDto): ValidationResult {
    try {
      const validatedPayload = this.validator.transform(payload, {
        type: SetTemperatureDto,
      });

      return {
        isValid: true,
        errors: [],
        validatedPayload,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
      };
    }
  }

  async execute(context: ExecutionContext, payload: SetTemperatureDto): Promise<CommandResult> {
    try {
      const validation = this.validate(payload);
      if (!validation.isValid) {
        return this.createResponse(false, null, validation.errors.join(', '));
      }

      const { temperature } = validation.validatedPayload;

      // Execute device command
      const result = await this.deviceService.setTemperature(
        context.roomId!,
        temperature,
        context.user.id,
      );

      // Create broadcast event
      const broadcastEvent = {
        type: 'temperature-changed',
        roomId: context.roomId,
        temperature,
        changedBy: context.user.id,
        timestamp: new Date(),
        previousTemperature: result.previousTemperature,
      };

      // Broadcast to room
      await this.eventBroadcaster.broadcastToRoom(
        context.roomId!,
        'temperature-changed',
        broadcastEvent,
      );

      return this.createBroadcastResponse(
        true,
        { temperature, roomId: context.roomId },
        null,
        broadcastEvent,
        context.roomId,
      );
    } catch (error) {
      this.logger.error(`Failed to execute SET_TEMPERATURE: ${error.message}`);
      return this.createResponse(false, null, error.message);
    }
  }
}
```

### Phase 5.3: Quota WebSocket Implementation (Days 3-4)

#### 5.3.1 Quota Gateway Implementation

**Step 1: Create Quota DTOs** (`src/websockets/quota/dto/quota.dto.ts`)
```typescript
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class QuotaCommandDto {
  @IsString()
  command: string;

  @IsString()
  quotaId: string;

  @IsString()
  roomId: string;

  @IsString()
  familyMemberId: string;

  @IsOptional()
  reason?: string;

  @IsOptional()
  duration?: number;

  @IsOptional()
  overrideType?: string;
}

export class SubscribeDto {
  @IsString()
  quotaId: string;

  @IsString()
  roomId: string;
}

export class UnsubscribeDto {
  @IsString()
  quotaId: string;
}

export class OverrideRequestDto {
  @IsString()
  quotaId: string;

  @IsString()
  roomId: string;

  @IsString()
  reason: string;

  @IsEnum(['ADD_TIME', 'UNLOCK_DAY', 'EMERGENCY_OVERRIDE'])
  overrideType: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';

  @IsOptional()
  duration?: number; // in minutes
}

export class OverrideApprovalDto {
  @IsString()
  requestId: string;

  @IsString()
  decision: 'approve' | 'deny';

  @IsOptional()
  reason?: string;
}

export class HealthCheckDto {
  @IsString()
  quotaId: string;
}
```

**Step 2: Implement Quota Gateway** (`src/websockets/quota/quota.gateway.ts`)
```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  WsException,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WebSocketAuthGuard } from '../common/guards/websocket-auth.guard';
import { ValidationPipe } from '@nestjs/common';
import { ConnectionManagerService, ConnectionContext } from '../services/connection-manager.service';
import { MessageRouterService } from '../services/message-router.service';
import { EventBroadcasterService } from '../services/event-broadcaster.service';
import { WebSocketMetricsService } from '../services/websocket-metrics.service';
import {
  QuotaCommandDto,
  SubscribeDto,
  UnsubscribeDto,
  OverrideRequestDto,
  OverrideApprovalDto,
  HealthCheckDto,
} from './dto/quota.dto';

@WebSocketGateway({
  namespace: 'quota',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})
@UseGuards(WebSocketAuthGuard)
export class QuotaWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuotaWebSocketGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly messageRouter: MessageRouterService,
    private readonly eventBroadcaster: EventBroadcasterService,
    private readonly metricsService: WebSocketMetricsService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('Quota WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      this.metricsService.recordConnectionEstablished('quota');

      // Extract connection parameters from query
      const quotaId = client.handshake.query.quotaId as string;
      const roomId = client.handshake.query.roomId as string;
      const familyMemberId = client.handshake.query.familyMemberId as string;

      if (!quotaId || !roomId || !familyMemberId) {
        client.disconnect();
        return;
      }

      const connectionContext: ConnectionContext = {
        client,
        user: client.data.user,
        householdId: client.data.householdId,
        roomId,
        quotaId,
        familyMemberId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
      };

      await this.connectionManager.registerConnection(client, connectionContext);

      client.emit('connected', {
        clientId: client.id,
        quotaId,
        roomId,
        timestamp: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} for quota: ${quotaId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.connectionManager.unregisterConnection(client);
      this.metricsService.recordConnectionClosed('quota');
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  @SubscribeMessage('command')
  async handleCommand(
    @MessageBody(new ValidationPipe({ transform: true })) payload: QuotaCommandDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Received command: ${payload.command} from client: ${client.id}`);

      const response = await this.messageRouter.routeMessage(
        client,
        payload.command,
        payload,
      );

      const processingTime = Date.now() - startTime;
      this.metricsService.recordMessageProcessed(payload.command, processingTime);

      return response;
    } catch (error) {
      this.logger.error(`Command processing error: ${error.message}`);

      const processingTime = Date.now() - startTime;
      this.metricsService.recordMessageProcessed(payload.command, processingTime);

      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody(new ValidationPipe({ transform: true })) payload: SubscribeDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'SUBSCRIBE',
        quotaId: payload.quotaId,
        roomId: payload.roomId,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @MessageBody(new ValidationPipe({ transform: true })) payload: UnsubscribeDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'UNSUBSCRIBE',
        quotaId: payload.quotaId,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('override_request')
  async handleOverrideRequest(
    @MessageBody(new ValidationPipe({ transform: true })) payload: OverrideRequestDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'OVERRIDE_REQUEST',
        quotaId: payload.quotaId,
        roomId: payload.roomId,
        familyMemberId: client.handshake.query.familyMemberId as string,
        reason: payload.reason,
        overrideType: payload.overrideType,
        duration: payload.duration,
      },
      client,
    );
  }

  @SubscribeMessage('override_approval')
  async handleOverrideApproval(
    @MessageBody(new ValidationPipe({ transform: true })) payload: OverrideApprovalDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'OVERRIDE_APPROVAL',
        quotaId: client.handshake.query.quotaId as string,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
        requestId: payload.requestId,
        decision: payload.decision,
        reason: payload.reason,
      },
      client,
    );
  }

  @SubscribeMessage('health_check')
  async handleHealthCheck(
    @MessageBody(new ValidationPipe({ transform: true })) payload: HealthCheckDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    return this.handleCommand(
      {
        command: 'HEALTH_CHECK',
        quotaId: payload.quotaId,
        roomId: client.handshake.query.roomId as string,
        familyMemberId: client.handshake.query.familyMemberId as string,
      },
      client,
    );
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket): Promise<{ pong: number }> {
    return { pong: Date.now() };
  }
}
```

### Phase 5.4: Message Router and Event Broadcasting (Days 4-5)

#### 5.4.1 Message Router Implementation

**Step 1: Implement Command Factory** (`src/websockets/services/command-factory.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IWebSocketCommand } from '../airconditioner/commands/interfaces/command.interface';

// Import all air conditioner commands
import { SetTemperatureCommand } from '../airconditioner/commands/set-temperature.command';
import { SetModeCommand } from '../airconditioner/commands/set-mode.command';
import { SetFanSpeedCommand } from '../airconditioner/commands/set-fan-speed.command';
import { SetPowerCommand } from '../airconditioner/commands/set-power.command';
import { SetSwingCommand } from '../airconditioner/commands/set-swing.command';
import { GetStatusCommand } from '../airconditioner/commands/get-status.command';

// Import all quota commands
import { SubscribeCommand } from '../quota/commands/subscribe.command';
import { UnsubscribeCommand } from '../quota/commands/unsubscribe.command';
import { OverrideRequestCommand } from '../quota/commands/override-request.command';
import { OverrideApprovalCommand } from '../quota/commands/override-approval.command';
import { HealthCheckCommand } from '../quota/commands/health-check.command';

@Injectable()
export class CommandFactoryService {
  private readonly commands = new Map<string, IWebSocketCommand>();
  private readonly logger = new Logger(CommandFactoryService.name);

  constructor(
    private readonly deviceService: any, // Replace with actual DeviceService
    private readonly quotaService: any, // Replace with actual QuotaService
    private readonly eventBroadcasterService: any, // Replace with actual EventBroadcasterService
  ) {
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // Air Conditioner Commands
    this.commands.set('SET_TEMPERATURE', new SetTemperatureCommand(this.deviceService, this.eventBroadcasterService));
    this.commands.set('SET_MODE', new SetModeCommand(this.deviceService, this.eventBroadcasterService));
    this.commands.set('SET_FAN_SPEED', new SetFanSpeedCommand(this.deviceService, this.eventBroadcasterService));
    this.commands.set('SET_POWER', new SetPowerCommand(this.deviceService, this.eventBroadcasterService));
    this.commands.set('SET_SWING', new SetSwingCommand(this.deviceService, this.eventBroadcasterService));
    this.commands.set('GET_STATUS', new GetStatusCommand(this.deviceService));

    // Quota Commands
    this.commands.set('SUBSCRIBE', new SubscribeCommand(this.quotaService, this.eventBroadcasterService));
    this.commands.set('UNSUBSCRIBE', new UnsubscribeCommand(this.quotaService));
    this.commands.set('OVERRIDE_REQUEST', new OverrideRequestCommand(this.quotaService, this.eventBroadcasterService));
    this.commands.set('OVERRIDE_APPROVAL', new OverrideApprovalCommand(this.quotaService, this.eventBroadcasterService));
    this.commands.set('HEALTH_CHECK', new HealthCheckCommand(this.quotaService));

    this.logger.log(`Initialized ${this.commands.size} WebSocket commands`);
  }

  createCommand(commandType: string): IWebSocketCommand | null {
    const command = this.commands.get(commandType);
    if (!command) {
      this.logger.warn(`Unknown command type: ${commandType}`);
    }
    return command || null;
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}
```

**Step 2: Implement Message Router Service** (`src/websockets/services/message-router.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CommandFactoryService } from './command-factory.service';
import { ConnectionManagerService, ConnectionContext } from './connection-manager.service';

export interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  context: any;
  timestamp: Date;
}

export interface WebSocketResponse {
  type: 'response' | 'error' | 'broadcast';
  messageId: string;
  command: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

  constructor(
    private readonly commandFactory: CommandFactoryService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  async routeMessage(
    client: Socket,
    messageType: string,
    payload: any,
  ): Promise<WebSocketResponse> {
    const messageId = this.generateMessageId();

    try {
      const connectionContext = this.connectionManager.getConnection(client.id);
      if (!connectionContext) {
        throw new Error('Connection not authenticated');
      }

      const command = this.commandFactory.createCommand(messageType);
      if (!command) {
        throw new Error(`Unknown command type: ${messageType}`);
      }

      const executionContext = {
        client,
        user: connectionContext.user,
        householdId: connectionContext.householdId,
        roomId: connectionContext.roomId,
        quotaId: connectionContext.quotaId,
        familyMemberId: connectionContext.familyMemberId,
      };

      const result = await command.execute(executionContext, payload);

      // Handle broadcasting if needed
      if (result.broadcastEvent) {
        // Broadcasting is handled by the command itself
        this.logger.log(`Command ${messageType} generated broadcast event`);
      }

      return {
        type: 'response',
        messageId,
        command: messageType,
        success: result.success,
        data: result.data,
        error: result.error,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.logger.error(`Message routing failed: ${error.message}`);

      return {
        type: 'error',
        messageId,
        command: messageType,
        success: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 5.4.2 Event Broadcasting Implementation

**Step 1: Implement Event Broadcaster Service** (`src/websockets/services/event-broadcaster.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { ConnectionManagerService, ConnectionContext } from './connection-manager.service';
import { RedisService } from '../../redis/redis.service';

export interface BroadcastEvent {
  event: string;
  payload: any;
  targetRoom?: string;
  targetQuota?: string;
  targetHousehold?: string;
  timestamp: Date;
}

@Injectable()
export class EventBroadcasterService {
  private readonly logger = new Logger(EventBroadcasterService.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly redisService: RedisService,
  ) {
    this.initializeRedisSubscriptions();
  }

  async broadcastToRoom(roomId: string, event: string, payload: any): Promise<void> {
    try {
      const connections = this.connectionManager.getConnectionsByRoom(roomId);

      const broadcastPayload: BroadcastEvent = {
        event,
        payload,
        targetRoom: roomId,
        timestamp: new Date(),
        recipientCount: connections.length,
      };

      // Publish to Redis for cross-instance broadcasting
      await this.redisService.publish(`room:${roomId}`, broadcastPayload);

      // Local broadcasting
      for (const connection of connections) {
        connection.client.emit(event, payload);
      }

      this.logger.log(`Broadcasted event ${event} to room ${roomId} (${connections.length} clients)`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to room ${roomId}: ${error.message}`);
      throw error;
    }
  }

  async broadcastToQuota(quotaId: string, event: string, payload: any): Promise<void> {
    try {
      const connections = this.connectionManager.getConnectionsByQuota(quotaId);

      const broadcastPayload: BroadcastEvent = {
        event,
        payload,
        targetQuota: quotaId,
        timestamp: new Date(),
        recipientCount: connections.length,
      };

      await this.redisService.publish(`quota:${quotaId}`, broadcastPayload);

      for (const connection of connections) {
        connection.client.emit(event, payload);
      }

      this.logger.log(`Broadcasted event ${event} to quota ${quotaId} (${connections.length} clients)`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to quota ${quotaId}: ${error.message}`);
      throw error;
    }
  }

  async broadcastToClient(clientId: string, event: string, payload: any): Promise<void> {
    try {
      const connection = this.connectionManager.getConnection(clientId);
      if (connection) {
        connection.client.emit(event, payload);
        this.logger.log(`Broadcasted event ${event} to client ${clientId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to broadcast to client ${clientId}: ${error.message}`);
    }
  }

  async broadcastToHousehold(householdId: string, event: string, payload: any): Promise<void> {
    try {
      const allConnections = this.connectionManager.getAllConnections();
      const householdConnections = allConnections.filter(
        conn => conn.householdId === householdId
      );

      for (const connection of householdConnections) {
        connection.client.emit(event, payload);
      }

      this.logger.log(`Broadcasted event ${event} to household ${householdId} (${householdConnections.length} clients)`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to household ${householdId}: ${error.message}`);
    }
  }

  private initializeRedisSubscriptions(): void {
    // Subscribe to room broadcasts
    this.redisService.subscribe('room:*', (message, channel) => {
      const roomId = channel.replace('room:', '');
      this.handleRedisBroadcast('room', roomId, message);
    });

    // Subscribe to quota broadcasts
    this.redisService.subscribe('quota:*', (message, channel) => {
      const quotaId = channel.replace('quota:', '');
      this.handleRedisBroadcast('quota', quotaId, message);
    });
  }

  private handleRedisBroadcast(type: 'room' | 'quota', id: string, message: BroadcastEvent): void {
    try {
      // Don't broadcast back to the same instance that published the message
      // This is handled by checking if we have local connections for this target

      if (type === 'room') {
        const connections = this.connectionManager.getConnectionsByRoom(id);
        for (const connection of connections) {
          connection.client.emit(message.event, message.payload);
        }
      } else if (type === 'quota') {
        const connections = this.connectionManager.getConnectionsByQuota(id);
        for (const connection of connections) {
          connection.client.emit(message.event, message.payload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle Redis broadcast for ${type}:${id}: ${error.message}`);
    }
  }
}
```

### Phase 5.5: Performance Monitoring and Testing (Days 5-6)

#### 5.5.1 WebSocket Metrics Implementation

**Step 1: Implement Metrics Service** (`src/websockets/services/websocket-metrics.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebSocketMetricsService {
  private readonly logger = new Logger(WebSocketMetricsService.name);
  private readonly metrics = new Map<string, any>();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Connection metrics
    this.metrics.set('websocket_connections_total', { type: 'counter', value: 0 });
    this.metrics.set('websocket_disconnections_total', { type: 'counter', value: 0 });
    this.metrics.set('websocket_active_connections', { type: 'gauge', value: 0 });

    // Message metrics
    this.metrics.set('websocket_messages_total', { type: 'counter', value: 0 });
    this.metrics.set('websocket_message_processing_duration', { type: 'histogram', values: [] });

    // Broadcast metrics
    this.metrics.set('websocket_events_broadcast_total', { type: 'counter', value: 0 });
    this.metrics.set('websocket_broadcast_recipients', { type: 'histogram', values: [] });

    // Error metrics
    this.metrics.set('websocket_errors_total', { type: 'counter', value: 0 });
  }

  recordConnectionEstablished(endpoint: string): void {
    const metric = this.metrics.get('websocket_connections_total');
    metric.value += 1;

    const activeConnections = this.metrics.get('websocket_active_connections');
    activeConnections.value += 1;

    this.logger.debug(`Connection established for ${endpoint}. Total: ${metric.value}, Active: ${activeConnections.value}`);
  }

  recordConnectionClosed(endpoint: string): void {
    const metric = this.metrics.get('websocket_disconnections_total');
    metric.value += 1;

    const activeConnections = this.metrics.get('websocket_active_connections');
    activeConnections.value = Math.max(0, activeConnections.value - 1);

    this.logger.debug(`Connection closed for ${endpoint}. Total: ${metric.value}, Active: ${activeConnections.value}`);
  }

  recordMessageProcessed(commandType: string, processingTime: number): void {
    const messageMetric = this.metrics.get('websocket_messages_total');
    messageMetric.value += 1;

    const durationMetric = this.metrics.get('websocket_message_processing_duration');
    durationMetric.values.push(processingTime);

    // Keep only last 1000 values for memory efficiency
    if (durationMetric.values.length > 1000) {
      durationMetric.values = durationMetric.values.slice(-1000);
    }

    this.logger.debug(`Message processed: ${commandType} in ${processingTime}ms`);
  }

  recordEventBroadcast(eventType: string, recipientCount: number): void {
    const broadcastMetric = this.metrics.get('websocket_events_broadcast_total');
    broadcastMetric.value += 1;

    const recipientMetric = this.metrics.get('websocket_broadcast_recipients');
    recipientMetric.values.push(recipientCount);

    if (recipientMetric.values.length > 1000) {
      recipientMetric.values = recipientMetric.values.slice(-1000);
    }

    this.logger.debug(`Event broadcast: ${eventType} to ${recipientCount} recipients`);
  }

  recordError(errorType: string): void {
    const metric = this.metrics.get('websocket_errors_total');
    metric.value += 1;

    this.logger.debug(`Error recorded: ${errorType}. Total errors: ${metric.value}`);
  }

  getMetrics(): any {
    const result: any = {};

    for (const [key, metric] of this.metrics.entries()) {
      if (metric.type === 'histogram') {
        const values = metric.values;
        result[key] = {
          type: metric.type,
          count: values.length,
          sum: values.reduce((a: number, b: number) => a + b, 0),
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          avg: values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0,
        };
      } else {
        result[key] = {
          type: metric.type,
          value: metric.value,
        };
      }
    }

    return result;
  }

  resetMetrics(): void {
    this.initializeMetrics();
    this.logger.log('Metrics reset');
  }
}
```

#### 5.5.2 Integration Testing

**Step 1: Create WebSocket Test Client** (`test/websocket/websocket-test-client.ts`)
```typescript
import { io, Socket } from 'socket.io-client';

export class WebSocketTestClient {
  private client: Socket;
  private connected = false;

  constructor(private url: string, private namespace: string) {}

  async connect(token: string, queryParams: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.url}/${this.namespace}`;

      this.client = io(fullUrl, {
        query: {
          token,
          ...queryParams,
        },
        transports: ['websocket'],
      });

      this.client.on('connect', () => {
        this.connected = true;
        console.log(`Connected to ${this.namespace}`);
        resolve();
      });

      this.client.on('connect_error', (error) => {
        console.error(`Connection error: ${error.message}`);
        reject(error);
      });

      this.client.on('disconnect', (reason) => {
        this.connected = false;
        console.log(`Disconnected: ${reason}`);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
      this.connected = false;
    }
  }

  async sendCommand(command: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Client not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);

      this.client.emit('command', { command, ...payload }, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  async sendEvent(event: string, payload: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    this.client.emit(event, payload);
  }

  onEvent(event: string, callback: (data: any) => void): void {
    if (this.client) {
      this.client.on(event, callback);
    }
  }

  onceEvent(event: string, callback: (data: any) => void): void {
    if (this.client) {
      this.client.once(event, callback);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
```

**Step 2: Create Integration Tests** (`test/websocket/airconditioner.integration.test.ts`)
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WebSocketModule } from '../../src/websockets/websocket.module';
import { RedisModule } from '../../src/redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { WebSocketTestClient } from './websocket-test-client';

describe('Air Conditioner WebSocket Integration', () => {
  let app: INestApplication;
  let client: WebSocketTestClient;
  const wsUrl = 'http://localhost:3001';
  const testToken = 'test-jwt-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        RedisModule,
        WebSocketModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3001);
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
    await app.close();
  });

  beforeEach(async () => {
    client = new WebSocketTestClient(wsUrl, 'airconditioner');
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  it('should connect to air conditioner gateway', async () => {
    await client.connect(testToken, {
      roomId: 'test-room',
      familyMemberId: 'test-member',
    });

    expect(client.isConnected()).toBe(true);
  });

  it('should handle set temperature command', async () => {
    await client.connect(testToken, {
      roomId: 'test-room',
      familyMemberId: 'test-member',
    });

    const response = await client.sendCommand('SET_TEMPERATURE', {
      temperature: 22,
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it('should broadcast temperature changes to all clients in room', async () => {
    const client1 = new WebSocketTestClient(wsUrl, 'airconditioner');
    const client2 = new WebSocketTestClient(wsUrl, 'airconditioner');

    try {
      await Promise.all([
        client1.connect(testToken, {
          roomId: 'test-room',
          familyMemberId: 'test-member-1',
        }),
        client2.connect(testToken, {
          roomId: 'test-room',
          familyMemberId: 'test-member-2',
        }),
      ]);

      let temperatureChangeEventReceived = false;

      client2.onEvent('temperature-changed', (data) => {
        temperatureChangeEventReceived = true;
        expect(data.roomId).toBe('test-room');
        expect(data.temperature).toBe(22);
      });

      await client1.sendCommand('SET_TEMPERATURE', {
        temperature: 22,
      });

      // Wait for broadcast event
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(temperatureChangeEventReceived).toBe(true);
    } finally {
      await client1.disconnect();
      await client2.disconnect();
    }
  });

  it('should reject invalid temperature values', async () => {
    await client.connect(testToken, {
      roomId: 'test-room',
      familyMemberId: 'test-member',
    });

    const response = await client.sendCommand('SET_TEMPERATURE', {
      temperature: 15, // Below minimum
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});
```

### Phase 5.6: Performance Optimization and Deployment (Days 6-7)

#### 5.6.1 Performance Optimization

**Step 1: Implement Connection Pooling** (`src/websockets/services/connection-pool.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

interface ConnectionPool {
  connections: Map<string, Socket>;
  lastActivity: Date;
  maxSize: number;
}

@Injectable()
export class ConnectionPoolService {
  private readonly pools = new Map<string, ConnectionPool>();
  private readonly maxConnectionsPerRoom = 100;
  private readonly maxConnectionsPerQuota = 50;
  private readonly cleanupInterval = 60000; // 1 minute
  private readonly logger = new Logger(ConnectionPoolService.name);

  constructor() {
    this.startCleanupTask();
  }

  async canAcceptConnection(roomId: string, quotaId?: string): Promise<boolean> {
    const roomPool = this.pools.get(`room:${roomId}`);
    const roomCount = roomPool?.connections.size || 0;

    if (roomCount >= this.maxConnectionsPerRoom) {
      return false;
    }

    if (quotaId) {
      const quotaPool = this.pools.get(`quota:${quotaId}`);
      const quotaCount = quotaPool?.connections.size || 0;

      if (quotaCount >= this.maxConnectionsPerQuota) {
        return false;
      }
    }

    return true;
  }

  async addToPool(poolKey: string, client: Socket): Promise<void> {
    if (!this.pools.has(poolKey)) {
      this.pools.set(poolKey, {
        connections: new Map(),
        lastActivity: new Date(),
        maxSize: this.getMaxPoolSize(poolKey),
      });
    }

    const pool = this.pools.get(poolKey)!;

    if (pool.connections.size >= pool.maxSize) {
      throw new Error(`Pool ${poolKey} is full`);
    }

    pool.connections.set(client.id, client);
    pool.lastActivity = new Date();

    this.logger.debug(`Added client ${client.id} to pool ${poolKey}. Size: ${pool.connections.size}`);
  }

  async removeFromPool(poolKey: string, clientId: string): Promise<void> {
    const pool = this.pools.get(poolKey);
    if (pool) {
      pool.connections.delete(clientId);
      pool.lastActivity = new Date();

      if (pool.connections.size === 0) {
        this.pools.delete(poolKey);
      }

      this.logger.debug(`Removed client ${clientId} from pool ${poolKey}. Size: ${pool.connections.size}`);
    }
  }

  getPoolSize(poolKey: string): number {
    const pool = this.pools.get(poolKey);
    return pool?.connections.size || 0;
  }

  getPoolStats(): any {
    const stats: any = {};

    for (const [key, pool] of this.pools.entries()) {
      stats[key] = {
        size: pool.connections.size,
        maxSize: pool.maxSize,
        lastActivity: pool.lastActivity,
      };
    }

    return stats;
  }

  private getMaxPoolSize(poolKey: string): number {
    if (poolKey.startsWith('room:')) {
      return this.maxConnectionsPerRoom;
    } else if (poolKey.startsWith('quota:')) {
      return this.maxConnectionsPerQuota;
    }
    return 100;
  }

  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanupInactivePools();
    }, this.cleanupInterval);
  }

  private cleanupInactivePools(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [key, pool] of this.pools.entries()) {
      if (now.getTime() - pool.lastActivity.getTime() > inactiveThreshold) {
        if (pool.connections.size === 0) {
          this.pools.delete(key);
          this.logger.debug(`Cleaned up inactive pool: ${key}`);
        }
      }
    }
  }
}
```

#### 5.6.2 Configuration and Deployment

**Step 1: WebSocket Configuration** (`src/config/websocket.config.ts`)
```typescript
export interface WebSocketConfig {
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
  monitoring: {
    metricsEnabled: boolean;
    healthCheckInterval: number;
  };
}

export const webSocketConfig: WebSocketConfig = {
  airConditioner: {
    namespace: 'airconditioner',
    maxConnections: 100,
    heartbeatInterval: 30000, // 30 seconds
    disconnectTimeout: 60000, // 1 minute
  },
  quota: {
    namespace: 'quota',
    maxConnections: 50,
    heartbeatInterval: 30000, // 30 seconds
    disconnectTimeout: 60000, // 1 minute
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  performance: {
    batchSize: 10,
    batchTimeout: 50, // ms
    maxConcurrentProcessing: 100,
  },
  monitoring: {
    metricsEnabled: process.env.WS_METRICS_ENABLED !== 'false',
    healthCheckInterval: 30000, // 30 seconds
  },
};
```

**Step 2: Health Check Endpoint** (`src/websockets/websocket-health.controller.ts`)
```typescript
import { Controller, Get } from '@nestjs/common';
import { WebSocketMetricsService } from './services/websocket-metrics.service';
import { ConnectionPoolService } from './services/connection-pool.service';

@Controller('websocket-health')
export class WebSocketHealthController {
  constructor(
    private readonly metricsService: WebSocketMetricsService,
    private readonly connectionPoolService: ConnectionPoolService,
  ) {}

  @Get()
  getHealth(): any {
    const metrics = this.metricsService.getMetrics();
    const poolStats = this.connectionPoolService.getPoolStats();

    return {
      status: 'healthy',
      timestamp: new Date(),
      metrics,
      poolStats,
      uptime: process.uptime(),
    };
  }

  @Get('metrics')
  getMetrics(): any {
    return this.metricsService.getMetrics();
  }

  @Get('pools')
  getPoolStats(): any {
    return this.connectionPoolService.getPoolStats();
  }
}
```

## Testing Strategy

### Unit Testing
- **Gateway Testing**: Test connection handling and message routing
- **Command Testing**: Test individual command validation and execution
- **Service Testing**: Test connection management, message routing, and event broadcasting
- **Utility Testing**: Test metrics collection and performance monitoring

### Integration Testing
- **End-to-End Flow Testing**: Test complete message flows from client to business logic
- **Multi-Client Testing**: Test concurrent connections and event broadcasting
- **Cross-Service Integration**: Test integration with device and quota services
- **Redis Integration**: Test cross-instance message broadcasting

### Performance Testing
- **Load Testing**: Test with 100+ concurrent connections
- **Latency Testing**: Measure message processing and event broadcast latency
- **Memory Testing**: Monitor memory usage under load
- **Stress Testing**: Test system behavior under extreme load

## Deployment Checklist

### Pre-deployment
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated

### Deployment
- [ ] Environment variables configured
- [ ] Redis cluster configured
- [ ] Load balancer configured for WebSocket connections
- [ ] Monitoring and alerting configured
- [ ] Health check endpoints accessible

### Post-deployment
- [ ] Connection success rate >99%
- [ ] Message latency <1s
- [ ] Event broadcasting working correctly
- [ ] Metrics collection active
- [ ] Error rates within acceptable limits

## Success Criteria

### Functional Success
- [ ] All WebSocket endpoints work identically to Spring Boot
- [ ] All commands process correctly with proper validation
- [ ] Real-time updates work with <1s latency
- [ ] Multi-client support works for rooms and quotas
- [ ] Authentication and authorization work correctly

### Performance Success
- [ ] Connection establishment <2s
- [ ] Message processing latency <500ms
- [ ] Event broadcast latency <1s
- [ ] System handles 100+ concurrent connections
- [ ] Memory usage <512MB for 1000 connections

### Security Success
- [ ] All connections require proper authentication
- [ ] Access control is properly enforced
- [ ] Message validation prevents attacks
- [ ] Rate limiting prevents abuse
- [ ] No security vulnerabilities detected

This implementation plan provides a comprehensive roadmap for building the WebSocket real-time communication system while maintaining complete compatibility with the Spring Boot backend and achieving the performance targets specified in the requirements.