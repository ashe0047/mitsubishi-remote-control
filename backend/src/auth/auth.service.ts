import {
  Injectable,
  Inject,
  forwardRef,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { HouseholdsService } from '../households/households.service';
import { RegisterDto, LoginDto } from './dto/request';
import { TokensService } from './tokens/tokens.service';
import { User } from '../users/entities/user.entity';
import { JwtClaims } from '../shared/types/auth';
import {
  AuthResponse,
  LogoutResponse,
  TokensResponse,
  UserResponse,
} from './dto/response';
import { compare } from 'bcrypt-ts';
import { DatabaseException } from '../shared/errors/exceptions/infrastructure.exception';
import { ErrorHandlerService } from '../shared/errors/services/error-handler.service';
import { UsersCommonService } from 'src/users/services';
import { UserStatus, UserRole } from '../users/enums/access.enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userCommonService: UsersCommonService,
    @Inject(forwardRef(() => HouseholdsService))
    private readonly households: HouseholdsService,
    private readonly tokens: TokensService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Match Spring Boot logic exactly: create/find household FIRST
    const householdName =
      dto.familyName?.trim() || `${dto.name || 'Family'}_${Date.now()}`;
    let household = await this.households.findByName(householdName);

    if (!household) {
      household = await this.households.create(householdName);
    }

    // Now create user with household (matches Spring Boot createUser method)
    const user = await this.userCommonService.createWithHousehold({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      householdId: household.id,
      role: UserRole.PARENT, // First user is always PARENT like Spring Boot
    });

    // Issue tokens
    const pair = await this.tokens.issueTokens(user);
    return AuthResponse.from(user, pair.accessToken, pair.refreshToken);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateCredentials(dto.email, dto.password);
    const pair = await this.tokens.issueTokens(user);
    return AuthResponse.from(user, pair.accessToken, pair.refreshToken);
  }

  /**
   * Login method for Passport-authenticated users.
   * This method is used when LocalStrategy has already validated credentials
   * and provided the authenticated user object.
   *
   * @param user The authenticated user from Passport validation
   */
  async loginWithUser(user: User): Promise<AuthResponse> {
    const pair = await this.tokens.issueTokens(user);
    return AuthResponse.from(user, pair.accessToken, pair.refreshToken);
  }

  async me(userId: string): Promise<UserResponse> {
    const u = await this.userCommonService.findById(userId);
    return UserResponse.from(u);
  }

  async refresh(
    oldRefreshToken: string,
    userId: string,
  ): Promise<TokensResponse> {
    const pair = await this.tokens.rotateRefreshToken(oldRefreshToken, userId);
    return TokensResponse.fromTokens(pair.accessToken, pair.refreshToken);
  }

  async logout(
    accessToken: string,
    refreshToken: string,
  ): Promise<LogoutResponse> {
    // verify both to extract jti and exp
    const accessPayload: JwtClaims = this.tokens.verifyTokenRaw(accessToken);
    const refreshPayload: JwtClaims = this.tokens.verifyTokenRaw(refreshToken);
    await this.tokens.blacklistAccess(accessPayload.jti, accessPayload.exp);
    await this.tokens.blacklistRefresh(refreshPayload.jti, refreshPayload.exp);
    await this.tokens.removeActiveRefresh(
      refreshPayload.sub,
      refreshPayload.jti,
    );
    return LogoutResponse.success();
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.userCommonService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // CRITICAL: Add status validation to match Spring Boot source of truth
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    let ok: boolean;
    try {
      ok = await compare(password, user.passwordHash);
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'password_comparison',
        email,
      });

      this.logger.error(
        'Failed to compare password',
        errorMessage,
        errorContext,
      );
      throw new DatabaseException(
        'password_validation',
        errorContext,
        error instanceof Error ? error : undefined,
      );
    }
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    await this.userCommonService.updateLastLogin(user.id);
    return user;
  }
}
