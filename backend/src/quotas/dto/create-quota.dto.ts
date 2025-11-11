import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';
import {
  EnforcementAction,
  QuotaPeriod,
  QuotaScope,
  QuotaType,
} from '../enums/quota-db.enums';

export class CreateQuotaDto {
  @IsString()
  userId!: string;

  @IsString()
  roomId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(QuotaType)
  quotaType!: QuotaType;

  @IsOptional()
  @IsEnum(QuotaScope)
  scope?: QuotaScope;

  @IsOptional()
  @IsEnum(QuotaPeriod)
  period?: QuotaPeriod;

  @IsOptional()
  @IsString()
  resetTime?: string;

  @IsNumber()
  allowedAmount!: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  warningThresholds?: number[];

  @IsOptional()
  @IsEnum(EnforcementAction)
  enforcementAction?: EnforcementAction;

  @IsOptional()
  @IsBoolean()
  allowRollover?: boolean;

  @IsOptional()
  @IsNumber()
  maxRolloverAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  notificationMethods?: string[];
}
