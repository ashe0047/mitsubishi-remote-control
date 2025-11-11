import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UsageSessionService } from '../quotas/services/usage-session.service';
import { QuotaViolationsService } from '../quotas/services/quota-violations.service';
import { AnalyticsUsageResponse } from './dto/usage-summary.dto';
import {
  AnalyticsResponse,
  UsageStatistics,
  UsageTrends,
  HouseholdUsage,
  QuotaUtilization,
  UserInsights,
  SystemOverview,
  AnalyticsQuery,
  TimePeriod,
} from './interfaces/analytics.interface';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { AnalyticsService } from './services/analytics.service';
import { Roles, UserRole } from 'src/shared/decorators/roles.decorator';

@ApiTags('analytics')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly sessions: UsageSessionService,
    private readonly violations: QuotaViolationsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('user/:userId/usage')
  @ApiOperation({ summary: 'Get user usage analytics' })
  async getUserUsageAnalytics(
    @Param('userId') userId: string,
    @Query('roomId') roomId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AnalyticsUsageResponse> {
    const period = this.parseDateRange(startDate, endDate);

    const statistics = await this.sessions.getUsageStatistics(
      userId,
      period.start,
      period.end,
      roomId,
    );

    const todayUsage = await this.sessions.calculateDailyUsage(
      userId,
      new Date(),
    );
    const sessions = await this.sessions.findSessionsByDateRange(
      userId,
      period.start,
      period.end,
      100,
      roomId,
    );

    const recentViolations = await this.violations.listByUser(userId, 5);

    return {
      userId,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      roomId: roomId ?? null,
      statistics: {
        totals: statistics.totals,
        sessionsCount: statistics.sessionsCount,
        violations: recentViolations,
      },
      todayUsageSeconds: todayUsage.durationSeconds,
      sessions: sessions.map((session) => ({
        id: session.id,
        roomId: session.roomId,
        deviceId: session.deviceId,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
        energyConsumed: session.energyConsumed,
        estimatedCost: session.estimatedCost,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  // Advanced Analytics Endpoints

  @Get('user/:userId/trends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get usage trends and analytics for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: TimePeriod,
    description: 'Analysis period',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage trends retrieved successfully',
  })
  async getUserUsageTrends(
    @Param('userId') userId: string,
    @Query() query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<UsageTrends>> {
    return this.analyticsService.getUserUsageTrends(userId, query);
  }

  @Get('user/:userId/insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed insights and patterns for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: TimePeriod,
    description: 'Analysis period',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date',
  })
  @ApiResponse({
    status: 200,
    description: 'User insights retrieved successfully',
  })
  async getUserInsights(
    @Param('userId') userId: string,
    @Query() query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<UserInsights>> {
    return this.analyticsService.getUserInsights(userId, query);
  }

  @Get('household/usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get household-wide usage analytics' })
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiQuery({
    name: 'householdId',
    required: true,
    description: 'Household ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: TimePeriod,
    description: 'Predefined period',
  })
  @ApiResponse({
    status: 200,
    description: 'Household usage analytics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getHouseholdUsage(
    @Query('householdId') householdId: string,
    @Query() query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<HouseholdUsage>> {
    return this.analyticsService.getHouseholdUsage(householdId, query);
  }

  @Get('quota/utilization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quota utilization analytics' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User ID (optional for admin view)',
  })
  @ApiQuery({
    name: 'quotaType',
    required: false,
    enum: ['TIME', 'ENERGY', 'COST', 'COUNT'],
    description: 'Filter by quota type',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', 'week', 'month'],
    description: 'Analysis period',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date',
  })
  @ApiResponse({
    status: 200,
    description: 'Quota utilization analytics retrieved successfully',
  })
  async getQuotaUtilization(
    @Query() query: AnalyticsQuery,
    @Query('userId') userId?: string,
  ): Promise<AnalyticsResponse<QuotaUtilization>> {
    if (!userId) {
      throw new BadRequestException(
        'User ID is required for quota utilization analytics',
      );
    }
    return this.analyticsService.getQuotaUtilization(userId, query);
  }

  @Get('quota/compliance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quota compliance metrics and violations' })
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User ID (optional for household view)',
  })
  @ApiQuery({
    name: 'householdId',
    required: false,
    description: 'Household ID (optional for household view)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month'],
    description: 'Compliance period',
  })
  @ApiQuery({
    name: 'includeViolations',
    required: false,
    type: Boolean,
    description: 'Include violation details',
  })
  @ApiResponse({
    status: 200,
    description: 'Quota compliance analytics retrieved successfully',
  })
  async getQuotaCompliance(
    @Query('userId') userId?: string,
    @Query('householdId') householdId?: string,
    @Query('period') period: TimePeriod = TimePeriod.MONTH,
    @Query('includeViolations') includeViolations: boolean = false,
  ): Promise<AnalyticsResponse<QuotaUtilization>> {
    if (!userId && !householdId) {
      throw new BadRequestException(
        'Either userId or householdId must be provided',
      );
    }
    if (userId) {
      return this.analyticsService.getQuotaUtilization(userId, {
        period,
      });
    }
    throw new BadRequestException(
      'Household compliance view not yet implemented',
    );
  }

  @Get('system/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get system-wide overview and health metrics' })
  @Roles(UserRole.ADMIN)
  @ApiQuery({
    name: 'include',
    required: false,
    enum: ['performance', 'health'],
    description: 'Include specific metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System overview retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getSystemOverview(
    @Query('include') include?: string,
  ): Promise<AnalyticsResponse<SystemOverview>> {
    return this.analyticsService.getSystemOverview();
  }

  // Convenience endpoints for common use cases

  @Get('user/:userId/efficiency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user efficiency ratings and recommendations' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month'],
    description: 'Analysis period',
  })
  @ApiResponse({
    status: 200,
    description: 'User efficiency analytics retrieved successfully',
  })
  async getUserEfficiency(
    @Param('userId') userId: string,
    @Query('period') period: TimePeriod = TimePeriod.MONTH,
  ): Promise<AnalyticsResponse<UserInsights>> {
    return this.analyticsService.getUserInsights(userId, { period });
  }

  @Get('dashboard/parent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get parent dashboard with household overview' })
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiQuery({
    name: 'householdId',
    required: true,
    description: 'Household ID',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', 'week'],
    description: 'Dashboard period',
  })
  @ApiResponse({
    status: 200,
    description: 'Parent dashboard data retrieved successfully',
  })
  async getParentDashboard(
    @Query('householdId') householdId: string,
    @Query('period') period: TimePeriod = TimePeriod.WEEK,
  ): Promise<AnalyticsResponse<HouseholdUsage>> {
    return this.analyticsService.getHouseholdUsage(householdId, {
      period,
    });
  }

  @Get('dashboard/admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get admin dashboard with system overview' })
  @Roles(UserRole.ADMIN)
  @ApiResponse({
    status: 200,
    description: 'Admin dashboard data retrieved successfully',
  })
  async getAdminDashboard(): Promise<AnalyticsResponse<SystemOverview>> {
    return this.analyticsService.getSystemOverview();
  }

  private parseDateRange(
    start?: string,
    end?: string,
  ): {
    start: Date;
    end: Date;
  } {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let startDate = start ? new Date(start) : defaultStart;
    let endDate = end ? new Date(end) : now;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { start: startDate, end: endDate };
  }
}
