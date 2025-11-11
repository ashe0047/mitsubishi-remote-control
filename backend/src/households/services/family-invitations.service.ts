import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyInvitation } from '../entities/family-invitation.entity';
import { SendInvitationDto } from '../dto/send-invitation.dto';
import { InvitationStatus } from '../enums/invitation.enums';
import { UserRole } from '../../users/enums/access.enums';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UsersCommonService } from 'src/users/services';

@Injectable()
export class FamilyInvitationsService {
  constructor(
    @InjectRepository(FamilyInvitation)
    private readonly invitationsRepo: Repository<FamilyInvitation>,
    private readonly userCommonService: UsersCommonService,
    private readonly config: ConfigService,
  ) {}

  async sendInvitation(
    householdId: string,
    invitedByUserId: string,
    dto: SendInvitationDto,
  ): Promise<FamilyInvitation> {
    const existing = await this.invitationsRepo.findOne({
      where: {
        householdId,
        email: dto.email.toLowerCase(),
        status: InvitationStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Invitation already pending for this email',
      );
    }

    const token = this.generateToken();
    const expiryDays = this.config.get<number>(
      'households.invitationExpiryDays',
      7,
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const invitation = this.invitationsRepo.create({
      householdId,
      invitedByUserId,
      email: dto.email.toLowerCase(),
      name: dto.name ?? null,
      role: dto.role ?? UserRole.CHILD,
      message: dto.message ?? null,
      token,
      status: InvitationStatus.PENDING,
      sentAt: new Date(),
      expiresAt,
    });

    return await this.invitationsRepo.save(invitation);
  }

  async listInvitations(
    householdId: string,
    status?: InvitationStatus,
  ): Promise<FamilyInvitation[]> {
    const where: Record<string, unknown> = { householdId };
    if (status) {
      where.status = status;
    }

    return await this.invitationsRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async validateToken(token: string): Promise<FamilyInvitation | null> {
    const invitation = await this.invitationsRepo.findOne({
      where: { token },
    });
    if (!invitation) {
      return null;
    }

    if (invitation.isExpired) {
      return null;
    }

    return invitation;
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.invitationsRepo.findOne({
      where: { token: dto.token },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!invitation.canBeAccepted) {
      throw new BadRequestException('Invitation cannot be accepted');
    }

    // Create user if necessary
    const user = await this.userCommonService.create({
      email: invitation.email,
      name: dto.name ?? invitation.name ?? invitation.email,
      password: dto.password ?? this.generateTemporaryPassword(),
    });

    // Update invitation state
    invitation.accept(user.id);
    await this.invitationsRepo.save(invitation);

    // Attach user to household with invited role
    await this.userCommonService.updateHouseholdAndRole(
      user.id,
      invitation.householdId,
      invitation.role,
    );

    return { user, invitation };
  }

  async declineInvitation(token: string): Promise<void> {
    const invitation = await this.invitationsRepo.findOne({
      where: { token },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!invitation.isPending) {
      throw new BadRequestException('Invitation is not pending');
    }

    invitation.decline();
    await this.invitationsRepo.save(invitation);
  }

  async cancelInvitation(
    householdId: string,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.invitationsRepo.findOne({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.householdId !== householdId) {
      throw new ForbiddenException('Invitation does not belong to household');
    }

    if (!invitation.isPending) {
      throw new BadRequestException('Invitation is not pending');
    }

    invitation.cancel();
    await this.invitationsRepo.save(invitation);
  }

  private generateToken(): string {
    return randomBytes(24).toString('base64url');
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url');
  }
}
