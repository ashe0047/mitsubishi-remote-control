import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshDto, LogoutDto } from './dto/request';
import {
  AuthResponse,
  TokensResponse,
  LogoutResponse,
  UserResponse,
} from './dto/response';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtClaims } from '../shared/types/auth';
import { User } from 'src/users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({
    summary: 'Register new user',
    description:
      'Creates a new user account and household. Returns authentication tokens for immediate login.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User successfully registered and authenticated',
    type: AuthResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or email already exists',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during user creation',
  })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates user credentials and returns JWT tokens for API access.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
  })
  @ApiOkResponse({
    description: 'User successfully authenticated',
    type: AuthResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password credentials',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request format or missing required fields',
  })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Body() _loginDto: LoginDto, // DTO for Swagger documentation and API contract enforcement
    @Req() req: Request & { user: User }, // User from Passport validation
  ): Promise<AuthResponse> {
    // Passport adds the authenticated user to req.user after validation
    // LoginDto provides API contract validation and Swagger documentation
    // User from Passport is the trusted authenticated entity for token issuance
    return this.auth.loginWithUser(req.user);
  }

  @ApiOperation({
    summary: 'Get current user profile',
    description:
      "Retrieves the authenticated user's profile information using JWT access token.",
  })
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    type: UserResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired JWT token',
  })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAccessGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtClaims): Promise<UserResponse> {
    return this.auth.me(user.sub);
  }

  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generates a new access token using a valid refresh token. Both refresh token (body) and access token (header) are required.',
  })
  @ApiBody({
    type: RefreshDto,
    description: 'Refresh token to generate new access token',
  })
  @ApiOkResponse({
    description: 'Tokens successfully refreshed',
    type: TokensResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token',
  })
  @ApiBadRequestResponse({
    description: 'Missing refresh token in request body',
  })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<TokensResponse> {
    // token also comes via Authorization header; body param is for explicit API contract
    return this.auth.refresh(dto.refreshToken, user.sub);
  }

  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates both access and refresh tokens to properly log out the user. Requires valid access token in header and refresh token in body.',
  })
  @ApiBody({
    type: LogoutDto,
    description: 'Refresh token to invalidate during logout',
  })
  @ApiOkResponse({
    description: 'User successfully logged out',
    type: LogoutResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired access token',
  })
  @ApiBadRequestResponse({
    description: 'Missing refresh token in request body',
  })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAccessGuard)
  @Post('logout')
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request & { token?: string },
  ): Promise<LogoutResponse> {
    // Use token from request (assigned by JwtAccessGuard)
    const accessToken = req.token || '';
    return this.auth.logout(accessToken, dto.refreshToken);
  }
}
