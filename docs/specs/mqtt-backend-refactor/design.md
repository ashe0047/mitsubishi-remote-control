# MQTT Backend Refactor - Technical Design Document

## 1. Architecture Overview

### Current Architecture (To Be Replaced)
```
Frontend (Next.js) → Direct MQTT Client → MQTT Broker (mitsubishi2mqtt)
```
**Problems**: Security vulnerabilities, tight coupling, poor scalability, difficult testing

### Target Architecture (Layered Design)
```
Frontend (Next.js) → Backend API → MQTT Service → MQTT Broker (mitsubishi2mqtt)
                       ↓
                   WebSocket/REST
```

## 2. System Architecture

### 2.1 Layered Architecture Design

**Layer 1: MQTT Integration Layer (Backend)**
- `MqttService`: Manages persistent connection to MQTT broker
- `MqttMessageHandler`: Processes and routes incoming MQTT messages  
- `MqttPublisher`: Publishes control commands to MQTT topics
- `MqttConnectionManager`: Handles reconnection logic and health monitoring

**Layer 2: Business Logic Layer (Backend)**
- `AirconService`: Core business logic for AC operations
- `RoomService`: Room configuration and management
- `StateService`: Maintains current AC states and settings per room
- `ValidationService`: Message validation using existing Zod schemas

**Layer 3: API Layer (Backend)**
- `WebSocketController`: Real-time bidirectional communication
- `AirconRestController`: REST endpoints for CRUD operations
- `HealthController`: System health and status endpoints
- DTOs for clean request/response contracts

**Layer 4: Frontend API Client Layer**
- `BackendApiClient`: Manages WebSocket connection to backend
- `AirconApiService`: High-level API for AC operations
- Replaces existing direct MQTT client implementation

**Layer 5: Frontend State Management (Updated)**  
- Updated Zustand store to consume backend API
- RxJS streams from WebSocket instead of MQTT
- Preserved existing state structure for UI compatibility

## 3. Design Patterns

### 3.1 Repository Pattern
```java
public interface MqttRepository {
    void publish(String topic, Object message);
    void subscribe(String topic, MessageHandler handler);
    boolean isConnected();
}

@Service
public class MqttRepositoryImpl implements MqttRepository {
    private final IMqttAsyncClient mqttClient;
    // Implementation details
}
```

### 3.2 Observer Pattern
- Backend broadcasts state changes to multiple frontend observers via WebSocket
- Event-driven architecture for loose coupling between components

### 3.3 Command Pattern
```java
public interface AirconCommand {
    void execute(String roomId, Object value);
    String getCommandType();
}

@Component
public class SetTemperatureCommand implements AirconCommand {
    // Implementation
}
```

### 3.4 Facade Pattern
```typescript
// Frontend API Facade
class AirconApiFacade {
    private websocket: WebSocket;
    private restClient: RestClient;
    
    async setTemperature(roomId: string, temperature: number): Promise<void> {
        // Simplified interface hiding complexity
    }
}
```

## 4. Component Design

### 4.1 Backend Components

#### MqttService (Spring Boot Service)
```java
@Service
public class MqttService {
    @Value("${mqtt.broker.url}")
    private String brokerUrl;
    
    @EventListener
    public void handleMqttMessage(MqttMessageEvent event) {
        // Process and broadcast to WebSocket clients
    }
    
    public void publishCommand(String topic, Object payload) {
        // Validate and publish to MQTT broker
    }
}
```

#### WebSocketController
```java
@Controller
public class AirconWebSocketController {
    @MessageMapping("/aircon/command")
    @SendTo("/topic/aircon/updates")
    public StateUpdateMessage handleCommand(ControlCommandMessage command) {
        // Process command and return state update
    }
}
```

#### StateService
```java
@Service
public class StateService {
    private final Map<String, AirconState> roomStates = new ConcurrentHashMap<>();
    
    public void updateRoomState(String roomId, AirconState state) {
        roomStates.put(roomId, state);
        applicationEventPublisher.publishEvent(new StateChangedEvent(roomId, state));
    }
}
```

### 4.2 Frontend Components

#### Backend API Client
```typescript
class BackendApiClient {
    private websocket: WebSocket;
    private readonly baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    
    connect(): Observable<BackendMessage> {
        // WebSocket connection with reconnection logic
    }
    
    sendCommand(command: ControlCommand): Promise<void> {
        // Send command via WebSocket
    }
}
```

#### Updated Zustand Store
```typescript
// Preserve existing interface, change implementation
const createAirconStore = (initProps?: Partial<AirconProps>) => {
    return createStore<AirconStoreState>()((set, get) => ({
        // Same interface, different data source (backend API vs direct MQTT)
        client: backendApiClient, // Changed from MQTT client
        // ... rest of implementation
    }));
};
```

## 5. API Design

### 5.1 WebSocket API

**Message Types:**
```typescript
// Backend → Frontend (Outgoing)
type StateUpdateMessage = {
    type: 'STATE_UPDATE';
    roomId: string;
    timestamp: string;
    data: AirConState;
}

type SettingsUpdateMessage = {
    type: 'SETTINGS_UPDATE';
    roomId: string;
    timestamp: string;
    data: AirConSettings;
}

type ConnectionStatusMessage = {
    type: 'CONNECTION_STATUS';
    mqttConnected: boolean;
    connectedClients: number;
}

// Frontend → Backend (Incoming)
type ControlCommandMessage = {
    type: 'CONTROL_COMMAND';
    roomId: string;
    command: 'SET_TEMPERATURE' | 'SET_MODE' | 'SET_FAN' | 'SET_VANE' | 'SET_WIDE_VANE';
    value: string | number;
    timestamp: string;
}
```

### 5.2 REST API

**Endpoints:**
```
GET    /api/v1/rooms                     # Get all room configurations
GET    /api/v1/rooms/{roomId}/state      # Get current room state  
GET    /api/v1/rooms/{roomId}/settings   # Get current room settings
POST   /api/v1/rooms/{roomId}/commands   # Send control command (alternative to WebSocket)
GET    /api/v1/health                    # System health check
GET    /api/v1/health/mqtt               # MQTT connection status
```

**Request/Response DTOs:**
```java
public class ControlCommandRequest {
    private String command;
    private Object value;
    // validation annotations
}

public class RoomStateResponse {
    private String roomId;
    private AirConState state;
    private AirConSettings settings;
    private LocalDateTime lastUpdated;
}
```

## 6. Data Flow Design

### 6.1 State Update Flow (MQTT → Frontend)
1. MQTT Broker publishes message to `mitsubishi2mqtt/{roomId}/state`
2. Backend `MqttService` receives message via subscription
3. Backend validates message using existing Zod schemas (converted to Java validation)
4. Backend `StateService` updates internal state cache
5. Backend publishes `StateUpdateMessage` to WebSocket topic
6. All connected frontends receive update via WebSocket
7. Frontend Zustand store updates state
8. React components re-render with new state

### 6.2 Control Command Flow (Frontend → MQTT)
1. User interacts with UI (e.g., slider, button)
2. Frontend sends `ControlCommandMessage` via WebSocket
3. Backend validates command and parameters
4. Backend publishes to appropriate MQTT topic (`mitsubishi2mqtt/{roomId}/{command}/set`)
5. MQTT broker processes command and sends to AC unit
6. AC unit responds with updated state → flows back via State Update Flow

## 7. Technology Choices

### 7.1 Backend Technologies
- **MQTT Client**: Eclipse Paho MQTT Client (mature, Spring Boot compatible)
- **WebSocket**: Spring WebSocket with STOMP protocol
- **Validation**: Java Bean Validation (JSR-303) + custom validators for Zod schema compatibility  
- **JSON Processing**: Jackson (built into Spring Boot)
- **Configuration**: Spring Boot Configuration Properties
- **Testing**: Spring Boot Test, Testcontainers for integration tests

### 7.2 Frontend Technologies
- **WebSocket**: Native WebSocket API with SockJS fallback
- **State Management**: Keep existing Zustand store structure
- **HTTP Client**: Fetch API for REST endpoints
- **Type Safety**: Keep existing TypeScript interfaces and Zod schemas

## 8. Security Design

### 8.1 Credential Management
- MQTT credentials stored only in backend environment variables
- No MQTT connection details exposed to frontend
- WebSocket connections validated by origin

### 8.2 API Security
- Input validation on all endpoints using Bean Validation
- Rate limiting on WebSocket connections (Spring Security)
- CORS configuration for cross-origin requests
- Error messages sanitized to prevent information leakage

## 9. Error Handling Design

### 9.1 MQTT Error Handling
```java
@EventListener
public void handleMqttConnectionError(MqttConnectionErrorEvent event) {
    // Implement exponential backoff reconnection
    // Notify connected WebSocket clients of connection status
    // Log error details for monitoring
}
```

### 9.2 WebSocket Error Handling
```typescript
// Frontend WebSocket error handling with reconnection
class WebSocketClient {
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    
    private handleError(error: Event) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => this.reconnect(), Math.pow(2, this.reconnectAttempts) * 1000);
        }
    }
}
```

## 10. Performance Considerations

### 10.1 Connection Management
- Single persistent MQTT connection per backend instance
- WebSocket connection pooling and session management
- Message batching for high-frequency updates (temperature changes)

### 10.2 Caching Strategy  
- In-memory caching of current room states in `StateService`
- Redis cache for horizontal scaling (future enhancement)
- WebSocket message compression for large payloads

## 11. Deployment Design

### 11.1 Docker Compose Updates
```yaml
services:
  backend:
    environment:
      - MQTT_BROKER_URL=${MQTT_BROKER_URL}
      - MQTT_BROKER_USERNAME=${MQTT_BROKER_USERNAME}
      - MQTT_BROKER_PASSWORD=${MQTT_BROKER_PASSWORD}
    depends_on:
      - mqtt-broker
      
  frontend:
    environment:
      - NEXT_PUBLIC_BACKEND_URL=ws://backend:8080
      # Remove MQTT variables
```

### 11.2 Health Monitoring
- MQTT connection health checks
- WebSocket connection metrics
- Custom Spring Boot Actuator health indicators
- Structured logging for observability

## 12. Migration Strategy

### 12.1 Refactoring Approach
1. **Phase 1**: Implement backend MQTT service and API
2. **Phase 2**: Add feature flag to switch between old/new architecture
3. **Phase 3**: Update frontend to use backend API
4. **Phase 4**: Remove old MQTT client code after validation
5. **Phase 5**: Clean up and optimize

### 12.2 Risk Mitigation
- Comprehensive integration tests before switching
- Feature flags for gradual rollout
- Monitoring and rollback procedures
- Performance benchmarking to prevent regressions

This design maintains the existing room-based architecture while implementing proper separation of concerns, security, and scalability best practices.