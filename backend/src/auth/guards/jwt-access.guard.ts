import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { TokensService } from '../tokens/tokens.service';
import { JwtClaims } from '../../shared/types/auth';

type AuthedRequest = Request & { user?: JwtClaims; token?: string };

/**
 * JWT Access authentication guard using Passport.
 *
 * This guard extends Passport's AuthGuard to use the jwt-access strategy
 * while preserving all existing functionality including public route handling
 * and token assignment logic.
 *
 * Features:
 * - Extends Passport AuthGuard with 'jwt-access' strategy
 * - Preserves existing public route handling with Reflector
 * - Maintains token assignment to request object
 * - Keeps all existing error handling patterns
 * - Supports IS_PUBLIC_KEY metadata for public routes
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Preserve existing public route handling
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      process.env.IS_PUBLIC_KEY || 'isPublic',
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    // Let Passport handle authentication via jwt-access strategy
    const result = await super.canActivate(context);

    // Preserve existing token assignment logic
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
