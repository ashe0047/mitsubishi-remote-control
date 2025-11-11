/**
 * Password Change Response DTO
 *
 * Provides a clean, type-safe response format for password change operations
 * following the DTO enforcement pattern from CLAUDE.md
 */
export class PasswordResponse {
  success: boolean;

  /**
   * Create a successful password change response
   *
   * @returns PasswordResponse DTO instance
   */
  static success(): PasswordResponse {
    return {
      success: true,
    };
  }
}
