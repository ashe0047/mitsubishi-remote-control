import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AccessControl } from '../entities/access-control.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/access.enums';
import { AccessLevel, TargetType } from '../enums/access-control.enum';

/**
 * Service for managing user room assignments
 * Matches Spring Boot room assignment functionality
 */
@Injectable()
export class RoomAssignmentService {
  constructor(
    @InjectRepository(AccessControl)
    private readonly roomAssignmentRepo: Repository<AccessControl>,
  ) {}

  /**
   * Assign user to multiple rooms
   * Matches Spring Boot assignUserToRooms method
   */
  async assignUserToRooms(
    userId: string,
    roomIds: string[],
    accessLevel: AccessLevel = AccessLevel.LIMITED,
  ): Promise<void> {
    if (!roomIds || roomIds.length === 0) {
      return;
    }

    // Create new assignments (matches Spring Boot - no deactivation)
    const assignments = roomIds.map((roomId) =>
      this.roomAssignmentRepo.create({
        userId,
        targetType: TargetType.ROOM,
        targetId: roomId,
        accessLevel,
      }),
    );

    await this.roomAssignmentRepo.save(assignments);
  }

  /**
   * Get all room assignments for a user
   */
  async getUserRoomAssignments(userId: string): Promise<AccessControl[]> {
    return await this.roomAssignmentRepo.find({
      where: { userId, targetType: TargetType.ROOM },
      relations: ['user', 'room'],
    });
  }

  /**
   * Deactivate all assignments for a user
   * Matches Spring Boot deactivateAllAssignmentsForUser
   */
  async deactivateAllAssignmentsForUser(userId: string): Promise<void> {
    await this.roomAssignmentRepo.update(
      { userId, targetType: TargetType.ROOM },
      { deletedAt: new Date(), isArchived: true },
    );
  }

  /**
   * Update user room access
   * Matches Spring Boot updateUserRoomAccess
   */
  async updateUserRoomAccess(
    userId: string,
    roomIds: string[],
    requestingUser: User,
  ): Promise<void> {
    // Validate parent permissions (matches Spring Boot)
    if (requestingUser.role !== UserRole.PARENT) {
      throw new ForbiddenException('Only parents can update room access');
    }

    const targetUser = await this.roomAssignmentRepo.manager.findOne(User, {
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Verify user is in same household (matches Spring Boot)
    if (targetUser.householdId !== requestingUser.householdId) {
      throw new ForbiddenException('User not in same household');
    }

    // Remove existing assignments and create new ones (matches Spring Boot line 157-158)
    await this.deactivateAllAssignmentsForUser(userId);
    await this.assignUserToRooms(userId, roomIds);
  }

  /**
   * Check if user can access a specific room
   */
  async canUserAccessRoom(userId: string, roomId: string): Promise<boolean> {
    const assignment = await this.roomAssignmentRepo.findOne({
      where: {
        userId,
        targetId: roomId,
        targetType: TargetType.ROOM,
        deletedAt: IsNull(),
      },
    });

    return assignment?.isActive ?? false;
  }

  /**
   * Get user's access level for a room
   */
  async getUserAccessLevel(
    userId: string,
    roomId: string,
  ): Promise<AccessLevel | null> {
    const assignment = await this.roomAssignmentRepo.findOne({
      where: {
        userId,
        targetId: roomId,
        targetType: TargetType.ROOM,
        deletedAt: IsNull(),
      },
    });

    return assignment?.accessLevel ?? null;
  }

  /**
   * Remove specific room assignment
   */
  async removeRoomAssignment(userId: string, roomId: string): Promise<void> {
    await this.roomAssignmentRepo.update(
      { userId, targetId: roomId, targetType: TargetType.ROOM },
      { deletedAt: new Date(), isArchived: true },
    );
  }

  /**
   * Get all users assigned to a specific room
   */
  async getUsersForRoom(roomId: string): Promise<AccessControl[]> {
    return await this.roomAssignmentRepo.find({
      where: {
        targetId: roomId,
        targetType: TargetType.ROOM,
        deletedAt: IsNull(),
      },
      relations: ['user'],
    });
  }
}
