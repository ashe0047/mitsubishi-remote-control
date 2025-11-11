import { IsUUID } from 'class-validator';

export class CancelInvitationDto {
  @IsUUID()
  invitationId!: string;
}
