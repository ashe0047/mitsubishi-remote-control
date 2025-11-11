import { plainToInstance } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Tokens response DTO for JWT token serialization
 *
 * Provides a clean, type-safe response format for JWT tokens
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class TokensResponse {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE2NjYxMDY0MDAsImV4cCI6MTY2NjEwNzQwMH0.access_signature',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for obtaining new access tokens',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE2NjYxMDY0MDAsImV4cCI6MTY2Njk3MDQwMH0.refresh_signature',
  })
  refreshToken: string;

  /**
   * Transform token pair to TokensResponse DTO
   *
   * @param accessToken The JWT access token
   * @param refreshToken The JWT refresh token
   * @returns TokensResponse DTO instance
   */
  static fromTokens(accessToken: string, refreshToken: string): TokensResponse {
    return plainToInstance(TokensResponse, {
      accessToken,
      refreshToken,
    });
  }

  /**
   * Transform token pair object to TokensResponse DTO
   *
   * @param tokenPair Object containing access and refresh tokens
   * @returns TokensResponse DTO instance
   */
  static fromTokenPair(tokenPair: {
    accessToken: string;
    refreshToken: string;
  }): TokensResponse {
    return this.fromTokens(tokenPair.accessToken, tokenPair.refreshToken);
  }
}
