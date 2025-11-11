import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, of } from 'rxjs';
import {
  QuotaUpdateEvent,
  QuotaViolationEvent,
} from '../../devices/interfaces/mqtt-events.interface';
import {
  WebSocketMessage,
  WebSocketMessageTypes,
  QuotaUpdatePayload,
  QuotaViolationPayload,
  OverrideRequestPayload,
  OverrideGrantedPayload,
  DailyUsageSummaryPayload,
} from '../../websockets/interfaces/websocket-messages.interface';
import { WebSocketSessionManagerService } from '../../websockets/services/websocket-session-manager.service';
import { EventPublisherService } from '../../events/services/event-publisher.service';

// Notification configuration interface
interface NotificationConfig {
  enableRealTimeUpdates: boolean;
  enableViolationAlerts: boolean;
  enableOverrideNotifications: boolean;
  enableDailySummaries: boolean;
  batchSize: number;
  batchTimeoutMs: number;
}

@Injectable()
export class QuotaNotificationService {
  private readonly logger = new Logger(QuotaNotificationService.name);
  private readonly config: NotificationConfig;

  constructor(
    private readonly sessionManager: WebSocketSessionManagerService,
    private readonly eventPublisher: EventPublisherService,
  ) {
    // Load configuration (matching Spring Boot @ConfigurationProperties)
    this.config = {
      enableRealTimeUpdates:
        process.env.QUOTA_NOTIFICATIONS_REALTIME !== 'false',
      enableViolationAlerts:
        process.env.QUOTA_NOTIFICATIONS_VIOLATIONS !== 'false',
      enableOverrideNotifications:
        process.env.QUOTA_NOTIFICATIONS_OVERRIDES !== 'false',
      enableDailySummaries: process.env.QUOTA_NOTIFICATIONS_DAILY !== 'false',
      batchSize: parseInt(
        process.env.QUOTA_NOTIFICATIONS_BATCH_SIZE || '10',
        10,
      ),
      batchTimeoutMs: parseInt(
        process.env.QUOTA_NOTIFICATIONS_BATCH_TIMEOUT || '1000',
        10,
      ),
    };

    this.logger.log('QuotaNotificationService initialized', this.config);
  }

  /**
   * Send quota threshold alert (matching Spring Boot sendQuotaThresholdAlert)
   */
  sendQuotaThresholdAlert(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    thresholdPercent: number,
    currentUsage: number,
    limit: number,
  ): Observable<void> {
    if (!this.config.enableRealTimeUpdates) {
      this.logger.debug('Real-time quota notifications are disabled');
      return of(undefined);
    }

    const message: WebSocketMessage<QuotaUpdatePayload> = {
      type: WebSocketMessageTypes.QUOTA_UPDATE,
      payload: {
        quotaId,
        familyMemberId: userId,
        roomId,
        currentUsage,
        dailyLimit: limit,
        status:
          thresholdPercent >= 90
            ? 'CRITICAL'
            : thresholdPercent >= 75
              ? 'WARNING'
              : 'NORMAL',
        isCurrentlyActive: true, // Would check actual session state
        estimatedSessionUsage: 0, // Would calculate based on current session
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.logger.debug(
      `Sending quota threshold alert to user ${userId}: ${thresholdPercent}%`,
    );

    // Send to user-specific sessions
    const sentCount = this.sessionManager.sendToUser(userId, message);
    this.logger.debug(
      `Quota threshold alert sent to ${sentCount} sessions for user ${userId}`,
    );

    return of(undefined);
  }

  /**
   * Send quota violation notification (matching Spring Boot sendQuotaViolation)
   */
  sendQuotaViolation(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    violationType: 'TIME_QUOTA' | 'COUNT_QUOTA' | 'ENERGY_QUOTA' | 'COST_QUOTA',
    currentUsage: number,
    limit: number,
  ): Observable<void> {
    if (!this.config.enableViolationAlerts) {
      this.logger.debug('Quota violation alerts are disabled');
      return of(undefined);
    }

    const message: WebSocketMessage<QuotaViolationPayload> = {
      type: WebSocketMessageTypes.QUOTA_VIOLATION_ALERT,
      payload: {
        quotaId,
        familyMemberId: userId,
        familyMemberName: userName,
        roomId,
        roomName,
        violationType,
        currentUsage,
        limit,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.logger.warn(
      `Sending quota violation alert to user ${userId}: ${violationType}`,
    );

    // Send to user-specific sessions
    const sentCount = this.sessionManager.sendToUser(userId, message);
    this.logger.debug(
      `Quota violation alert sent to ${sentCount} sessions for user ${userId}`,
    );

    // Also broadcast to room for admin/monitoring
    const roomSentCount = this.sessionManager.sendToRoom(roomId, message);
    this.logger.debug(
      `Quota violation alert sent to ${roomSentCount} room sessions for ${roomId}`,
    );

    return of(undefined);
  }

  /**
   * Send override request notification (matching Spring Boot sendOverrideRequest)
   */
  sendOverrideRequest(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    requestedMinutes: number,
    reason: string,
  ): Observable<void> {
    if (!this.config.enableOverrideNotifications) {
      this.logger.debug('Override notifications are disabled');
      return of(undefined);
    }

    const message: WebSocketMessage<OverrideRequestPayload> = {
      type: WebSocketMessageTypes.OVERRIDE_REQUEST,
      payload: {
        quotaId,
        familyMemberId: userId,
        familyMemberName: userName,
        roomId,
        roomName,
        requestedMinutes,
        reason,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.logger.debug(
      `Sending override request for user ${userId} in room ${roomId}`,
    );

    // Broadcast to admin/monitoring sessions
    const sentCount = this.sessionManager.broadcast(message);
    this.logger.debug(`Override request sent to ${sentCount} sessions`);

    return of(undefined);
  }

  /**
   * Send override granted notification (matching Spring Boot sendOverrideGranted)
   */
  sendOverrideGranted(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    grantedMinutes: number,
    approvedBy: string,
  ): Observable<void> {
    if (!this.config.enableOverrideNotifications) {
      return of(undefined);
    }

    const message: WebSocketMessage<OverrideGrantedPayload> = {
      type: WebSocketMessageTypes.OVERRIDE_GRANTED,
      payload: {
        quotaId,
        familyMemberId: userId,
        familyMemberName: userName,
        roomId,
        roomName,
        grantedMinutes,
        approvedBy,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.logger.debug(
      `Sending override granted notification to user ${userId}`,
    );

    // Send to user
    const userSentCount = this.sessionManager.sendToUser(userId, message);

    // Send to room for monitoring
    const roomSentCount = this.sessionManager.sendToRoom(roomId, message);

    this.logger.debug(
      `Override granted sent to ${userSentCount} user sessions and ${roomSentCount} room sessions`,
    );

    return of(undefined);
  }

  /**
   * Send quota reset notification (matching Spring Boot sendQuotaReset)
   */
  sendQuotaReset(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
  ): Observable<void> {
    const message: WebSocketMessage<any> = {
      type: WebSocketMessageTypes.QUOTA_RESET,
      payload: {
        quotaId,
        familyMemberId: userId,
        familyMemberName: userName,
        roomId,
        roomName,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.logger.debug(`Sending quota reset notification for user ${userId}`);

    const sentCount = this.sessionManager.sendToUser(userId, message);
    this.logger.debug(`Quota reset notification sent to ${sentCount} sessions`);

    return of(undefined);
  }

  /**
   * Send daily usage summary (matching Spring Boot sendDailyUsageSummary)
   */
  sendDailyUsageSummary(
    userId: string,
    userName: string,
    date: string,
    totalUsageHours: number,
    totalSessions: number,
    roomUsage: Array<{
      roomId: string;
      roomName: string;
      usageHours: number;
      sessions: number;
    }>,
  ): Observable<void> {
    if (!this.config.enableDailySummaries) {
      this.logger.debug('Daily usage summaries are disabled');
      return of(undefined);
    }

    const message: WebSocketMessage<DailyUsageSummaryPayload> = {
      type: WebSocketMessageTypes.DAILY_USAGE_SUMMARY,
      payload: {
        familyMemberId: userId,
        familyMemberName: userName,
        date,
        totalUsageHours,
        totalSessions,
        averageSessionLength:
          totalSessions > 0 ? totalUsageHours / totalSessions : 0,
        roomUsage,
      },
      timestamp: new Date(),
    };

    this.logger.debug(
      `Sending daily usage summary to user ${userId} for ${date}`,
    );

    const sentCount = this.sessionManager.sendToUser(userId, message);
    this.logger.debug(`Daily usage summary sent to ${sentCount} sessions`);

    return of(undefined);
  }

  // Event listeners matching Spring Boot @EventListener pattern

  /**
   * Handle quota update events (matching Spring Boot handleQuotaUpdateEvent)
   */
  @OnEvent('quota.update')
  handleQuotaUpdateEvent(event: QuotaUpdateEvent): void {
    if (!this.config.enableRealTimeUpdates) {
      return;
    }

    try {
      const message: WebSocketMessage<QuotaUpdatePayload> = {
        type: WebSocketMessageTypes.QUOTA_UPDATE,
        payload: {
          quotaId: event.quotaId,
          familyMemberId: event.userId,
          roomId: event.roomId,
          currentUsage: this.calculateCurrentUsage(event.usage),
          dailyLimit: this.calculateDailyLimit(event.usage),
          status: this.calculateQuotaStatus(event.usage),
          isCurrentlyActive: true, // Would check actual session state
          estimatedSessionUsage: 0, // Would calculate based on current session
          lastUpdated: event.timestamp.toISOString(),
        },
        timestamp: new Date(),
      };

      // Send to user sessions
      const sentCount = this.sessionManager.sendToUser(event.userId, message);
      this.logger.debug(
        `Quota update sent to ${sentCount} sessions for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle quota update event for user ${event.userId}`,
        error,
      );
    }
  }

  /**
   * Handle quota violation events (matching Spring Boot handleQuotaViolationEvent)
   */
  @OnEvent('quota.violation')
  handleQuotaViolationEvent(event: QuotaViolationEvent): void {
    if (!this.config.enableViolationAlerts) {
      return;
    }

    try {
      const message: WebSocketMessage<QuotaViolationPayload> = {
        type: WebSocketMessageTypes.QUOTA_VIOLATION_ALERT,
        payload: {
          quotaId: event.quotaId,
          familyMemberId: event.userId,
          familyMemberName: event.userName,
          roomId: event.roomId,
          roomName: event.roomName,
          violationType: event.violationType,
          currentUsage: (event.usagePercent / 100) * event.limitPercent,
          limit: event.limitPercent,
          timestamp: event.timestamp.toISOString(),
        },
        timestamp: new Date(),
      };

      // Send to user sessions
      const userSentCount = this.sessionManager.sendToUser(
        event.userId,
        message,
      );

      // Send to room sessions for monitoring
      const roomSentCount = this.sessionManager.sendToRoom(
        event.roomId,
        message,
      );

      this.logger.debug(
        `Quota violation alert sent to ${userSentCount} user sessions and ${roomSentCount} room sessions`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle quota violation event for user ${event.userId}`,
        error,
      );
    }
  }

  // Private helper methods

  /**
   * Calculate current usage from usage object
   */
  private calculateCurrentUsage(usage: {
    remainingSeconds?: number;
    remainingCount?: number;
    remainingEnergy?: number;
    remainingCost?: number;
  }): number {
    if (usage.remainingSeconds !== undefined) {
      return 8 * 3600 - usage.remainingSeconds; // 8 hours default
    } else if (usage.remainingCount !== undefined) {
      return 20 - usage.remainingCount; // 20 uses default
    } else if (usage.remainingEnergy !== undefined) {
      return 10 - usage.remainingEnergy; // 10 kWh default
    } else if (usage.remainingCost !== undefined) {
      return 5 - usage.remainingCost; // $5 default
    }
    return 0;
  }

  /**
   * Calculate daily limit from usage object
   */
  private calculateDailyLimit(usage: {
    remainingSeconds?: number;
    remainingCount?: number;
    remainingEnergy?: number;
    remainingCost?: number;
  }): number {
    if (usage.remainingSeconds !== undefined) {
      return 8 * 3600; // 8 hours
    } else if (usage.remainingCount !== undefined) {
      return 20; // 20 uses
    } else if (usage.remainingEnergy !== undefined) {
      return 10; // 10 kWh
    } else if (usage.remainingCost !== undefined) {
      return 5; // $5
    }
    return 100; // Default
  }

  /**
   * Calculate quota status from usage object
   */
  private calculateQuotaStatus(usage: {
    remainingSeconds?: number;
    remainingCount?: number;
    remainingEnergy?: number;
    remainingCost?: number;
  }): 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED' {
    const current = this.calculateCurrentUsage(usage);
    const limit = this.calculateDailyLimit(usage);
    const percent = (current / limit) * 100;

    if (percent >= 100) return 'EXCEEDED';
    if (percent >= 90) return 'CRITICAL';
    if (percent >= 75) return 'WARNING';
    return 'NORMAL';
  }
}
