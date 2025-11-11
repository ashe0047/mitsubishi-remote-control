# MQTT Topics Configuration Management - Implementation Plan

## Task Breakdown and Sequencing

### Phase 1: Foundation Infrastructure (Priority: High)

#### Task 1.1: Create Configuration Interfaces
**File**: `src/config/mqtt-topics.config.ts`
**Estimated Time**: 1 hour
**Dependencies**: None

**Implementation Details**:
- Define `MqttTopicPatterns` interface with TypeScript types
- Create validation schemas using Zod
- Define default configuration constants
- Add JSDoc documentation for all interfaces

#### Task 1.2: Create Default Topic Constants
**File**: `src/common/constants/mqtt-topics.constants.ts`
**Estimated Time**: 0.5 hours
**Dependencies**: Task 1.1

**Implementation Details**:
- Extract current hardcoded patterns to constants
- Follow project naming conventions
- Ensure backward compatibility with existing topics
- Add validation for placeholder usage

#### Task 1.3: Implement MqttTopicsService
**File**: `src/shared/mqtt/mqtt-topics.service.ts`
**Estimated Time**: 2 hours
**Dependencies**: Task 1.1, Task 1.2

**Implementation Details**:
- Implement injectable service with ConfigService
- Create core topic generation methods
- Add pattern validation logic
- Implement error handling with proper logging
- Add comprehensive unit tests

#### Task 1.4: Update Module Configuration
**File**: `src/devices/devices.module.ts`
**Estimated Time**: 0.5 hours
**Dependencies**: Task 1.3

**Implementation Details**:
- Register MqttTopicsService as provider
- Ensure proper dependency injection
- Add configuration validation at startup
- Update module exports if needed

### Phase 2: Strategy Integration (Priority: High)

#### Task 2.1: Update AirConditionerStrategy Constructor
**File**: `src/devices/websocket/strategies/air-conditioner.strategy.ts`
**Estimated Time**: 0.5 hours
**Dependencies**: Task 1.3

**Implementation Details**:
- Add MqttTopicsService injection
- Remove no-unused-dependency warnings
- Update constructor TypeScript types

#### Task 2.2: Refactor Command Handlers
**File**: `src/devices/websocket/strategies/air-conditioner.strategy.ts`
**Estimated Time**: 3 hours
**Dependencies**: Task 2.1

**Implementation Details**:
- Update `handleSetPower()` to use topic service
- Update `handleSetTemperature()` to use topic service
- Update `handleSetMode()` to use topic service
- Update `handleSetFan()` to use topic service
- Update `handleSetVane()` and `handleSetWideVane()` methods
- Remove all hardcoded topic strings

#### Task 2.3: Refactor Subscription Logic
**File**: `src/devices/websocket/strategies/air-conditioner.strategy.ts`
**Estimated Time**: 1 hour
**Dependencies**: Task 2.2

**Implementation Details**:
- Update `subscribeToDeviceEvents()` to use topic service
- Ensure all subscription topics are generated dynamically
- Maintain existing subscription behavior
- Add logging for topic generation debugging

#### Task 2.4: Update Response Metadata
**File**: `src/devices/websocket/strategies/air-conditioner.strategy.ts`
**Estimated Time**: 0.5 hours
**Dependencies**: Task 2.2

**Implementation Details**:
- Include generated topics in response metadata for debugging
- Update command response interfaces if needed
- Ensure backward compatibility with existing response format

### Phase 3: Configuration and Validation (Priority: Medium)

#### Task 3.1: Create Environment Configuration Files
**Files**:
- `config/development.yml`
- `config/production.yml`
**Estimated Time**: 1 hour
**Dependencies**: Task 1.1

**Implementation Details**:
- Add MQTT topics configuration to development config
- Add production-specific topic patterns
- Ensure configuration schema validation
- Add comments explaining configuration options

#### Task 3.2: Implement Startup Validation
**File**: `src/shared/mqtt/mqtt-topics.service.ts`
**Estimated Time**: 1 hour
**Dependencies**: Task 1.3

**Implementation Details**:
- Add pattern validation in service constructor
- Validate placeholder usage in all patterns
- Provide clear error messages for invalid configurations
- Add integration tests for validation scenarios

#### Task 3.3: Update Application Configuration
**File**: `src/config/app.config.ts` or equivalent
**Estimated Time**: 0.5 hours
**Dependencies**: Task 3.1

**Implementation Details**:
- Ensure MQTT topics configuration is loaded
- Add configuration to ConfigModule validation schema
- Update environment variable handling if needed

### Phase 4: Testing and Documentation (Priority: Medium)

#### Task 4.1: Create Unit Tests for MqttTopicsService
**File**: `src/shared/mqtt/__tests__/mqtt-topics.service.spec.ts`
**Estimated Time**: 2 hours
**Dependencies**: Task 1.3

**Implementation Details**:
- Test topic generation for all command types
- Test state topic generation
- Test configuration loading and validation
- Test error scenarios and edge cases
- Achieve >95% code coverage

#### Task 4.2: Update AirConditionerStrategy Tests
**File**: `src/devices/websocket/strategies/__tests__/air-conditioner.strategy.spec.ts`
**Estimated Time**: 2 hours
**Dependencies**: Task 2.3

**Implementation Details**:
- Mock MqttTopicsService in existing tests
- Update tests to verify topic service usage
- Ensure all existing functionality still works
- Add tests for new topic generation scenarios

#### Task 4.3: Integration Testing
**File**: `src/devices/__tests__/mqtt-topics.integration.spec.ts`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 3.2

**Implementation Details**:
- Test end-to-end topic generation flow
- Test configuration loading in different environments
- Test MQTT publishing with generated topics
- Test subscription with generated topics

#### Task 4.4: Update Documentation
**Files**: Project README, API documentation
**Estimated Time**: 1 hour
**Dependencies**: Task 4.3

**Implementation Details**:
- Document new configuration options
- Update MQTT topics configuration guide
- Add examples for different environments
- Update troubleshooting guide

## Development Phases and Milestones

### Milestone 1: Core Infrastructure (Week 1)
**Tasks**: 1.1, 1.2, 1.3, 1.4
**Success Criteria**:
- MqttTopicsService implemented and tested
- Configuration interfaces defined
- Default topic constants created
- Service registered in module

### Milestone 2: Strategy Integration (Week 2)
**Tasks**: 2.1, 2.2, 2.3, 2.4
**Success Criteria**:
- AirConditionerStrategy uses topic service
- All hardcoded topics removed
- Existing functionality preserved
- Integration tests passing

### Milestone 3: Configuration Enhancement (Week 2)
**Tasks**: 3.1, 3.2, 3.3
**Success Criteria**:
- Environment-specific configurations working
- Startup validation implemented
- Configuration errors properly handled

### Milestone 4: Testing and Documentation (Week 3)
**Tasks**: 4.1, 4.2, 4.3, 4.4
**Success Criteria**:
- All tests passing with >95% coverage
- Documentation updated
- Ready for production deployment

## File and Component Creation Plan

### New Files to Create
```
src/
├── config/
│   └── mqtt-topics.config.ts           # Configuration interfaces
├── common/constants/
│   └── mqtt-topics.constants.ts        # Default topic patterns
├── shared/mqtt/
│   ├── mqtt-topics.service.ts          # Main service implementation
│   └── __tests__/
│       └── mqtt-topics.service.spec.ts # Service unit tests
├── devices/__tests__/
│   └── mqtt-topics.integration.spec.ts # Integration tests
└── config/
    ├── development.yml                 # Development MQTT config (update)
    └── production.yml                  # Production MQTT config (update)
```

### Files to Modify
```
src/
├── devices/devices.module.ts           # Register new service
├── devices/websocket/strategies/
│   └── air-conditioner.strategy.ts     # Use topic service
├── devices/websocket/strategies/__tests__/
│   └── air-conditioner.strategy.spec.ts # Update tests
└── config/app.config.ts               # Add MQTT config validation
```

## NestJS Implementation Strategy Documentation

### Chosen Approach: ConfigService + Constants Pattern

**Rationale**:
- Best performance (simple object access)
- Highest maintainability (clear separation)
- Easiest testing (straightforward mocking)
- Lowest complexity (minimal code)
- Good NestJS alignment (proper ConfigService usage)
- Perfect project fit (follows existing patterns)

**Implementation Examples**:

```typescript
// ✅ Chosen: ConfigService + Constants
@Injectable()
export class MqttTopicsService {
  constructor(private readonly configService: ConfigService) {
    this.patterns = this.loadAndValidatePatterns();
  }

  getCommandTopic(deviceId: string, command: string): string {
    const pattern = this.patterns.commands[command];
    return `${this.patterns.baseTopic}/${pattern.replace('{deviceId}', deviceId)}`;
  }
}

// ❌ Rejected: Complex Factory Pattern
@Injectable()
export class MqttTopicsService {
  createTopicBuilder(deviceId: string): TopicBuilder {
    return new TopicBuilder(deviceId, this.patterns);
  }
}

// ❌ Rejected: Over-engineered Module Pattern
@Module({
  providers: [
    { provide: MQTT_TOPIC_PATTERNS, useFactory: createTopicPatterns }
  ]
})
export class MqttTopicsModule {}
```

### Integration Points

**With Existing ConfigService**:
```typescript
// Leverage existing ConfigService infrastructure
const mqttConfig = this.configService.get<MqttTopicPatterns>('mqtt.topics');
```

**With Existing MQTT Service**:
```typescript
// No changes needed to MqttService interface
await this.mqttService.publish(topic, payload);
```

**With Existing Error Handling**:
```typescript
// Follow existing error handling patterns
catch (error) {
  this.logger.error(`Failed to generate topic: ${error.message}`);
  throw new Error(`Topic generation failed: ${error.message}`);
}
```

## Clean Code Implementation Checklist

### ✅ Code Duplication Elimination (DRY)
- [ ] All hardcoded topic strings moved to configuration
- [ ] Single source of truth for topic patterns
- [ ] No repeated topic generation logic

### ✅ Single Responsibility Validation
- [ ] MqttTopicsService handles only topic management
- [ ] AirConditionerStrategy handles only device logic
- [ ] Configuration loading separated from usage

### ✅ Interface Segregation and Dependency Injection
- [ ] MqttTopicsService injected into strategy
- [ ] Clear interface for topic generation methods
- [ ] Dependencies properly abstracted

### ✅ Refactoring Opportunities and Technical Debt Reduction
- [ ] Hardcoded dependencies eliminated
- [ ] Configuration validation prevents runtime errors
- [ ] Easy mocking for improved testability

### ✅ Code Review Criteria Based on Clean Code Principles
- [ ] Functions <20 lines
- [ ] Clear naming conventions
- [ ] Proper TypeScript types
- [ ] Adequate error handling
- [ ] Comprehensive logging

### ✅ NestJS Convention Adherence Validation
- [ ] Proper use of @Injectable()
- [ ] Constructor injection with TypeScript shorthand
- [ ] Module configuration follows patterns
- [ ] Configuration uses ConfigService properly
- [ ] Error handling follows NestJS patterns

## Package/Framework Documentation Requirements (Context7 Queries Needed)

**Required Documentation Queries**:
1. **NestJS ConfigService**: Latest patterns for environment-specific configuration
2. **Zod Schema Validation**: Best practices for runtime validation
3. **NestJS Testing**: Latest testing patterns for services with dependencies
4. **TypeScript Configuration**: Advanced type patterns for configuration interfaces

## Testing Strategy and Test Cases

### Unit Tests (MqttTopicsService)
```typescript
describe('MqttTopicsService', () => {
  describe('getCommandTopic', () => {
    it('should generate power command topic');
    it('should generate temperature command topic');
    it('should handle invalid command gracefully');
    it('should substitute deviceId placeholder correctly');
  });

  describe('getStateTopics', () => {
    it('should return all state topics for device');
    it('should handle empty deviceId');
    it('should generate unique topics');
  });

  describe('validation', () => {
    it('should validate required placeholders');
    it('should detect invalid patterns');
    it('should provide clear error messages');
  });
});
```

### Integration Tests
```typescript
describe('MQTT Topics Integration', () => {
  it('should integrate with AirConditionerStrategy');
  it('should load configuration from different environments');
  it('should validate configuration at startup');
  it('should handle MQTT publishing with generated topics');
});
```

### End-to-End Tests
```typescript
describe('MQTT Topics E2E', () => {
  it('should maintain existing AC functionality');
  it('should support environment-specific topics');
  it('should handle configuration errors gracefully');
});
```

## Deployment Considerations

### Environment Configuration
- Development: Uses `mitsubishi2mqtt-dev` base topic
- Staging: Uses `mitsubishi2mqtt-staging` base topic
- Production: Uses `mitsubishi2mqtt-prod` base topic

### Migration Strategy
1. **Zero-Downtime Deployment**: Configuration changes only, no database changes
2. **Rollback Plan**: Keep original patterns as defaults
3. **Monitoring**: Add logging for topic generation debugging
4. **Validation**: Configuration validation prevents bad deployments

### Configuration Management
- Environment variables for override capability
- Configuration schema validation at startup
- Clear error messages for invalid configurations

## Rollback Plan

### Immediate Rollback (< 5 minutes)
1. Revert AirConditionerStrategy to use hardcoded topics
2. Remove MqttTopicsService from module providers
3. Restart application

### Full Rollback (< 15 minutes)
1. Revert all changed files from git
2. Clear any cached configuration
3. Restart all services
4. Verify MQTT communication working

## Risk Mitigation Strategies

### Technical Risks
- **Breaking Changes**: Maintain backward compatibility with default patterns
- **Performance Impact**: Benchmark topic generation performance
- **Configuration Errors**: Validate at startup with clear error messages

### Operational Risks
- **Deployment Issues**: Test in staging environment first
- **Environment Conflicts**: Use environment-specific base topics
- **Monitoring Gaps**: Add comprehensive logging for debugging

### Mitigation Actions
1. **Comprehensive Testing**: Unit, integration, and E2E tests
2. **Gradual Rollout**: Deploy to development → staging → production
3. **Monitoring**: Enhanced logging and error tracking
4. **Documentation**: Clear configuration and troubleshooting guides

## Resource and Time Estimates

### Development Resources
- **Backend Developer**: 1 full-time developer
- **QA Engineer**: 0.5 FTE for testing
- **DevOps Engineer**: 0.25 FTE for deployment support

### Time Estimates (Total: 3 weeks)
- **Week 1**: Infrastructure implementation and testing
- **Week 2**: Strategy integration and configuration
- **Week 3**: Comprehensive testing, documentation, and deployment

### Success Metrics
- **Zero Breaking Changes**: All existing functionality preserved
- **100% Test Coverage**: New components fully tested
- **<1ms Topic Generation**: Performance targets met
- **Clean Code Standards**: All code reviews passed
- **Documentation Complete**: User and developer documentation updated

## Feedback Checkpoints and Review Criteria

### Phase 1 Review (After Milestone 1)
**Criteria**:
- [ ] MqttTopicsService fully implemented
- [ ] All unit tests passing
- [ ] Configuration interfaces complete
- [ ] Code review passed

### Phase 2 Review (After Milestone 2)
**Criteria**:
- [ ] AirConditionerStrategy fully refactored
- [ ] No hardcoded topics remaining
- [ ] Integration tests passing
- [ ] Existing functionality verified

### Final Review (After Milestone 4)
**Criteria**:
- [ ] All tests passing with >95% coverage
- [ ] Documentation complete and accurate
- [ ] Performance benchmarks met
- [ ] Ready for production deployment

### Review Process
1. **Code Review**: Peer review of all changes
2. **Architecture Review**: Validate clean code principles
3. **Testing Review**: Ensure comprehensive test coverage
4. **Documentation Review**: Verify accuracy and completeness
5. **Security Review**: Confirm no security implications

This implementation plan provides a structured approach to implementing the MQTT topics configuration system while ensuring code quality, maintainability, and zero disruption to existing functionality.