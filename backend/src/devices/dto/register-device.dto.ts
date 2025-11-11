import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsIn,
  IsOptional,
} from 'class-validator';
import { DeviceType } from '../entities/device.entity';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  identifier!: string;

  @IsOptional()
  @IsIn(Object.values(DeviceType))
  type?: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
