# Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the Spring Boot to NestJS migration. The strategy ensures 100% functional equivalence through contract testing, performance validation, and comprehensive test coverage.

## Testing Pyramid

### Unit Tests (70%)
- **Purpose**: Test individual functions and classes in isolation
- **Tools**: Jest, NestJS Testing Utilities
- **Coverage Target**: >90% line coverage
- **Execution Time**: <5 seconds per test suite

### Integration Tests (20%)
- **Purpose**: Test component interactions and external integrations
- **Tools**: Supertest, Testcontainers, NestJS Test Module
- **Coverage Target**: All critical workflows
- **Execution Time**: <30 seconds per test suite

### End-to-End Tests (10%)
- **Purpose**: Test complete user workflows
- **Tools**: Cypress, WebSocket testing libraries
- **Coverage Target**: Critical user journeys
- **Execution Time**: <2 minutes per test suite

## Unit Testing Strategy

### Service Layer Testing

**Quota Validation Service Tests:**
```typescript
// src/modules/quotas/services/quota-validation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuotaValidationService } from './quota-validation.service';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { QuotaValidationStrategyFactory } from './strategies/quota-validation-strategy.factory';
import { QuotaBalanceService } from './quota-balance.service';
import { Quota } from '../entities/quota.entity';
import { QuotaType } from '../enums/quota-type.enum';
import { AirConCommand } from '../interfaces/aircon-command.interface';
import { QuotaValidationResult } from '../interfaces/quota-validation-result.interface';

describe('QuotaValidationService', () => {
  let service: QuotaValidationService;
  let cacheManager: jest.Mocked<Cache>;
  let strategyFactory: jest.Mocked<QuotaValidationStrategyFactory>;
  let balanceService: jest.Mocked<QuotaBalanceService>;
  let quotaRepository: jest.Mocked<any>;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    const mockStrategyFactory = {
      getStrategy: jest.fn(),
    } as any;

    const mockBalanceService = {
      getBalance: jest.fn(),
      updateBalance: jest.fn(),
    } as any;

    const mockQuotaRepository = {
      findActiveQuota: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'QUOTA_VALIDATION_TIMEOUT') return 100;
              return undefined;
            }),
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
        {
          provide: 'QuotaRepository',
          useValue: mockQuotaRepository,
        },
      ],
    }).compile();

    service = module.get<QuotaValidationService>(QuotaValidationService);
    cacheManager = module.get(CACHE_MANAGER);
    strategyFactory = module.get(QuotaValidationStrategyFactory);
    balanceService = module.get(QuotaBalanceService);
    quotaRepository = module.get('QuotaRepository');
  });

  describe('validateCommand', () => {
    const mockQuota: Quota = {
      id: 'quota-1',
      quotaType: QuotaType.TIME_BASED,
      allowedAmount: 2,
      userId: 'user-1',
      roomId: 'room-1',
    } as Quota;

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
      expect(strategyFactory.getStrategy).not.toHaveBeenCalled();
    });

    it('should validate quota for power ON commands', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      // Mock dependencies
      quotaRepository.findActiveQuota.mockResolvedValue(mockQuota);
      cacheManager.get.mockResolvedValue(null);
      balanceService.getBalance.mockResolvedValue({
        usedAmount: 1800, // 30 minutes used
        quotaId: 'quota-1',
      });

      const mockStrategy = {
        validateUsage: jest.fn().mockResolvedValue({
          isValid: true,
          remainingAmount: 5400, // 1.5 hours remaining
        }),
      };
      strategyFactory.getStrategy.mockReturnValue(mockStrategy);

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(result.isValid).toBe(true);
      expect(strategyFactory.getStrategy).toHaveBeenCalledWith(QuotaType.TIME_BASED);
      expect(mockStrategy.validateUsage).toHaveBeenCalledWith(
        mockQuota,
        1800,
        command
      );
    });

    it('should fail validation when quota exceeded', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      quotaRepository.findActiveQuota.mockResolvedValue(mockQuota);
      cacheManager.get.mockResolvedValue(null);
      balanceService.getBalance.mockResolvedValue({
        usedAmount: 7200, // 2 hours used (full quota)
        quotaId: 'quota-1',
      });

      const mockStrategy = {
        validateUsage: jest.fn().mockResolvedValue({
          isValid: false,
          reason: 'Time quota exceeded',
          exceededAmount: 300, // 5 minutes over
        }),
      };
      strategyFactory.getStrategy.mockReturnValue(mockStrategy);

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Time quota exceeded');
    });

    it('should apply fail-open strategy on service errors', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      quotaRepository.findActiveQuota.mockRejectedValue(new Error('Database error'));

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(result.isValid).toBe(true);
      expect(result.reason).toContain('fail-open applied');
    });

    it('should respect performance timeout', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      quotaRepository.findActiveQuota.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );

      const startTime = Date.now();
      const result = await service.validateCommand(command, 'user-1', 'room-1');
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeGreaterThan(100); // Should exceed timeout
    });
  });

  describe('Cache Integration', () => {
    it('should use cached quota when available', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'temp',
        value: 22,
        timestamp: new Date(),
      };

      const cachedQuota = mockQuota;
      cacheManager.get.mockResolvedValue(cachedQuota);

      const result = await service.validateCommand(command, 'user-1', 'room-1');

      expect(cacheManager.get).toHaveBeenCalledWith('active_quota:user-1:room-1');
      expect(quotaRepository.findActiveQuota).not.toHaveBeenCalled();
    });

    it('should cache quota after database lookup', async () => {
      const command: AirConCommand = {
        roomId: 'room-1',
        userId: 'user-1',
        action: 'temp',
        value: 22,
        timestamp: new Date(),
      };

      cacheManager.get.mockResolvedValue(null);
      quotaRepository.findActiveQuota.mockResolvedValue(mockQuota);

      await service.validateCommand(command, 'user-1', 'room-1');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'active_quota:user-1:room-1',
        mockQuota,
        { ttl: 300 } // 5 minutes
      );
    });
  });
});
```

### Repository Layer Testing

**User Repository Tests:**
```typescript
// src/modules/users/repositories/user.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user.entity';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let typeOrmRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
    typeOrmRepository = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedPassword',
        householdId: 'household-1',
      };

      const expectedUser = { id: 'user-1', ...userData };
      typeOrmRepository.create.mockReturnValue(expectedUser);
      typeOrmRepository.save.mockResolvedValue(expectedUser);

      const result = await repository.create(userData);

      expect(typeOrmRepository.create).toHaveBeenCalledWith(userData);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(expectedUser);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email with household relation', async () => {
      const email = 'test@example.com';
      const expectedUser = {
        id: 'user-1',
        email,
        household: { id: 'household-1', familyName: 'Test Family' },
      };

      typeOrmRepository.findOne.mockResolvedValue(expectedUser);

      const result = await repository.findByEmail(email);

      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: { email },
        relations: ['household'],
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      const email = 'nonexistent@example.com';
      typeOrmRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('findByHouseholdId', () => {
    it('should find users by householdId ordered by creation date', async () => {
      const householdId = 'household-1';
      const expectedUsers = [
        { id: 'user-1', householdId, createdAt: new Date('2024-01-01') },
        { id: 'user-2', householdId, createdAt: new Date('2024-01-02') },
      ];

      typeOrmRepository.find.mockResolvedValue(expectedUsers);

      const result = await repository.findByHouseholdId(householdId);

      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: { householdId },
        relations: ['household'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(expectedUsers);
    });
  });
});
```

## Integration Testing Strategy

### Controller Integration Tests

**Auth Controller Tests:**
```typescript
// src/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Household } from '../users/entities/household.entity';
import { JwtService } from './jwt.service';

describe('Auth Controller (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let householdRepository: Repository<Household>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    householdRepository = moduleFixture.get<Repository<Household>>(getRepositoryToken(Household));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterEach(async () => {
    // Clean up test data
    await userRepository.delete({});
    await householdRepository.delete({});
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'Password123!',
      familyName: 'Test Family',
    };

    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validRegisterData)
        .expect(201)
        .expect((res) => {
          // Contract validation
          expect(res.body.success).toBe(true);
          expect(res.body.message).toContain('registered successfully');

          // User data validation
          expect(res.body.data.user).toHaveProperty('id');
          expect(res.body.data.user.email).toBe(validRegisterData.email);
          expect(res.body.data.user.name).toBe(validRegisterData.name);
          expect(res.body.data.user.role).toBe('parent'); // First user should be parent
          expect(res.body.data.user).toHaveProperty('familyId');
          expect(res.body.data.user).toHaveProperty('createdAt');
          expect(res.body.data.user).toHaveProperty('updatedAt');

          // Token validation
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
          expect(res.body.data).toHaveProperty('expiresIn');
          expect(typeof res.body.data.expiresIn).toBe('number');

          // Timestamp validation
          expect(res.body).toHaveProperty('timestamp');
          expect(typeof Date.parse(res.body.timestamp)).toBe('number');
        });
    });

    it('should return error for invalid email format', () => {
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidData)
        .expect(422)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                field: 'email',
                message: expect.stringContaining('email'),
              }),
            ])
          );
        });
    });

    it('should return error for weak password', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'weak',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidData)
        .expect(422)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                field: 'password',
                message: expect.stringContaining('at least one uppercase'),
              }),
            ])
          );
        });
    });

    it('should return error for duplicate email', async () => {
      // Create existing user
      const existingUser = userRepository.create({
        email: validRegisterData.email,
        name: 'Existing User',
        passwordHash: 'hashedPassword',
        householdId: 'household-1',
      });
      await userRepository.save(existingUser);

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validRegisterData)
        .expect(409)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
        });
    });
  });

  describe('POST /api/auth/login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    beforeEach(async () => {
      // Create test user with hashed password
      const hashedPassword = await jwtService.hashPassword(validCredentials.password);
      const household = householdRepository.create({
        familyName: 'Test Family',
      });
      await householdRepository.save(household);

      const user = userRepository.create({
        email: validCredentials.email,
        name: 'Test User',
        passwordHash: hashedPassword,
        householdId: household.id,
        role: 'parent',
      });
      await userRepository.save(user);
    });

    it('should login successfully with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.user.email).toBe(validCredentials.email);
          expect(res.body.data.user).toHaveProperty('lastLoginAt');
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
        });
    });

    it('should return error for invalid password', () => {
      const invalidCredentials = {
        ...validCredentials,
        password: 'wrongpassword',
      };

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        });
    });

    it('should return error for non-existent user', () => {
      const nonExistentCredentials = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send(nonExistentCredentials)
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        });
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    let testUser: User;

    beforeEach(async () => {
      // Create test user
      const household = householdRepository.create({
        familyName: 'Test Family',
      });
      await householdRepository.save(household);

      testUser = userRepository.create({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedPassword',
        householdId: household.id,
        role: 'parent',
      });
      await userRepository.save(testUser);

      // Generate access token
      const tokens = jwtService.generateTokens(testUser);
      accessToken = tokens.accessToken;
    });

    it('should return current user information with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(testUser.id);
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.name).toBe(testUser.name);
          expect(res.body.data.role).toBe(testUser.role);
          expect(res.body.data.familyId).toBe(testUser.householdId);
        });
    });

    it('should return error for invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    it('should return error for missing token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });
  });
});
```

### WebSocket Integration Tests

**AirConditioner Gateway Tests:**
```typescript
// src/modules/websocket/airconditioner.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as io from 'socket.io-client';
import { AirConditionerGateway } from './airconditioner.gateway';
import { JwtService } from '../auth/jwt.service';
import { AirConCommandFactory } from '../factories/aircon-command.factory';
import { QuotaValidationService } from '../quotas/services/quota-validation.service';
import { AirConService } from './services/aircon.service';

describe('AirConditioner Gateway (e2e)', () => {
  let app: INestApplication;
  let gateway: AirConditionerGateway;
  let jwtService: JwtService;
  let server: any;
  let clientSocket: any;

  const testUser = {
    userId: 'test-user-id',
    householdId: 'test-household-id',
    role: 'parent',
    email: 'test@example.com',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirConditionerGateway,
        {
          provide: JwtService,
          useValue: {
            verifyToken: jest.fn().mockReturnValue(testUser),
          },
        },
        {
          provide: AirConCommandFactory,
          useValue: {
            createCommand: jest.fn(),
          },
        },
        {
          provide: QuotaValidationService,
          useValue: {
            validateCommand: jest.fn().mockResolvedValue({ isValid: true }),
          },
        },
        {
          provide: AirConService,
          useValue: {
            getRoomStatus: jest.fn().mockResolvedValue({
              roomId: 'test-room-id',
              temperature: 22,
              online: true,
            }),
            executeCommand: jest.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));

    gateway = module.get<AirConditionerGateway>(AirConditionerGateway);
    jwtService = module.get<JwtService>(JwtService);

    await app.listen(0);
    server = app.getHttpServer();
    const port = server.address().port;

    clientSocket = io(`http://localhost:${port}/ws/airconditioner`, {
      transports: ['websocket'],
      forceNew: true,
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  describe('Connection Handling', () => {
    it('should establish connection with valid parameters', (done) => {
      clientSocket.io.opts.query = {
        roomId: 'test-room-id',
        familyMemberId: testUser.userId,
        token: 'valid-token',
      };

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('error', (error) => {
        fail(`Connection failed: ${error.message}`);
        done();
      });

      clientSocket.connect();
    });

    it('should reject connection with missing parameters', (done) => {
      const invalidClient = io(`http://localhost:${server.address().port}/ws/airconditioner`, {
        transports: ['websocket'],
        query: {}, // Missing required parameters
      });

      invalidClient.on('connect', () => {
        fail('Connection should have been rejected');
        done();
      });

      invalidClient.on('error', (error) => {
        expect(error.message).toContain('Missing required connection parameters');
        invalidClient.disconnect();
        done();
      });

      invalidClient.connect();
    });

    it('should send initial status on connection', (done) => {
      clientSocket.on('status_update', (data) => {
        expect(data.type).toBe('STATUS_UPDATE');
        expect(data.payload.roomId).toBe('test-room-id');
        expect(data.payload.temperature).toBe(22);
        expect(data.payload.online).toBe(true);
        done();
      });
    });
  });

  describe('Command Handling', () => {
    beforeEach((done) => {
      // Ensure client is connected
      if (!clientSocket.connected) {
        clientSocket.on('connect', done);
        clientSocket.connect();
      } else {
        done();
      }
    });

    it('should handle SET_POWER command correctly', (done) => {
      const commandMessage = {
        type: 'SET_POWER',
        payload: {
          roomId: 'test-room-id',
          action: 'power',
          value: 'ON',
        },
      };

      clientSocket.emit('aircon_command', commandMessage);

      clientSocket.on('command_ack', (response) => {
        expect(response.type).toBe('COMMAND_ACKNOWLEDGED');
        expect(response.payload.action).toBe('power');
        expect(response.payload.value).toBe('ON');
        done();
      });

      clientSocket.on('error', (error) => {
        fail(`Command failed: ${error.message}`);
        done();
      });
    });

    it('should handle SET_TEMPERATURE command with validation', (done) => {
      const commandMessage = {
        type: 'SET_TEMPERATURE',
        payload: {
          roomId: 'test-room-id',
          action: 'temp',
          value: 25,
        },
      };

      clientSocket.emit('aircon_command', commandMessage);

      clientSocket.on('command_ack', (response) => {
        expect(response.type).toBe('COMMAND_ACKNOWLEDGED');
        expect(response.payload.action).toBe('temp');
        expect(response.payload.value).toBe(25);
        done();
      });

      clientSocket.on('error', (error) => {
        fail(`Command failed: ${error.message}`);
        done();
      });
    });

    it('should reject commands for invalid room', (done) => {
      const commandMessage = {
        type: 'SET_POWER',
        payload: {
          roomId: 'invalid-room-id',
          action: 'power',
          value: 'ON',
        },
      };

      clientSocket.emit('aircon_command', commandMessage);

      clientSocket.on('error', (response) => {
        expect(response.type).toBe('ERROR');
        expect(response.payload.code).toBe('ROOM_ACCESS_DENIED');
        done();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should broadcast status updates to room clients', (done) => {
      const statusUpdate = {
        type: 'STATUS_UPDATE',
        payload: {
          roomId: 'test-room-id',
          temperature: 23,
          fan: 'HIGH',
          online: true,
        },
      };

      clientSocket.on('status_update', (data) => {
        if (data.payload.temperature === 23) {
          expect(data.type).toBe('STATUS_UPDATE');
          expect(data.payload.roomId).toBe('test-room-id');
          expect(data.payload.temperature).toBe(23);
          expect(data.payload.fan).toBe('HIGH');
          done();
        }
      });

      // Simulate status update from external source
      gateway.broadcastToRoom('test-room-id', statusUpdate);
    });
  });
});
```

## Contract Testing

### API Contract Tests

```typescript
// test/contracts/auth.contracts.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('API Contract Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Contract', () => {
    describe('POST /api/auth/register', () => {
      const validRequest = {
        email: 'contract-test@example.com',
        name: 'Contract Test User',
        password: 'Password123!',
        familyName: 'Contract Test Family',
      };

      it('should match exact response contract structure', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(validRequest)
          .expect(201);

        // Contract validation
        expect(response.body).toEqual(
          expect.objectContaining({
            success: expect.any(Boolean),
            message: expect.any(String),
            data: expect.objectContaining({
              user: expect.objectContaining({
                id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
                email: validRequest.email,
                name: validRequest.name,
                role: expect.stringMatching(/^(parent|child)$/),
                familyId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
                createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
                updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
              }),
              accessToken: expect.stringMatching(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/),
              refreshToken: expect.stringMatching(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/),
              expiresIn: expect.any(Number),
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
          })
        );

        // Specific value validations
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe('parent'); // First user should be parent
        expect(response.body.data.expiresIn).toBeGreaterThan(0);
        expect(response.body.data.expiresIn).toBeLessThanOrEqual(86400); // 24 hours max
      });
    });
  });
});
```

## Performance Testing

### Load Testing with Artillery

```yaml
# test/performance/load-test.yml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Authentication flow"
    weight: 30
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "Password123!"
          capture:
            - json: "$.data.accessToken"
              as: "authToken"
      - get:
          url: "/api/auth/me"
          headers:
            Authorization: "Bearer {{ authToken }}"

  - name: "Room management"
    weight: 40
    flow:
      - get:
          url: "/api/rooms"
          headers:
            Authorization: "Bearer {{ authToken }}"

  - name: "Quota validation"
    weight: 30
    flow:
      - get:
          url: "/api/quotas/user/{{ userId }}"
          headers:
            Authorization: "Bearer {{ authToken }}"
```

### Performance Benchmarks

```typescript
// test/performance/quota-validation.performance.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuotaValidationService } from '../../src/modules/quotas/services/quota-validation.service';
import { describe } from 'node:test';

describe('Quota Validation Performance', () => {
  let service: QuotaValidationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [QuotaValidationService],
    }).compile();

    service = module.get<QuotaValidationService>(QuotaValidationService);
  });

  describe('Response Time Performance', () => {
    it('should complete validation within 100ms', async () => {
      const command = {
        roomId: 'test-room',
        userId: 'test-user',
        action: 'power',
        value: 'ON',
        timestamp: new Date(),
      };

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.validateCommand(command, 'test-user', 'test-room');
        const end = performance.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`Performance metrics:`);
      console.log(`Average: ${averageTime.toFixed(2)}ms`);
      console.log(`Max: ${maxTime.toFixed(2)}ms`);
      console.log(`95th percentile: ${p95Time.toFixed(2)}ms`);

      expect(averageTime).toBeLessThan(50); // Average should be well under 100ms
      expect(p95Time).toBeLessThan(100); // 95th percentile under 100ms
      expect(maxTime).toBeLessThan(200); // Even worst case under 200ms
    });
  });
});
```

## Testing Utilities

### Test Database Setup

```typescript
// test/utils/test-database.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../../src/modules/users/entities/user.entity';
import { Household } from '../../src/modules/users/entities/household.entity';
import { Quota } from '../../src/modules/quotas/entities/quota.entity';
import { UsageSession } from '../../src/modules/quotas/entities/usage-session.entity';

export const getTestDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: 'localhost',
  port: 5433, // Different port for tests
  username: 'test_user',
  password: 'test_password',
  database: 'mitsubishi_controller_test',
  entities: [User, Household, Quota, UsageSession],
  synchronize: true, // OK for tests
  logging: false,
  dropSchema: true, // Clean slate for each test run
});

export const createTestUser = async (userRepository: any, overrides: any = {}) => {
  const userData = {
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashedPassword',
    householdId: 'test-household',
    role: 'parent',
    status: 'active',
    ...overrides,
  };

  return await userRepository.save(userData);
};

export const createTestHousehold = async (householdRepository: any, overrides: any = {}) => {
  const householdData = {
    familyName: 'Test Family',
    timezone: 'UTC',
    ...overrides,
  };

  return await householdRepository.save(householdData);
};
```

### Mock Data Factory

```typescript
// test/utils/mock-data.factory.ts
import { faker } from '@faker-js/faker';
import { User, UserRole, UserStatus } from '../../src/modules/users/entities/user.entity';
import { Household } from '../../src/modules/users/entities/household.entity';
import { Quota, QuotaType, QuotaScope, QuotaPeriod } from '../../src/modules/quotas/entities/quota.entity';

export class MockDataFactory {
  static createHousehold(overrides: Partial<Household> = {}): Household {
    return {
      id: faker.string.uuid(),
      familyName: faker.person.lastName() + ' Family',
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      postalCode: faker.location.zipCode(),
      phone: faker.phone.number(),
      timezone: 'UTC',
      settings: {},
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as Household;
  }

  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      passwordHash: faker.internet.password(),
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      householdId: faker.string.uuid(),
      preferences: {},
      emergencyContacts: {},
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as User;
  }

  static createQuota(overrides: Partial<Quota> = {}): Quota {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      roomId: faker.string.uuid(),
      name: 'Daily Time Limit',
      description: 'Maximum daily AC usage time',
      quotaType: QuotaType.TIME_BASED,
      scope: QuotaScope.ROOM,
      allowedAmount: 2, // 2 hours
      usedAmount: 0,
      warningThreshold: 75,
      period: QuotaPeriod.DAILY,
      status: 'ACTIVE',
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as Quota;
  }
}
```

## Test Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.spec.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/auth/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/modules/quotas/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
```

This comprehensive testing strategy ensures the NestJS implementation maintains 100% functional equivalence with the Spring Boot backend while providing confidence in the migration through extensive automated testing.