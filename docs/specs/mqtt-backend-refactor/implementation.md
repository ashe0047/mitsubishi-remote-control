# MQTT Backend Refactor - Implementation Plan

## 1. Implementation Overview

This implementation will be executed in phases to minimize risk and ensure proper testing at each stage. Each phase will include Context7 documentation queries and feedback checkpoints as required by the development process.

## 2. Phase Breakdown

### Phase 1: Backend MQTT Service Implementation
**Duration**: 2-3 hours
**Goal**: Implement backend MQTT client and message processing

### Phase 2: Backend API Layer Implementation  
**Duration**: 2-3 hours
**Goal**: Implement WebSocket and REST endpoints

### Phase 3: Frontend API Client Implementation
**Duration**: 2-3 hours
**Goal**: Create backend API client to replace MQTT client

### Phase 4: Frontend Integration and Testing
**Duration**: 2-3 hours
**Goal**: Update frontend components and test end-to-end functionality

### Phase 5: Cleanup and Documentation
**Duration**: 1-2 hours
**Goal**: Remove old code, update documentation, final testing

## 3. Detailed Implementation Steps

### Phase 1: Backend MQTT Service Implementation

#### Context7 Documentation Required
- `mcp__context7__resolve-library-id` → "eclipse paho mqtt java"
- `mcp__context7__get-library-docs` → Eclipse Paho MQTT Client documentation
- `mcp__context7__resolve-library-id` → "spring boot websocket"
- `mcp__context7__get-library-docs` → Spring Boot WebSocket documentation

#### Step 1.1: Add MQTT Dependencies
**File**: `backend/mitsubishi-controller/pom.xml`
**Action**: Add Eclipse Paho MQTT client dependency
**Implementation**:
```xml
<dependency>
    <groupId>org.eclipse.paho</groupId>
    <artifactId>org.eclipse.paho.client.mqttv3</artifactId>
    <version>1.2.5</version>
</dependency>
```

#### Step 1.2: Create MQTT Configuration
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/config/MqttConfig.java`
**Action**: Configure MQTT connection properties
**Validation**: Copy and adapt Zod schemas from frontend to Java validation

#### Step 1.3: Implement MQTT Service
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/service/MqttService.java`
**Action**: Create service for MQTT connection management
**Features**:
- Connection management with reconnection logic
- Topic subscription for state and settings
- Message publishing for control commands
- Integration with Spring event system

#### Step 1.4: Implement Message Handlers
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/service/MqttMessageHandler.java`
**Action**: Process incoming MQTT messages
**Features**:
- Parse and validate MQTT payloads
- Route messages to appropriate services
- Convert MQTT messages to internal events

**Feedback Checkpoint 1**: Test MQTT connection and message processing
- Verify backend connects to MQTT broker
- Confirm messages are received and parsed correctly
- Check error handling for connection failures

### Phase 2: Backend API Layer Implementation

#### Context7 Documentation Required
- `mcp__context7__get-library-docs` → Spring Boot WebSocket STOMP documentation
- `mcp__context7__resolve-library-id` → "spring boot validation"
- `mcp__context7__get-library-docs` → Java Bean Validation documentation

#### Step 2.1: Configure WebSocket
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/config/WebSocketConfig.java`
**Action**: Configure WebSocket endpoints and STOMP
**Features**:
- WebSocket endpoint configuration
- CORS configuration for frontend connection
- Message broker configuration

#### Step 2.2: Create DTOs and Validation
**Files**: 
- `backend/src/main/java/com/ashelabs/mitsubishicontroller/dto/`
**Action**: Create request/response objects with validation
**Features**:
- ControlCommandRequest with validation annotations
- StateUpdateMessage and SettingsUpdateMessage
- Room configuration DTOs

#### Step 2.3: Implement WebSocket Controller
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/controller/AirconWebSocketController.java`
**Action**: Handle WebSocket messages for real-time communication
**Features**:
- Handle incoming control commands
- Broadcast state updates to connected clients
- Connection management and error handling

#### Step 2.4: Implement REST Controller
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/controller/AirconRestController.java`  
**Action**: Create REST endpoints for room management
**Features**:
- Get room configurations
- Get current states and settings
- Health check endpoints
- Error handling with proper HTTP status codes

#### Step 2.5: Implement State Service
**File**: `backend/src/main/java/com/ashelabs/mitsubishicontroller/service/StateService.java`
**Action**: Manage room states and settings cache
**Features**:
- In-memory state storage per room
- Event publishing for state changes
- Thread-safe state operations

**Feedback Checkpoint 2**: Test backend API endpoints
- Verify WebSocket connections from browser dev tools
- Test REST endpoints with curl/Postman
- Confirm message routing between MQTT and WebSocket
- Validate error handling and logging

### Phase 3: Frontend API Client Implementation

#### Context7 Documentation Required
- `mcp__context7__resolve-library-id` → "typescript websocket"
- `mcp__context7__get-library-docs` → WebSocket API documentation
- `mcp__context7__resolve-library-id` → "rxjs websocket"
- `mcp__context7__get-library-docs` → RxJS WebSocket Subject documentation

#### Step 3.1: Create Backend API Client
**File**: `frontend/src/lib/api/backend-api-client.ts`
**Action**: Implement WebSocket client for backend communication
**Features**:
- WebSocket connection with reconnection logic
- Message serialization/deserialization  
- Observable streams for real-time updates
- Error handling and connection status tracking

#### Step 3.2: Create API Service Layer
**File**: `frontend/src/lib/api/aircon-api-service.ts`
**Action**: High-level API service for AC operations
**Features**:
- Facade pattern hiding WebSocket complexity
- TypeScript interfaces matching backend DTOs
- Promise-based API for control commands
- Observable API for state updates

#### Step 3.3: Update Environment Configuration
**File**: `frontend/src/lib/env/config.ts`
**Action**: Add backend URL configuration, remove MQTT config
**Changes**:
- Add `NEXT_PUBLIC_BACKEND_URL` 
- Remove MQTT-related environment variables
- Update validation schema

**Feedback Checkpoint 3**: Test frontend API client
- Verify WebSocket connection to backend
- Test sending commands and receiving responses
- Confirm error handling and reconnection logic
- Validate TypeScript types and interfaces

### Phase 4: Frontend Integration and Testing

#### Context7 Documentation Required
- `mcp__context7__resolve-library-id` → "zustand typescript"
- `mcp__context7__get-library-docs` → Zustand state management documentation

#### Step 4.1: Update Zustand Store
**File**: `frontend/src/stores/aircon-store.ts`
**Action**: Replace MQTT client with backend API client
**Changes**:
- Replace `MqttClient` with `BackendApiClient`
- Update connection management logic
- Preserve existing state structure and methods
- Update error handling for backend API errors

#### Step 4.2: Update Aircon Provider
**File**: `frontend/src/components/AirconProvider.tsx`  
**Action**: Replace MQTT streams with backend API streams
**Changes**:
- Replace `initializeMQTTClient` with backend API initialization
- Update RxJS streams to consume WebSocket messages
- Preserve existing component interface
- Add connection status handling

#### Step 4.3: Update Environment Files
**File**: `frontend/.env`
**Action**: Replace MQTT configuration with backend configuration
**Changes**:
```bash
# Remove MQTT configuration
# NEXT_PUBLIC_MQTT_BROKER_URL=...

# Add backend configuration  
NEXT_PUBLIC_BACKEND_URL=ws://localhost:8080
```

#### Step 4.4: Update Docker Compose
**File**: `frontend/compose.yaml`
**Action**: Update service dependencies and environment variables
**Changes**:
- Add dependency on backend service
- Update environment variable configuration
- Ensure proper service networking

**Feedback Checkpoint 4**: End-to-end testing
- Test complete user workflows (change temperature, mode, etc.)
- Verify real-time updates work correctly
- Test error scenarios (backend disconnection, invalid commands)
- Validate UI responsiveness and performance

### Phase 5: Cleanup and Documentation

#### Step 5.1: Remove Old MQTT Client Code
**Files to Remove/Update**:
- `frontend/src/lib/mqtt/mqtt-client.ts` (remove)
- Update `frontend/package.json` (remove mqtt.js dependency)
- Clean up unused imports and types

#### Step 5.2: Update Tests
**Files**:
- Create backend unit tests for MQTT service
- Create integration tests for WebSocket endpoints
- Update frontend tests to use backend API client
- Add end-to-end tests for complete workflows

#### Step 5.3: Update Documentation
**Files**:
- Update `frontend/README.md` with new setup instructions
- Update environment variable documentation
- Update deployment instructions

**Final Feedback Checkpoint**: Complete system validation
- Run all tests (unit, integration, e2e)
- Performance testing vs. original implementation
- Security audit of new architecture
- Code review and final cleanup

## 4. Testing Strategy

### Unit Tests
**Backend**:
- MqttService connection and message handling
- WebSocket message routing
- State service operations  
- Validation logic

**Frontend**:
- Backend API client functionality
- Updated Zustand store operations
- Component integration with new API

### Integration Tests
- Backend MQTT ↔ WebSocket message flow
- Frontend WebSocket ↔ Backend API integration
- Error handling and reconnection scenarios
- Docker Compose service integration

### End-to-End Tests
- Complete user workflows through new architecture
- Real-time state synchronization
- Multi-client scenarios
- Performance and load testing

## 5. Rollback Plan

### Rollback Triggers
- Performance degradation > 20%
- Critical functionality failures
- Security vulnerabilities discovered
- User experience issues

### Rollback Steps
1. Feature flag switch to old architecture
2. Restore original frontend MQTT client
3. Revert environment variable changes
4. Restore original Docker Compose configuration
5. Monitor system stability

## 6. Success Criteria

### Functional Requirements
- [ ] All AC control functions work through backend API
- [ ] Real-time state updates display correctly
- [ ] Multiple frontend clients supported
- [ ] Error handling and recovery working

### Non-Functional Requirements  
- [ ] Performance within 100ms of original system
- [ ] MQTT credentials not exposed to frontend
- [ ] System handles disconnections gracefully
- [ ] Comprehensive test coverage achieved

### Quality Requirements
- [ ] Code follows established patterns and conventions
- [ ] Documentation updated and accurate
- [ ] Security audit passes
- [ ] All tests passing

## 7. Resource Requirements

### Context7 Queries Needed
- Eclipse Paho MQTT Java client documentation
- Spring Boot WebSocket and STOMP configuration
- Java Bean Validation best practices  
- TypeScript WebSocket client patterns
- RxJS WebSocket Subject usage
- Zustand store updates and migration patterns

### Development Tools
- MQTT client testing tool (MQTT Explorer)
- WebSocket testing tool (browser dev tools)
- API testing tool (Postman/curl)
- Performance monitoring tools

### Environment Setup
- Backend MQTT client dependencies
- Frontend environment variable updates
- Docker Compose configuration changes
- Development and testing MQTT broker access

This implementation plan follows the spec-driven development process with mandatory Context7 documentation queries and feedback checkpoints at each phase to ensure quality and adherence to best practices.