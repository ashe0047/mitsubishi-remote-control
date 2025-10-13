/**
 * Auth Client Tests
 * Tests for the axios-based authentication client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authClient, AuthClient, setAuthToken, getAuthToken, clearAuthToken, isValidToken } from '../auth-client';
import { axiosClient } from '../../http/axios-client';

// Mock the axios client
vi.mock('../../http/axios-client', () => ({
  axiosClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock browser environment
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock global objects
Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
    location: {
      origin: 'http://localhost:3000',
      pathname: '/',
      href: 'http://localhost:3000/',
    },
  },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    cookie: '',
  },
  writable: true,
});

describe('AuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    (global as any).document.cookie = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should set auth token in localStorage and cookie', () => {
      const token = 'test-token';
      setAuthToken(token);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth-token', token);
      expect((global as any).document.cookie).toContain('auth-token=test-token');
    });

    it('should get auth token from localStorage', () => {
      const token = 'test-token';
      localStorageMock.getItem.mockReturnValue(token);

      const result = getAuthToken();
      expect(result).toBe(token);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth-token');
    });

    it('should clear auth token from localStorage and cookie', () => {
      clearAuthToken();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth-token');
      expect((global as any).document.cookie).toContain('expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should validate JWT token structure', () => {
      // Valid JWT token (header.payload.signature)
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Lp-38GKDuZu9W8s3KIC-yQgw7yzFW1hzwBUjZ_8nQzI';
      expect(isValidToken(validToken)).toBe(true);

      // Invalid token structure
      expect(isValidToken('invalid-token')).toBe(false);
      expect(isValidToken('')).toBe(false);
    });
  });

  describe('Authentication Methods', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'parent',
            familyId: 'family-1',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await authClient.login(credentials);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/login',
        credentials,
        {
          timeout: 10000,
          retries: 2,
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login failure', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
          },
        },
      };

      vi.mocked(axiosClient.post).mockRejectedValue(mockError);

      const credentials = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      await expect(authClient.login(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('should register successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'parent',
            familyId: 'family-1',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        familyName: 'Test Family',
      };

      const result = await authClient.register(credentials);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/register',
        credentials,
        {
          timeout: 15000,
          retries: 2,
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should logout successfully', async () => {
      vi.mocked(axiosClient.post).mockResolvedValue({});

      const refreshToken = 'refresh-token';
      await authClient.logout(refreshToken);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/logout',
        { refreshToken },
        {
          timeout: 5000,
          retries: 1,
        }
      );
    });

    it('should refresh token successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'parent',
            familyId: 'family-1',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        },
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const refreshToken = 'refresh-token';
      const result = await authClient.refreshToken(refreshToken);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/refresh',
        { refreshToken },
        {
          timeout: 10000,
          retries: 2,
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should validate session successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'parent',
          familyId: 'family-1',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      };

      vi.mocked(axiosClient.get).mockResolvedValue(mockResponse);

      const result = await authClient.validateSession();

      expect(axiosClient.get).toHaveBeenCalledWith(
        '/api/auth/me',
        {
          timeout: 5000,
          retries: 1,
        }
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Password Management', () => {
    it('should request password reset successfully', async () => {
      const mockResponse = {
        success: true,
        data: undefined,
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const email = 'test@example.com';
      await authClient.forgotPassword(email);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        { email },
        {
          timeout: 10000,
          retries: 2,
        }
      );
    });

    it('should reset password successfully', async () => {
      const mockResponse = {
        success: true,
        data: undefined,
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const token = 'reset-token';
      const newPassword = 'newpassword123';
      await authClient.resetPassword(token, newPassword);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        { token, newPassword },
        {
          timeout: 10000,
          retries: 2,
        }
      );
    });

    it('should change password successfully', async () => {
      const mockResponse = {
        success: true,
        data: undefined,
      };

      vi.mocked(axiosClient.post).mockResolvedValue(mockResponse);

      const currentPassword = 'oldpassword123';
      const newPassword = 'newpassword123';
      await authClient.changePassword(currentPassword, newPassword);

      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        {
          timeout: 10000,
          retries: 2,
        }
      );
    });
  });
});

describe('AuthClient Class', () => {
  it('should create a new instance', () => {
    const client = new AuthClient();
    expect(client).toBeInstanceOf(AuthClient);
  });

  it('should export default instance', () => {
    expect(authClient).toBeInstanceOf(AuthClient);
  });
});