import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtService,
  type JwtSignOptions,
  type JwtVerifyOptions,
} from '@nestjs/jwt';
import { User } from '../../users/entities/user.entity';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import { JwtClaims } from '../../shared/types/auth';
import { UsersCommonService } from 'src/users/services';
import {
  validateJwtClaims,
  JwtValidationContext,
} from '../utils/jwt-validation.util';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userCommonService: UsersCommonService,
    /** Injected from RedisModule */
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  static ACCESS_BLACKLIST_PREFIX = 'jwt:blacklist:access:';
  static REFRESH_BLACKLIST_PREFIX = 'jwt:blacklist:refresh:';
  static USER_REFRESH_SET_PREFIX = 'user:'; // user:{id}:refresh:set

  private async sign(
    payload: object,
    opts: {
      expiresIn?: number;
      audience?: string;
      issuer?: string;
    },
  ): Promise<string> {
    try {
      const signOptions: JwtSignOptions = {
        expiresIn: opts.expiresIn,
        audience: opts.audience,
        issuer: opts.issuer,
      };
      return await this.jwtService.signAsync(payload, signOptions);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException(`Token signing failed: ${errorMessage}`);
    }
  }

  private verify(token: string, ignoreExpiration = false): JwtClaims {
    try {
      const verifyOptions: JwtVerifyOptions = {
        ignoreExpiration,
      };
      const decoded = this.jwtService.verify<JwtClaims>(token, verifyOptions);

      // Use shared validation utility for consistent JWT claims validation
      const claims = validateJwtClaims(decoded, JwtValidationContext.REST_API);

      return {
        sub: claims.sub,
        email: claims.email,
        role: claims.role,
        householdId: claims.householdId,
        iat: claims.iat,
        exp: claims.exp,
        jti: claims.jti,
        typ: claims.typ,
      };
    } catch (error) {
      // Re-throw UnauthorizedException from validation utility
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Handle JWT verification errors
      throw new UnauthorizedException('Invalid token');
    }
  }

  async issueTokens(user: User): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessExpiresInConfig = this.config.get<string>(
      'jwt.expiresIn',
      '24h',
    );
    const refreshExpiresInConfig = this.config.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );
    const accessExpiresIn = this.parseTTLToSeconds(accessExpiresInConfig);
    const refreshExpiresIn = this.parseTTLToSeconds(refreshExpiresInConfig);

    const baseClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      householdId: user.householdId || null,
      iat: now,
    };

    const audience = this.config.get<string>('jwt.audience');
    const issuer = this.config.get<string>('jwt.issuer');

    const [accessToken, refreshToken] = await Promise.all([
      this.sign(
        { ...baseClaims, jti: accessJti },
        {
          expiresIn: accessExpiresIn,
          audience,
          issuer,
        },
      ),
      this.sign(
        { ...baseClaims, jti: refreshJti, typ: 'refresh' },
        {
          expiresIn: refreshExpiresIn,
          audience,
          issuer,
        },
      ),
    ]);

    // Track refresh jti as active for this user
    const setKey = `${TokensService.USER_REFRESH_SET_PREFIX}${user.id}:refresh:set`;
    await this.redisClient.sadd(setKey, refreshJti);
    // Set TTL approximate to refresh lifetime if not exists
    await this.redisClient.expire(setKey, Math.max(refreshExpiresIn, 86400));

    return { accessToken, refreshToken, accessJti, refreshJti };
  }

  async rotateRefreshToken(
    oldRefreshToken: string,
    userId: string,
  ): Promise<TokenPair> {
    const payload = this.verify(oldRefreshToken);
    if (payload.sub !== userId || payload.typ !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token');
    await this.blacklistRefresh(payload.jti, payload.exp);
    await this.removeActiveRefresh(userId, payload.jti);
    // Issue new pair using current user record
    const user = await this.userCommonService.findById(userId);
    return this.issueTokens(user);
  }

  async blacklistAccess(jti: string, exp: number) {
    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
    await this.redisClient.set(
      TokensService.ACCESS_BLACKLIST_PREFIX + jti,
      '1',
      'EX',
      ttl,
    );
  }

  async blacklistRefresh(jti: string, exp: number) {
    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
    await this.redisClient.set(
      TokensService.REFRESH_BLACKLIST_PREFIX + jti,
      '1',
      'EX',
      ttl,
    );
  }

  async isBlacklistedAccess(jti: string): Promise<boolean> {
    const v = await this.redisClient.get(
      TokensService.ACCESS_BLACKLIST_PREFIX + jti,
    );
    return v === '1';
  }

  async isBlacklistedRefresh(jti: string): Promise<boolean> {
    const v = await this.redisClient.get(
      TokensService.REFRESH_BLACKLIST_PREFIX + jti,
    );
    return v === '1';
  }

  async isActiveRefresh(userId: string, jti: string): Promise<boolean> {
    const setKey = `${TokensService.USER_REFRESH_SET_PREFIX}${userId}:refresh:set`;
    const isMember = await this.redisClient.sismember(setKey, jti);
    return isMember === 1;
  }

  async removeActiveRefresh(userId: string, jti: string): Promise<void> {
    const setKey = `${TokensService.USER_REFRESH_SET_PREFIX}${userId}:refresh:set`;
    await this.redisClient.srem(setKey, jti);
  }

  parseTTLToSeconds(ttl: string): number {
    // supports values like '24h', '7d', '300s'
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 86400;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    switch (unit) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return 86400;
    }
  }

  verifyTokenRaw(token: string): JwtClaims {
    return this.verify(token);
  }
}
