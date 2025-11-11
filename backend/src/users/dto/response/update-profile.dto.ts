import { plainToInstance } from 'class-transformer';
import { UserRole } from '../../enums/access.enums';
import { User } from '../../entities/user.entity';

/**
 * Update Profile Response DTO
 *
 * Provides a clean, type-safe response format for updated user profile
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class UpdateProfileResponse {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  householdId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Transform User entity to UpdateProfileResponse DTO
   *
   * @param user The updated user entity
   * @returns UpdateProfileResponse DTO instance
   */
  static from(user: User): UpdateProfileResponse {
    return plainToInstance(UpdateProfileResponse, {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      householdId: user.householdId ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
