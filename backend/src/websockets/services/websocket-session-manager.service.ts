import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketContext,
  WebSocketMessage,
} from '../interfaces/websocket-messages.interface';

// Session tracking interface matching Spring Boot patterns
interface ActiveSession {
  socket: any;
  context: WebSocketContext;
  subscriptions: Set<string>;
  lastActivity: Date;
}

@Injectable()
export class WebSocketSessionManagerService {
  private readonly logger = new Logger(WebSocketSessionManagerService.name);

  // Active sessions by sessionId (matching Spring Boot ConcurrentMap)
  private readonly activeSessions = new Map<string, ActiveSession>();

  // User-to-sessions mapping for targeted broadcasting
  private readonly userSessions = new Map<string, Set<string>>();

  // Room-to-sessions mapping for room-specific broadcasting
  private readonly roomSessions = new Map<string, Set<string>>();

  // Quota-to-sessions mapping for quota-specific broadcasting
  private readonly quotaSessions = new Map<string, Set<string>>();

  /**
   * Register a new WebSocket session
   */
  registerSession(context: WebSocketContext): void {
    const session: ActiveSession = {
      socket: context.socket,
      context,
      subscriptions: new Set(),
      lastActivity: new Date(),
    };

    this.activeSessions.set(context.sessionId, session);

    // Update user mapping
    if (context.userId) {
      let sessions = this.userSessions.get(context.userId);
      if (!sessions) {
        sessions = new Set();
        this.userSessions.set(context.userId, sessions);
      }
      sessions.add(context.sessionId);
    }

    // Update room mapping
    if (context.roomId) {
      let sessions = this.roomSessions.get(context.roomId);
      if (!sessions) {
        sessions = new Set();
        this.roomSessions.set(context.roomId, sessions);
      }
      sessions.add(context.sessionId);
    }

    // Update quota mapping
    if (context.quotaId) {
      let sessions = this.quotaSessions.get(context.quotaId);
      if (!sessions) {
        sessions = new Set();
        this.quotaSessions.set(context.quotaId, sessions);
      }
      sessions.add(context.sessionId);
    }

    this.logger.debug(
      `Registered WebSocket session ${context.sessionId} for user ${context.userId}`,
    );
  }

  /**
   * Unregister a WebSocket session
   */
  unregisterSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    const { context } = session;

    // Clean up user mapping
    if (context.userId) {
      const sessions = this.userSessions.get(context.userId);
      if (sessions) {
        sessions.delete(sessionId);
        if (sessions.size === 0) {
          this.userSessions.delete(context.userId);
        }
      }
    }

    // Clean up room mapping
    if (context.roomId) {
      const sessions = this.roomSessions.get(context.roomId);
      if (sessions) {
        sessions.delete(sessionId);
        if (sessions.size === 0) {
          this.roomSessions.delete(context.roomId);
        }
      }
    }

    // Clean up quota mapping
    if (context.quotaId) {
      const sessions = this.quotaSessions.get(context.quotaId);
      if (sessions) {
        sessions.delete(sessionId);
        if (sessions.size === 0) {
          this.quotaSessions.delete(context.quotaId);
        }
      }
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    this.logger.debug(`Unregistered WebSocket session ${sessionId}`);
  }

  /**
   * Send message to a specific session
   */
  sendToSession(sessionId: string, message: WebSocketMessage): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.socket.send(JSON.stringify(message));
      session.lastActivity = new Date();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send message to session ${sessionId}`,
        error,
      );
      this.unregisterSession(sessionId);
      return false;
    }
  }

  /**
   * Send message to all sessions for a specific user
   */
  sendToUser(userId: string, message: WebSocketMessage): number {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return 0;
    }

    let sentCount = 0;
    for (const sessionId of sessionIds) {
      if (this.sendToSession(sessionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send message to all sessions for a specific room
   */
  sendToRoom(roomId: string, message: WebSocketMessage): number {
    const sessionIds = this.roomSessions.get(roomId);
    if (!sessionIds) {
      return 0;
    }

    let sentCount = 0;
    for (const sessionId of sessionIds) {
      if (this.sendToSession(sessionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send message to all sessions for a specific quota
   */
  sendToQuota(quotaId: string, message: WebSocketMessage): number {
    const sessionIds = this.quotaSessions.get(quotaId);
    if (!sessionIds) {
      return 0;
    }

    let sentCount = 0;
    for (const sessionId of sessionIds) {
      if (this.sendToSession(sessionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send message to all active sessions (broadcast)
   */
  broadcast(message: WebSocketMessage): number {
    let sentCount = 0;
    for (const sessionId of this.activeSessions.keys()) {
      if (this.sendToSession(sessionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Check if a session should receive a message (matching Spring Boot filtering logic)
   */
  shouldReceiveMessage(
    messageFamilyMemberId: string,
    messageRoomId: string,
    messageQuotaId: string,
    sessionContext: WebSocketContext,
  ): boolean {
    // Filter by familyMemberId
    if (
      sessionContext.familyMemberId &&
      messageFamilyMemberId &&
      sessionContext.familyMemberId !== messageFamilyMemberId
    ) {
      return false;
    }

    // Filter by roomId
    if (
      sessionContext.roomId &&
      messageRoomId &&
      sessionContext.roomId !== messageRoomId
    ) {
      return false;
    }

    // Filter by quotaId
    if (
      sessionContext.quotaId &&
      messageQuotaId &&
      sessionContext.quotaId !== messageQuotaId
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): WebSocketContext | null {
    const session = this.activeSessions.get(sessionId);
    return session ? session.context : null;
  }

  /**
   * Update session context
   */
  updateSessionContext(
    sessionId: string,
    updates: Partial<WebSocketContext>,
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Update context
    session.context = { ...session.context, ...updates };

    // Re-register to update mappings
    this.unregisterSession(sessionId);
    this.registerSession(session.context);

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WebSocketContext[] {
    return Array.from(this.activeSessions.values()).map((s) => s.context);
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get sessions by user
   */
  getSessionsByUser(userId: string): WebSocketContext[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map((id) => this.getSessionContext(id))
      .filter((context) => context !== null);
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions(maxInactiveMinutes: number = 30): number {
    const cutoff = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions) {
      if (session.lastActivity < cutoff) {
        this.unregisterSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} inactive WebSocket sessions`,
      );
    }

    return cleanedCount;
  }
}
