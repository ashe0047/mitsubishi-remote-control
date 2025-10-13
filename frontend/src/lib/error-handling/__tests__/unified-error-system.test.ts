/**
 * Tests for Unified Error System
 * Verifies comprehensive error handling for HTTP and WebSocket errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosError } from 'axios';
import {
  AppError,
  AppHttpError,
  AppWebSocketError,
  transformAxiosError,
  transformWebSocketError,
  isAppError,
  isAppHttpError,
  isAppWebSocketError,
} from '../error-system';

// Mock window for browser environment
Object.defineProperty(global, 'window', {
  value: {
    location: {
      href: 'http://localhost:3000',
      reload: vi.fn(),
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Test Browser)',
    },
    open: vi.fn(),
  },
  writable: true,
});

describe('UnifiedError', () => {
  class TestUnifiedError extends UnifiedError {
    getUserMessage(): string {
      return 'Test error message';
    }

    getUserActions() {
      return [{
        type: 'retry' as const,
        label: 'Retry',
        action: () => {},
        primary: true,
      }];
    }
  }

  describe('base error class', () => {
    it('should create error with required properties', () => {
      const error = new TestUnifiedError(
        'Test message',
        'TEST_ERROR',
        'client',
        'medium'
      );

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.category).toBe('client');
      expect(error.severity).toBe('medium');
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.retryable).toBe(false);
      expect(error.recoveryStrategy).toBe('notify_user');
    });

    it('should create error with optional properties', () => {
      const context = { url: 'http://test.com', method: 'GET' };
      const userContext = { userId: 'user123' };
      const details = { errorCode: 'E001' };
      const metadata = { requestId: 'req123' };

      const error = new TestUnifiedError(
        'Test message',
        'TEST_ERROR',
        'client',
        'high',
        true,
        'retry',
        {
          context,
          userContext,
          details,
          metadata,
          correlationId: 'corr123',
          requestId: 'req123',
        }
      );

      expect(error.context).toBe(context);
      expect(error.userContext).toBe(userContext);
      expect(error.details).toBe(details);
      expect(error.metadata).toBe(metadata);
      expect(error.correlationId).toBe('corr123');
      expect(error.requestId).toBe('req123');
      expect(error.retryable).toBe(true);
      expect(error.recoveryStrategy).toBe('retry');
    });

    it('should maintain proper prototype chain', () => {
      const error = new TestUnifiedError('Test', 'TEST', 'client');
      
      expect(error).toBeInstanceOf(TestUnifiedError);
      expect(error).toBeInstanceOf(UnifiedError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TestUnifiedError');
    });

    it('should determine if error should be reported', () => {
      const lowError = new TestUnifiedError('Test', 'TEST', 'client', 'low');
      const highError = new TestUnifiedError('Test', 'TEST', 'client', 'high');
      const criticalError = new TestUnifiedError('Test', 'TEST', 'client', 'critical');

      expect(lowError.shouldReport()).toBe(false);
      expect(highError.shouldReport()).toBe(true);
      expect(criticalError.shouldReport()).toBe(true);
    });

    it('should create sanitized log object', () => {
      const error = new TestUnifiedError(
        'Test message',
        'TEST_ERROR',
        'client',
        'medium',
        false,
        'notify_user',
        {
          context: {
            url: 'http://test.com',
            requestHeaders: {
              authorization: 'Bearer secret-token',
              'content-type': 'application/json',
            },
            requestData: {
              username: 'testuser',
              password: 'secret123',
            },
          },
          userContext: {
            userId: 'user123',
            userRole: 'admin',
          },
          details: {
            additionalInfo: {
              apiKey: 'secret-key',
              debugInfo: 'safe-info',
            },
          },
        }
      );

      const logObject = error.toLogObject();

      // Should include basic properties
      expect(logObject.message).toBe('Test message');
      expect(logObject.code).toBe('TEST_ERROR');
      expect(logObject.severity).toBe('medium');

      // Should sanitize sensitive headers
      expect(logObject.context?.requestHeaders?.authorization).toBeUndefined();
      expect(logObject.context?.requestHeaders?.['content-type']).toBe('application/json');

      // Should sanitize sensitive request data
      expect(logObject.context?.requestData?.username).toBeUndefined();
      expect(logObject.context?.requestData?.password).toBeUndefined();

      // Should sanitize user context
      expect(logObject.userContext?.userRole).toBe('admin');
      expect(logObject.userContext?.userId).toBeUndefined();

      // Should sanitize details
      expect(logObject.details?.additionalInfo?.apiKey).toBeUndefined();
      expect(logObject.details?.additionalInfo?.debugInfo).toBe('safe-info');
    });
  });
});

describe('UnifiedHttpError', () => {
  describe('HTTP error implementation', () => {
    it('should create HTTP error with status code', () => {
      const error = new UnifiedHttpError(
        'Not found',
        'HTTP_404',
        404,
        'client',
        'medium'
      );

      expect(error.status).toBe(404);
      expect(error).toBeInstanceOf(UnifiedHttpError);
      expect(error).toBeInstanceOf(UnifiedError);
    });

    it('should provide user-friendly messages for common status codes', () => {
      const testCases = [
        { status: 400, expectedMessage: 'The request was invalid. Please check your input and try again.' },
        { status: 401, expectedMessage: 'You need to log in to access this feature.' },
        { status: 403, expectedMessage: 'You don\'t have permission to perform this action.' },
        { status: 404, expectedMessage: 'The requested resource was not found.' },
        { status: 429, expectedMessage: 'Too many requests. Please wait a moment and try again.' },
        { status: 500, expectedMessage: 'A server error occurred. Please try again later.' },
        { status: 502, expectedMessage: 'The service is temporarily unavailable. Please try again later.' },
      ];

      testCases.forEach(({ status, expectedMessage }) => {
        const error = new UnifiedHttpError('Original message', `HTTP_${status}`, status);
        expect(error.getUserMessage()).toBe(expectedMessage);
      });
    });

    it('should provide appropriate user actions for different status codes', () => {
      const authError = new UnifiedHttpError('Unauthorized', 'HTTP_401', 401);
      const authActions = authError.getUserActions();
      
      expect(authActions).toHaveLength(1);
      expect(authActions[0].type).toBe('login');
      expect(authActions[0].label).toBe('Log In');

      const serverError = new UnifiedHttpError('Server error', 'HTTP_500', 500, 'server', 'medium', true);
      const serverActions = serverError.getUserActions();
      
      expect(serverActions.some(action => action.type === 'retry')).toBe(true);
    });

    it('should provide contact support action for severe errors', () => {
      const criticalError = new UnifiedHttpError(
        'Critical error',
        'HTTP_500',
        500,
        'server',
        'critical'
      );

      const actions = criticalError.getUserActions();
      const supportAction = actions.find(action => action.type === 'contact_support');
      
      expect(supportAction).toBeDefined();
      expect(supportAction?.label).toBe('Contact Support');
    });
  });
});

describe('UnifiedWebSocketError', () => {
  describe('WebSocket error implementation', () => {
    it('should create WebSocket error with connection details', () => {
      const error = new UnifiedWebSocketError(
        'Connection failed',
        'WS_CONNECTION_FAILED',
        'connection',
        'high',
        true,
        'retry',
        {
          connectionId: 'conn123',
          messageId: 'msg456',
          readyState: WebSocket.CLOSED,
          closeCode: 1006,
          closeReason: 'Connection lost',
        }
      );

      expect(error.connectionId).toBe('conn123');
      expect(error.messageId).toBe('msg456');
      expect(error.readyState).toBe(WebSocket.CLOSED);
      expect(error.closeCode).toBe(1006);
      expect(error.closeReason).toBe('Connection lost');
    });

    it('should provide user-friendly messages for different categories', () => {
      const testCases = [
        { category: 'connection' as const, expectedMessage: 'Connection to the server was lost. Attempting to reconnect...' },
        { category: 'authentication' as const, expectedMessage: 'Authentication failed. Please log in again.' },
        { category: 'authorization' as const, expectedMessage: 'You don\'t have permission to access this feature.' },
        { category: 'protocol' as const, expectedMessage: 'A communication error occurred. Please refresh the page.' },
        { category: 'message' as const, expectedMessage: 'Failed to send message. Please try again.' },
        { category: 'subscription' as const, expectedMessage: 'Failed to subscribe to updates. Please refresh the page.' },
        { category: 'timeout' as const, expectedMessage: 'The connection timed out. Please check your internet connection.' },
        { category: 'network' as const, expectedMessage: 'Network error. Please check your internet connection and try again.' },
        { category: 'server' as const, expectedMessage: 'Server error. Please try again later.' },
      ];

      testCases.forEach(({ category, expectedMessage }) => {
        const error = new UnifiedWebSocketError('Original message', `WS_${category.toUpperCase()}`, category);
        expect(error.getUserMessage()).toBe(expectedMessage);
      });
    });

    it('should provide appropriate user actions for different categories', () => {
      const authError = new UnifiedWebSocketError('Auth failed', 'WS_AUTH', 'authentication');
      const authActions = authError.getUserActions();
      
      expect(authActions).toHaveLength(1);
      expect(authActions[0].type).toBe('login');
      expect(authActions[0].label).toBe('Log In Again');

      const connectionError = new UnifiedWebSocketError('Connection failed', 'WS_CONN', 'connection');
      const connectionActions = connectionError.getUserActions();
      
      expect(connectionActions.some(action => action.type === 'refresh')).toBe(true);
    });
  });
});

describe('Error transformation functions', () => {
  describe('transformAxiosError', () => {
    it('should transform basic Axios error', () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Request failed',
        code: 'ECONNABORTED',
        config: {
          url: '/api/test',
          method: 'get',
        },
        response: {
          status: 404,
          data: { error: 'Not found' },
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedError = transformAxiosError(axiosError as AxiosError);

      expect(unifiedError).toBeInstanceOf(UnifiedHttpError);
      expect(unifiedError.status).toBe(404);
      expect(unifiedError.category).toBe('client');
      expect(unifiedError.context?.url).toBe('/api/test');
      expect(unifiedError.context?.method).toBe('GET');
      expect(unifiedError.originalError).toBe(axiosError);
    });

    it('should handle Axios error without response', () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Network Error',
        code: 'NETWORK_ERROR',
        config: {
          url: '/api/test',
          method: 'post',
          data: { test: 'data' },
        },
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedError = transformAxiosError(axiosError as AxiosError);

      expect(unifiedError.status).toBe(0);
      expect(unifiedError.category).toBe('network');
      expect(unifiedError.retryable).toBe(true);
    });

    it('should determine retryable status correctly', () => {
      // Server error - should be retryable
      const serverError: Partial<AxiosError> = {
        message: 'Server error',
        response: { status: 500 } as any,
        config: {},
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedServerError = transformAxiosError(serverError as AxiosError);
      expect(unifiedServerError.retryable).toBe(true);

      // Client error - should not be retryable
      const clientError: Partial<AxiosError> = {
        message: 'Bad request',
        response: { status: 400 } as any,
        config: {},
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedClientError = transformAxiosError(clientError as AxiosError);
      expect(unifiedClientError.retryable).toBe(false);

      // Timeout - should be retryable
      const timeoutError: Partial<AxiosError> = {
        message: 'Timeout',
        code: 'ECONNABORTED',
        response: { status: 408 } as any,
        config: {},
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedTimeoutError = transformAxiosError(timeoutError as AxiosError);
      expect(unifiedTimeoutError.retryable).toBe(true);
    });

    it('should set correct recovery strategies', () => {
      const authError: Partial<AxiosError> = {
        message: 'Unauthorized',
        response: { status: 401 } as any,
        config: {},
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedAuthError = transformAxiosError(authError as AxiosError);
      expect(unifiedAuthError.recoveryStrategy).toBe('redirect_login');

      const serverError: Partial<AxiosError> = {
        message: 'Server error',
        response: { status: 500 } as any,
        config: {},
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
      };

      const unifiedServerError = transformAxiosError(serverError as AxiosError);
      expect(unifiedServerError.recoveryStrategy).toBe('retry');
    });
  });

  describe('transformWebSocketError', () => {
    it('should transform basic WebSocket error', () => {
      const wsError = new Error('Connection failed');
      const unifiedError = transformWebSocketError(
        wsError,
        'connection',
        {
          connectionId: 'conn123',
          readyState: WebSocket.CLOSED,
        }
      );

      expect(unifiedError).toBeInstanceOf(UnifiedWebSocketError);
      expect(unifiedError.category).toBe('connection');
      expect(unifiedError.connectionId).toBe('conn123');
      expect(unifiedError.readyState).toBe(WebSocket.CLOSED);
    });

    it('should set correct retryable status for different categories', () => {
      const retryableCategories = ['connection', 'network', 'timeout', 'server'];
      const nonRetryableCategories = ['authentication', 'authorization', 'protocol'];

      retryableCategories.forEach(category => {
        const error = transformWebSocketError(
          new Error('Test error'),
          category as any
        );
        expect(error.retryable).toBe(true);
      });

      nonRetryableCategories.forEach(category => {
        const error = transformWebSocketError(
          new Error('Test error'),
          category as any
        );
        expect(error.retryable).toBe(false);
      });
    });

    it('should set correct recovery strategies', () => {
      const authError = transformWebSocketError(
        new Error('Auth failed'),
        'authentication'
      );
      expect(authError.recoveryStrategy).toBe('redirect_login');

      const connectionError = transformWebSocketError(
        new Error('Connection failed'),
        'connection'
      );
      expect(connectionError.recoveryStrategy).toBe('retry');

      const authzError = transformWebSocketError(
        new Error('Not authorized'),
        'authorization'
      );
      expect(authzError.recoveryStrategy).toBe('notify_user');
    });
  });
});

describe('Type guards', () => {
  describe('isUnifiedError', () => {
    it('should correctly identify UnifiedError instances', () => {
      const unifiedError = new UnifiedHttpError('Test', 'TEST', 404);
      const regularError = new Error('Regular error');
      const notAnError = { message: 'Not an error' };

      expect(isUnifiedError(unifiedError)).toBe(true);
      expect(isUnifiedError(regularError)).toBe(false);
      expect(isUnifiedError(notAnError)).toBe(false);
    });
  });

  describe('isUnifiedHttpError', () => {
    it('should correctly identify UnifiedHttpError instances', () => {
      const httpError = new UnifiedHttpError('Test', 'TEST', 404);
      const wsError = new UnifiedWebSocketError('Test', 'TEST', 'connection');
      const regularError = new Error('Regular error');

      expect(isUnifiedHttpError(httpError)).toBe(true);
      expect(isUnifiedHttpError(wsError)).toBe(false);
      expect(isUnifiedHttpError(regularError)).toBe(false);
    });
  });

  describe('isUnifiedWebSocketError', () => {
    it('should correctly identify UnifiedWebSocketError instances', () => {
      const wsError = new UnifiedWebSocketError('Test', 'TEST', 'connection');
      const httpError = new UnifiedHttpError('Test', 'TEST', 404);
      const regularError = new Error('Regular error');

      expect(isUnifiedWebSocketError(wsError)).toBe(true);
      expect(isUnifiedWebSocketError(httpError)).toBe(false);
      expect(isUnifiedWebSocketError(regularError)).toBe(false);
    });
  });
});

describe('Error actions execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute login action correctly', () => {
    const error = new UnifiedHttpError('Unauthorized', 'HTTP_401', 401);
    const actions = error.getUserActions();
    const loginAction = actions.find(action => action.type === 'login');

    expect(loginAction).toBeDefined();
    
    if (loginAction) {
      loginAction.action();
      expect(global.window.location.href).toBe('/auth/login');
    }
  });

  it('should execute refresh action correctly', () => {
    const error = new UnifiedHttpError('Forbidden', 'HTTP_403', 403);
    const actions = error.getUserActions();
    const refreshAction = actions.find(action => action.type === 'refresh');

    expect(refreshAction).toBeDefined();
    
    if (refreshAction) {
      refreshAction.action();
      expect(global.window.location.reload).toHaveBeenCalled();
    }
  });

  it('should execute contact support action correctly', () => {
    const error = new UnifiedHttpError('Critical error', 'HTTP_500', 500, 'server', 'critical');
    const actions = error.getUserActions();
    const supportAction = actions.find(action => action.type === 'contact_support');

    expect(supportAction).toBeDefined();
    
    if (supportAction) {
      supportAction.action();
      expect(global.window.open).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@example.com')
      );
    }
  });
});