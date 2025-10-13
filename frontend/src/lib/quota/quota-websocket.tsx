import React, { useEffect, useRef, useCallback, useState, createContext, useContext } from "react";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth-store";
import { useQuotaStore } from "@/stores/quota-store";
import {
  createWebSocketClient,
  type WebSocketClient,
  type WebSocketMessage,
  type ConnectionState
} from "@/lib/websocket";

// Simple quota message schema
const quotaMessageSchema = z.object({
  type: z.literal("quota"),
  messageId: z.string(),
  payload: z.object({
    action: z.enum([
      "QUOTA_UPDATE",
      "OVERRIDE_REQUEST_CREATED",
      "OVERRIDE_REQUEST_UPDATED",
      "OVERRIDE_REQUEST_EXPIRED",
      "QUOTA_VIOLATION_ALERT"
    ]),
    quotaId: z.string(),
    familyMemberId: z.string(),
    roomId: z.string().optional(),
    // Common fields
    dailyLimit: z.number().optional(),
    currentUsage: z.number().optional(),
    isCurrentlyActive: z.boolean().optional(),
    status: z.enum(["ACTIVE", "PAUSED", "EXCEEDED"]).optional(),
    lastUpdated: z.string().optional(),
    // Violation fields
    violationType: z.enum(["WARNING_THRESHOLD", "LIMIT_EXCEEDED"]).optional(),
    threshold: z.number().optional(),
    timestamp: z.string().optional(),
    roomName: z.string().optional(),
    // Override request fields
    requestId: z.string().optional(),
    requestType: z.enum(["TEMPORARY_INCREASE", "TIME_EXTENSION", "EMERGENCY_OVERRIDE"]).optional(),
    duration: z.number().optional(),
    reason: z.string().optional(),
    urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).optional(),
    requestedAt: z.string().optional(),
    respondedAt: z.string().optional(),
    approvedBy: z.string().optional(),
    responseReason: z.string().optional()
  }),
  timestamp: z.number().optional()
});

type QuotaMessage = z.infer<typeof quotaMessageSchema>;

// Simple hook interface
interface UseQuotaWebSocketOptions {
  familyMemberId?: string;
  roomId?: string;
  quotaId?: string;
  onQuotaUpdate?: (update: QuotaMessage['payload']) => void;
  onOverrideRequest?: (request: QuotaMessage['payload']) => void;
  onViolationAlert?: (alert: QuotaMessage['payload']) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

export interface QuotaWebSocketHookReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: ConnectionState;
  connectionError: string | null;
  sendMessage?: (message: WebSocketMessage) => Promise<void>;
  forceReconnect: () => Promise<void>;
  lastMessage: QuotaMessage | null;
}

export const useQuotaWebSocket = (options: UseQuotaWebSocketOptions = {}): QuotaWebSocketHookReturn => {
  const {
    familyMemberId: propFamilyMemberId,
    onConnectionChange
  } = options;

  // Get user auth state
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const familyMemberId = propFamilyMemberId || user?.id || '';

  // Component state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<QuotaMessage | null>(null);

  // Refs for WebSocket management
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Get quota store actions - these are stable references from Zustand
  const updateBalance = useQuotaStore((state) => state.updateBalance);
  const addViolation = useQuotaStore((state) => state.addViolation);
  const setConnected = useQuotaStore((state) => state.setConnected);

  // Create stable reference for the callback
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  // Handle quota messages with stable implementation
  const handleQuotaMessage = useCallback((message: WebSocketMessage) => {
    try {
      const quotaMessage = quotaMessageSchema.parse(message);
      setLastMessage(quotaMessage);

      const { action, ...payload } = quotaMessage.payload;

      console.log('📥 Quota WebSocket message received:', { action, payload });

      switch (action) {
        case 'QUOTA_UPDATE':
          console.log('📊 Quota update received:', payload);
          if (payload.quotaId && payload.familyMemberId && payload.roomId) {
            // Update quota balance in store
            const quotaBalance = {
              quotaId: payload.quotaId,
              userId: payload.familyMemberId,
              roomId: payload.roomId,
              usedSeconds: payload.currentUsage,
              totalSeconds: payload.dailyLimit,
              remainingSeconds: Math.max(0, (payload.dailyLimit || 0) - (payload.currentUsage || 0)),
              warningThreshold: 80, // Default warning at 80%
              lastUpdated: payload.lastUpdated || new Date().toISOString(),
              isActive: payload.isCurrentlyActive ?? true,
              isExceeded: payload.status === 'EXCEEDED',
              hasOverride: false
            };
            updateBalance(payload.familyMemberId, payload.roomId, quotaBalance);
          }
          break;

        case 'QUOTA_VIOLATION_ALERT':
          console.log('⚠️ Quota violation alert received:', payload);
          if (payload.quotaId && payload.familyMemberId && payload.roomId) {
            // Add violation to store
            const violation = {
              id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: payload.familyMemberId,
              roomId: payload.roomId,
              type: payload.violationType === 'LIMIT_EXCEEDED' ? 'EXCEEDED' : 'WARNING',
              message: `Quota ${payload.violationType?.toLowerCase()} at ${payload.threshold}% usage`,
              timestamp: payload.timestamp || new Date().toISOString()
            } as const;
            addViolation(violation);
          }
          break;

        case 'OVERRIDE_REQUEST_CREATED':
        case 'OVERRIDE_REQUEST_UPDATED':
        case 'OVERRIDE_REQUEST_EXPIRED':
          console.log('🔄 Override request received:', payload);
          // Override handling can be extended here if needed
          break;
      }
    } catch (error) {
      console.error('Error parsing quota message:', error, message);
    }
  }, [updateBalance, addViolation]); // Include store actions

  // Initialize WebSocket connection with React StrictMode resilience
  useEffect(() => {
    console.log('🔄 Quota WebSocket useEffect triggered', {
      isAuthenticated,
      familyMemberId,
      hasExistingClient: !!wsClientRef.current
    });

    // Early return conditions
    if (!isAuthenticated || !familyMemberId) {
      console.log('❌ Quota WebSocket: Missing auth or familyMemberId');
      return;
    }

    // Avoid duplicate connections
    if (wsClientRef.current) {
      console.log('⏭️ Quota WebSocket: Connection already exists, skipping');
      return;
    }

    // Flag to track if this effect is still active
    let isActive = true;

    // Async connection function with cancellation support
    const connectToQuotaWebSocket = async () => {
      try {
        console.log('🚀 Quota WebSocket: Starting connection...');

        // Check if effect is still active after any async operation
        if (!isActive) {
          console.log('⏹️ Quota WebSocket: Effect cancelled, aborting connection');
          return;
        }

        // Get authentication token
        const accessToken = await useAuthStore.getState().getValidAccessToken();
        console.log('🔑 Retrieved access token for WebSocket authentication');

        // Check again after async operation
        if (!isActive) {
          console.log('⏹️ Quota WebSocket: Effect cancelled after token retrieval');
          return;
        }

        // Create WebSocket URL with authentication
        const wsUrl = `ws://localhost:8081/ws/quota?familyMemberId=${familyMemberId}&token=${encodeURIComponent(accessToken)}`;

        // Set connecting state
        setConnectionState('connecting');
        setConnectionError(null);

        // Create WebSocket client with simple configuration
        const client = createWebSocketClient(wsUrl, {
          debug: true, // Always enable debug for troubleshooting
          maxReconnectAttempts: 0, // No automatic retries
          reconnectInterval: 5000,
          timeout: 10000 // Longer timeout for better success
        });

        // Check once more before storing client
        if (!isActive) {
          console.log('⏹️ Quota WebSocket: Effect cancelled before storing client');
          client.disconnect().catch(() => { }); // Clean up client
          return;
        }

        // Store client reference
        wsClientRef.current = client;

        // Subscribe to quota messages
        const unsubscribe = client.subscribe('quota', handleQuotaMessage);
        unsubscribeRef.current = unsubscribe;

        // Attempt connection
        console.log('🔗 Connecting to quota WebSocket...');
        await client.connect();

        // Final check for effect cancellation
        if (!isActive) {
          console.log('⏹️ Quota WebSocket: Effect cancelled after connection');
          if (wsClientRef.current) {
            wsClientRef.current.disconnect().catch(() => { });
            wsClientRef.current = null;
          }
          return;
        }

        // Success
        console.log('✅ Quota WebSocket connected successfully!');
        setConnectionState('connected');
        setConnectionError(null);
        setConnected(true);
        onConnectionChangeRef.current?.(true);

      } catch (error) {
        // Only handle error if effect is still active
        if (!isActive) {
          console.log('⏹️ Quota WebSocket: Effect cancelled, ignoring connection error');
          return;
        }

        console.error('❌ Quota WebSocket connection failed:', error);

        // Clean up failed connection
        if (wsClientRef.current) {
          wsClientRef.current.disconnect().catch(() => { });
          wsClientRef.current = null;
        }
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Set error state
        setConnectionState('disconnected');
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
        setConnected(false);
        onConnectionChange?.(false);

        console.info('📝 To retry connection, refresh the page or wait for component remount');
      }
    };

    // Execute connection with small delay to let React StrictMode settle
    const timeoutId = setTimeout(() => {
      if (isActive) {
        connectToQuotaWebSocket();
      }
    }, 100);

    // Cleanup function
    return () => {
      console.log('🧹 Quota WebSocket cleanup - cancelling effect...');

      // Mark effect as inactive
      isActive = false;

      // Clear connection timeout
      clearTimeout(timeoutId);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      if (wsClientRef.current) {
        wsClientRef.current.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        });
        wsClientRef.current = null;
      }

      // Reset state only if this cleanup is for the current connection
      if (isActive === false) {
        setConnectionState('disconnected');
      }
    };
  }, [isAuthenticated, familyMemberId, handleQuotaMessage, setConnected]);

  // Send message function
  const sendMessage = useCallback(async (message: WebSocketMessage) => {
    if (wsClientRef.current && wsClientRef.current.isConnected) {
      await wsClientRef.current.send(message);
    } else {
      throw new Error('WebSocket not connected');
    }
  }, []);

  // Force reconnect function
  const forceReconnect = useCallback(async () => {
    if (wsClientRef.current) {
      await wsClientRef.current.disconnect();
      await wsClientRef.current.connect();
    }
  }, []);

  return {
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    connectionState,
    connectionError,
    sendMessage,
    forceReconnect,
    lastMessage
  };
};

// Simple provider component
interface QuotaWebSocketProviderProps {
  children: React.ReactNode;
  familyMemberId?: string;
}

export const QuotaWebSocketProvider: React.FC<QuotaWebSocketProviderProps> = ({
  children,
  familyMemberId
}) => {
  useQuotaWebSocket({
    familyMemberId,
    onConnectionChange: (isConnected) => {
      console.log('Quota WebSocket connection:', isConnected ? 'connected' : 'disconnected');
    }
  });

  return <>{children}</>;
};

// Context implementation for quota WebSocket
const QuotaWebSocketContext = createContext<QuotaWebSocketHookReturn | null>(null);

export const QuotaWebSocketContextProvider: React.FC<{
  children: React.ReactNode;
  familyMemberId?: string;
  roomId?: string;
}> = ({ children, familyMemberId, roomId }) => {
  const quotaWebSocketData = useQuotaWebSocket({
    familyMemberId,
    roomId,
    onConnectionChange: (isConnected) => {
      console.log('Quota WebSocket context connection:', isConnected ? 'connected' : 'disconnected');
    }
  });

  return (
    <QuotaWebSocketContext.Provider value={quotaWebSocketData}>
      {children}
    </QuotaWebSocketContext.Provider>
  );
};

export const useQuotaWebSocketContext = (): QuotaWebSocketHookReturn => {
  const context = useContext(QuotaWebSocketContext);
  if (!context) {
    throw new Error('useQuotaWebSocketContext must be used within a QuotaWebSocketContextProvider');
  }
  return context;
};