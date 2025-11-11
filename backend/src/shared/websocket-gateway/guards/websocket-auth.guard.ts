import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { TokensService } from '../../../auth/tokens/tokens.service';
import { toWsErrorResponse } from '../../errors/utils/error-mappers';
import { JwtClaims } from '../../types/auth';
import {
  AuthenticatedContext,
  WebSocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  WsErrorResponse,
} from '../interfaces';
import { WebSocketErrorCode } from '../enums/websocket.enums';
import {
  validateJwtClaims,
  JwtValidationContext,
} from '../../../auth/utils/jwt-validation.util';
import { ErrorExtractor } from '../../errors/utils/error-extractor.utility';

/**
 * WebSocket Authentication Guard
 * Validates JWT tokens for WebSocket connections
 * Extends NestJS CanActivate for WebSocket compatibility
 */
@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor(private readonly tokensService: TokensService) {}

  /**
   * Validate WebSocket connection authentication
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = this.getClient(context);
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          `No token provided for WebSocket connection: ${client.id}`,
        );
        this.sendError(
          client,
          WebSocketErrorCode.MISSING_TOKEN,
          'Authentication token is required',
        );
        return false;
      }

      const authenticatedContext = await this.validateToken(token);

      // Attach authenticated context to client for later use
      client.data.authenticatedContext = authenticatedContext;

      this.logger.debug(
        `WebSocket authenticated: ${client.id} for user ${authenticatedContext.user.id}`,
      );
      return true;
    } catch (error) {
      const client = this.getClient(context);
      this.logger.error(
        `WebSocket authentication failed for ${client.id}:`,
        error,
      );

      let errorCode = WebSocketErrorCode.INTERNAL_SERVER_ERROR;
      let errorMessage = 'Authentication failed';

      if (error instanceof UnauthorizedException) {
        errorCode = WebSocketErrorCode.INVALID_TOKEN;
        errorMessage = error.message;
      }

      this.sendError(client, errorCode, errorMessage);
      return false;
    }
  }

  /**
   * Extract JWT token from WebSocket client
   */
  private extractToken(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): string | null {
    // Priority order for token extraction:
    // 1. Query parameter (most common for WebSocket connections)
    // 2. Authorization header
    // 3. Custom auth event data

    // Check query parameters
    const queryToken = client.handshake.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    // Check authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check custom auth data
    const authData = client.handshake.auth;
    if (authData?.token && typeof authData?.token === 'string') {
      return authData.token;
    }

    return null;
  }

  /**
   * Validate JWT token and create authenticated context
   */
  private async validateToken(token: string): Promise<AuthenticatedContext> {
    try {
      // Use TokensService for validation with blacklist checking
      const rawClaims: JwtClaims = this.tokensService.verifyTokenRaw(token);

      // Check if token is blacklisted
      const isBlacklisted = await this.tokensService.isBlacklistedAccess(
        rawClaims.jti,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Use shared validation utility for consistent WebSocket JWT claims validation
      // This properly narrows the type to WebSocketJwtClaims
      const claims = validateJwtClaims(
        rawClaims,
        JwtValidationContext.WEBSOCKET,
      );

      return {
        user: {
          id: claims.sub,
          email: claims.email,
          householdId: claims.householdId, // Now guaranteed to be string
          role: claims.role,
        },
        token,
        expiresAt: new Date(claims.exp * 1000),
      };
    } catch (error) {
      this.logger.error('Token validation failed:', {
        error: ErrorExtractor.safeMessage(error),
        tokenLength: token?.length,
      });

      if (error instanceof UnauthorizedException) {
        throw error;
      } else {
        throw new UnauthorizedException('Token validation failed');
      }
    }
  }

  /**
   * Get WebSocket client from execution context
   */
  private getClient(
    context: ExecutionContext,
  ): Socket<
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData
  > {
    const client = context
      .switchToWs()
      .getClient<
        Socket<
          ServerToClientEvents,
          ClientToServerEvents,
          InterServerEvents,
          SocketData
        >
      >();
    if (!client) {
      throw new UnauthorizedException('WebSocket client not found');
    }
    return client;
  }

  /**
   * Send error response to WebSocket client
   */
  private sendError(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    errorCode: WebSocketErrorCode,
    message: string,
  ): void {
    const category = this.mapToWsCategory(errorCode);
    const errorResponse: WsErrorResponse = toWsErrorResponse({
      message,
      commandId: this.generateErrorId(),
      errorCode: String(errorCode),
      category,
      retryable: false,
      processingTimeMs: 0,
      metadata: {
        strategy: 'shared',
        gatewayType: 'device',
        sessionId: undefined,
        executionContext: { handler: 'auth_guard' },
      },
    });

    client.emit('error', errorResponse);

    // Close connection after sending error
    setTimeout(() => {
      if (client.connected) {
        client.disconnect(true);
      }
    }, 1000);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error category from error code
   */
  private mapToWsCategory(
    errorCode: WebSocketErrorCode,
  ): 'validation' | 'authorization' | 'execution' | 'infrastructure' {
    const authErrors = [
      WebSocketErrorCode.INVALID_TOKEN,
      WebSocketErrorCode.EXPIRED_TOKEN,
      WebSocketErrorCode.MISSING_TOKEN,
      WebSocketErrorCode.INSUFFICIENT_PERMISSIONS,
    ];

    const validationErrors = [
      WebSocketErrorCode.INVALID_MESSAGE_FORMAT,
      WebSocketErrorCode.MISSING_REQUIRED_FIELDS,
      WebSocketErrorCode.INVALID_PARAMETER_VALUES,
      WebSocketErrorCode.SCHEMA_VALIDATION_FAILED,
    ];

    if (authErrors.includes(errorCode)) return 'authorization';
    if (validationErrors.includes(errorCode)) return 'validation';
    return 'execution';
  }

  /**
   * Create WebSocket context from authenticated context
   */
  static createWebSocketContext(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    authenticatedContext: AuthenticatedContext,
    additionalData?: Partial<WebSocketContext>,
  ): WebSocketContext {
    return {
      socket: client,
      user: authenticatedContext.user,
      sessionId: client.id,
      roomId: additionalData?.roomId || 'default',
      lastActivity: new Date(),
      connectedAt: new Date(),
      metadata: {
        namespace: client.nsp.name,
        userAgent: client.handshake.headers['user-agent'] || '',
        ip: client.handshake.address || '',
        ...additionalData?.metadata,
      },
      ...additionalData,
    };
  }

  /**
   * Get authenticated context from client
   */
  static getAuthenticatedContext(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): AuthenticatedContext | null {
    return client.data.authenticatedContext || null;
  }

  /**
   * Check if user has required permissions
   */
  static hasPermission(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    requiredRole: string,
    requiredHouseholdId?: string,
  ): boolean {
    const authenticatedContext =
      WebSocketAuthGuard.getAuthenticatedContext(client);

    if (!authenticatedContext) {
      return false;
    }

    // Check household access if specified
    if (
      requiredHouseholdId &&
      authenticatedContext.user.householdId !== requiredHouseholdId
    ) {
      return false;
    }

    // Role-based permission check
    const userRole = authenticatedContext.user.role.toUpperCase();
    const requiredRoleUpper = requiredRole.toUpperCase();

    const roleHierarchy = {
      ADMIN: 3,
      PARENT: 2,
      USER: 1,
      GUEST: 0,
    };

    return (
      (roleHierarchy[userRole as keyof typeof roleHierarchy] || 0) >=
      (roleHierarchy[requiredRoleUpper as keyof typeof roleHierarchy] || 0)
    );
  }

  /**
   * Extract user info for logging and monitoring
   */
  static extractUserInfo(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): {
    userId?: string;
    householdId?: string;
    sessionId: string;
    ip: string;
    userAgent: string;
  } {
    const authenticatedContext =
      WebSocketAuthGuard.getAuthenticatedContext(client);

    return {
      userId: authenticatedContext?.user.id,
      householdId: authenticatedContext?.user.householdId,
      sessionId: client.id,
      ip: client.handshake.address || '',
      userAgent: client.handshake.headers['user-agent'] || '',
    };
  }
}
