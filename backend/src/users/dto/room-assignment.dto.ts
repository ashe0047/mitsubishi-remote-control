import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { AccessLevel } from '../enums/access-control.enum';

export class AssignUserToRoomsDto {
  @IsArray()
  @IsString({ each: true })
  roomIds: string[];

  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel = AccessLevel.FULL;
}

export class UpdateRoomAccessDto {
  @IsArray()
  @IsString({ each: true })
  roomIds: string[];
}

export class RoomAssignmentResponseDto {
  id: string;
  userId: string;
  roomId: string;
  accessLevel: AccessLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
