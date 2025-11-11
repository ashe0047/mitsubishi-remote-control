# Implementation Roadmap

## Overview

This document provides a step-by-step implementation roadmap for migrating the Spring Boot backend to NestJS. The approach is incremental, with parallel testing to ensure no functionality is lost during the migration.

## Migration Strategy

### Core Principles
1. **Incremental Migration**: One module at a time
2. **Parallel Testing**: Run both backends simultaneously for validation
3. **API Compatibility**: Maintain exact same contracts
4. **Database Preservation**: Use existing database without modifications
5. **Feature Parity**: Every feature must work identically

### Migration Phases

**Phase 1: Foundation Setup** (Days 1-3)
- NestJS project structure
- Core configuration and dependencies
- Database connection and entities
- Basic authentication framework

**Phase 2: Core Services** (Days 4-7)
- User management and authentication
- JWT service implementation
- Base repository patterns
- Common utilities and validation

**Phase 3: API Migration** (Days 8-12)
- Authentication endpoints migration
- Room management endpoints
- Quota management endpoints
- Business logic implementation

**Phase 4: WebSocket Migration** (Days 13-16)
- AirConditioner WebSocket gateway
- Quota WebSocket gateway
- Real-time communication testing
- Message format validation

**Phase 5: External Integrations** (Days 17-19)
- MQTT client integration
- Redis caching implementation
- Event-driven architecture
- End-to-end testing

**Phase 6: Testing & Optimization** (Days 20-21)
- Comprehensive testing suite
- Performance optimization
- Security validation
- Documentation updates

## Detailed Implementation Steps

### Phase 1: Foundation Setup

#### Step 1.1: Create NestJS Project Structure

```bash
# Create new NestJS project in backend-2 directory
npx @nestjs/cli new backend-2 --package-manager pnpm
cd backend-2

# Install required dependencies
pnpm add @nestjs/typeorm @nestjs/config @nestjs/jwt @nestjs/passport
pnpm add @nestjs/websockets @nestjs/platform-socket.io @nestjs/schedule
pnpm add typeorm pg @nestjs/throttler @nestjs/cache-manager
pnpm add passport passport-jwt bcrypt jsonwebtoken
pnpm add mqtt rxjs class-validator class-transformer
pnpm add @nestjs/swagger swagger-ui-express

# Install development dependencies
pnpm add -D @types/mqtt @types/bcrypt @types/jsonwebtoken @types/passport-jwt
pnpm add -D @nestjs/testing supertest jest @types/jest
pnpm add -D testcontainers @testcontainers/postgresql
```

#### Step 1.2: Configure Core Modules

**Core Configuration** (`src/config/config.module.ts`):
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(8080),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('24h'),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
        MQTT_BROKER_URL: Joi.string().required(),
        MQTT_BROKER_PORT: Joi.number().default(1883),
        MQTT_USERNAME: Joi.string().required(),
        MQTT_PASSWORD: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
      }),
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
```

**Database Configuration** (`src/config/database.config.ts`):
```typescript
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../modules/users/entities/user.entity';
import { Household } from '../modules/users/entities/household.entity';
import { Quota } from '../modules/quotas/entities/quota.entity';
import { UsageSession } from '../modules/quotas/entities/usage-session.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleAsyncOptions => ({
  useFactory: (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [User, Household, Quota, UsageSession],
    synchronize: false,
    migrationsRun: true,
    logging: configService.get('NODE_ENV') === 'development',
    migrations: ['dist/migrations/*.js'],
    ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  }),
  inject: [ConfigService],
});
```

#### Step 1.3: Create Base Module Structure

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { QuotasModule } from './modules/quotas/quotas.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { MqttModule } from './mqtt/mqtt.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    QuotasModule,
    WebSocketModule,
    MqttModule,
  ],
})
export class AppModule {}
```

### Phase 2: Core Services

#### Step 2.1: Create Database Entities

**User Entity** (`src/modules/users/entities/user.entity.ts`):
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Household } from './household.entity';
import { Quota } from '../../quotas/entities/quota.entity';
import { UsageSession } from '../../quotas/entities/usage-session.entity';

export enum UserRole {
  PARENT = 'parent',
  CHILD = 'child',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CHILD })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  emergencyContacts: Record<string, any>;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  employeeId: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Household, household => household.users)
  household: Household;

  @Column()
  householdId: string;

  @OneToMany(() => Quota, quota => quota.user)
  quotas: Quota[];

  @OneToMany(() => UsageSession, session => session.user)
  usageSessions: UsageSession[];
}
```

#### Step 2.2: Implement Base Repository Pattern

**Base Repository Interface** (`src/common/interfaces/base-repository.interface.ts`):
```typescript
import { DeepPartial, FindOptionsWhere } from 'typeorm';

export interface IBaseRepository<T> {
  create(entity: DeepPartial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(filter: FindOptionsWhere<T>): Promise<T | null>;
  findMany(filter?: FindOptionsWhere<T>): Promise<T[]>;
  update(id: string, updates: DeepPartial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
```

**User Repository Implementation** (`src/modules/users/repositories/user.repository.ts`):
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from '../entities/user.entity';
import { IBaseRepository } from '../../../common/interfaces/base-repository.interface';
import { IUserRepository } from '../interfaces/user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(userData: DeepPartial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return await this.repository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['household']
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { email },
      relations: ['household']
    });
  }

  async findByHouseholdId(householdId: string): Promise<User[]> {
    return await this.repository.find({
      where: { householdId },
      relations: ['household']
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.repository.update(userId, { lastLoginAt: new Date() });
  }

  // Base repository methods
  async findOne(filter: FindOptionsWhere<User>): Promise<User | null> {
    return await this.repository.findOne({ where: filter });
  }

  async findMany(filter?: FindOptionsWhere<User>): Promise<User[]> {
    return await this.repository.find({ where: filter });
  }

  async update(id: string, updates: DeepPartial<User>): Promise<User> {
    await this.repository.update(id, updates);
    return await this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }
}
```

#### Step 2.3: Implement JWT Service

**JWT Service** (`src/modules/auth/jwt.service.ts`):
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { JwtPayload, JwtTokens } from './interfaces/jwt.interface';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  generateTokens(user: User): JwtTokens {
    const payload: JwtPayload = {
      userId: user.id,
      householdId: user.householdId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '24h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpirationTime('JWT_EXPIRATION', '24h'),
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getExpirationTime(configKey: string, defaultHours: string): number {
    const timeString = this.configService.get<string>(configKey, defaultHours);
    const hours = parseInt(timeString.replace('h', ''), 10);
    return hours * 60 * 60; // Convert to seconds
  }
}
```

### Phase 3: API Migration

#### Step 3.1: Authentication Controller

**Auth Controller** (`src/modules/auth/auth.controller.ts`):
```typescript
import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { AuthResponse } from './interfaces/auth-response.interface';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user with household creation' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: AuthResponse })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return await this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User authentication with refresh tokens' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: AuthResponse })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return await this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: 200, description: 'Current user information' })
  async getCurrentUser(@Req() req: Request & { user: User }): Promise<Partial<User>> {
    return await this.authService.getCurrentUser(req.user.id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: AuthResponse })
  async refresh(@Body('refreshToken') refreshToken: string): Promise<AuthResponse> {
    return await this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (client-side operation)' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(): Promise<{ message: string }> {
    return { message: 'Logged out successfully' };
  }
}
```

#### Step 3.2: Business Logic Implementation

**Quota Validation Service** (`src/modules/quotas/services/quota-validation.service.ts`):
```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { Quota } from '../entities/quota.entity';
import { AirConCommand } from '../interfaces/aircon-command.interface';
import { QuotaValidationResult } from '../interfaces/quota-validation-result.interface';
import { QuotaValidationStrategyFactory } from './strategies/quota-validation-strategy.factory';
import { QuotaBalanceService } from './quota-balance.service';

@Injectable()
export class QuotaValidationService {
  private readonly logger = new Logger(QuotaValidationService.name);
  private readonly QUOTA_VALIDATION_TIMEOUT = 100; // 100ms

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly strategyFactory: QuotaValidationStrategyFactory,
    private readonly balanceService: QuotaBalanceService,
  ) {}

  async validateCommand(
    command: AirConCommand,
    userId: string,
    roomId: string,
  ): Promise<QuotaValidationResult> {
    const startTime = Date.now();

    try {
      // Check if command requires quota validation
      if (this.shouldBypassQuotaValidation(command)) {
        return { isValid: true, reason: 'Command bypasses quota validation' };
      }

      // Check if quota feature is enabled for user
      const quota = await this.getActiveQuota(userId, roomId);
      if (!quota) {
        return { isValid: true, reason: 'No active quota found' };
      }

      // Get current balance with cache fallback
      const balance = await this.balanceService.getBalance(quota.id, userId, roomId);

      // Get appropriate validation strategy
      const strategy = this.strategyFactory.getStrategy(quota.quotaType);

      // Perform validation
      const result = await strategy.validateUsage(quota, balance.usedAmount, command);

      // Log performance
      const duration = Date.now() - startTime;
      if (duration > this.QUOTA_VALIDATION_TIMEOUT) {
        this.logger.warn(`Quota validation took ${duration}ms (timeout: ${this.QUOTA_VALIDATION_TIMEOUT}ms)`);
      }

      return result;
    } catch (error) {
      this.logger.error('Quota validation error', error);
      // Fail-open strategy
      return {
        isValid: true,
        reason: 'Quota validation service unavailable - fail-open applied'
      };
    }
  }

  private shouldBypassQuotaValidation(command: AirConCommand): boolean {
    // Power OFF commands always bypass quotas
    if (command.action === 'power' && command.value === 'OFF') {
      return true;
    }

    // Emergency overrides bypass quota validation
    if (command.bypassQuota === true) {
      return true;
    }

    // Read-only commands don't consume quota
    const readOnlyActions = ['status', 'get', 'info'];
    if (readOnlyActions.includes(command.action)) {
      return true;
    }

    return false;
  }

  private async getActiveQuota(userId: string, roomId: string): Promise<Quota | null> {
    const cacheKey = `active_quota:${userId}:${roomId}`;
    let quota = await this.cacheManager.get<Quota>(cacheKey);

    if (!quota) {
      // Load from database
      quota = await this.quotaRepository.findActiveQuota(userId, roomId);
      if (quota) {
        // Cache for 5 minutes
        await this.cacheManager.set(cacheKey, quota, { ttl: 300 });
      }
    }

    return quota;
  }
}
```

### Phase 4: WebSocket Migration

#### Step 4.1: AirConditioner WebSocket Gateway

**AirConditioner Gateway** (`src/modules/websocket/airconditioner.gateway.ts`):
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtService } from '../../auth/jwt.service';
import { AirConCommandFactory } from '../factories/aircon-command.factory';
import { QuotaValidationService } from '../../quotas/services/quota-validation.service';
import { AirConditionerInboundMessage, AirConditionerOutboundMessage } from '../interfaces/airconditioner-message.interface';
import { AirConService } from '../services/aircon.service';

@WebSocketGateway({
  path: '/ws/airconditioner',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})
export class AirConditionerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AirConditionerGateway.name);
  private readonly connectedClients = new Map<string, { userId: string; roomId: string; socket: Socket }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly commandFactory: AirConCommandFactory,
    private readonly quotaValidationService: QuotaValidationService,
    private readonly airConService: AirConService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const { roomId, familyMemberId, token } = client.handshake.query as {
        roomId: string;
        familyMemberId: string;
        token: string;
      };

      // Validate required parameters
      if (!roomId || !familyMemberId || !token) {
        throw new BadRequestException('Missing required connection parameters');
      }

      // Validate JWT token
      const payload = this.jwtService.verifyToken(token as string);
      if (payload.userId !== familyMemberId) {
        throw new BadRequestException('Token userId mismatch');
      }

      // Store client connection
      this.connectedClients.set(client.id, {
        userId: payload.userId,
        roomId: roomId as string,
        socket: client,
      });

      // Join room-specific socket room
      await client.join(`room:${roomId}`);

      // Send initial status
      const initialStatus = await this.airConService.getRoomStatus(roomId as string);
      client.emit('status_update', {
        type: 'STATUS_UPDATE',
        payload: initialStatus,
      });

      this.logger.log(`Client connected: ${client.id} for room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      this.connectedClients.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id} from room: ${clientInfo.roomId}`);
    }
  }

  @SubscribeMessage('aircon_command')
  async handleAirConCommand(
    @MessageBody() message: AirConditionerInboundMessage,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) {
        throw new BadRequestException('Client not authenticated');
      }

      // Validate room access
      if (clientInfo.roomId !== message.payload.roomId) {
        throw new BadRequestException('Room access denied');
      }

      // Create command
      const command = this.commandFactory.createCommand(
        message.type,
        message.payload,
        clientInfo.userId,
      );

      // Validate quota
      const validation = await this.quotaValidationService.validateCommand(
        command,
        clientInfo.userId,
        clientInfo.roomId,
      );

      if (!validation.isValid) {
        client.emit('quota_violation', {
          type: 'QUOTA_VIOLATION_ALERT',
          payload: {
            reason: validation.reason,
            quotaId: validation.quotaId,
            roomId: clientInfo.roomId,
            userId: clientInfo.userId,
          },
        });
        return;
      }

      // Execute command
      await this.airConService.executeCommand(command);

      // Broadcast status update to room
      const updatedStatus = await this.airConService.getRoomStatus(clientInfo.roomId);
      this.broadcastToRoom(clientInfo.roomId, {
        type: 'STATUS_UPDATE',
        payload: updatedStatus,
      });

    } catch (error) {
      this.logger.error(`Command execution failed: ${error.message}`);
      client.emit('error', {
        type: 'ERROR',
        payload: {
          message: 'Command execution failed',
          error: error.message,
        },
      });
    }
  }

  private broadcastToRoom(roomId: string, message: AirConditionerOutboundMessage) {
    this.server.to(`room:${roomId}`).emit('message', message);
  }
}
```

### Phase 5: External Integrations

#### Step 5.1: MQTT Client Service

**MQTT Service** (`src/mqtt/mqtt.service.ts`):
```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as mqtt from 'mqtt';
import { AirConState, AirConSettings } from '../modules/rooms/interfaces/aircon.interface';
import { MqttStateUpdateEvent, MqttSettingsUpdateEvent } from './interfaces/mqtt-events.interface';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private readonly baseTopic: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.baseTopic = this.configService.get<string>('MQTT_BASE_TOPIC', 'mitsubishi2mqtt');
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL');
    const port = this.configService.get<number>('MQTT_BROKER_PORT', 1883);
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const options: mqtt.IClientOptions = {
      host: brokerUrl,
      port: port,
      username: username,
      password: password,
      clientId: `nestjs-mitsubishi-controller-${Date.now()}`,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      clean: true,
    };

    this.client = mqtt.connect(options);

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      this.subscribeToTopics();
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      this.logger.error('MQTT connection error', error);
    });

    this.client.on('offline', () => {
      this.logger.warn('MQTT client offline');
    });

    this.client.on('reconnect', () => {
      this.logger.log('MQTT client reconnecting');
    });
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client.end(false, {}, () => {
          this.logger.log('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }

  private subscribeToTopics(): void {
    // Subscribe to all room state and settings topics
    const stateTopic = `${this.baseTopic}/+/state`;
    const settingsTopic = `${this.baseTopic}/+/settings`;

    this.client.subscribe(stateTopic, (error) => {
      if (error) {
        this.logger.error(`Failed to subscribe to ${stateTopic}`, error);
      } else {
        this.logger.log(`Subscribed to ${stateTopic}`);
      }
    });

    this.client.subscribe(settingsTopic, (error) => {
      if (error) {
        this.logger.error(`Failed to subscribe to ${settingsTopic}`, error);
      } else {
        this.logger.log(`Subscribed to ${settingsTopic}`);
      }
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      const payload = JSON.parse(message.toString());
      const topicParts = topic.split('/');
      const roomId = topicParts[1]; // Extract room ID from topic

      if (topic.endsWith('/state')) {
        const state = payload as AirConState;
        this.eventEmitter.emit('mqtt.state.update', new MqttStateUpdateEvent(roomId, state, new Date()));
      } else if (topic.endsWith('/settings')) {
        const settings = payload as AirConSettings;
        this.eventEmitter.emit('mqtt.settings.update', new MqttSettingsUpdateEvent(roomId, settings, new Date()));
      }
    } catch (error) {
      this.logger.error(`Failed to parse MQTT message from topic ${topic}`, error);
    }
  }

  publishCommand(roomId: string, command: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const topic = `${this.baseTopic}/${roomId}/${command}/set`;
      const payload = JSON.stringify(value);

      this.client.publish(topic, payload, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}`, error);
          reject(error);
        } else {
          this.logger.log(`Published command to ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }
}
```

## Testing Strategy

### Unit Testing Example

**Quota Validation Service Test** (`src/modules/quotas/services/quota-validation.service.spec.ts`):
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { QuotaValidationService } from './quota-validation.service';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { QuotaValidationStrategyFactory } from './strategies/quota-validation-strategy.factory';
import { QuotaBalanceService } from './quota-balance.service';
import { Quota } from '../entities/quota.entity';
import { QuotaType } from '../enums/quota-type.enum';
import { AirConCommand } from '../interfaces/aircon-command.interface';

describe('QuotaValidationService', () => {
  let service: QuotaValidationService;
  let cacheManager: jest.Mocked<Cache>;
  let strategyFactory: jest.Mocked<QuotaValidationStrategyFactory>;
  let balanceService: jest.Mocked<QuotaBalanceService>;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    const mockStrategyFactory = {
      getStrategy: jest.fn(),
    } as any;

    const mockBalanceService = {
      getBalance: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: QuotaValidationStrategyFactory,
          useValue: mockStrategyFactory,
        },
        {
          provide: QuotaBalanceService,
          useValue: mockBalanceService,
        },
      ],
    }).compile();

    service = module.get<QuotaValidationService>(QuotaValidationService);
    cacheManager = module.get(CACHE_MANAGER);
    strategyFactory = module.get(QuotaValidationStrategyFactory);
    balanceService = module.get(QuotaBalanceService);
  });

  describe('validateCommand', () => {
    it('should bypass validation for power OFF commands', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'OFF',
        timestamp: new Date(),
      };

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Command bypasses quota validation');
    });

    it('should validate quota for power ON commands', async () => {
      const quota: Quota = {
        id: 'quota-1',
        quotaType: QuotaType.TIME_BASED,
        allowedAmount: 2, // 2 hours
        userId: 'user-1',
        roomId: 'room-1',
      } as Quota;

      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      // Mock dependencies
      cacheManager.get.mockResolvedValue(null);
      // Mock repository to return quota
      // Mock balance service
      // Mock strategy factory

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(result.isValid).toBeDefined();
      // Add more specific expectations based on your validation logic
    });
  });
});
```

### Integration Testing Example

**Auth Controller Integration Test** (`src/modules/auth/auth.controller.spec.ts`):
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';

describe('Auth Controller (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    await app.init();
  });

  afterEach(async () => {
    await userRepository.delete({});
    await app.close();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user successfully', () => {
      const registerDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        familyName: 'Test Family',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.user.email).toBe(registerDto.email);
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('should return error for duplicate email', async () => {
      // Create existing user
      await userRepository.save({
        email: 'existing@example.com',
        name: 'Existing User',
        passwordHash: 'hashedPassword',
      });

      const registerDto = {
        email: 'existing@example.com',
        name: 'New User',
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });
});
```

## Validation Checklist

Each phase must pass the following validation criteria before proceeding:

### Phase 1 Validation
- [ ] NestJS application starts successfully
- [ ] Database connection established
- [ ] All required dependencies installed
- [ ] Basic configuration loading works

### Phase 2 Validation
- [ ] User entities created and relationships work
- [ ] JWT token generation and verification works
- [ ] Password hashing and comparison works
- [ ] Base repository pattern functional

### Phase 3 Validation
- [ ] All authentication endpoints work identically to Spring Boot
- [ ] Room management endpoints return same data structures
- [ ] Quota management endpoints maintain same business logic
- [ ] All unit tests pass with >80% coverage

### Phase 4 Validation
- [ ] WebSocket connections establish with same URL patterns
- [ ] All message types handled correctly
- [ ] Real-time updates work as expected
- [ ] Frontend can connect without modifications

### Phase 5 Validation
- [ ] MQTT messages published and received correctly
- [ ] Redis caching works with proper TTL
- [ ] Event-driven architecture functions
- [ ] End-to-end scenarios pass

### Phase 6 Validation
- [ ] Performance benchmarks meet requirements (<100ms quota validation)
- [ ] Security audit passes
- [ ] Load testing meets concurrent user requirements
- [ ] Documentation complete and accurate

This roadmap ensures systematic migration while maintaining functionality and quality throughout the process.