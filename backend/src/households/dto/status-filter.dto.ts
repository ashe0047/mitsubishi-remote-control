import { IsEnum, IsOptional } from 'class-validator';
import { InvitationStatus } from '../enums/invitation.enums';

export class InviteStatusFilter {
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}
