import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { interval } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { MqttStateUpdateEvent } from '../../devices/interfaces/mqtt-events.interface';
import { AirConState } from '../../devices/interfaces/aircon-state.interface';
import { EventPublisherService } from '../../events/services/event-publisher.service';
import { QuotaValidationService } from './quota-validation.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Household } from '../../households/entities/household.entity';

// Usage session interface matching Spring Boot UsageSession
interface UsageSession {
  sessionId: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  startTime: Date;
  endTime?: Date;
  startTemperature: number;
  currentTemperature?: number;
  mode: string;
  fanSpeed: string;
  isActive: boolean;
  quotaId: string;
}

// Session tracking configuration
interface SessionConfig {
  sessionTimeoutMinutes: number;
  trackingEnabled: boolean;
  asyncProcessing: boolean;
  batchSize: number;
  batchTimeoutMs: number;
}

@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);
  private readonly config: SessionConfig;

  // Active sessions by user-room combination (matching Spring Boot ConcurrentHashMap)
  private readonly activeSessions = new Map<string, UsageSession>();

  // Session queue for batch processing
  private readonly sessionQueue: UsageSession[] = [];

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly eventPublisher: EventPublisherService,
    private readonly quotaValidationService: QuotaValidationService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
  ) {
    // Load configuration (matching Spring Boot @ConfigurationProperties)
    this.config = {
      sessionTimeoutMinutes: configService.get<number>(
        'USAGE_SESSION_TIMEOUT_MINUTES',
        240,
      ), // 4 hours default
      trackingEnabled: configService.get<boolean>(
        'USAGE_TRACKING_ENABLED',
        true,
      ),
      asyncProcessing: configService.get<boolean>(
        'USAGE_ASYNC_PROCESSING',
        true,
      ),
      batchSize: configService.get<number>('USAGE_BATCH_SIZE', 50),
      batchTimeoutMs: configService.get<number>('USAGE_BATCH_TIMEOUT_MS', 5000),
    };

    // Setup event listeners (matching Spring Boot @EventListener)
    this.setupEventListeners();

    // Start background tasks
    this.startBackgroundTasks();

    this.logger.log(
      'UsageTrackingService initialized with config:',
      this.config,
    );
  }

  /**
   * Handle AC state changes (matching Spring Boot handleAirConStateChange)
   */
  @OnEvent('mqtt.state.update')
  async handleAirConStateChange(event: MqttStateUpdateEvent): Promise<void> {
    if (!this.config.trackingEnabled) {
      this.logger.debug('Usage tracking is disabled');
      return;
    }

    try {
      this.logger.debug(`Processing AC state change for room ${event.roomId}`);

      // Extract user from event (matching Spring Boot extractUserFromEvent)
      const userContext = await this.extractUserFromEvent(event);
      if (!userContext) {
        this.logger.debug(`No user context found for room ${event.roomId}`);
        return;
      }

      const { userId, userName, roomName, quotaId } = userContext;
      const powerState = event.state.power === true;
      const sessionId = this.generateSessionId(userId, event.roomId);

      if (powerState) {
        // AC turned on - start or continue session
        await this.handleACPowerOn(
          userId,
          userName,
          event.roomId,
          roomName,
          quotaId,
          event.state,
          sessionId,
        );
      } else {
        // AC turned off - end session
        await this.handleACPowerOff(
          userId,
          userName,
          event.roomId,
          roomName,
          quotaId,
          sessionId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling AC state change for room ${event.roomId}`,
        error,
      );
    }
  }

  /**
   * Get active sessions for a user
   */
  getActiveSessions(userId: string): UsageSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.userId === userId && session.isActive,
    );
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): UsageSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * End session manually
   */
  async endSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    session.endTime = new Date();
    session.isActive = false;

    // Publish quota update
    await this.publishQuotaUpdate(session);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    this.logger.debug(
      `Ended session ${sessionId} for user ${session.userId}${reason ? ` (${reason})` : ''}`,
    );
  }

  // Private methods

  /**
   * Setup event listeners (matching Spring Boot @EventListener pattern)
   */
  private setupEventListeners(): void {
    this.eventEmitter.on('mqtt.state.update', (event: MqttStateUpdateEvent) => {
      if (this.config.asyncProcessing) {
        // Process asynchronously to avoid blocking MQTT flow (matching Spring Boot @Async)
        this.handleAirConStateChange(event).catch((error) => {
          this.logger.error('Async state change processing failed', error);
        });
      } else {
        this.handleAirConStateChange(event).catch((error) => {
          this.logger.error('State change processing failed', error);
        });
      }
    });
  }

  /**
   * Start background tasks (matching Spring Boot @Scheduled)
   */
  private startBackgroundTasks(): void {
    // Session timeout monitoring
    interval(60000)
      .pipe(
        // Check every minute
        map(() => this.checkSessionTimeouts()),
        tap(() => this.logger.debug('Session timeout check completed')),
      )
      .subscribe();

    // Batch processing
    if (this.config.asyncProcessing) {
      interval(this.config.batchTimeoutMs)
        .pipe(
          map(() => this.processBatch()),
          tap(() => this.logger.debug('Batch processing completed')),
        )
        .subscribe();
    }
  }

  /**
   * Extract user context from MQTT event (matching Spring Boot extractUserFromEvent)
   */
  private async extractUserFromEvent(event: MqttStateUpdateEvent): Promise<{
    userId: string;
    userName: string;
    roomName: string;
    quotaId: string;
  } | null> {
    try {
      // For now, we'll use a simple mapping - in a real implementation,
      // this would involve device-to-user resolution logic
      const household = await this.householdRepository.findOne({
        where: {},
        relations: ['members'],
      });

      if (!household || household.members.length === 0) {
        return null;
      }

      // Use first user in household (simplified for demo)
      const user = household.members[0];
      const roomName = `Room ${event.roomId}`; // Simplified room name resolution
      const quotaId = `quota-${user.id}-${event.roomId}`;

      return {
        userId: user.id,
        userName: user.name || user.email,
        roomName,
        quotaId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to extract user context for room ${event.roomId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Handle AC power on (matching Spring Boot handleACPowerOn)
   */
  private async handleACPowerOn(
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    quotaId: string,
    state: AirConState,
    sessionId: string,
  ): Promise<void> {
    const existingSession = this.activeSessions.get(sessionId);

    if (existingSession && existingSession.isActive) {
      // Update existing session
      existingSession.currentTemperature = state.temperature;
      existingSession.mode = state.mode || existingSession.mode;
      existingSession.fanSpeed = state.fanSpeed || existingSession.fanSpeed;

      this.logger.debug(
        `Updated existing session ${sessionId} for user ${userId}`,
      );
    } else {
      // Create new session
      const newSession: UsageSession = {
        sessionId,
        userId,
        userName,
        roomId,
        roomName,
        startTime: new Date(),
        startTemperature: state.temperature || 22,
        currentTemperature: state.temperature,
        mode: state.mode || 'auto',
        fanSpeed: state.fanSpeed || 'auto',
        isActive: true,
        quotaId,
      };

      this.activeSessions.set(sessionId, newSession);
      this.logger.debug(`Started new session ${sessionId} for user ${userId}`);
    }

    // Check quota thresholds
    await this.checkQuotaThresholds(sessionId);
  }

  /**
   * Handle AC power off (matching Spring Boot handleACPowerOff)
   */
  private async handleACPowerOff(
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    quotaId: string,
    sessionId: string,
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    // End the session
    session.endTime = new Date();
    session.isActive = false;

    // Calculate usage and update quota
    await this.publishQuotaUpdate(session);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    this.logger.debug(
      `Ended session ${sessionId} for user ${userId} (AC powered off)`,
    );
  }

  /**
   * Check quota thresholds (matching Spring Boot checkQuotaThresholds)
   */
  private async checkQuotaThresholds(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    try {
      // Get current quota usage
      const validationResult =
        await this.quotaValidationService.validateQuotaUsage({
          userId: session.userId,
          roomId: session.roomId,
          deviceId: session.roomId,
          operation: {
            type: 'QUOTA_CHECK',
            value: null,
          },
        });

      const balance = validationResult.balance;
      if (!balance) {
        return;
      }

      // Check different quota types and thresholds
      const thresholds = [75, 90, 95]; // Warning thresholds at 75%, 90%, 95%

      for (const threshold of thresholds) {
        let usagePercent = 0;
        let violationType:
          | 'TIME_QUOTA'
          | 'COUNT_QUOTA'
          | 'ENERGY_QUOTA'
          | 'COST_QUOTA'
          | null = null;

        const allowed = balance.allowedAmount ?? 0;
        const remaining = balance.remainingAmount ?? 0;
        if (allowed > 0) {
          usagePercent = Math.min(100, ((allowed - remaining) / allowed) * 100);
        }
        // Map quotaType string to violation type; default to TIME_QUOTA
        const qt = String(balance.quotaType || '').toUpperCase();
        if (qt.includes('COUNT')) violationType = 'COUNT_QUOTA';
        else if (qt.includes('ENERGY')) violationType = 'ENERGY_QUOTA';
        else if (qt.includes('COST')) violationType = 'COST_QUOTA';
        else violationType = 'TIME_QUOTA';

        if (violationType && usagePercent >= threshold) {
          // Publish quota violation event
          this.eventPublisher.publishQuotaViolation(
            session.quotaId,
            session.userId,
            session.userName,
            session.roomId,
            session.roomName,
            violationType,
            usagePercent,
            100.0,
          );

          this.logger.warn(
            `Quota threshold exceeded for user ${session.userId}: ${violationType} at ${usagePercent}%`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check quota thresholds for session ${sessionId}`,
        error,
      );
    }
  }

  /**
   * Publish quota update event
   */
  private async publishQuotaUpdate(session: UsageSession): Promise<void> {
    try {
      // Get current quota balance
      const validationResult =
        await this.quotaValidationService.validateQuotaUsage({
          userId: session.userId,
          roomId: session.roomId,
          deviceId: session.roomId,
          operation: {
            type: 'QUOTA_CHECK',
            value: null,
          },
        });

      const balance = validationResult.balance;
      if (!balance) {
        return;
      }

      // Publish quota update event
      // Map remainingAmount to the appropriate bucket for the event
      const qt = String(balance.quotaType || '').toUpperCase();
      const usageFields: {
        remainingSeconds?: number;
        remainingCount?: number;
        remainingEnergy?: number;
        remainingCost?: number;
      } = {};
      if (typeof balance.remainingAmount === 'number') {
        if (qt.includes('COUNT'))
          usageFields.remainingCount = balance.remainingAmount;
        else if (qt.includes('ENERGY'))
          usageFields.remainingEnergy = balance.remainingAmount;
        else if (qt.includes('COST'))
          usageFields.remainingCost = balance.remainingAmount;
        else usageFields.remainingSeconds = balance.remainingAmount; // assume time-based
      }

      this.eventPublisher.publishQuotaUpdate(
        session.quotaId,
        session.userId,
        session.userName,
        session.roomId,
        session.roomName,
        usageFields,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish quota update for session ${session.sessionId}`,
        error,
      );
    }
  }

  /**
   * Check session timeouts
   */
  private checkSessionTimeouts(): void {
    const now = new Date();
    const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions) {
      if (!session.isActive) {
        continue;
      }

      const sessionAge = now.getTime() - session.startTime.getTime();
      if (sessionAge > timeoutMs) {
        this.endSession(sessionId, 'Session timeout').catch((error) => {
          this.logger.error(
            `Failed to end timed out session ${sessionId}`,
            error,
          );
        });
      }
    }
  }

  /**
   * Process batch of sessions
   */
  private processBatch(): void {
    if (this.sessionQueue.length === 0) {
      return;
    }

    const batch = this.sessionQueue.splice(0, this.config.batchSize);
    this.logger.debug(`Processing batch of ${batch.length} sessions`);

    // Process batch (for now, just log - in real implementation would persist to database)
    batch.forEach((session) => {
      this.logger.debug(`Batch processing session ${session.sessionId}`);
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(userId: string, roomId: string): string {
    return `${userId}-${roomId}-${Date.now()}`;
  }
}
