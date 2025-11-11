import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuotaValidationService } from '../services/quota-validation.service';
import { QuotaCacheService } from '../services/quota-cache.service';
import { QuotaCalculationEngine } from '../services/quota-calculation-engine.service';
import { Quota } from '../entities/quota.entity';
import { CreateQuotaDto } from '../dto/create-quota.dto';
import { UpdateQuotaDto } from '../dto/update-quota.dto';
import { QuotaValidationDto } from '../dto/quota-validation.dto';
import {
  QuotaBalance,
  QuotaValidationResult,
} from '../interfaces/device-operation.interface';
import { PerformanceSummary } from '../services/quota-validation.service';
import { QuotaService } from '../services/quota.service';
import { QuotaOverrideService } from '../services/quota-override.service';
import { CreateOverrideDto } from '../dto/create-override.dto';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtClaims } from '../../shared/types/auth';
import { UserRole } from '../../users/enums/access.enums';

@ApiTags('quotas')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('quotas')
export class QuotaController {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly quotaOverrideService: QuotaOverrideService,
    private readonly quotaValidationService: QuotaValidationService,
    private readonly quotaCacheService: QuotaCacheService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate quota usage for device operation' })
  async validateQuota(
    @Body() validationDto: QuotaValidationDto,
  ): Promise<QuotaValidationResult> {
    return await this.quotaValidationService.validateQuotaUsage({
      userId: validationDto.userId,
      roomId: validationDto.roomId,
      deviceId: validationDto.deviceId,
      operation: validationDto.operation,
      sessionId: validationDto.sessionId,
    });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get quota balance for user in room' })
  async getQuotaBalance(
    @Param('userId') userId: string,
    @Query('roomId') roomId?: string,
  ): Promise<QuotaBalance> {
    if (!roomId) {
      throw new BadRequestException('roomId query parameter is required');
    }

    const balance = await this.quotaService.getQuotaBalance(userId, roomId);
    if (!balance) {
      throw new NotFoundException(
        `Active quota not found for user ${userId} in room ${roomId}`,
      );
    }
    return balance;
  }

  @Get('user/:userId/all')
  @ApiOperation({ summary: 'List all quotas for user' })
  async listQuotasForUser(@Param('userId') userId: string): Promise<Quota[]> {
    return await this.quotaService.listByUser(userId);
  }

  @Get('room/:roomId')
  @ApiOperation({ summary: 'List all quotas for room' })
  async listQuotasForRoom(@Param('roomId') roomId: string): Promise<Quota[]> {
    return await this.quotaService.listByRoom(roomId);
  }

  @Get(':quotaId/overrides')
  @ApiOperation({ summary: 'List overrides for quota' })
  async listOverrides(@Param('quotaId') quotaId: string) {
    return await this.quotaOverrideService.listForQuota(quotaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quota by ID' })
  async getQuotaById(@Param('id') id: string): Promise<Quota> {
    const quota = await this.quotaService.findById(id);
    if (!quota) {
      throw new NotFoundException(`Quota not found: ${id}`);
    }
    return quota;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Create new quota' })
  async createQuota(
    @CurrentUser() actor: JwtClaims,
    @Body() createQuotaDto: CreateQuotaDto,
  ): Promise<Quota> {
    return await this.quotaService.createOrUpdate(createQuotaDto, actor.sub);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Update quota' })
  async updateQuota(
    @Param('id') id: string,
    @Body() updateQuotaDto: UpdateQuotaDto,
  ): Promise<Quota> {
    return await this.quotaService.update(id, updateQuotaDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete quota' })
  async deleteQuota(@Param('id') id: string): Promise<void> {
    await this.quotaService.delete(id);
  }

  @Post(':quotaId/override')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Request quota override' })
  async requestOverride(
    @Param('quotaId') quotaId: string,
    @CurrentUser() actor: JwtClaims,
    @Body() dto: CreateOverrideDto,
  ) {
    const override = await this.quotaOverrideService.requestOverride(
      quotaId,
      actor.sub,
      dto,
    );

    return {
      message: 'Override granted successfully',
      quotaId,
      overrideType: override.type,
      overrideId: override.id,
      grantedAt: override.approvedAt ?? override.requestedAt,
    };
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async getPerformanceMetrics(): Promise<PerformanceSummary> {
    return this.quotaValidationService.getPerformanceMetrics();
  }

  @Post('cache/preload/:userId')
  @ApiOperation({ summary: 'Preload user quotas into cache' })
  async preloadUserQuotas(
    @Param('userId') userId: string,
    @Query('roomIds') roomIds: string,
  ): Promise<{ message: string }> {
    const roomIdArray = roomIds.split(',').map((id) => id.trim());
    await this.quotaValidationService.preloadUserQuotas(userId, roomIdArray);
    return {
      message: `Preloaded quotas for user ${userId} in ${roomIdArray.length} rooms`,
    };
  }

  @Delete('cache/:userId/:roomId')
  @ApiOperation({ summary: 'Invalidate user cache for room' })
  async invalidateUserCache(
    @Param('userId') userId: string,
    @Param('roomId') roomId: string,
  ): Promise<{ message: string }> {
    await this.quotaValidationService.invalidateUserCache(userId, roomId);
    return {
      message: `Invalidated cache for user ${userId} in room ${roomId}`,
    };
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  async getCacheStats(): Promise<unknown> {
    return await this.quotaCacheService.getCacheStats();
  }

  @Delete('cache')
  @ApiOperation({ summary: 'Clear all quota cache' })
  async clearCache(): Promise<{ message: string }> {
    await this.quotaCacheService.clearAllQuotaCache();
    return { message: 'All quota cache cleared' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Quota system health check' })
  async healthCheck() {
    const cacheHealthy = await this.quotaCacheService.isHealthy();
    const metrics = this.quotaValidationService.getPerformanceMetrics();

    return {
      status: cacheHealthy ? 'healthy' : 'degraded',
      cache: {
        healthy: cacheHealthy,
      },
      performance: {
        averageResponseTime: metrics.averageDuration,
        cacheHitRate: metrics.cacheHitRate,
        errorRate: metrics.errorRate,
        totalRequests: metrics.totalRequests,
      },
      timestamp: new Date(),
    };
  }

  @Get('utils/format-duration/:milliseconds')
  @ApiOperation({ summary: 'Format duration milliseconds to readable string' })
  formatDuration(@Param('milliseconds') milliseconds: string): {
    formatted: string;
  } {
    const duration = parseInt(milliseconds, 10);
    return {
      formatted: QuotaCalculationEngine.formatDuration(duration),
    };
  }

  @Get('utils/format-energy/:kwh')
  @ApiOperation({ summary: 'Format energy kWh to readable string' })
  formatEnergy(@Param('kwh') kwh: string): { formatted: string } {
    const energy = parseFloat(kwh);
    return {
      formatted: QuotaCalculationEngine.formatEnergy(energy),
    };
  }

  @Get('utils/format-currency/:amount')
  @ApiOperation({ summary: 'Format currency amount with optional currency' })
  formatCurrency(
    @Param('amount') amount: string,
    @Query('currency') currency?: string,
  ): { formatted: string } {
    const amountValue = parseFloat(amount);
    return {
      formatted: QuotaCalculationEngine.formatCurrency(amountValue, currency),
    };
  }
}
