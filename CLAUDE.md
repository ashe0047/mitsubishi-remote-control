# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Mitsubishi Air Conditioner Remote Control** PWA built with Next.js 15 and React 19. The application provides a web-based interface to control Mitsubishi AC units via MQTT communication, designed to work with mitsubishi2mqtt bridge software.

## Development Commands

**Frontend** (from `/frontend`):
```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run linting
pnpm exec tsc --noEmit # Type checking
```

**Backend** (from `/backend`):
```bash
pnpm install          # Install dependencies
pnpm start:dev        # Start development server
pnpm start:dev:env    # Start with environment
pnpm build            # Build for production
pnpm start:prod       # Start production server
pnpm test             # Run tests
pnpm test:watch       # Run tests in watch mode
pnpm test:cov         # Run tests with coverage
pnpm test:e2e         # Run e2e tests
pnpm test:debug       # Run tests in debug mode
pnpm lint             # Run linting
pnpm format           # Format code

# Database commands
pnpm db:migrate               # Run database migrations
pnpm db:migrate:generate      # Generate new migration (use: npm run db:migrate:generate -- name=migration_name)
pnpm db:migrate:create        # Create blank migration file
pnpm db:migrate:revert        # Revert last migration
pnpm db:migrate:show          # Show migration status
pnpm db:migrate:drop          # Drop database schema
pnpm db:migrate:sync          # Sync database with entities
```

**Docker**:
```bash
docker-compose up --build  # From frontend directory
```

## Architecture Overview

### Core Technologies

**Frontend**: Next.js 15 + React 19, Zustand state management, MQTT.js + RxJS, Tailwind CSS + Radix UI, ShadcnUI components, PWA with Serwist

**Backend**: NestJS + TypeScript, TypeORM + PostgreSQL, Socket.IO WebSockets, Redis caching, MQTT integration, JWT authentication

### Key Architecture Patterns

**State Flow**: MQTT → RxJS observable → Zod validation → Zustand store → React Context → UI components

**Room-based Design**: All state and MQTT topics organized by `roomId` for multi-unit support

**WebSocket Namespaces**: Separate namespaces per feature (airconditioner, quota) with JWT authentication

**Module Structure**: Backend follows Entity → Repository → Service → Controller layering with DTO enforcement

**Environment Variables**: Frontend uses `NEXT_PUBLIC_*` for MQTT WebSocket connection, Backend uses standard env vars for database/Redis/MQTT/JWT

### MQTT Topics

Base pattern: `mitsubishi2mqtt/{room_id}`
- `/mode/set`, `/temp/set`, `/fan/set` - AC controls
- `/settings`, `/state` - Current AC data (inbound)
- All schemas validated with Zod in `lib/mqtt/mqtt-config.ts`

### Key Architectural Patterns

**Room-based Multi-Unit Architecture**:
- All state and MQTT topics organized by `roomId` for supporting multiple AC units
- Room configuration managed in `config/app-config.yaml`
- Frontend store patterns treat rooms as first-class entities with embedded devices

**Advanced State Management with Zustand v5**:
- **CRITICAL**: Always use specific selectors, never entire store object to avoid infinite loops
- Sophisticated caching with TTL, LRU eviction, and persistence
- Request deduplication and optimistic updates for better UX
- Background refresh and stale-while-revalidate strategies
- Example: `const value = useStore(store, (state) => state.value)`

**TypeScript-First Development**:
- Extensive use of Zod for runtime validation with type inference
- Strict typing throughout the stack with no `any` types
- Generic type aliases for better type safety (e.g., `type UserRepository = Repository<User>`)
- Compile-time and runtime validation alignment

**Real-time Communication Patterns**:
- MQTT integration with RxJS observables for reactive data streams
- WebSocket namespaces with Socket.IO for different features
- Automatic reconnection and error handling
- Message validation before state updates

## Clean Code Standards

### Core Principles

**DRY**: Eliminate code duplication through reusable functions, components, and configuration

**SOLID**:
- SRP: Single responsibility per class/function
- OCP: Open for extension, closed for modification
- LSP: Subtypes must be substitutable
- ISP: Focused, client-specific interfaces
- DIP: Depend on abstractions, not concretions

**YAGNI**: Implement only current requirements, avoid over-engineering

### Key Patterns

**Frontend**: Observer (MQTT), Strategy (validation), Provider (React Context), Hook patterns

**Backend**: Repository (data access), Service Layer (business logic), Gateway (WebSockets), Guard (auth), Module organization

### Code Standards

**Functions**: <20 lines, pure when possible, clear naming, max 3-4 parameters

**Classes**: Single responsibility, <200 lines, composition over inheritance

**Error Handling**: Fail fast, explicit error types, structured logging, error boundaries

### Critical Development Rules

**1. No New Files Without Approval**: Stop and ask before creating any new files/modules

**2. In-Place Edits Only**: Use diff/patch mode, preserve file structure

**3. New Abstractions Need Justification**: Document why needed, wait for approval

**4. Naming Discipline**: Use canonical names consistent with architecture (no `Enhanced*`, `*V2`, etc.)

**5. No Code Duplication**: Remove original code when refactoring, update all references

**6. Validate After Every Change**: Type check → Lint → Test → Build (stop if any fail)

**7. Minimal Changes**: Surgical refactoring over large rewrites

**8. Explain Before Major Changes**: Provide plan/justification, wait for approval

**9. Preserve Architecture**: Maintain Zustand → MQTT → React Context patterns, NestJS module structure

## Code Quality Standards

### TypeScript Rules

**Core Principles**: Explicit types, avoid `any`, strict mode enabled, proper null handling

**Functions**: Always specify parameter and return types, use generics with constraints

**Zod Integration**: Use Zod schemas for runtime validation with type inference

**Package Generic Types**: ALWAYS create specific type aliases (e.g., `type UserRepository = Repository<User>`)

### Frontend Standards

**State Management**: Zustand v5 - CRITICAL: Always use specific selectors, never entire store object
```typescript
// ✅ Correct
const value = useStore(store, (state) => state.value);
// ❌ Wrong - causes infinite loops
const data = useStore(store);
```

**Styling**: ShadcnUI + Radix UI + Tailwind CSS
- Import from `@/components/ui/*`
- Mobile-first responsive design
- Minimum 44px touch targets
- Semantic colors for dark/light themes

**Components**: Functional with hooks, proper TypeScript, accessibility (ARIA)

### Backend NestJS Standards

**Module Structure**: Entity → Repository → Service → Controller (mandatory layering)

**Infrastructure Separation Architecture**: Separate shared infrastructure from domain-specific logic

**General Principle**: Create clear boundaries between reusable infrastructure components and domain-specific business logic.

## Project Structuring Guidelines: Common vs Shared Folders

### **Conceptual Difference**

| Folder | Purpose | Scope | Typical Contents |
| :--- | :--- | :--- | :--- |
| **`common/`** | Foundational utilities used everywhere (no NestJS context needed) | Framework-agnostic or globally reusable | constants, interfaces, pure functions, filters, interceptors, decorators |
| **`shared/`** | Reusable NestJS modules/services imported across multiple features | Framework-aware (NestJS context) | Shared Nest modules (AuthModule, LoggerModule, ConfigModule wrappers) |

### **Mental Model (Layered View)**

```
src/
├── common/     # Pure code, no NestJS dependency
│   ├── constants/
│   ├── utils/
│   └── decorators/
│
├── shared/     # NestJS-aware, reusable modules/providers
│   ├── database/
│   ├── logger/
│   └── config/
│
├── features/   # Domain modules (devices, quotas, auth)
│   ├── devices/
│   ├── quotas/
│   └── auth/
│
└── app.module.ts
```

### **`common/` Folder (Foundation Layer)**

**Purpose**: Low-level utilities that don't depend on NestJS DI or lifecycle.

**✅ Examples**:
```
src/
  common/
    constants/
      app.constants.ts
      mqtt-topics.constants.ts
      error-codes.constants.ts
    decorators/
      public.decorator.ts
      roles.decorator.ts
    exceptions/
      app-error.ts
      http-exception.filter.ts
      error-codes.constant.ts
      error.util.ts
    interceptors/
      logging.interceptor.ts
      timeout.interceptor.ts
    utils/
      date.util.ts
      string.util.ts
      validation.util.ts
    types/
      pagination-options.interface.ts
      device-state.interface.ts
```

**Characteristics**:
- ✅ Stateless utilities
- ✅ Custom decorators or filters
- ✅ Enums, constants
- ✅ Helper functions
- ✅ Interfaces/DTOs not tied to one domain

### **`shared/` Folder (Reusable Modules Layer)**

**Purpose**: NestJS modules/services that depend on DI and are meant to be imported by other modules.

**✅ Examples**:
```
src/
  shared/
    database/
      database.module.ts
      base.repository.ts
      connection.service.ts
    websocket-gateway/
      websocket-gateway.module.ts
      base.gateway.ts
      gateway.decorators.ts
    mqtt/
      mqtt.module.ts
      base.client.ts
      message-validator.ts
    logger/
      logger.module.ts
      logger.service.ts
    config/
      config.module.ts
      config.service.ts
    auth/
      auth.module.ts
      jwt.service.ts
```

**Characteristics**:
- ✅ Reusable Nest modules (database, logger, config)
- ✅ Framework-aware services
- ✅ Adapters or integration points (MQTT clients, HTTP clients)
- ✅ Providers that other feature modules import

### **Rule of Thumb**

> **If it uses `@Module()`, `@Injectable()`, or `@Controller()`, it belongs in `shared/`.**
> **Otherwise, it belongs in `common/`.**

### **Error Module Example**

| Concern | Folder | Description |
| :--- | :--- | :--- |
| Exception filters, constants, custom error types | **`common/exceptions/`** | Lightweight, framework-agnostic |
| Centralized error handling/reporting service | **`shared/error/`** | NestJS-aware, injectable module |

### **Usage Example**

```typescript
// devices/device.module.ts
import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { LoggerModule } from '@/shared/logger/logger.module';
import { BaseRepository } from '@/shared/database/base.repository';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ValidationPipe } from '@/common/pipes/validation.pipe';

@Module({
  imports: [LoggerModule],
  providers: [DeviceService, BaseRepository, RolesGuard],
  controllers: [DeviceController],
})
export class DeviceModule {}
```

Here:
- `LoggerModule` → from **shared**
- `BaseRepository` → from **shared**
- `RolesGuard` → from **common**
- `ValidationPipe` → from **common**

**Structure Pattern**:
```
├── src/shared/[infrastructure-type]/     # Infrastructure layer
│   ├── base/[component-type].ts
│   ├── decorators/
│   ├── interfaces/
│   ├── services/
│   └── [infrastructure-type].module.ts
├── src/[domain-name]/                    # Domain layer
│   ├── [domain].[component].ts          # Domain-specific implementation
│   ├── strategies/
│   └── [domain].module.ts
```

**Architectural Principles Applied**:

1. **Separation of Concerns (SoC)**
   - Infrastructure Layer: Reusable functionality, decorators, common services, base classes
   - Domain Layer: Business logic specific to each domain, domain-specific strategies

2. **Single Responsibility Principle (SRP)**
   - Infrastructure modules manage only their technical concern (WebSocket, Database, etc.)
   - Domain modules handle only their business logic
   - Each module has one clear reason to change

3. **Dependency Inversion Principle (DIP)**
   ```
   Domain Modules → depend on → Shared Infrastructure Abstractions
           ↑                              ↓
   Business Logic           Interfaces/Base Classes
   ```

4. **Reusability & Maintainability**
   - Shared Infrastructure: Consumed by multiple domain modules
   - Domain Isolation: Changes in one domain don't affect others
   - Testing: Mock infrastructure separately from domain logic

**Applicable Infrastructure Types**:
- **WebSocket Gateways**: Base gateway, decorators, authentication middleware
- **Database**: Base repositories, common queries, connection management
- **HTTP Controllers**: Base controllers, common middleware, response formatting
- **Authentication**: JWT strategies, guards, user validation
- **External Services**: Base clients, error handling, retry logic
- **Caching**: Cache managers, key strategies, invalidation patterns

**Module Dependency Rules**:
- Domain modules can import shared infrastructure modules
- Infrastructure modules should never import specific domain modules
- Use dependency injection to bridge infrastructure abstractions to domain implementations

**DTO Enforcement**: Always use DTOs for ALL request and response data, never expose entities directly
- **Request DTOs**: Validate and transform incoming API requests
- **Response DTOs**: Shape and sanitize outgoing API responses
- **Layer Boundaries**: Use DTOs between Controller ↔ Service ↔ Repository layers
- **Type Safety**: DTOs provide runtime validation with TypeScript type inference

**Dependency Injection**: Constructor injection with TypeScript shorthand

**File Organization**: Single file per layer for simple features, folders for complex ones

### Naming Conventions
- **React**: PascalCase (`AirConRemote.tsx`)
- **Hooks/Utils**: camelCase (`useAircon.ts`)
- **NestJS**: PascalCase with suffix (`UsersController.ts`, `CreateUserDto.ts`)
- **Entities**: PascalCase (`User.ts`)

#### **Generalized Naming Rules**
- **No Descriptive Prefixes**: Avoid architectural state words like "Unified", "Shared", "Common", "Base" in names
  - ❌ `UnifiedDeviceGateway`, `SharedWebSocketService`, `CommonWebSocketsModule`
  - ✅ `DeviceGateway`, `WebSocketService`, `WebSocketsModule`
- **Direct Naming**: Names should describe WHAT something IS, not its architectural state or relationships
  - ❌ `AuthenticationService` (describes purpose, not entity)
  - ✅ `AuthService` (describes the entity)
- **No Version Suffixes**: Avoid `V2`, `Enhanced`, `Improved` or similar version indicators
  - ❌ `UserRepositoryV2`, `EnhancedCacheService`
  - ✅ `UserRepository`, `CacheService` (refactor instead of versioning)
- **No Redundant Words**: Remove unnecessary context that's implied by the module structure
  - ❌ `WebSocketGatewayService` (gateway implies service)
  - ✅ `WebSocketGateway` (clear purpose)
- **Functional Names**: Use action-oriented names for methods and verb-oriented names for commands
  - ✅ `authenticateUser()`, `processCommand()`, `validateInput()`

## Development Process

This project follows a **spec-driven development** approach for all new features and tasks. For each feature/task, create a dedicated subfolder named after the feature and generate three steering documents in sequence:

### Spec-Driven Development Workflow

**1. Create Feature Directory Structure:**
```
docs/specs/[feature-name]/
├── spec.md           # Requirements specification
├── design.md         # Technical design document
└── implementation.md # Implementation plan
```

**2. Document Generation Sequence:**

**Step 1: Requirements Specification (`spec.md`)**
- **Purpose**: Define WHAT needs to be built and WHY
- **Content Standards**:
  - Business requirements and user stories
  - Functional and non-functional requirements
  - Acceptance criteria
  - Success metrics
  - Constraints and assumptions
  - Dependencies and integration points

**Step 2: Technical Design (`design.md`)**
- **Purpose**: Define HOW the feature will be architected
- **REQUIRED TOOL**: Must use `mcp__sequential-thinking__sequentialthinking` tool to plan and design architecture
- **Content Standards**:
  - System architecture and component design (using sequential thinking analysis)
  - **Clean Code Principles Analysis**:
    - **DRY (Don't Repeat Yourself)**: Identify and eliminate code duplication opportunities
    - **SOLID Principles**: Apply Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
    - **YAGNI (You Ain't Gonna Need It)**: Avoid over-engineering and premature optimization
  - **Design Pattern Analysis**:
    - Evaluate applicable design patterns (Strategy, Observer, Factory, Adapter, etc.)
    - Perform trade-off analysis between different architectural approaches
    - Justify pattern selection with pros/cons and use case alignment
    - Consider maintainability, testability, and scalability implications
  - **NestJS Implementation Research & Comparison**:
    - **RESEARCH MULTIPLE APPROACHES**: For each technical decision, research 2-3 different NestJS implementation methods
    - **Compare Implementation Patterns**:
      - Entity vs. Repository vs. Service approaches
      - Guards vs. Interceptors vs. Middleware for cross-cutting concerns
      - Providers vs. Factories vs. Direct instantiation
      - Module-based vs. Feature-based organization
      - Sync vs. Async configuration patterns
    - **Trade-off Analysis Matrix**: Document pros/cons of each approach:
      ```
      Approach          | Performance | Maintainability | Testability | Complexity | Use Case Fit
      ------------------|-------------|----------------|------------|------------|-------------
      Repository Pattern | High        | High           | High       | Medium     | Complex queries
      Active Record     | Medium      | Medium         | Low        | Low        | Simple CRUD
      Custom Provider   | High        | Medium         | High       | High       | Specialized logic
      ```
    - **Decision Rationale**: Document WHY specific approaches were chosen over alternatives
    - **Implementation Examples**: Include code snippets demonstrating chosen patterns
  - **Architecture Quality Assessment**:
    - Cohesion and coupling analysis
    - Separation of concerns validation
    - Dependency direction and abstraction levels
    - Interface design and contract definition
  - API specifications and data models
  - Database schema changes
  - Frontend component structure
  - Backend service design
  - MQTT message flows (if applicable)
  - Security considerations
  - Performance requirements
  - Integration patterns
  - Architecture assessment and refactoring recommendations

**Step 3: Implementation Plan (`implementation.md`)**
- **Purpose**: Define the step-by-step execution plan
- **REQUIRED TOOLS DURING EXECUTION**:
  - `mcp__context7__resolve-library-id` and `mcp__context7__get-library-docs` for latest package documentation
  - `mcp__mcp-feedback-enhanced__interactive_feedback` after each implementation phase
- **Content Standards**:
  - Task breakdown and sequencing
  - Development phases and milestones
  - File and component creation plan
  - **NestJS Implementation Strategy Documentation**:
    - **Chosen Approaches**: Document the specific NestJS patterns selected during design phase
    - **Rejected Alternatives**: List other approaches considered and reasons for rejection
    - **Implementation Examples**: Include concrete code examples of chosen patterns
    - **Integration Points**: How chosen patterns integrate with existing codebase
    - **Migration Strategy**: If replacing existing patterns, document transition plan
  - **Clean Code Implementation Checklist**:
    - Code duplication elimination strategy (DRY)
    - Single responsibility validation for each class/component
    - Interface segregation and dependency injection points
    - Refactoring opportunities and technical debt reduction
    - Code review criteria based on clean code principles
    - NestJS convention adherence validation
  - Package/framework documentation requirements (Context7 queries needed)
  - Testing strategy and test cases
  - Deployment considerations
  - Rollback plan
  - Risk mitigation strategies
  - Resource and time estimates
  - Feedback checkpoints and review criteria

**3. Development Rules:**
- **Sequential Generation**: Each document must be completed and approved before proceeding to the next
- **Validation**: Each document should reference and validate against its predecessor
- **Traceability**: Implementation must be traceable back to design, design to spec
- **Living Documents**: Update documents as requirements evolve during development

**4. NestJS Decision-Making Criteria**
- **RESEARCH REQUIREMENT**: For every technical decision, research and compare 2-3 different NestJS approaches
- **Evaluation Matrix**: Score each approach (1-5) across:
  - **Performance**: Runtime efficiency, memory usage, scalability
  - **Maintainability**: Code clarity, ease of modification, debugging
  - **Testability**: Unit test simplicity, mocking capabilities
  - **Complexity**: Learning curve, implementation difficulty
  - **NestJS Convention Alignment**: How well it follows NestJS idioms
  - **Project Context Fit**: Alignment with existing codebase patterns
- **Decision Threshold**: Choose approach with highest composite score (minimum 3.5/5 average)
- **Documentation**: Document the complete decision process in design.md with rationale

**6. NestJS Decision-Making Example (Quota Override Entity)**

*Example of how to apply this process to a real feature:*

**Research Question**: How should we implement quota override functionality in NestJS?

**Approaches Compared**:
1. **Entity with Domain Methods** (Current Implementation)
2. **Service with Separate State Machine**
3. **Command Pattern with Handlers**

**Evaluation Matrix**:
```
Approach                      | Performance | Maintainability | Testability | Complexity | Convention | Project Fit | Total
------------------------------|-------------|----------------|------------|------------|------------|-------------|-------
Entity with Domain Methods    | 5           | 4              | 5          | 3          | 4          | 5           | 30/35
Service with State Machine     | 4           | 3              | 4          | 4          | 3          | 3           | 25/35
Command Pattern with Handlers  | 3           | 4              | 4          | 5          | 5          | 4           | 28/35
```

**Decision Rationale**:
- **Chosen**: Entity with Domain Methods (Score: 30/35)
- **Why**: Best performance, excellent testability, fits existing entity patterns
- **Trade-offs**: Slightly more complex than simple CRUD, but worth it for business logic encapsulation
- **Rejected Alternatives**: Service approach would scatter logic, Command pattern over-engineered for this use case

**Implementation Examples**:
```typescript
// ✅ Chosen: Entity with domain methods
@Entity('quota_overrides')
export class QuotaOverride {
  approve(approvedByUserId: string): void {
    this.status = OverrideStatus.APPROVED;
    this.approvedByUserId = approvedByUserId;
    this.approvedAt = new Date();
    this.isActive = true;
    this.activatedAt = new Date();
  }

  get isValid(): boolean {
    return this.isApproved && this.isActive && !this.isExpired;
  }
}

// ❌ Rejected: Service with scattered state
@Injectable()
export class QuotaOverrideService {
  approve(override: QuotaOverride, userId: string) {
    // Logic scattered across service methods
  }
}
```

**5. Mandatory Tool Usage:**
- **Design Phase**: ALWAYS use sequential thinking tool for architecture planning and design patterns
  - **Must include**: Clean code principles analysis (DRY, SOLID, YAGNI)
  - **Must include**: Design pattern evaluation with trade-off analysis
  - **Must include**: Architecture quality assessment (cohesion, coupling, separation of concerns)
  - **Must include**: NestJS implementation research with multiple approaches compared
- **Architecture Assessment**: Before fitting new features, evaluate and refactor existing architecture if needed
  - **Focus on**: Identifying code duplication and architectural debt
  - **Analyze**: Current architecture adherence to SOLID principles
  - **Recommend**: Refactoring opportunities to improve maintainability
- **Implementation Phase**: ALWAYS use Context7 tools to fetch latest documentation for relevant packages/frameworks
  - **Validate**: Implementation follows clean code standards
  - **Review**: Code organization and design pattern application
  - **Confirm**: Chosen NestJS approaches are properly implemented
- **After Each Implementation Step**: ALWAYS use feedback tool to provide implementation summary and wait for approval before proceeding
  - **Include**: Clean code compliance assessment
  - **Include**: Validation that chosen NestJS patterns are correctly applied
  - **Highlight**: Any technical debt introduced and mitigation plan
- **Documentation Currency**: Ensure all implementations use the most up-to-date package instructions via Context7

## Development Guidelines

### Adding New Rooms
1. Update `config/app-config.yaml` with new room entry
2. MQTT topics will automatically be generated based on roomId
3. No code changes required - system is multi-room by design

### Extending AC Controls
1. Add new MQTT topics to `MQTT_TOPICS` in `mqtt-config.ts`
2. Define Zod validation schema in `mqttMessageSchemas`
3. Update TypeScript types (`AirConSettings`, `AirConState`)
4. Add UI controls in `AirConRemote.tsx` following ShadcnUI patterns
5. Update Zustand store methods if needed
6. Ensure mobile-responsive design with proper touch targets (min 44px)
7. Test with both light and dark themes

### Working with MQTT Client
- MQTT client initialization happens in `lib/mqtt/mqtt-client.ts`
- Uses RxJS to create observable streams from MQTT events
- Client instance is managed in React Context via `AirconProvider`
- Connection status is tracked in Zustand store

### Room Store Architecture (Frontend)
The application uses a sophisticated Zustand store (`src/stores/room-store.ts`) that implements:
- **Multi-room Management**: Rooms are first-class entities with embedded devices
- **Advanced Caching**: TTL-based caching with LRU eviction and persistence
- **Optimistic Updates**: Immediate UI updates with rollback on failures
- **Request Deduplication**: Prevents duplicate API calls for the same data
- **Background Refresh**: Automatic data refresh for stale entries
- **Performance Monitoring**: Built-in metrics for cache hit rates and response times

**Key Store Patterns**:
- Always use selectors: `useRoomStore(store, (state) => state.rooms)`
- Store methods handle both local state updates and API calls
- Automatic cache invalidation and revalidation
- Computed selectors for derived data (active rooms, device counts, etc.)

## Debugging & Troubleshooting

### Common Issues and Solutions

**MQTT Connection Problems**:
```bash
# Check MQTT broker is running
telnet localhost 1883

# Check WebSocket connection (for frontend)
telnet localhost 9001

# Verify environment variables
echo $NEXT_PUBLIC_MQTT_BROKER_URL
```

**Frontend Issues**:
- **Hot Reload Not Working**: Restart Next.js dev server (`pnpm dev`)
- **Type Errors**: Run type checking (`pnpm type-check`)
- **State Not Updating**: Check Zustand store in React DevTools
- **MQTT Messages Not Received**: Verify topic subscriptions in browser console
- **"Maximum update depth exceeded" Error**: This is a **Zustand v5 infinite loop** issue
  - **Root Cause**: Using `useStore(store)` without selector creates unstable references
  - **Fix**: Always use `useStore(store, (state) => state.property)` with specific selectors
  - **Check**: Look for `useEffect` dependencies with entire store objects

**Backend Issues**:
- **NestJS Won't Start**: Check configuration files and port conflicts
- **Build Fails**: Run `pnpm install` to refresh dependencies
- **Tests Failing**: Run individual test files to isolate issues
- **Database Connection**: Check PostgreSQL is running and credentials are correct
- **Redis Connection**: Verify Redis server is accessible
- **MQTT Connection**: Ensure MQTT broker is running and accessible

**Backend Health Checks**:
- **Application Health**: `http://localhost:3000/api/health`
- **Database Health**: `http://localhost:3000/api/health/database`
- **Redis Health**: `http://localhost:3000/api/health/redis`
- **MQTT Health**: `http://localhost:3000/api/health/mqtt`
- **API Documentation**: `http://localhost:3000/api/docs` (Swagger UI - disabled in production)

**Development Tools**:
- **React DevTools**: Install browser extension for component inspection
- **MQTT Client**: Use tools like MQTT Explorer to monitor topics
- **Network Tab**: Monitor WebSocket connections in browser DevTools
- **NestJS DevTools**: Built-in debugging and hot reload in development mode
- **PostgreSQL Client**: Use pgAdmin or DBeaver for database inspection
- **Redis Client**: Use Redis CLI or GUI tools for cache inspection
- **API Testing**: Use tools like Postman or Insomnia for REST endpoint testing

### Logging and Monitoring

**Frontend Debugging**:
```javascript
// Enable MQTT debug logging
localStorage.setItem('debug', 'mqtt*');

// Zustand store debugging
console.log(useAirconStore.getState());
```

**Backend Debugging**:
```bash
# Enable debug logging in NestJS
NODE_ENV=development pnpm start:dev

# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/database
curl http://localhost:3000/health/redis
curl http://localhost:3000/health/mqtt

# View logs
pnpm start:dev 2>&1 | grep -E "(ERROR|WARN|DEBUG)"

# Test individual endpoints
curl http://localhost:3000/api/users
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/devices
```

## Important Implementation Details

- **Spec-Driven Process**: ALL new features must follow the spec → design → implementation document workflow
- **Room-based Architecture**: All state and MQTT topics are organized by `roomId`
- **Type Safety**: Extensive use of Zod for runtime validation of MQTT messages
- **PWA Features**: Configured as installable web app with offline support
- **Error Handling**: MQTT connection failures gracefully handled with reconnection
- **Development Hot Reload**: Full Next.js dev server with MQTT client persistence

When working on this codebase, always:
1. **Start with spec documentation** before any coding
2. **Use sequential thinking tool** during design phase for architecture planning
   - **Mandatory**: Include clean code principles analysis (DRY, SOLID, YAGNI)
   - **Mandatory**: Perform design pattern trade-off analysis
   - **Mandatory**: Assess architecture quality (cohesion, coupling, separation of concerns)
3. **Assess and refactor architecture** before implementing new features if current architecture is inadequate
   - **Focus**: Eliminate code duplication and architectural debt
   - **Validate**: SOLID principles adherence
   - **Optimize**: Component and module organization
4. **Use Context7 tools** during implementation to fetch latest package documentation
5. **Use feedback tool** after each implementation step to provide summary and wait for approval
   - **Include**: Clean code compliance assessment in every feedback summary
   - **Report**: Any technical debt and mitigation strategies
6. **Apply clean code standards** throughout implementation:
   - **DRY**: Eliminate duplication through reusable functions/components
   - **SRP**: Single responsibility for every class/component/function
   - **OCP**: Design for extension without modification
   - **LSP**: Maintain substitutability in inheritance hierarchies
   - **ISP**: Create focused, client-specific interfaces
   - **DIP**: Depend on abstractions, not concretions
   - **YAGNI**: Implement only current requirements, avoid speculation
7. **Backend NestJS Best Practices**:
   - **MANDATORY Module Structure**: Follow Entity → Repository → Service → Controller layering pattern
   - **File/Folder Convention**: Use single file when only one of each type is needed, use folder structure when multiple files required
   - **DTO Enforcement**: ALWAYS use DTOs between ALL layers to prevent domain model leakage (Controller ↔ Service ↔ Repository) - this applies to both request/response data and internal layer communication
   - Follow conventional module patterns (single responsibility, feature-based organization)
   - Use constructor injection with TypeScript shorthand syntax
   - Choose appropriate provider scopes (singleton default, request-scoped when needed)
   - Implement proper error handling with global exception filters
   - Use async configuration patterns with dependency injection
   - Write comprehensive tests with proper provider mocking
   - Follow security best practices (guards, validation, rate limiting)
8. **Frontend Patterns**:
   - **Follow Zustand v5 patterns** - NEVER access entire store object, always use specific selectors
   - **Follow ShadcnUI styling patterns** - Use proper component integration and consistent design
   - **Ensure mobile accessibility** - Minimum 44px touch targets, responsive design, theme support
9. Consider the room-based multi-unit architecture
10. Ensure MQTT message validation is maintained for new features
11. Test components in both light and dark themes
12. Update steering documents as requirements evolve
13. **Code review checklist**: Function size (<20 lines), class responsibility, interface segregation, dependency direction

**CRITICAL**: 
- Never proceed with implementation without using the required tools at each phase
- Every design phase MUST include comprehensive clean code and design pattern analysis
- Every implementation MUST adhere to clean code standards and be validated accordingly

## Error Handling Patterns

### MQTT Error Handling
```typescript
// RxJS error handling for MQTT streams
airconStream$.pipe(
  catchError((error) => {
    console.error('MQTT stream error:', error);
    return of(null); // Return safe fallback
  }),
  retry({ count: 3, delay: 1000 }) // Retry with backoff
).subscribe(/* ... */);
```

### Zod Validation Errors
```typescript
// Handle validation failures gracefully
const result = mqttMessageSchema.safeParse(message);
if (!result.success) {
  console.error('Invalid MQTT message:', result.error);
  // Don't update state with invalid data
  return;
}
```

### React Error Boundaries
```typescript
// Wrap components that interact with MQTT
<ErrorBoundary fallback={<MqttConnectionError />}>
  <AirConRemote />
</ErrorBoundary>
```

### NestJS Error Handling
```typescript
// Global exception filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

// MQTT-specific exception handling
@Catch(MqttException)
export class MqttExceptionFilter implements ExceptionFilter {
  catch(exception: MqttException, host: ArgumentsHost) {
    // Handle MQTT connection and message errors
  }
}
```

## Security Best Practices

### MQTT Security
- **Authentication**: Always use username/password for MQTT connections
- **Encryption**: Use WSS (WebSocket Secure) for production deployments
- **Topic Permissions**: Restrict topic access based on user roles
- **Connection Limits**: Implement connection rate limiting

### Environment Security
- **Credential Storage**: Never hardcode credentials in source code
- **Environment Isolation**: Use different credentials per environment
- **Secret Management**: Use Docker secrets or vault solutions in production
- **Access Control**: Limit access to `.env` files

### Frontend Security
- **Content Security Policy**: Configure CSP headers in Next.js config
- **HTTPS Only**: Always serve production app over HTTPS
- **Input Validation**: Validate all user inputs with Zod
- **XSS Prevention**: Sanitize any dynamic content rendering

### API Security
- **CORS Configuration**: Configure appropriate CORS policies
- **Rate Limiting**: Implement API rate limiting
- **Input Validation**: Validate all incoming requests
- **Error Messages**: Don't expose sensitive information in error responses

## Performance Guidelines

### Frontend Optimization
- **Bundle Analysis**: Use `pnpm build && pnpm bundle-analyzer` to check bundle size
- **Code Splitting**: Lazy load non-critical components
- **MQTT Message Throttling**: Debounce rapid MQTT updates
- **React Optimization**: Use React.memo for expensive components

### MQTT Performance  
- **Message Size**: Keep MQTT payloads small and efficient
- **Subscription Management**: Unsubscribe from unused topics
- **Connection Pooling**: Reuse MQTT connections where possible
- **Batch Updates**: Group rapid state changes to reduce re-renders

### Backend Performance
- **Connection Pooling**: Configure TypeORM database connection pools
- **Redis Caching**: Implement Redis caching for frequently accessed data
- **Async Processing**: Use RxJS observables and async/await patterns
- **WebSocket Optimization**: Use Socket.IO rooms and namespaces efficiently
- **Resource Management**: Properly close database connections and clean up resources
- **Query Optimization**: Use TypeORM query builder and proper indexes
- **Lazy Loading**: Implement lazy loading for related entities where appropriate