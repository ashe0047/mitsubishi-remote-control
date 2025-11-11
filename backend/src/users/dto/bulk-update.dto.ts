import {
  IsArray,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../enums/access.enums';

export class UserUpdateDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean() // Match Spring Boot: Boolean isActive instead of direct status
  isActive?: boolean;
}

export class BulkUpdateUserDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @ValidateNested()
  @Type(() => UserUpdateDto)
  updates!: UserUpdateDto;
}

export class BulkUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateUserDto)
  updates!: BulkUpdateUserDto[];
}
