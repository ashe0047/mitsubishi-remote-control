# MQTT Backend Refactor - Requirements Specification

## 1. Business Requirements

### Problem Statement
The current frontend architecture directly connects to the MQTT broker, which violates several architectural best practices:
- **Security Risk**: MQTT credentials exposed to client-side code
- **Coupling**: Frontend tightly coupled to MQTT infrastructure
- **Scalability**: Direct client connections don't scale well
- **Maintainability**: MQTT logic scattered across frontend components
- **Testability**: Difficult to mock/test MQTT interactions in isolation

### Business Value
- **Enhanced Security**: MQTT credentials secured on backend only
- **Better Architecture**: Proper separation of concerns and layered architecture
- **Improved Scalability**: Backend can manage connection pooling and load balancing
- **Easier Maintenance**: Centralized MQTT logic in backend services
- **Better Testing**: Clear API boundaries enable easier testing

## 2. Functional Requirements

### FR-1: Backend MQTT Service
- Backend shall manage all MQTT broker connections
- Backend shall handle MQTT message publishing and subscription
- Backend shall validate all MQTT messages using existing Zod schemas
- Backend shall maintain room-based topic organization

### FR-2: WebSocket/SSE API
- Backend shall expose real-time API for frontend communication
- Backend shall push MQTT state changes to connected frontends
- Backend shall accept control commands from frontend
- Backend shall support multiple concurrent frontend connections

### FR-3: REST API
- Backend shall provide REST endpoints for initial data loading
- Backend shall provide room configuration endpoints
- Backend shall provide connection status endpoints
- Backend shall provide health check endpoints

### FR-4: Frontend Refactor
- Frontend shall connect to backend via WebSocket/SSE instead of MQTT
- Frontend shall send control commands via backend API
- Frontend shall receive state updates via backend real-time connection
- Frontend shall maintain existing UI/UX with no visible changes to users

## 3. Non-Functional Requirements

### NFR-1: Performance
- Message latency shall not exceed 100ms additional delay
- System shall support at least 10 concurrent frontend connections
- MQTT connection shall be persistent and handle reconnections

### NFR-2: Security
- MQTT credentials shall never be exposed to frontend
- Backend API shall implement proper authentication if needed
- WebSocket connections shall be validated and rate-limited

### NFR-3: Reliability
- System shall handle MQTT broker disconnections gracefully
- Backend shall automatically reconnect to MQTT broker
- Frontend shall handle backend disconnections gracefully

### NFR-4: Maintainability
- Existing Zod validation schemas shall be reused
- Room-based architecture shall be preserved
- Code changes shall be minimal and focused

## 4. Acceptance Criteria

### AC-1: MQTT Connectivity
- [ ] Backend connects to MQTT broker using existing configuration
- [ ] Backend subscribes to all required topics (settings, state)
- [ ] Backend publishes control commands to MQTT broker
- [ ] MQTT message validation using existing Zod schemas works

### AC-2: Backend API
- [ ] WebSocket/SSE endpoint provides real-time updates
- [ ] REST endpoints provide room configuration and status
- [ ] API handles multiple concurrent connections
- [ ] Error handling and logging implemented

### AC-3: Frontend Integration
- [ ] Frontend connects to backend instead of MQTT directly
- [ ] All AC control functionality works through backend
- [ ] Real-time updates display correctly in UI
- [ ] No visible changes to user experience

### AC-4: Quality Assurance  
- [ ] All existing tests pass
- [ ] New backend endpoints have test coverage
- [ ] MQTT connection errors handled gracefully
- [ ] System works with Docker Compose setup

## 5. Success Metrics

- **Security**: MQTT credentials no longer in frontend code
- **Performance**: Message latency < 100ms end-to-end
- **Reliability**: 99.9% uptime for backend MQTT connection
- **User Experience**: No functional changes visible to end users

## 6. Constraints and Assumptions

### Constraints
- Must preserve existing room-based architecture
- Must reuse existing Zod validation schemas
- Must maintain backward compatibility with existing MQTT broker setup
- Must work with existing Docker Compose configuration

### Assumptions
- MQTT broker remains the same (mitsubishi2mqtt)
- Room configuration format remains unchanged
- Existing UI components can be adapted to use backend API
- Spring Boot backend has capacity for MQTT client integration

## 7. Dependencies and Integration Points

### Dependencies
- Existing MQTT broker (mitsubishi2mqtt)
- Existing room configuration (app-config.yaml)
- Existing Zod validation schemas
- Spring Boot backend infrastructure

### Integration Points
- MQTT broker connection management
- WebSocket/SSE implementation in Spring Boot
- Frontend state management (Zustand) adaptation
- Docker Compose service configuration

## 8. Out of Scope

- Changes to MQTT broker or topics structure
- Changes to room configuration format
- UI/UX modifications
- User authentication/authorization
- Database persistence of MQTT messages
- Message queuing or complex event processing