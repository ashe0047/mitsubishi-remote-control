import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { UsageSession } from '../entities/usage-session.entity';
import { QuotaCacheService } from './quota-cache.service';
import { SessionStatus } from '../enums/usage-session.enums';
import { DeviceOperation } from '../interfaces/device-operation.interface';
import { UsageTotals } from '../../analytics/dto/usage-summary.dto';

@Injectable()
export class UsageSessionService {
  private readonly logger = new Logger(UsageSessionService.name);

  constructor(
    @InjectRepository(UsageSession)
    private readonly sessionRepository: Repository<UsageSession>,
    private readonly quotaCacheService: QuotaCacheService,
  ) {}

  async getUsageSummary(
    userId: string,
    start: Date,
    end: Date,
    roomId?: string,
  ): Promise<{ totals: UsageTotals; sessionsCount: number }> {
    const sessions = await this.findSessionsByDateRange(
      userId,
      start,
      end,
      500,
      roomId,
    );
    const totals = this.aggregateTotals(sessions);
    return { totals, sessionsCount: sessions.length };
  }

  async getUsageStatistics(
    userId: string,
    start: Date,
    end: Date,
    roomId?: string,
  ): Promise<{ totals: UsageTotals; sessionsCount: number }> {
    return this.getUsageSummary(userId, start, end, roomId);
  }

  async calculateDailyUsage(userId: string, day: Date): Promise<UsageTotals> {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const sessions = await this.findSessionsByDateRange(userId, start, end);
    return this.aggregateTotals(sessions);
  }

  async getOrCreateSession(
    quotaId: string,
    userId: string,
    roomId: string,
    deviceId: string,
  ): Promise<UsageSession> {
    // First try to get existing active session
    let session = await this.findActiveSession(
      quotaId,
      userId,
      roomId,
      deviceId,
    );

    if (!session) {
      // Create new session
      session = await this.createSession(quotaId, userId, roomId, deviceId);
    }

    return session;
  }

  async findActiveSession(
    quotaId: string,
    userId: string,
    roomId: string,
    deviceId: string,
  ): Promise<UsageSession | null> {
    try {
      // Try cache first
      const cacheKey = `${quotaId}:${userId}:${roomId}:${deviceId}`;

      const cachedSession = await this.quotaCacheService.getSession(cacheKey);
      // Type assertion for cached session (TODO: Add proper validation)
      const typedCachedSession = cachedSession as UsageSession | null;

      if (
        typedCachedSession &&
        typedCachedSession.status === SessionStatus.ACTIVE
      ) {
        return typedCachedSession;
      }

      // Fallback to database - note: quotaId and deviceId need relationship filtering
      // For now, filter by available direct fields
      const session = await this.sessionRepository.findOne({
        where: {
          userId,
          roomId,
          status: SessionStatus.ACTIVE,
        },
        relations: ['quota', 'device'], // Load relationships
      });

      // Cache the result
      if (session) {
        await this.quotaCacheService.setSession(cacheKey, session, 3600); // 1 hour
      }

      return session || null;
    } catch (error) {
      this.logger.error('Failed to find active session', error);
      return null;
    }
  }

  async createSession(
    quotaId: string,
    userId: string,
    roomId: string,
    deviceId: string,
  ): Promise<UsageSession> {
    try {
      const session = this.sessionRepository.create({
        userId,
        roomId,
        deviceType: 'ac', // Default device type
        status: SessionStatus.ACTIVE,
        startedAt: new Date(),
        metadata: {
          operationHistory: [],
        },
      });

      const savedSession = await this.sessionRepository.save(session);

      // Cache the new session
      const cacheKey = `${quotaId}:${userId}:${roomId}:${deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, savedSession, 3600);

      this.logger.log(`Created new session: ${savedSession.id}`);
      return savedSession;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw error;
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<UsageSession>,
  ): Promise<UsageSession> {
    try {
      // Extract only scalar fields for update to avoid TypeORM entity relationship issues
      // Complex relationships (user, device, room, overrideByUser, violations) cannot be updated directly
      const {
        user,
        device,
        room,
        overrideByUser,
        violations, // OneToMany relationship
        ...directFields
      } = updates;

      // Only update scalar/primitive fields that can be safely serialized
      await this.sessionRepository.update(sessionId, directFields);

      const updatedSession = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      if (!updatedSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Update cache
      const cacheKey = `${updatedSession.quotaId}:${updatedSession.userId}:${updatedSession.roomId}:${updatedSession.deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, updatedSession, 3600);

      return updatedSession;
    } catch (error) {
      this.logger.error(`Failed to update session: ${sessionId}`, error);
      throw error;
    }
  }

  async pauseSession(
    sessionId: string,
    reason?: string,
  ): Promise<UsageSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.pause(reason);
    return await this.sessionRepository.save(session);
  }

  async resumeSession(sessionId: string): Promise<UsageSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.resume();
    return await this.sessionRepository.save(session);
  }

  async completeSession(
    sessionId: string,
    terminationReason?: string,
  ): Promise<UsageSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.terminate(terminationReason || 'Unknown reason');
    const savedSession = await this.sessionRepository.save(session);

    // Invalidate cache since session is no longer active
    const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
    await this.quotaCacheService.invalidateSession(cacheKey);

    return savedSession;
  }

  async terminateSession(
    sessionId: string,
    terminationReason: string,
  ): Promise<UsageSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.terminate(terminationReason || 'Unknown reason');
    const savedSession = await this.sessionRepository.save(session);

    // Invalidate cache since session is no longer active
    const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
    await this.quotaCacheService.invalidateSession(cacheKey);

    return savedSession;
  }

  async recordOperation(
    sessionId: string,
    operation: DeviceOperation,
  ): Promise<UsageSession> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.addOperation(operation);
      const savedSession = await this.sessionRepository.save(session);

      // Update cache
      const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, savedSession, 3600);

      return savedSession;
    } catch (error) {
      this.logger.error(
        `Failed to record operation for session: ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  async recordEnergyConsumption(
    sessionId: string,
    energy: number,
  ): Promise<UsageSession> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.addEnergyConsumption(energy);
      const savedSession = await this.sessionRepository.save(session);

      // Update cache
      const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, savedSession, 3600);

      return savedSession;
    } catch (error) {
      this.logger.error(
        `Failed to record energy consumption for session: ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  async recordCost(sessionId: string, cost: number): Promise<UsageSession> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.addCost(cost);
      const savedSession = await this.sessionRepository.save(session);

      // Update cache
      const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, savedSession, 3600);

      return savedSession;
    } catch (error) {
      this.logger.error(
        `Failed to record cost for session: ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  async recordUsage(sessionId: string, usage: number): Promise<UsageSession> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.addUsage(usage);
      const savedSession = await this.sessionRepository.save(session);

      // Update cache
      const cacheKey = `${savedSession.quotaId}:${savedSession.userId}:${savedSession.roomId}:${savedSession.deviceId}`;
      await this.quotaCacheService.setSession(cacheKey, savedSession, 3600);

      return savedSession;
    } catch (error) {
      this.logger.error(
        `Failed to record usage for session: ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  async findSessionsByDateRange(
    userId: string,
    start?: Date,
    end?: Date,
    limit: number = 50,
    roomId?: string,
  ): Promise<UsageSession[]> {
    const where: Record<string, unknown> = { userId };
    if (roomId) {
      where.roomId = roomId;
    }

    if (start && end) {
      where.startedAt = Between(start, end);
    } else if (start) {
      where.startedAt = MoreThanOrEqual(start);
    } else if (end) {
      where.startedAt = LessThanOrEqual(end);
    }

    return await this.sessionRepository.find({
      where,
      order: { startedAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async findSessionsByRoomAndDateRange(
    userId: string,
    roomId: string,
    start?: Date,
    end?: Date,
    limit: number = 50,
  ): Promise<UsageSession[]> {
    return this.findSessionsByDateRange(userId, start, end, limit, roomId);
  }

  async getSessionById(sessionId: string): Promise<UsageSession | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      return session || null;
    } catch (error) {
      this.logger.error(`Failed to get session: ${sessionId}`, error);
      return null;
    }
  }

  async getSessionsByUser(
    userId: string,
    limit: number = 100,
  ): Promise<UsageSession[]> {
    try {
      return await this.sessionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get sessions for user: ${userId}`, error);
      return [];
    }
  }

  async getActiveSessionsByUser(userId: string): Promise<UsageSession[]> {
    try {
      return await this.sessionRepository.find({
        where: {
          userId,
          status: SessionStatus.ACTIVE,
        },
        order: { startTime: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get active sessions for user: ${userId}`,
        error,
      );
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const expiredTime = new Date();
      expiredTime.setHours(expiredTime.getHours() - 24); // Sessions older than 24 hours

      const result = await this.sessionRepository
        .createQueryBuilder()
        .update(UsageSession)
        .set({ status: SessionStatus.INTERRUPTED })
        .where('status = :status', { status: SessionStatus.ACTIVE })
        .andWhere('startedAt < :expiredTime', { expiredTime })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} expired sessions`);
      return result.affected || 0;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
      return 0;
    }
  }

  private aggregateTotals(sessions: UsageSession[]): UsageTotals {
    return sessions.reduce<UsageTotals>(
      (totals, session) => {
        const durationMinutes =
          session.durationMinutes ?? session.calculatedDurationMinutes ?? 0;
        const energy = Number(session.energyConsumed ?? 0);
        const cost = Number(session.estimatedCost ?? 0);

        return {
          durationSeconds: totals.durationSeconds + durationMinutes * 60,
          energyKwh: totals.energyKwh + energy,
          cost: totals.cost + cost,
        };
      },
      { durationSeconds: 0, energyKwh: 0, cost: 0 },
    );
  }
}
