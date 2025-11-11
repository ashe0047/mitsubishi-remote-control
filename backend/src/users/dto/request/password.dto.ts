import { IsString, MinLength } from 'class-validator';

/**
 * Password Change Request DTO
 *
 * Used for the POST /users/me/password endpoint
 */
export class PasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
