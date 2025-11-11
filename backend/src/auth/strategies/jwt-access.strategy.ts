import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokensService } from '../tokens/tokens.service';
import type { Redis } from 'ioredis';
import { JwtClaims } from '../../shared/types/auth';
import {
  validateJwtClaims,
  JwtValidationContext,
} from '../utils/jwt-validation.util';

/**
 * JWT Access Token validation strategy using Passport.
 *
 * This strategy implements the Adapter Pattern by delegating token
 * validation to the existing TokensService while preserving all existing
 * Redis blacklisting logic and security patterns.
 *
 * Features:
 * - Extracts JWT from Authorization header (Bearer token)
 * - Preserves existing Redis-based token blacklisting
 * - Maintains all existing token format and claims
 * - Integrates with existing TokensService.validateTokenRaw()
 * - Preserves existing error handling patterns
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    private readonly config: ConfigService,
    private readonly tokensService: TokensService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Validate token expiration
      secretOrKey: secret,
    });
  }

  /**
   * Validates JWT access token using shared validation utility and Redis blacklisting
   *
   * @param payload Decoded JWT payload
   * @returns Validated JWT claims if token is valid and not blacklisted
   * @throws UnauthorizedException if token is invalid, expired, or blacklisted
   */
  async validate(payload: JwtClaims): Promise<JwtClaims> {
    try {
      // Use shared validation utility for consistent JWT claims validation
      const claims = validateJwtClaims(payload, JwtValidationContext.REST_API);

      // Check Redis blacklist - preserved from existing implementation
      const blacklisted = await this.redis.get(
        TokensService.ACCESS_BLACKLIST_PREFIX + claims.jti,
      );

      if (blacklisted === '1') {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Token is valid - return validated claims for use in request handlers
      return claims;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Handle any other validation errors
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
