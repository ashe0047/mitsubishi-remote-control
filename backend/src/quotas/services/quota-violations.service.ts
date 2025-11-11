import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { QuotaViolation } from '../entities/quota-violation.entity';
import { ViolationType, EnforcementAction } from '../enums/violation.enums';

export interface RecordViolationParams {
  quotaId: string;
  userId: string;
  roomId: string;
  violationType: ViolationType;
  violationAmount: number;
  quotaLimit: number;
  enforcementAction: EnforcementAction;
  usageSessionId?: string | null;
  message?: string;
  metadata?: Record<string, unknown> | null;
}

export interface QuotaViolationResponse {
  id: string;
  quotaId: string;
  userId: string;
  roomId: string;
  violationType: ViolationType;
  violationAmount: number;
  quotaLimit: number;
  enforcementAction: EnforcementAction;
  overrideGranted: boolean;
  occurredAt: Date;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  usageSessionId?: string | null;
}

@Injectable()
export class QuotaViolationsService {
  private readonly logger = new Logger(QuotaViolationsService.name);

  constructor(
    @InjectRepository(QuotaViolation)
    private readonly violationRepository: Repository<QuotaViolation>,
  ) {}

  async record(params: RecordViolationParams): Promise<QuotaViolationResponse> {
    try {
      const violation = this.violationRepository.create({
        quotaId: params.quotaId,
        userId: params.userId,
        roomId: params.roomId,
        usageSessionId: params.usageSessionId ?? null,
        violationType: params.violationType,
        violationAmount: params.violationAmount,
        quotaLimit: params.quotaLimit,
        enforcementAction: params.enforcementAction,
        message: params.message ?? null,
        metadata: params.metadata ?? null,
      });

      const saved = await this.violationRepository.save(violation);
      return this.toResponse(saved);
    } catch (error) {
      this.logger.error('Failed to record quota violation', error);
      throw error;
    }
  }

  async listByUser(
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<QuotaViolationResponse[]> {
    return this.fetchViolations({ userId }, limit, cursor);
  }

  async listByRoom(
    roomId: string,
    limit = 50,
    cursor?: string,
  ): Promise<QuotaViolationResponse[]> {
    return this.fetchViolations({ roomId }, limit, cursor);
  }

  async listByQuota(
    quotaId: string,
    limit = 50,
    cursor?: string,
  ): Promise<QuotaViolationResponse[]> {
    return this.fetchViolations({ quotaId }, limit, cursor);
  }

  private async fetchViolations(
    where: Partial<Record<'userId' | 'roomId' | 'quotaId', string>>,
    limit: number,
    cursor?: string,
  ): Promise<QuotaViolationResponse[]> {
    const baseLimit = limit ?? 50;
    const queryLimit = Math.min(Math.max(baseLimit, 1), 100);
    const whereClause: Record<string, unknown> = { ...where };

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        whereClause.createdAt = LessThan(cursorDate);
      }
    }

    const violations = await this.violationRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: queryLimit,
    });

    return violations.map((violation) => this.toResponse(violation));
  }

  toResponse(violation: QuotaViolation): QuotaViolationResponse {
    return {
      id: violation.id,
      quotaId: violation.quotaId,
      userId: violation.userId,
      roomId: violation.roomId,
      violationType: violation.violationType,
      violationAmount: Number(violation.violationAmount),
      quotaLimit: Number(violation.quotaLimit),
      enforcementAction: violation.enforcementAction,
      overrideGranted: violation.overrideGranted,
      occurredAt: violation.createdAt,
      message: violation.message ?? null,
      metadata: (violation.metadata as Record<string, unknown> | null) ?? null,
      usageSessionId: violation.usageSessionId ?? null,
    };
  }
}
