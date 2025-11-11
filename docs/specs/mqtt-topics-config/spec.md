# MQTT Topics Configuration Management - Requirements Specification

## Overview

This specification defines the requirements for refactoring the hardcoded MQTT topic patterns in the AirConditionerStrategy to a configurable, maintainable solution following NestJS best practices and clean code principles.

## Business Requirements

### User Stories

**As a developer**, I want to configure MQTT topics through configuration files so that I can change topics without modifying code.

**As a system administrator**, I want to use different MQTT topic patterns per environment so that I can isolate development, staging, and production systems.

**As a developer**, I want to validate MQTT topic patterns at startup so that I can catch configuration errors early.

**As a developer**, I want to easily mock topic generation in tests so that I can write maintainable unit tests.

**As a system architect**, I want to support future AC manufacturers so that the system can extend beyond Mitsubishi devices.

## Functional Requirements

### FR-001: Configuration-Driven Topics
- MQTT topic patterns MUST be externalized from business logic
- Topic patterns SHALL support placeholder substitution (e.g., `{deviceId}`)
- Configuration MUST support both single file and environment-specific loading
- Default topic patterns MUST be provided when no configuration is specified

### FR-002: Environment-Specific Configuration
- Development, staging, and production environments SHALL support different topic patterns
- Environment-specific topic patterns MUST be loaded automatically based on NODE_ENV
- Configuration validation MUST occur during application startup

### FR-003: Topic Generation Service
- A dedicated service SHALL generate topics from patterns and parameters
- The service SHALL support command topic generation
- The service SHALL support state topic generation
- The service SHALL validate generated topics against MQTT standards

### FR-004: Integration with AirConditionerStrategy
- AirConditionerStrategy SHALL use the new topic service instead of hardcoded strings
- All existing MQTT functionality MUST be preserved
- No breaking changes SHALL be introduced to the public API

### FR-005: Configuration Validation
- Topic patterns MUST be validated at startup
- Invalid patterns SHALL cause application startup to fail with clear error messages
- Placeholder usage MUST be validated (required placeholders must be present)

## Non-Functional Requirements

### NFR-001: Performance
- Topic generation SHALL have minimal performance impact (<1ms per topic)
- Configuration loading SHALL occur once at startup
- No runtime overhead SHALL be introduced during MQTT operations

### NFR-002: Maintainability
- Topic configuration SHALL be easily discoverable and understandable
- Changes to topic patterns SHALL not require code changes
- Documentation SHALL clearly explain configuration options

### NFR-003: Testability
- Topic generation SHALL be easily mockable in unit tests
- Configuration loading SHALL be testable with different scenarios
- All components SHALL have >90% test coverage

### NFR-004: Backward Compatibility
- Existing MQTT topic patterns MUST remain the same by default
- All current functionality SHALL continue to work without changes
- Migration SHALL be seamless and transparent to end users

## Acceptance Criteria

### AC-001: Configuration Loading
- GIVEN the application starts
- WHEN MQTT topics configuration is loaded
- THEN it loads from environment-specific file or uses defaults
- AND all patterns are validated

### AC-002: Topic Generation
- GIVEN a deviceId and command type
- WHEN requesting a command topic
- THEN the service returns the correctly formatted topic string
- AND the topic follows MQTT standards

### AC-003: Strategy Integration
- GIVEN an AirConditionerStrategy instance
- WHEN processing a device command
- THEN it uses the topic service for all MQTT operations
- AND no hardcoded topic strings remain in the strategy

### AC-004: Environment Support
- GIVEN different environment configurations
- WHEN the application runs in development vs production
- THEN different topic patterns are used appropriately
- AND topics don't conflict between environments

### AC-005: Error Handling
- GIVEN invalid topic configuration
- WHEN the application starts
- THEN it fails with clear error messages
- AND indicates which patterns are invalid and why

## Success Metrics

- **Zero Hardcoded Topics**: All MQTT topic strings moved to configuration
- **Startup Validation**: 100% of topic patterns validated at application start
- **Test Coverage**: >95% code coverage for new topic management components
- **Performance**: <1ms average topic generation time
- **Documentation**: Complete API documentation with examples
- **Migration Success**: No breaking changes to existing functionality

## Constraints and Assumptions

### Constraints
- MUST follow existing NestJS architecture patterns
- MUST maintain compatibility with current mitsubishi2mqtt bridge
- MUST NOT break existing WebSocket API contracts
- MUST follow the project's clean code standards and SOLID principles

### Assumptions
- MQTT broker configuration remains unchanged
- Existing device IDs and room structure remain valid
- Current authentication and authorization patterns continue to work
- Redis session management remains unchanged

## Dependencies and Integration Points

### Internal Dependencies
- **ConfigService**: For loading environment-specific configuration
- **MqttService**: For publishing/subscribe operations
- **AirConditionerStrategy**: Primary consumer of topic service
- **ValidationPipe**: For configuration validation

### External Dependencies
- **mitsubishi2mqtt bridge**: Current MQTT topic structure must be maintained
- **Redis**: For session management (unchanged)
- **PostgreSQL**: For device configuration (unchanged)

### Integration Points
- **Application Startup**: Configuration loading and validation
- **Device Commands**: Topic generation for command publishing
- **State Subscriptions**: Topic generation for MQTT subscriptions
- **Error Handling**: Integration with existing error handling patterns

## Risk Assessment

### High Risk
- **Breaking Changes**: Risk of breaking existing MQTT communication
- **Performance Impact**: Risk of introducing performance bottlenecks

### Medium Risk
- **Configuration Complexity**: Risk of making configuration too complex
- **Migration Issues**: Risk of issues during deployment

### Low Risk
- **Test Coverage**: Risk of incomplete test coverage
- **Documentation**: Risk of inadequate documentation

## Mitigation Strategies

- **Comprehensive Testing**: Full integration tests before deployment
- **Gradual Migration**: Feature flags for gradual rollout if needed
- **Monitoring**: Enhanced logging for topic generation debugging
- **Rollback Plan**: Quick revert strategy if issues arise