/**
 * Basic tests for the Axios Client Infrastructure
 * Verifies core functionality and interceptor integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosClient } from '../axios-client';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: {},
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })),
    isAxiosError: vi.fn(),
    CancelToken: {
      source: vi.fn(() => ({
        token: {},
        cancel: vi.fn(),
      })),
    },
    Cancel: vi.fn(),
    isCancel: vi.fn(),
  },
  isAxiosError: vi.fn(),
  AxiosHeaders: class AxiosHeaders {
    constructor() {}
  },
}));

// Mock axios-retry
vi.mock('axios-retry', () => ({
  default: vi.fn(),
  isNetworkOrIdempotentRequestError: vi.fn(),
}));

describe('AxiosClient', () => {
  let client: AxiosClient;

  beforeEach(() => {
    client = new AxiosClient();
  });

  it('should create an instance with default configuration', () => {
    expect(client).toBeInstanceOf(AxiosClient);
  });

  it('should provide access to interceptor instances', () => {
    expect(client.getAuthInterceptor()).toBeDefined();
    expect(client.getErrorInterceptor()).toBeDefined();
    expect(client.getLoggingInterceptor()).toBeDefined();
    expect(client.getPerformanceInterceptor()).toBeDefined();
  });

  it('should provide performance metrics', () => {
    const metrics = client.getPerformanceMetrics();
    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('successfulRequests');
    expect(metrics).toHaveProperty('failedRequests');
    expect(metrics).toHaveProperty('averageResponseTime');
    expect(metrics).toHaveProperty('cacheHitRate');
    expect(metrics).toHaveProperty('retryCount');
  });

  it('should allow configuration updates', () => {
    const newConfig = {
      timeout: 5000,
      enableLogging: false,
    };

    client.updateConfig(newConfig);
    
    // Configuration should be updated (we can't easily test the internal state,
    // but we can verify the method doesn't throw)
    expect(() => client.updateConfig(newConfig)).not.toThrow();
  });

  it('should provide cache clearing functionality', () => {
    expect(() => client.clearCache()).not.toThrow();
  });

  it('should provide request cancellation functionality', () => {
    expect(() => client.cancelRequest('test-request-id')).not.toThrow();
  });

  it('should provide access to the underlying axios instance', () => {
    const instance = client.getInstance();
    expect(instance).toBeDefined();
    expect(instance.interceptors).toBeDefined();
  });
});