import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaOverride } from '../entities/quota-override.entity';
import { QuotaService } from './quota.service';
import { QuotaValidationService } from './quota-validation.service';
import { CreateOverrideDto } from '../dto/create-override.dto';
import { OverrideType, OverrideStatus } from '../enums/override.enums';
import { OverrideParameters } from '../interfaces/session-metadata.interface';
import { Quota } from '../entities/quota.entity';
import { QuotaStatus } from '../enums/quota-db.enums';

@Injectable()
export class QuotaOverrideService {
  private readonly logger = new Logger(QuotaOverrideService.name);

  constructor(
    @InjectRepository(QuotaOverride)
    private readonly overrideRepository: Repository<QuotaOverride>,
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    private readonly quotaService: QuotaService,
    private readonly quotaValidationService: QuotaValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestOverride(
    quotaId: string,
    requestedByUserId: string,
    dto: CreateOverrideDto,
  ): Promise<QuotaOverride> {
    const quota = await this.quotaService.findById(quotaId);
    if (!quota) {
      throw new NotFoundException(`Quota not found: ${quotaId}`);
    }

    const override = this.overrideRepository.create({
      quotaId,
      requestedByUserId,
      type: dto.type,
      parameters: this.buildParameters(dto),
      reason: dto.reason ?? this.defaultReason(dto.type),
      status: OverrideStatus.APPROVED,
      requestedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: requestedByUserId,
      expiresAt: this.calculateExpiry(dto.type, dto),
      isActive: true,
    });

    const saved = await this.overrideRepository.save(override);
    this.emitOverrideEvents('override.requested', quota, saved, {
      requestedBy: requestedByUserId,
      approvers: [requestedByUserId],
    });

    await this.applyOverrideEffect(quota, saved, dto);
    this.emitQuotaStatusChanged(quota, 'override_applied');
    await this.invalidateQuotaCache(quota.userId, quota.targetId);
    this.emitOverrideEvents('override.approved', quota, saved, {
      approvedBy: requestedByUserId,
    });

    this.logger.log('Created quota override request', {
      overrideId: saved.id,
      quotaId,
      type: dto.type,
    });

    return saved;
  }

  async approve(id: string, approverUserId: string): Promise<QuotaOverride> {
    const override = await this.getOverrideOrThrow(id);
    override.approve(approverUserId);
    const saved = await this.overrideRepository.save(override);

    const quota = await this.quotaService.findById(saved.quotaId);
    if (quota) {
      await this.invalidateQuotaCache(quota.userId, quota.targetId);
      this.emitOverrideEvents('override.approved', quota, saved, {
        approvedBy: approverUserId,
      });
      this.emitQuotaStatusChanged(quota, 'override_approved');
    }

    return saved;
  }

  async reject(id: string, approverUserId: string): Promise<QuotaOverride> {
    const override = await this.getOverrideOrThrow(id);
    override.reject(approverUserId);
    const saved = await this.overrideRepository.save(override);

    const quota = await this.quotaService.findById(saved.quotaId);
    if (quota) {
      await this.invalidateQuotaCache(quota.userId, quota.targetId);
      this.emitOverrideEvents('override.rejected', quota, saved, {
        rejectedBy: approverUserId,
      });
      this.emitQuotaStatusChanged(quota, 'override_rejected');
    }

    return saved;
  }

  async cancel(id: string, callerUserId: string): Promise<QuotaOverride> {
    const override = await this.getOverrideOrThrow(id);
    if (override.requestedByUserId !== callerUserId) {
      this.logger.warn('Override cancel attempted by non-requester', {
        overrideId: id,
        callerUserId,
      });
    }

    override.cancel();
    const saved = await this.overrideRepository.save(override);

    const quota = await this.quotaService.findById(saved.quotaId);
    if (quota) {
      await this.invalidateQuotaCache(quota.userId, quota.targetId);
      this.emitOverrideEvents('override.cancelled', quota, saved, {
        cancelledBy: callerUserId,
      });
      this.emitQuotaStatusChanged(quota, 'override_cancelled');
    }

    return saved;
  }

  async listForQuota(quotaId: string): Promise<QuotaOverride[]> {
    return await this.overrideRepository.find({
      where: { quotaId },
      order: { requestedAt: 'DESC' },
    });
  }

  private buildParameters(dto: CreateOverrideDto): OverrideParameters {
    const parameters: OverrideParameters = {};

    if (dto.additionalSeconds !== undefined) {
      parameters.amount = dto.additionalSeconds;
      parameters.duration = dto.additionalSeconds / 3600;
    }

    if (dto.type === OverrideType.EMERGENCY_OVERRIDE) {
      parameters.unlimitedAccess = true;
      parameters.duration = dto.durationHours ?? 1;
    }

    if (dto.type === OverrideType.UNLOCK_DAY) {
      parameters.customSettings = {
        unlockUntil: this.calculateExpiry(dto.type, dto)?.toISOString(),
      };
    }

    return parameters;
  }

  private calculateExpiry(type: OverrideType, dto: CreateOverrideDto): Date {
    const now = new Date();

    switch (type) {
      case OverrideType.ADD_TIME: {
        const seconds = dto.additionalSeconds ?? 1800;
        return new Date(now.getTime() + seconds * 1000);
      }
      case OverrideType.UNLOCK_DAY: {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay;
      }
      case OverrideType.EMERGENCY_OVERRIDE: {
        const hours = dto.durationHours ?? 1;
        return new Date(now.getTime() + hours * 60 * 60 * 1000);
      }
      default:
        return new Date(now.getTime() + 60 * 60 * 1000);
    }
  }

  private async applyOverrideEffect(
    quota: Quota,
    override: QuotaOverride,
    dto: CreateOverrideDto,
  ): Promise<void> {
    switch (override.type) {
      case OverrideType.ADD_TIME: {
        const additionalSeconds = dto.additionalSeconds ?? 1800;
        const allowed = Number(quota.allowedAmount ?? 0);
        quota.allowedAmount = allowed + additionalSeconds;
        break;
      }
      case OverrideType.UNLOCK_DAY: {
        quota.usedAmount = 0;
        break;
      }
      case OverrideType.EMERGENCY_OVERRIDE: {
        quota.status = QuotaStatus.PAUSED;
        break;
      }
      default:
        break;
    }

    quota.updatedAt = new Date();
    await this.quotaRepository.save(quota);
  }

  private async invalidateQuotaCache(
    userId: string,
    roomId?: string | null,
  ): Promise<void> {
    if (!roomId) {
      return;
    }
    await this.quotaValidationService.invalidateUserCache(userId, roomId);
  }

  private async getOverrideOrThrow(id: string): Promise<QuotaOverride> {
    const override = await this.overrideRepository.findOne({ where: { id } });
    if (!override) {
      throw new NotFoundException(`Quota override not found: ${id}`);
    }
    return override;
  }

  private defaultReason(type: OverrideType): string {
    switch (type) {
      case OverrideType.ADD_TIME:
        return 'Time allowance adjustment';
      case OverrideType.UNLOCK_DAY:
        return 'Day unlocked by guardian';
      case OverrideType.EMERGENCY_OVERRIDE:
        return 'Emergency override activated';
      default:
        return 'Manual override';
    }
  }

  private emitOverrideEvents(
    type:
      | 'override.requested'
      | 'override.approved'
      | 'override.rejected'
      | 'override.cancelled',
    quota: Quota,
    override: QuotaOverride,
    extra: Record<string, unknown>,
  ): void {
    const payload = {
      quotaId: quota.id,
      roomId: quota.targetId ?? '',
      request: {
        id: override.id,
        type: override.type,
        status: override.status,
        parameters: override.parameters,
        reason: override.reason,
        expiresAt: override.expiresAt,
        isActive: override.isActive,
      },
      ...extra,
      source: 'api:quota-controller',
    };

    this.eventEmitter.emit(type, payload);
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
}
