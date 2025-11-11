import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quota } from '../entities/quota.entity';
import { QuotaOverride } from '../entities/quota-override.entity';
import { CreateQuotaDto } from '../dto/create-quota.dto';
import { UpdateQuotaDto } from '../dto/update-quota.dto';
import {
  EnforcementAction,
  QuotaPeriod,
  QuotaScope,
  QuotaStatus,
  QuotaType,
} from '../enums/quota-db.enums';
import { QuotaValidationService } from './quota-validation.service';
import { QuotaBalance } from '../interfaces/device-operation.interface';
import { OverrideStatus } from '../enums/override.enums';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    @InjectRepository(QuotaOverride)
    private readonly quotaOverrideRepository: Repository<QuotaOverride>,
    private readonly quotaValidationService: QuotaValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findById(id: string): Promise<Quota | null> {
    return await this.quotaRepository.findOne({ where: { id } });
  }

  async findActiveByUserAndRoom(
    userId: string,
    roomId: string,
  ): Promise<Quota | null> {
    return await this.quotaRepository.findOne({
      where: {
        userId,
        targetId: roomId,
        status: QuotaStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async listByUser(userId: string): Promise<Quota[]> {
    return await this.quotaRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listByRoom(roomId: string): Promise<Quota[]> {
    return await this.quotaRepository.find({
      where: { targetId: roomId },
      order: { createdAt: 'DESC' },
    });
  }

  async createOrUpdate(
    dto: CreateQuotaDto,
    actorUserId: string,
  ): Promise<Quota> {
    const existing = await this.findActiveByUserAndRoom(dto.userId, dto.roomId);

    if (existing) {
      const updated = await this.applyQuotaUpdate(existing, dto, actorUserId);
      await this.invalidateUserCache(updated.userId, updated.targetId);
      return updated;
    }

    const quota = this.quotaRepository.create({
      userId: dto.userId,
      targetId: dto.roomId,
      name: dto.name ?? this.generateQuotaName(dto.quotaType, dto.roomId),
      description: dto.description ?? null,
      quotaType: dto.quotaType ?? QuotaType.TIME_BASED,
      scope: dto.scope ?? QuotaScope.ROOM,
      period: dto.period ?? QuotaPeriod.DAILY,
      resetTime: dto.resetTime ?? '00:00:00',
      allowedAmount: dto.allowedAmount,
      usedAmount: 0,
      warningThresholds: this.resolveWarningThresholds(dto),
      notificationMethods: this.resolveNotificationMethods(dto),
      enforcementAction: dto.enforcementAction ?? EnforcementAction.BLOCK,
      allowRollover: dto.allowRollover ?? false,
      maxRolloverAmount: dto.maxRolloverAmount ?? null,
      status: QuotaStatus.ACTIVE,
      createdBy: actorUserId,
    });

    const saved = await this.quotaRepository.save(quota);
    await this.invalidateUserCache(saved.userId, saved.targetId);
    this.emitQuotaStatusChanged(saved, 'created');
    this.logger.log('Created quota', {
      quotaId: saved.id,
      userId: saved.userId,
      roomId: saved.targetId,
    });
    return saved;
  }

  async update(id: string, dto: UpdateQuotaDto): Promise<Quota> {
    const quota = await this.quotaRepository.findOne({ where: { id } });
    if (!quota) {
      throw new NotFoundException(`Quota not found: ${id}`);
    }

    if (dto.name !== undefined) quota.name = dto.name;
    if (dto.description !== undefined) quota.description = dto.description;
    if (dto.quotaType !== undefined) quota.quotaType = dto.quotaType;
    if (dto.scope !== undefined) quota.scope = dto.scope;
    if (dto.period !== undefined) quota.period = dto.period;
    if (dto.resetTime !== undefined) quota.resetTime = dto.resetTime;
    if (dto.allowedAmount !== undefined)
      quota.allowedAmount = dto.allowedAmount;
    if (dto.warningThresholds && dto.warningThresholds.length > 0) {
      quota.warningThresholds = this.normaliseThresholds(dto.warningThresholds);
    } else if (dto.warningThreshold !== undefined) {
      quota.warningThresholds = this.normaliseThresholds([
        dto.warningThreshold,
      ]);
    }
    if (dto.enforcementAction !== undefined) {
      quota.enforcementAction = dto.enforcementAction;
    }
    if (dto.status !== undefined) quota.status = dto.status;
    if (dto.allowRollover !== undefined)
      quota.allowRollover = dto.allowRollover;
    if (dto.maxRolloverAmount !== undefined) {
      quota.maxRolloverAmount = dto.maxRolloverAmount;
    }
    if (dto.notificationMethods && dto.notificationMethods.length > 0) {
      quota.notificationMethods = this.normaliseMethods(
        dto.notificationMethods,
      );
    }

    const saved = await this.quotaRepository.save(quota);
    await this.invalidateUserCache(saved.userId, saved.targetId);

    this.emitQuotaStatusChanged(saved, 'updated');

    this.logger.log('Updated quota', {
      quotaId: saved.id,
      userId: saved.userId,
      roomId: saved.targetId,
    });

    return saved;
  }

  async delete(id: string): Promise<void> {
    const quota = await this.quotaRepository.findOne({ where: { id } });
    if (!quota) {
      throw new NotFoundException(`Quota not found: ${id}`);
    }

    await this.quotaRepository.delete(id);
    await this.invalidateUserCache(quota.userId, quota.targetId);

    this.emitQuotaStatusChanged(quota, 'deleted');

    this.logger.log('Deleted quota', {
      quotaId: id,
      userId: quota.userId,
      roomId: quota.targetId,
    });
  }

  async getQuotaBalance(
    userId: string,
    roomId: string,
  ): Promise<QuotaBalance | null> {
    const quota = await this.findActiveByUserAndRoom(userId, roomId);
    if (!quota) {
      return null;
    }

    const overrides = await this.quotaOverrideRepository.find({
      where: { quotaId: quota.id },
      order: { requestedAt: 'DESC' },
      take: 10,
    });

    const allowed = Number(quota.allowedAmount);
    const used = Number(quota.usedAmount ?? 0);
    const remaining = Math.max(0, allowed - used);

    return {
      quotaId: quota.id,
      userId: quota.userId,
      roomId: quota.targetId ?? '',
      quotaType: quota.quotaType,
      scope: quota.scope,
      status: quota.status,
      allowedAmount: allowed,
      usedAmount: used,
      remainingAmount: remaining,
      warningThresholds: quota.warningThresholds ?? [],
      notificationMethods: quota.notificationMethods ?? [],
      enforcementAction: quota.enforcementAction,
      overrides: overrides.map((override) => ({
        id: override.id,
        type: override.type,
        status: override.status,
        expiresAt: override.expiresAt ?? null,
        isActive: override.isActive,
      })),
      updatedAt: quota.updatedAt,
    };
  }

  private async applyQuotaUpdate(
    quota: Quota,
    dto: CreateQuotaDto,
    actorUserId: string,
  ): Promise<Quota> {
    quota.name = dto.name ?? quota.name;
    quota.description = dto.description ?? quota.description ?? null;
    quota.quotaType = dto.quotaType;
    quota.scope = dto.scope ?? quota.scope ?? QuotaScope.ROOM;
    quota.period = dto.period ?? quota.period ?? QuotaPeriod.DAILY;
    quota.resetTime = dto.resetTime ?? quota.resetTime;
    quota.allowedAmount = dto.allowedAmount;
    quota.warningThresholds = this.resolveWarningThresholds(
      dto,
      quota.warningThresholds,
    );
    quota.notificationMethods = this.resolveNotificationMethods(
      dto,
      quota.notificationMethods,
    );
    quota.enforcementAction =
      dto.enforcementAction ??
      quota.enforcementAction ??
      EnforcementAction.BLOCK;
    quota.allowRollover = dto.allowRollover ?? quota.allowRollover;
    quota.maxRolloverAmount = dto.maxRolloverAmount ?? quota.maxRolloverAmount;
    quota.status = QuotaStatus.ACTIVE;
    quota.createdBy = quota.createdBy ?? actorUserId;

    return await this.quotaRepository.save(quota);
  }

  private resolveWarningThresholds(
    dto: CreateQuotaDto | UpdateQuotaDto,
    fallback?: number[] | null,
  ): number[] {
    if (dto.warningThresholds && dto.warningThresholds.length > 0) {
      return this.normaliseThresholds(dto.warningThresholds);
    }
    if (dto.warningThreshold !== undefined) {
      return this.normaliseThresholds([dto.warningThreshold]);
    }
    if (fallback && fallback.length > 0) {
      return this.normaliseThresholds(fallback);
    }
    return [75];
  }

  private resolveNotificationMethods(
    dto: CreateQuotaDto | UpdateQuotaDto,
    fallback?: string[] | null,
  ): string[] {
    if (dto.notificationMethods && dto.notificationMethods.length > 0) {
      return this.normaliseMethods(dto.notificationMethods);
    }
    if (fallback && fallback.length > 0) {
      return this.normaliseMethods(fallback);
    }
    return ['push'];
  }

  private normaliseThresholds(values: number[]): number[] {
    return Array.from(new Set(values.filter((value) => value >= 0))).sort(
      (a, b) => a - b,
    );
  }

  private normaliseMethods(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.toLowerCase())));
  }

  private generateQuotaName(type: QuotaType, roomId: string): string {
    return `${type.replace(/_/g, ' ')} - ${roomId}`;
  }

  private async invalidateUserCache(
    userId: string,
    roomId?: string | null,
  ): Promise<void> {
    if (!roomId) {
      return;
    }
    await this.quotaValidationService.invalidateUserCache(userId, roomId);
  }

  private emitQuotaStatusChanged(quota: Quota, changeType: string): void {
    this.eventEmitter.emit('quota.status.changed', {
      quotaId: quota.id,
      roomId: quota.targetId ?? '',
      status: {
        changeType,
        quota: {
          id: quota.id,
          userId: quota.userId,
          roomId: quota.targetId,
          quotaType: quota.quotaType,
          scope: quota.scope,
          status: quota.status,
          allowedAmount: quota.allowedAmount,
          usedAmount: quota.usedAmount,
          remainingAmount:
            Number(quota.allowedAmount ?? 0) - Number(quota.usedAmount ?? 0),
          updatedAt: quota.updatedAt,
        },
      },
      source: 'api:quota-controller',
    });
  }

  async getOverridesForQuota(quotaId: string): Promise<QuotaOverride[]> {
    return await this.quotaOverrideRepository.find({
      where: { quotaId },
      order: { requestedAt: 'DESC' },
    });
  }

  async getPendingOverrides(): Promise<QuotaOverride[]> {
    return await this.quotaOverrideRepository.find({
      where: { status: OverrideStatus.PENDING },
      order: { requestedAt: 'DESC' },
    });
  }
}
