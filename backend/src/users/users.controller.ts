import { Body, Controller, Get, Post, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersApiService } from './services/api.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto, PasswordDto } from './dto/request';
import { JwtClaims } from '../shared/types/auth';

@ApiTags('users')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersApi: UsersApiService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @Get('me')
  async me(@CurrentUser() user: JwtClaims) {
    return this.usersApi.getProfile(user.sub);
  }

  @ApiOperation({ summary: 'Update user profile' })
  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtClaims,
    @Body() patch: UpdateProfileDto,
  ) {
    return this.usersApi.updateProfile(user.sub, { name: patch.name });
  }

  @ApiOperation({ summary: 'Change user password' })
  @Post('me/password')
  async changePassword(
    @CurrentUser() user: JwtClaims,
    @Body() dto: PasswordDto,
  ) {
    return this.usersApi.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
