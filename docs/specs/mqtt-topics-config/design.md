# MQTT Topics Configuration Management - Technical Design

## System Architecture and Component Design

### Architecture Overview

This design implements a configuration-driven MQTT topic management system that separates topic generation concerns from device business logic while following NestJS best practices and clean code principles.

### Clean Code Principles Analysis

**DRY (Don't Repeat Yourself):**
- **Current Issue**: MQTT topic strings like `mitsubishi2mqtt/${context.roomId}/mode/set` are duplicated across multiple methods in AirConditionerStrategy
- **Solution**: Single source of truth in configuration + centralized topic service eliminates duplication

**SOLID Principles Application:**
- **SRP (Single Responsibility)**: MqttTopicsService handles only topic generation and validation, AirConditionerStrategy handles only device business logic
- **OCP (Open/Closed)**: Easy to extend topic patterns without modifying strategy implementation
- **LSP (Liskov Substitution)**: Topic service interface allows for different implementations while maintaining contract
- **ISP (Interface Segregation)**: Separate interfaces for topic generation vs validation vs configuration
- **DIP (Dependency Inversion)**: Strategy depends on MqttTopicsService abstraction, not concrete topic strings

**YAGNI (You Ain't Gonna Need It):**
- Avoid over-engineering with complex topic inheritance hierarchies
- Simple placeholder substitution sufficient for current Mitsubishi AC requirements
- Focus on immediate needs while allowing future extensibility

### Design Pattern Analysis

**Pattern Evaluation Matrix:**

| Pattern | Pros | Cons | Use Case Fit |
|---------|------|------|--------------|
| **Configuration Service** | ✅ Simple, maintainable<br/>✅ Leverages NestJS ConfigService<br/>✅ Environment support<br/>✅ Easy to test | ❌ Less flexible than builder | ⭐⭐⭐⭐⭐ |
| **Factory Pattern** | ✅ Control over object creation<br/>✅ Type safety | ❌ More complex<br/>❌ Over-engineering for current needs | ⭐⭐⭐ |
| **Builder Pattern** | ✅ Fluent API<br/>✅ Complex topic assembly | ❌ Too complex for simple substitution<br/>❌ Steeper learning curve | ⭐⭐ |
| **Template Method** | ✅ Consistent patterns<br/>✅ Code reuse | ❌ Rigidity<br/>❌ Not needed for simple case | ⭐⭐⭐ |

**Selected Pattern**: **Configuration Service Pattern**
- Best balance of simplicity and functionality
- Aligns with existing project patterns
- Sufficient for current requirements while allowing future growth

### NestJS Implementation Research & Comparison

**Approach 1: ConfigService + Constants (RECOMMENDED)**
```typescript
// Load topics from ConfigService, fallback to constants
@Injectable()
export class MqttTopicsService {
  constructor(private configService: ConfigService) {}
  getCommandTopic(deviceId: string, command: string): string {
    const patterns = this.configService.get('mqtt.topics') || DEFAULT_TOPICS;
    return patterns.base + '/' + patterns.commands[command].replace('{deviceId}', deviceId);
  }
}
```
- **Performance**: High (5/5) - Simple object access
- **Maintainability**: High (5/5) - Clear separation, easy to modify
- **Testability**: High (5/5) - Easy to mock ConfigService
- **Complexity**: Low (2/5) - Minimal code, straightforward
- **NestJS Convention**: High (4/5) - Uses ConfigService properly
- **Project Context Fit**: High (5/5) - Follows existing patterns

**Approach 2: Dedicated Service with Factory**
```typescript
@Injectable()
export class MqttTopicsService {
  createTopicBuilder(deviceId: string): TopicBuilder {
    return new TopicBuilder(deviceId, this.patterns);
  }
}
```
- **Performance**: Medium (4/5) - Additional object creation
- **Maintainability**: Medium (4/5) - More indirection
- **Testability**: High (5/5) - Mockable components
- **Complexity**: Medium (3/5) - Additional abstractions
- **NestJS Convention**: High (5/5) - Proper DI patterns
- **Project Context Fit**: Medium (4/5) - More complex than needed

**Approach 3: Module-based Configuration**
```typescript
@Module({
  providers: [
    MqttTopicsService,
    { provide: MQTT_TOPIC_PATTERNS, useFactory: loadTopicPatterns }
  ]
})
export class MqttTopicsModule {}
```
- **Performance**: Medium (4/5) - Module loading overhead
- **Maintainability**: Medium (4/5) - More files to manage
- **Testability**: Medium (4/5) - Module testing complexity
- **Complexity**: High (4/5) - Module management
- **NestJS Convention**: High (5/5) - Most NestJS-idiomatic
- **Project Context Fit**: Low (3/5) - Overkill for current needs

### Decision Rationale

**Chosen Approach**: ConfigService + Constants (Score: 26/30)

**Why this approach:**
1. **Best Performance**: Simple object property access
2. **Highest Maintainability**: Clear separation of concerns
3. **Easiest Testing**: Straightforward mocking of ConfigService
4. **Lowest Complexity**: Minimal code and indirection
5. **Good NestJS Fit**: Proper use of ConfigService
6. **Perfect Project Context**: Follows existing patterns

**Rejected Alternatives:**
- **Factory Pattern**: Unnecessary complexity for simple placeholder substitution
- **Module-based**: Over-engineering for current requirements
- **Builder Pattern**: Too complex for the current use case

### Component Design

#### 1. Configuration Interface Design

```typescript
export interface MqttTopicPatterns {
  baseTopic: string;
  commands: {
    [key: string]: string; // pattern with {deviceId} placeholder
  };
  state: {
    [key: string]: string; // pattern with {deviceId} placeholder
  };
  validation?: {
    requiredPlaceholders: string[];
    maxLength: number;
    allowedCharacters: RegExp;
  };
}
```

#### 2. Service Architecture

```typescript
@Injectable()
export class MqttTopicsService {
  private readonly patterns: MqttTopicPatterns;

  constructor(private readonly configService: ConfigService) {
    this.patterns = this.loadAndValidatePatterns();
  }

  // Core topic generation methods
  getCommandTopic(deviceId: string, command: string): string
  getStateTopics(deviceId: string): string[]
  getAllTopics(deviceId: string): string[]

  // Validation methods
  validatePatterns(): void
  validateTopic(topic: string): boolean
}
```

#### 3. Constants Definition

```typescript
export const DEFAULT_MQTT_TOPICS: MqttTopicPatterns = {
  baseTopic: 'mitsubishi2mqtt',
  commands: {
    power: '{deviceId}/mode/set',
    temperature: '{deviceId}/temp/set',
    mode: '{deviceId}/mode/set',
    fan: '{deviceId}/fan/set',
    vane: '{deviceId}/vane/set',
    wideVane: '{deviceId}/wideVane/set',
  },
  state: {
    current: '{deviceId}/state',
    settings: '{deviceId}/settings',
  },
};
```

### Architecture Quality Assessment

**Cohesion Analysis**:
- **High**: MqttTopicsService focuses solely on topic management
- **Clear boundaries**: Single responsibility for all topic-related operations

**Coupling Analysis**:
- **Low**: Depends only on ConfigService and TypeScript interfaces
- **Loose coupling**: Easy to mock and test independently

**Separation of Concerns**:
- **Excellent**: Topic logic separated from device business logic
- **Clean interfaces**: Well-defined contracts between components

**Dependency Direction**:
```
AirConditionerStrategy → depends on → MqttTopicsService (abstraction)
                           ↓
                   ConfigService (NestJS infrastructure)
```

### API Specifications and Data Models

#### Service Interface

```typescript
interface IMqttTopicsService {
  getCommandTopic(deviceId: string, command: string): string;
  getStateTopics(deviceId: string): string[];
  getAllTopics(deviceId: string): string[];
  validatePatterns(): void;
  getPatterns(): MqttTopicPatterns;
}
```

#### Configuration Schema (Zod)

```typescript
const mqttTopicsConfigSchema = z.object({
  baseTopic: z.string().min(1),
  commands: z.record(z.string().regex(/\{deviceId\}/)),
  state: z.record(z.string().regex(/\{deviceId\}/)),
});
```

### Database Schema Changes

**No database changes required** - This is purely a backend refactoring that doesn't affect data persistence.

### Frontend Component Structure

**No frontend changes required** - This change is entirely backend-internal and doesn't affect WebSocket API contracts.

### Backend Service Design

#### Updated AirConditionerStrategy Integration

```typescript
@Injectable()
export class AirConditionerStrategy implements IDeviceStrategy {
  constructor(
    private readonly mqttService: MqttService,
    private readonly messageValidator: MessageValidatorService,
    private readonly streamingService: StreamingService,
    private readonly mqttTopics: MqttTopicsService, // ✅ New dependency
  ) {}

  private async handleSetPower(...): Promise<DeviceCommandResponse> {
    const topic = this.mqttTopics.getCommandTopic(context.roomId, 'power');
    await this.mqttService.publish(topic, payload);
    // ... rest of implementation
  }

  private subscribeToDeviceEvents(deviceId: string): void {
    const topics = this.mqttTopics.getStateTopics(deviceId);
    topics.forEach(topic => this.mqttService.subscribe(topic));
    // ... rest of implementation
  }
}
```

#### Module Updates

```typescript
// devices/devices.module.ts
@Module({
  imports: [ConfigModule],
  providers: [
    AirConditionerStrategy,
    MqttTopicsService, // ✅ Add new service
    // ... other providers
  ],
})
export class DevicesModule {}
```

### MQTT Message Flows

**Unchanged MQTT message flows** - The actual MQTT communication remains identical, only topic generation is externalized.

#### Command Flow
1. Client sends WebSocket command
2. AirConditionerStrategy processes command
3. **NEW**: Strategy requests topic from MqttTopicsService
4. MQTT message published to generated topic
5. Device receives command (unchanged)

#### State Flow
1. Device publishes state to MQTT
2. **NEW**: Strategy subscribes to topics from MqttTopicsService
3. State updates processed (unchanged)

### Security Considerations

**No new security implications** - Topic patterns are configuration-only and don't introduce new attack surfaces. Existing MQTT authentication and authorization remain unchanged.

### Performance Requirements

**Target Performance**:
- Topic generation: <1ms per topic
- Configuration loading: <10ms at startup
- Memory overhead: <1KB for configuration
- Zero runtime overhead for existing operations

**Implementation Strategy**:
- Pre-compile topic patterns at startup
- Cache generated topics where appropriate
- Avoid string manipulation in hot paths

### Integration Patterns

#### Error Handling Integration
```typescript
// Validate patterns at startup
try {
  this.mqttTopics.validatePatterns();
} catch (error) {
  throw new Error(`MQTT topics configuration invalid: ${error.message}`);
}
```

#### Logging Integration
```typescript
this.logger.log(`Loaded MQTT topics: ${JSON.stringify(this.patterns)}`);
this.logger.debug(`Generated topic for ${command}: ${topic}`);
```

#### Testing Integration
```typescript
// Easy mocking in tests
const mockMqttTopics = {
  getCommandTopic: jest.fn().mockReturnValue('test/topic'),
  getStateTopics: jest.fn().mockReturnValue(['test/state']),
};
```

### Architecture Assessment and Refactoring Recommendations

**Current Architecture Strengths:**
- Well-implemented strategy pattern
- Proper dependency injection
- Clear separation of concerns

**Identified Technical Debt:**
- Hardcoded topic strings in strategy
- Scattered topic knowledge
- No configuration validation

**Refactoring Benefits:**
- ✅ Eliminate code duplication
- ✅ Improve maintainability
- ✅ Enable environment-specific configuration
- ✅ Enhance testability
- ✅ Follow clean code principles
- ✅ Align with NestJS best practices

**Migration Strategy:**
1. Implement MqttTopicsService alongside existing code
2. Update AirConditionerStrategy to use new service
3. Remove hardcoded topic strings
4. Add configuration validation
5. Update tests to use new service

### Implementation Examples

#### Configuration Example (YAML)
```yaml
# config/development.yml
mqtt:
  topics:
    baseTopic: 'mitsubishi2mqtt-dev'
    commands:
      power: '{deviceId}/mode/set'
      temperature: '{deviceId}/temp/set'
    state:
      current: '{deviceId}/state'
      settings: '{deviceId}/settings'

# config/production.yml
mqtt:
  topics:
    baseTopic: 'mitsubishi2mqtt-prod'
    commands:
      power: '{deviceId}/control/power'
      temperature: '{deviceId}/control/temperature'
    state:
      current: '{deviceId}/status/current'
      settings: '{deviceId}/status/settings'
```

#### Service Usage Example
```typescript
// In strategy
const powerTopic = this.mqttTopics.getCommandTopic(roomId, 'power');
// Returns: 'mitsubishi2mqtt/room123/mode/set' (development)
// Returns: 'mitsubishi2mqtt/room123/control/power' (production)

const stateTopics = this.mqttTopics.getStateTopics(roomId);
// Returns: ['mitsubishi2mqtt/room123/state', 'mitsubishi2mqtt/room123/settings']
```

#### Test Example
```typescript
describe('MqttTopicsService', () => {
  let service: MqttTopicsService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService.get.mockReturnValue(testConfig);
    service = new MqttTopicsService(mockConfigService);
  });

  it('should generate command topics correctly', () => {
    const topic = service.getCommandTopic('device123', 'power');
    expect(topic).toBe('mitsubishi2mqtt/device123/mode/set');
  });
});
```

This design provides a clean, maintainable, and extensible solution that follows all project standards while addressing the identified technical debt.