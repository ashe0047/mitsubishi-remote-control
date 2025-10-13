# Frontend WebFlux Migration - Technical Design

## Architecture Overview

This design document outlines the migration strategy from RSocket-based API communication to WebSocket-based communication, following the backend's migration to Spring WebFlux with WebSocket support.

### Current Architecture Analysis

The frontend currently supports two modes:
- **MQTT Mode**: Direct MQTT broker communication via `AirconProvider` → `aircon-store` → `mqtt-client`
- **API Mode**: RSocket backend communication via `ApiAirconProvider` → `api-aircon-store` → `rsocket-client`

The API mode needs to be updated to use WebSocket instead of RSocket while maintaining identical functionality and interfaces.

### Migration Strategy

**Complete Replacement Approach:**
1. **Phase 1**: Implement WebSocket client foundation
2. **Phase 2**: Update API store to use WebSocket client  
3. **Phase 3**: Update provider components
4. **Phase 4**: Remove all RSocket dependencies and code
5. **Phase 5**: Update configuration and validate implementation

## WebSocket Client Architecture

### Core Client Design

```typescript
export class WebSocketApiClient {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketResponse>();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions = new Map<string, string>();
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
}
```

### Protocol Mapping

| RSocket Pattern | WebSocket Implementation | Message Type |
|----------------|-------------------------|-------------|
| `requestResponse()` | Request + await response | `"request"` → `"response"` |
| `requestStream()` | Subscribe + stream handler | `"subscribe"` → `"stream"` |
| `fireAndForget()` | Command + optional ack | `"command"` → `"ack"` |

### Message Flow Architecture

#### Outbound Messages (Client → Server)

```typescript
interface WebSocketMessage {
  id: string;           // UUID for correlation
  type: "request" | "subscribe" | "unsubscribe" | "command";
  request?: string;     // For request type: "rooms.list", "room.state", etc.
  subscription?: string; // For subscribe type: "room.state.stream", etc.
  command?: string;     // For command type: "power", "temperature", etc.
  roomId?: string;      // Room identifier for room-specific operations
  value?: string;       // Command value or request parameter
  timestamp?: number;   // Message timestamp
}
```

#### Inbound Messages (Server → Client)

```typescript
interface WebSocketResponse {
  id?: string;          // Correlation ID (null for stream messages)
  type: "response" | "stream" | "ack" | "error";
  source: string;       // Source request/subscription/command name
  roomId?: string;      // Room identifier for room-specific responses
  data?: any;           // Response payload
  error?: string;       // Error message (for error responses)
  timestamp: number;    // Server timestamp
}
```

## Connection Management

### Connection Lifecycle

```typescript
class WebSocketApiClient {
  async connect(onConnectionStatus: (connected: boolean) => void): Promise<Observable<WebSocketResponse>> {
    this.connectionStatus.subscribe(onConnectionStatus);
    
    await this.initializeWebSocketConnection();
    this.setupMessageHandlers();
    this.setupReconnectionLogic();
    
    return this.messageSubject.asObservable().pipe(share());
  }
  
  private async initializeWebSocketConnection(): Promise<void> {
    const wsUrl = this.wsUrl || process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || "ws://localhost:8080/ws";
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connectionStatus.next(true);
      this.reconnectAttempts = 0;
      this.processMessageQueue();
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connectionStatus.next(false);
      this.scheduleReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.connectionStatus.next(false);
    };
  }
}
```

### Reconnection Strategy

```typescript
private scheduleReconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('Max reconnection attempts reached');
    return;
  }
  
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
  this.reconnectAttempts++;
  
  this.reconnectTimeout = setTimeout(() => {
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    this.initializeWebSocketConnection()
      .then(() => this.resubscribeActiveStreams())
      .catch(() => this.scheduleReconnect());
  }, delay);
}
```

## Message Handling

### Request-Response Pattern

```typescript
async requestRoomsList(): Promise<RoomInfo[]> {
  const messageId = this.generateMessageId();
  
  const message: WebSocketMessage = {
    id: messageId,
    type: "request",
    request: "rooms.list",
    timestamp: Date.now()
  };
  
  return this.sendMessageWithResponse<RoomInfo[]>(message);
}

private sendMessageWithResponse<T>(message: WebSocketMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(message.id);
      reject(new Error('Request timeout'));
    }, 30000);
    
    this.pendingRequests.set(message.id, {
      resolve,
      reject,
      timeout
    });
    
    this.sendMessage(message);
  });
}
```

### Streaming Subscription Pattern

```typescript
async subscribeToRoomState(roomId: string): Promise<void> {
  const messageId = this.generateMessageId();
  const subscriptionKey = `room.state.stream:${roomId}`;
  
  const message: WebSocketMessage = {
    id: messageId,
    type: "subscribe",
    subscription: "room.state.stream",
    roomId,
    timestamp: Date.now()
  };
  
  this.subscriptions.set(subscriptionKey, messageId);
  this.sendMessage(message);
}

private handleStreamMessage(response: WebSocketResponse): void {
  if (response.type === 'stream') {
    this.messageSubject.next({
      type: response.source.includes('state') ? 'room-state' : 'room-settings',
      roomId: response.roomId,
      data: response.data
    });
  }
}
```

### Command Pattern

```typescript
async sendPowerCommand(roomId: string, power: string): Promise<void> {
  const messageId = this.generateMessageId();
  
  const message: WebSocketMessage = {
    id: messageId,
    type: "command",
    command: "power",
    roomId,
    value: power,
    timestamp: Date.now()
  };
  
  return this.sendMessageWithResponse(message);
}
```

## Error Handling Architecture

### Error Classification

```typescript
enum WebSocketErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  MESSAGE_ERROR = 'MESSAGE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR'
}

interface WebSocketError {
  type: WebSocketErrorType;
  message: string;
  originalError?: Error;
  messageId?: string;
  recoverable: boolean;
}
```

### Error Recovery Strategy

```typescript
private handleError(error: WebSocketError): void {
  console.error('WebSocket error:', error);
  
  switch (error.type) {
    case WebSocketErrorType.CONNECTION_ERROR:
      this.scheduleReconnect();
      break;
      
    case WebSocketErrorType.MESSAGE_ERROR:
      // Retry message if recoverable
      if (error.recoverable && error.messageId) {
        this.retryMessage(error.messageId);
      }
      break;
      
    case WebSocketErrorType.TIMEOUT_ERROR:
      // Clean up pending request
      if (error.messageId) {
        const pending = this.pendingRequests.get(error.messageId);
        if (pending) {
          pending.reject(new Error('Request timeout'));
          this.pendingRequests.delete(error.messageId);
        }
      }
      break;
  }
}
```

## State Management Integration

### API Store Updates

```typescript
// api-aircon-store.ts updates
export interface ApiAirconStoreState extends ApiAirconProps {
  // Replace rsocketStream$ with websocketStream$
  websocketStream$?: Observable<WebSocketMessage>;
  
  // Keep all existing methods with same signatures
  setPower: (roomId: string, power: string) => Promise<void>;
  setTemperature: (roomId: string, temperature: number) => Promise<void>;
  // ... other methods remain unchanged
}

const createApiAirconStore = (initProps?: Partial<ApiAirconProps>) => {
  return createStore<ApiAirconStoreState>()((set, get) => ({
    // Update implementation to use websocketClient instead of rsocketClient
    setPower: async (roomId: string, power: string) => {
      try {
        await websocketClient.sendPowerCommand(roomId, power);
      } catch (error) {
        console.error(`Error setting power for room ${roomId}:`, error);
        throw error;
      }
    },
    // ... other methods updated similarly
  }));
};
```

### Provider Updates

```typescript
// ApiAirconProvider.tsx updates
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
      // Same message handling logic as before
      const { type, roomId, data } = message;
      
      switch (type) {
        case 'room-state':
          if (roomId) {
            state.updateRoomState(roomId, data as AirConState);
          }
          break;
        // ... same cases as RSocket implementation
      }
    });

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

## Performance Considerations

### Message Queuing

```typescript
private messageQueue: WebSocketMessage[] = [];

private sendMessage(message: WebSocketMessage): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    this.messageQueue.push(message);
    return;
  }
  
  try {
    this.ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    this.messageQueue.push(message);
  }
}

private processMessageQueue(): void {
  while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
    const message = this.messageQueue.shift()!;
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send queued message:', error);
      this.messageQueue.unshift(message);
      break;
    }
  }
}
```

### Memory Management

```typescript
disconnect(): void {
  // Clear all timeouts
  this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
  this.pendingRequests.clear();
  
  if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }
  
  // Close WebSocket
  if (this.ws) {
    this.ws.close();
    this.ws = null;
  }
  
  // Clear subscriptions
  this.subscriptions.clear();
  this.messageQueue.length = 0;
  
  this.connectionStatus.next(false);
}
```

## Security Considerations

### Message Validation

```typescript
private validateIncomingMessage(data: string): WebSocketResponse | null {
  try {
    const message = JSON.parse(data);
    
    // Validate required fields
    if (!message.type || !message.source || !message.timestamp) {
      throw new Error('Invalid message format');
    }
    
    // Validate message type
    if (!['response', 'stream', 'ack', 'error'].includes(message.type)) {
      throw new Error('Invalid message type');
    }
    
    return message as WebSocketResponse;
  } catch (error) {
    console.error('Invalid WebSocket message received:', error, data);
    return null;
  }
}
```

### Environment Configuration

```typescript
// Environment variables
interface WebSocketConfig {
  wsUrl: string;
  reconnectAttempts: number;
  messageTimeout: number;
  useSecureWebSocket: boolean;
}

const getWebSocketConfig = (): WebSocketConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || 
    (isDevelopment ? 'ws://localhost:8080/ws' : 'wss://api.example.com/ws');
  
  return {
    wsUrl: baseUrl,
    reconnectAttempts: 10,
    messageTimeout: 30000,
    useSecureWebSocket: !isDevelopment && baseUrl.startsWith('wss://')
  };
};
```

## Testing Strategy

### Unit Tests

```typescript
// websocket-client.test.ts
describe('WebSocketApiClient', () => {
  let client: WebSocketApiClient;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    mockWebSocket = new MockWebSocket() as jest.Mocked<WebSocket>;
    global.WebSocket = jest.fn(() => mockWebSocket);
    client = new WebSocketApiClient();
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      const connectionPromise = client.connect(jest.fn());
      mockWebSocket.onopen({} as Event);
      
      await expect(connectionPromise).resolves.toBeDefined();
    });

    it('should handle connection errors', () => {
      const onConnectionStatus = jest.fn();
      client.connect(onConnectionStatus);
      
      mockWebSocket.onerror({} as Event);
      expect(onConnectionStatus).toHaveBeenCalledWith(false);
    });
  });

  describe('message handling', () => {
    it('should send request-response messages', async () => {
      client.connect(jest.fn());
      mockWebSocket.onopen({} as Event);
      
      const responsePromise = client.requestRoomsList();
      
      // Simulate server response
      const response: WebSocketResponse = {
        id: expect.any(String),
        type: 'response',
        source: 'rooms.list',
        data: [],
        timestamp: Date.now()
      };
      
      mockWebSocket.onmessage({ data: JSON.stringify(response) } as MessageEvent);
      
      await expect(responsePromise).resolves.toEqual([]);
    });
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
describe('WebSocket Integration', () => {
  it('should handle full room control workflow', async () => {
    // Test complete user workflow
    const client = new WebSocketApiClient();
    await client.connect(jest.fn());
    
    // 1. Get rooms
    const rooms = await client.requestRoomsList();
    expect(rooms).toBeDefined();
    
    // 2. Subscribe to room state
    await client.subscribeToRoomState('room1');
    
    // 3. Send command
    await client.sendPowerCommand('room1', 'ON');
    
    // 4. Verify state update received
    // ... test implementation
  });
});
```

## Migration Checklist

### Implementation Phase
- [ ] Create `src/lib/websocket/websocket-client.ts`
- [ ] Update `src/stores/api-aircon-store.ts` to use WebSocket client
- [ ] Update `src/components/ApiAirconProvider.tsx`
- [ ] Add environment variable `NEXT_PUBLIC_BACKEND_WEBSOCKET_URL`
- [ ] Create TypeScript definitions for WebSocket messages

### Testing Phase  
- [ ] Unit tests for WebSocket client
- [ ] Integration tests with mock WebSocket server
- [ ] Component tests for updated stores and providers
- [ ] End-to-end tests with actual backend

### Migration Phase
- [ ] Remove RSocket dependencies from `package.json`
- [ ] Delete `src/lib/rsocket/rsocket-client.ts`
- [ ] Delete `src/types/rsocket.d.ts`
- [ ] Update environment configuration documentation
- [ ] Remove RSocket-related code from components

### Validation Phase
- [ ] Verify all RSocket features work with WebSocket
- [ ] Performance testing (latency, memory usage)
- [ ] Connection stability testing
- [ ] Error handling validation
- [ ] User acceptance testing

This design provides a comprehensive migration path from RSocket to WebSocket while maintaining full compatibility with existing frontend components and user experience.