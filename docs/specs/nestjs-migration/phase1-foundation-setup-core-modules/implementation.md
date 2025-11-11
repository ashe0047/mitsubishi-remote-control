# Spring Boot to NestJS Migration - Implementation Plan

## Phase 1: Foundation Setup and Core Modules

### Phase Overview
**Duration**: 3-5 days
**Priority**: Critical
**Scope**: Establish NestJS application foundation with core infrastructure modules
**Success Criteria**:
- NestJS application boots successfully
- Core modules configured and tested
- Health checks operational
- Configuration management working
- Development environment established

### Implementation Strategy

#### Clean Code Implementation Checklist

**DRY (Don't Repeat Yourself)**:
- ✅ Create reusable base classes for common functionality
- ✅ Extract configuration management to centralized service
- ✅ Implement shared utilities to eliminate code duplication
- ✅ Use dependency injection for shared services

**SOLID Principles**:
- ✅ **SRP**: Each module handles single responsibility
- ✅ **OCP**: Design modules to be extensible without modification
- ✅ **LSP**: Ensure proper inheritance contracts
- ✅ **ISP**: Create focused interfaces for different concerns
- ✅ **DIP**: Depend on abstractions, not concretions

**YAGNI (You Ain't Gonna Need It)**:
- ✅ Implement only essential foundation components
- ✅ Avoid over-engineering infrastructure
- ✅ Focus on minimal viable implementation
- ✅ Add complexity only when required

### Phase 1 Implementation Tasks

#### Task 1.1: Project Setup and Configuration

**Objective**: Initialize NestJS project with proper configuration

**Implementation Steps**:

1. **Create NestJS Application Structure**
```bash
# Create new NestJS application in backend-2 directory
npx @nestjs/cli new backend-2 --package-manager pnpm
cd backend-2

# Install required dependencies
pnpm add @nestjs/typeorm typeorm pg ioredis
pnpm add @nestjs/config @nestjs/common @nestjs/core
pnpm add @nestjs/platform-express @nestjs/websockets @nestjs/platform-socket.io
pnpm add mqtt jsonwebtoken bcrypt class-validator class-transformer
pnpm add reflect-metadata rxjs

# Install WebSocket dependencies
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
pnpm add redis @socket.io/redis-adapter

# Install development dependencies
> **Package Documentation**: Testing packages for comprehensive NestJS testing
>
> **@nestjs/testing**: NestJS testing utilities
> - Test module creation with @Test.createTestingModule
> - Controller and provider testing helpers
> - Mock implementations and dependency injection
>
> **jest**: JavaScript testing framework
> - Zero-configuration testing setup
> - Mock functions and assertion matchers
> - Code coverage and test reporting
>
> **supertest**: HTTP assertion testing
> - Superagent wrapper for endpoint testing
> - HTTP status code and header assertions
> - Request/response body validation

pnpm add -D @nestjs/testing @types/node @types/jest
pnpm add -D jest @types/supertest supertest eslint
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Install additional utilities
pnpm add joi bcrypt
```

2. **Configure TypeScript and ESLint**
```typescript
// tsconfig.json - Strict TypeScript configuration
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true
  }
}
```

3. **Set up Environment Configuration**
```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 8080,
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
});
```

**Validation**:
- [ ] Application boots without errors
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes without warnings
- [ ] Environment variables are loaded correctly

#### Task 1.2: Core Infrastructure Modules

**Objective**: Implement shared infrastructure modules

**Implementation Steps**:

1. **Database Module with TypeORM**
```typescript
// src/shared/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// TypeORM configuration using @nestjs/typeorm with async configuration
// Documentation: https://context7.com/nestjs/typeorm/llms.txt
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: false, // Use migrations in production
        logging: configService.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        migrationsRun: true,
        // Connection retry options for resilience
        retryAttempts: 10,
        retryDelay: 3000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

// src/shared/database/database.health.ts
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(@InjectConnection() private connection: Connection) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.connection.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

2. **Redis Module with Caching**
```typescript
// src/shared/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ioredis client configuration for Redis integration
// Documentation: https://context7.com/redis/ioredis/llms.txt
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          // Connection retry strategy for resilience
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}

// src/shared/redis/redis.health.ts
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

3. **Configuration Validation Module**
```typescript
// src/common/config/config.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { ConfigValidationService } from './config-validation.service';

// NestJS ConfigModule with environment validation
// Documentation: https://docs.nestjs.com/techniques/configuration
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: ConfigValidationService.validate,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),
  ],
  providers: [ConfigValidationService],
  exports: [ConfigValidationService],
})
export class AppConfigModule {}

// src/common/config/config-validation.service.ts
import { Injectable } from '@nestjs/common';
import { plainToClass, Transform } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsUrl, validateSync } from 'class-validator';

// Environment variable validation using class-validator and class-transformer
// Documentation: https://docs.nestjs.com/techniques/configuration
class EnvironmentVariables {
  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  DATABASE_PORT: number;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsUrl()
  MQTT_BROKER: string;

  @IsString()
  JWT_SECRET: string;
}

@Injectable()
export class ConfigValidationService {
  static validate(config: Record<string, unknown>) {
    const validatedConfig = plainToClass(EnvironmentVariables, config, {
      enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      throw new Error(errors.toString());
    }
    return validatedConfig;
  }
}
```

**Validation**:
- [ ] Database connection established successfully
- [ ] Redis connection established successfully
- [ ] Configuration validation works
- [ ] All modules can be imported without errors

#### Task 1.3: Health Check System

**Objective**: Implement comprehensive health monitoring

**Implementation Steps**:

1. **Health Check Controller**
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../shared/database/database.health';
import { RedisHealthIndicator } from '../shared/redis/redis.health';
import { MqttHealthIndicator } from '../shared/mqtt/mqtt.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dbHealth: DatabaseHealthIndicator,
    private redisHealth: RedisHealthIndicator,
    private mqttHealth: MqttHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.dbHealth.isHealthy(),
      () => this.redisHealth.isHealthy(),
      () => this.mqttHealth.isHealthy(),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.dbHealth.isHealthy(),
      () => this.redisHealth.isHealthy(),
    ]);
  }

  @Get('live')
  @HealthCheck()
  async live(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.mqttHealth.isHealthy(),
    ]);
  }
}
```

2. **Health Check Module**
```typescript
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from '../shared/database/database.health';
import { RedisHealthIndicator } from '../shared/redis/redis.health';
import { MqttHealthIndicator } from '../shared/mqtt/mqtt.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    MqttHealthIndicator,
  ],
})
export class HealthModule {}
```

**Validation**:
- [ ] Health endpoints return correct status codes
- [ ] Health checks accurately reflect service status
- [ ] Liveness and readiness probes work correctly

#### Task 1.4: Logging and Error Handling

**Objective**: Implement structured logging and error handling

**Implementation Steps**:

1. **Global Exception Filter**
```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message = typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as any).message || exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }
}
```

2. **Logging Service**
```typescript
// src/common/logging/logging.service.ts
import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggingService implements LoggerService {
  private logger = new Logger(LoggingService.name);

  constructor(private configService: ConfigService) {}

  log(message: any, context?: string) {
    const logLevel = this.configService.get('LOG_LEVEL') || 'log';
    if (this.shouldLog(logLevel, 'log')) {
      this.logger.log(message, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, context);
  }

  debug(message: any, context?: string) {
    const logLevel = this.configService.get('LOG_LEVEL') || 'log';
    if (this.shouldLog(logLevel, 'debug')) {
      this.logger.debug(message, context);
    }
  }

  verbose(message: any, context?: string) {
    const logLevel = this.configService.get('LOG_LEVEL') || 'log';
    if (this.shouldLog(logLevel, 'verbose')) {
      this.logger.verbose(message, context);
    }
  }

  private shouldLog(currentLevel: string, targetLevel: string): boolean {
    const levels = ['verbose', 'debug', 'log', 'warn', 'error'];
    return levels.indexOf(targetLevel) >= levels.indexOf(currentLevel);
  }
}
```

**Validation**:
- [ ] Error responses are properly formatted
- [ ] Logs are structured and informative
- [ ] Error logging includes stack traces
- [ ] Sensitive information is not logged

#### Task 1.5: MQTT Foundation

**Objective**: Implement MQTT client with connection management

**Implementation Steps**:

1. **MQTT Module**
> **Package Documentation**: Based on [mqtt.js](https://github.com/mqttjs/MQTT.js) - The standard MQTT client for Node.js and browsers
>
> **Key Features**:
> - Automatic reconnect with exponential backoff
> - Support for MQTT 5.0 and 3.1.1
> - WebSocket and TCP transport support
> - QoS levels and retained messages
> - Clean session handling

```typescript
// src/shared/mqtt/mqtt.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';

@Global()
@Module({
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}

// src/shared/mqtt/mqtt.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private logger = new Logger(MqttService.name);
  private messageSubject = new Subject<mqtt.IPacketMessage>();
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const broker = this.configService.get<string>('mqtt.broker');
    const username = this.configService.get<string>('mqtt.username');
    const password = this.configService.get<string>('mqtt.password');
    const clientId = this.configService.get<string>('mqtt.clientId', `nest_${Date.now()}`);

    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId,
        username,
        password,
        clean: true,
        connectTimeout: 30000,
        reconnectPeriod: 5000,
        keepalive: 60,
        reschedulePings: false,
        protocolVersion: 4, // MQTT 3.1.1 for compatibility
        // Enhanced retry strategy from mqtt.js docs
        servers: [
          { host: broker.replace(/^mqtt:\/\//, '').replace(/:\d+$/, ''), port: 1883 }
        ],
      };

      this.client = mqtt.connect(broker, options);

      // Connection success
      this.client.on('connect', () => {
        this.logger.log(`Connected to MQTT broker: ${broker}`);
        this.connectionAttempts = 0;
        resolve();
      });

      // Connection error with enhanced logging
      this.client.on('error', (error) => {
        this.logger.error(`MQTT connection error: ${error.message}`, error.stack);
        reject(error);
      });

      // Message handling
      this.client.on('message', (topic, payload, packet) => {
        this.logger.debug(`Received message on topic: ${topic}`);
        this.messageSubject.next({
          topic,
          payload,
          packet: packet || {
            cmd: 'publish',
            topic,
            payload,
            qos: 0,
            retain: false,
            dup: false
          } as mqtt.IPacket
        });
      });

      // Connection events for monitoring
      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline - attempting reconnection');
      });

      this.client.on('reconnect', () => {
        this.connectionAttempts++;
        if (this.connectionAttempts <= this.maxReconnectAttempts) {
          this.logger.log(`MQTT client reconnecting (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`);
        } else {
          this.logger.error('Max reconnection attempts reached');
          this.client.end();
        }
      });

      this.client.on('close', () => {
        this.logger.log('MQTT connection closed');
      });

      // Handle protocol errors
      this.client.on('packetsend', (packet) => {
        this.logger.debug(`Packet sent: ${packet.cmd}`);
      });

      this.client.on('packetreceive', (packet) => {
        this.logger.debug(`Packet received: ${packet.cmd}`);
      });
    });
  }

  private async disconnect(): Promise<void> {
    if (this.client && this.client.connected) {
      return new Promise((resolve) => {
        this.client.end(true, {}, () => {
          this.logger.log('Gracefully disconnected from MQTT broker');
          resolve();
        });

        // Force close after timeout
        setTimeout(() => {
          if (this.client) {
            this.client.end();
            resolve();
          }
        }, 5000);
      });
    }
  }

  /**
   * Publish message with QoS support
   * Uses mqtt.js recommended pattern for reliable publishing
   */
  publish(topic: string, message: string | Buffer, options?: mqtt.IClientPublishOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const publishOptions: mqtt.IClientPublishOptions = {
        qos: 1, // Default to QoS 1 for reliable delivery
        retain: false,
        ...options,
      };

      this.client.publish(topic, message, publishOptions, (error, packet) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}: ${error.message}`);
          reject(error);
        } else {
          this.logger.debug(`Message published to ${topic} (QoS: ${publishOptions.qos})`);
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to topic with QoS support
   * Implements mqtt.js subscription best practices
   */
  subscribe(topic: string, options?: mqtt.IClientSubscribeOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscribeOptions: mqtt.IClientSubscribeOptions = {
        qos: 1, // Default to QoS 1
        ...options,
      };

      this.client.subscribe(topic, subscribeOptions, (error, granted) => {
        if (error) {
          this.logger.error(`Failed to subscribe to ${topic}: ${error.message}`);
          reject(error);
        } else {
          this.logger.log(`Subscribed to topic: ${topic} with QoS: ${granted?.[0]?.qos || subscribeOptions.qos}`);
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from topic
   */
  unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to unsubscribe from ${topic}: ${error.message}`);
          reject(error);
        } else {
          this.logger.log(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get message stream for reactive programming
   */
  getMessageStream(): Observable<mqtt.IPacketMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * Get client ID for debugging
   */
  getClientId(): string | undefined {
    return this.client?.options?.clientId;
  }
}
```

2. **MQTT Health Indicator**
```typescript
// src/shared/mqtt/mqtt.health.ts
import { Injectable, Logger } from '@nestjs/common';
import { MqttService } from './mqtt.service';

@Injectable()
export class MqttHealthIndicator {
  private logger = new Logger(MqttHealthIndicator.name);

  constructor(private mqttService: MqttService) {}

  async isHealthy(): Promise<boolean> {
    try {
      // Enhanced health check using mqtt.js connection status
      const isConnected = this.mqttService.isConnected();
      const clientId = this.mqttService.getClientId();

      this.logger.debug(`MQTT health check - Connected: ${isConnected}, ClientId: ${clientId}`);

      return isConnected;
    } catch (error) {
      this.logger.error(`MQTT health check failed: ${error.message}`);
      return false;
    }
  }
}
```

**Validation**:
- [ ] MQTT connection establishes successfully
- [ ] Message publishing and subscription works
- [ ] Connection resilience (reconnect) functions properly
- [ ] Health checks accurately reflect MQTT status

#### Task 1.6: Application Bootstrap

**Objective**: Configure main application with all modules

**Implementation Steps**:

1. **Root Application Module**
```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppConfigModule } from './common/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { MqttModule } from './shared/mqtt/mqtt.module';
import { HealthModule } from './health/health.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    MqttModule,
    HealthModule,
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

2. **Main Application Bootstrap**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // CORS configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || true,
    credentials: true,
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  // Start listening
  const port = configService.get('port') || 8080;
  await app.listen(port);

  console.log(`🚀 NestJS application started on port ${port}`);
  console.log(`📊 Health check available at http://localhost:${port}/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

**Validation**:
- [ ] Application boots without errors
- [ ] All modules are loaded correctly
- [ ] Health endpoints are accessible
- [ ] Global configuration is applied

### Testing Strategy for Phase 1

#### Unit Tests

1. **Configuration Service Tests**
```typescript
// test/unit/common/config/config-validation.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigValidationService } from '@/common/config/config-validation.service';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ConfigValidationService],
    }).compile();

    service = module.get<ConfigValidationService>(ConfigValidationService);
  });

  describe('validate', () => {
    it('should validate correct configuration', () => {
      const config = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USER: 'user',
        DATABASE_PASSWORD: 'password',
        DATABASE_NAME: 'test',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        MQTT_BROKER: 'mqtt://localhost:1883',
        JWT_SECRET: 'secret',
      };

      expect(() => ConfigValidationService.validate(config)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const config = {
        DATABASE_HOST: 'localhost',
        // Missing other required fields
      };

      expect(() => ConfigValidationService.validate(config)).toThrow();
    });
  });
});
```

2. **Health Indicator Tests**
```typescript
// test/unit/shared/database/database.health.spec.ts
import { Test } from '@nestjs/testing';
import { DatabaseHealthIndicator } from '@/shared/database/database.health';

describe('DatabaseHealthIndicator', () => {
  let healthIndicator: DatabaseHealthIndicator;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: 'DATABASE_CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    healthIndicator = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
  });

  describe('isHealthy', () => {
    it('should return true when database is healthy', async () => {
      mockConnection.query.mockResolvedValue([{ '1': 1 }]);

      const result = await healthIndicator.isHealthy();
      expect(result).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when database is unhealthy', async () => {
      mockConnection.query.mockRejectedValue(new Error('Connection failed'));

      const result = await healthIndicator.isHealthy();
      expect(result).toBe(false);
    });
  });
});
```

#### Integration Tests

1. **Health Check Integration Tests**
```typescript
// test/integration/health/health.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '@/health/health.controller';
import { HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '@/shared/database/database.health';
import { RedisHealthIndicator } from '@/shared/redis/redis.health';
import { MqttHealthIndicator } from '@/shared/mqtt/mqtt.health';

describe('HealthController (Integration)', () => {
  let controller: HealthController;
  let healthService: HealthCheckService;

  beforeEach(async () => {
    const mockHealthService = {
      check: jest.fn().mockResolvedValue({
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          mqtt: { status: 'up' },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthService,
        },
        {
          provide: DatabaseHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: RedisHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: MqttHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthCheckService>(HealthCheckService);
  });

  describe('check', () => {
    it('should return health status', async () => {
      const result = await controller.check();
      expect(result.status).toBe('ok');
      expect(healthService.check).toHaveBeenCalled();
    });
  });
});
```

### Performance Requirements for Phase 1

**Target Performance Metrics**:
- Application startup time: <30 seconds
- Health check response time: <100ms
- Configuration loading: <5 seconds
- Database connection establishment: <5 seconds
- Redis connection establishment: <3 seconds
- MQTT connection establishment: <10 seconds

**Performance Validation**:
```typescript
// test/performance/phase1.performance.spec.ts
describe('Phase 1 Performance Tests', () => {
  it('should respond to health check within 100ms', async () => {
    const start = Date.now();
    await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should establish database connection within 5 seconds', async () => {
    const start = Date.now();
    // Test database connection establishment
    const connection = await createConnection(testConfig);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
    await connection.close();
  });
});
```

### Quality Gates and Validation Criteria

#### Code Quality Requirements
- **Test Coverage**: >90% for all Phase 1 modules
- **TypeScript Strict Mode**: No compilation errors
- **ESLint**: No warnings or errors
- **Code Documentation**: All public APIs documented

#### Functional Validation
- [ ] Application boots successfully with all modules
- [ ] Health endpoints return correct status information
- [ ] Database connections work properly
- [ ] Redis integration functions correctly
- [ ] MQTT client connects and handles messages
- [ ] Configuration validation prevents invalid startup
- [ ] Error handling provides appropriate responses
- [ ] Logging captures relevant information

#### Performance Validation
- [ ] Startup time meets requirements (<30s)
- [ ] Health check response time <100ms
- [ ] Memory usage stays under 256MB
- [ ] No memory leaks detected

#### Security Validation
- [ ] Sensitive information not logged
- [ ] Configuration secrets properly protected
- [ ] Input validation working correctly
- [ ] Error responses don't expose sensitive data

### Risk Mitigation Strategies

#### Technical Risks
1. **Database Connection Issues**
   - **Mitigation**: Comprehensive connection retry logic and health checks
   - **Fallback**: Graceful degradation if database unavailable

2. **MQTT Connection Resilience**
   - **Mitigation**: Automatic reconnection with exponential backoff
   - **Fallback**: Cached device state for offline scenarios

3. **Configuration Management**
   - **Mitigation**: Comprehensive validation and clear error messages
   - **Fallback**: Default configurations for development

#### Implementation Risks
1. **Module Dependencies**
   - **Mitigation**: Clear dependency management and circular dependency detection
   - **Validation**: Integration tests for module interactions

2. **Performance Degradation**
   - **Mitigation**: Performance monitoring and benchmarking
   - **Validation**: Load testing before proceeding to next phase

### Success Metrics for Phase 1

**Technical Success Metrics**:
- ✅ All core modules implemented and tested
- ✅ Health monitoring system operational
- ✅ Configuration management working
- ✅ Database, Redis, and MQTT connections stable
- ✅ Error handling and logging functional
- ✅ Performance targets met

**Development Success Metrics**:
- ✅ Test coverage >90%
- ✅ Code quality standards met
- ✅ Documentation complete
- ✅ Development environment established
- ✅ CI/CD pipeline configured (if applicable)

**Operational Success Metrics**:
- ✅ Zero downtime during development
- ✅ All validation criteria met
- ✅ Performance benchmarks achieved
- ✅ Security requirements satisfied

### Phase 1 Completion Checklist

#### Implementation Completion
- [ ] All modules implemented according to design
- [ ] Configuration management working
- [ ] Health checks operational
- [ ] Error handling implemented
- [ ] Logging system functional
- [ ] MQTT integration working

#### Testing Completion
- [ ] Unit tests written and passing
- [ ] Integration tests covering module interactions
- [ ] Performance tests meeting targets
- [ ] Security validation completed
- [ ] Code coverage >90%

#### Documentation Completion
- [ ] API documentation for health endpoints
- [ ] Configuration guide completed
- [ ] Development setup guide
- [ ] Troubleshooting guide

#### Validation Completion
- [ ] All functional requirements validated
- [ ] Performance requirements met
- [ ] Security requirements satisfied
- [ ] Quality standards achieved
- [ ] Stakeholder approval obtained

This Phase 1 implementation provides a solid foundation for the Spring Boot to NestJS migration, establishing all core infrastructure components needed for subsequent phases while maintaining clean code principles and comprehensive testing.