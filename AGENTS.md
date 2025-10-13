# AGENTS.md

This file provides guidance to Codex (OpenAI Codex CLI agents) when working with code in this repository.

## Project Overview

This is the **Mitsubishi AC Control Platform**, a full-stack system that pairs a Next.js 15 / React 19 progressive web application with the Spring Boot "Turing" services. The platform orchestrates Mitsubishi HVAC units through MQTT, augments control with real-time WebSocket channels, and layers in household management, quota governance, authentication, and analytics workflows.

Key capabilities:
- multi-room AC control powered by MQTT topics plus REST-backed room and device catalogs
- authenticated household experience with JWT session management and refresh handling
- quota management (balance tracking, overrides, violation alerts) delivered through dedicated WebSocket streams
- unified Zustand stores that reconcile MQTT messages, REST responses, and WebSocket events with RxJS adapters
- PWA foundations (Serwist service worker, install surface) and a responsive UI built with Tailwind CSS 4 and Shadcn/Radix components

## Development Commands

**Frontend (Next.js PWA, `/frontend`)**:
```bash
pnpm install                         # Install dependencies
pnpm dev                             # Start development server on http://localhost:3000
pnpm build                           # Production build
pnpm start                           # Run the production build locally
pnpm lint                            # ESLint (Next.js config)
pnpm exec tsc --noEmit               # Type checking
pnpm dlx vitest --config vitest.config.quota.ts            # Unit/integration tests
pnpm dlx vitest --config vitest.config.quota.ts --runInBand --coverage  # Coverage run
```

**Backend (Turing Spring Boot services, `/backend/turing`)**:
```bash
./mvnw spring-boot:run                               # Launch API + WebSocket gateway on :8081
./mvnw clean verify                                  # Full build with tests
./mvnw test                                          # Backend unit/integration tests
./mvnw package                                       # Package fat JAR to target/
./mvnw spring-boot:run -Dspring-boot.run.profiles=quota    # Enable quota profile locally
```

**Tooling & Docker**:
```bash
# Frontend container (from /frontend)
docker compose -f compose.yaml up --build

# Backend container expects a packaged jar in target/ (from /backend/turing)
./mvnw package
docker compose -f compose.yaml up --build

# Quota simulation helpers
./scripts/manual-quota-testing.sh           # Launches MQTT + quota message exerciser
```

## Testing Strategy

**Frontend (from `/frontend`)**:
```bash
pnpm dlx vitest --config vitest.config.quota.ts                 # Component, store, and hook tests
pnpm dlx vitest --config vitest.config.quota.ts --coverage      # Coverage reporting
pnpm lint                                                       # Static analysis (ESLint)
pnpm exec tsc --noEmit                                          # Type safety gate
```

**Backend (from `/backend/turing`)**:
```bash
./mvnw test                                         # Unit + integration tests
./mvnw verify                                       # Includes Flyway + contract tests
./mvnw test -Dtest=com.ashelabs.turing.*Tests       # Targeted suites by package
```

**Integration & Diagnostics**:
- `scripts/manual-quota-testing.sh` publishes representative MQTT/quota events for end-to-end validation
- WebSocket smoke tests: connect with wscat or Insomnia to `ws://localhost:8081/ws/airconditioner` and `ws://localhost:8081/ws/quota` using a valid JWT
- Performance regression harnesses live under `frontend/src/lib/performance/__tests__`

**Key Testing Areas**:
- **Authentication & Session Lifecycles**: validate token issuing/refresh in `auth-store` and `AuthProvider`
- **Unified Room Store**: ensure selector stability and API/WebSocket synchronization in `room-store` and `unified-room-store`
- **Quota Workflows**: exercise override requests, violation alerts, and balance updates via `quota-store` and WebSocket handlers
- **MQTT ↔ WebSocket Bridge**: confirm `api-aircon-store` reconciles MQTT telemetry with device WebSocket updates
- **UI Integration**: cover quota-aware remote, admin dashboards, and navigation components for responsive and accessibility guarantees
- **Backend Services**: verify Room/Device/Quota controllers, WebSocket command processors, and Redis-backed quota services

## Architecture Overview

### Core Technologies

**Frontend**:
- **Framework**: Next.js 15 (App Router) with React 19 and server actions for config bootstrapping
- **State Management**: Zustand v5 stores (`auth-store`, `api-aircon-store`, `room-store`, `quota-store`, etc.) composed with React Context providers (`AuthProvider`, `DeviceWebSocketProvider`, `QuotaWebSocketContextProvider`)
- **Real-time Communication**: MQTT.js + RxJS wrappers for broker events, plus WebSocket clients for quota/device telemetry
- **Data Access**: Axios-based REST clients in `lib/api` with resilience features (retry, request batching, cache)
- **Styling & UX**: Tailwind CSS 4, Shadcn UI (Radix primitives), Lucide icons, motion via Framer Motion, toast feedback via Sonner
- **PWA**: Serwist-powered service worker with runtime cleanup via `ServiceWorkerCleaner`

**Backend**:
- **Framework**: Spring Boot 3.5.5 (Java 21) with reactive WebSocket support and R2DBC persistence
- **Architecture**: Layered modules (`domain`, `application`, `service`, `controller`, `websocket`, `infrastructure`) plus command-based WebSocket handlers
- **Messaging**: MQTT integration for device control, Redis for quota caching, and JWT-secured WebSocket endpoints
- **Persistence & Migrations**: Postgres via R2DBC, schema maintained through Flyway migrations under `src/main/resources/db`
- **Observability**: Actuator endpoints (health, metrics, Prometheus) and structured logging with configurable levels

### Directory Structure
```
frontend/
├── src/
│   ├── actions/               # Server actions (e.g., load app config)
│   ├── app/                   # Next.js App Router routes and layouts
│   ├── components/
│   │   ├── providers/         # Auth, WebSocket, quota, and device context providers
│   │   ├── room/              # Room list/detail surfaces
│   │   ├── quota/             # Quota dashboards, widgets, demos
│   │   ├── device/            # Device management dialogs & forms
│   │   ├── admin/             # Admin-oriented tooling surfaces
│   │   ├── ui/                # Shadcn-based primitives and shared widgets
│   │   └── shared/            # Cross-cutting layout and navigation pieces
│   ├── hooks/                 # Navigation, device, responsive, and quota hooks
│   ├── lib/
│   │   ├── api/               # REST clients (rooms, devices, quota, family, usage)
│   │   ├── auth/              # JWT storage, refresh, and token rotation helpers
│   │   ├── http/              # Axios client factory with retry/circuit-breaker logic
│   │   ├── mqtt/              # MQTT configuration, schemas, and client setup
│   │   ├── quota/             # Quota WebSocket client and message schemas
│   │   ├── websocket/         # Generic WebSocket abstractions & connection monitors
│   │   ├── performance/       # Performance monitors & instrumentation helpers
│   │   ├── validation/        # Zod schemas and validation utilities
│   │   └── utils.ts           # Cross-project helpers
│   ├── stores/                # Zustand stores (aircon, auth, devices, rooms, quota, etc.)
│   ├── types/                 # Shared TypeScript models mirroring backend DTOs
│   ├── utils/                 # Frontend utility helpers (formatters, mappers)
│   └── __tests__/             # Component-level test utilities
├── config/                    # Optional YAML config (fallback when API unavailable)
├── docs/                      # Feature specs, migration notes, verification docs
├── compose.yaml               # Next.js container definition
├── Dockerfile                 # Frontend container build
└── start.sh                   # Convenience start script

backend/turing/
├── src/main/java/com/ashelabs/turing/
│   ├── application/           # Use cases & orchestration services
│   ├── api/                   # DTOs and API contracts
│   ├── controller/            # REST controllers (rooms, devices, quota, auth, analytics)
│   ├── websocket/             # Command-based handlers + JWT auth decorator
│   ├── service/               # Domain services (quota, room, usage, family)
│   ├── repository/            # Reactive repositories & query adapters
│   ├── domain/                # Aggregates, events, and domain models
│   ├── infrastructure/        # MQTT adapters, redis integrations, protocol bridges
│   └── config/                # Application, WebSocket, Redis, and security config
├── src/main/resources/
│   ├── application.properties # Base config (delegates to profiles)
│   ├── application-dev.properties
│   ├── application-quota.yml
│   └── db/migration/          # Flyway migrations
├── compose.yaml               # Backend container (expects packaged jar)
└── pom.xml                    # Maven build definition
```

### State Management Architecture

**Unified Flow**:
1. Authenticated users bootstrap via `AuthProvider`, which hydrates `auth-store` from persisted tokens and sets Axios/WebSocket credentials.
2. `room-store` fetches household rooms through the REST API, while `api-aircon-store` maintains per-device MQTT state and control commands.
3. `DeviceWebSocketProvider` subscribes to backend sessions and forwards telemetry into `device-store`, which normalizes live status across rooms.
4. `QuotaWebSocketContextProvider` streams quota updates into `quota-store`, coordinating with REST fallbacks for balance snapshots.
5. UI components consume memoized selectors (often via `useShallow`) to avoid unnecessary rerenders while composing MQTT + REST + WebSocket data.

**Supporting Stores**:
- `unified-room-store` and `unified-room-selectors` expose denormalized room summaries for dashboards
- `family-store` and `quota-store` manage household membership, overrides, and violation history
- `demo-aircon-store` enables mocked sessions for development without MQTT hardware

### Configuration System

- `frontend/config/app-config.yaml` now serves as a fallback when the REST room API is unavailable; by default rooms load from the backend.
- `frontend/src/lib/config/config.ts` exposes a typed singleton (empty rooms array by default) to preserve compatibility with older flows.
- Backend configuration is primarily environment-driven (`application.properties` + profiles) covering MQTT, Redis, Postgres, JWT, and quota toggles.
- Feature flags for quota rollouts (`QUOTA_ENABLED`, `QUOTA_ROLLOUT_PERCENTAGE`, `QUOTA_ENABLED_HOUSEHOLDS`) allow staged deployments.

### Environment Configuration

**Frontend** (`.env.local` in `/frontend`):
```bash
NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:9001
NEXT_PUBLIC_MQTT_BROKER_PORT=9001
NEXT_PUBLIC_MQTT_BROKER_USERNAME=your_mqtt_username
NEXT_PUBLIC_MQTT_BROKER_PASSWORD=your_mqtt_password
NEXT_PUBLIC_BACKEND_WEBSOCKET_URL=ws://localhost:8081/ws         # Optional override
NEXT_PUBLIC_APP_CONFIG_PATH=/custom/path/to/config.yaml          # Optional fallback config
NODE_ENV=development
```

**Backend** (`backend/turing/src/main/resources/application*.properties` or environment variables):
- `SERVER_PORT` (default `8081`)
- MQTT: `MQTT_BROKER_URL`, `MQTT_BROKER_PORT`, `MQTT_BROKER_USERNAME`, `MQTT_BROKER_PASSWORD`, `MQTT_BASE_TOPIC`
- Database (R2DBC/Postgres): `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, plus pool tuning knobs
- Flyway: `FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`
- Redis (quota cache): `QUOTA_REDIS_HOST`, `QUOTA_REDIS_PORT`, `QUOTA_REDIS_PASSWORD`
- Security: `JWT_SECRET`, `JWT_EXPIRATION`
- Quota toggles: `QUOTA_ENABLED`, `QUOTA_ROLLOUT_PERCENTAGE`, `QUOTA_ENFORCEMENT_ENABLED`, etc.
- Observability: `PROMETHEUS_ENABLED`, `LOG_LEVEL`, `SERVICE_LOG_LEVEL`

**Security Notes**:
- Never commit `.env*` files or secrets; use platform secret managers for production deployments.
- Rotate `JWT_SECRET` per environment; tokens gate both REST and WebSocket access.
- Ensure Redis/Postgres credentials differ between development, staging, and production.
- When running containers, provide a `.env` file or CI secret injection with the variables listed above.

### MQTT Topics and Message Structure

**Base Topic Pattern**: `mitsubishi2mqtt/{room_identifier}` (default sample: `second_bedroom_aircon`)

**Topics**:
- `/mode/set` – AC mode (off, heat_cool, cool, dry, heat, fan_only)
- `/temp/set` – Target temperature (parsed to float)
- `/fan/set` – Fan speed (AUTO/1-4/QUIET plus legacy aliases)
- `/vane/set` – Vertical vane position (AUTO, 1-5, SWING)
- `/wideVane/set` – Horizontal vane position (`<<`, `<`, `|`, `>`, `>>`, SWING)
- `/remote_temp/set` – Remote sensor temperature override
- `/settings` – Current AC settings payload (fan, vane, mode, temperature)
- `/state` – Runtime state (roomTemperature, compressorFrequency, action, etc.)
- `/system/set` – System-level commands (e.g., reboot)

Zod schemas for each topic live in `frontend/src/lib/mqtt/mqtt-config.ts`, ensuring runtime validation before store updates.

### WebSocket Endpoints

**Base URL**: `ws://localhost:8081/ws/{feature}?{context-params}` (JWT token required in query string)

#### Air Conditioner Control
- **URL**: `/ws/airconditioner`
- **Handler**: `AirConditionerWebSocketHandler`
- **Package**: `com.ashelabs.turing.websocket.airconditioner`
- **Query Parameters**:
  - `roomId` – Room identifier for session subscription
  - `familyMemberId` – Authenticated household member ID
  - `token` – JWT from the Auth service

**Message Types**: AirConditionerInboundMessage, AirConditionerOutboundMessage
**Commands**: SetTemperature, SetMode, SetFanSpeed, SetPower, SetSwing, GetStatus, plus telemetry broadcasts

#### Quota Management
- **URL**: `/ws/quota`
- **Handler**: `QuotaWebSocketHandler`
- **Package**: `com.ashelabs.turing.websocket.quota`
- **Query Parameters**:
  - `quotaId` – Quota identifier (daily-limit, emergency, etc.)
  - `roomId` – Room identifier associated with the quota
  - `familyMemberId` – Household member ID
  - `token` – JWT from the Auth service

**Message Types**: QuotaInboundMessage, QuotaOutboundMessage, Override workflow events, violation alerts
**Commands**: Subscribe, Unsubscribe, OverrideRequest, OverrideApproval, HealthCheck, QuotaUpdate

### WebSocket URL Naming Convention

**Pattern**: `/ws/{feature}?{context-params}`

**Components**:
- **Base**: `/ws` – WebSocket namespace
- **Feature**: `/{feature}` – Capability (airconditioner, quota, future device modules)
- **Context**: `?{params}` – JWT and scope parameters for the session

**1:1:1 Mapping**:
```
URL Path              Handler Class                            Package
───────────────────── ──────────────────────────────────────── ───────────────────────────────────────────
/ws/airconditioner → AirConditionerWebSocketHandler          → websocket/airconditioner/
/ws/quota          → QuotaWebSocketHandler                   → websocket/quota/
```

**Adding New Endpoints**:
1. Implement a handler extending `BaseWebSocketHandler` in `websocket/{feature}` with command registrations.
2. Register the handler in `WebSocketConfig` (and companion profile-specific configs if needed).
3. Decorate with `WebSocketJwtAuthHandler` when authentication is required.
4. Expose client utilities in `frontend/src/lib/websocket` and surface selectors/stores for UI consumption.

## Clean Code Standards

### Core Principles

**DRY (Don't Repeat Yourself)**:
- **Identification**: Actively identify code duplication during design and implementation
- **Extraction**: Create reusable functions, components, constants, and utilities
- **Configuration**: Use configuration files and environment variables instead of hardcoded values
- **Templates**: Create component and function templates for common patterns

**SOLID Principles**:

1. **Single Responsibility Principle (SRP)**:
   - Each class/component should have ONE reason to change
   - Functions should do ONE thing well
   - Separate business logic from presentation logic
   - Extract utility functions when components become too complex

2. **Open/Closed Principle (OCP)**:
   - Code should be open for extension, closed for modification
   - Use interfaces and abstract classes for extensibility
   - Implement plugin architectures where appropriate
   - Prefer composition over inheritance

3. **Liskov Substitution Principle (LSP)**:
   - Subtypes must be substitutable for their base types
   - Ensure contract compatibility in inheritance hierarchies
   - Validate interface implementations maintain expected behavior

4. **Interface Segregation Principle (ISP)**:
   - Create focused, client-specific interfaces
   - Avoid fat interfaces that force unnecessary dependencies
   - Split large interfaces into smaller, cohesive ones

5. **Dependency Inversion Principle (DIP)**:
   - Depend on abstractions, not concretions
   - Use dependency injection where possible
   - Create clear boundaries between layers
   - Invert control flow through interfaces and abstractions

**YAGNI (You Ain't Gonna Need It)**:
- **Simplicity First**: Implement only what's needed for current requirements
- **Iterative Enhancement**: Add complexity only when requirements demand it
- **Avoid Speculation**: Don't build features "just in case"
- **Refactor When Needed**: Prefer refactoring over preemptive abstraction

### Design Pattern Guidelines

**Pattern Selection Process**:
1. **Problem Identification**: Clearly define the problem being solved
2. **Pattern Research**: Identify 2-3 applicable patterns
3. **Trade-off Analysis**: Compare patterns based on:
   - Complexity vs. benefit ratio
   - Maintainability impact
   - Performance implications
   - Team familiarity
   - Future extensibility needs
4. **Decision Documentation**: Document chosen pattern and rationale

**Common Applicable Patterns**:

**Frontend Patterns**:
- **Observer Pattern**: MQTT message handling, state management
- **Strategy Pattern**: Different AC control modes, validation strategies
- **Facade Pattern**: Complex MQTT client interactions
- **Provider Pattern**: React Context for dependency injection
- **Hook Pattern**: Custom hooks for reusable logic

**Backend Patterns**:
- **Repository Pattern**: Data access abstraction
- **Service Layer Pattern**: Business logic encapsulation
- **Factory Pattern**: Object creation based on configuration
- **Command Pattern**: MQTT message processing
- **Adapter Pattern**: External service integration

**Trade-off Analysis Framework**:
```
Pattern Evaluation:
├── Complexity: Simple → Complex (1-5)
├── Maintainability: Low → High (1-5)
├── Testability: Difficult → Easy (1-5)
├── Performance: Slow → Fast (1-5)
├── Flexibility: Rigid → Flexible (1-5)
└── Team Knowledge: Unknown → Expert (1-5)

Score: (Sum/6) → Decision Threshold: >3.5 to adopt
```

### Code Organization Principles

**Separation of Concerns**:
- **Layer Separation**: Clear boundaries between presentation, business, and data layers
- **Feature Grouping**: Organize by feature/domain rather than technical concerns
- **Interface Definition**: Clear contracts between modules
- **Dependency Direction**: Dependencies should flow inward toward business logic

**Cohesion and Coupling**:
- **High Cohesion**: Related functionality grouped together
- **Low Coupling**: Minimal dependencies between modules
- **Stable Dependencies**: Depend on stable abstractions
- **Acyclic Dependencies**: Avoid circular dependencies

### Implementation Standards

**Function Design**:
- **Small Functions**: 20 lines or less preferred
- **Pure Functions**: Prefer functions without side effects
- **Clear Naming**: Function names should describe intent, not implementation
- **Parameter Limits**: Maximum 3-4 parameters, use objects for more

**Class Design**:
- **Small Classes**: Single responsibility, < 200 lines
- **Composition**: Favor composition over inheritance
- **Immutability**: Prefer immutable objects where possible
- **Interface First**: Design interfaces before implementation

**Error Handling**:
- **Explicit Errors**: Use Result types or explicit error handling
- **Fail Fast**: Validate inputs early and fail fast
- **Error Boundaries**: Isolate error handling at appropriate levels
- **Logging**: Structured logging with appropriate levels

### Refactoring & Editing Policy (Strict Guardrails)

**CRITICAL**: These rules are **non-negotiable** and apply to ALL code modifications, refactoring, and architectural changes across frontend and backend.

**1. No New Files Without Explicit Approval**
- **NEVER** create new files with variant names without explicit written approval:
  - ❌ Frontend: `FooRefined.ts`, `UnifiedBar.tsx`, `EnhancedStore.ts`, `*V2.tsx`, `*New.ts`
  - ❌ Backend: `ServiceImproved.java`, `ControllerEnhanced.java`, `RepositoryV2.java`
- **STOP** and ask for permission before generating any new file or module
- This includes: components, stores, hooks, services, controllers, repositories, utilities, or any code artifact

**2. All Edits Must Be In-Place Using Diff/Patch Mode**
- Provide **diff or patch** modifications to existing files only
- Do **NOT** output full file replacements unless absolutely necessary and approved
- Preserve existing file structure and location unless explicitly directed otherwise
- For Java: prefer targeted method/class edits over rewriting entire files

**3. New Abstractions Require Justification & Approval**
- If a new abstraction, module, or architectural pattern is needed:
  1. **STOP** immediately
  2. Document your justification:
     - What abstraction/pattern is needed
     - Why it's necessary (specific problem it solves)
     - How it integrates with existing architecture (frontend stores, backend layers, WebSocket handlers)
     - Alternative approaches considered
     - Impact on MQTT/WebSocket/REST integration
  3. **WAIT** for explicit approval before proceeding
  4. Only after approval, implement with **canonical naming** (no prompt-style adjectives)

**4. Naming Discipline**
- **NEVER** echo prompt adjectives into code:
  - ❌ Frontend: `EnhancedComponent`, `UnifiedStore`, `ImprovedHook`, `RefactoredUtil`
  - ❌ Backend: `OptimizedService`, `EnhancedController`, `ImprovedRepository`
  - ✅ Use names consistent with existing architecture and naming conventions
- Follow established naming patterns:
  - **Frontend**:
    - React Components: PascalCase (`QuotaDashboard.tsx`, `DeviceWebSocketProvider.tsx`)
    - Utilities/Hooks: camelCase (`useDevices.ts`, `formatQuotaBalance.ts`)
    - Stores: kebab-case with suffix (`room-store.ts`, `quota-store.ts`, `auth-store.ts`)
    - Types: PascalCase (`RoomDevice`, `QuotaUpdate`, `AirConState`)
  - **Backend**:
    - Controllers: `*Controller.java` (`RoomController`, `QuotaController`)
    - Services: `*Service.java` (`QuotaService`, `UsageService`)
    - Repositories: `*Repository.java` (`RoomRepository`, `DeviceRepository`)
    - Domain: PascalCase (`QuotaAggregate`, `RoomEntity`)

**5. No Logic Duplication Across Files**
- If logic is moved or refactored:
  - **Original code MUST be removed or properly deprecated**
  - If deprecating, add clear redirect/forwarding to new location with `@deprecated` annotations (Java) or JSDoc (TypeScript)
  - **NEVER** leave duplicate implementations across files
  - Update all imports, references, and dependency injection configurations (Spring beans, React Context providers)
  - Ensure MQTT topic subscriptions and WebSocket handlers remain functional

**6. Post-Change Validation Required**
- After **every** modification, run validation in sequence:

  **Frontend**:
  1. Type checking: `pnpm exec tsc --noEmit`
  2. Linting: `pnpm lint`
  3. Tests: `pnpm dlx vitest --config vitest.config.quota.ts` (or relevant config)
  4. Build: `pnpm build`

  **Backend**:
  1. Compilation: `./mvnw clean compile`
  2. Tests: `./mvnw test`
  3. Integration tests: `./mvnw verify`
  4. Package: `./mvnw package`

- If **ANY** validation fails:
  - **STOP** immediately
  - Revert changes
  - Flag the issue to the user
  - Wait for guidance before retrying

**7. Minimal Changes Over Maximal Rewrites**
- **Prefer**: Refactor one function/class/component at a time, in place
- **Avoid**: Overhauling entire subsystems unless explicitly requested
- **Focus**: Surgical, targeted improvements that maintain system stability
- **Scope**: Keep changes small, reviewable, and testable
- **Integration**: Verify MQTT subscriptions, WebSocket connections, and REST endpoints remain functional after changes

**8. Explain Before Performing**
- For **any non-trivial refactor** (especially file moves, renames, architectural changes, or protocol modifications):
  1. Output a **short plan/justification** first (3-5 bullet points)
  2. Explain:
     - What will change
     - Why it's necessary
     - Impact on existing code (stores, providers, services, controllers, handlers)
     - Impact on MQTT/WebSocket/REST communication
     - Risk assessment
  3. **WAIT** for approval before applying changes
  4. Only proceed after receiving explicit confirmation

**9. Incremental Migration Strategy**
- When refactoring must happen:
  1. Create migration plan with clear phases
  2. Maintain backward compatibility during transition (especially for API contracts and WebSocket messages)
  3. Update documentation and tests incrementally
  4. Verify each phase before proceeding (check MQTT topics, WebSocket payloads, REST responses)
  5. Remove old code only after full migration is confirmed working

**10. Architecture Preservation**
- Respect existing architectural patterns:

  **Frontend**:
  - State management via Zustand v5 stores with proper selectors
  - MQTT communication through RxJS observables
  - WebSocket clients for quota and device telemetry
  - React Context for dependency injection (AuthProvider, DeviceWebSocketProvider, QuotaWebSocketContextProvider)
  - Component composition with ShadcnUI and Radix primitives
  - Server actions for config bootstrapping

  **Backend**:
  - Layered architecture: domain → service → controller
  - Reactive WebSocket handlers with command pattern
  - R2DBC for async database access
  - Flyway for schema migrations
  - Redis for quota caching
  - JWT-based authentication for REST and WebSocket endpoints

- **DO NOT** introduce new patterns without architectural justification and approval

## Code Quality Standards

### TypeScript Guidelines
- **Strict Mode**: Project uses strict TypeScript configuration
- **Type Safety**: Prefer explicit types over `any` or `unknown`
- **Zod Integration**: Use Zod schemas for runtime validation and type inference
- **No Unused Imports**: Remove unused imports and variables

### Frontend Standards
- **ESLint**: Follow Next.js ESLint configuration (`pnpm lint`)
- **Component Structure**: Prefer functional components with hooks
- **State Management**: Use Zustand for global state, useState for local state
- **Zustand v5 Patterns**: **CRITICAL** - Always use proper selectors to avoid infinite loops
- **MQTT Patterns**: Always validate MQTT messages with Zod schemas
- **Error Boundaries**: Wrap components prone to errors
- **Accessibility**: Follow ARIA guidelines for UI components

### Frontend Styling & UI Framework Standards

This project uses **ShadcnUI** components built on **Radix UI** with **Tailwind CSS** for styling. Follow these patterns for consistent design and component integration:

#### Core UI Technologies
- **Base Framework**: Radix UI primitives for accessibility and behavior
- **Component Library**: ShadcnUI for pre-built, customizable components
- **Styling**: Tailwind CSS utility classes
- **Icons**: Lucide React icon library
- **Themes**: Next-themes for dark/light mode support

#### ShadcnUI Component Integration

**Adding New ShadcnUI Components**:
```bash
# Install specific components (run from /frontend directory)
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add tooltip
pnpm dlx shadcn@latest add slider
pnpm dlx shadcn@latest add switch

# Install multiple components at once
pnpm dlx shadcn@latest add button card badge tooltip
```

**Component Import Patterns**:
```typescript
// ALWAYS import from local ui components directory
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Icons from Lucide React
import { ArrowLeft, Wifi, WifiOff, RotateCcw } from 'lucide-react';
```

**Styling Patterns & Conventions**:

**1. Component Sizing Standards**:
```typescript
// Button sizes - prefer sm for compact UIs
<Button size="sm" variant="ghost">Compact</Button>
<Button size="default">Normal</Button>
<Button size="lg">Large</Button>

// Mobile touch targets - minimum 44px for accessibility
className="min-h-[44px] min-w-[44px]"
```

**2. Color Scheme & Theme Integration**:
```typescript
// Use semantic color classes that work with dark/light themes
className="bg-background text-foreground"
className="bg-muted text-muted-foreground"
className="bg-primary text-primary-foreground"
className="bg-destructive text-destructive-foreground"

// Status-specific colors
className="text-green-600 dark:text-green-400" // Success
className="text-red-600 dark:text-red-400"     // Error
className="text-yellow-600 dark:text-yellow-400" // Warning
className="text-blue-600 dark:text-blue-400"   // Info
```

**3. Responsive Design Patterns**:
```typescript
// Mobile-first responsive design
className="text-sm sm:text-base"           // Text scaling
className="p-2 sm:p-4"                     // Padding scaling
className="hidden sm:inline-block"         // Show on larger screens
className="flex flex-col sm:flex-row"      // Layout changes
className="gap-2 sm:gap-4"                 // Spacing scaling
```

**4. Animation & Interaction Standards**:
```typescript
// Standard hover/active transitions
className="transition-all duration-200 hover:scale-105 active:scale-95"

// Focus states for accessibility
className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"

// Loading states
className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"
```

**5. Layout & Spacing Consistency**:
```typescript
// Standard gap sizes
className="gap-2"    // 8px - tight spacing
className="gap-4"    // 16px - normal spacing
className="gap-6"    // 24px - loose spacing

// Card layouts
<Card className="p-4 space-y-4">
  <CardHeader className="p-0">
    <CardTitle className="text-lg font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent className="p-0 space-y-2">
    {/* Content */}
  </CardContent>
</Card>
```

**6. Component Composition Patterns**:
```typescript
// Tooltip wrapper pattern for icons/buttons
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="sm">
      <ArrowLeft className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Go back</p>
  </TooltipContent>
</Tooltip>

// Badge composition for status indicators
<Badge 
  variant={status === 'healthy' ? 'default' : 'destructive'}
  className="flex items-center gap-1"
>
  {status === 'healthy' ? (
    <Wifi className="h-3 w-3" />
  ) : (
    <WifiOff className="h-3 w-3" />
  )}
  {status}
</Badge>
```

#### Custom Component Development

**When Creating New UI Components**:
1. **Extend ShadcnUI**: Build upon existing ShadcnUI components when possible
2. **Maintain Consistency**: Follow established patterns for props and styling
3. **Include Accessibility**: Ensure proper ARIA labels and keyboard navigation
4. **Support Themes**: Use semantic colors that work in both light and dark modes
5. **Mobile-First**: Design for mobile first, then enhance for larger screens

**Component Structure Template**:
```typescript
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CustomComponentProps {
  /** Component prop documentation */
  variant?: 'default' | 'secondary';
  /** Additional CSS classes */
  className?: string;
  /** Disable the component */
  disabled?: boolean;
  /** Children content */
  children?: React.ReactNode;
}

export const CustomComponent: React.FC<CustomComponentProps> = React.memo(({
  variant = 'default',
  className,
  disabled = false,
  children,
  ...props
}) => {
  return (
    <Button
      variant={variant}
      disabled={disabled}
      className={cn(
        // Base styles
        'flex items-center justify-center',
        // Responsive styles
        'text-sm sm:text-base',
        // Interactive states
        'transition-all duration-200 hover:scale-105',
        // Accessibility
        'focus:ring-2 focus:ring-offset-2',
        // Custom className
        className
      )}
      aria-label="Custom component"
      {...props}
    >
      {children}
    </Button>
  );
});

CustomComponent.displayName = 'CustomComponent';

export default CustomComponent;
```

#### Design System Values

**Spacing Scale** (Tailwind CSS):
```
gap-1  = 4px   | p-1  = 4px
gap-2  = 8px   | p-2  = 8px   ← Most common
gap-4  = 16px  | p-4  = 16px  ← Standard
gap-6  = 24px  | p-6  = 24px
gap-8  = 32px  | p-8  = 32px
```

**Typography Scale**:
```
text-xs  = 12px  | Card descriptions, meta info
text-sm  = 14px  | Body text, labels ← Mobile default  
text-base = 16px | Body text, buttons ← Desktop default
text-lg  = 18px  | Card titles, section headers
text-xl  = 20px  | Page titles, major headings
```

**Component Sizing Guidelines**:
```
Icon sizes:    h-3 w-3 (12px), h-4 w-4 (16px) ← Standard, h-5 w-5 (20px)
Button sizes:  size="sm" ← Default, size="default", size="lg"  
Touch targets: min-h-[44px] min-w-[44px] ← Required for mobile
```

#### Project-Specific Styling Patterns

**Air Conditioner Control Interface**:
```typescript
// Temperature controls - use prominent styling
<Button 
  size="lg" 
  className="text-2xl font-bold min-h-[60px] min-w-[60px]"
>
  {temperature}°
</Button>

// Mode indicators - use badge styling with icons
<Badge variant={mode === 'heat' ? 'destructive' : 'default'}>
  <Thermometer className="h-3 w-3 mr-1" />
  {mode}
</Badge>

// Status cards - consistent card layout
<Card className="p-4 space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Room Temperature</span>
    <Badge variant="outline">{currentTemp}°</Badge>
  </div>
</Card>
```

**Navigation & Status Components**:
```typescript
// Header navigation - consistent height and spacing
<header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
  <div className="container flex h-14 items-center justify-between">
    <BackButton fallbackRoute="/" />
    <ConnectionStatusBadge />
  </div>
</header>

// Connection status indicators - semantic colors
const statusColors = {
  healthy: 'text-green-600 dark:text-green-400',
  degraded: 'text-yellow-600 dark:text-yellow-400', 
  disconnected: 'text-red-600 dark:text-red-400',
};
```

**PWA & Mobile Optimizations**:
```typescript
// Safe area handling for mobile devices
className="pb-safe-area-inset-bottom"

// Prevent text selection on control elements
className="select-none"

// Optimized touch interactions
className="touch-manipulation active:scale-95"

// Sticky positioning for controls
className="sticky bottom-0 bg-background border-t p-4"
```

### Zustand v5 Critical Patterns (Prevent Infinite Loops)

**❌ NEVER DO - Causes infinite loops:**
```typescript
// DON'T: Access entire store object - creates unstable references
const storeData = useStore(apiAirconStore);
useEffect(() => {
  storeData.someMethod();
}, [storeData]); // storeData changes every render → infinite loop
```

**✅ ALWAYS DO - Use specific selectors:**
```typescript
// DO: Use targeted selectors for stable references
const someMethod = useStore(apiAirconStore, (state) => state.someMethod);
const someValue = useStore(apiAirconStore, (state) => state.someValue);
useEffect(() => {
  someMethod();
}, []); // Store methods are stable - use empty deps with eslint-disable if needed
```

**✅ For complex selections, use useShallow:**
```typescript
import { useShallow } from 'zustand/react/shallow';

const [value1, value2, method] = useStore(apiAirconStore, 
  useShallow((state) => [state.value1, state.value2, state.method])
);
```

**Key Rules:**
1. **Never** use `useStore(store)` without a selector
2. **Always** select specific values/methods with `(state) => state.property`
3. **Use `useShallow`** for selecting multiple values to prevent reference issues
4. **Store methods are stable** - safe to omit from useEffect dependencies with eslint-disable
5. **Previous state tracking** - Use `useRef` to avoid stale closure issues in useEffect

### Backend Standards  
- **Java Conventions**: Follow standard Java naming conventions
- **Lombok Usage**: Use Lombok annotations to reduce boilerplate
- **Spring Patterns**: Follow Spring Boot best practices
- **Error Handling**: Use proper exception handling and HTTP status codes
- **Testing**: Write unit tests for all business logic

### File Naming Conventions
- **React Components**: PascalCase (e.g., `AirConRemote.tsx`)
- **Utilities/Hooks**: camelCase (e.g., `useAircon.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MQTT_TOPICS`)
- **Types/Interfaces**: PascalCase (e.g., `AirConState`)

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
  - **Clean Code Implementation Checklist**:
    - Code duplication elimination strategy (DRY)
    - Single responsibility validation for each class/component
    - Interface segregation and dependency injection points
    - Refactoring opportunities and technical debt reduction
    - Code review criteria based on clean code principles
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

**4. Mandatory Tool Usage:**
- **Design Phase**: ALWAYS use sequential thinking tool for architecture planning and design patterns
  - **Must include**: Clean code principles analysis (DRY, SOLID, YAGNI)
  - **Must include**: Design pattern evaluation with trade-off analysis
  - **Must include**: Architecture quality assessment (cohesion, coupling, separation of concerns)
- **Architecture Assessment**: Before fitting new features, evaluate and refactor existing architecture if needed
  - **Focus on**: Identifying code duplication and architectural debt
  - **Analyze**: Current architecture adherence to SOLID principles
  - **Recommend**: Refactoring opportunities to improve maintainability
- **Implementation Phase**: ALWAYS use Context7 tools to fetch latest documentation for relevant packages/frameworks
  - **Validate**: Implementation follows clean code standards
  - **Review**: Code organization and design pattern application
- **After Each Implementation Step**: ALWAYS use feedback tool to provide implementation summary and wait for approval before proceeding
  - **Include**: Clean code compliance assessment
  - **Highlight**: Any technical debt introduced and mitigation plan
- **Documentation Currency**: Ensure all implementations use the most up-to-date package instructions via Context7

## Development Guidelines

### Adding New Rooms
1. Provision the room through the backend API (`RoomController`) or via the admin UI – the frontend consumes REST responses rather than static YAML.
2. Ensure the MQTT topic mapping for any new device is defined on both sides:
   - Backend: update the appropriate mapper in `domain/device` or `infrastructure/protocol` so commands route to the correct topic.
   - Frontend: extend `frontend/src/lib/mqtt/mqtt-config.ts` (or the dynamic mapping service if introduced) with the new topic constants and validation schema entries.
3. Synchronize types by updating `frontend/src/types/room.ts` and any related Zod validators.
4. Add or adjust Flyway migrations plus seed data when a new room requires persistence defaults.
5. Exercise `room-store.fetchRooms()` and the REST integration tests to verify CRUD paths.

### Extending AC Controls
1. Expand `MQTT_TOPICS`, `VALID_VALUES`, and `mqttMessageSchemas` in `frontend/src/lib/mqtt/mqtt-config.ts` for the new capability.
2. Update `api-aircon-store` and related stores to emit the new command/state fields and expose stable selectors.
3. Introduce UI affordances inside `frontend/src/components/AirConRemote.tsx` or the quota-aware wrappers, ensuring touch targets remain ≥44px.
4. Queue backend work: add command handling in `com.ashelabs.turing.websocket.airconditioner` and register new command names in the handler's registry.
5. Extend the REST API (if needed) so analytics and history endpoints surface the additional data – remember to cover it with controller/service tests.

### Working with MQTT & WebSocket Clients
- MQTT bootstraps in `frontend/src/lib/mqtt/mqtt-client.ts`; reuse the exported singleton through `AirconProvider` to avoid duplicate connections.
- Device telemetry now flows through `DeviceWebSocketProvider`. Never access the raw store directly—select methods via `useShallow` selectors to prevent render loops.
- Quota messaging lives in `frontend/src/lib/quota/quota-websocket.tsx`; throttle reconnection attempts using the provided `forceReconnect` helper rather than rebuilding your own socket logic.
- When adding a new WebSocket channel, follow the command pattern in `backend/turing/src/main/java/com/ashelabs/turing/websocket/core` and surface a typed hook under `frontend/src/lib/websocket`.

### Authentication & Authorization
- Auth flows are centralized in `frontend/src/lib/auth`; extend token acquisition or refresh logic there so both Axios and WebSocket clients inherit the change.
- Backend JWT validation occurs in `WebSocketJwtAuthHandler` and the REST security filters—update both if the token shape changes.
- Keep `AuthProvider` selectors narrow when exposing new actions to avoid re-render storms.

### Quota System Enhancements
- Quota configuration lives in `backend/turing/src/main/resources/application-quota.yml` and the associated service classes; adjust feature flags using environment variables for local testing.
- Mirror new quota payload fields in `frontend/src/stores/quota-store.ts` and extend the Zod schema in `quota-websocket.tsx`.
- Use `scripts/manual-quota-testing.sh` to simulate publish/subscribe flows before wiring the UI.

## Debugging & Troubleshooting

### Common Issues and Solutions

**MQTT Connection Problems**:
```bash
# Verify broker reachability
nc -vz ${MQTT_BROKER_URL:-localhost} 1883

# Confirm WebSocket bridge (Mosquitto with websocket listener)
nc -vz ${MQTT_BROKER_URL:-localhost} 9001
```
- Ensure backend devices are subscribing to the same base topic defined in `application.properties` (`mqtt.base-topic`).
- If TLS is required, configure the `mqtt-client.ts` options and backend environment variables accordingly.

**WebSocket Issues**:
- AirConditioner/Quota sockets require a valid JWT; generate via `POST /api/auth/login` and append `token=<jwt>` to the query string.
- Use `wscat -c "ws://localhost:8081/ws/quota?quotaId=daily-limit&roomId=living-room&familyMemberId=user123&token=..."` to validate payloads.
- Check the backend logs for `WebSocketJwtAuthHandler` warnings to diagnose token expiration or scope mismatches.

**Frontend Issues**:
- Stale caches: clear the in-memory caches exposed by API clients using their `clearCache` helpers (where available) or reload the store by calling `fetchRooms`/`refreshDevices`.
- Zustand selector loops: confirm you're selecting primitives or memoized callbacks only; refer to `unified-room-selectors` for patterns.
- Service worker conflicts: run `pnpm dev --turbo` with `ServiceWorkerCleaner` rendered to purge stale Serwist registrations.

**Backend Issues**:
- Database connectivity: ensure Postgres is reachable at the R2DBC URL (`r2dbc:postgresql://...`) and that Flyway migrations have executed.
- Redis quota cache: `redis-cli -h ${QUOTA_REDIS_HOST:-localhost} ping` verifies availability; quota updates depend on it.
- MQTT session churn: check logs under `com.ashelabs.turing.websocket` and `org.eclipse.paho` for reconnect storms; tune `MQTT_RECONNECT_*` variables as needed.
- For failing reactive flows, enable `logging.level.reactor.netty=DEBUG` temporarily to capture transport diagnostics.

**Development Tools**:
- React DevTools and Zustand Inspector for store analysis
- MQTT Explorer (or command-line `mosquitto_sub`) for topic validation
- `wscat`, Insomnia, or Postman for WebSocket testing
- RedisInsight / `redis-cli monitor` for quota cache activity
- Spring Boot Actuator (`http://localhost:8081/actuator/health`, `/actuator/metrics`) for service health and metrics

### Logging and Monitoring
- Frontend: set `localStorage.setItem('debug', 'mqtt*')` for verbose MQTT logging, and enable Zustand logging utilities in development builds.
- Backend: leverage Actuator health checks plus Prometheus endpoint (`/actuator/prometheus`). Adjust log levels via `LOG_LEVEL`/`SERVICE_LOG_LEVEL` environment variables without redeploying.
- Use the performance monitors in `frontend/src/lib/performance` to profile WebSocket latency and render timelines; tests live alongside the monitors for regression coverage.

## Important Implementation Details

- Spec-driven workflow remains mandatory: author `spec.md`, `design.md`, and `implementation.md` under `docs/specs/<feature>/` before coding.
- Rooms, devices, and quotas are API-first now; avoid reintroducing static YAML unless providing a fallback path.
- MQTT, REST, and WebSocket data must converge through the existing stores—reuse their selectors before introducing new global state.
- Auth tokens gate every network path; keep Axios interceptors and WebSocket factories in sync when introducing new authentication behaviors.
- Quota features rely heavily on Redis—guard against introducing long-lived blocking calls that would stall the event loop.
- Device simulations live in `demo-aircon-store` and related components; prefer them over ad-hoc mocks when building new UI interactions.
- Continue updating the steering documents as requirements evolve; ensure traceability from implementation back to design/spec remains intact.
