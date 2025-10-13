# Implementation Plan

- [x] 1. Enhance existing UnifiedRoomController with integrated device control
  - Consolidate device control operations from AirConController into UnifiedRoomController (COMPLETED - AirConController removed)
  - Implement integrated quota validation within device control flow
  - Add automatic session management based on device power state changes
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [x] 1.1 Integrate quota validation into device control operations
  - Modify controlDevice method to include quota validation before command execution
  - Handle quota validation failures with appropriate HTTP status codes and detailed error responses
  - Ensure quota validation does not significantly impact response times
  - _Requirements: 3.1, 3.2, 10.4_

- [x] 1.2 Implement automatic session management
  - Add session start logic for power-on device control operations
  - Add session end logic for power-off device control operations
  - Implement graceful handling of session management failures
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.3 Add missing device control endpoints
  - Implement setDeviceVane endpoint for vane position control
  - Implement setDeviceWideVane endpoint for wide vane position control
  - Add validation endpoint for command validation without execution
  - _Requirements: 2.6, 1.4_

- [ ]* 1.4 Write unit tests for enhanced controller methods
  - Test quota validation integration in device control flow
  - Test automatic session management for power operations
  - Test error handling for quota violations and device communication failures
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 9.1, 9.2, 9.3, 9.4_

- [x] 2. Create enhanced response models for unified API
  - Implement DeviceControlResponse with embedded room data and quota information
  - Enhance RoomResponse to include device information and aggregate status
  - Create DeviceInfo model for device data within room context
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2.1 Implement DeviceControlResponse model
  - Create response model with success status, message, and updated room data
  - Include quota validation results in response
  - Add session information when applicable
  - _Requirements: 5.1, 5.2_

- [x] 2.2 Enhance RoomResponse with device information
  - Add device list with current state and settings
  - Include aggregate room status information
  - Add last update timestamp for caching
  - _Requirements: 5.1, 5.2_

- [x] 2.3 Create DeviceInfo model for embedded device data
  - Include device status, current state, and settings
  - Add active session information
  - Include last update timestamp
  - _Requirements: 5.1, 5.2_

- [ ]* 2.4 Write unit tests for response models
  - Test DeviceControlResponse serialization and validation
  - Test RoomResponse with embedded device information
  - Test DeviceInfo model completeness
  - _Requirements: 5.1, 5.2_

- [x] 3. Implement consistent error handling and response formats
  - Create unified error response format for all room-related operations
  - Implement quota-specific error responses with detailed information
  - Add proper HTTP status code mapping for different error types
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3.1 Create ApiErrorResponse model
  - Implement consistent error response structure
  - Include context-specific error details
  - Add timestamp and request path information
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3.2 Implement error mapping strategy
  - Map service exceptions to appropriate HTTP status codes
  - Create quota-specific error responses with detailed quota information
  - Implement device communication error handling
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ]* 3.3 Write unit tests for error handling
  - Test error response format consistency
  - Test quota violation error responses
  - Test device communication error handling
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 4. Replace AirConController with UnifiedRoomController (COMPLETED)
  - Removed deprecated AirConController completely
  - Updated frontend client to use new unified API endpoints
  - Updated integration tests to use UnifiedRoomController
  - Created migration documentation for reference
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 4.1 Remove AirConController and update references
  - Deleted AirConController.java completely
  - Updated integration tests to use UnifiedRoomController
  - Updated frontend client to use new API endpoints
  - _Requirements: 6.1, 6.2_

- [x] 4.2 Update client implementations
  - Updated room-api-client.ts to use correct UnifiedRoomController endpoints
  - Added support for all device control operations (power, temperature, mode, fan, vane, wide-vane)
  - Added validation endpoint support
  - _Requirements: 6.2, 6.4_

- [ ]* 4.3 Write integration tests for backward compatibility
  - Test that existing /api/aircon endpoints continue to work
  - Verify deprecation warnings are properly included
  - Test feature parity between old and new endpoints
  - _Requirements: 6.1, 6.3, 6.4_

- [ ] 5. Implement performance optimizations
  - Add request batching for multiple device operations
  - Implement caching strategy for room data and quota validation
  - Optimize database queries for room and device information
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 5.1 Implement request batching for device operations
  - Add batching logic for multiple device status requests
  - Implement debouncing for rapid device control operations
  - Optimize WebSocket update publishing
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 5.2 Add caching strategy for room and quota data
  - Implement room data caching with appropriate TTL
  - Add quota validation result caching
  - Implement cache invalidation on state changes
  - _Requirements: 10.1, 10.2, 10.4_

- [ ]* 5.3 Write performance tests
  - Test response times for device control operations
  - Test caching effectiveness and invalidation
  - Test concurrent operation handling
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 6. Implement real-time update integration
  - Add WebSocket event publishing for device control operations
  - Implement room-level status update broadcasting
  - Add event batching and debouncing for efficient updates
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6.1 Add WebSocket integration for device control
  - Publish room updates after successful device control operations
  - Include updated device state and session information
  - Handle WebSocket publishing failures gracefully
  - _Requirements: 7.1, 7.2_

- [x] 6.2 Implement event batching and debouncing
  - Batch multiple device updates within a room
  - Debounce rapid state changes to reduce update frequency
  - Prioritize user-initiated changes over automatic updates
  - _Requirements: 7.3_

- [ ]* 6.3 Write integration tests for real-time updates
  - Test WebSocket event publishing after device control
  - Test event batching and debouncing logic
  - Test graceful handling of WebSocket failures
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7. Update frontend API client to use consolidated endpoints
  - Modify RoomApiClient to use enhanced device control endpoints
  - Update error handling to work with new response formats
  - Add support for embedded quota and session information
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7.1 Update device control methods in RoomApiClient
  - Modify controlDevice method to handle integrated quota validation
  - Update response handling for enhanced DeviceControlResponse format
  - Add automatic session information extraction
  - _Requirements: 5.1, 5.2_

- [x] 7.2 Enhance error handling in API client
  - Update error handling for quota-specific error responses
  - Add support for detailed error information extraction
  - Implement retry logic for appropriate error types
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ]* 7.3 Write unit tests for updated API client
  - Test device control with integrated quota validation
  - Test error handling for quota violations
  - Test response parsing for enhanced formats
  - _Requirements: 5.1, 5.2, 9.1, 9.2_

- [ ] 8. Add monitoring and observability features
  - Implement structured logging for device control operations
  - Add performance metrics collection
  - Create health checks for integrated services
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 8.1 Implement structured logging
  - Add detailed logging for device control operations
  - Include quota validation results and session information
  - Log performance metrics and error details
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 8.2 Add performance metrics collection
  - Collect request/response times per endpoint
  - Track device control success/failure rates
  - Monitor quota validation performance
  - _Requirements: 10.1, 10.2, 10.4_

- [ ]* 8.3 Write integration tests for monitoring features
  - Test structured logging output format
  - Test metrics collection accuracy
  - Test health check functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4_