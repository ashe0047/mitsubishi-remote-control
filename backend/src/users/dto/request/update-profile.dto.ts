import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Update Profile Request DTO
 *
 * Used for the PATCH /users/me endpoint
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
