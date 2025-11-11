import { plainToInstance } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Logout response DTO for logout confirmation
 *
 * Provides a clean, type-safe response format for logout operations
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class LogoutResponse {
  @ApiProperty({
    description: 'Logout operation status indicator',
    example: true,
    enum: [true],
    enumName: 'LogoutStatus',
  })
  success: true;

  /**
   * Create success logout response
   *
   * @returns LogoutResponse DTO instance
   */
  static success(): LogoutResponse {
    return plainToInstance(LogoutResponse, {
      success: true,
    });
  }
}
