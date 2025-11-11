import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UsageSessionService } from '../quotas/services/usage-session.service';
import { UsageSession } from '../quotas/entities/usage-session.entity';
import { UsageSummaryResponse } from './dto/usage-summary.dto';

@ApiTags('usage')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly sessions: UsageSessionService) {}

  @Get('summary/:userId')
  @ApiOperation({ summary: 'Get usage summary for user' })
  async getUsageSummary(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UsageSummaryResponse> {
    const period = this.parseDateRange(startDate, endDate);

    const summary = await this.sessions.getUsageSummary(
      userId,
      period.start,
      period.end,
    );

    return {
      userId,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      totals: summary.totals,
      sessionsCount: summary.sessionsCount,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('sessions/:userId')
  @ApiOperation({ summary: 'Get usage sessions for user' })
  async getUsageSessions(
    @Param('userId') userId: string,
    @Query('roomId') roomId?: string,
    @Query('limit') limit?: string,
  ): Promise<UsageSession[]> {
    const lim = limit ? this.parseLimit(limit) : 50;
    if (roomId) {
      return await this.sessions.findSessionsByRoomAndDateRange(
        userId,
        roomId,
        undefined,
        undefined,
        lim,
      );
    }

    return await this.sessions.findSessionsByDateRange(
      userId,
      undefined,
      undefined,
      lim,
    );
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

    // Normalize to start/end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { start: startDate, end: endDate };
  }

  private parseLimit(raw: string): number {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    return Math.min(parsed, 200);
  }
}
