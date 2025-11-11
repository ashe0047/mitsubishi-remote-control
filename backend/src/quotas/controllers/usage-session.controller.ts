import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UsageSessionService } from '../services/usage-session.service';
import { UsageSession } from '../entities/usage-session.entity';
import { DeviceOperation } from '../interfaces/device-operation.interface';

@Controller('usage-sessions')
export class UsageSessionController {
  constructor(private readonly sessionService: UsageSessionService) {}

  @Get()
  async getAllSessions(): Promise<UsageSession[]> {
    // TODO: Implement pagination and filtering
    return Promise.resolve([]);
  }

  @Get(':id')
  async getSessionById(@Param('id') id: string): Promise<UsageSession | null> {
    return await this.sessionService.getSessionById(id);
  }

  @Get('user/:userId')
  async getSessionsByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<UsageSession[]> {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return await this.sessionService.getSessionsByUser(userId, limitNum);
  }

  @Get('user/:userId/active')
  async getActiveSessionsByUser(
    @Param('userId') userId: string,
  ): Promise<UsageSession[]> {
    return await this.sessionService.getActiveSessionsByUser(userId);
  }

  @Get('active/:quotaId/:userId/:roomId/:deviceId')
  async getOrCreateActiveSession(
    @Param('quotaId') quotaId: string,
    @Param('userId') userId: string,
    @Param('roomId') roomId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<UsageSession> {
    return await this.sessionService.getOrCreateSession(
      quotaId,
      userId,
      roomId,
      deviceId,
    );
  }

  @Put(':id/pause')
  async pauseSession(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ): Promise<UsageSession> {
    return await this.sessionService.pauseSession(id, body.reason);
  }

  @Put(':id/resume')
  async resumeSession(@Param('id') id: string): Promise<UsageSession> {
    return await this.sessionService.resumeSession(id);
  }

  @Put(':id/complete')
  async completeSession(
    @Param('id') id: string,
    @Body() body: { terminationReason?: string },
  ): Promise<UsageSession> {
    return await this.sessionService.completeSession(
      id,
      body.terminationReason,
    );
  }

  @Put(':id/terminate')
  async terminateSession(
    @Param('id') id: string,
    @Body() body: { terminationReason: string },
  ): Promise<UsageSession> {
    return await this.sessionService.terminateSession(
      id,
      body.terminationReason,
    );
  }

  @Post(':id/operation')
  async recordOperation(
    @Param('id') id: string,
    @Body() operation: DeviceOperation,
  ): Promise<UsageSession> {
    return await this.sessionService.recordOperation(id, operation);
  }

  @Post(':id/energy')
  async recordEnergyConsumption(
    @Param('id') id: string,
    @Body() body: { energy: number },
  ): Promise<UsageSession> {
    return await this.sessionService.recordEnergyConsumption(id, body.energy);
  }

  @Post(':id/cost')
  async recordCost(
    @Param('id') id: string,
    @Body() body: { cost: number },
  ): Promise<UsageSession> {
    return await this.sessionService.recordCost(id, body.cost);
  }

  @Post(':id/usage')
  async recordUsage(
    @Param('id') id: string,
    @Body() body: { usage: number },
  ): Promise<UsageSession> {
    return await this.sessionService.recordUsage(id, body.usage);
  }

  @Delete('cleanup/expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredSessions(): Promise<{
    message: string;
    cleanedCount: number;
  }> {
    const cleanedCount = await this.sessionService.cleanupExpiredSessions();
    return {
      message: `Cleaned up ${cleanedCount} expired sessions`,
      cleanedCount,
    };
  }
}
