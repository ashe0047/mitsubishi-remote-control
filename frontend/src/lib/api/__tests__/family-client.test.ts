/**
 * Family Client Tests
 * Tests for the migrated family client using axios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { familyApiClient, handleFamilyApiError, isApiError, FamilyErrorCode } from '../family-client';
import { axiosClient } from '@/lib/http/axios-client';

// Mock the axios client
vi.mock('@/lib/http/axios-client', () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FamilyApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFamilyMembers', () => {
    it('should call axios client with correct parameters', async () => {
      const mockMembers = [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'parent' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com', role: 'child' },
      ];

      vi.mocked(axiosClient.get).mockResolvedValue(mockMembers);

      const result = await familyApiClient.getFamilyMembers();

      expect(axiosClient.get).toHaveBeenCalledWith('/api/users', {
        deduplicationKey: 'family-members',
      });
      expect(result).toEqual(mockMembers);
    });
  });

  describe('addFamilyMember', () => {
    it('should validate request data before making API call', async () => {
      const invalidData = {
        email: 'invalid-email',
        fullName: '',
        role: 'INVALID_ROLE' as any,
        shouldSendInvitation: true,
      };

      await expect(familyApiClient.addFamilyMember(invalidData)).rejects.toThrow('Validation failed');
    });

    it('should call axios client with valid data', async () => {
      const validData = {
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'child' as const,
        shouldSendInvitation: true,
      };

      const mockResponse = { id: '1', ...validData };
      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const result = await familyApiClient.addFamilyMember(validData);

      expect(axiosClient.post).toHaveBeenCalledWith('/api/users', validData, {
        timeout: 30000,
        retries: 1,
        enableLogging: false,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateRoomAssignments', () => {
    it('should validate user ID and request data', async () => {
      const invalidUserId = '';
      const validData = {
        roomIds: ['room1', 'room2'],
        accessLevel: 'CONTROL' as const,
      };

      await expect(
        familyApiClient.updateRoomAssignments(invalidUserId, validData)
      ).rejects.toThrow('Valid user ID is required');
    });

    it('should call axios client with valid parameters', async () => {
      const userId = 'user123';
      const validData = {
        roomIds: ['room1', 'room2'],
        accessLevel: 'CONTROL' as const,
      };

      vi.mocked(axiosClient.put).mockResolvedValue(undefined);

      await familyApiClient.updateRoomAssignments(userId, validData);

      expect(axiosClient.put).toHaveBeenCalledWith(
        `/api/users/${userId}/rooms`,
        validData,
        {
          timeout: 30000,
          retries: 2,
          enableLogging: false,
        }
      );
    });
  });
});

describe('Error Handling', () => {
  describe('handleFamilyApiError', () => {
    it('should handle family-specific error codes', () => {
      const apiError = new Error('Family member not found') as any;
      apiError.code = FamilyErrorCode.FAMILY_MEMBER_NOT_FOUND;
      apiError.status = 404;

      const message = handleFamilyApiError(apiError);
      expect(message).toBe('Family member not found. They may have been removed from the family.');
    });

    it('should handle HTTP status codes', () => {
      const apiError = new Error('Unauthorized') as any;
      apiError.status = 401;
      apiError.code = 'UNAUTHORIZED';

      const message = handleFamilyApiError(apiError);
      expect(message).toBe('You are not authorized. Please log in again.');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');

      const message = handleFamilyApiError(genericError);
      expect(message).toBe('Something went wrong');
    });
  });

  describe('isApiError', () => {
    it('should identify API errors correctly', () => {
      const apiError = new Error('API Error') as any;
      apiError.status = 400;
      apiError.code = 'BAD_REQUEST';

      expect(isApiError(apiError)).toBe(true);
    });

    it('should reject non-API errors', () => {
      const genericError = new Error('Generic error');
      expect(isApiError(genericError)).toBe(false);
    });
  });
});