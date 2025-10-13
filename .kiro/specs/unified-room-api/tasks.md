# Unified Room API Implementation Plan

## Phase 1: Backend Foundation

- [x] 1. DTOs and Data Models

- [x] 1.1 Extend RoomResponse DTO with device information
  - Add devices field to existing RoomResponse class
  - Add aggregateStatus field for room-level statistics
  - Update factory method to include device list and status
  - Include comprehensive JavaDoc documentation
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4_

- [x] 1.2 Create DeviceInfo DTO for device status integration
  - Implement DeviceInfo class with device metadata and current status
  - Add factory method to convert from Device entity and status
  - Handle null/offline device status gracefully
  - _Requirements: 7.2, 7.3, 4.3_

- [x] 1.3 Create AggregateStatus DTO for room-level statistics
  - Implement aggregate calculation logic (total devices, online devices, average temperature)
  - Add hasActiveDevices calculation based on device modes
  - Handle edge cases (no devices, all offline devices)
  - _Requirements: 7.4, 5.3_

- [x] 1.4 Create DeviceStatus DTO for real-time device state
  - Map AC status fields (power, temperature, mode, fan, vane, roomTemperature)
  - Add validation for status field values
  - Include timestamp for status freshness
  - _Requirements: 3.1, 7.3_

- [x] 2. Device Status Service Integration

- [x] 2.1 Create device status service for real-time data
  - Implement service to fetch current device status from MQTT/WebSocket
  - Add caching layer for device status to improve performance
  - Handle device offline scenarios with graceful degradation
  - _Requirements: 3.1, 3.4, 5.3_

- [x] 2.2 Implement RoomService with device enrichment
  - Create service class that combines room, device, and status data
  - Implement getAllRoomsWithDevices method with parallel device fetching
  - Add getRoomWithDevices method for single room retrieval
  - Use existing DeviceService for device data
  - _Requirements: 1.1, 1.2, 5.1, 5.2_

- [x] 2.3 Implement room aggregate status calculation
  - Create calculateAggregateStatus method from device list
  - Add real-time status update handling
  - Implement efficient status change detection
  - _Requirements: 3.1, 5.3, 7.4_

- [x] 2.4 Add error handling and resilience patterns
  - Implement circuit breaker for device status calls
  - Add retry logic with exponential backoff
  - Handle partial failures gracefully (some devices offline)
  - _Requirements: 10.1, 10.3, 3.4_

- [x] 3. Room Controller

- [x] 3.1 Create RoomController with consolidated endpoints
  - Implement controller class with /api/rooms base mapping
  - Add all CRUD operations using updated response DTOs
  - Maintain existing security annotations and validation from RoomController
  - _Requirements: 2.1, 2.2, 6.1_

- [x] 3.2 Implement room retrieval endpoints
  - Add GET /api/rooms endpoint returning RoomResponse list with devices
  - Add GET /api/rooms/{roomId} endpoint with full room details
  - Add GET /api/rooms/identifier/{identifier} endpoint
  - _Requirements: 1.1, 1.2, 7.1, 7.2_

- [x] 3.3 Migrate room CRUD operations from existing RoomController
  - Copy and adapt POST, PUT, DELETE operations from /api/room-management
  - Update response types to use updated RoomResponse
  - Maintain backward compatibility during transition
  - _Requirements: 2.1, 6.1, 6.2_

- [x] 3.4 Add device control delegation endpoints
  - Implement device control endpoints under /api/rooms/{roomId}/devices/{deviceId}/*
  - Delegate to existing DeviceService control methods
  - Update room status after successful device control operations
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 4. WebSocket Integration

- [x] 4.1 Enhance existing WebSocket handlers for room status updates
  - Modify AirConditionerWebSocketHandler to emit room-level status changes
  - Add room aggregate status update messages
  - Implement efficient message batching for multiple device updates
  - _Requirements: 3.1, 3.2, 3.3, 8.4_

- [x] 4.2 Add room subscription management to WebSocket handlers
  - Implement room-level WebSocket subscriptions in existing handlers
  - Allow clients to subscribe to specific rooms or all rooms
  - Handle subscription lifecycle (connect, disconnect, reconnect)
  - _Requirements: 3.1, 3.2, 10.2_

## Phase 2: Frontend Unified Store

- [x] 5. TypeScript Interfaces

- [x] 5.1 Extend room TypeScript interfaces
  - Add devices field to existing Room interface matching backend DTO
  - Create DeviceInfo interface with status fields
  - Add AggregateStatus interface for statistics
  - Update existing Room interface in types/room.ts
  - _Requirements: 9.1, 9.3, 7.1, 7.2_

- [x] 5.2 Create device control action interfaces
  - Define DeviceControlAction union type for all control operations
  - Add DeviceControlResponse interface for operation results
  - Create type-safe action creators for each device control type
  - _Requirements: 8.1, 8.2, 9.1_

- [x] 5.3 Add validation schemas using Zod
  - Create Zod schemas for all room interfaces
  - Add runtime validation for API responses
  - Implement error handling for validation failures
  - _Requirements: 9.1, 9.2, 10.1_

- [-] 6. Room Store Implementation

- [x] 6.1 Update RoomStore to replace existing implementation
  - Implement store interface with all required state and actions
  - Add room CRUD operations using updated API client
  - Include device control actions integrated with room updates
  - Maintain compatibility with existing useRoomStore usage
  - _Requirements: 4.1, 4.2, 4.3, 8.1_

- [x] 6.2 Implement real-time WebSocket integration
  - Add WebSocket connection management to store
  - Handle real-time device status updates
  - Update room aggregate status when device status changes
  - _Requirements: 3.1, 3.2, 4.3, 8.4_

- [x] 6.3 Add computed selectors and getters
  - Implement getRoomById, getRoomByIdentifier selectors
  - Add getActiveRooms, getTotalDevices, getOnlineDevices computed values
  - Create memoized selectors to prevent unnecessary re-renders
  - _Requirements: 4.2, 5.2, 5.3_

- [x] 6.4 Implement caching and performance optimizations
  - Add intelligent caching with TTL and invalidation
  - Implement request deduplication for concurrent calls
  - Add optimistic updates for device control operations
  - _Requirements: 5.1, 5.2, 5.3, 8.1_

- [ ] 7. Room API Client

- [x] 7.1 Update RoomApiClient to replace existing implementation
  - Implement all room CRUD operations using /api/rooms endpoints
  - Add device control methods using room-scoped endpoints
  - Include comprehensive error handling and retry logic
  - Maintain compatibility with existing roomApiClient usage
  - _Requirements: 1.1, 2.1, 8.1, 10.1_

- [ ] 7.2 Add request/response validation
  - Integrate Zod schemas for runtime validation
  - Add request payload validation before sending
  - Validate API responses and handle schema mismatches
  - _Requirements: 9.1, 9.2, 10.1_

- [ ] 7.3 Implement retry and resilience patterns
  - Add exponential backoff for failed requests
  - Implement circuit breaker for repeated failures
  - Add request timeout handling with appropriate fallbacks
  - _Requirements: 10.1, 10.2, 10.4_

## Phase 3: Component Migration

- [ ] 8. Update Dashboard Components

- [ ] 8.1 Migrate DashboardOverview to use updated RoomStore
  - Replace mock data with real room aggregate statistics from room data
  - Use room store selectors for total rooms, active devices, average temperature
  - Remove getSystemStats and getFavoriteRooms mock functions
  - Add loading and error states for room data fetching
  - _Requirements: 4.1, 4.2, 5.1, 10.3_

- [ ] 8.2 Update favorite rooms section with real device status
  - Use room data for device online status and temperatures
  - Add real-time updates for room status changes
  - Implement proper loading states while fetching room data
  - _Requirements: 3.1, 4.2, 7.3, 7.4_

- [ ] 8.3 Add error handling and fallback UI
  - Display appropriate error messages for API failures
  - Provide retry mechanisms for failed data fetching
  - Show partial data when some rooms are unavailable
  - _Requirements: 10.1, 10.3, 10.4_

- [ ] 9. Update Room Management Components

- [ ] 9.1 Migrate RoomManagementList to updated store
  - Replace separate room and device store usage with updated store
  - Use room data for device counts and status
  - Simplify component logic by removing redundant API calls
  - _Requirements: 4.1, 4.2, 5.2_

- [ ] 9.2 Update CreateRoomDialog and EditRoomDialog
  - Modify to use updated store create/update actions
  - Update success handling to work with updated room responses
  - Add proper error handling for validation failures
  - _Requirements: 4.1, 8.1, 10.1_

- [ ] 9.3 Migrate room detail pages to updated store
  - Update individual room pages to use room data with devices
  - Remove separate device API calls where possible
  - Add real-time device status updates via WebSocket
  - _Requirements: 1.1, 3.1, 4.2_

- [ ] 10. Update Device Control Components

- [ ] 10.1 Integrate device control with room store
  - Update device control components to use unified store actions
  - Add immediate room status updates after device control operations
  - Implement optimistic updates with rollback on failure
  - _Requirements: 8.1, 8.2, 4.3_

- [ ] 10.2 Add real-time status feedback
  - Show immediate feedback when device control operations are initiated
  - Update room aggregate status when device status changes
  - Handle concurrent device control operations safely
  - _Requirements: 8.1, 8.4, 3.1_

## Phase 4: Migration and Cleanup

- [ ] 11. Backward Compatibility Layer

- [ ] 11.1 Create API adapter for old endpoints
  - Implement redirect/proxy layer for /api/room-management endpoints
  - Add deprecation warnings in API responses
  - Maintain existing response formats during transition period
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 11.2 Create frontend store adapter
  - Implement adapter layer to maintain compatibility with existing components
  - Gradually migrate components to use unified store directly
  - Add migration guides and documentation for developers
  - _Requirements: 6.2, 6.4, 9.4_

- [ ] 12. Performance Testing and Optimization

- [ ] 12.1 Implement comprehensive performance testing
  - Add load tests for unified room API endpoints
  - Test WebSocket connection scaling and message throughput
  - Measure frontend rendering performance with enhanced room data
  - _Requirements: 5.1, 5.3, 3.3_

- [ ] 12.2 Optimize database queries and caching
  - Add database indexes for room + device join queries
  - Implement Redis caching for frequently accessed room data
  - Optimize WebSocket message batching and delivery
  - _Requirements: 5.1, 5.3, 3.3_

- [ ] 13. Documentation and Migration Guides

- [ ] 13.1 Create API documentation for unified endpoints
  - Document all new /api/rooms endpoints with examples
  - Add migration guide from old endpoints to new ones
  - Include WebSocket message format documentation
  - _Requirements: 6.4, 9.4_

- [ ] 13.2 Create frontend migration documentation
  - Document unified store usage patterns and best practices
  - Add examples for common room data access patterns
  - Create troubleshooting guide for migration issues
  - _Requirements: 6.4, 9.4_

- [ ] 14. Legacy Cleanup

- [ ] 14.1 Remove deprecated API endpoints
  - Remove /api/room-management endpoints after migration period
  - Clean up unused controller and service classes
  - Update API documentation to reflect final endpoint structure
  - _Requirements: 6.3_

- [ ] 14.2 Clean up frontend stores and clients
  - Remove old room store and device store implementations
  - Delete unused API client classes and interfaces
  - Update all import statements and dependencies
  - _Requirements: 4.4, 6.4_

- [ ] 14.3 Final testing and validation
  - Run comprehensive end-to-end tests on unified system
  - Validate performance improvements and user experience
  - Ensure no regressions in existing functionality
  - _Requirements: 5.1, 10.4_