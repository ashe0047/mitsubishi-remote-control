import { IsString } from 'class-validator';

export class DeclineInvitationDto {
  @IsString()
  token!: string;
}
