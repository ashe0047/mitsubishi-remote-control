import { plainToInstance } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user.dto';
import { TokensResponse } from './tokens.dto';
import { User } from '../../../users/entities/user.entity';

/**
 * Complete authentication response DTO
 *
 * Combines user data and tokens for a complete authentication response
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class AuthResponse extends TokensResponse {
  @ApiProperty({
    description: 'Authenticated user information',
    type: UserResponse,
  })
  user: UserResponse;

  /**
   * Transform user and tokens to AuthResponse DTO
   *
   * @param user The authenticated user entity
   * @param accessToken The JWT access token
   * @param refreshToken The JWT refresh token
   * @returns AuthResponse DTO instance
   */
  static from(
    user: User,
    accessToken: string,
    refreshToken: string,
  ): AuthResponse {
    const authResponse = plainToInstance(AuthResponse, {
      accessToken,
      refreshToken,
    });
    authResponse.user = UserResponse.from(user);
    return authResponse;
  }
}
