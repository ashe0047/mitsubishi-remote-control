# Phase 2: Authentication and User Management - Technical Design Document

## System Architecture Overview

### Authentication Module Architecture
The authentication system follows a layered architecture with clear separation of concerns:

```
Authentication Layer Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Controllers Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ AuthController  │  │ UserController   │  │HouseholdCtrl │ │
│  │ - login/register│  │ - profile CRUD  │  │ - member mgmt│ │
│  │ - token refresh │  │ - password mgmt │  │ - settings   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ AuthService     │  │ UserService     │  │HouseholdSvc  │ │
│  │ - JWT logic     │  │ - user mgmt     │  │ - member mgmt│ │
│  │ - validation    │  │ - profile ops   │  │ - household  │ │
│  │ - security      │  │ - password ops  │  │ - settings   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  Repository Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ AuthRepository  │  │ UserRepository   │  │HouseholdRepo │ │
│  │ - token storage │  │ - user CRUD     │  │ - household  │ │
│  │ - sessions      │  │ - queries       │  │ - members    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Database      │  │     Redis       │  │     Email     │ │
│  │ - PostgreSQL    │  │ - Sessions      │  │ - SMTP/3rdPty │ │
│  │ - TypeORM       │  │ - Cache         │  │ - Templates   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Clean Code Principles Analysis

### DRY (Don't Repeat Yourself) Implementation

**Current Duplication Risks Identified**:
- Validation logic across registration, login, and profile updates
- Error handling patterns in authentication flows
- JWT token creation and validation logic
- Password hashing and verification routines
- Database query patterns for user operations

**DRY Solutions Design**:

1. **Shared Validation Pipelines**
```typescript
// Common validation schemas for user data
export const UserValidationSchemas = {
  registration: Joi.object({...}),
  login: Joi.object({...}),
  profileUpdate: Joi.object({...}),
  passwordChange: Joi.object({...}),
};
```

2. **Authentication Service Factory**
```typescript
// Centralized authentication logic factory
export class AuthenticationFactory {
  static createAuthService(strategy: AuthStrategy): AuthService {
    return new AuthService(strategy);
  }
}
```

3. **Common Error Handler**
```typescript
// Centralized authentication error handling
export class AuthErrorHandler {
  static handle(error: AuthError): StandardizedErrorResponse {
    // Standardized error response format
  }
}
```

### SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
**Module Separation**:
- **AuthModule**: Handles authentication (login, register, tokens)
- **UserModule**: Manages user profiles and operations
- **HouseholdModule**: Manages households and member relationships
- **AuthorizationModule**: Handles role-based access control

#### Open/Closed Principle (OCP)
**Extension Strategy**:
- **Authentication Strategies**: Interface for different auth methods
- **Password Policies**: Extensible password validation rules
- **Role Providers**: Extensible role assignment logic
- **Notification Providers**: Multiple email/SMS providers

#### Liskov Substitution Principle (LSP)
**Inheritance Design**:
- **BaseUser**: Common user properties and methods
- **ParentUser**: Extended user with household management
- **ChildUser**: Restricted user with limited permissions
- **AuthStrategy**: Interchangeable authentication methods

#### Interface Segregation Principle (ISP)
**Focused Interfaces**:
- **IAuthService**: Authentication operations only
- **IUserService**: User profile operations only
- **IHouseholdService**: Household operations only
- **ITokenService**: Token operations only

#### Dependency Inversion Principle (DIP)
**Dependency Management**:
- Services depend on interfaces, not concrete implementations
- Repository pattern for data access abstraction
- Configuration injection for external dependencies
- Provider pattern for service instantiation

### YAGNI (You Ain't Gonna Need It) Implementation

**Implementation Boundaries**:
- Implement only current authentication requirements
- Avoid multi-factor authentication unless specified
- Skip social login integration unless required
- Minimal role system (parent/child) only
- Basic email templates for verification/reset

## Design Pattern Analysis and Selection

### Authentication Pattern Selection Matrix

| Pattern | Complexity | Security | Maintainability | Performance | Extensibility | Score | Decision |
|---------|------------|----------|-----------------|-------------|---------------|-------|----------|
| Strategy | 3 | 5 | 4 | 4 | 5 | 4.2 | ✅ Adopt |
| Repository | 2 | 4 | 5 | 5 | 3 | 3.8 | ✅ Adopt |
| Factory | 3 | 4 | 4 | 3 | 5 | 3.8 | ✅ Adopt |
| Observer | 3 | 3 | 4 | 4 | 4 | 3.6 | ✅ Adopt |
| Decorator | 2 | 5 | 4 | 4 | 4 | 3.8 | ✅ Adopt |
| Facade | 2 | 3 | 5 | 5 | 2 | 3.4 | ✅ Adopt |
| Proxy | 4 | 5 | 3 | 3 | 4 | 3.8 | ✅ Adopt |
| Command | 4 | 3 | 4 | 3 | 4 | 3.6 | ✅ Adopt |

### Selected Design Patterns Implementation

#### 1. Strategy Pattern - Authentication Strategies
**Purpose**: Support different authentication methods
**Implementation**:
```typescript
interface AuthStrategy {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validate(token: string): Promise<TokenValidation>;
  refresh(refreshToken: string): Promise<TokenRefreshResult>;
}

class JWTStrategy implements AuthStrategy {
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    // JWT-based authentication implementation
  }
}

class AuthStrategyFactory {
  static create(type: AuthType): AuthStrategy {
    switch (type) {
      case 'JWT': return new JWTStrategy();
      // Future: OAuth, SAML, etc.
      default: throw new Error('Unsupported auth type');
    }
  }
}
```

#### 2. Repository Pattern - Data Access Abstraction
**Purpose**: Clean separation between business logic and data access
**Implementation**:
```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(userData: CreateUserDto): Promise<User>;
  update(id: string, updates: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}

@EntityRepository(User)
export class UserRepository extends Repository<User> implements IUserRepository {
  async findByEmailWithHousehold(email: string): Promise<User | null> {
    return this.createQueryBuilder('user')
      .leftJoinAndSelect('user.household', 'household')
      .where('user.email = :email', { email })
      .getOne();
  }
}
```

#### 3. Factory Pattern - Object Creation
**Purpose**: Centralized object creation with proper initialization
**Implementation**:
```typescript
export class UserFactory {
  static create(userData: CreateUserDto, householdId: string): User {
    const user = new User();
    user.email = userData.email;
    user.firstName = userData.firstName;
    user.lastName = userData.lastName;
    user.householdId = householdId;
    user.role = userData.role || UserRole.CHILD;
    user.isActive = true;
    user.createdAt = new Date();
    user.updatedAt = new Date();
    return user;
  }

  static createHousehold(householdData: CreateHouseholdDto): Household {
    const household = new Household();
    household.name = householdData.name;
    household.createdAt = new Date();
    household.updatedAt = new Date();
    return household;
  }
}
```

#### 4. Observer Pattern - Authentication Events
**Purpose**: Event-driven logging and monitoring
**Implementation**:
```typescript
interface AuthEventObserver {
  onLoginSuccess(user: User, context: AuthContext): void;
  onLoginFailure(email: string, reason: string): void;
  onRegistration(user: User): void;
  onPasswordReset(user: User): void;
}

export class AuthEventEmitter {
  private observers: AuthEventObserver[] = [];

  subscribe(observer: AuthEventObserver): void {
    this.observers.push(observer);
  }

  emitLoginSuccess(user: User, context: AuthContext): void {
    this.observers.forEach(observer => observer.onLoginSuccess(user, context));
  }
}
```

#### 5. Decorator Pattern - Authorization
**Purpose**: Declarative authorization for endpoints
**Implementation**:
```typescript
export const RequireRole = (...roles: UserRole[]) =>
  SetMetadata('roles', roles);

export const RequireOwnership = () =>
  SetMetadata('requireOwnership', true);

export const RequireHouseholdMembership = () =>
  SetMetadata('requireHouseholdMembership', true);

@Injectable()
export class AuthorizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    const requireOwnership = this.reflector.get<boolean>('requireOwnership', context.getHandler());

    // Authorization logic implementation
  }
}
```

## Module Architecture Design

### Authentication Module Structure

```
src/modules/auth/
├── auth.module.ts                 # Authentication module definition
├── auth.controller.ts             # Authentication endpoints
├── auth.service.ts                # Authentication business logic
├── strategies/                    # Authentication strategies
│   ├── jwt.strategy.ts           # JWT authentication strategy
│   ├── auth-strategy.interface.ts # Strategy interface
│   └── auth-strategy.factory.ts  # Strategy factory
├── guards/                        # Authentication guards
│   ├── jwt-auth.guard.ts         # JWT validation guard
│   ├── api-key.guard.ts          # API key guard (future)
│   └── rate-limit.guard.ts       # Rate limiting guard
├── decorators/                    # Authorization decorators
│   ├── roles.decorator.ts        # Role-based authorization
│   ├── ownership.decorator.ts    # Resource ownership
│   └── public.decorator.ts       # Public endpoint marker
├── dto/                          # Data transfer objects
│   ├── login.dto.ts              # Login request/response
│   ├── register.dto.ts           # Registration request/response
│   ├── refresh-token.dto.ts      # Token refresh request/response
│   └── auth-types.dto.ts         # Common auth types
├── interfaces/                   # TypeScript interfaces
│   ├── auth.interface.ts         # Authentication interfaces
│   ├── user.interface.ts         # User interfaces
│   └── token.interface.ts        # Token interfaces
└── exceptions/                   # Custom exceptions
    ├── auth.exception.ts         # Authentication exceptions
    └── user.exception.ts         # User-related exceptions
```

### User Management Module Structure

```
src/modules/users/
├── users.module.ts               # User management module
├── users.controller.ts           # User management endpoints
├── users.service.ts              # User management business logic
├── entities/                     # Database entities
│   ├── user.entity.ts           # User entity definition
│   └── user-profile.entity.ts   # User profile entity
├── repositories/                 # Data access layer
│   ├── user.repository.ts       # User repository
│   └── user-profile.repository.ts # Profile repository
├── dto/                         # Data transfer objects
│   ├── create-user.dto.ts       # User creation
│   ├── update-user.dto.ts       # User updates
│   ├── change-password.dto.ts   # Password change
│   └── user-profile.dto.ts      # Profile data
├── validators/                  # Custom validators
│   ├── email.validator.ts       # Email validation
│   ├── password.validator.ts    # Password strength
│   └── user-validator.ts        # User data validation
└── events/                      # User events
    ├── user-created.event.ts    # User creation events
    └── user-updated.event.ts    # User update events
```

### Household Management Module Structure

```
src/modules/households/
├── households.module.ts          # Household module
├── households.controller.ts      # Household endpoints
├── households.service.ts         # Household business logic
├── entities/                     # Database entities
│   ├── household.entity.ts      # Household entity
│   └── household-member.entity.ts # Member relationship
├── repositories/                 # Data access layer
│   ├── household.repository.ts  # Household repository
│   └── household-member.repository.ts # Member repository
├── dto/                         # Data transfer objects
│   ├── create-household.dto.ts  # Household creation
│   ├── update-household.dto.ts  # Household updates
│   ├── add-member.dto.ts        # Member addition
│   └── member-role.dto.ts       # Role management
├── services/                    # Specialized services
│   ├── member-management.service.ts # Member operations
│   └── household-permissions.service.ts # Permission logic
└── policies/                    # Authorization policies
    ├── household-policy.ts      # Household access policies
    └── member-policy.ts         # Member management policies
```

## Security Architecture Design

### Authentication Security Implementation

#### 1. Password Security
```typescript
@Injectable()
export class PasswordService {
  private readonly saltRounds = 12; // Production: 12 rounds

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password: string): PasswordValidationResult {
    // Strong password validation logic
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      score: this.calculatePasswordScore(password),
      suggestions: this.getPasswordSuggestions(password)
    };
  }
}
```

#### 2. JWT Token Management
```typescript
@Injectable()
export class TokenService {
  constructor(
    @Inject('JWT_SECRET') private readonly jwtSecret: string,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async generateTokenPair(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    // Store refresh token in Redis with TTL
    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  async validateAccessToken(token: string): Promise<TokenValidation> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token is blacklisted');
      }

      return { isValid: true, payload };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Validate refresh token from Redis
    const storedToken = await this.getStoredRefreshToken(refreshToken);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = jwt.verify(refreshToken, this.jwtSecret) as JWTPayload;

    // Generate new token pair
    const newTokens = await this.generateTokenPair(payload as User);

    // Invalidate old refresh token
    await this.invalidateRefreshToken(refreshToken);

    return newTokens;
  }
}
```

#### 3. Rate Limiting Implementation
```typescript
@Injectable()
export class AuthRateLimitService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async checkLoginRateLimit(email: string, ip: string): Promise<RateLimitResult> {
    const key = `auth:login:${email}:${ip}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }

    const maxAttempts = 5;
    const isBlocked = attempts > maxAttempts;

    if (isBlocked) {
      await this.redis.expire(key, 3600); // Extend to 1 hour
    }

    return {
      attempts,
      remaining: Math.max(0, maxAttempts - attempts),
      isBlocked,
      retryAfter: isBlocked ? 3600 : 0,
    };
  }

  async checkRegistrationRateLimit(ip: string): Promise<RateLimitResult> {
    const key = `auth:register:${ip}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, 3600); // 1 hour
    }

    const maxAttempts = 3;
    const isBlocked = attempts > maxAttempts;

    return {
      attempts,
      remaining: Math.max(0, maxAttempts - attempts),
      isBlocked,
      retryAfter: isBlocked ? 3600 : 0,
    };
  }
}
```

### Authorization Architecture

#### 1. Role-Based Access Control (RBAC)
```typescript
export enum UserRole {
  PARENT = 'parent',
  CHILD = 'child',
}

export enum Permission {
  // Household permissions
  MANAGE_HOUSEHOLD = 'manage_household',
  VIEW_HOUSEHOLD = 'view_household',
  ADD_MEMBERS = 'add_members',
  REMOVE_MEMBERS = 'remove_members',

  // User permissions
  MANAGE_PROFILE = 'manage_profile',
  VIEW_PROFILE = 'view_profile',
  CHANGE_PASSWORD = 'change_password',

  // Device permissions
  CONTROL_DEVICES = 'control_devices',
  VIEW_DEVICES = 'view_devices',
}

@Injectable()
export class PermissionService {
  private readonly rolePermissions = new Map<UserRole, Permission[]>([
    [UserRole.PARENT, [
      Permission.MANAGE_HOUSEHOLD,
      Permission.VIEW_HOUSEHOLD,
      Permission.ADD_MEMBERS,
      Permission.REMOVE_MEMBERS,
      Permission.MANAGE_PROFILE,
      Permission.VIEW_PROFILE,
      Permission.CHANGE_PASSWORD,
      Permission.CONTROL_DEVICES,
      Permission.VIEW_DEVICES,
    ]],
    [UserRole.CHILD, [
      Permission.VIEW_HOUSEHOLD,
      Permission.MANAGE_PROFILE,
      Permission.VIEW_PROFILE,
      Permission.CHANGE_PASSWORD,
      Permission.CONTROL_DEVICES,
      Permission.VIEW_DEVICES,
    ]],
  ]);

  hasPermission(userRole: UserRole, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(userRole) || [];
    return permissions.includes(permission);
  }

  getUserPermissions(userRole: UserRole): Permission[] {
    return this.rolePermissions.get(userRole) || [];
  }
}
```

#### 2. Authorization Guards
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return requiredRoles.some(role => user.role === role);
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[]>('permissions', context.getHandler());
    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return requiredPermissions.every(permission =>
      this.permissionService.hasPermission(user.role, permission)
    );
  }
}
```

## Data Architecture Design

### Database Schema Design

#### User Entity
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CHILD,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Household, household => household.members, { nullable: true })
  household: Household;

  @Column({ nullable: true })
  householdId: string;

  @OneToMany(() => UserSession, session => session.user)
  sessions: UserSession[];
}
```

#### Household Entity
```typescript
@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => User, user => user.household)
  members: User[];

  @OneToMany(() => Room, room => room.household)
  rooms: Room[];
}
```

### Caching Strategy Design

#### Redis Caching Implementation
```typescript
@Injectable()
export class UserCacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private getUserKey(userId: string): string {
    return `user:${userId}`;
  }

  private getUserByEmailKey(email: string): string {
    return `user:email:${email}`;
  }

  async cacheUser(user: User, ttl: number = 3600): Promise<void> {
    const userKey = this.getUserKey(user.id);
    const emailKey = this.getUserByEmailKey(user.email);

    const userJson = JSON.stringify(user);

    await Promise.all([
      this.redis.setex(userKey, ttl, userJson),
      this.redis.setex(emailKey, ttl, user.id),
    ]);
  }

  async getCachedUser(userId: string): Promise<User | null> {
    const userKey = this.getUserKey(userId);
    const userJson = await this.redis.get(userKey);

    if (!userJson) {
      return null;
    }

    return JSON.parse(userJson) as User;
  }

  async getCachedUserByEmail(email: string): Promise<string | null> {
    const emailKey = this.getUserByEmailKey(email);
    return this.redis.get(emailKey);
  }

  async invalidateUserCache(userId: string, email: string): Promise<void> {
    const userKey = this.getUserKey(userId);
    const emailKey = this.getUserByEmailKey(email);

    await Promise.all([
      this.redis.del(userKey),
      this.redis.del(emailKey),
    ]);
  }
}
```

## Performance Architecture Design

### Database Optimization Strategies

#### 1. Query Optimization
```typescript
@Injectable()
export class UserRepository extends Repository<User> {
  // Optimized user lookup with household
  async findByIdWithHousehold(userId: string): Promise<User | null> {
    return this.createQueryBuilder('user')
      .leftJoinAndSelect('user.household', 'household')
      .where('user.id = :userId', { userId })
      .cache(300) // Cache for 5 minutes
      .getOne();
  }

  // Optimized batch user operations
  async findByIds(userIds: string[]): Promise<User[]> {
    return this.createQueryBuilder('user')
      .where('user.id IN (:...userIds)', { userIds })
      .cache(300)
      .getMany();
  }

  // Optimized user search
  async searchUsers(query: string, householdId: string, limit: number = 10): Promise<User[]> {
    return this.createQueryBuilder('user')
      .where('user.householdId = :householdId', { householdId })
      .andWhere(
        '(user.firstName ILIKE :query OR user.lastName ILIKE :query OR user.email ILIKE :query)',
        { query: `%${query}%` }
      )
      .limit(limit)
      .cache(180)
      .getMany();
  }
}
```

#### 2. Connection Pool Optimization
```typescript
// TypeORM configuration for optimal performance
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [User, Household, /* other entities */],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // Connection pooling optimization
  extra: {
    max: 20, // Maximum number of connections in pool
    min: 5,  // Minimum number of connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  // Migration configuration
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true,
};
```

### API Response Optimization

#### 1. Response Caching
```typescript
@Injectable()
export class AuthCacheInterceptor implements NestInterceptor {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `auth:${request.method}:${request.url}:${request.user?.id || 'anonymous'}`;

    // Check cache first
    const cachedResponse = await this.redis.get(cacheKey);
    if (cachedResponse) {
      return of(JSON.parse(cachedResponse));
    }

    // Execute and cache response
    return next.handle().pipe(
      tap(async (response) => {
        await this.redis.setex(cacheKey, 300, JSON.stringify(response)); // 5 minutes cache
      })
    );
  }
}
```

#### 2. Pagination and Filtering
```typescript
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

@Injectable()
export class UserService {
  async getUsers(query: GetUsersDto): Promise<PaginatedResult<User>> {
    const { page, limit, search, householdId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.household', 'household')
      .skip(skip)
      .take(limit);

    if (householdId) {
      queryBuilder.andWhere('user.householdId = :householdId', { householdId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
```

## Error Handling Architecture

### Authentication Error Hierarchy
```typescript
export class AuthException extends HttpException {
  constructor(message: string, statusCode: HttpStatus, code?: string) {
    super({ message, code }, statusCode);
  }
}

export class InvalidCredentialsException extends AuthException {
  constructor() {
    super('Invalid email or password', HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
  }
}

export class AccountLockedException extends AuthException {
  constructor(retryAfter?: number) {
    super('Account is temporarily locked', HttpStatus.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');
  }
}

export class TokenExpiredException extends AuthException {
  constructor() {
    super('Token has expired', HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenException extends AuthException {
  constructor() {
    super('Invalid token', HttpStatus.UNAUTHORIZED, 'INVALID_TOKEN');
  }
}
```

### Global Error Filter
```typescript
@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let code: string;

    if (exception instanceof AuthException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message;
      code = exceptionResponse.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = 'HTTP_ERROR';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      code = 'INTERNAL_ERROR';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      code,
    };

    // Log authentication errors
    if (status >= 400 && status < 500) {
      this.logger.warn(`Authentication error: ${message}`, {
        path: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.get('user-agent'),
      });
    } else {
      this.logger.error(`Server error: ${message}`, exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json(errorResponse);
  }
}
```

## Testing Architecture Design

### Unit Testing Strategy
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let passwordService: jest.Mocked<PasswordService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn(),
            validateAccessToken: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            verifyPassword: jest.fn(),
            hashPassword: jest.fn(),
            validatePasswordStrength: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    tokenService = module.get(TokenService);
    passwordService = module.get(PasswordService);
  });

  describe('login', () => {
    it('should authenticate user with valid credentials', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const user = { id: '1', email: 'test@example.com', passwordHash: 'hashedPassword' };

      userRepository.findByEmail.mockResolvedValue(user as User);
      passwordService.verifyPassword.mockResolvedValue(true);
      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({ email: 'test@example.com' }),
      });
    });

    it('should throw InvalidCredentialsException for invalid credentials', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrong-password' };
      const user = { id: '1', email: 'test@example.com', passwordHash: 'hashedPassword' };

      userRepository.findByEmail.mockResolvedValue(user as User);
      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsException);
    });
  });
});
```

This comprehensive technical design for Phase 2 provides a robust, secure, and maintainable authentication and user management system that follows clean code principles and NestJS best practices.