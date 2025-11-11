import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/access.enums';
import { JwtClaims } from '../shared/types/auth';
import { FamilyInvitationsService } from './services/family-invitations.service';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { DeclineInvitationDto } from './dto/decline-invitation.dto';
import { CancelInvitationDto } from './dto/cancel-invitation.dto';
import { InviteStatusFilter } from './dto/status-filter.dto';
import { UsersCommonService } from 'src/users/services';

@ApiTags('households')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('households')
export class HouseholdController {
  constructor(
    private readonly invitations: FamilyInvitationsService,
    private readonly userCommonService: UsersCommonService,
  ) {}

  @ApiOperation({ summary: 'Send household invitation' })
  @Post('invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  async sendInvitation(
    @CurrentUser() user: JwtClaims,
    @Body() dto: SendInvitationDto,
  ) {
    return await this.invitations.sendInvitation(
      user.householdId,
      user.sub,
      dto,
    );
  }

  @ApiOperation({ summary: 'List household invitations' })
  @Get('invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  async listInvitations(
    @CurrentUser() user: JwtClaims,
    @Query() query: InviteStatusFilter,
  ) {
    return await this.invitations.listInvitations(
      user.householdId,
      query.status,
    );
  }

  @ApiOperation({ summary: 'Validate invitation token' })
  @Post('invitations/validate')
  async validateInvitation(@Body() dto: DeclineInvitationDto) {
    const invitation = await this.invitations.validateToken(dto.token);
    return {
      valid: !!invitation,
      email: invitation?.email,
      name: invitation?.name,
      role: invitation?.role,
      expiresAt: invitation?.expiresAt,
    };
  }

  @ApiOperation({ summary: 'Accept household invitation' })
  @Post('invitations/accept')
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return await this.invitations.acceptInvitation(dto);
  }

  @ApiOperation({ summary: 'Decline household invitation' })
  @Post('invitations/decline')
  async declineInvitation(@Body() dto: DeclineInvitationDto) {
    await this.invitations.declineInvitation(dto.token);
    return { message: 'Invitation declined' };
  }

  @ApiOperation({ summary: 'Cancel household invitation' })
  @Post('invitations/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  async cancelInvitation(
    @CurrentUser() user: JwtClaims,
    @Body() dto: CancelInvitationDto,
  ) {
    await this.invitations.cancelInvitation(user.householdId, dto.invitationId);
    return { message: 'Invitation cancelled' };
  }

  @ApiOperation({ summary: 'List household members' })
  @Get('members')
  async listMembers(@CurrentUser() user: JwtClaims) {
    return await this.userCommonService.listByHousehold(user.householdId);
  }
}
