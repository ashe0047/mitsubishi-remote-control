/**
 * Room Access Utilities
 * Implements Strategy pattern for role-based room access control
 */

import type { User } from '@/stores/auth-store';

export interface Room {
  roomId: string;
  roomName: string;
}

export interface RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[];
  getPageTitle(user: User): string;
  getPageDescription(user: User): string;
}

export class ParentRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return allRooms; // Parents see all rooms
  }

  getPageTitle(user: User): string {
    return "All Rooms";
  }

  getPageDescription(user: User): string {
    return "Manage and control all family rooms";
  }
}

export class ChildRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    // TODO: In future, filter based on room assignments from family API
    // For now, show all rooms but with different title
    return allRooms;
  }

  getPageTitle(user: User): string {
    return "My Rooms";
  }

  getPageDescription(user: User): string {
    return "Your assigned rooms";
  }
}

export class GuestRoomStrategy implements RoomAccessStrategy {
  filterRooms(allRooms: Room[], user: User): Room[] {
    return []; // Guests see no rooms
  }

  getPageTitle(user: User): string {
    return "Rooms";
  }

  getPageDescription(user: User): string {
    return "Please log in to access rooms";
  }
}

export const getRoomAccessStrategy = (userRole?: string): RoomAccessStrategy => {
  switch (userRole) {
    case 'parent':
      return new ParentRoomStrategy();
    case 'child':
      return new ChildRoomStrategy();
    default:
      return new GuestRoomStrategy();
  }
};

export interface RoomAccessConfig {
  user: User;
  rooms: Room[];
}

export const filterAccessibleRooms = (config: RoomAccessConfig): Room[] => {
  const strategy = getRoomAccessStrategy(config.user.role);
  return strategy.filterRooms(config.rooms, config.user);
};

export const getRoleBasedPageContent = (user?: User) => {
  const strategy = getRoomAccessStrategy(user?.role);
  return {
    title: strategy.getPageTitle(user!),
    description: strategy.getPageDescription(user!)
  };
};