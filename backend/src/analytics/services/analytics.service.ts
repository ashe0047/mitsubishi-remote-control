import { Injectable, Logger } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import {
  UsageStatistics,
  UsageTrends,
  HouseholdUsage,
  QuotaUtilization,
  UserInsights,
  SystemOverview,
  AnalyticsQuery,
  AnalyticsResponse,
  TimePeriod,
} from '../interfaces/analytics.interface';
import { ConfigService } from '@nestjs/config';
import { UsageSession } from 'src/quotas/entities/usage-session.entity';
import { Quota } from 'src/quotas/entities/quota.entity';
import { QuotaViolation } from 'src/quotas/entities/quota-violation.entity';
import { User } from 'src/users/entities/user.entity';
import { Household } from 'src/households/entities/household.entity';
import { QuotaStatus, QuotaType } from 'src/quotas/enums/quota-db.enums';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(UsageSession)
    private readonly usageSessionRepository: Repository<UsageSession>,
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    @InjectRepository(QuotaViolation)
    private readonly quotaViolationRepository: Repository<QuotaViolation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get comprehensive usage statistics for a user (matching Spring Boot getUserUsageStatistics)
   */
  async getUserUsageStatistics(
    userId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<UsageStatistics>> {
    try {
      const { startDate, endDate } = this.parseDateRange(query);
      const roomId = query.roomId;

      this.logger.debug(
        `Generating usage statistics for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Build query conditions
      const queryBuilder = this.usageSessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.room', 'room')
        .leftJoinAndSelect('session.quota', 'quota')
        .where('session.userId = :userId', { userId })
        .andWhere('session.startedAt >= :startDate', { startDate })
        .andWhere('session.startedAt <= :endDate', { endDate });

      if (roomId) {
        queryBuilder.andWhere('session.roomId = :roomId', { roomId });
      }

      const sessions = await queryBuilder
        .orderBy('session.startedAt', 'DESC')
        .getMany();

      // Calculate statistics
      const statistics = this.calculateUsageStatistics(
        sessions,
        startDate,
        endDate,
      );

      return {
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate usage statistics for user ${userId}`,
        error,
      );
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to generate usage statistics',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get usage trends for a user (matching Spring Boot getUserUsageTrends)
   */
  async getUserUsageTrends(
    userId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<UsageTrends>> {
    try {
      const trends = await this.calculateUsageTrends(userId, query);

      return {
        success: true,
        data: trends,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate usage trends for user ${userId}`,
        error,
      );
      return {
        success: false,
        error: {
          code: 'TRENDS_ERROR',
          message: 'Failed to generate usage trends',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get household usage analytics (matching Spring Boot getHouseholdUsageAnalytics)
   */
  async getHouseholdUsage(
    householdId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<HouseholdUsage>> {
    try {
      const { startDate, endDate } = this.parseDateRange(query);

      this.logger.debug(
        `Generating household usage for household ${householdId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Get household information
      const household = await this.householdRepository.findOne({
        where: { id: householdId },
        relations: ['members'],
      });

      if (!household) {
        throw new Error(`Household ${householdId} not found`);
      }

      // Get all user sessions in the household
      const userSessions = await this.usageSessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.room', 'room')
        .leftJoinAndSelect('session.user', 'user')
        .where('user.householdId = :householdId', { householdId })
        .andWhere('session.startedAt >= :startDate', { startDate })
        .andWhere('session.startedAt <= :endDate', { endDate })
        .orderBy('session.startedAt', 'DESC')
        .getMany();

      // Calculate household analytics
      const householdAnalytics = this.calculateHouseholdUsage(
        household,
        userSessions,
        startDate,
        endDate,
      );

      return {
        success: true,
        data: householdAnalytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate household usage for ${householdId}`,
        error,
      );
      return {
        success: false,
        error: {
          code: 'HOUSEHOLD_ANALYTICS_ERROR',
          message: 'Failed to generate household analytics',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get quota utilization analytics (matching Spring Boot getQuotaUtilizationAnalytics)
   */
  async getQuotaUtilization(
    userId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<QuotaUtilization>> {
    try {
      const { startDate, endDate } = this.parseDateRange(query);

      this.logger.debug(
        `Generating quota utilization for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Get user's quotas
      const quotas = await this.quotaRepository.find({
        where: { userId },
        relations: ['quotaViolations'],
      });

      // Get quota violations in the period
      const violations = await this.quotaViolationRepository
        .createQueryBuilder('violation')
        .leftJoinAndSelect('violation.quota', 'quota')
        .where('violation.userId = :userId', { userId })
        .andWhere('violation.createdAt >= :startDate', { startDate })
        .andWhere('violation.createdAt <= :endDate', { endDate })
        .orderBy('violation.createdAt', 'DESC')
        .getMany();

      // Calculate utilization
      const utilization = this.calculateQuotaUtilization(
        quotas,
        violations,
        startDate,
        endDate,
      );

      return {
        success: true,
        data: utilization,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate quota utilization for user ${userId}`,
        error,
      );
      return {
        success: false,
        error: {
          code: 'QUOTA_UTILIZATION_ERROR',
          message: 'Failed to generate quota utilization',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user insights and patterns (matching Spring Boot getUserInsights)
   */
  async getUserInsights(
    userId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<UserInsights>> {
    try {
      const { startDate, endDate } = this.parseDateRange(query);

      this.logger.debug(
        `Generating user insights for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Get user information
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Get detailed session data for pattern analysis
      const sessions = await this.usageSessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.room', 'room')
        .where('session.userId = :userId', { userId })
        .andWhere('session.startedAt >= :startDate', { startDate })
        .andWhere('session.startedAt <= :endDate', { endDate })
        .orderBy('session.startedAt', 'DESC')
        .getMany();

      // Calculate insights
      const insights = this.calculateUserInsights(
        user,
        sessions,
        startDate,
        endDate,
      );

      return {
        success: true,
        data: insights,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate user insights for ${userId}`,
        error,
      );
      return {
        success: false,
        error: {
          code: 'USER_INSIGHTS_ERROR',
          message: 'Failed to generate user insights',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get system overview analytics (matching Spring Boot getSystemOverview)
   */
  async getSystemOverview(): Promise<AnalyticsResponse<SystemOverview>> {
    try {
      this.logger.debug('Generating system overview analytics');

      // Get system metrics
      const overview = await this.calculateSystemOverview();

      return {
        success: true,
        data: overview,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to generate system overview', error);
      return {
        success: false,
        error: {
          code: 'SYSTEM_OVERVIEW_ERROR',
          message: 'Failed to generate system overview',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Private helper methods

  /**
   * Parse date range from query parameters
   */
  private parseDateRange(query: AnalyticsQuery): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      switch (query.period) {
        case TimePeriod.TODAY:
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
          );
          break;
        case TimePeriod.WEEK: {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          startDate = weekStart;
          endDate = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case TimePeriod.MONTH:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case TimePeriod.YEAR:
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear() + 1, 0, 1);
          break;
        default:
          // Default to last 30 days
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
      }
    }

    return { startDate, endDate };
  }

  /**
   * Calculate usage statistics from sessions
   */
  private calculateUsageStatistics(
    sessions: UsageSession[],
    startDate: Date,
    endDate: Date,
  ): UsageStatistics {
    const totalSessions = sessions.length;
    const totalDurationMinutes = sessions.reduce(
      (sum, s) => sum + (s.durationMinutes || 0),
      0,
    );
    const totalEnergyKwh = sessions.reduce(
      (sum, s) => sum + (s.energyConsumed ?? 0),
      0,
    );
    const totalCost = sessions.reduce(
      (sum, s) => sum + (s.estimatedCost ?? 0),
      0,
    );

    const averageSessionLength =
      totalSessions > 0 ? totalDurationMinutes / totalSessions : 0;
    const averageEnergyPerSession =
      totalSessions > 0 ? totalEnergyKwh / totalSessions : 0;
    const averageCostPerSession =
      totalSessions > 0 ? totalCost / totalSessions : 0;

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
        ),
      },
      statistics: {
        totalSessions,
        totalDurationMinutes,
        totalEnergyKwh,
        totalCost,
        averageSessionLengthMinutes:
          Math.round(averageSessionLength * 100) / 100,
        averageEnergyPerSessionKwh:
          Math.round(averageEnergyPerSession * 1000) / 1000,
        averageCostPerSession: Math.round(averageCostPerSession * 100) / 100,
      },
      sessions: sessions.map((session) => ({
        sessionId: session.id,
        roomId: session.roomId,
        roomName: session.room?.name || `Room ${session.roomId}`,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString() || '',
        durationMinutes: session.durationMinutes || 0,
        energyKwh: session.energyConsumed ?? 0,
        cost: session.estimatedCost ?? 0,
        peakTemperature: 0,
        averageTemperature: 0,
        mode: session.mode || 'unknown',
        fanSpeed: session.fanSpeed || 'unknown',
      })),
    };
  }

  /**
   * Calculate usage trends
   */
  private async calculateUsageTrends(
    userId: string,
    query: AnalyticsQuery,
  ): Promise<UsageTrends> {
    // This is a simplified implementation - in production, you'd use
    // more sophisticated time-series aggregation

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Get today's usage
    const todaySessions = await this.usageSessionRepository
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .andWhere('session.startedAt >= :todayStart', { todayStart })
      .andWhere('session.startedAt < :todayEnd', { todayEnd })
      .getMany();

    const todayStats = this.calculateUsageStatistics(
      todaySessions,
      todayStart,
      todayEnd,
    );

    // Get weekly data (last 4 weeks)
    const weeklyData: UsageTrends['weekly'] = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(
        now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000,
      );
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekSessions = await this.usageSessionRepository
        .createQueryBuilder('session')
        .where('session.userId = :userId', { userId })
        .andWhere('session.startedAt >= :weekStart', { weekStart })
        .andWhere('session.startedAt < :weekEnd', { weekEnd })
        .getMany();

      const weekStats = this.calculateUsageStatistics(
        weekSessions,
        weekStart,
        weekEnd,
      );

      weeklyData.push({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        sessions: weekStats.statistics.totalSessions,
        durationMinutes: weekStats.statistics.totalDurationMinutes,
        energyKwh: weekStats.statistics.totalEnergyKwh,
        cost: weekStats.statistics.totalCost,
        quotaUtilization: 0, // Would calculate based on quota limits
      });
    }

    // Get monthly data (last 6 months)
    const monthlyData: UsageTrends['monthly'] = [];
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        1,
      );
      const monthEnd = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        1,
      );

      const monthSessions = await this.usageSessionRepository
        .createQueryBuilder('session')
        .where('session.userId = :userId', { userId })
        .andWhere('session.startedAt >= :monthStart', { monthStart })
        .andWhere('session.startedAt < :monthEnd', { monthEnd })
        .getMany();

      const monthStats = this.calculateUsageStatistics(
        monthSessions,
        monthStart,
        monthEnd,
      );

      monthlyData.push({
        month: monthDate.toLocaleString('default', { month: 'long' }),
        year: monthDate.getFullYear(),
        sessions: monthStats.statistics.totalSessions,
        durationMinutes: monthStats.statistics.totalDurationMinutes,
        energyKwh: monthStats.statistics.totalEnergyKwh,
        cost: monthStats.statistics.totalCost,
        quotaUtilization: 0,
      });
    }

    return {
      today: {
        date: todayStart.toISOString().split('T')[0],
        sessions: todayStats.statistics.totalSessions,
        durationMinutes: todayStats.statistics.totalDurationMinutes,
        energyKwh: todayStats.statistics.totalEnergyKwh,
        cost: todayStats.statistics.totalCost,
        quotaUtilization: 0,
      },
      weekly: weeklyData.reverse(),
      monthly: monthlyData.reverse(),
      insights: {
        trendDirection: 'stable', // Would calculate based on historical data
        weeklyGrowthRate: 0,
        monthlyGrowthRate: 0,
        peakUsageDay: 'Monday', // Would analyze day-of-week patterns
        averageDailyUsage: todayStats.statistics.totalDurationMinutes,
      },
    };
  }

  /**
   * Calculate household usage analytics
   */
  private calculateHouseholdUsage(
    household: Household,
    sessions: UsageSession[],
    startDate: Date,
    endDate: Date,
  ): HouseholdUsage {
    // Group sessions by user
    const sessionsByUser = new Map<string, UsageSession[]>();
    const sessionsByRoom = new Map<string, UsageSession[]>();

    sessions.forEach((session) => {
      // Group by user
      if (!sessionsByUser.has(session.userId)) {
        sessionsByUser.set(session.userId, []);
      }
      sessionsByUser.get(session.userId)!.push(session);

      // Group by room
      if (!sessionsByRoom.has(session.roomId)) {
        sessionsByRoom.set(session.roomId, []);
      }
      sessionsByRoom.get(session.roomId)!.push(session);
    });

    // Calculate usage by family member
    const usageByFamilyMember = Array.from(sessionsByUser.entries()).map(
      ([userId, userSessions]) => {
        const totalDuration = userSessions.reduce(
          (sum, s) => sum + (s.durationMinutes || 0),
          0,
        );
        const totalEnergy = userSessions.reduce(
          (sum, s) => sum + (s.energyConsumed ?? 0),
          0,
        );
        const totalCost = userSessions.reduce(
          (sum, s) => sum + (s.estimatedCost ?? 0),
          0,
        );

        const user = household.members.find((u) => u.id === userId);

        return {
          userId,
          userName: user?.name || user?.email || `User ${userId}`,
          sessions: userSessions.length,
          durationMinutes: totalDuration,
          energyKwh: totalEnergy,
          cost: totalCost,
          quotaUtilization: 0, // Would calculate based on quota limits
          complianceRate: 0, // Would calculate based on violations
        };
      },
    );

    // Calculate usage by room
    const usageByRoom = Array.from(sessionsByRoom.entries()).map(
      ([roomId, roomSessions]) => {
        const totalDuration = roomSessions.reduce(
          (sum, s) => sum + (s.durationMinutes || 0),
          0,
        );
        const totalEnergy = roomSessions.reduce(
          (sum, s) => sum + (s.energyConsumed ?? 0),
          0,
        );
        const totalCost = roomSessions.reduce(
          (sum, s) => sum + (s.estimatedCost ?? 0),
          0,
        );

        // Find most frequent user for this room
        const userFrequency = new Map<string, number>();
        roomSessions.forEach((session) => {
          userFrequency.set(
            session.userId,
            (userFrequency.get(session.userId) || 0) + 1,
          );
        });
        const mostUsedBy =
          Array.from(userFrequency.entries()).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0] || '';

        const mostUsedUser = household.members.find((u) => u.id === mostUsedBy);

        return {
          roomId,
          roomName: `Room ${roomId}`, // Would get from room entity
          sessions: roomSessions.length,
          durationMinutes: totalDuration,
          energyKwh: totalEnergy,
          cost: totalCost,
          averageSessionLength:
            roomSessions.length > 0 ? totalDuration / roomSessions.length : 0,
          mostUsedBy: mostUsedUser?.name || mostUsedUser?.email || 'Unknown',
        };
      },
    );

    // Calculate totals
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.durationMinutes || 0),
      0,
    );
    const totalEnergy = sessions.reduce(
      (sum, s) => sum + (s.energyConsumed ?? 0),
      0,
    );
    const totalCost = sessions.reduce(
      (sum, s) => sum + (s.estimatedCost ?? 0),
      0,
    );
    const userCount = usageByFamilyMember.length;

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
        ),
      },
      family: {
        householdId: household.id,
        householdName: household.name || `Household ${household.id}`,
        totalUsers: household.members.length,
      },
      usageByFamilyMember,
      usageByRoom,
      totalUsage: {
        totalSessions,
        totalDurationMinutes: totalDuration,
        totalEnergyKwh: totalEnergy,
        totalCost: totalCost,
        averagePerUser: {
          sessions: userCount > 0 ? Math.round(totalSessions / userCount) : 0,
          durationMinutes:
            userCount > 0 ? Math.round(totalDuration / userCount) : 0,
          energyKwh:
            userCount > 0
              ? Math.round((totalEnergy / userCount) * 1000) / 1000
              : 0,
          cost:
            userCount > 0 ? Math.round((totalCost / userCount) * 100) / 100 : 0,
        },
      },
    };
  }

  /**
   * Calculate quota utilization analytics
   */
  private calculateQuotaUtilization(
    quotas: Quota[],
    violations: QuotaViolation[],
    startDate: Date,
    endDate: Date,
  ): QuotaUtilization {
    // Calculate quota utilization for each quota type
    const quotaTypes: QuotaUtilization['quotaTypes'] = quotas.map(
      (quota): QuotaUtilization['quotaTypes'][number] => {
        const currentUsage = this.getCurrentQuotaUsage(quota);
        const limit = quota.allowedAmount;
        const utilizationPercent = limit > 0 ? (currentUsage / limit) * 100 : 0;

        // Determine status based on utilization
        let status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED' = 'NORMAL';
        if (utilizationPercent >= 100) status = 'EXCEEDED';
        else if (utilizationPercent >= 90) status = 'CRITICAL';
        else if (utilizationPercent >= 75) status = 'WARNING';

        const quotaType: 'TIME' | 'ENERGY' | 'COST' | 'COUNT' =
          quota.quotaType === QuotaType.TIME_BASED
            ? 'TIME'
            : quota.quotaType === QuotaType.ENERGY_BASED
              ? 'ENERGY'
              : quota.quotaType === QuotaType.COST_BASED
                ? 'COST'
                : 'COUNT';

        return {
          quotaType,
          quotaId: quota.id,
          quotaName: quota.name,
          currentLimit: limit,
          currentUsage,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100,
          remainingAmount: Math.max(0, limit - currentUsage),
          status,
          trendDirection: 'stable',
        };
      },
    );

    // Process violations
    const processedViolations = violations.map((violation) => ({
      quotaType: violation.violationType,
      violationDate: violation.createdAt.toISOString(),
      exceededAmount: violation.excessAmount,
      limitAmount: violation.quotaLimit,
      overrideUsed: violation.overrideGranted || false,
      overrideMinutes: violation.overrideDurationMinutes ?? undefined,
      reason: violation.overrideReason || violation.message || 'Quota exceeded',
    }));

    // Calculate compliance metrics
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    const daysInCompliance = Math.max(
      0,
      totalDays - processedViolations.length,
    );
    const overallComplianceRate =
      totalDays > 0 ? (daysInCompliance / totalDays) * 100 : 0;
    const violationFrequency = processedViolations.length;
    const averageTimeToViolation =
      violationFrequency > 0 ? totalDays / violationFrequency : 0;

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      quotaTypes,
      violations: processedViolations,
      compliance: {
        overallComplianceRate: Math.round(overallComplianceRate * 100) / 100,
        daysInCompliance,
        totalDays,
        violationFrequency,
        averageTimeToViolation: Math.round(averageTimeToViolation * 100) / 100,
      },
    };
  }

  /**
   * Calculate user insights and patterns
   */
  private calculateUserInsights(
    user: User,
    sessions: UsageSession[],
    startDate: Date,
    endDate: Date,
  ): UserInsights {
    // Analyze usage patterns
    const usagePatterns = this.analyzeUsagePatterns(sessions);

    // Calculate efficiency metrics
    const efficiency = this.calculateEfficiencyMetrics(sessions);

    // Generate recommendations
    const recommendations = this.generateRecommendations(sessions, efficiency);

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      user: {
        userId: user.id,
        userName: user.name || user.email,
      },
      usagePatterns,
      efficiency,
      recommendations,
    };
  }

  /**
   * Calculate system overview
   */
  private async calculateSystemOverview(): Promise<SystemOverview> {
    const now = new Date();

    // Get system metrics
    const totalUsers = await this.userRepository.count();
    const totalHouseholds = await this.householdRepository.count();
    const activeQuotas = await this.quotaRepository.count({
      where: { status: QuotaStatus.ACTIVE },
    });
    const activeSessions = await this.usageSessionRepository.count({
      where: { endedAt: IsNull() },
    });

    return {
      timestamp: now.toISOString(),
      system: {
        version: '2.0.0', // Would get from package.json or environment
        uptime: process.uptime(),
        activeConnections: 0, // Would get from WebSocket manager
        totalUsers,
        totalHouseholds,
        totalRooms: 0, // Would get from room repository
      },
      performance: {
        averageResponseTime: 0, // Would get from performance monitoring
        cacheHitRate: 0, // Would get from Redis metrics
        databaseConnections: 0, // Would get from database pool metrics
        mqttConnectionStatus: 'connected', // Would get from MQTT service
        websocketConnections: 0, // Would get from WebSocket manager
      },
      quotas: {
        totalActiveQuotas: activeQuotas,
        quotasInWarning: 0, // Would calculate based on utilization
        quotasInCritical: 0,
        quotasExceeded: 0,
        overrideRequestsToday: 0,
        overrideRequestsApproved: 0,
      },
      usage: {
        activeSessions,
        sessionsToday: 0, // Would count today's sessions
        totalUsageToday: {
          durationMinutes: 0,
          energyKwh: 0,
          cost: 0,
        },
        peakUsageHour: 14, // Would analyze from historical data
        averageSessionDuration: 0,
      },
      health: {
        overallStatus: 'healthy',
        issues: [],
        lastHealthCheck: now.toISOString(),
      },
    };
  }

  // Additional helper methods (simplified for brevity)
  private getCurrentQuotaUsage(quota: Quota): number {
    // Base implementation uses usedAmount; future logic can specialize per type
    return quota.usedAmount ?? 0;
  }

  private analyzeUsagePatterns(
    sessions: UsageSession[],
  ): UserInsights['usagePatterns'] {
    // Analyze preferred rooms, modes, peak hours, etc.
    return {
      typicalSessionLength: 0,
      preferredRooms: [],
      preferredModes: [],
      peakUsageHours: [],
      dayOfWeekPatterns: [],
    };
  }

  private calculateEfficiencyMetrics(
    sessions: UsageSession[],
  ): UserInsights['efficiency'] {
    // Calculate energy and cost efficiency
    return {
      energyEfficiencyRating: 5,
      costEfficiencyRating: 5,
      optimalTemperatureSettings: [],
      wasteDetection: [],
    };
  }

  private generateRecommendations(
    sessions: UsageSession[],
    efficiency: UserInsights['efficiency'],
  ): UserInsights['recommendations'] {
    // Generate personalized recommendations
    return [];
  }
}
