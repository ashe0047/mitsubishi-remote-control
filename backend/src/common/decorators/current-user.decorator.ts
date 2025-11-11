import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtClaims } from '../../shared/types/auth';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtClaims => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtClaims }>();
    return req.user as JwtClaims;
  },
);
