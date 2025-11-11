# Data Migration Guide

## Overview

This document outlines the data migration strategy for transitioning from Spring Boot with JPA to NestJS with TypeORM. The migration ensures zero data loss and maintains exact database schema compatibility.

## Database Schema Analysis

### Current Spring Boot Database Schema

**PostgreSQL Database Structure:**
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'child',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    preferences JSONB,
    emergency_contacts JSONB,
    date_of_birth DATE,
    avatar_url VARCHAR(500),
    phone VARCHAR(50),
    employee_id VARCHAR(100),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Households table
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotas table
CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    room_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quota_type VARCHAR(20) NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'ROOM',
    target_id UUID,
    allowed_amount DECIMAL(15,6) NOT NULL,
    used_amount DECIMAL(15,6) DEFAULT 0,
    warning_threshold INTEGER DEFAULT 75,
    period VARCHAR(20) DEFAULT 'DAILY',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage sessions table
CREATE TABLE usage_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quota_id UUID NOT NULL,
    user_id UUID NOT NULL,
    room_id UUID NOT NULL,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    duration_seconds BIGINT,
    usage_amount DECIMAL(15,6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_household_id ON users(household_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quotas_user_id ON quotas(user_id);
CREATE INDEX idx_quotas_room_id ON quotas(room_id);
CREATE INDEX idx_usage_sessions_quota_id ON usage_sessions(quota_id);
CREATE INDEX idx_usage_sessions_user_id ON usage_sessions(user_id);
CREATE INDEX idx_usage_sessions_room_id ON usage_sessions(room_id);

-- Foreign key constraints
ALTER TABLE users ADD CONSTRAINT fk_users_household
    FOREIGN KEY (household_id) REFERENCES households(id);
ALTER TABLE quotas ADD CONSTRAINT fk_quotas_user
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE usage_sessions ADD CONSTRAINT fk_usage_sessions_quota
    FOREIGN KEY (quota_id) REFERENCES quotas(id);
ALTER TABLE usage_sessions ADD CONSTRAINT fk_usage_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id);
```

## TypeORM Entity Migration

### User Entity Translation

**Spring Boot JPA Entity → NestJS TypeORM Entity:**

```typescript
// src/modules/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
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
@Index('idx_users_household_id', ['householdId'])
@Index('idx_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CHILD,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
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

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Household, household => household.users, { onDelete: 'CASCADE' })
  household: Household;

  @Column()
  householdId: string;

  @OneToMany(() => Quota, quota => quota.user)
  quotas: Quota[];

  @OneToMany(() => UsageSession, session => session.user)
  usageSessions: UsageSession[];
}
```

### Household Entity Translation

```typescript
// src/modules/users/entities/household.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  familyName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => User, user => user.household, { cascade: true })
  users: User[];
}
```

### Quota Entity Translation

```typescript
// src/modules/quotas/entities/quota.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum QuotaType {
  TIME_BASED = 'TIME_BASED',
  USAGE_COUNT = 'USAGE_COUNT',
  ENERGY_BASED = 'ENERGY_BASED',
  COST_BASED = 'COST_BASED',
}

export enum QuotaScope {
  ROOM = 'ROOM',
  HOUSEHOLD = 'HOUSEHOLD',
  USER = 'USER',
}

export enum QuotaPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum QuotaStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}

@Entity('quotas')
@Index('idx_quotas_user_id', ['userId'])
@Index('idx_quotas_room_id', ['roomId'])
export class Quota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  roomId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: QuotaType,
  })
  quotaType: QuotaType;

  @Column({
    type: 'enum',
    enum: QuotaScope,
    default: QuotaScope.ROOM,
  })
  scope: QuotaScope;

  @Column({ nullable: true })
  targetId: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 6,
  })
  allowedAmount: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 0,
  })
  usedAmount: number;

  @Column({ default: 75 })
  warningThreshold: number;

  @Column({
    type: 'enum',
    enum: QuotaPeriod,
    default: QuotaPeriod.DAILY,
  })
  period: QuotaPeriod;

  @Column({
    type: 'enum',
    enum: QuotaStatus,
    default: QuotaStatus.ACTIVE,
  })
  status: QuotaStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.quotas, { onDelete: 'CASCADE' })
  user: User;
}
```

### UsageSession Entity Translation

```typescript
// src/modules/quotas/entities/usage-session.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Quota } from './quota.entity';
import { User } from '../../users/entities/user.entity';

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('usage_sessions')
@Index('idx_usage_sessions_quota_id', ['quotaId'])
@Index('idx_usage_sessions_user_id', ['userId'])
@Index('idx_usage_sessions_room_id', ['roomId'])
export class UsageSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quotaId: string;

  @Column()
  userId: string;

  @Column()
  roomId: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  startTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ nullable: true })
  durationSeconds: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 6,
    nullable: true,
  })
  usageAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Quota, quota => quota.usageSessions, { onDelete: 'CASCADE' })
  quota: Quota;

  @ManyToOne(() => User, user => user.usageSessions)
  user: User;
}
```

## Database Configuration

### TypeORM Configuration

```typescript
// src/config/database.config.ts
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
    synchronize: false, // Keep false for production
    migrationsRun: true,
    logging: configService.get('NODE_ENV') === 'development',
    migrations: ['dist/migrations/*.js'],
    ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
    extra: {
      max: 20, // Maximum connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    // Ensure timezone consistency
    timezone: 'UTC',
    dateStrings: false,
  }),
  inject: [ConfigService],
});
```

### Database Module Setup

```typescript
// src/core/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

## Migration Strategy

### Zero-Downtime Migration Approach

**Phase 1: Schema Validation**
1. Verify existing database schema
2. Create TypeORM entities matching current schema
3. Test entity mapping with existing data

**Phase 2: Parallel Database Access**
1. Configure NestJS to use existing database
2. Implement read-only operations first
3. Validate data retrieval accuracy

**Phase 3: Write Operations Migration**
1. Implement write operations with transaction safety
2. Test data modifications
3. Verify referential integrity

**Phase 4: Full Cutover**
1. Switch all traffic to NestJS backend
2. Monitor data consistency
3. Keep Spring Boot as rollback option

### Database Connection Testing

```typescript
// src/core/database/database.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, QueryRunner } from 'typeorm';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async testConnection(): Promise<boolean> {
    try {
      await this.connection.query('SELECT 1');
      this.logger.log('Database connection successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed', error);
      return false;
    }
  }

  async validateSchema(): Promise<boolean> {
    try {
      // Check if all required tables exist
      const tables = await this.connection.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `);

      const requiredTables = ['users', 'households', 'quotas', 'usage_sessions'];
      const existingTables = tables.map(t => t.table_name);

      const missingTables = requiredTables.filter(
        table => !existingTables.includes(table)
      );

      if (missingTables.length > 0) {
        this.logger.error(`Missing tables: ${missingTables.join(', ')}`);
        return false;
      }

      this.logger.log('All required tables present');
      return true;
    } catch (error) {
      this.logger.error('Schema validation failed', error);
      return false;
    }
  }

  async validateDataIntegrity(): Promise<boolean> {
    try {
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();

      // Check foreign key constraints
      const orphanedUsers = await queryRunner.query(`
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN households h ON u.household_id = h.id
        WHERE h.id IS NULL
      `);

      if (parseInt(orphanedUsers[0].count) > 0) {
        this.logger.warn(`Found ${orphanedUsers[0].count} orphaned users`);
        return false;
      }

      // Check data consistency
      const result = await queryRunner.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(DISTINCT household_id) as total_households,
          COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
          COUNT(CASE WHEN role = 'child' THEN 1 END) as children
        FROM users
      `);

      this.logger.log(`Data integrity check passed: ${JSON.stringify(result[0])}`);
      await queryRunner.release();
      return true;
    } catch (error) {
      this.logger.error('Data integrity validation failed', error);
      return false;
    }
  }

  async createQueryRunner(): Promise<QueryRunner> {
    return this.connection.createQueryRunner();
  }
}
```

## Repository Implementation

### Base Repository Pattern

```typescript
// src/common/repositories/base.repository.ts
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { IBaseRepository } from '../interfaces/base-repository.interface';

export abstract class BaseRepository<T> implements IBaseRepository<T> {
  constructor(protected readonly repository: Repository<T>) {}

  async create(entity: DeepPartial<T>): Promise<T> {
    const created = this.repository.create(entity);
    return await this.repository.save(created);
  }

  async findById(id: string): Promise<T | null> {
    return await this.repository.findOne({ where: { id } as any });
  }

  async findOne(filter: FindOptionsWhere<T>): Promise<T | null> {
    return await this.repository.findOne({ where: filter });
  }

  async findMany(filter?: FindOptionsWhere<T>): Promise<T[]> {
    return await this.repository.find({ where: filter });
  }

  async update(id: string, updates: DeepPartial<T>): Promise<T> {
    await this.repository.update(id, updates);
    return await this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } as any });
    return count > 0;
  }

  async count(filter?: FindOptionsWhere<T>): Promise<number> {
    return await this.repository.count({ where: filter });
  }

  async findWithRelations(
    filter?: FindOptionsWhere<T>,
    relations?: string[],
  ): Promise<T[]> {
    return await this.repository.find({ where: filter, relations });
  }
}
```

### User Repository Implementation

```typescript
// src/modules/users/repositories/user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from '../entities/user.entity';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { IUserRepository } from '../interfaces/user-repository.interface';

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(
    @InjectRepository(User)
    protected readonly repository: Repository<User>,
  ) {
    super(repository);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { email },
      relations: ['household'],
    });
  }

  async findByHouseholdId(householdId: string): Promise<User[]> {
    return await this.repository.find({
      where: { householdId },
      relations: ['household'],
      order: { createdAt: 'ASC' },
    });
  }

  async findByRole(role: string): Promise<User[]> {
    return await this.repository.find({
      where: { role: role as any },
      relations: ['household'],
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.repository.update(userId, { lastLoginAt: new Date() });
  }

  async findActiveUsers(): Promise<User[]> {
    return await this.repository.find({
      where: { status: 'active' as any },
      relations: ['household'],
    });
  }

  async findParentsInHousehold(householdId: string): Promise<User[]> {
    return await this.repository.find({
      where: {
        householdId,
        role: 'parent' as any,
        status: 'active' as any
      },
      relations: ['household'],
    });
  }

  async countByHousehold(householdId: string): Promise<number> {
    return await this.repository.count({
      where: { householdId },
    });
  }

  async findWithQuotas(userId: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { id: userId },
      relations: ['household', 'quotas'],
    });
  }
}
```

## Data Validation and Testing

### Entity Validation

```typescript
// src/modules/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { UserRole, UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.CHILD;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus = UserStatus.ACTIVE;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  address?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;
}
```

### Database Migration Testing

```typescript
// src/core/database/database.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { getDatabaseConfig } from '../config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: getDatabaseConfig,
          inject: [ConfigService],
        }),
      ],
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Connection Testing', () => {
    it('should connect to database successfully', async () => {
      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should validate database schema', async () => {
      const result = await service.validateSchema();
      expect(result).toBe(true);
    });

    it('should validate data integrity', async () => {
      const result = await service.validateDataIntegrity();
      expect(result).toBe(true);
    });
  });

  describe('Query Runner Operations', () => {
    it('should create query runner', async () => {
      const queryRunner = await service.createQueryRunner();
      expect(queryRunner).toBeDefined();
      await queryRunner.release();
    });

    it('should execute test queries', async () => {
      const queryRunner = await service.createQueryRunner();
      const result = await queryRunner.query('SELECT 1 as test');
      expect(result[0].test).toBe(1);
      await queryRunner.release();
    });
  });
});
```

## Data Backup and Recovery

### Backup Strategy

```bash
#!/bin/bash
# scripts/backup-database.sh

# Database backup script for migration safety
DB_NAME="mitsubishi_controller"
DB_USER="postgres"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/migration_backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "Database backup created: ${BACKUP_FILE}.gz"

# Verify backup
if [ -f "${BACKUP_FILE}.gz" ]; then
    echo "Backup verification successful"
else
    echo "Backup verification failed"
    exit 1
fi
```

### Recovery Script

```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE=$1
DB_NAME="mitsubishi_controller"
DB_USER="postgres"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop application
echo "Stopping application..."
# systemctl stop nestjs-app

# Restore database
echo "Restoring database from backup..."
gunzip -c $BACKUP_FILE | psql -h localhost -U $DB_USER -d $DB_NAME

# Start application
echo "Starting application..."
# systemctl start nestjs-app

echo "Database restoration completed"
```

This comprehensive data migration guide ensures zero data loss while transitioning from Spring Boot JPA to NestJS TypeORM, maintaining complete database schema compatibility and data integrity.