import { plainToInstance } from 'class-transformer';
import { UserRole } from '../../enums/access.enums';
import { User } from '../../entities/user.entity';

/**
 * Profile Response DTO
 *
 * Provides a clean, type-safe response format for user profile information
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  householdId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Transform User entity to ProfileResponse DTO
   *
   * @param user The user entity to transform
   * @returns ProfileResponse DTO instance
   */
  static from(user: User): ProfileResponse {
    return plainToInstance(ProfileResponse, {
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
