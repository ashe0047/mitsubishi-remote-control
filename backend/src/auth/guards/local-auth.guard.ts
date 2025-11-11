import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local authentication guard using Passport.
 *
 * This guard provides a clean interface for local authentication
 * without magic strings, improving code maintainability and readability.
 *
 * Features:
 * - Extends Passport AuthGuard with 'local' strategy
 * - Encapsulates strategy name to avoid magic strings
 * - Follows NestJS guard patterns
 * - Easy to use with @UseGuards decorator
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
