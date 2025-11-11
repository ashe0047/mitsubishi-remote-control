import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { OverrideType } from '../enums/override.enums';

export class CreateOverrideDto {
  @IsEnum(OverrideType)
  type!: OverrideType;

  @IsOptional()
  @IsNumber()
  additionalSeconds?: number;

  @IsOptional()
  @IsNumber()
  durationHours?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
