import { IsString, IsOptional, IsObject } from 'class-validator';
import { DeviceOperation } from '../interfaces/device-operation.interface';

export class QuotaValidationDto {
  @IsString()
  userId: string;

  @IsString()
  roomId: string;

  @IsString()
  deviceId: string;

  @IsObject()
  operation: DeviceOperation;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
