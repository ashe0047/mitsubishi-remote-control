import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { IWebSocketSessionManager, WebSocketContext } from '../interfaces';
import {
  WebSocketDefaults,
  CacheKeyPattern,
  WebSocketEventType,
} from '../enums/websocket.enums';

/**
 * WebSocket Session Manager Service
 * Manages WebSocket session lifecycle with Redis persistence
 * Provides session tracking, cleanup, and multi-instance coordination
 */
@Injectable()
export class WebSocketSessionManagerService
  implements IWebSocketSessionManager, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WebSocketSessionManagerService.name);
  private redisClient: RedisClientType;
  private readonly sessionTimeoutMs: number;
  private readonly cleanupIntervalMs: number;
  private cleanupInterval: NodeJS.Timeout;

  // Reactive streams for connection events and stats
  private readonly connectionEventSubject = new Subject<{
    type: 'CONNECTED' | 'DISCONNECTED' | 'UPDATED';
    sessionId: string;
    roomId?: string;
    userId?: string;
    at: Date;
  }>();
  private readonly statsSubject = new BehaviorSubject<{
    totalSessions: number;
    activeSessions: number;
    sessionsByRoom: Record<string, number>;
    sessionsByUser: Record<string, number>;
    lastUpdated: Date;
  }>({
    totalSessions: 0,
    activeSessions: 0,
    sessionsByRoom: {},
    sessionsByUser: {},
    lastUpdated: new Date(),
  });

  constructor(private readonly configService: ConfigService) {
    this.sessionTimeoutMs =
      this.configService.get<number>('WEBSOCKET_SESSION_TIMEOUT_MINUTES', 30) *
      60 *
      1000;
    this.cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
  }

  async onModuleInit(): Promise<void> {
    await this.initializeRedisClient();
    this.startCleanupInterval();
    this.logger.log('WebSocket Session Manager initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.logger.log('WebSocket Session Manager destroyed');
  }

  /**
   * Register a new WebSocket session
   */
  async registerSession(context: WebSocketContext): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(context.sessionId);
      const userSessionsKey = this.getUserSessionsKey(context.user.id);
      const roomSessionsKey = this.getRoomSessionsKey(context.roomId);

      const sessionData = {
        ...context,
        lastActivity: new Date().toISOString(),
        connectedAt: context.connectedAt.toISOString(),
      };

      // Store session data (convert to JSON for Redis)
      const serializedSession = {
        user: JSON.stringify(context.user),
        sessionId: context.sessionId,
        roomId: context.roomId,
        lastActivity: context.lastActivity.toISOString(),
        connectedAt: context.connectedAt.toISOString(),
        metadata: JSON.stringify(context.metadata),
      };

      await this.redisClient.hSet(sessionKey, serializedSession);
      await this.redisClient.expire(
        sessionKey,
        Math.floor(this.sessionTimeoutMs / 1000),
      );

      // Add to user sessions set
      await this.redisClient.sAdd(userSessionsKey, context.sessionId);
      await this.redisClient.expire(
        userSessionsKey,
        Math.floor(this.sessionTimeoutMs / 1000),
      );

      // Add to room sessions set
      await this.redisClient.sAdd(roomSessionsKey, context.sessionId);
      await this.redisClient.expire(
        roomSessionsKey,
        Math.floor(this.sessionTimeoutMs / 1000),
      );

      this.logger.debug(
        `Session registered: ${context.sessionId} for user ${context.user.id}`,
      );

      // Emit reactive event and update stats
      this.connectionEventSubject.next({
        type: 'CONNECTED',
        sessionId: context.sessionId,
        roomId: context.roomId,
        userId: context.user.id,
        at: new Date(),
      });
      void this.pushStatsUpdate();
    } catch (error) {
      this.logger.error(
        `Failed to register session ${context.sessionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Unregister a WebSocket session
   */
  async unregisterSession(socketId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(socketId);
      const sessionData = await this.getSession(socketId);

      if (!sessionData) {
        this.logger.warn(`Session not found for cleanup: ${socketId}`);
        return;
      }

      const userSessionsKey = this.getUserSessionsKey(sessionData.user.id);
      const roomSessionsKey = this.getRoomSessionsKey(sessionData.roomId);

      // Remove session data
      await this.redisClient.del(sessionKey);

      // Remove from user sessions set
      await this.redisClient.sRem(userSessionsKey, socketId);

      // Remove from room sessions set
      await this.redisClient.sRem(roomSessionsKey, socketId);

      this.logger.debug(`Session unregistered: ${socketId}`);

      // Emit reactive event and update stats
      this.connectionEventSubject.next({
        type: 'DISCONNECTED',
        sessionId: socketId,
        roomId: sessionData.roomId,
        userId: sessionData.user.id,
        at: new Date(),
      });
      void this.pushStatsUpdate();
    } catch (error) {
      this.logger.error(`Failed to unregister session ${socketId}:`, error);
    }
  }

  /**
   * Get session by socket ID
   */
  async getSession(socketId: string): Promise<WebSocketContext | undefined> {
    try {
      const sessionKey = this.getSessionKey(socketId);
      const sessionData = await this.redisClient.hGetAll(sessionKey);

      if (!sessionData || Object.keys(sessionData).length === 0) {
        return undefined;
      }

      return this.deserializeSession(sessionData);
    } catch (error) {
      this.logger.error(`Failed to get session ${socketId}:`, error);
      return undefined;
    }
  }

  /**
   * Update session context
   */
  async updateSessionContext(
    socketId: string,
    updates: Partial<WebSocketContext>,
  ): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(socketId);
      const existingSession = await this.getSession(socketId);

      if (!existingSession) {
        this.logger.warn(`Cannot update non-existent session: ${socketId}`);
        return;
      }

      const updatedSession = {
        ...existingSession,
        ...updates,
        lastActivity: new Date(),
      };

      const sessionData = {
        ...updatedSession,
        lastActivity: updatedSession.lastActivity.toISOString(),
        connectedAt: updatedSession.connectedAt.toISOString(),
      };

      // Update user sessions set if user changed
      if (updates.user?.id && updates.user.id !== existingSession.user.id) {
        const oldUserSessionsKey = this.getUserSessionsKey(
          existingSession.user.id,
        );
        const newUserSessionsKey = this.getUserSessionsKey(updates.user.id);

        await this.redisClient.sRem(oldUserSessionsKey, socketId);
        await this.redisClient.sAdd(newUserSessionsKey, socketId);
      }

      // Update room sessions set if room changed
      if (updates.roomId && updates.roomId !== existingSession.roomId) {
        const oldRoomSessionsKey = this.getRoomSessionsKey(
          existingSession.roomId,
        );
        const newRoomSessionsKey = this.getRoomSessionsKey(updates.roomId);

        await this.redisClient.sRem(oldRoomSessionsKey, socketId);
        await this.redisClient.sAdd(newRoomSessionsKey, socketId);
      }

      // Update session data
      const updateData = {
        user: JSON.stringify(updatedSession.user),
        sessionId: updatedSession.sessionId,
        roomId: updatedSession.roomId,
        lastActivity: updatedSession.lastActivity.toISOString(),
        connectedAt: updatedSession.connectedAt.toISOString(),
        metadata: JSON.stringify(updatedSession.metadata),
      };

      await this.redisClient.hSet(sessionKey, updateData);
      await this.redisClient.expire(
        sessionKey,
        Math.floor(this.sessionTimeoutMs / 1000),
      );

      this.logger.debug(`Session updated: ${socketId}`);

      // Emit reactive event and update stats
      this.connectionEventSubject.next({
        type: 'UPDATED',
        sessionId: socketId,
        roomId: updatedSession.roomId,
        userId: updatedSession.user.id,
        at: new Date(),
      });
      void this.pushStatsUpdate();
    } catch (error) {
      this.logger.error(`Failed to update session ${socketId}:`, error);
      throw error;
    }
  }

  /**
   * Get all sessions for a room
   */
  async getSessionsByRoom(roomId: string): Promise<WebSocketContext[]> {
    try {
      const roomSessionsKey = this.getRoomSessionsKey(roomId);
      const sessionIds = await this.redisClient.sMembers(roomSessionsKey);

      if (sessionIds.length === 0) {
        return [];
      }

      const sessions = await Promise.all(
        sessionIds.map(async (sessionId) => {
          const session = await this.getSession(sessionId);
          return session;
        }),
      );

      return sessions.filter(
        (session): session is WebSocketContext => session !== undefined,
      );
    } catch (error) {
      this.logger.error(`Failed to get sessions for room ${roomId}:`, error);
      return [];
    }
  }

  /**
   * Get all sessions for a user
   */
  async getSessionsByUser(userId: string): Promise<WebSocketContext[]> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redisClient.sMembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return [];
      }

      const sessions = await Promise.all(
        sessionIds.map(async (sessionId) => {
          const session = await this.getSession(sessionId);
          return session;
        }),
      );

      return sessions.filter(
        (session): session is WebSocketContext => session !== undefined,
      );
    } catch (error) {
      this.logger.error(`Failed to get sessions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get count of active sessions
   */
  async getActiveSessionCount(): Promise<number> {
    try {
      const pattern = `${CacheKeyPattern.SESSION_PREFIX}*`;
      const keys = await this.redisClient.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.error('Failed to get active session count:', error);
      return 0;
    }
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(): Promise<void> {
    try {
      const pattern = `${CacheKeyPattern.SESSION_PREFIX}*`;
      const keys = await this.redisClient.keys(pattern);

      if (keys.length === 0) {
        return;
      }

      const now = new Date();
      let cleanedCount = 0;

      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.hGetAll(key);

          if (!sessionData || Object.keys(sessionData).length === 0) {
            await this.redisClient.del(key);
            cleanedCount++;
            continue;
          }

          const lastActivity = new Date(sessionData.lastActivity);
          const timeSinceActivity = now.getTime() - lastActivity.getTime();

          if (timeSinceActivity > this.sessionTimeoutMs) {
            const sessionId = key.replace(CacheKeyPattern.SESSION_PREFIX, '');
            await this.unregisterSession(sessionId);
            cleanedCount++;
            // unregisterSession emits events/stats
          }
        } catch (error) {
          this.logger.error(`Error cleaning up session key ${key}:`, error);
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} inactive sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup inactive sessions:', error);
    }
  }

  /**
   * Expose reactive connection events
   */
  getConnectionEvents$(): Observable<{
    type: 'CONNECTED' | 'DISCONNECTED' | 'UPDATED';
    sessionId: string;
    roomId?: string;
    userId?: string;
    at: Date;
  }> {
    return this.connectionEventSubject.asObservable();
  }

  /**
   * Expose reactive connection stats
   */
  getConnectionStats$(): Observable<{
    totalSessions: number;
    activeSessions: number;
    sessionsByRoom: Record<string, number>;
    sessionsByUser: Record<string, number>;
    lastUpdated: Date;
  }> {
    return this.statsSubject.asObservable();
  }

  private async pushStatsUpdate(): Promise<void> {
    const stats = await this.getSessionStatistics();
    this.statsSubject.next({ ...stats, lastUpdated: new Date() });
  }

  /**
   * Check if session exists and is active
   */
  async isSessionActive(socketId: string): Promise<boolean> {
    try {
      const session = await this.getSession(socketId);
      if (!session) {
        return false;
      }

      const now = new Date();
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();

      return timeSinceActivity <= this.sessionTimeoutMs;
    } catch (error) {
      this.logger.error(`Failed to check session activity ${socketId}:`, error);
      return false;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    sessionsByRoom: Record<string, number>;
    sessionsByUser: Record<string, number>;
  }> {
    try {
      const pattern = `${CacheKeyPattern.SESSION_PREFIX}*`;
      const keys = await this.redisClient.keys(pattern);

      const sessionsByRoom: Record<string, number> = {};
      const sessionsByUser: Record<string, number> = {};
      let activeSessions = 0;

      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.hGetAll(key);

          if (!sessionData || Object.keys(sessionData).length === 0) {
            continue;
          }

          const lastActivity = new Date(sessionData.lastActivity);
          const timeSinceActivity =
            new Date().getTime() - lastActivity.getTime();

          if (timeSinceActivity <= this.sessionTimeoutMs) {
            activeSessions++;

            const roomId = sessionData.roomId;
            let userId: string;

            try {
              const userObj = JSON.parse(sessionData.user);
              userId = userObj.id as string;
            } catch {
              userId = 'unknown';
            }

            sessionsByRoom[roomId] = (sessionsByRoom[roomId] || 0) + 1;
            sessionsByUser[userId] = (sessionsByUser[userId] || 0) + 1;
          }
        } catch (error) {
          // Skip invalid sessions
        }
      }

      return {
        totalSessions: keys.length,
        activeSessions,
        sessionsByRoom,
        sessionsByUser,
      };
    } catch (error) {
      this.logger.error('Failed to get session statistics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        sessionsByRoom: {},
        sessionsByUser: {},
      };
    }
  }

  private async initializeRedisClient(): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>(
        'REDIS_URL',
        'redis://localhost:6379',
      );

      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis client error:', err);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.redisClient.on('ready', () => {
        this.logger.log('Redis client ready');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.warn('Redis client reconnecting');
      });

      this.redisClient.on('end', () => {
        this.logger.log('Redis client connection ended');
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions().catch((error) => {
        this.logger.error('Scheduled cleanup failed:', error);
      });
    }, this.cleanupIntervalMs);
  }

  private getSessionKey(socketId: string): string {
    return `${CacheKeyPattern.SESSION_PREFIX}${socketId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${CacheKeyPattern.USER_PREFIX}${userId}`;
  }

  private getRoomSessionsKey(roomId: string): string {
    return `${CacheKeyPattern.ROOM_PREFIX}${roomId}`;
  }

  private deserializeSession(
    sessionData: Record<string, string>,
  ): WebSocketContext {
    return {
      socket: undefined as any, // Socket object not stored in Redis
      user: JSON.parse(sessionData.user),
      sessionId: sessionData.sessionId,
      roomId: sessionData.roomId,
      lastActivity: new Date(sessionData.lastActivity),
      connectedAt: new Date(sessionData.connectedAt),
      metadata: JSON.parse(sessionData.metadata),
    };
  }
}
