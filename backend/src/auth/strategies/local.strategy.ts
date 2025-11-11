import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';

/**
 * Local authentication strategy using Passport.
 *
 * This strategy implements the Adapter Pattern by delegating credential
 * validation to the existing UsersService, preserving all existing logic
 * while gaining Passport benefits.
 *
 * Features:
 * - Email-based authentication (uses email as username field)
 * - Delegates to existing UsersService.validateCredentials()
 * - Maintains existing error handling and validation patterns
 * - Preserves all existing security checks
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // Use email instead of username
      passwordField: 'password',
    });
  }

  /**
   * Validates user credentials using existing UsersService
   *
   * @param email User's email address
   * @param password User's password
   * @returns User entity if validation successful
   * @throws UnauthorizedException if credentials are invalid
   */
  async validate(email: string, password: string): Promise<User> {
    try {
      // Delegate to existing service - no code duplication
      // This preserves all existing validation logic, bcrypt comparison,
      // error handling, and security patterns
      const user = await this.authService.validateCredentials(email, password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (error) {
      // Preserve existing error handling patterns
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Wrap other errors to maintain consistent API
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
