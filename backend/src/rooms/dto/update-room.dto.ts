import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9_-]+$/)
  identifier?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
