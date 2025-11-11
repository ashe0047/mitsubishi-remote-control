import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuotaViolationsService } from '../services/quota-violations.service';
import { CreateViolationDto } from '../dto/create-violation.dto';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../users/enums/access.enums';

@ApiTags('quota violations')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('quotas/violations')
export class QuotaViolationsController {
  constructor(private readonly violations: QuotaViolationsService) {}

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List quota violations for user' })
  async listByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = this.parseLimit(limit);
    return await this.violations.listByUser(userId, parsedLimit, cursor);
  }

  @Get('room/:roomId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List quota violations for room' })
  async listByRoom(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = this.parseLimit(limit);
    return await this.violations.listByRoom(roomId, parsedLimit, cursor);
  }

  @Get('quota/:quotaId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List quota violations for quota' })
  async listByQuota(
    @Param('quotaId') quotaId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = this.parseLimit(limit);
    return await this.violations.listByQuota(quotaId, parsedLimit, cursor);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Create quota violation' })
  async createViolation(@Body() dto: CreateViolationDto) {
    return await this.violations.record({
      quotaId: dto.quotaId,
      userId: dto.userId,
      roomId: dto.roomId,
      violationType: dto.violationType,
      violationAmount: dto.violationAmount,
      quotaLimit: dto.quotaLimit,
      enforcementAction: dto.enforcementAction,
      usageSessionId: dto.usageSessionId,
      message: dto.message,
      metadata: dto.metadata ?? null,
    });
  }

  private parseLimit(raw?: string): number | undefined {
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
