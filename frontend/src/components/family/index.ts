/**
 * Family Management Components
 * Comprehensive family management system for AC control application
 */

// Main dashboard and overview components
export { FamilyDashboard } from './FamilyDashboard';
export { FamilyNavigation } from './FamilyNavigation';

// Family member management components
export { FamilyMemberManagement } from './FamilyMemberManagement';

// Room assignment components
export { RoomAssignmentInterface } from './RoomAssignmentInterface';

// Re-export types for convenience
export type {
  FamilyMember,
  FamilyInvitation,
  RoomAssignment,
  FamilyState,
  AddFamilyMemberRequest,
  UpdateRoomAssignmentsRequest,
  SendInvitationRequest,
  FamilyMemberResponse,
  FamilyStats,
  FamilyPermission,
} from '@/types/family';

export { 
  hasPermission,
  getFamilyMemberDisplayName,
  getInvitationStatusColor,
  isInvitationValid,
  ROLE_PERMISSIONS,
} from '@/types/family';