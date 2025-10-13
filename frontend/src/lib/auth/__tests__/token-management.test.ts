/**
 * Token Management Tests
 * Tests for enhanced token management functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTokenRemainingTime,
  shouldRefreshToken,
  getTokenExpirationDate,
  setupTokenRefresh,
} from '../auth-client';

describe('Token Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTokenRemainingTime', () => {
    it('should return remaining time in seconds', () => {
      // Create a token that expires in 1 hour
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;
      
      const remainingTime = getTokenRemainingTime(token);
      expect(remainingTime).toBeGreaterThan(3500); // Should be close to 3600
      expect(remainingTime).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired token', () => {
      // Create a token that expired 1 hour ago
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: pastExp }))}.signature`;
      
      const remainingTime = getTokenRemainingTime(token);
      expect(remainingTime).toBe(0);
    });

    it('should return 0 for invalid token', () => {
      const remainingTime = getTokenRemainingTime('invalid-token');
      expect(remainingTime).toBe(0);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when token expires within threshold', () => {
      // Create a token that expires in 3 minutes
      const futureExp = Math.floor(Date.now() / 1000) + 180;
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;
      
      const shouldRefresh = shouldRefreshToken(token, 5); // 5 minute threshold
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when token has plenty of time left', () => {
      // Create a token that expires in 10 minutes
      const futureExp = Math.floor(Date.now() / 1000) + 600;
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;
      
      const shouldRefresh = shouldRefreshToken(token, 5); // 5 minute threshold
      expect(shouldRefresh).toBe(false);
    });

    it('should return true for invalid token', () => {
      const shouldRefresh = shouldRefreshToken('invalid-token', 5);
      expect(shouldRefresh).toBe(true);
    });
  });

  describe('getTokenExpirationDate', () => {
    it('should return correct expiration date', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;
      
      const expirationDate = getTokenExpirationDate(token);
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate?.getTime()).toBe(futureExp * 1000);
    });

    it('should return null for token without expiration', () => {
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: 'user123' }))}.signature`;
      
      const expirationDate = getTokenExpirationDate(token);
      expect(expirationDate).toBeNull();
    });

    it('should return null for invalid token', () => {
      const expirationDate = getTokenExpirationDate('invalid-token');
      expect(expirationDate).toBeNull();
    });
  });

  describe('setupTokenRefresh', () => {
    beforeEach(() => {
      // Mock window and global objects
      Object.defineProperty(global, 'window', {
        value: {
          location: { pathname: '/' },
        },
        writable: true,
      });
      
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should setup token refresh with default options', () => {
      const refreshCallback = vi.fn().mockResolvedValue(undefined);
      
      const cleanup = setupTokenRefresh(refreshCallback);
      
      expect(cleanup).toBeInstanceOf(Function);
      expect((global.window as any).__tokenRefreshInterval).toBeDefined();
      
      // Cleanup
      cleanup?.();
      expect((global.window as any).__tokenRefreshInterval).toBeUndefined();
    });

    it('should setup token refresh with custom options', () => {
      const refreshCallback = vi.fn().mockResolvedValue(undefined);
      const onRefreshSuccess = vi.fn();
      const onRefreshFailure = vi.fn();
      
      const cleanup = setupTokenRefresh(refreshCallback, {
        checkInterval: 30000,
        refreshThreshold: 10,
        maxRetries: 5,
        onRefreshSuccess,
        onRefreshFailure,
      });
      
      expect(cleanup).toBeInstanceOf(Function);
      
      // Cleanup
      cleanup?.();
    });
  });
});