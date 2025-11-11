import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash, compare } from 'bcrypt-ts';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlerService } from '../../shared/errors/services/error-handler.service';
import { DatabaseException } from '../../shared/errors/exceptions/infrastructure.exception';
import { UserRole, UserStatus } from '../enums/access.enums';

/**
 * Common users service for internal operations.
 *
 * This service provides core user management functionality used by other services
 * like auth, households, etc. Functions return raw User entities and do not
 * apply DTO transformations since they're used internally.
 */
@Injectable()
export class UsersCommonService {
  private readonly logger = new Logger(UsersCommonService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  /**
   * Create a new user with household and role (matches Spring Boot exactly)
   *
   * @param dto User creation data with household and role
   * @returns Created user entity
   */
  async createWithHousehold(
    dto: CreateUserDto & { householdId: string; role: UserRole },
  ): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const rounds = this.config.get<number>('security.bcryptRounds', 12);
    let passwordHash: string;
    try {
      passwordHash = await hash(dto.password, rounds);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'password_hashing',
        email: dto.email,
        rounds,
      });

      this.logger.error('Failed to hash password', errorMessage, errorContext);
      throw new DatabaseException(
        'user_password_hashing',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }

    const entity = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: dto.role,
      householdId: dto.householdId,
      status: UserStatus.ACTIVE, // Match Spring Boot - always ACTIVE on creation
    });
    return await this.usersRepo.save(entity);
  }

  /**
   * Create a new user with default role and household
   *
   * @param dto User creation data
   * @returns Created user entity
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');
    const rounds = this.config.get<number>('security.bcryptRounds', 12);
    let passwordHash: string;
    try {
      passwordHash = await hash(dto.password, rounds);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'password_hashing',
        email: dto.email,
        rounds,
      });

      this.logger.error('Failed to hash password', errorMessage, errorContext);
      throw new DatabaseException(
        'user_password_hashing',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }
    // For now, create a default household for new users
    // TODO: This should be handled by household creation/joining logic
    const defaultHouseholdId = '00000000-0000-0000-0000-000000000000';

    const entity = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: UserRole.PARENT,
      householdId: defaultHouseholdId,
    });
    return await this.usersRepo.save(entity);
  }

  /**
   * Update user's household association and role
   *
   * @param userId User ID to update
   * @param householdId New household ID
   * @param role New user role
   */
  async updateHouseholdAndRole(
    userId: string,
    householdId: string,
    role: UserRole,
  ): Promise<void> {
    await this.usersRepo.update(userId, {
      householdId,
      role,
    });
  }

  /**
   * List all users in a household
   *
   * @param householdId Household ID to search
   * @returns Array of users in the household
   */
  async listByHousehold(householdId: string): Promise<User[]> {
    return await this.usersRepo.find({
      where: { householdId },
      order: { createdAt: 'ASC' },
      select: ['id', 'email', 'name', 'role', 'createdAt'],
    });
  }

  /**
   * Find user by email address
   *
   * @param email Email address to search
   * @returns User entity or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  /**
   * Find user by ID (throws if not found)
   *
   * @param id User ID to search
   * @returns User entity
   * @throws NotFoundException if user not found
   */
  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Validate password against user's hash
   *
   * @param password Plain text password
   * @param hash Password hash to compare against
   * @returns True if password matches
   */
  async validatePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await compare(password, hash);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'password_validation',
      });

      this.logger.error(
        'Failed to validate password',
        errorMessage,
        errorContext,
      );
      throw new DatabaseException(
        'password_validation',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Update user's last login timestamp
   *
   * @param id User ID to update
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepo.update(id, { lastLoginAt: new Date() });
  }

  /**
   * Update user's status
   *
   * @param id User ID to update
   * @param status New user status
   */
  async updateStatus(id: string, status: UserStatus): Promise<void> {
    await this.usersRepo.update(id, { status });
  }
}
