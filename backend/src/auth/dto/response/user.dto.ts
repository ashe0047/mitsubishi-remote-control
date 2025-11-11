import { plainToInstance } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../users/enums/access.enums';
import { User } from '../../../users/entities/user.entity';

/**
 * User response DTO for user data serialization
 *
 * Provides a clean, type-safe response format for user information
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class UserResponse {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: 'User role within the system',
    example: UserRole.PARENT,
    enum: UserRole,
    enumName: 'UserRole',
  })
  role: UserRole;

  @ApiProperty({
    description: 'Household identifier the user belongs to',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
    format: 'uuid',
  })
  householdId: string | null;

  @ApiProperty({
    description: 'Timestamp of user last login',
    example: '2024-01-15T10:30:00Z',
    nullable: true,
    format: 'date-time',
  })
  lastLoginAt: Date | null;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T09:00:00Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last account update timestamp',
    example: '2024-01-15T10:30:00Z',
    format: 'date-time',
  })
  updatedAt: Date;

  /**
   * Transform User entity to UserResponse DTO
   *
   * @param user The user entity to transform
   * @returns UserResponse DTO instance
   */
  static from(user: User): UserResponse {
    return plainToInstance(UserResponse, {
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
