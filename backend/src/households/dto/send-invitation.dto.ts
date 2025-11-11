import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../users/enums/access.enums';

export class SendInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum([UserRole.PARENT, UserRole.CHILD])
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
