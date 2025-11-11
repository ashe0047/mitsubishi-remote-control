import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { JwtClaims } from '../types/auth';
import { ErrorHandlerService } from '../errors/services/error-handler.service';
import { AuthenticationValidationException } from '../errors/exceptions/validation.exception';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = (client.handshake.query?.token as string) || '';

    if (!token) {
      throw new AuthenticationValidationException(
        'Authentication token is required',
        {
          clientId: client.id,
          hasToken: false,
        },
      );
    }

    try {
      const secret = this.config.get<string>('jwt.secret');
      if (!secret) {
        throw new AuthenticationValidationException(
          'JWT secret not configured',
          {
            clientId: client.id,
          },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const payload = verify(token, secret) as JwtClaims;

      // Validate payload structure
      if (!payload.sub || !payload.householdId) {
        throw new AuthenticationValidationException('Invalid token structure', {
          tokenPrefix: token.substring(0, 10) + '...',
          clientId: client.id,
          hasSub: !!payload.sub,
          hasHouseholdId: !!payload.householdId,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = {
        id: payload.sub,
        householdId: payload.householdId,
      };

      return true;
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);

      this.logger.warn('JWT authentication failed', errorMessage, {
        tokenPrefix: token.substring(0, 10) + '...',
        clientId: client.id,
      });

      throw new AuthenticationValidationException(
        'Invalid authentication token',
        {
          tokenPrefix: token.substring(0, 10) + '...',
          clientId: client.id,
          originalError: errorMessage,
        },
        error instanceof Error ? error : undefined,
      );
    }
  }
}
