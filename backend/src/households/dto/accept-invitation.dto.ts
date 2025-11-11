import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
