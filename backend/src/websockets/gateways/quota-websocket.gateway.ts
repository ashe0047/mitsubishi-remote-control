import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketSessionManagerService } from '../services/websocket-session-manager.service';
import {
  WebSocketMessage,
  WebSocketMessageTypes,
  WebSocketContext,
} from '../interfaces/websocket-messages.interface';

// JWT authentication decorator would be implemented here
// For now, we'll use basic query parameter authentication

@WebSocketGateway({
  namespace: 'quota',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class QuotaWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuotaWebSocketGateway.name);

  constructor(
    private readonly sessionManager: WebSocketSessionManagerService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('Quota WebSocket Gateway initialized');
  }

  async handleConnection(@ConnectedSocket() socket: Socket): Promise<void> {
    try {
      this.logger.debug(`WebSocket connection attempt: ${socket.id}`);

      // Extract authentication token and context from query parameters or handshake
      const context = await this.extractWebSocketContext(socket);

      if (!context.userId) {
        this.logger.warn(
          `Rejecting unauthenticated WebSocket connection: ${socket.id}`,
        );
        socket.disconnect(true);
        return;
      }

      // Create WebSocket context with socket
      const webSocketContext: WebSocketContext = {
        ...context,
        socket,
        sessionId: socket.id,
      };

      // Register session
      this.sessionManager.registerSession(webSocketContext);

      // Send connection status
      const connectionMessage: WebSocketMessage = {
        type: WebSocketMessageTypes.CONNECTION_STATUS,
        payload: {
          status: 'CONNECTED',
          sessionId: socket.id,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      socket.send(JSON.stringify(connectionMessage));

      this.logger.log(
        `WebSocket connected: ${socket.id} for user ${context.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling WebSocket connection for ${socket.id}`,
        error,
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() socket: Socket): void {
    this.logger.debug(`WebSocket disconnected: ${socket.id}`);
    this.sessionManager.unregisterSession(socket.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { quotaId?: string; roomId?: string },
  ): void {
    try {
      this.logger.debug(`WebSocket ${socket.id} subscribing to:`, data);

      // Update session context with subscription info
      this.sessionManager.updateSessionContext(socket.id, {
        quotaId: data.quotaId,
        roomId: data.roomId,
      });

      // Acknowledge subscription
      const response: WebSocketMessage = {
        type: 'SUBSCRIPTION_ACK',
        payload: {
          quotaId: data.quotaId,
          roomId: data.roomId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      socket.send(JSON.stringify(response));
    } catch (error) {
      this.logger.error(`Error handling subscription for ${socket.id}`, error);

      const errorResponse: WebSocketMessage = {
        type: WebSocketMessageTypes.ERROR,
        payload: {
          message: 'Failed to process subscription',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      socket.send(JSON.stringify(errorResponse));
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { quotaId?: string; roomId?: string },
  ): void {
    try {
      this.logger.debug(`WebSocket ${socket.id} unsubscribing from:`, data);

      // Clear subscription info from session context
      this.sessionManager.updateSessionContext(socket.id, {
        quotaId: data.quotaId ? undefined : undefined,
        roomId: data.roomId ? undefined : undefined,
      });

      // Acknowledge unsubscription
      const response: WebSocketMessage = {
        type: 'UNSUBSCRIPTION_ACK',
        payload: {
          quotaId: data.quotaId,
          roomId: data.roomId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      socket.send(JSON.stringify(response));
    } catch (error) {
      this.logger.error(
        `Error handling unsubscription for ${socket.id}`,
        error,
      );
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket): void {
    const response: WebSocketMessage = {
      type: 'pong',
      payload: {
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    socket.send(JSON.stringify(response));
  }

  /**
   * Extract WebSocket context from authentication (matching Spring Boot WebSocketJwtAuthHandler pattern)
   */
  private async extractWebSocketContext(
    socket: Socket,
  ): Promise<Omit<WebSocketContext, 'socket' | 'sessionId'>> {
    try {
      // Extract token from query parameters (for WebSocket connections)
      const token = socket.handshake.query.token as string;

      if (!token) {
        this.logger.warn(
          `No token provided for WebSocket connection: ${socket.id}`,
        );
        return {} as WebSocketContext;
      }

      // For now, we'll use a simple token parsing approach
      // In a real implementation, this would verify JWT tokens
      const userInfo = await this.verifyToken(token);

      return {
        userId: userInfo.userId,
        householdId: userInfo.householdId,
        userRole: userInfo.userRole,
        familyMemberId: userInfo.familyMemberId,
        roomId: userInfo.roomId,
        quotaId: userInfo.quotaId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to extract WebSocket context for ${socket.id}`,
        error,
      );
      return {} as WebSocketContext;
    }
  }

  /**
   * Verify JWT token (placeholder implementation)
   * In a real implementation, this would use JwtService
   */
  private async verifyToken(token: string): Promise<{
    userId: string;
    householdId: string;
    userRole: string;
    familyMemberId?: string;
    roomId?: string;
    quotaId?: string;
  }> {
    // This is a placeholder implementation
    // In a real application, you would:
    // 1. Verify the JWT token using JwtService
    // 2. Extract user claims from the token
    // 3. Validate the token is not expired
    // 4. Return user information

    try {
      // For demo purposes, we'll parse a simple token format
      // In production, use proper JWT verification
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString(),
      );

      return {
        userId: payload.userId || payload.sub,
        householdId: payload.householdId,
        userRole: payload.userRole || 'USER',
        familyMemberId: payload.familyMemberId,
        roomId: payload.roomId,
        quotaId: payload.quotaId,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Send message to specific socket
   */
  sendToSocket(socketId: string, message: WebSocketMessage): boolean {
    try {
      this.server.to(socketId).emit('message', message);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to socket ${socketId}`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connected sockets in the quota namespace
   */
  broadcast(message: WebSocketMessage): void {
    this.server.emit('message', message);
  }

  /**
   * Get connected sockets count
   */
  getConnectedSocketsCount(): number {
    return this.server.sockets.sockets.size;
  }
}
