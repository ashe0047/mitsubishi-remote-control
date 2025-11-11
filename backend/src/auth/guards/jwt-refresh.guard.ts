import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { TokensService } from '../tokens/tokens.service';
import { JwtClaims } from '../../shared/types/auth';

type AuthedRequest = Request & { user?: JwtClaims; token?: string };

/**
 * JWT Refresh authentication guard using Passport.
 *
 * This guard extends Passport's AuthGuard to use the jwt-refresh strategy
 * while preserving all existing functionality including refresh token validation
 * and token assignment logic.
 *
 * Features:
 * - Extends Passport AuthGuard with 'jwt-refresh' strategy
 * - Preserves existing refresh token validation logic
 * - Maintains token assignment to request object
 * - Keeps all existing error handling patterns
 * - Supports refresh token from Authorization header
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  constructor(
    private readonly tokens: TokensService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Let Passport handle authentication via jwt-refresh strategy
    const result = await super.canActivate(context);

    // Preserve existing token assignment logic for backward compatibility
    if (result) {
      const req = context.switchToHttp().getRequest<AuthedRequest>();
      const auth = req.headers.authorization || undefined;

      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.substring(7);
        req.token = token;
      }
    }

    return result as boolean;
  }
}
