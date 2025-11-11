import {
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WsException,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { ErrorHandlerService } from '../errors/services/error-handler.service';
import { RedisAdapterService } from './services/redis-adapter.service';
import { EventBroadcastService } from './services/event-broadcast.service';
import { RoomManagerService } from './services/room-manager.service';
import { WebSocketConnectionContext } from './types/websocket.types';

/**
 * Base WebSocket Gateway providing common functionality for all WebSocket endpoints
 *
 * Features:
 * - JWT authentication via WsJwtGuard
 * - Connection lifecycle management
 * - Error handling and logging
 * - Room-based message routing
 * - Rate limiting and connection management
 * - Performance monitoring
 *
 * @see Phase 5 WebSocket Requirements
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseGuards(WsJwtGuard)
export abstract class BaseWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  protected server!: Server;

  protected readonly logger: Logger;
  protected readonly config: ConfigService;
  protected readonly errorHandler: ErrorHandlerService;

  // Connection tracking for performance monitoring
  protected connectionCount = 0;
  protected readonly connections = new Map<
    string,
    {
      socket: Socket;
      connectedAt: Date;
      roomId?: string;
      userId?: string;
      householdId?: string;
    }
  >();

  constructor(
    gatewayName: string,
    config: ConfigService,
    errorHandler: ErrorHandlerService,
    private readonly redisAdapter: RedisAdapterService,
    private readonly eventBroadcastService: EventBroadcastService,
    private readonly roomManagerService: RoomManagerService,
  ) {
    this.logger = new Logger(gatewayName);
    this.config = config;
    this.errorHandler = errorHandler;
  }

  /**
   * Gateway initialization handler
   */
  async afterInit(server: Server): Promise<void> {
    this.logger.log(
      `WebSocket gateway initialized on namespace: ${this.getNamespace()}`,
    );

    // Set server instances on services
    this.eventBroadcastService.setServer(server);
    this.roomManagerService.setServer(server);

    // Set up Redis adapter for multi-instance scaling
    await this.setupRedisAdapter(server);

    // Initialize room management service
    await this.initializeRoomManagement();

    this.logger.log(
      `WebSocket gateway fully initialized with Redis adapter and room management`,
    );
  }

  /**
   * Connection handler with authentication and room management
   */
  async handleConnection(client: Socket): Promise<void> {
    const startTime = Date.now();
    this.connectionCount++;

    try {
      const { roomId, familyMemberId } = this.extractConnectionParams(client);
      const clientData = client.data as {
        user: {
          id: string;
          email: string;
          householdId: string;
          familyMemberId: string;
        };
      };
      const user = clientData.user;

      // Validate required parameters
      this.validateConnectionParams(roomId, familyMemberId, user);

      // Track connection
      this.connections.set(client.id, {
        socket: client,
        connectedAt: new Date(),
        roomId,
        userId: user?.id,
        householdId: user?.householdId,
      });

      // Create connection context
      const connectionContext: WebSocketConnectionContext = {
        socket: client,
        user: {
          id: user?.id,
          email: user?.email,
          householdId: user?.householdId,
          familyMemberId: familyMemberId,
        },
        roomId: roomId,
        familyMemberId: familyMemberId,
        lastActivity: new Date(),
        connectedAt: new Date(),
        metadata: {
          namespace: this.getNamespace(),
          userAgent: client.handshake.headers['user-agent'],
          ip: client.handshake.address,
        },
      };

      // Join appropriate rooms using room manager service
      await this.joinRooms(client, roomId, user);
      await this.roomManagerService.addClientToRoom(
        client.id,
        roomId,
        connectionContext,
      );

      const connectionTime = Date.now() - startTime;
      this.logger.log(
        `Client connected: ${client.id} to room: ${roomId} (${connectionTime}ms)`,
      );

      // Emit connection success
      client.emit('connected', {
        status: 'success',
        clientId: client.id,
        timestamp: new Date().toISOString(),
        connectionTime,
      });
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      this.logger.warn(
        `Connection failed for client ${client.id}: ${errorMessage}`,
      );

      client.emit('error', {
        status: 'error',
        message: 'Connection failed',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      });

      client.disconnect(true);
    }
  }

  /**
   * Disconnection handler with cleanup
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.connectionCount--;

    const connection = this.connections.get(client.id);
    if (connection) {
      this.connections.delete(client.id);

      const duration = Date.now() - connection.connectedAt.getTime();
      this.logger.debug(
        `Client disconnected: ${client.id} (duration: ${duration}ms)`,
      );

      // Clean up from room manager service
      if (connection.roomId) {
        await this.roomManagerService.removeClientFromRoom(
          client.id,
          connection.roomId,
        );
      }
    }

    // Notify other clients in room about disconnection if needed
    this.handleDisconnectionNotification(client, connection);
  }

  /**
   * Generic message handler with validation and routing
   */
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate message structure
      const validatedMessage = this.validateMessage(data);

      // Route to appropriate handler
      const result = this.routeMessage(client, validatedMessage);

      const processingTime = Date.now() - startTime;

      // Send response
      client.emit('response', {
        id: validatedMessage.id,
        success: true,
        data: result,
        processingTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const processingTime = Date.now() - startTime;

      this.logger.warn(
        `Message processing failed for client ${client.id}: ${errorMessage}`,
      );

      client.emit('error', {
        id: (data as any)?.id || 'unknown',
        success: false,
        message: errorMessage,
        processingTime,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Health check handler
   */
  @SubscribeMessage('health')
  protected handleHealthCheck(@ConnectedSocket() client: Socket): void {
    client.emit('health', {
      status: 'healthy',
      gateway: this.getNamespace(),
      connectionCount: this.connectionCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Abstract methods to be implemented by concrete gateways
   */
  protected abstract getNamespace(): string;
  protected abstract extractConnectionParams(client: Socket): {
    roomId: string;
    familyMemberId: string;
  };
  protected abstract validateMessage(message: unknown): any;
  protected abstract routeMessage(client: Socket, message: any): any;
  protected abstract joinRooms(
    client: Socket,
    roomId: string,
    user: any,
  ): Promise<void>;

  /**
   * Protected helper methods
   */
  protected validateConnectionParams(
    roomId: string,
    familyMemberId: string,
    user: any,
  ): void {
    if (!roomId) {
      throw new WsException('Room ID is required');
    }
    if (!familyMemberId) {
      throw new WsException('Family member ID is required');
    }
    if (!user?.id) {
      throw new WsException('User authentication required');
    }
    if (!user?.householdId) {
      throw new WsException('Household membership required');
    }
  }

  /**
   * Default implementation for extracting connection parameters
   * Concrete gateways can override this if needed
   */
  protected extractConnectionParamsDefault(client: Socket): {
    roomId: string;
    familyMemberId: string;
  } {
    const roomId = client.handshake.query?.roomId as string;
    const familyMemberId = client.handshake.query?.familyMemberId as string;

    return { roomId, familyMemberId };
  }

  protected handleDisconnectionNotification(
    client: Socket,
    connection: any,
  ): void {
    // Override in subclasses for specific disconnection handling
  }

  private async setupRedisAdapter(server: Server): Promise<void> {
    try {
      // Initialize Redis adapter for multi-instance scaling
      await this.redisAdapter.initializeAdapter(server);
      this.logger.log(
        'Redis adapter initialized for multi-instance WebSocket scaling',
      );
    } catch (error) {
      this.logger.warn(
        'Redis adapter setup failed:',
        this.errorHandler.safeMessage(error),
      );
      // Continue without Redis adapter for single-instance operation
      this.logger.log('WebSocket gateway will operate in single-instance mode');
    }
  }

  private async initializeRoomManagement(): Promise<void> {
    try {
      // Set up periodic cleanup of inactive connections
      setInterval(async () => {
        await this.roomManagerService.cleanupInactiveConnections();
      }, 30000); // Cleanup every 30 seconds

      this.logger.log(
        'Room management service initialized with periodic cleanup',
      );
    } catch (error) {
      this.logger.warn(
        'Room management initialization failed:',
        this.errorHandler.safeMessage(error),
      );
    }
  }

  /**
   * Broadcast utility methods for subclasses
   */
  protected broadcastToRoom(roomId: string, event: string, data: any): void {
    this.server.to(`room:${roomId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  protected broadcastToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  protected broadcastToHousehold(
    householdId: string,
    event: string,
    data: any,
  ): void {
    this.server.to(`household:${householdId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Performance monitoring utilities
   */
  protected getConnectionStats(): {
    totalConnections: number;
    connectionsByRoom: Record<string, number>;
    averageConnectionDuration: number;
  } {
    const connectionsByRoom: Record<string, number> = {};
    let totalDuration = 0;

    for (const connection of this.connections.values()) {
      if (connection.roomId) {
        connectionsByRoom[connection.roomId] =
          (connectionsByRoom[connection.roomId] || 0) + 1;
      }
      totalDuration += Date.now() - connection.connectedAt.getTime();
    }

    const averageConnectionDuration =
      this.connections.size > 0 ? totalDuration / this.connections.size : 0;

    return {
      totalConnections: this.connections.size,
      connectionsByRoom,
      averageConnectionDuration,
    };
  }
}
