import { User } from '@/stores/auth-store';

/**
 * Family member interface extending the base User interface
 * Includes invitation status for pending family members
 */
export interface FamilyMember extends User {
  invitationStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedAt?: string;
  joinedAt?: string;
}

/**
 * Family invitation interface for managing pending invitations
 */
export interface FamilyInvitation {
  id: string;
  email: string;
  role: 'parent' | 'child';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token?: string;
}

/**
 * Room assignment interface for managing user access to rooms
 */
export interface RoomAssignment {
  userId: string;
  roomId: string;
  roomName: string;
  accessLevel: 'VIEW_ONLY' | 'CONTROL' | 'ADMIN';
  assignedAt: string;
}

/**
 * Family state interface for the Zustand store
 */
export interface FamilyState {
  familyMembers: FamilyMember[];
  roomAssignments: Record<string, RoomAssignment[]>; // userId -> assignments
  invitations: FamilyInvitation[];
  isLoadingMembers: boolean;
  isLoadingAssignments: boolean;
  error: string | null;
}

/**
 * Request interface for adding a new family member
 */
export interface AddFamilyMemberRequest {
  email: string;
  fullName: string;
  role: 'parent' | 'child';
  shouldSendInvitation: boolean;
}

/**
 * Request interface for updating room assignments
 */
export interface UpdateRoomAssignmentsRequest {
  roomIds: string[];
  accessLevel?: 'VIEW_ONLY' | 'CONTROL' | 'ADMIN';
}

/**
 * Request interface for sending family invitations
 */
export interface SendInvitationRequest {
  email: string;
  role: 'parent' | 'child';
  message?: string;
}

/**
 * Response interface for family member operations
 */
export interface FamilyMemberResponse {
  member: FamilyMember;
  roomAssignments: RoomAssignment[];
}

/**
 * Family statistics interface for dashboard display
 */
export interface FamilyStats {
  totalMembers: number;
  parentCount: number;
  childCount: number;
  pendingInvitations: number;
  totalRoomAssignments: number;
}

/**
 * Family permission enum for role-based access control
 */
export enum FamilyPermission {
  MANAGE_FAMILY = 'MANAGE_FAMILY',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  REMOVE_MEMBERS = 'REMOVE_MEMBERS',
  ASSIGN_ROOMS = 'ASSIGN_ROOMS',
  VIEW_USAGE = 'VIEW_USAGE',
  MANAGE_QUOTAS = 'MANAGE_QUOTAS',
  CONTROL_AC = 'CONTROL_AC',
}

/**
 * Role permission mapping for access control
 */
export const ROLE_PERMISSIONS: Record<'parent' | 'child', FamilyPermission[]> = {
  parent: [
    FamilyPermission.MANAGE_FAMILY,
    FamilyPermission.INVITE_MEMBERS,
    FamilyPermission.REMOVE_MEMBERS,
    FamilyPermission.ASSIGN_ROOMS,
    FamilyPermission.VIEW_USAGE,
    FamilyPermission.MANAGE_QUOTAS,
    FamilyPermission.CONTROL_AC,
  ],
  child: [
    FamilyPermission.VIEW_USAGE,
    FamilyPermission.CONTROL_AC, // Limited by room assignments and quotas
  ],
};

/**
 * Helper function to check if a user has a specific permission
 */
export const hasPermission = (role: 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest' | undefined, permission: FamilyPermission): boolean => {
  if (!role) return false;
  // Normalize role to lowercase and map to supported roles
  const normalizedRole = role.toLowerCase() as 'parent' | 'child';
  
  // Map other roles to parent or child for permission checking
  let mappedRole: 'parent' | 'child';
  if (normalizedRole === 'admin' || normalizedRole === 'adult') {
    mappedRole = 'parent'; // Admin and adult have parent-level permissions
  } else {
    mappedRole = normalizedRole === 'parent' ? 'parent' : 'child'; // Default to child for teen, guest, etc.
  }
  
  return ROLE_PERMISSIONS[mappedRole]?.includes(permission) ?? false;
};

/**
 * Helper function to get family member display name
 */
export const getFamilyMemberDisplayName = (member: FamilyMember): string => {
  return member.name || member.email;
};

/**
 * Helper function to get invitation status color for UI
 */
export const getInvitationStatusColor = (status: FamilyInvitation['status']): string => {
  switch (status) {
    case 'PENDING':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'ACCEPTED':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'DECLINED':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'EXPIRED':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

/**
 * Helper function to check if invitation is still valid
 */
export const isInvitationValid = (invitation: FamilyInvitation): boolean => {
  return invitation.status === 'PENDING' && new Date(invitation.expiresAt) > new Date();
};