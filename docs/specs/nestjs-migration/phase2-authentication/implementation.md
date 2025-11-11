# Phase 2: Authentication and User Management - Implementation Plan

## Phase Overview

**Objective**: Implement comprehensive authentication and user management system maintaining 100% functional equivalence with Spring Boot backend.

**Duration**: 4-6 days
**Success Criteria**:
- All authentication endpoints work identically to Spring Boot
- JWT token management with refresh mechanism
- Role-based access control (parent/child)
- Household management functionality
- Password reset functionality
- Performance targets met (login <150ms, register <200ms)

## Clean Code Implementation Checklist

### DRY Implementation Strategy
- ✅ **Centralized Validation**: Shared validation schemas for user data
- ✅ **Common Error Handling**: Standardized authentication error responses
- ✅ **Reusable Authentication Logic**: Extracted to AuthService
- ✅ **Shared Security Patterns**: Common password hashing and token patterns
- ✅ **Utility Functions**: Reusable user and household operations

### SOLID Principles Implementation
- ✅ **SRP**: Separate modules for auth, users, households
- ✅ **OCP**: Extensible authentication strategies and role providers
- ✅ **LSP**: Proper inheritance hierarchies for user types
- ✅ **ISP**: Focused interfaces for different auth concerns
- ✅ **DIP**: Dependency injection for all services and repositories

### YAGNI Implementation Strategy
- ✅ **Minimal Implementation**: Only current auth requirements
- ✅ **Simple Role System**: Parent/child roles only
- ✅ **Basic Email Templates**: Essential verification/reset only
- ✅ **JWT Only**: No OAuth or social login unless required

## Implementation Tasks

### Task 2.1: Database Entities and Migrations

**Objective**: Create TypeORM entities matching Spring Boot database schema

**Implementation Steps**:

1. **User Entity Implementation**
```typescript
// src/modules/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserSession } from './user-session.entity';
import { Household } from '../../households/entities/household.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CHILD,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({
    name: 'password_reset_token',
    type: 'varchar',
    length: 500,
    nullable: true,
    unique: true
  })
  passwordResetToken: string;

  @Column({
    name: 'password_reset_expires',
    type: 'timestamp',
    nullable: true
  })
  passwordResetExpires: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Household, household => household.members, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'household_id' })
  household: Household;

  @Column({ name: 'household_id', nullable: true })
  householdId: string;

  @OneToMany(() => UserSession, session => session.user)
  sessions: UserSession[];

  // Computed properties
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isParent(): boolean {
    return this.role === UserRole.PARENT;
  }

  get isChild(): boolean {
    return this.role === UserRole.CHILD;
  }

  // Serialization for API responses
  toJSON() {
    const { passwordHash, passwordResetToken, passwordResetExpires, ...result } = this;
    return result;
  }
}
```

2. **Household Entity Implementation**
```typescript
// src/modules/households/entities/household.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => User, user => user.household)
  members: User[];

  @OneToMany(() => Room, room => room.household)
  rooms: Room[];

  // Computed properties
  get memberCount(): number {
    return this.members?.length || 0;
  }

  get parents(): User[] {
    return this.members?.filter(member => member.isParent) || [];
  }

  get children(): User[] {
    return this.members?.filter(member => member.isChild) || [];
  }
}
```

3. **User Session Entity for Token Management**
```typescript
// src/modules/users/entities/user-session.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_sessions')
@Index(['userId', 'isActive'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'refresh_token', length: 500 })
  refreshToken: string;

  @Column({ name: 'device_info', type: 'json', nullable: true })
  deviceInfo: Record<string, any>;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Computed properties
  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isValid(): boolean {
    return this.isActive && !this.isExpired;
  }
}
```

4. **Database Migration**
```typescript
// migrations/001_create_auth_tables.ts
import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateAuthTables1234567890 implements MigrationInterface {
  name = 'CreateAuthTables1234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create households table
    await queryRunner.createTable(
      new Table({
        name: 'households',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'password_hash', type: 'varchar', length: '255' },
          { name: 'first_name', type: 'varchar', length: '100' },
          { name: 'last_name', type: 'varchar', length: '100' },
          {
            name: 'role',
            type: 'enum',
            enum: ['parent', 'child'],
            default: `'child'`,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'last_login_at', type: 'timestamp', isNullable: true },
          { name: 'password_reset_token', type: 'varchar', length: '500', isNullable: true },
          { name: 'password_reset_expires', type: 'timestamp', isNullable: true },
          { name: 'household_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['household_id'],
            referencedTableName: 'households',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          { name: 'IDX_USER_EMAIL', columnNames: ['email'], isUnique: true },
          { name: 'IDX_USER_HOUSEHOLD', columnNames: ['household_id'] },
          { name: 'IDX_USER_ACTIVE', columnNames: ['is_active'] },
        ],
      }),
      true,
    );

    // Create user_sessions table
    await queryRunner.createTable(
      new Table({
        name: 'user_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            isPrimary: true,
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'refresh_token', type: 'varchar', length: '500' },
          { name: 'device_info', type: 'json', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          { name: 'user_agent', type: 'text', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_SESSION_USER_ACTIVE', columnNames: ['user_id', 'is_active'] },
          { name: 'IDX_SESSION_TOKEN', columnNames: ['refresh_token'] },
          { name: 'IDX_SESSION_EXPIRES', columnNames: ['expires_at'] },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_sessions');
    await queryRunner.dropTable('users');
    await queryRunner.dropTable('households');
  }
}
```

**Validation**:
- [ ] All entities compile without TypeScript errors
- [ ] Database migration runs successfully
- [ ] Entity relationships work correctly
- [ ] Indexes are created for performance

### Task 2.2: Authentication Service Implementation

**Objective**: Implement core authentication logic with JWT management

**Implementation Steps**:

1. **Password Service**
```typescript
// src/modules/auth/services/password.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12; // Production strength

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password: string): PasswordValidationResult {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors: string[] = [];
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      score: this.calculatePasswordScore(password),
      errors,
      suggestions: this.getPasswordSuggestions(password),
    };
  }

  private calculatePasswordScore(password: string): number {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z\d]/.test(password)) score += 1;
    return Math.min(score, 5);
  }

  private getPasswordSuggestions(password: string): string[] {
    const suggestions: string[] = [];
    if (password.length < 12) {
      suggestions.push('Consider using a longer password (12+ characters)');
    }
    if (!/[^a-zA-Z\d]/.test(password)) {
      suggestions.push('Add special characters for increased security');
    }
    if (password.toLowerCase() === password || password.toUpperCase() === password) {
      suggestions.push('Mix uppercase and lowercase letters');
    }
    return suggestions;
  }
}

interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
  suggestions: string[];
}
```

2. **JWT Token Service**
> **Package Documentation**: Based on [@nestjs/jwt](https://github.com/nestjs/jwt) - JWT implementation for NestJS
>
> **Key Features**:
> - Asynchronous token signing and verification
> - Configurable token options (algorithm, expiresIn, etc.)
> - TypeScript support with typed payloads
> - Custom secret management
> - Token blacklisting support

```typescript
// src/modules/auth/services/token.service.ts
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { User } from '../../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async generateTokenPair(user: User, deviceInfo?: any): Promise<TokenPair> {
    // Access token payload with shorter lifespan
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
      type: 'access',
      iat: Math.floor(Date.now() / 1000), // Explicit issued at time
    };

    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(payload: JWTPayload): Promise<string> {
    // Use async sign method from @nestjs/jwt
    return await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('jwt.expiresIn', '24h'),
      audience: this.configService.get<string>('jwt.audience', 'mitsubishi-remote-control'),
      issuer: this.configService.get<string>('jwt.issuer', 'mitsubishi-backend'),
      algorithm: 'HS256',
      subject: payload.sub,
      // Include user ID in JWT ID for additional tracking
      jwtid: uuidv4(),
    });
  }

  private async generateRefreshToken(userId: string, deviceInfo?: any): Promise<string> {
    const refreshTokenId = uuidv4();
    const payload = {
      sub: userId,
      jti: refreshTokenId,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.refreshExpiresIn', '7d'),
      audience: 'mitsubishi-remote-control',
      issuer: 'mitsubishi-backend',
    });

    // Store refresh token in Redis
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.redis.setex(
      `refresh_token:${refreshTokenId}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify({
        userId,
        deviceInfo,
        expiresAt: expiresAt.toISOString(),
      })
    );

    return refreshToken;
  }

  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      // Use async verify method from @nestjs/jwt
      const payload = await this.jwtService.verifyAsync(token, {
        audience: this.configService.get<string>('jwt.audience', 'mitsubishi-remote-control'),
        issuer: this.configService.get<string>('jwt.issuer', 'mitsubishi-backend'),
        algorithms: ['HS256'],
      }) as JWTPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token is blacklisted');
      }

      return { isValid: true, payload };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify(refreshToken) as any;

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const storedToken = await this.redis.get(`refresh_token:${payload.jti}`);
      if (!storedToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const tokenData = JSON.parse(storedToken);
      if (new Date() > new Date(tokenData.expiresAt)) {
        await this.redis.del(`refresh_token:${payload.jti}`);
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user for new token generation
      const user = await this.userService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Invalidate old refresh token
      await this.invalidateRefreshToken(payload.jti);

      // Generate new token pair
      return this.generateTokenPair(user, tokenData.deviceInfo);
    } catch (error) {
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  async invalidateToken(token: string): Promise<void> {
    const payload = this.jwtService.decode(token) as any;
    if (payload && payload.exp) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(`blacklist:${token}`, ttl, '1');
      }
    }
  }

  async invalidateRefreshToken(jti: string): Promise<void> {
    await this.redis.del(`refresh_token:${jti}`);
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result === '1';
  }
}

interface JWTPayload {
  sub: string;
  email: string;
  householdId?: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface TokenValidationResult {
  isValid: boolean;
  payload?: JWTPayload;
  error?: string;
}
```

3. **Authentication Service**
```typescript
// src/modules/auth/services/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Household } from '../../households/entities/household.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { CacheService } from '../../shared/services/cache.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly rateLimitService: AuthRateLimitService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress: string): Promise<AuthResult> {
    // Check rate limiting
    const rateLimitResult = await this.rateLimitService.checkRegistrationRateLimit(ipAddress);
    if (rateLimitResult.isBlocked) {
      throw new UnauthorizedException('Too many registration attempts. Please try again later.');
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(registerDto.password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Create household if this is the first user
    let household: Household | null = null;
    const userCount = await this.userRepository.count();
    const isFirstUser = userCount === 0;

    if (isFirstUser) {
      household = this.householdRepository.create({
        name: `${registerDto.firstName}'s Household`,
        description: 'Automatically created household',
      });
      household = await this.householdRepository.save(household);
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(registerDto.password);

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email.toLowerCase().trim(),
      passwordHash,
      firstName: registerDto.firstName.trim(),
      lastName: registerDto.lastName.trim(),
      role: isFirstUser ? UserRole.PARENT : UserRole.CHILD,
      householdId: household?.id,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Cache user data
    await this.cacheService.setUser(savedUser);

    // Generate tokens
    const tokens = await this.tokenService.generateTokenPair(savedUser, {
      registrationSource: 'web',
      ipAddress,
    });

    return {
      user: this.sanitizeUser(savedUser),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent?: string): Promise<AuthResult> {
    // Check rate limiting
    const rateLimitResult = await this.rateLimitService.checkLoginRateLimit(loginDto.email, ipAddress);
    if (rateLimitResult.isBlocked) {
      throw new UnauthorizedException({
        message: 'Too many failed login attempts. Account temporarily locked.',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Find user
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email.toLowerCase().trim() },
      relations: ['household'],
    });

    if (!user) {
      // Don't reveal if user exists
      await this.rateLimitService.recordFailedLogin(loginDto.email, ipAddress);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verifyPassword(
      loginDto.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      await this.rateLimitService.recordFailedLogin(loginDto.email, ipAddress);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Cache user data
    await this.cacheService.setUser(user);

    // Generate tokens
    const tokens = await this.tokenService.generateTokenPair(user, {
      ipAddress,
      userAgent,
    });

    // Clear failed login attempts
    await this.rateLimitService.clearFailedLoginAttempts(loginDto.email, ipAddress);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refreshToken(refreshToken);
  }

  async logout(accessToken: string, refreshToken: string): Promise<void> {
    try {
      // Invalidate access token
      await this.tokenService.invalidateToken(accessToken);

      // Invalidate refresh token
      if (refreshToken) {
        const payload = this.jwtService.decode(refreshToken) as any;
        if (payload?.jti) {
          await this.tokenService.invalidateRefreshToken(payload.jti);
        }
      }
    } catch (error) {
      // Log error but don't throw to ensure logout always succeeds
      console.error('Logout error:', error);
    }
  }

  async validateUser(userId: string): Promise<User | null> {
    // Try cache first
    const cachedUser = await this.cacheService.getUser(userId);
    if (cachedUser) {
      return cachedUser;
    }

    // Fallback to database
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['household'],
    });

    if (user) {
      await this.cacheService.setUser(user);
    }

    return user;
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}
```

**Validation**:
- [ ] Password hashing works with correct strength
- [ ] JWT token generation and validation works
- [ ] Refresh token mechanism functions properly
- [ ] Rate limiting prevents brute force attacks
- [ ] User registration and login flows work correctly

### Task 2.3: Authentication Controllers and DTOs

**Objective**: Implement REST endpoints for authentication

**Implementation Steps**:

1. **Authentication DTOs**
```typescript
// src/modules/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  email: string;

  @ApiProperty({ example: 'John', minLength: 1, maxLength: 100 })
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name cannot be empty' })
  @MaxLength(100, { message: 'First name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'First name can only contain letters, spaces, hyphens, and apostrophes' })
  firstName: string;

  @ApiProperty({ example: 'Doe', minLength: 1, maxLength: 100 })
  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name cannot be empty' })
  @MaxLength(100, { message: 'Last name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Last name can only contain letters, spaces, hyphens, and apostrophes' })
  lastName: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}

// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString({ message: 'Password must be a string' })
  password: string;
}

// src/modules/auth/dto/refresh-token.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token cannot be empty' })
  refreshToken: string;
}

// src/modules/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export class AuthResponseDto {
  @ApiProperty({ description: 'Access token for API authentication' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for token renewal' })
  refreshToken: string;

  @ApiProperty({ description: 'User information' })
  user: Omit<User, 'passwordHash'>;
}
```

2. **Authentication Controller**
```typescript
// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many registration attempts' })
  @UseGuards(RateLimitGuard)
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const ipAddress = this.getClientIp(req);
    const result = await this.authService.register(registerDto, ipAddress);

    res.status(HttpStatus.CREATED);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and return tokens' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many login attempts' })
  @UseGuards(RateLimitGuard)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Token refreshed successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and invalidate tokens' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Logout successful' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid token' })
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
  ): Promise<void> {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    await this.authService.logout(accessToken, body?.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid token' })
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request): Promise<Omit<User, 'passwordHash'>> {
    return req.user;
  }

  private getClientIp(req: Request): string {
    const xForwardedFor = req.get('x-forwarded-for');
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  }
}
```

**Validation**:
- [ ] All authentication endpoints work correctly
- [ ] Input validation prevents invalid data
- [ ] API responses match Spring Boot format
- [ ] Rate limiting is applied correctly
- [ ] Error responses are properly formatted

### Task 2.4: User Management Service and Controllers

**Objective**: Implement user profile management functionality

**Implementation Steps**:

1. **User Service**
```typescript
// src/modules/users/services/user.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { PasswordService } from '../../auth/services/password.service';
import { CacheService } from '../../shared/services/cache.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordService: PasswordService,
    private readonly cacheService: CacheService,
  ) {}

  async findById(userId: string): Promise<User | null> {
    // Try cache first
    const cachedUser = await this.cacheService.getUser(userId);
    if (cachedUser) {
      return cachedUser;
    }

    // Fallback to database
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['household'],
    });

    if (user) {
      await this.cacheService.setUser(user);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();

    // Try cache first
    const cachedUserId = await this.cacheService.getUserByEmail(normalizedEmail);
    if (cachedUserId) {
      return this.findById(cachedUserId);
    }

    // Fallback to database
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail, isActive: true },
      relations: ['household'],
    });

    if (user) {
      await this.cacheService.setUser(user);
    }

    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it's already in use
    if (updateUserDto.email && updateUserDto.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    // Update user fields
    Object.assign(user, updateUserDto);

    if (updateUserDto.email) {
      user.email = updateUserDto.email.toLowerCase().trim();
    }

    const updatedUser = await this.userRepository.save(user);

    // Update cache
    await this.cacheService.setUser(updatedUser);

    return updatedUser;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.passwordService.verifyPassword(
      changePasswordDto.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(changePasswordDto.newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    // Check if new password is different from current
    const isSamePassword = await this.passwordService.verifyPassword(
      changePasswordDto.newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash and update password
    const newPasswordHash = await this.passwordService.hashPassword(changePasswordDto.newPassword);
    user.passwordHash = newPasswordHash;

    await this.userRepository.save(user);

    // Invalidate user cache to force refresh
    await this.cacheService.invalidateUser(user.id, user.email);
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = false;
    await this.userRepository.save(user);

    // Invalidate cache
    await this.cacheService.invalidateUser(user.id, user.email);
  }

  async reactivateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['household'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = true;
    const updatedUser = await this.userRepository.save(user);

    // Update cache
    await this.cacheService.setUser(updatedUser);

    return updatedUser;
  }
}
```

2. **User Controller**
```typescript
// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './services/user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireRole } from '../auth/decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from './entities/user.entity';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: Request): Promise<Omit<User, 'passwordHash'>> {
    return req.user;
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const userId = req.user.id;
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Password changed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid password data' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const userId = req.user.id;
    await this.userService.changePassword(userId, changePasswordDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (parents only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @UseGuards(RolesGuard)
  @RequireRole(UserRole.PARENT)
  async getUserById(@Param('id') id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if requester can access this user (same household)
    const requester = req.user as User;
    if (user.householdId !== requester.householdId) {
      throw new ForbiddenException('Cannot access user from different household');
    }

    return user;
  }
}
```

**Validation**:
- [ ] User profile updates work correctly
- [ ] Password changes validate current password
- [ ] Email changes validate uniqueness
- [ ] User access control works properly
- [ ] Cache invalidation functions correctly

### Task 2.5: Guards and Authorization

**Objective**: Implement JWT authentication and role-based authorization

**Implementation Steps**:

1. **JWT Authentication Guard**
> **Package Documentation**: Based on [@nestjs/passport](https://github.com/nestjs/passport) - Passport integration for NestJS
>
> **Key Features**:
> - Integration with Passport authentication strategies
> - Guard-based route protection
> - Request object decoration with user information
> - Strategy-based authentication (JWT, OAuth, etc.)
> - Custom error handling and response formatting

```typescript
// src/modules/auth/guards/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenService } from '../services/token.service';
import { UserService } from '../../users/services/user.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Validate token
      const tokenValidation = await this.tokenService.validateAccessToken(token);
      if (!tokenValidation.isValid) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get user and attach to request
      const user = await this.userService.validateUser(tokenValidation.payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user and token payload to request
      request.user = user;
      request.tokenPayload = tokenValidation.payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

2. **Roles Guard**
```typescript
// src/modules/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());

    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some(role => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

3. **Ownership Guard**
```typescript
// src/modules/auth/guards/ownership.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireOwnership = this.reflector.get<boolean>('requireOwnership', context.getHandler());

    if (!requireOwnership) {
      return true; // No ownership check required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id || request.params.userId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // User can access their own resources
    if (user.id === resourceId) {
      return true;
    }

    // Parents can access resources of users in their household
    if (user.role === UserRole.PARENT && user.householdId) {
      // Additional logic to check if resource belongs to same household
      return this.checkHouseholdOwnership(user, resourceId, context);
    }

    throw new ForbiddenException('Access denied');
  }

  private checkHouseholdOwnership(user: any, resourceId: string, context: ExecutionContext): boolean {
    // This would depend on the specific resource type
    // For now, return false and implement per resource type
    return false;
  }
}
```

4. **Authorization Decorators**
```typescript
// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// src/modules/auth/decorators/ownership.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'requireOwnership';
export const RequireOwnership = () => SetMetadata(OWNERSHIP_KEY, true);

// src/modules/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Validation**:
- [ ] JWT authentication works correctly
- [ ] Role-based authorization functions properly
- [ ] Ownership validation prevents unauthorized access
- [ ] Public endpoints bypass authentication
- [ ] Error responses are appropriate for auth failures

### Task 2.6: Testing Implementation

**Objective**: Comprehensive testing for authentication system

**Implementation Steps**:

1. **Unit Tests for Auth Service**
```typescript
// test/unit/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/modules/auth/services/auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { Household } from '@/modules/households/entities/household.entity';
import { PasswordService } from '@/modules/auth/services/password.service';
import { TokenService } from '@/modules/auth/services/token.service';
import { AuthRateLimitService } from '@/modules/auth/services/auth-rate-limit.service';
import { Repository } from 'typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let householdRepository: jest.Mocked<Repository<Household>>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;
  let rateLimitService: jest.Mocked<AuthRateLimitService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockHouseholdRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Household),
          useValue: mockHouseholdRepository,
        },
        {
          provide: PasswordService,
          useValue: {
            hashPassword: jest.fn(),
            verifyPassword: jest.fn(),
            validatePasswordStrength: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn(),
          },
        },
        {
          provide: AuthRateLimitService,
          useValue: {
            checkRegistrationRateLimit: jest.fn(),
            checkLoginRateLimit: jest.fn(),
            recordFailedLogin: jest.fn(),
            clearFailedLoginAttempts: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    householdRepository = module.get(getRepositoryToken(Household));
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
    rateLimitService = module.get(AuthRateLimitService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePass123!',
      };

      userRepository.count.mockResolvedValue(0);
      userRepository.findOne.mockResolvedValue(null);
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 5,
        errors: [],
        suggestions: [],
      });
      passwordService.hashPassword.mockResolvedValue('hashedPassword');
      rateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        attempts: 1,
        remaining: 2,
        isBlocked: false,
      });

      const household = { id: 'household-1', name: "John's Household" };
      householdRepository.create.mockReturnValue(household);
      householdRepository.save.mockResolvedValue(household);

      const user = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'parent',
        householdId: 'household-1',
      };
      userRepository.create.mockReturnValue(user);
      userRepository.save.mockResolvedValue(user);

      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.register(registerDto, '127.0.0.1');

      expect(result).toEqual({
        user: expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'parent',
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw error for weak password', async () => {
      const registerDto = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'weak',
      };

      rateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        attempts: 1,
        remaining: 2,
        isBlocked: false,
      });

      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 1,
        errors: ['Password is too weak'],
        suggestions: ['Use a stronger password'],
      });

      await expect(service.register(registerDto, '127.0.0.1')).rejects.toThrow(BadRequestException);
    });

    it('should throw error for existing email', async () => {
      const registerDto = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePass123!',
      };

      rateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        attempts: 1,
        remaining: 2,
        isBlocked: false,
      });

      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 5,
        errors: [],
        suggestions: [],
      });

      userRepository.findOne.mockResolvedValue({ id: 'existing-user' } as User);

      await expect(service.register(registerDto, '127.0.0.1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const user = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        isActive: true,
      };

      rateLimitService.checkLoginRateLimit.mockResolvedValue({
        attempts: 1,
        remaining: 4,
        isBlocked: false,
      });

      userRepository.findOne.mockResolvedValue(user as User);
      passwordService.verifyPassword.mockResolvedValue(true);
      userRepository.save.mockResolvedValue({ ...user, lastLoginAt: new Date() });

      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.login(loginDto, '127.0.0.1');

      expect(result).toEqual({
        user: expect.objectContaining({
          email: 'test@example.com',
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw error for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      rateLimitService.checkLoginRateLimit.mockResolvedValue({
        attempts: 1,
        remaining: 4,
        isBlocked: false,
      });

      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
      } as User);

      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

2. **Integration Tests for Auth Controller**
```typescript
// test/integration/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from '@/modules/auth/auth.module';
import { DatabaseModule } from '@/shared/database/database.module';
import { RedisModule } from '@/shared/redis/redis.module';
import { ConfigModule } from '@/common/config/config.module';

describe('AuthController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        RedisModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePass123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'parent', // First user becomes parent
        }),
      });

      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for invalid data', async () => {
      const invalidDto = {
        email: 'invalid-email',
        firstName: '',
        lastName: '',
        password: 'weak',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com',
        }),
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      const token = loginResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: expect.any(String),
      });

      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });
});
```

**Validation**:
- [ ] Unit tests cover all authentication scenarios
- [ ] Integration tests validate end-to-end flows
- [ ] Test coverage exceeds 95%
- [ ] Security testing validates authentication mechanisms
- [ ] Performance tests meet response time targets

### Performance Validation

#### Load Testing Script
```typescript
// test/performance/auth.load.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';

describe('Authentication Load Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Login Performance', () => {
    it('should handle 100 concurrent login requests within 5 seconds', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const startTime = Date.now();

      const promises = Array(100).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(200)
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should respond to login requests within 150ms', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(150); // 150ms
    });
  });
});
```

## Quality Gates and Validation Criteria

### Functional Validation
- [ ] User registration works with all validation rules
- [ ] User login authenticates correctly and generates tokens
- [ ] Token refresh mechanism works with proper rotation
- [ ] User profile management functions correctly
- [ ] Household management maintains proper relationships
- [ ] Password reset flow is secure and functional
- [ ] All authentication APIs work without frontend changes

### Performance Validation
- [ ] Login response time <150ms
- [ ] Registration response time <200ms
- [ ] Token validation time <20ms
- [ ] All performance targets met under load
- [ ] Database queries optimized

### Security Validation
- [ ] Password hashing meets security standards
- [ ] JWT tokens are secure and properly managed
- [ ] Rate limiting prevents brute force attacks
- [ ] Security scans pass without critical issues
- [ ] Authentication flow prevents common attacks

### Integration Validation
- [ ] Database integration works correctly
- [ ] Redis caching functions properly
- [ ] Email delivery works for verification/reset
- [ ] Frontend compatibility maintained

### Code Quality Validation
- [ ] TypeScript compilation succeeds without errors
- [ ] ESLint passes without warnings
- [ ] Test coverage >95%
- [ ] Code follows clean code principles
- [ ] Documentation is comprehensive

This Phase 2 implementation provides a robust, secure, and high-performance authentication and user management system that maintains complete functional equivalence with the Spring Boot backend while following NestJS best practices and clean code principles.