# Security Migration Guide

## Overview

This document outlines the security migration strategy for transitioning from Spring Boot Security to NestJS with Passport. The migration maintains identical security postures while leveraging NestJS security best practices.

## Security Architecture Comparison

### Spring Boot Security Implementation
- **Framework**: Spring Security with JWT
- **Authentication**: JWT with access/refresh tokens
- **Authorization**: Role-based access control (parent/child)
- **Password Security**: BCrypt hashing
- **Session Management**: Stateless JWT tokens
- **CORS**: Spring Security CORS configuration

### NestJS Security Implementation
- **Framework**: Passport with JWT strategy
- **Authentication**: JWT with access/refresh tokens
- **Authorization**: Role-based guards and decorators
- **Password Security**: bcrypt hashing
- **Session Management**: Stateless JWT tokens
- **CORS**: NestJS CORS configuration

## Authentication System Migration

### JWT Service Implementation

**Spring Boot JWT Service → NestJS JWT Service:**

```typescript
// src/modules/auth/jwt.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { JwtPayload, JwtTokens, TokenPair } from './interfaces/jwt.interface';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hashes a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compares a plain password with a hashed password
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generates access and refresh tokens for a user
   */
  generateTokens(user: User): JwtTokens {
    const payload: JwtPayload = {
      userId: user.id,
      householdId: user.householdId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '24h'),
      issuer: 'mitsubishi-controller-nestjs',
      audience: 'mitsubishi-remote-control',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      issuer: 'mitsubishi-controller-nestjs',
      audience: 'mitsubishi-remote-control',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpirationSeconds('JWT_EXPIRATION', '24h'),
    };
  }

  /**
   * Verifies an access token and returns the payload
   */
  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        issuer: 'mitsubishi-controller-nestjs',
        audience: 'mitsubishi-remote-control',
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verifies a refresh token and returns the payload
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        issuer: 'mitsubishi-controller-nestjs',
        audience: 'mitsubishi-remote-control',
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Refreshes tokens using a valid refresh token
   */
  async refreshTokens(refreshToken: string): Promise<JwtTokens> {
    const payload = this.verifyRefreshToken(refreshToken);

    // In a production environment, you might want to:
    // 1. Check if the refresh token is revoked/blacklisted
    // 2. Verify the user still exists and is active
    // 3. Check if the user's role/permissions haven't changed

    const newTokens = this.generateTokens({
      id: payload.userId,
      householdId: payload.householdId,
      email: payload.email,
      role: payload.role,
    } as User);

    return newTokens;
  }

  /**
   * Extracts token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Converts time string to seconds
   */
  private getExpirationSeconds(configKey: string, defaultHours: string): number {
    const timeString = this.configService.get<string>(configKey, defaultHours);
    const match = timeString.match(/^(\d+)([hdwmy])$/);

    if (!match) {
      // Default to hours if format is unexpected
      const hours = parseInt(timeString.replace(/[^\d]/g, ''), 10) || 24;
      return hours * 60 * 60;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const unitMultipliers = {
      's': 1,
      'm': 60,
      'h': 60 * 60,
      'd': 24 * 60 * 60,
      'w': 7 * 24 * 60 * 60,
      'm': 30 * 24 * 60 * 60,
      'y': 365 * 24 * 60 * 60,
    };

    return value * (unitMultipliers[unit] || unitMultipliers['h']);
  }
}
```

### JWT Strategy Implementation

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt.interface';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: 'mitsubishi-controller-nestjs',
      audience: 'mitsubishi-remote-control',
    });
  }

  async validate(payload: JwtPayload) {
    // Validate that the user still exists and is active
    const user = await this.usersService.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    // Return user info that will be attached to request object
    return {
      userId: payload.userId,
      householdId: payload.householdId,
      email: payload.email,
      role: payload.role,
      user: user, // Full user entity if needed
    };
  }
}
```

### Authentication Guards

```typescript
// src/modules/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}

// src/modules/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    return requiredRoles.some((role) => user.role === role);
  }
}
```

### Role-Based Decorators

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Usage example:
// @Roles(UserRole.PARENT)
// @Post('/quotas')
// async createQuota(@Body() createQuotaDto: CreateQuotaDto) {
//   // Only parents can create quotas
// }

// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// src/common/decorators/user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);
```

## Authorization System Migration

### Permission-Based Access Control

```typescript
// src/modules/auth/interfaces/permission.interface.ts
export enum Permission {
  // User permissions
  READ_OWN_PROFILE = 'read:own:profile',
  UPDATE_OWN_PROFILE = 'update:own:profile',

  // Room permissions
  READ_ROOMS = 'read:rooms',
  CONTROL_ROOMS = 'control:rooms',

  // Quota permissions
  READ_OWN_QUOTAS = 'read:own:quotas',
  MANAGE_QUOTAS = 'manage:quotas',  // Parents only

  // Household permissions
  READ_HOUSEHOLD = 'read:household',
  MANAGE_HOUSEHOLD = 'manage:household',  // Parents only
}

// src/modules/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../interfaces/permission.interface';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// src/modules/auth/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../interfaces/permission.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    const userPermissions = this.getUserPermissions(user.role, user.userId);

    return requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );
  }

  private getUserPermissions(role: string, userId: string): Permission[] {
    const basePermissions = [
      Permission.READ_OWN_PROFILE,
      Permission.READ_ROOMS,
      Permission.READ_OWN_QUOTAS,
    ];

    const parentPermissions = [
      ...basePermissions,
      Permission.UPDATE_OWN_PROFILE,
      Permission.CONTROL_ROOMS,
      Permission.MANAGE_QUOTAS,
      Permission.READ_HOUSEHOLD,
      Permission.MANAGE_HOUSEHOLD,
    ];

    const childPermissions = [
      ...basePermissions,
      Permission.CONTROL_ROOMS, // Children can control AC but not manage quotas
    ];

    return role === 'parent' ? parentPermissions : childPermissions;
  }
}
```

### Resource-Based Authorization

```typescript
// src/modules/auth/guards/resource-owner.guard.ts
import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      return false;
    }

    // Parents can access all household resources
    if (user.role === 'parent') {
      return true;
    }

    // Check resource ownership for children
    const resourceId = this.getResourceIdFromRequest(request);
    const resourceType = this.getResourceTypeFromRequest(request);

    return this.validateOwnership(user.userId, resourceId, resourceType);
  }

  private getResourceIdFromRequest(request: any): string {
    // Extract resource ID from request parameters or body
    return request.params.id || request.params.userId || request.body.userId;
  }

  private getResourceTypeFromRequest(request: any): string {
    // Determine resource type from route
    const path = request.route.path;
    if (path.includes('/quotas')) return 'quota';
    if (path.includes('/usage-sessions')) return 'usage-session';
    return 'unknown';
  }

  private validateOwnership(userId: string, resourceId: string, resourceType: string): boolean {
    // Implement resource ownership validation logic
    // This would typically involve a database lookup
    return true; // Simplified for example
  }
}
```

## Security Middleware Implementation

### Global Security Configuration

```typescript
// src/common/guards/global-auth.guard.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    // Set security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS in production
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return next.handle();
  }
}

// src/main.ts - Global security setup
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SecurityHeadersInterceptor } from './common/guards/global-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Security headers interceptor
  app.useGlobalInterceptors(new SecurityHeadersInterceptor());

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Role'],
  });

  await app.listen(process.env.PORT || 8080);
}
```

### Rate Limiting Implementation

```typescript
// src/common/guards/rate-limiting.guard.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (context: ExecutionContext) => string;
}

@Injectable()
export class RateLimitingInterceptor implements NestInterceptor {
  private readonly requests = new Map<string, { count: number; resetTime: number }>();

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rateLimitConfig = this.reflector.get<RateLimitConfig>('rateLimit', context.getHandler()) ||
                          this.reflector.get<RateLimitConfig>('rateLimit', context.getClass());

    if (!rateLimitConfig) {
      return next.handle();
    }

    const key = rateLimitConfig.keyGenerator
      ? rateLimitConfig.keyGenerator(context)
      : this.getDefaultKey(context);

    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs,
      });
      return next.handle();
    }

    if (record.count >= rateLimitConfig.maxRequests) {
      throw new HttpException('Too Many Requests', 429);
    }

    record.count++;
    return next.handle();
  }

  private getDefaultKey(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const userId = request.user?.userId;
    return userId ? `user:${userId}` : `ip:${ip}`;
  }
}

// src/common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (windowMs: number, maxRequests: number) =>
  SetMetadata(RATE_LIMIT_KEY, { windowMs, maxRequests });

// Usage example:
// @RateLimit(15 * 60 * 1000, 5) // 5 requests per 15 minutes
// @Post('/api/auth/login')
// async login(@Body() loginDto: LoginDto) {
//   // Login endpoint with rate limiting
// }
```

## Input Validation and Sanitization

### Advanced DTO Validation

```typescript
// src/modules/auth/dto/auth.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Name can only contain letters, spaces, hyphens, and apostrophes' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
  })
  password: string;

  @IsString({ message: 'Family name must be a string' })
  @MinLength(2, { message: 'Family name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Family name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Family name can only contain letters, spaces, hyphens, and apostrophes' })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  familyName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password cannot be empty' })
  password: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  rememberMe?: boolean;
}

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token must be a string' })
  @MinLength(10, { message: 'Invalid refresh token format' })
  refreshToken: string;
}

// src/modules/quotas/dto/quota.dto.ts
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { QuotaType, QuotaPeriod, QuotaScope } from '../entities/quota.entity';

export class CreateQuotaDto {
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId: string;

  @IsUUID('4', { message: 'Room ID must be a valid UUID' })
  @IsOptional()
  roomId?: string;

  @IsEnum(QuotaType, { message: 'Invalid quota type' })
  quotaType: QuotaType;

  @IsString({ message: 'Quota name must be a string' })
  @MinLength(1, { message: 'Quota name cannot be empty' })
  @MaxLength(255, { message: 'Quota name cannot exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  description?: string;

  @IsNumber({}, { message: 'Allowed amount must be a number' })
  @Type(() => Number)
  @Min(0.01, { message: 'Allowed amount must be greater than 0' })
  @Max(999999.99, { message: 'Allowed amount cannot exceed 999,999.99' })
  allowedAmount: number;

  @IsNumber({}, { message: 'Warning threshold must be a number' })
  @Type(() => Number)
  @Min(1, { message: 'Warning threshold must be at least 1%' })
  @Max(99, { message: 'Warning threshold cannot exceed 99%' })
  @IsOptional()
  warningThreshold?: number = 75;

  @IsEnum(QuotaPeriod, { message: 'Invalid quota period' })
  @IsOptional()
  period?: QuotaPeriod = QuotaPeriod.DAILY;
}
```

### Custom Validation Decorators

```typescript
// src/common/decorators/validators/is-strong-password.decorator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return false;

          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumbers = /\d/.test(value);
          const hasNonalphas = /\W/.test(value);

          return hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
        },
      },
    });
  };
}

// src/common/decorators/validators/is-uuid-v4.decorator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsUUIDv4(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isUUIDv4',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return typeof value === 'string' && uuidV4Regex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid UUID v4`;
        },
      },
    });
  };
}
```

## Security Testing

### Security Test Suite

```typescript
// test/security/auth.security.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Security Tests', () => {
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

  describe('Authentication Security', () => {
    it('should reject requests without JWT token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    it('should reject requests with malformed JWT token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    it('should reject requests with expired JWT token', () => {
      // This would require creating an expired token for testing
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid'; // Expired token

      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Authorization Security', () => {
    let childToken: string;
    let parentToken: string;

    beforeAll(async () => {
      // Create test users and get tokens
      const childLoginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'child@test.com',
          password: 'Password123!',
        });

      const parentLoginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'parent@test.com',
          password: 'Password123!',
        });

      childToken = childLoginResponse.body.data.accessToken;
      parentToken = parentLoginResponse.body.data.accessToken;
    });

    it('should allow parents to access quota management', () => {
      return request(app.getHttpServer())
        .post('/api/quotas')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          userId: 'test-user-id',
          quotaType: 'TIME_BASED',
          name: 'Test Quota',
          allowedAmount: 2,
        })
        .expect(201);
    });

    it('should reject children from accessing quota management', () => {
      return request(app.getHttpServer())
        .post('/api/quotas')
        .set('Authorization', `Bearer ${childToken}`)
        .send({
          userId: 'test-user-id',
          quotaType: 'TIME_BASED',
          name: 'Test Quota',
          allowedAmount: 2,
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.error.code).toBe('FORBIDDEN');
        });
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: maliciousInput,
          password: 'Password123!',
        })
        .expect(422); // Should fail validation, not reach database
    });

    it('should prevent XSS attempts in user input', () => {
      const xssPayload = '<script>alert("xss")</script>';

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: xssPayload,
          password: 'Password123!',
        })
        .expect(422); // Should fail validation
    });

    it('should prevent brute force attacks with rate limiting', async () => {
      const loginAttempts = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(loginAttempts);

      // Last few attempts should be rate limited
      const rateLimitedResponses = responses.slice(-3);
      rateLimitedResponses.forEach(response => {
        expect(response.status).toBe(429);
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', () => {
      return request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-content-type-options']).toBe('nosniff');
          expect(res.headers['x-frame-options']).toBe('DENY');
          expect(res.headers['x-xss-protection']).toBe('1; mode=block');
          expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        });
    });
  });
});
```

## Security Configuration

### Environment Variables

```bash
# .env.production
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-different-from-access-secret
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# Security Settings
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
CORS_CREDENTIALS=true

# Security Headers
ENABLE_HSTS=true
ENABLE_CSP=true

# Database Security
DATABASE_SSL_MODE=require
DATABASE_SSL_CERT_PATH=/path/to/cert
DATABASE_SSL_KEY_PATH=/path/to/key

# Redis Security
REDIS_PASSWORD=your-redis-password
REDIS_TLS_ENABLED=true
```

### Security Audit Script

```bash
#!/bin/bash
# scripts/security-audit.sh

echo "🔒 Running Security Audit..."

# Check for known vulnerabilities
echo "📦 Checking for package vulnerabilities..."
npm audit --audit-level high

# Check for security misconfigurations
echo "🔍 Checking security configurations..."
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET not set"
    exit 1
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "❌ JWT_SECRET too short (minimum 32 characters)"
    exit 1
fi

# Check for exposed secrets
echo "🕵️  Checking for exposed secrets..."
if grep -r "password.*=" src/ --include="*.ts" | grep -v "env\|example"; then
    echo "❌ Potential hardcoded passwords found"
    exit 1
fi

# Check for insecure dependencies
echo "📚 Checking for insecure dependencies..."
npm ls --depth=0 | grep -E "(beta|rc|alpha)" && echo "⚠️  Pre-release dependencies detected"

# Check CORS configuration
echo "🌐 Checking CORS configuration..."
if [ -z "$CORS_ORIGINS" ]; then
    echo "❌ CORS origins not configured"
    exit 1
fi

echo "✅ Security audit completed successfully"
```

This comprehensive security migration guide ensures that the NestJS implementation maintains the same security posture as the Spring Boot backend while following modern security best practices.