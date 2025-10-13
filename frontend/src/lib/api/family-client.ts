import { 
  FamilyMember, 
  FamilyInvitation, 
  RoomAssignment, 
  AddFamilyMemberRequest, 
  UpdateRoomAssignmentsRequest,
  SendInvitationRequest,
  FamilyMemberResponse,
  FamilyStats 
} from '@/types/family';
import { axiosClient } from '@/lib/http/axios-client';
import type { ApiError, ApiRequestConfig } from '@/lib/http/axios-client';

/**
 * Family-specific error codes for enhanced error handling
 */
export enum FamilyErrorCode {
  FAMILY_MEMBER_NOT_FOUND = 'FAMILY_MEMBER_NOT_FOUND',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',
  ROOM_ASSIGNMENT_CONFLICT = 'ROOM_ASSIGNMENT_CONFLICT',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  FAMILY_SIZE_LIMIT_EXCEEDED = 'FAMILY_SIZE_LIMIT_EXCEEDED',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  INVALID_INVITATION_TOKEN = 'INVALID_INVITATION_TOKEN',
  ROOM_NOT_AVAILABLE = 'ROOM_NOT_AVAILABLE',
  USER_ALREADY_IN_FAMILY = 'USER_ALREADY_IN_FAMILY',
}

/**
 * Validation functions for family-related requests
 */
export const validateAddFamilyMemberRequest = (data: AddFamilyMemberRequest): string[] => {
  const errors: string[] = [];
  
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (!data.fullName || !data.fullName.trim()) {
    errors.push('Full name is required');
  } else if (data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }
  
  if (!data.role || !['parent', 'child'].includes(data.role)) {
    errors.push('Valid role (parent or child) is required');
  }
  
  return errors;
};

export const validateUpdateRoomAssignmentsRequest = (data: UpdateRoomAssignmentsRequest): string[] => {
  const errors: string[] = [];
  
  if (!Array.isArray(data.roomIds)) {
    errors.push('Room IDs must be an array');
  } else if (data.roomIds.length === 0) {
    errors.push('At least one room ID is required');
  } else if (data.roomIds.some(id => !id || typeof id !== 'string')) {
    errors.push('All room IDs must be non-empty strings');
  }
  
  if (data.accessLevel && !['VIEW_ONLY', 'CONTROL', 'ADMIN'].includes(data.accessLevel)) {
    errors.push('Invalid access level');
  }
  
  return errors;
};

export const validateSendInvitationRequest = (data: SendInvitationRequest): string[] => {
  const errors: string[] = [];
  
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (!data.role || !['parent', 'child'].includes(data.role)) {
    errors.push('Valid role (parent or child) is required');
  }
  
  if (data.message && data.message.length > 500) {
    errors.push('Message must be 500 characters or less');
  }
  
  return errors;
};

/**
 * Family API Client class with comprehensive family management operations
 * Uses centralized axios client with interceptors and enhanced error handling
 */
class FamilyApiClient {
  constructor() {
    // No initialization needed - using centralized axios client
  }

  /**
   * Private helper method to validate request data and throw validation errors
   */
  private validateRequest<T>(data: T, validator: (data: T) => string[]): void {
    const errors = validator(data);
    if (errors.length > 0) {
      const error = new Error(`Validation failed: ${errors.join(', ')}`) as ApiError;
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      error.details = { validationErrors: errors };
      throw error;
    }
  }

  /**
   * Private helper method to create enhanced request config with family-specific settings
   */
  private createFamilyRequestConfig(config?: ApiRequestConfig): ApiRequestConfig {
    return {
      timeout: 30000, // 30 seconds for family operations
      retries: 2, // Default retry count for family operations
      enableLogging: process.env.NODE_ENV === 'development',
      ...config,
    };
  }

  /**
   * Family Member Management Methods
   */

  /**
   * Get all family members for the current user's family
   */
  async getFamilyMembers(config?: ApiRequestConfig): Promise<FamilyMember[]> {
    return axiosClient.get<FamilyMember[]>('/api/users', {
      deduplicationKey: 'family-members',
      ...config,
    });
  }

  /**
   * Add a new family member (with optional invitation)
   */
  async addFamilyMember(data: AddFamilyMemberRequest, config?: ApiRequestConfig): Promise<FamilyMember> {
    // Validate request data
    this.validateRequest(data, validateAddFamilyMemberRequest);
    
    try {
      return await axiosClient.post<FamilyMember>('/api/users', data, 
        this.createFamilyRequestConfig({
          retries: 1, // Reduce retries for user creation to avoid duplicates
          ...config,
        })
      );
    } catch (error) {
      // Transform specific family errors
      if (isApiError(error)) {
        if (error.status === 409) {
          error.code = FamilyErrorCode.DUPLICATE_EMAIL;
          error.message = 'A family member with this email already exists';
        } else if (error.status === 403 && error.message?.includes('family size')) {
          error.code = FamilyErrorCode.FAMILY_SIZE_LIMIT_EXCEEDED;
        }
      }
      throw error;
    }
  }

  /**
   * Update an existing family member's information
   */
  async updateFamilyMember(
    userId: string, 
    updates: Partial<FamilyMember>, 
    config?: ApiRequestConfig
  ): Promise<FamilyMember> {
    return axiosClient.put<FamilyMember>(`/api/users/${userId}`, updates, {
      retries: 2,
      ...config,
    });
  }

  /**
   * Remove a family member from the family
   */
  async removeFamilyMember(userId: string, config?: ApiRequestConfig): Promise<void> {
    return axiosClient.delete<void>(`/api/users/${userId}`, {
      retries: 1, // Minimal retries for deletion
      ...config,
    });
  }

  /**
   * Get detailed information about a specific family member
   */
  async getFamilyMember(userId: string, config?: ApiRequestConfig): Promise<FamilyMemberResponse> {
    return axiosClient.get<FamilyMemberResponse>(`/api/users/${userId}`, {
      deduplicationKey: `family-member-${userId}`,
      ...config,
    });
  }

  /**
   * Room Assignment Management Methods
   */

  /**
   * Get room assignments for a specific user
   */
  async getUserRoomAssignments(userId: string, config?: ApiRequestConfig): Promise<RoomAssignment[]> {
    return axiosClient.get<RoomAssignment[]>(`/api/users/${userId}/rooms`, {
      deduplicationKey: `user-rooms-${userId}`,
      ...config,
    });
  }

  /**
   * Update room assignments for a specific user
   */
  async updateRoomAssignments(
    userId: string, 
    assignments: UpdateRoomAssignmentsRequest, 
    config?: ApiRequestConfig
  ): Promise<void> {
    // Validate user ID
    if (!userId || typeof userId !== 'string') {
      const error = new Error('Valid user ID is required') as ApiError;
      error.code = 'INVALID_USER_ID';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    // Validate request data
    this.validateRequest(assignments, validateUpdateRoomAssignmentsRequest);
    
    try {
      return await axiosClient.put<void>(`/api/users/${userId}/rooms`, assignments, 
        this.createFamilyRequestConfig(config)
      );
    } catch (error) {
      // Transform specific room assignment errors
      if (isApiError(error)) {
        if (error.status === 409) {
          error.code = FamilyErrorCode.ROOM_ASSIGNMENT_CONFLICT;
          error.message = 'Room assignment conflict. Some rooms may already be assigned or unavailable.';
        } else if (error.status === 404 && error.message?.includes('room')) {
          error.code = FamilyErrorCode.ROOM_NOT_AVAILABLE;
          error.message = 'One or more rooms are not available for assignment.';
        }
      }
      throw error;
    }
  }

  /**
   * Get all room assignments for the family
   */
  async getAllRoomAssignments(config?: ApiRequestConfig): Promise<Record<string, RoomAssignment[]>> {
    return axiosClient.get<Record<string, RoomAssignment[]>>('/api/family/room-assignments', {
      deduplicationKey: 'family-room-assignments',
      ...config,
    });
  }

  /**
   * Family Invitation Management Methods
   */

  /**
   * Send a family invitation to a new member
   */
  async sendFamilyInvitation(request: SendInvitationRequest, config?: ApiRequestConfig): Promise<FamilyInvitation> {
    // Validate request data
    this.validateRequest(request, validateSendInvitationRequest);
    
    try {
      return await axiosClient.post<FamilyInvitation>('/api/family/invitations', request, 
        this.createFamilyRequestConfig(config)
      );
    } catch (error) {
      // Transform specific invitation errors
      if (isApiError(error)) {
        if (error.status === 409) {
          error.code = FamilyErrorCode.USER_ALREADY_IN_FAMILY;
          error.message = 'This user is already a member of your family or has a pending invitation.';
        } else if (error.status === 403 && error.message?.includes('family size')) {
          error.code = FamilyErrorCode.FAMILY_SIZE_LIMIT_EXCEEDED;
        }
      }
      throw error;
    }
  }

  /**
   * Get all pending and recent family invitations
   */
  async getFamilyInvitations(config?: ApiRequestConfig): Promise<FamilyInvitation[]> {
    return axiosClient.get<FamilyInvitation[]>('/api/family/invitations', {
      deduplicationKey: 'family-invitations',
      ...config,
    });
  }

  /**
   * Resend a family invitation
   */
  async resendInvitation(invitationId: string, config?: ApiRequestConfig): Promise<FamilyInvitation> {
    return axiosClient.post<FamilyInvitation>(`/api/family/invitations/${invitationId}/resend`, undefined, {
      retries: 2,
      ...config,
    });
  }

  /**
   * Cancel/revoke a pending family invitation
   */
  async cancelInvitation(invitationId: string, config?: ApiRequestConfig): Promise<void> {
    return axiosClient.delete<void>(`/api/family/invitations/${invitationId}`, {
      retries: 1,
      ...config,
    });
  }

  /**
   * Accept a family invitation (used by invited users)
   */
  async acceptInvitation(
    token: string, 
    userData: { name: string; password: string }, 
    config?: ApiRequestConfig
  ): Promise<FamilyMember> {
    // Validate input parameters
    if (!token || typeof token !== 'string') {
      const error = new Error('Valid invitation token is required') as ApiError;
      error.code = 'INVALID_INVITATION_TOKEN';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    if (!userData.name || !userData.name.trim()) {
      const error = new Error('Name is required') as ApiError;
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    if (!userData.password || userData.password.length < 6) {
      const error = new Error('Password must be at least 6 characters long') as ApiError;
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }
    
    try {
      return await axiosClient.post<FamilyMember>('/api/family/invitations/accept', { 
        token, 
        ...userData 
      }, this.createFamilyRequestConfig({
        retries: 1, // Reduce retries to avoid duplicate acceptance
        ...config,
      }));
    } catch (error) {
      // Transform specific invitation errors
      if (isApiError(error)) {
        if (error.status === 410 || error.message?.includes('expired')) {
          error.code = FamilyErrorCode.INVITATION_EXPIRED;
          error.message = 'This invitation has expired. Please request a new invitation.';
        } else if (error.status === 409 || error.message?.includes('already accepted')) {
          error.code = FamilyErrorCode.INVITATION_ALREADY_ACCEPTED;
          error.message = 'This invitation has already been accepted.';
        } else if (error.status === 404 || error.message?.includes('invalid token')) {
          error.code = FamilyErrorCode.INVALID_INVITATION_TOKEN;
          error.message = 'Invalid invitation token. Please check the invitation link.';
        }
      }
      throw error;
    }
  }

  /**
   * Decline a family invitation
   */
  async declineInvitation(token: string, config?: ApiRequestConfig): Promise<void> {
    return axiosClient.post<void>('/api/family/invitations/decline', { token }, {
      retries: 1,
      ...config,
    });
  }

  /**
   * Family Statistics and Dashboard Methods
   */

  /**
   * Get family statistics for dashboard display
   */
  async getFamilyStats(config?: ApiRequestConfig): Promise<FamilyStats> {
    return axiosClient.get<FamilyStats>('/api/family/stats', {
      deduplicationKey: 'family-stats',
      ...config,
    });
  }

  /**
   * Get family usage summary across all members
   */
  async getFamilyUsageSummary(
    period: 'daily' | 'weekly' | 'monthly' = 'daily', 
    config?: ApiRequestConfig
  ): Promise<unknown> {
    return axiosClient.get<unknown>(`/api/family/usage?period=${period}`, {
      deduplicationKey: `family-usage-${period}`,
      ...config,
    });
  }

  /**
   * Utility Methods
   */

  /**
   * Validate invitation token
   */
  async validateInvitationToken(token: string, config?: ApiRequestConfig): Promise<FamilyInvitation> {
    // Validate token parameter
    if (!token || typeof token !== 'string') {
      const error = new Error('Valid invitation token is required') as ApiError;
      error.code = 'INVALID_INVITATION_TOKEN';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    try {
      return await axiosClient.post<FamilyInvitation>('/api/family/invitations/validate', { token }, 
        this.createFamilyRequestConfig(config)
      );
    } catch (error) {
      // Transform specific validation errors
      if (isApiError(error)) {
        if (error.status === 410 || error.message?.includes('expired')) {
          error.code = FamilyErrorCode.INVITATION_EXPIRED;
          error.message = 'This invitation has expired.';
        } else if (error.status === 404 || error.message?.includes('invalid')) {
          error.code = FamilyErrorCode.INVALID_INVITATION_TOKEN;
          error.message = 'Invalid invitation token.';
        }
      }
      throw error;
    }
  }

  /**
   * Search for available rooms that can be assigned
   */
  async getAvailableRooms(config?: ApiRequestConfig): Promise<{ id: string; name: string; location?: string }[]> {
    return axiosClient.get<{ id: string; name: string; location?: string }[]>('/api/rooms', {
      deduplicationKey: 'available-rooms',
      ...config,
    });
  }

  /**
   * Bulk update multiple family members
   */
  async bulkUpdateFamilyMembers(
    updates: { userId: string; updates: Partial<FamilyMember> }[], 
    config?: ApiRequestConfig
  ): Promise<FamilyMember[]> {
    return axiosClient.put<FamilyMember[]>('/api/users/bulk', { updates }, {
      retries: 2,
      timeout: 60000, // Longer timeout for bulk operations
      ...config,
    });
  }

  /**
   * Get family member activity log
   */
  async getFamilyMemberActivity(
    userId: string, 
    limit = 50, 
    config?: ApiRequestConfig
  ): Promise<unknown[]> {
    // Validate parameters
    if (!userId || typeof userId !== 'string') {
      const error = new Error('Valid user ID is required') as ApiError;
      error.code = 'INVALID_USER_ID';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    if (limit < 1 || limit > 1000) {
      const error = new Error('Limit must be between 1 and 1000') as ApiError;
      error.code = 'INVALID_LIMIT';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    return axiosClient.get<unknown[]>(`/api/users/${userId}/activity?limit=${limit}`, 
      this.createFamilyRequestConfig({
        deduplicationKey: `user-activity-${userId}-${limit}`,
        ...config,
      })
    );
  }

  /**
   * Enhanced method to get family members with retry logic for transient failures
   */
  async getFamilyMembersWithRetry(maxRetries = 3, config?: ApiRequestConfig): Promise<FamilyMember[]> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getFamilyMembers(config);
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except rate limiting
        if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Batch operation to update multiple family members with enhanced error handling
   */
  async batchUpdateFamilyMembers(
    updates: { userId: string; updates: Partial<FamilyMember> }[], 
    config?: ApiRequestConfig
  ): Promise<{ successful: FamilyMember[]; failed: { userId: string; error: string }[] }> {
    // Validate batch size
    if (updates.length === 0) {
      const error = new Error('At least one update is required') as ApiError;
      error.code = 'EMPTY_BATCH';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    if (updates.length > 50) {
      const error = new Error('Batch size cannot exceed 50 updates') as ApiError;
      error.code = 'BATCH_SIZE_EXCEEDED';
      error.status = 400;
      error.retryable = false;
      error.timestamp = Date.now();
      throw error;
    }

    try {
      const result = await this.bulkUpdateFamilyMembers(updates, config);
      return { successful: result, failed: [] };
    } catch (error) {
      // If bulk update fails, try individual updates
      const successful: FamilyMember[] = [];
      const failed: { userId: string; error: string }[] = [];

      for (const update of updates) {
        try {
          const result = await this.updateFamilyMember(update.userId, update.updates, {
            ...config,
            retries: 1, // Reduce retries for individual operations in batch
          });
          successful.push(result);
        } catch (individualError) {
          failed.push({
            userId: update.userId,
            error: handleFamilyApiError(individualError),
          });
        }
      }

      return { successful, failed };
    }
  }
}

/**
 * Export singleton instance of FamilyApiClient
 */
export const familyApiClient = new FamilyApiClient();

/**
 * Export class for testing or custom instantiation
 */
export { FamilyApiClient };

/**
 * Type guard for API errors
 */
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof Error && 'status' in error && 'code' in error;
};

/**
 * Helper function to handle family-specific API errors in components
 */
export const handleFamilyApiError = (error: unknown): string => {
  if (isApiError(error)) {
    // Handle family-specific error codes
    switch (error.code) {
      case 'FAMILY_MEMBER_NOT_FOUND':
        return 'Family member not found. They may have been removed from the family.';
      case 'INVITATION_EXPIRED':
        return 'This invitation has expired. Please request a new invitation.';
      case 'INVITATION_ALREADY_ACCEPTED':
        return 'This invitation has already been accepted.';
      case 'ROOM_ASSIGNMENT_CONFLICT':
        return 'There is a conflict with the room assignment. Please try again.';
      case 'INSUFFICIENT_PERMISSIONS':
        return 'You do not have permission to perform this action on family members.';
      case 'FAMILY_SIZE_LIMIT_EXCEEDED':
        return 'Your family has reached the maximum number of members allowed.';
      case 'DUPLICATE_EMAIL':
        return 'A family member with this email address already exists.';
      default:
        break;
    }

    // Handle standard HTTP status codes
    switch (error.status) {
      case 400:
        return error.message || 'Invalid request. Please check your input.';
      case 401:
        return 'You are not authorized. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested family member or resource was not found.';
      case 409:
        return error.message || 'This action conflicts with existing family data.';
      case 422:
        return error.message || 'The provided data is invalid. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment before trying again.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred while managing family members.';
};

/**
 * Helper function to determine if an error is retryable
 */
export const isFamilyErrorRetryable = (error: unknown): boolean => {
  if (isApiError(error)) {
    // Don't retry client errors (4xx) except for specific cases
    if (error.status >= 400 && error.status < 500) {
      // Retry on rate limiting and request timeout
      return error.status === 429 || error.status === 408;
    }
    
    // Retry server errors (5xx) and network errors
    return error.status >= 500 || !error.status;
  }
  
  return false;
};

/**
 * Helper function to get user-friendly error messages for specific family operations
 */
export const getFamilyOperationErrorMessage = (operation: string, error: unknown): string => {
  const baseMessage = handleFamilyApiError(error);
  
  switch (operation) {
    case 'addMember':
      return `Failed to add family member: ${baseMessage}`;
    case 'updateMember':
      return `Failed to update family member: ${baseMessage}`;
    case 'removeMember':
      return `Failed to remove family member: ${baseMessage}`;
    case 'assignRooms':
      return `Failed to assign rooms: ${baseMessage}`;
    case 'sendInvitation':
      return `Failed to send invitation: ${baseMessage}`;
    case 'acceptInvitation':
      return `Failed to accept invitation: ${baseMessage}`;
    case 'loadMembers':
      return `Failed to load family members: ${baseMessage}`;
    case 'loadStats':
      return `Failed to load family statistics: ${baseMessage}`;
    default:
      return baseMessage;
  }
};

/**
 * Helper function to extract error context for debugging
 */
export const extractFamilyErrorContext = (error: unknown): Record<string, any> => {
  if (isApiError(error)) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      timestamp: error.timestamp,
      retryable: error.retryable,
      details: error.details,
      context: error.context,
    };
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  return { error: String(error) };
};

/**
 * Helper function to create a standardized family API error
 */
export const createFamilyApiError = (
  message: string,
  code: FamilyErrorCode | string,
  status = 500,
  retryable = false,
  details?: any
): ApiError => {
  const error = new Error(message) as ApiError;
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  error.timestamp = Date.now();
  error.details = details;
  return error;
};