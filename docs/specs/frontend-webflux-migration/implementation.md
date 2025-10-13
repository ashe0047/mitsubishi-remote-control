# Frontend WebFlux Migration - Implementation Plan

## Implementation Overview

This document outlines the step-by-step implementation plan for migrating the frontend from RSocket to WebSocket communication, following the technical design specifications.

## Implementation Phases

### Phase 1: WebSocket Client Implementation
**Duration**: 2-3 hours  
**Dependencies**: Backend WebSocket handler must be operational

#### Tasks:
1. **Create WebSocket Client Foundation**
   - Create `src/lib/websocket/websocket-client.ts`
   - Implement core WebSocket connection management
   - Add message correlation and queuing systems
   - Implement reconnection logic with exponential backoff

2. **Message Protocol Implementation**
   - Define TypeScript interfaces for WebSocket messages
   - Implement request-response pattern
   - Implement streaming subscription pattern
   - Implement command pattern

3. **Error Handling and Validation**
   - Add comprehensive error classification
   - Implement message validation
   - Add timeout handling
   - Create error recovery mechanisms

**Deliverables**:
- `src/lib/websocket/websocket-client.ts` - Core WebSocket client
- `src/types/websocket.d.ts` - TypeScript definitions

### Phase 2: Store Integration
**Duration**: 1-2 hours  
**Dependencies**: Phase 1 completed

#### Tasks:
1. **Update API Store**
   - Modify `src/stores/api-aircon-store.ts` to use WebSocket client
   - Replace all RSocket method calls with WebSocket equivalents
   - Maintain identical public interfaces
   - Update observable stream handling

2. **Environment Configuration**
   - Add `NEXT_PUBLIC_BACKEND_WEBSOCKET_URL` environment variable
   - Update environment validation in `src/lib/env/config.ts`
   - Set default WebSocket URL for development

**Deliverables**:
- Updated `src/stores/api-aircon-store.ts`
- Updated `src/lib/env/config.ts`

### Phase 3: Provider Updates
**Duration**: 1 hour  
**Dependencies**: Phase 2 completed

#### Tasks:
1. **Update API Provider**
   - Modify `src/components/ApiAirconProvider.tsx`
   - Replace RSocket initialization with WebSocket connection
   - Update subscription handling
   - Maintain identical component interfaces

**Deliverables**:
- Updated `src/components/ApiAirconProvider.tsx`

### Phase 4: Complete RSocket Removal
**Duration**: 30 minutes  
**Dependencies**: Phase 3 completed and tested

#### Tasks:
1. **Remove All RSocket Code**
   - Remove RSocket packages from `package.json`
   - Delete `src/lib/rsocket/rsocket-client.ts`
   - Delete `src/types/rsocket.d.ts`
   - Delete any RSocket-related components
   - Update all import statements

2. **Clean Up Configuration**
   - Remove `NEXT_PUBLIC_BACKEND_RSOCKET_URL` references
   - Remove RSocket-related environment variables
   - Update documentation

**Deliverables**:
- Completely clean codebase with zero RSocket references
- Updated package.json

### Phase 5: Testing and Validation
**Duration**: 2-3 hours  
**Dependencies**: Phase 4 completed

#### Tasks:
1. **Unit Testing**
   - Test WebSocket client functionality
   - Test message handling patterns
   - Test error scenarios and recovery

2. **Integration Testing**
   - Test with actual backend WebSocket server
   - Validate all command flows
   - Test subscription and streaming

3. **Performance Validation**
   - Measure connection latency
   - Test reconnection behavior
   - Validate memory usage

**Deliverables**:
- Comprehensive test suite
- Performance validation report

## Detailed Implementation Steps

### Step 1: Environment Configuration

Update `src/lib/env/config.ts`:

```typescript
// Add WebSocket URL configuration
export const envConfig = {
  // ... existing config
  BACKEND_WEBSOCKET_URL: process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || "ws://localhost:8080/ws",
  // Remove or comment out RSOCKET_URL
  // BACKEND_RSOCKET_URL: process.env.NEXT_PUBLIC_BACKEND_RSOCKET_URL || "ws://localhost:7000/rsocket"
};
```

Add to your `.env` file:
```bash
NEXT_PUBLIC_BACKEND_WEBSOCKET_URL=ws://localhost:8080/ws
```

### Step 2: Update API Store

Update `src/stores/api-aircon-store.ts`:

```typescript
// Replace import
// import { rsocketClient, RSocketMessage, RoomInfo } from "@/lib/rsocket/rsocket-client";
import { websocketClient, WSMessage, RoomInfo } from "@/lib/websocket/websocket-client";

export interface ApiAirconStoreState extends ApiAirconProps {
  // Replace rsocketStream$ with websocketStream$
  websocketStream$?: Observable<WSMessage>;
  
  // Keep all existing methods with same signatures
  setPower: (roomId: string, power: string) => Promise<void>;
  setTemperature: (roomId: string, temperature: number) => Promise<void>;
  setMode: (roomId: string, mode: string) => Promise<void>;
  setFan: (roomId: string, fan: string) => Promise<void>;
  setVane: (roomId: string, vane: string) => Promise<void>;
  setWideVane: (roomId: string, wideVane: string) => Promise<void>;
  updateSettings: (roomId: string, settings: AirConSettings) => Promise<void>;
}

const createApiAirconStore = (initProps?: Partial<ApiAirconProps>) => {
  return createStore<ApiAirconStoreState>()((set, get) => ({
    ...DEFAULT_PROPS,
    ...initProps,
    rooms: {},

    setIsConnected: (connected) => set({ isConnected: connected }),
    setIsMqttConnected: (connected) => set({ isMqttConnected: connected }),
    setIsProcessingCommands: (processing) => set({ isProcessingCommands: processing }),

    setRooms: (roomList) => {
      const rooms: RoomsType = {};
      roomList.forEach(room => {
        rooms[room.id] = room;
        // Subscribe to this room's WebSocket state stream
        websocketClient.subscribeToRoomState(room.id);
      });
      set({ rooms });
    },

    // Update all command methods to use websocketClient
    setPower: async (roomId: string, power: string) => {
      try {
        await websocketClient.sendPowerCommand(roomId, power);
      } catch (error) {
        console.error(`Error setting power for room ${roomId}:`, error);
        throw error;
      }
    },

    setTemperature: async (roomId: string, temperature: number) => {
      try {
        await websocketClient.sendTemperatureCommand(roomId, temperature);
      } catch (error) {
        console.error(`Error setting temperature for room ${roomId}:`, error);
        throw error;
      }
    },

    setMode: async (roomId: string, mode: string) => {
      try {
        await websocketClient.sendModeCommand(roomId, mode);
      } catch (error) {
        console.error(`Error setting mode for room ${roomId}:`, error);
        throw error;
      }
    },

    setFan: async (roomId: string, fan: string) => {
      try {
        await websocketClient.sendFanCommand(roomId, fan);
      } catch (error) {
        console.error(`Error setting fan for room ${roomId}:`, error);
        throw error;
      }
    },

    setVane: async (roomId: string, vane: string) => {
      try {
        await websocketClient.sendVaneCommand(roomId, vane);
      } catch (error) {
        console.error(`Error setting vane for room ${roomId}:`, error);
        throw error;
      }
    },

    setWideVane: async (roomId: string, wideVane: string) => {
      try {
        await websocketClient.sendWideVaneCommand(roomId, wideVane);
      } catch (error) {
        console.error(`Error setting wide vane for room ${roomId}:`, error);
        throw error;
      }
    },

    updateSettings: async (roomId: string, settings: AirConSettings) => {
      try {
        await websocketClient.sendSettingsCommand(roomId, settings);
      } catch (error) {
        console.error(`Error updating settings for room ${roomId}:`, error);
        throw error;
      }
    },

    updateRoomState: (roomId, state) => {
      const rooms = get().rooms;
      if (rooms[roomId]) {
        rooms[roomId] = { ...rooms[roomId], state };
        set({ rooms: { ...rooms } });
      }
    },

    updateRoomSettings: (roomId, settings) => {
      const rooms = get().rooms;
      if (rooms[roomId]) {
        rooms[roomId] = { ...rooms[roomId], settings };
        set({ rooms: { ...rooms } });
      }
    },

    getRoomInfo: (roomId) => {
      return get().rooms[roomId];
    },
  }));
};

export default createApiAirconStore;
```

### Step 3: Update API Provider

Update `src/components/ApiAirconProvider.tsx`:

```typescript
"use client";

import { createContext, PropsWithChildren, useEffect, useRef } from "react";
import createApiAirconStore, { ApiAirconStore } from "@/stores/api-aircon-store";
// Replace import
// import { rsocketClient, RoomInfo } from "@/lib/rsocket/rsocket-client";
import { websocketClient, RoomInfo } from "@/lib/websocket/websocket-client";
import { AirConState, AirConSettings } from "@/lib/mqtt/mqtt-config";

export const ApiAirconContext = createContext<ApiAirconStore | null>(null);

type ApiAirconProviderProps = PropsWithChildren;

export const ApiAirconProvider: React.FC<ApiAirconProviderProps> = ({
  children,
}) => {
  const airconStore = useRef<ApiAirconStore | undefined>(undefined);
  
  if (!airconStore.current) {
    airconStore.current = createApiAirconStore();
  }

  useEffect(() => {
    const store = airconStore.current!;
    const state = store.getState();

    // Replace RSocket initialization with WebSocket
    const websocketStream$ = websocketClient.connect(state.setIsConnected);
    
    store.setState({ websocketStream$ });

    // Subscribe to WebSocket messages (same logic as RSocket)
    const subscription = websocketStream$.subscribe((message) => {
      const { type, roomId, data } = message;
      
      switch (type) {
        case 'room-state':
          if (roomId) {
            state.updateRoomState(roomId, data as AirConState);
          }
          break;
        case 'room-settings':
          if (roomId) {
            state.updateRoomSettings(roomId, data as AirConSettings);
          }
          break;
        case 'mqtt-status':
          state.setIsMqttConnected(data as boolean);
          break;
        case 'rooms':
          state.setRooms(data as RoomInfo[]);
          break;
        case 'command-response':
          state.setIsProcessingCommands(false);
          console.log(`Command response: ${data}`);
          break;
      }
    });

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      websocketClient.disconnect();
    };
  }, []);

  return (
    <ApiAirconContext.Provider value={airconStore.current}>
      {children}
    </ApiAirconContext.Provider>
  );
};
```

### Step 4: Package Dependencies

Update `package.json`:

```json
{
  "dependencies": {
    // Remove these RSocket dependencies:
    // "rsocket-core": "0.0.29-alpha.0",
    // "rsocket-websocket-client": "0.0.29-alpha.0",
    
    // Keep existing dependencies:
    "rxjs": "^7.8.2",
    "ws": "^8.18.3",
    // ... other dependencies
  }
}
```

### Step 5: Testing Strategy

#### Unit Tests

Create `src/lib/websocket/__tests__/websocket-client.test.ts`:

```typescript
import { WebSocketApiClient } from '../websocket-client';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {}

  send(data: string) {
    // Mock send implementation
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

describe('WebSocketApiClient', () => {
  let client: WebSocketApiClient;

  beforeEach(() => {
    global.WebSocket = MockWebSocket as any;
    client = new WebSocketApiClient();
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      const onConnectionStatus = jest.fn();
      const stream$ = client.connect(onConnectionStatus);
      
      // Simulate connection
      const mockWs = new MockWebSocket('ws://localhost:8080/ws');
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
      
      expect(onConnectionStatus).toHaveBeenCalledWith(true);
    });

    it('should handle connection errors', () => {
      const onConnectionStatus = jest.fn();
      client.connect(onConnectionStatus);
      
      const mockWs = new MockWebSocket('ws://localhost:8080/ws');
      mockWs.onerror?.(new Event('error'));
      
      expect(onConnectionStatus).toHaveBeenCalledWith(false);
    });
  });

  describe('message handling', () => {
    it('should send request-response messages', async () => {
      const onConnectionStatus = jest.fn();
      client.connect(onConnectionStatus);
      
      // Mock successful connection
      const mockWs = new MockWebSocket('ws://localhost:8080/ws');
      mockWs.readyState = MockWebSocket.OPEN;
      
      const requestPromise = client.requestRoomsList();
      
      // Simulate server response
      const response = {
        id: 'test-id',
        type: 'response',
        source: 'rooms.list',
        data: [],
        timestamp: Date.now()
      };
      
      setTimeout(() => {
        mockWs.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify(response)
        }));
      }, 100);
      
      // Should resolve without throwing
      await expect(requestPromise).resolves.toBeUndefined();
    });

    it('should handle stream messages', (done) => {
      const onConnectionStatus = jest.fn();
      const stream$ = client.connect(onConnectionStatus);
      
      stream$.subscribe((message) => {
        expect(message.type).toBe('room-state');
        expect(message.roomId).toBe('room1');
        done();
      });
      
      const mockWs = new MockWebSocket('ws://localhost:8080/ws');
      mockWs.readyState = MockWebSocket.OPEN;
      
      // Simulate stream message
      const streamResponse = {
        type: 'stream',
        source: 'room.state.stream',
        roomId: 'room1',
        data: { temperature: 20 },
        timestamp: Date.now()
      };
      
      mockWs.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(streamResponse)
      }));
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on connection loss', (done) => {
      const onConnectionStatus = jest.fn();
      client.connect(onConnectionStatus);
      
      const mockWs = new MockWebSocket('ws://localhost:8080/ws');
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
      
      expect(onConnectionStatus).toHaveBeenCalledWith(true);
      
      // Simulate connection loss
      mockWs.readyState = MockWebSocket.CLOSED;
      mockWs.onclose?.(new CloseEvent('close'));
      
      expect(onConnectionStatus).toHaveBeenCalledWith(false);
      
      // Should attempt reconnection
      setTimeout(() => {
        expect(onConnectionStatus).toHaveBeenCalledTimes(2);
        done();
      }, 1100); // Wait for reconnection attempt
    });
  });
});
```

### Step 6: Integration Testing

Create integration tests to validate WebSocket communication with the actual backend:

```typescript
// src/lib/websocket/__tests__/integration.test.ts
import { websocketClient } from '../websocket-client';

describe('WebSocket Integration', () => {
  beforeAll(() => {
    // Ensure backend WebSocket server is running
    // This test requires actual backend at ws://localhost:8080/ws
  });

  afterAll(() => {
    websocketClient.disconnect();
  });

  it('should establish connection and fetch rooms', async () => {
    const connectionPromise = new Promise<boolean>((resolve) => {
      websocketClient.connect((connected) => {
        if (connected) resolve(true);
      });
    });

    const isConnected = await connectionPromise;
    expect(isConnected).toBe(true);

    // Test room list request
    await websocketClient.requestRoomsList();
    
    // Should receive rooms data via stream
    // Additional assertions based on your test data
  });

  it('should handle room state subscriptions', async () => {
    // Test subscription to room state
    await websocketClient.subscribeToRoomState('test-room-1');
    
    // Should receive state updates via stream
    // Additional assertions based on your test setup
  });

  it('should send commands successfully', async () => {
    // Test command sending
    await websocketClient.sendPowerCommand('test-room-1', 'ON');
    
    // Should receive acknowledgment
    // Additional assertions based on your test setup
  });
});
```

## Execution Checklist

### Pre-implementation
- [ ] Backend WebSocket server is running and accessible
- [ ] Backend WebSocket protocol matches specification
- [ ] Development environment is set up

### Implementation Phase 1 
- [ ] Create `src/lib/websocket/websocket-client.ts`
- [ ] Create `src/types/websocket.d.ts`
- [ ] Implement WebSocket connection management
- [ ] Implement message correlation system
- [ ] Implement reconnection logic
- [ ] Test basic WebSocket connectivity

### Implementation Phase 2
- [ ] Update `src/lib/env/config.ts`
- [ ] Update `src/stores/api-aircon-store.ts`
- [ ] Replace all RSocket method calls
- [ ] Test store functionality with WebSocket client
- [ ] Verify observable streams work correctly

### Implementation Phase 3
- [ ] Update `src/components/ApiAirconProvider.tsx`
- [ ] Replace RSocket initialization
- [ ] Test provider integration
- [ ] Verify component state updates

### Implementation Phase 4
- [ ] Remove RSocket dependencies from `package.json`
- [ ] Delete `src/lib/rsocket/rsocket-client.ts`
- [ ] Delete `src/types/rsocket.d.ts`
- [ ] Update all import statements
- [ ] Remove environment references to RSocket

### Implementation Phase 5
- [ ] Create unit tests for WebSocket client
- [ ] Create integration tests
- [ ] Run performance validation
- [ ] Test error scenarios and recovery
- [ ] Validate memory usage and connection stability

### Post-implementation
- [ ] Full application testing
- [ ] User acceptance testing
- [ ] Performance monitoring
- [ ] Documentation updates

## Risk Mitigation

### Technical Risks
1. **WebSocket Protocol Mismatch**
   - **Risk**: Backend message format differs from specification
   - **Mitigation**: Validate all message formats during development
   - **Recovery**: Update client message handling to match actual backend

2. **Connection Stability Issues**
   - **Risk**: WebSocket connections more fragile than RSocket
   - **Mitigation**: Comprehensive reconnection logic with exponential backoff
   - **Recovery**: Implement connection health monitoring

3. **State Synchronization Problems**
   - **Risk**: Real-time state updates may be lost during migration
   - **Mitigation**: Careful subscription management and state recovery
   - **Recovery**: Force refresh state on reconnection

### Business Risks  
1. **User Experience Disruption**
   - **Risk**: Users notice functionality differences
   - **Mitigation**: Maintain identical public interfaces
   - **Recovery**: Thorough testing before deployment

2. **Performance Degradation**
   - **Risk**: WebSocket performance worse than RSocket
   - **Mitigation**: Performance monitoring and optimization
   - **Recovery**: Connection pooling and message batching

## Success Criteria

### Functional Success
- [ ] All RSocket features working identically with WebSocket
- [ ] Real-time updates functioning correctly  
- [ ] Error handling working as expected
- [ ] Reconnection working reliably

### Technical Success
- [ ] No memory leaks in WebSocket connections
- [ ] Connection latency < 100ms average
- [ ] Reconnection time < 5 seconds average
- [ ] Zero data loss during state updates

### User Experience Success  
- [ ] No user-visible changes in functionality
- [ ] Same response times as RSocket implementation
- [ ] Reliable connection status indication
- [ ] Seamless reconnection experience

This implementation plan provides a comprehensive roadmap for migrating from RSocket to WebSocket while maintaining full compatibility with the existing frontend application.