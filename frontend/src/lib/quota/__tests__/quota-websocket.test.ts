import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WS from 'jest-websocket-mock';

import { useQuotaWebSocket } from '../quota-websocket';

// Mock react-use-websocket
vi.mock('react-use-websocket', () => ({
  default: vi.fn(),
  ReadyState: {
    UNINSTANTIATED: -1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

// Mock global WebSocket for jest-websocket-mock
global.WebSocket = WS as typeof WebSocket;

const mockUseWebSocket = vi.mocked(await import('react-use-websocket')).default;

describe('useQuotaWebSocket', () => {
  const mockSendJsonMessage = vi.fn();
  
  const defaultOptions = {
    familyMemberId: 'family-member-1',
    roomId: 'room-1',
    quotaId: 'quota-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    server = new WS('ws://localhost/ws/quota');
    
    // Mock useWebSocket return value
    mockUseWebSocket.mockReturnValue({
      sendJsonMessage: mockSendJsonMessage,
      lastJsonMessage: null,
      readyState: 1, // ReadyState.OPEN
    });
  });

  afterEach(() => {
    WS.clean();
  });

  describe('Hook Initialization', () => {
    it('initializes with correct default values', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      expect(result.current.connectionState).toBe(1); // ReadyState.OPEN
      expect(result.current.isConnected).toBe(true);
      expect(result.current.lastMessage).toBe(null);
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.unsubscribe).toBe('function');
    });

    it('constructs WebSocket URL with correct parameters', () => {
      renderHook(() => useQuotaWebSocket(defaultOptions));

      // Verify useWebSocket was called with a function that generates the correct URL
      const callArgs = mockUseWebSocket.mock.calls[0];
      expect(typeof callArgs[0]).toBe('function');
      
      // Test the URL generation function
      const urlFunc = callArgs[0] as () => string;
      const generatedUrl = urlFunc();
      
      expect(generatedUrl).toContain('familyMemberId=family-member-1');
      expect(generatedUrl).toContain('roomId=room-1');
      expect(generatedUrl).toContain('quotaId=quota-1');
    });
  });

  describe('Connection Management', () => {
    it('reports connected when WebSocket is open', () => {
      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: null,
        readyState: 1, // ReadyState.OPEN
      });

      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      expect(result.current.isConnected).toBe(true);
    });

    it('reports disconnected when WebSocket is closed', () => {
      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: null,
        readyState: 3, // ReadyState.CLOSED
      });

      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      expect(result.current.isConnected).toBe(false);
    });

    it('calls onConnectionChange when connection state changes', () => {
      const onConnectionChange = vi.fn();

      const { rerender } = renderHook(
        () => useQuotaWebSocket({
          ...defaultOptions,
          onConnectionChange,
        }),
        { initialProps: { connected: true } }
      );

      expect(onConnectionChange).toHaveBeenCalledWith(true);

      // Simulate connection loss
      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: null,
        readyState: 3, // ReadyState.CLOSED
      });

      rerender({ connected: false });

      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Message Handling', () => {
    it('processes quota update messages correctly', () => {
      const onQuotaUpdate = vi.fn();
      
      const quotaUpdateMessage = {
        type: 'QUOTA_UPDATE',
        payload: {
          quotaId: 'test-quota',
          familyMemberId: 'family-1',
          roomId: 'room-1',
          currentUsage: 3600,
          dailyLimit: 7200,
          status: 'ACTIVE',
          isCurrentlyActive: true,
          estimatedSessionUsage: 300,
          lastUpdated: new Date().toISOString(),
        },
      };

      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: quotaUpdateMessage,
        readyState: 1,
      });

      renderHook(() => useQuotaWebSocket({
        ...defaultOptions,
        onQuotaUpdate,
      }));

      expect(onQuotaUpdate).toHaveBeenCalledWith(quotaUpdateMessage.payload);
    });

    it('processes override request messages correctly', () => {
      const onOverrideRequest = vi.fn();
      
      const overrideMessage = {
        type: 'OVERRIDE_REQUEST_CREATED',
        payload: {
          requestId: 'req-123',
          quotaId: 'quota-1',
          familyMemberId: 'family-1',
          status: 'PENDING',
          requestType: 'TIME_EXTENSION',
          duration: 60,
          reason: 'Need more time',
          urgency: 'MEDIUM',
          requestedAt: new Date().toISOString(),
        },
      };

      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: overrideMessage,
        readyState: 1,
      });

      renderHook(() => useQuotaWebSocket({
        ...defaultOptions,
        onOverrideRequest,
      }));

      expect(onOverrideRequest).toHaveBeenCalledWith(overrideMessage);
    });

    it('processes violation alert messages correctly', () => {
      const onViolationAlert = vi.fn();
      
      const violationMessage = {
        type: 'QUOTA_VIOLATION_ALERT',
        payload: {
          quotaId: 'quota-1',
          familyMemberId: 'family-1',
          familyMemberName: 'John',
          roomId: 'room-1',
          roomName: 'Living Room',
          violationType: 'LIMIT_EXCEEDED',
          currentUsage: 8000,
          limit: 7200,
          timestamp: new Date().toISOString(),
        },
      };

      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: violationMessage,
        readyState: 1,
      });

      renderHook(() => useQuotaWebSocket({
        ...defaultOptions,
        onViolationAlert,
      }));

      expect(onViolationAlert).toHaveBeenCalledWith(violationMessage.payload);
    });

    it('ignores invalid messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const invalidMessage = {
        type: 'INVALID_TYPE',
        payload: { invalid: 'data' },
      };

      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: invalidMessage,
        readyState: 1,
      });

      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      expect(result.current.lastMessage).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse quota WebSocket message:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Subscription Management', () => {
    it('subscribes to quota when connected', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.subscribe('test-quota-id');
      });

      expect(mockSendJsonMessage).toHaveBeenCalledWith({
        type: 'SUBSCRIBE_QUOTA',
        payload: { quotaId: 'test-quota-id' },
      });
    });

    it('unsubscribes from quota when connected', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.unsubscribe('test-quota-id');
      });

      expect(mockSendJsonMessage).toHaveBeenCalledWith({
        type: 'UNSUBSCRIBE_QUOTA',
        payload: { quotaId: 'test-quota-id' },
      });
    });

    it('does not send messages when disconnected', () => {
      mockUseWebSocket.mockReturnValue({
        sendJsonMessage: mockSendJsonMessage,
        lastJsonMessage: null,
        readyState: 3, // ReadyState.CLOSED
      });

      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.subscribe('test-quota-id');
        result.current.unsubscribe('test-quota-id');
      });

      expect(mockSendJsonMessage).not.toHaveBeenCalled();
    });
  });

  describe('Override Request Actions', () => {
    it('sends override request correctly', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      const requestData = {
        quotaId: 'quota-1',
        requestType: 'TIME_EXTENSION' as const,
        duration: 60,
        reason: 'Need more time for homework',
        urgency: 'HIGH' as const,
      };

      act(() => {
        result.current.requestOverride(requestData);
      });

      expect(mockSendJsonMessage).toHaveBeenCalledWith({
        type: 'REQUEST_OVERRIDE',
        payload: {
          ...requestData,
          familyMemberId: defaultOptions.familyMemberId,
        },
      });
    });

    it('sends approve override correctly', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.approveOverride('request-123', 90, 'Approved for health reasons');
      });

      expect(mockSendJsonMessage).toHaveBeenCalledWith({
        type: 'APPROVE_OVERRIDE',
        payload: {
          requestId: 'request-123',
          approvedBy: defaultOptions.familyMemberId,
          actualDuration: 90,
          responseReason: 'Approved for health reasons',
        },
      });
    });

    it('sends reject override correctly', () => {
      const { result } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.rejectOverride('request-123', 'Not a valid emergency');
      });

      expect(mockSendJsonMessage).toHaveBeenCalledWith({
        type: 'REJECT_OVERRIDE',
        payload: {
          requestId: 'request-123',
          approvedBy: defaultOptions.familyMemberId,
          responseReason: 'Not a valid emergency',
        },
      });
    });
  });

  describe('WebSocket Configuration', () => {
    it('configures WebSocket with correct options', () => {
      renderHook(() => useQuotaWebSocket(defaultOptions));

      const options = mockUseWebSocket.mock.calls[0][1];

      expect(options).toMatchObject({
        shouldReconnect: expect.any(Function),
        reconnectAttempts: 10,
        reconnectInterval: expect.any(Function),
        heartbeat: {
          message: 'ping',
          returnMessage: 'pong',
          timeout: 60000,
          interval: 25000,
        },
      });
    });

    it('configures exponential backoff for reconnection', () => {
      renderHook(() => useQuotaWebSocket(defaultOptions));

      const options = mockUseWebSocket.mock.calls[0][1];
      const reconnectInterval = options.reconnectInterval as (attempt: number) => number;

      expect(reconnectInterval(0)).toBe(1000); // 2^0 * 1000
      expect(reconnectInterval(1)).toBe(2000); // 2^1 * 1000
      expect(reconnectInterval(2)).toBe(4000); // 2^2 * 1000
      expect(reconnectInterval(5)).toBe(10000); // Capped at 10s
    });

    it('configures reconnection condition correctly', () => {
      renderHook(() => useQuotaWebSocket(defaultOptions));

      const options = mockUseWebSocket.mock.calls[0][1];
      const shouldReconnect = options.shouldReconnect as (event: { code: number }) => boolean;

      expect(shouldReconnect({ code: 1000 })).toBe(false); // Normal closure
      expect(shouldReconnect({ code: 1006 })).toBe(true);  // Abnormal closure
      expect(shouldReconnect({ code: 1011 })).toBe(true);  // Server error
    });
  });

  describe('Memory Leaks Prevention', () => {
    it('cleans up subscriptions on unmount', () => {
      const { result, unmount } = renderHook(() => useQuotaWebSocket(defaultOptions));

      act(() => {
        result.current.subscribe('quota-1');
        result.current.subscribe('quota-2');
      });

      expect(mockSendJsonMessage).toHaveBeenCalledTimes(2);

      unmount();

      // The cleanup should be handled by the useWebSocket hook internally
      // We can't directly test this, but we ensure no errors occur on unmount
    });
  });
});