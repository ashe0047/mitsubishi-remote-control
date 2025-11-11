import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash, compare } from 'bcrypt-ts';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlerService } from '../../shared/errors/services/error-handler.service';
import { DatabaseException } from '../../shared/errors/exceptions/infrastructure.exception';
import { UsersCommonService } from './common.service';
import {
  ProfileResponse,
  UpdateProfileResponse,
  PasswordResponse,
} from '../dto/response';
import { BulkUpdateDto, UserUpdateDto } from '../dto/bulk-update.dto';
import { UserRole, UserStatus } from '../enums/access.enums';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * API users service for controller operations.
 *
 * This service provides user management functionality used by the users controller.
 * Functions return response DTOs for API consumption and handle business logic
 * specific to user-facing operations.
 */
@Injectable()
export class UsersApiService {
  private readonly logger = new Logger(UsersApiService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly usersCommon: UsersCommonService,
  ) {}

  /**
   * Get user profile by ID
   *
   * @param id User ID to search
   * @returns User profile response DTO
   * @throws NotFoundException if user not found
   */
  async getProfile(id: string): Promise<ProfileResponse> {
    const user = await this.usersCommon.findById(id);
    return ProfileResponse.from(user);
  }

  /**
   * Update user profile information
   *
   * @param id User ID to update
   * @param patch Partial user data to update
   * @returns Updated profile response DTO
   */
  async updateProfile(
    id: string,
    patch: Partial<Pick<User, 'name'>>,
  ): Promise<UpdateProfileResponse> {
    const user = await this.usersCommon.findById(id);
    if (patch.name !== undefined) user.name = patch.name;
    const updatedUser = await this.usersRepo.save(user);
    return UpdateProfileResponse.from(updatedUser);
  }

  /**
   * Change user password
   *
   * @param id User ID to update
   * @param currentPassword Current password for verification
   * @param newPassword New password to set
   * @returns Password response DTO
   * @throws UnauthorizedException if current password is invalid
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<PasswordResponse> {
    const user = await this.usersCommon.findById(id);
    let ok: boolean;
    try {
      ok = await compare(currentPassword, user.passwordHash);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'current_password_validation',
        userId: id,
      });

      this.logger.error(
        'Failed to compare password',
        errorMessage,
        errorContext,
      );
      throw new DatabaseException(
        'current_password_validation',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }
    if (!ok) throw new UnauthorizedException('Invalid current password');
    const rounds = this.config.get<number>('security.bcryptRounds', 12);
    try {
      user.passwordHash = await hash(newPassword, rounds);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'new_password_hashing',
        userId: id,
        rounds,
      });

      this.logger.error(
        'Failed to hash new password',
        errorMessage,
        errorContext,
      );
      throw new DatabaseException(
        'new_password_hashing',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }
    await this.usersRepo.save(user);
    return PasswordResponse.success();
  }

  /**
   * Bulk update multiple users
   * Matches Spring Boot bulkUpdateFamilyMembers functionality
   */
  async bulkUpdateUsers(
    request: BulkUpdateDto,
    requestingUser: User,
  ): Promise<User[]> {
    // Validate parent permissions (matches Spring Boot)
    if (requestingUser.role !== UserRole.PARENT) {
      throw new ForbiddenException('Only parents can perform bulk updates');
    }

    const results: User[] = [];

    for (const updateRequest of request.updates) {
      try {
        const user = await this.usersCommon.findById(updateRequest.userId);

        // Verify user is in same household (matches Spring Boot)
        if (user.householdId !== requestingUser.householdId) {
          this.logger.warn(
            `User ${updateRequest.userId} not in same household as requesting user`,
          );
          continue;
        }

        // Apply updates
        if (updateRequest.updates.fullName !== undefined) {
          user.name = updateRequest.updates.fullName;
        }

        if (updateRequest.updates.role !== undefined) {
          user.role = updateRequest.updates.role;
        }

        if (updateRequest.updates.isActive !== undefined) {
          // Match Spring Boot logic: map boolean to status (lines 395-398)
          user.status = updateRequest.updates.isActive
            ? UserStatus.ACTIVE
            : UserStatus.ARCHIVED;
        }

        user.updatedAt = new Date();
        const updatedUser = await this.usersRepo.save(user);
        results.push(updatedUser);
      } catch (error) {
        this.logger.error(
          `Failed to update user ${updateRequest.userId}`,
          error,
        );
        // Continue with other updates (matches Spring Boot behavior)
      }
    }

    return results;
  }

  /**
   * Deactivate user (soft delete)
   * Matches Spring Boot deactivateUser functionality
   */
  async deactivateUser(userId: string, requestingUser: User): Promise<void> {
    // Validate parent permissions (matches Spring Boot)
    if (requestingUser.role !== UserRole.PARENT) {
      throw new ForbiddenException('Only parents can deactivate users');
    }

    const user = await this.usersCommon.findById(userId);

    // Verify user is in same household (matches Spring Boot)
    if (user.householdId !== requestingUser.householdId) {
      throw new ForbiddenException('User not in same household');
    }

    // Soft delete by changing status to ARCHIVED (matches Spring Boot)
    await this.usersCommon.updateStatus(userId, UserStatus.ARCHIVED);
  }

  /**
   * Update user information
   * Matches Spring Boot updateUser functionality
   */
  async updateUser(
    userId: string,
    updateData: UserUpdateDto,
    requestingUser: User,
  ): Promise<User> {
    const targetUserId = userId;
    const canUpdate =
      targetUserId === requestingUser.id ||
      requestingUser.role === UserRole.PARENT;

    if (!canUpdate) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const user = await this.usersCommon.findById(targetUserId);

    // Verify user is in same household if updating someone else (matches Spring Boot)
    if (
      targetUserId !== requestingUser.id &&
      user.householdId !== requestingUser.householdId
    ) {
      throw new ForbiddenException('User not in same household');
    }

    // Update allowed fields
    if (updateData.fullName !== undefined) {
      user.name = updateData.fullName;
    }

    if (
      updateData.role !== undefined &&
      requestingUser.role === UserRole.PARENT
    ) {
      // Only parents can change roles (matches Spring Boot)
      user.role = updateData.role;
    }

    if (
      updateData.isActive !== undefined &&
      requestingUser.role === UserRole.PARENT
    ) {
      // Only parents can change active status (matches Spring Boot)
      user.status = updateData.isActive
        ? UserStatus.ACTIVE
        : UserStatus.ARCHIVED;
    }

    user.updatedAt = new Date();
    return await this.usersRepo.save(user);
  }

  /**
   * Get family members in household
   * Matches Spring Boot getFamilyMembers functionality
   */
  async getFamilyMembers(requestingUser: User): Promise<User[]> {
    return await this.usersCommon.listByHousehold(requestingUser.householdId);
  }

  /**
   * Get specific family member details
   * Matches Spring Boot getFamilyMember functionality
   */
  async getFamilyMember(userId: string, requestingUser: User): Promise<User> {
    const user = await this.usersCommon.findById(userId);

    // Verify user is in same household (matches Spring Boot)
    if (user.householdId !== requestingUser.householdId) {
      throw new ForbiddenException('User not in same household');
    }

    return user;
  }
}
