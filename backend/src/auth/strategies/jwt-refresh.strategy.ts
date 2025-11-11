import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokensService } from '../tokens/tokens.service';
import { JwtClaims } from '../../shared/types/auth';

/**
 * JWT Refresh Token validation strategy using Passport.
 *
 * This strategy implements the Adapter Pattern by delegating refresh token
 * validation to the existing TokensService while preserving all existing
 * token rotation and tracking logic.
 *
 * Features:
 * - Extracts JWT from request body (refresh token field)
 * - Preserves existing refresh token validation logic
 * - Maintains active refresh token tracking with Redis
 * - Integrates with existing TokensService validation
 * - Preserves existing error handling patterns
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly config: ConfigService,
    private readonly tokensService: TokensService,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    super({
      // Extract refresh token from request body instead of header
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false, // Validate token expiration
      secretOrKey: secret,
    });
  }

  /**
   * Validates JWT refresh token using existing TokensService
   *
   * @param payload Decoded JWT payload
   * @returns Validated JWT claims if refresh token is valid and active
   * @throws UnauthorizedException if token is invalid, expired, or inactive
   */
  async validate(payload: JwtClaims & { typ?: string }): Promise<JwtClaims> {
    try {
      // Verify this is a refresh token (preserve existing logic)
      if (payload.typ !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Preserve existing active refresh token validation
      const isActive = await this.tokensService.isActiveRefresh(
        payload.sub,
        payload.jti,
      );

      if (!isActive) {
        throw new UnauthorizedException('Refresh token is no longer active');
      }

      // Check if refresh token is blacklisted (preserve existing logic)
      const isBlacklisted = await this.tokensService.isBlacklistedRefresh(
        payload.jti,
      );

      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Refresh token is valid - return payload for use in request handlers
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Handle any other validation errors
      throw new UnauthorizedException('Refresh token validation failed');
    }
  }
}
