import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ViolationType, EnforcementAction } from '../enums/violation.enums';

export class CreateViolationDto {
  @IsUUID()
  quotaId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  roomId!: string;

  @IsOptional()
  @IsUUID()
  usageSessionId?: string;

  @IsEnum(ViolationType)
  violationType!: ViolationType;

  @IsNumber()
  violationAmount!: number;

  @IsNumber()
  quotaLimit!: number;

  @IsEnum(EnforcementAction)
  enforcementAction!: EnforcementAction;

  @IsOptional()
  @MaxLength(1024)
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
