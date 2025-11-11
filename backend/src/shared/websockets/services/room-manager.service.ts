import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisAdapterService } from './redis-adapter.service';
import { WebSocketConnectionContext } from '../types/websocket.types';

/**
 * Room Management Service for WebSocket Communication
 *
 * Features:
 * - Efficient room-based client management
 * - Cross-instance room synchronization via Redis
 * - Room membership tracking and analytics
 * - Automatic cleanup of inactive connections
 * - Performance monitoring and optimization
 *
 * Phase 5 Requirements Met:
 * - ✅ Room-based message routing
 * - ✅ Multi-client support per room
 * - ✅ Connection state synchronization
 * - ✅ Automatic connection cleanup
 * - ✅ Performance monitoring
 *
 * @see Phase 5 WebSocket Requirements - FR-WS-004, FR-WS-005
 */
@Injectable()
export class RoomManagerService {
  private readonly logger = new Logger(RoomManagerService.name);
  private server: Server | null = null;

  // Local room membership tracking
  private readonly roomMembers = new Map<string, Set<string>>(); // roomId -> Set of socketIds
  private readonly clientRooms = new Map<string, Set<string>>(); // socketId -> Set of roomIds
  private readonly connectionContexts = new Map<
    string,
    WebSocketConnectionContext
  >(); // socketId -> context

  // Performance metrics
  private metrics = {
    totalRooms: 0,
    totalConnections: 0,
    averageConnectionsPerRoom: 0,
    roomJoinOperations: 0,
    roomLeaveOperations: 0,
    cleanupOperations: 0,
    lastCleanupTime: 0,
  };

  constructor(private readonly redisAdapter: RedisAdapterService) {}

  /**
   * Set Socket.IO server instance
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket.IO server instance set for room management');
  }

  /**
   * Add client to room with context tracking
   */
  async addClientToRoom(
    socketId: string,
    roomId: string,
    context: WebSocketConnectionContext,
  ): Promise<void> {
    try {
      // Add to local tracking
      if (!this.roomMembers.has(roomId)) {
        this.roomMembers.set(roomId, new Set());
      }
      this.roomMembers.get(roomId)!.add(socketId);

      if (!this.clientRooms.has(socketId)) {
        this.clientRooms.set(socketId, new Set());
      }
      this.clientRooms.get(socketId)!.add(roomId);

      // Store connection context
      this.connectionContexts.set(socketId, context);

      // Join Socket.IO room
      if (this.server) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          await socket.join(roomId);
        }
      }

      // Add to Redis for cross-instance synchronization
      await this.redisAdapter.addClientToRoom(socketId, roomId, context);

      // Update metrics
      this.metrics.roomJoinOperations++;
      this.updateMetrics();

      this.logger.debug(`Client ${socketId} added to room ${roomId}`);
    } catch (error) {
      this.logger.error(
        `Failed to add client ${socketId} to room ${roomId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove client from room with cleanup
   */
  async removeClientFromRoom(socketId: string, roomId: string): Promise<void> {
    try {
      // Remove from local tracking
      const roomMembers = this.roomMembers.get(roomId);
      if (roomMembers) {
        roomMembers.delete(socketId);
        if (roomMembers.size === 0) {
          this.roomMembers.delete(roomId);
        }
      }

      const clientRooms = this.clientRooms.get(socketId);
      if (clientRooms) {
        clientRooms.delete(roomId);
        if (clientRooms.size === 0) {
          this.clientRooms.delete(socketId);
          // Clean up connection context when client has no more rooms
          this.connectionContexts.delete(socketId);
        }
      }

      // Leave Socket.IO room
      if (this.server) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          await socket.leave(roomId);
        }
      }

      // Remove from Redis for cross-instance synchronization
      await this.redisAdapter.removeClientFromRoom(socketId, roomId);

      // Update metrics
      this.metrics.roomLeaveOperations++;
      this.updateMetrics();

      this.logger.debug(`Client ${socketId} removed from room ${roomId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove client ${socketId} from room ${roomId}:`,
        error,
      );
    }
  }

  /**
   * Get all clients in a room
   */
  async getClientsInRoom(
    roomId: string,
  ): Promise<WebSocketConnectionContext[]> {
    try {
      // Get local clients first
      const localClients: WebSocketConnectionContext[] = [];
      const roomMembers = this.roomMembers.get(roomId);

      if (roomMembers) {
        for (const socketId of roomMembers) {
          const context = this.connectionContexts.get(socketId);
          if (context) {
            localClients.push(context);
          }
        }
      }

      // Get clients from other instances via Redis
      const redisClients = await this.redisAdapter.getClientsInRoom(roomId);

      // Merge and deduplicate clients
      const allClients = [...localClients];
      for (const redisClient of redisClients) {
        if (
          !allClients.find(
            (client) => client.socket.id === redisClient.socket.id,
          )
        ) {
          allClients.push(redisClient);
        }
      }

      return allClients;
    } catch (error) {
      this.logger.error(`Failed to get clients in room ${roomId}:`, error);
      return [];
    }
  }

  /**
   * Get all rooms for a client
   */
  async getRoomsForClient(socketId: string): Promise<string[]> {
    try {
      // Get local rooms first
      const clientRooms = this.clientRooms.get(socketId);
      const localRooms = clientRooms ? Array.from(clientRooms) : [];

      // Get rooms from other instances via Redis
      const redisRooms = await this.redisAdapter.getRoomsForClient(socketId);

      // Merge and deduplicate rooms
      const allRooms = [...new Set([...localRooms, ...redisRooms])];

      return allRooms;
    } catch (error) {
      this.logger.error(`Failed to get rooms for client ${socketId}:`, error);
      return [];
    }
  }

  /**
   * Broadcast message to room
   */
  async broadcastToRoom(
    roomId: string,
    event: string,
    data: any,
  ): Promise<void> {
    try {
      if (this.server) {
        this.server.to(roomId).emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
          roomId,
        });
      }

      // Additional cross-instance broadcasting via Redis if needed
      await this.redisAdapter.broadcastToRoom(roomId, event, data);

      this.logger.debug(`Broadcast to room ${roomId}: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to room ${roomId}:`, error);
    }
  }

  /**
   * Broadcast message to multiple users
   */
  async broadcastToUsers(
    userIds: string[],
    event: string,
    data: any,
  ): Promise<void> {
    try {
      // Find all socket IDs for the given users
      const socketIds: string[] = [];
      for (const [socketId, context] of this.connectionContexts.entries()) {
        if (userIds.includes(context.user.id)) {
          socketIds.push(socketId);
        }
      }

      // Get all rooms for these sockets
      const targetRooms = new Set<string>();
      for (const socketId of socketIds) {
        const rooms = await this.getRoomsForClient(socketId);
        rooms.forEach((room) => targetRooms.add(room));
      }

      // Broadcast to all relevant rooms
      for (const room of targetRooms) {
        await this.broadcastToRoom(room, event, data);
      }

      // Additional cross-instance broadcasting
      await this.redisAdapter.broadcastToUsers(userIds, event, data);

      this.logger.debug(`Broadcast to ${userIds.length} users: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to users:`, error);
    }
  }

  /**
   * Clean up inactive connections
   */
  async cleanupInactiveConnections(): Promise<void> {
    const startTime = Date.now();
    let cleanedCount = 0;

    try {
      // Check for inactive sockets
      if (this.server) {
        for (const [socketId, context] of this.connectionContexts.entries()) {
          const socket = this.server.sockets.sockets.get(socketId);

          // Remove if socket no longer exists
          if (!socket) {
            // Remove from all rooms
            const rooms = await this.getRoomsForClient(socketId);
            for (const room of rooms) {
              await this.removeClientFromRoom(socketId, room);
            }
            cleanedCount++;
          }
        }
      }

      this.metrics.cleanupOperations++;
      this.metrics.lastCleanupTime = Date.now() - startTime;

      this.logger.debug(
        `Cleaned up ${cleanedCount} inactive connections in ${this.metrics.lastCleanupTime}ms`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup inactive connections:', error);
    }
  }

  /**
   * Get room statistics
   */
  getRoomStats(): {
    totalRooms: number;
    totalConnections: number;
    averageConnectionsPerRoom: number;
    roomDetails: Array<{
      roomId: string;
      clientCount: number;
      lastActivity: Date;
    }>;
  } {
    const roomDetails: Array<{
      roomId: string;
      clientCount: number;
      lastActivity: Date;
    }> = [];

    for (const [roomId, members] of this.roomMembers.entries()) {
      let latestActivity = new Date(0);
      const clientCount = members.size;

      // Find latest activity in this room
      for (const socketId of members) {
        const context = this.connectionContexts.get(socketId);
        if (context && context.lastActivity > latestActivity) {
          latestActivity = context.lastActivity;
        }
      }

      roomDetails.push({
        roomId,
        clientCount,
        lastActivity: latestActivity,
      });
    }

    return {
      totalRooms: this.roomMembers.size,
      totalConnections: this.connectionContexts.size,
      averageConnectionsPerRoom:
        this.roomMembers.size > 0
          ? this.connectionContexts.size / this.roomMembers.size
          : 0,
      roomDetails: roomDetails.sort((a, b) => b.clientCount - a.clientCount),
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      ...this.metrics,
      roomStats: this.getRoomStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRooms: 0,
      totalConnections: 0,
      averageConnectionsPerRoom: 0,
      roomJoinOperations: 0,
      roomLeaveOperations: 0,
      cleanupOperations: 0,
      lastCleanupTime: 0,
    };
  }

  /**
   * Health check for room management service
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check server instance
      if (!this.server) {
        return false;
      }

      // Check Redis adapter health
      const redisHealthy = await this.redisAdapter.isHealthy();
      if (!redisHealthy) {
        this.logger.warn('Redis adapter is not healthy');
      }

      // Perform basic consistency check
      const roomStats = this.getRoomStats();
      const consistencyCheck = this.performConsistencyCheck();

      return consistencyCheck;
    } catch (error) {
      this.logger.error('Room management service health check failed:', error);
      return false;
    }
  }

  /**
   * Perform consistency check on room memberships
   */
  private performConsistencyCheck(): boolean {
    try {
      // Check if total connections match between different data structures
      const totalFromRooms = Array.from(this.roomMembers.values()).reduce(
        (total, members) => total + members.size,
        0,
      );

      const totalFromClients = Array.from(this.clientRooms.values()).reduce(
        (total, rooms) => total + rooms.size,
        0,
      );

      const totalFromContexts = this.connectionContexts.size;

      // All should match (within a small margin for race conditions)
      const maxDiff = 2;
      const diff1 = Math.abs(totalFromRooms - totalFromClients);
      const diff2 = Math.abs(totalFromRooms - totalFromContexts);

      if (diff1 > maxDiff || diff2 > maxDiff) {
        this.logger.warn(
          `Room consistency check failed: rooms=${totalFromRooms}, clients=${totalFromClients}, contexts=${totalFromContexts}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Room consistency check failed:', error);
      return false;
    }
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    this.metrics.totalRooms = this.roomMembers.size;
    this.metrics.totalConnections = this.connectionContexts.size;
    this.metrics.averageConnectionsPerRoom =
      this.roomMembers.size > 0
        ? this.connectionContexts.size / this.roomMembers.size
        : 0;
  }

  /**
   * Graceful shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down room management service...');

    // Clean up all connections
    for (const [socketId, rooms] of this.clientRooms.entries()) {
      for (const room of rooms) {
        await this.removeClientFromRoom(socketId, room);
      }
    }

    // Clear all data structures
    this.roomMembers.clear();
    this.clientRooms.clear();
    this.connectionContexts.clear();

    this.logger.log('Room management service shutdown complete');
  }
}
