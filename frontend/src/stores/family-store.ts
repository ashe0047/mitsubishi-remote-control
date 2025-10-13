import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { 
  FamilyMember, 
  FamilyInvitation, 
  RoomAssignment, 
  FamilyState,
  AddFamilyMemberRequest,
  UpdateRoomAssignmentsRequest,
  SendInvitationRequest,
  FamilyStats,
  hasPermission,
  FamilyPermission
} from '@/types/family';
import { familyApiClient, handleFamilyApiError } from '@/lib/api/family-client';

/**
 * Family store actions interface with comprehensive family management operations
 */
interface FamilyActions {
  // Family member management
  loadFamilyMembers: () => Promise<void>;
  addFamilyMember: (data: AddFamilyMemberRequest) => Promise<FamilyMember>;
  updateFamilyMember: (userId: string, updates: Partial<FamilyMember>) => Promise<FamilyMember>;
  removeFamilyMember: (userId: string) => Promise<void>;
  
  // Room assignment management
  loadRoomAssignments: (userId?: string) => Promise<void>;
  updateRoomAssignments: (userId: string, assignments: UpdateRoomAssignmentsRequest) => Promise<void>;
  
  // Invitation management
  sendInvitation: (request: SendInvitationRequest) => Promise<FamilyInvitation>;
  loadInvitations: () => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  
  // Statistics and dashboard
  loadFamilyStats: () => Promise<void>;
  
  // State management
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoadingMembers: (loading: boolean) => void;
  setLoadingAssignments: (loading: boolean) => void;
  
  // Selectors and computed values
  getFamilyMember: (userId: string) => FamilyMember | null;
  getUserRooms: (userId: string) => RoomAssignment[];
  getChildrenUsers: () => FamilyMember[];
  getParentUsers: () => FamilyMember[];
  canUserAccessRoom: (userId: string, roomId: string) => boolean;
  hasUserPermission: (userId: string, permission: FamilyPermission) => boolean;
  getPendingInvitations: () => FamilyInvitation[];
  getAcceptedInvitations: () => FamilyInvitation[];
  getTotalMemberCount: () => number;
}

/**
 * Extended family state interface including statistics
 */
interface ExtendedFamilyState extends FamilyState {
  stats: FamilyStats | null;
  isLoadingStats: boolean;
}

/**
 * Complete family store interface
 */
type FamilyStore = ExtendedFamilyState & FamilyActions;

/**
 * Initial state for the family store
 */
const initialState: ExtendedFamilyState = {
  familyMembers: [],
  roomAssignments: {},
  invitations: [],
  stats: null,
  isLoadingMembers: false,
  isLoadingAssignments: false,
  isLoadingStats: false,
  error: null,
};

/**
 * Family management store using Zustand with Immer and selectors
 * Provides comprehensive family member and room assignment management
 */
export const useFamilyStore = create<FamilyStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // Family member management actions
      loadFamilyMembers: async () => {
        set((state) => {
          state.isLoadingMembers = true;
          state.error = null;
        });

        try {
          const members = await familyApiClient.getFamilyMembers();
          set((state) => {
            state.familyMembers = members;
            state.isLoadingMembers = false;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
            state.isLoadingMembers = false;
          });
          console.error('Failed to load family members:', error);
        }
      },

      addFamilyMember: async (data: AddFamilyMemberRequest): Promise<FamilyMember> => {
        try {
          const newMember = await familyApiClient.addFamilyMember(data);
          set((state) => {
            state.familyMembers.push(newMember);
            state.error = null;
          });
          return newMember;
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      updateFamilyMember: async (userId: string, updates: Partial<FamilyMember>): Promise<FamilyMember> => {
        try {
          const updatedMember = await familyApiClient.updateFamilyMember(userId, updates);
          set((state) => {
            const index = state.familyMembers.findIndex((m: FamilyMember) => m.id === userId);
            if (index >= 0) {
              state.familyMembers[index] = updatedMember;
            }
            state.error = null;
          });
          return updatedMember;
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      removeFamilyMember: async (userId: string): Promise<void> => {
        try {
          await familyApiClient.removeFamilyMember(userId);
          set((state) => {
            state.familyMembers = state.familyMembers.filter((m: FamilyMember) => m.id !== userId);
            delete state.roomAssignments[userId];
            state.error = null;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      // Room assignment management actions
      loadRoomAssignments: async (userId?: string): Promise<void> => {
        set((state) => {
          state.isLoadingAssignments = true;
          state.error = null;
        });

        try {
          if (userId) {
            const assignments = await familyApiClient.getUserRoomAssignments(userId);
            set((state) => {
              state.roomAssignments[userId] = assignments;
              state.isLoadingAssignments = false;
            });
          } else {
            const allAssignments = await familyApiClient.getAllRoomAssignments();
            set((state) => {
              state.roomAssignments = allAssignments;
              state.isLoadingAssignments = false;
            });
          }
        } catch (error) {
          // Ignore canceled requests (deduplication) - they're not real errors
          if ((error as any)?.code === 'ERR_CANCELED') {
            set((state) => {
              state.isLoadingAssignments = false;
            });
            return;
          }

          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
            state.isLoadingAssignments = false;
          });
          console.error('Failed to load room assignments:', error);
        }
      },

      updateRoomAssignments: async (userId: string, assignments: UpdateRoomAssignmentsRequest): Promise<void> => {
        try {
          await familyApiClient.updateRoomAssignments(userId, assignments);
          // Reload assignments to get updated data
          await get().loadRoomAssignments(userId);
          set((state) => {
            state.error = null;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      // Invitation management actions
      sendInvitation: async (request: SendInvitationRequest): Promise<FamilyInvitation> => {
        try {
          const invitation = await familyApiClient.sendFamilyInvitation(request);
          set((state) => {
            state.invitations.push(invitation);
            state.error = null;
          });
          return invitation;
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      loadInvitations: async (): Promise<void> => {
        try {
          const invitations = await familyApiClient.getFamilyInvitations();
          set((state) => {
            state.invitations = invitations;
            state.error = null;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          console.error('Failed to load invitations:', error);
        }
      },

      resendInvitation: async (invitationId: string): Promise<void> => {
        try {
          const updatedInvitation = await familyApiClient.resendInvitation(invitationId);
          set((state) => {
            const index = state.invitations.findIndex((i: FamilyInvitation) => i.id === invitationId);
            if (index >= 0) {
              state.invitations[index] = updatedInvitation;
            }
            state.error = null;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      cancelInvitation: async (invitationId: string): Promise<void> => {
        try {
          await familyApiClient.cancelInvitation(invitationId);
          set((state) => {
            state.invitations = state.invitations.filter((i: FamilyInvitation) => i.id !== invitationId);
            state.error = null;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },

      // Statistics and dashboard actions
      loadFamilyStats: async (): Promise<void> => {
        set((state) => {
          state.isLoadingStats = true;
          state.error = null;
        });

        try {
          const stats = await familyApiClient.getFamilyStats();
          set((state) => {
            state.stats = stats;
            state.isLoadingStats = false;
          });
        } catch (error) {
          const errorMessage = handleFamilyApiError(error);
          set((state) => {
            state.error = errorMessage;
            state.isLoadingStats = false;
          });
          console.error('Failed to load family stats:', error);
        }
      },

      // State management actions
      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      setLoadingMembers: (loading: boolean) => {
        set((state) => {
          state.isLoadingMembers = loading;
        });
      },

      setLoadingAssignments: (loading: boolean) => {
        set((state) => {
          state.isLoadingAssignments = loading;
        });
      },

      // Selector functions
      getFamilyMember: (userId: string): FamilyMember | null => {
        const state = get();
        return state.familyMembers.find(member => member.id === userId) || null;
      },

      getUserRooms: (userId: string): RoomAssignment[] => {
        const state = get();
        return state.roomAssignments[userId] || [];
      },

      getChildrenUsers: (): FamilyMember[] => {
        const state = get();
        return state.familyMembers.filter(member => member.role === 'child');
      },

      getParentUsers: (): FamilyMember[] => {
        const state = get();
        return state.familyMembers.filter(member => member.role === 'parent');
      },

      canUserAccessRoom: (userId: string, roomId: string): boolean => {
        const state = get();
        const assignments = state.roomAssignments[userId] || [];
        return assignments.some(assignment => 
          assignment.roomId === roomId && 
          assignment.accessLevel !== 'VIEW_ONLY'
        );
      },

      hasUserPermission: (userId: string, permission: FamilyPermission): boolean => {
        const member = get().getFamilyMember(userId);
        if (!member) return false;
        return hasPermission(member.role, permission);
      },

      getPendingInvitations: (): FamilyInvitation[] => {
        const state = get();
        return state.invitations.filter(invitation => invitation.status === 'PENDING');
      },

      getAcceptedInvitations: (): FamilyInvitation[] => {
        const state = get();
        return state.invitations.filter(invitation => invitation.status === 'ACCEPTED');
      },

      getTotalMemberCount: (): number => {
        const state = get();
        return state.familyMembers.length;
      },
    }))
  )
);

// Helper hooks for common selectors following Zustand v5 best practices
export const useFamilyMembers = () => useFamilyStore((state) => state.familyMembers);
export const useRoomAssignments = () => useFamilyStore((state) => state.roomAssignments);
export const useFamilyInvitations = () => useFamilyStore((state) => state.invitations);
export const useFamilyStats = () => useFamilyStore((state) => state.stats);
export const useFamilyError = () => useFamilyStore((state) => state.error);
export const useFamilyLoading = () => useFamilyStore(
  useShallow((state) => ({
    isLoadingMembers: state.isLoadingMembers,
    isLoadingAssignments: state.isLoadingAssignments,
    isLoadingStats: state.isLoadingStats,
  }))
);

// Computed selector hooks with proper memoization
export const useChildrenMembers = () => useFamilyStore((state) => 
  state.familyMembers.filter(member => member.role === 'child')
);
export const useParentMembers = () => useFamilyStore((state) => 
  state.familyMembers.filter(member => member.role === 'parent')
);
export const usePendingInvitations = () => useFamilyStore((state) => 
  state.invitations.filter(invitation => invitation.status === 'PENDING')
);

export default useFamilyStore;