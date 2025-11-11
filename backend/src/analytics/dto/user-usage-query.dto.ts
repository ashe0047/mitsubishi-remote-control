import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UserUsageQueryDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  roomId?: string;
}
