# AGENTS.md

This file provides guidance to Codex (OpenAI Codex CLI agents) when working with code in this repository.

## Project Overview

This is the **Mitsubishi AC Control Platform**, a full-stack system that pairs a Next.js 15 / React 19 progressive web application with the NestJS "Turing" services. The platform orchestrates Mitsubishi HVAC units through MQTT, augments control with real-time WebSocket channels, and layers in household management, quota governance, authentication, and analytics workflows.

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

**Backend (NestJS services, `/backend`)**:
```bash
pnpm install                                         # Install dependencies
pnpm start:dev                                       # Launch API on :8081 (default)
pnpm build && pnpm start:prod                        # Production build + run
pnpm test                                            # Unit tests (Jest)
pnpm test:e2e                                        # E2E tests
pnpm test:cov                                        # Coverage run
pnpm lint                                            # Linting
pnpm format                                          # Format code
```

**Tooling & Docker**:
```bash
# Frontend container (from /frontend)
docker compose -f compose.yaml up --build

# Backend (from /backend) — containerization TBD
# Use pnpm scripts to build and run locally
pnpm build
pnpm start:prod

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

**Backend (from `/backend`)**:
```bash
pnpm test                                           # Unit tests
pnpm test:e2e                                       # E2E tests
pnpm test:cov                                       # Coverage reporting
pnpm build                                          # Build artifacts
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
- **Framework**: NestJS 11 (TypeScript) with Socket.IO WebSocket support and TypeORM persistence
- **Architecture**: Modular Nest modules (AppConfigModule, DatabaseModule, RedisModule, MqttModule, HealthModule), controllers, and providers
- **Messaging**: MQTT via mqtt.js for device control, Redis for quota caching, and JWT-secured REST/WebSocket endpoints (via Nest guards)
- **Persistence & Migrations**: Postgres via TypeORM; migrations supported but not present in this repo
- **Observability**: Terminus health endpoints (`/health`, `/health/database`, `/health/redis`, `/health/mqtt`) and structured Nest logger configuration

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

backend/
├── src/
│   ├── common/config/         # app, database, redis, mqtt, jwt, websocket, quota configs
│   ├── shared/database/       # TypeORM database module + health indicator
│   ├── shared/redis/          # ioredis module + health indicator
│   ├── shared/mqtt/           # mqtt.js module + health indicator
│   ├── health/                # Terminus health controller/module
│   ├── app.module.ts          # Root Nest module
│   └── main.ts                # Bootstrap (CORS, validation, logging)
├── package.json               # Scripts (start, start:dev, build, test)
├── tsconfig*.json             # TypeScript configs
└── .env*                      # Environment files per NODE_ENV
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
- Backend configuration is environment-driven via Nest ConfigModule loading `.env` files (per `NODE_ENV`) and environment variables for MQTT, Redis, Postgres, JWT, WebSocket, and quota toggles.
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

**Backend** (`backend/.env*` or environment variables):
- Server: `PORT` or `SERVER_PORT` (default `8081`), `NODE_ENV`, `SERVER_CONTEXT_PATH`
- MQTT: `MQTT_BROKER_URL` (or `MQTT_BROKER_HOST` + `MQTT_BROKER_PORT`), `MQTT_BROKER_USERNAME`, `MQTT_BROKER_PASSWORD`, `MQTT_BASE_TOPIC`, reconnect/keepalive knobs
- Database (Postgres/TypeORM): `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, plus pool tuning knobs
- Redis (quota cache): `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and quota-specific `QUOTA_REDIS_HOST`, `QUOTA_REDIS_PORT`, `QUOTA_REDIS_PASSWORD`
- Security/JWT: `JWT_SECRET`, `JWT_EXPIRES_IN` or `JWT_EXPIRATION`, `JWT_AUDIENCE`, `JWT_ISSUER`, `BCRYPT_ROUNDS`
- Quota toggles: `QUOTA_ENABLED`, `QUOTA_ROLLOUT_PERCENTAGE`, `QUOTA_ENFORCEMENT_ENABLED`, and related `quota.*` settings
- Observability: enable health via Terminus; logging via Nest logger and environment log levels

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

#### Air Conditioner Control (planned in backend)
- **URL**: `/ws/airconditioner`
- **Gateway**: NestJS WebSocket Gateway (Socket.IO)
- **Query Parameters**:
  - `roomId` – Room identifier for session subscription
  - `familyMemberId` – Authenticated household member ID
  - `token` – JWT from the Auth service

**Message Types**: AirConditionerInboundMessage, AirConditionerOutboundMessage
**Commands**: SetTemperature, SetMode, SetFanSpeed, SetPower, SetSwing, GetStatus, plus telemetry broadcasts

#### Quota Management (planned in backend)
- **URL**: `/ws/quota`
- **Gateway**: NestJS WebSocket Gateway (Socket.IO)
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

**1:1:1 Mapping (planned)**:
```
URL Path              Gateway File
───────────────────── ─────────────────────────────────────────
/ws/airconditioner → src/airconditioner/airconditioner.gateway.ts
/ws/quota          → src/quota/quota.gateway.ts
```

**Adding New Endpoints** (backend):
1. Implement a NestJS WebSocket Gateway (e.g., `*.gateway.ts`) and register it in the corresponding module.
2. Secure with Nest guards for JWT validation across HTTP and WebSocket contexts.
3. Expose client utilities in `frontend/src/lib/websocket` and surface selectors/stores for UI consumption.

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
    - Controllers: `*.controller.ts` (e.g., `room.controller.ts`)
    - Services: `*.service.ts` (e.g., `quota.service.ts`)
    - Entities/Models: `*.entity.ts` (e.g., `room.entity.ts`)
    - Gateways: `*.gateway.ts` (e.g., `quota.gateway.ts`)
    - Modules: `*.module.ts` (e.g., `quota.module.ts`)

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
  1. Install deps: `pnpm install`
  2. Build: `pnpm build`
  3. Tests: `pnpm test`
  4. E2E: `pnpm test:e2e`

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
  - NestJS modular architecture: modules → controllers → providers (services) → gateways
  - Socket.IO gateways for WebSocket communication (planned in backend)
  - TypeORM for Postgres access
  - Redis (ioredis) for quota caching
  - JWT-based authentication for REST and WebSocket endpoints (via guards)

- **DO NOT** introduce new patterns without architectural justification and approval

## Code Quality Standards

### TypeScript Guidelines
These rules apply to both `frontend/` (Next.js/React) and `backend/` (NestJS). Type safety is the top priority and must be enforced during authoring and code generation.

**Tsconfig Baseline (Strict-First)**
- Enable strict suite: `"strict": true`, `"alwaysStrict": true`, `"noImplicitAny": true`, `"noImplicitThis": true`, `"strictNullChecks": true`, `"strictBindCallApply": true`, `"strictFunctionTypes": true`.
- Strengthen optional/nullish safety: `"exactOptionalPropertyTypes": true`, `"noUncheckedIndexedAccess": true`, `"useUnknownInCatchVariables": true`.
- API clarity and control flow: `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`, `"noImplicitOverride": true`, `"noPropertyAccessFromIndexSignature": true`.
- Module hygiene: `"verbatimModuleSyntax": true`, `"importsNotUsedAsValues": "error"`, `"forceConsistentCasingInFileNames": true`, `"isolatedModules": true`.
- Project ergonomics: `"skipLibCheck": true` (build-only), appropriate `"jsx"`, `"target"`, and `"moduleResolution"` per app tooling.

**Non‑Negotiable Typing Rules**
- Never use `any`. Prefer `unknown` for untyped values and narrow before use.
- Do not use non-null assertions (`!`) except in localized, provably safe interop with a brief comment.
- Avoid broad `as` assertions. Prefer type guards, `satisfies`, and inference-preserving patterns.
- Public exports must have explicit types: exported functions, classes, constants, and module boundaries.
- Avoid `Function`, `object`, `{}` as types. Use precise callable/object types or generics with constraints.
- Use `import type` for type-only imports; keep value vs type namespaces clean with `"verbatimModuleSyntax": true`.

**Null, Optional, and Exactness**
- With `"strictNullChecks": true`, include `| null` or `| undefined` explicitly where needed; do not rely on falsy semantics.
- With `"exactOptionalPropertyTypes": true`, remember `prop?: T` means absent-or-`T`. If `undefined` is valid, spell it: `prop?: T | undefined`.
- Prefer `Readonly<T>` and `readonly` fields to encode immutability at the type level.

**Objects, Shapes, and APIs**
- Prefer `type` aliases for unions, mapped types, and utilities; prefer `interface` for extendable object shapes or declaration merging. Be consistent within a module.
- Model variant data as discriminated unions with a stable `kind`/`type` tag and enforce exhaustive checks via a `never` check in default branches.
- Avoid open index signatures. If unavoidable, include `undefined` handling and leverage `"noUncheckedIndexedAccess": true` to force presence checks.

**Unions, Narrowing, and Guards**
- Narrow unions using `typeof`, `instanceof`, `in`, and user-defined type predicates (`v is X`).
- When handling `unknown`, narrow before use; never access properties or call before a guard.
- Use truthiness checks only for existence; don’t conflate `""`, `0`, or `false` with missing.

**Generics and Constraints**
- Constrain generics for soundness: `function f<T extends Foo>(arg: T)`; avoid unconstrained generics flowing into external calls.
- Provide default generic parameters where appropriate: `function f<T = Default>(x?: T)`.
- Be mindful of parameter bivariance in callbacks; use precise function types for safety-critical callbacks.
- Package generic aliases: ALWAYS create explicit type aliases for package generics to improve readability and refactoring safety. For example:
  ```ts
  import type { Repository } from 'typeorm';
  import type { QuotaEntity } from './quota.entity';
  export type QuotaRepository = Repository<QuotaEntity>;
  ```

**Collections and Indexing**
- Prefer `readonly T[]` or `ReadonlyArray<T>` for inputs; use mutable arrays only where mutation is required.
- Use `Record<K, V>` for dictionary-like shapes where keys are known (`K extends string | number | symbol`).
- With `"noUncheckedIndexedAccess": true`, handle `arr[i]` and `record[key]` as possibly `undefined`—narrow before use.

**Enums, Literals, and Branding**
- Prefer union-of-literals (`'A' | 'B'`) over `enum` for zero-cost types; map values with `const` objects and `keyof typeof`.
- If using enums, prefer standard enums unless the build inlines `const enum` safely.
- Brand primitives to prevent ID mixing: `type UserId = string & { readonly [Brand]: 'UserId' }` with `declare const Brand: unique symbol`.

**String, Keys, and Mapped Types**
- Use `keyof` and indexed access types (`T[K]`) where applicable.
- Use template literal types to constrain string patterns, e.g., ``type ISODate = `${number}-${number}-${number}```.
- Use mapped type modifiers (`+readonly`, `-readonly`, `-?`) for precise transforms.

**Async, Errors, and Results**
- Type async APIs as `Promise<T>`; avoid implicit `any` in `await` chains.
- With `"useUnknownInCatchVariables": true`, narrow `catch (e: unknown)` via `instanceof Error` or custom guards.
- Prefer explicit results (`Result<T, E>` or discriminated unions) for library boundaries over throwing.

**React/Zustand/Rx (frontend)**
- Component props must have explicit `Props` types; use `PropsWithChildren` only when children are intended.
- Contexts: `createContext<T | null>` with a `useX()` hook that throws if missing; avoid unchecked `as` on `useContext`.
- Zustand selectors must be stable/minimal; avoid selecting entire store objects. Stream values in RxJS are never `any`; validate inputs at IO boundaries.

**NestJS/Node (backend)**
- Controllers/services must have explicit DTO types at boundaries. Use `readonly` in entities where appropriate and narrow `unknown` inputs via pipes/validators.
- Use DTOs for all request and response data across REST and WebSocket boundaries.
- Requests: define DTOs for `body`, `params`, and `query`; do not type against raw objects.
- Responses: return explicit DTOs; do not return entities or internal models directly.
- Validate DTOs with `class-validator` and `ValidationPipe`; transform to domain types in services.
- Version DTOs when contracts change; add new DTOs instead of breaking existing ones.
- Exclude sensitive fields in DTOs; never expose secrets or internal-only identifiers.
- Avoid leaking untyped `req.body`/`any`; validate with class-validator/Zod and transform to domain types.

**Runtime Validation and IO Boundaries**
- All external inputs (network, storage, websocket, MQTT) are `unknown` at runtime. Validate with Zod (or Nest pipes) and derive types via `z.infer<typeof Schema>`.
- Separate “wire” types from “domain” types; transform once at the boundary.

**Satisfies, Const, and Inference-Preserving Patterns**
- Use `satisfies` to validate object shapes while preserving literal types: `const cfg = { mode: 'cool' } satisfies Config`.
- Use `as const` to freeze literals into narrow types (readonly tuples, exact string literals).

**Overloads and Public APIs**
- Prefer overloads for user-facing API ergonomics; use one implementation signature with precise return unions.
- Exported functions should explicitly annotate returns—don’t rely on inference across package boundaries.

**Interop and Declarations**
- Augment modules via module augmentation, not globals. Avoid ambient declarations where possible.
- For untyped libraries, isolate unsafe areas with minimal `d.ts` or wrapper modules that narrow to safe return types.

**Utility Types (Use Judiciously)**
- Prefer standard utilities: `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `NonNullable`, `ReturnType`, `Parameters`, `InstanceType`.
- Build custom mapped utilities only when necessary and proven correct.

**Code Generation Rules**
- Generated code must not include `any` or non-null assertions. If unavoidable at an IO boundary, generate validation + narrowing code alongside.
- Use `import type`, `satisfies`, and `as const` where appropriate. Generate exhaustive `switch` with a `never` check for discriminated unions.

**Review Checklist**
- Are all exports explicitly typed? Any `any`, `!`, or broad `as` left?
- Are unions narrowed and switches exhaustive (`never` check present)?
- Are optionals modeled with exactness (`exactOptionalPropertyTypes`)?
- Are collections readonly by default? Are generics constrained and defaults provided where relevant?
- Are IO boundaries validated and separated from domain types? Are type-only imports used correctly?

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
- **Node/TypeScript Conventions**: Follow NestJS and TypeScript best practices
- **Nest Patterns**: Use modules, controllers, providers (services), and gateways appropriately
- **Error Handling**: Use HTTP exceptions/filters and consistent status codes
- **Testing**: Write Jest unit tests for business logic and E2E tests where appropriate

#### NestJS Conventions & Best Practices
- Modules
  - Organize by feature: create one `*.module.ts` per domain (e.g., `rooms`, `devices`, `quota`).
  - Keep module boundaries clear: export only what other modules need via `exports`.
  - Prefer feature imports over global scope; use `@Global()` sparingly for cross-cutting concerns.
  - Re-export shared modules from a `CoreModule` when many features depend on them.
  - Use dynamic modules (`forRoot/forRootAsync`) for configurable libraries and infrastructure.
- Providers & DI
  - Inject dependencies via constructors; avoid manually instantiating classes.
  - Default scope is singleton; use request/transient scope only when justified.
  - Use explicit tokens for interface-like contracts; favor factory providers for config-heavy services.
  - Register global concerns with `APP_GUARD`, `APP_INTERCEPTOR`, `APP_FILTER`, `APP_PIPE`.
- Controllers
  - Keep controllers thin: delegate logic to services.
  - Validate inputs with DTOs + `class-validator`; enable a global `ValidationPipe`.
  - Use route versioning and clear HTTP semantics (status codes, exceptions).
- Guards, Pipes, Interceptors, Filters, Middleware
  - Guards: authorization/authn; Pipes: transform/validate; Interceptors: cross-cutting (logging, caching, timing); Filters: map errors.
  - Register globally when behavior is app-wide; otherwise prefer decorator-scoped usage.
  - Be mindful of execution order: middleware → guards → interceptors → pipes → controller → interceptors (after) → filters.
- Configuration
  - Use `@nestjs/config` with schema validation; avoid direct `process.env` access outside config.
  - Load per-env `.env` files; access via `ConfigService` and config namespaces.
  - Centralize security secrets and connection strings; never hardcode.
- WebSockets (Socket.IO)
  - Implement namespaced gateways (`*.gateway.ts`) with DTO validation pipes.
  - Secure with JWT guards for handshakes; configure CORS and transport explicitly.
  - Scale with the Redis adapter when running multiple instances.
- Persistence (TypeORM)
  - Inject repositories via `@InjectRepository`; keep entities simple and migration-friendly.
  - Disable `synchronize` in non-dev; prefer migrations for schema changes.
  - Encapsulate transactions in services; avoid leaking ORM details to controllers.
- Redis (ioredis)
  - Provide clients via DI tokens; reuse connections and implement health checks.
  - Use separate logical databases or prefixes for quota vs. general caching.
- Testing
  - Unit: test services/controllers with mocks; avoid hitting real IO.
  - E2E: use `@nestjs/testing` + Supertest; spin up app with test config.
  - Favor TestingModule for integration-level wiring; isolate external dependencies.
- Caching & Throttling
  - Use CacheModule/Cache Interceptor for idempotent GET endpoints; set TTLs from config.
  - Apply `@nestjs/throttler` for rate limiting on public endpoints.
- Structure & Boundaries
  - Group by feature folders; place `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts` together.
  - Put cross-cutting infrastructure under `shared/` and configuration under `common/config/`.
- Security
  - Use bcrypt rounds from config; never log secrets.
  - Enforce CORS from config; sanitize error responses in filters.
- Observability & Performance
  - Use interceptors for request logging/metrics; expose Terminus `/health` probes.
  - Tune database pools and Redis retries from config; add timeouts/circuit breakers where needed.

##### NestJS Code Examples
```ts
// main.ts — Global ValidationPipe, CORS, and logging
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.enableCors({ origin: '*', credentials: false });
  await app.listen(process.env.PORT || 8081);
}
bootstrap();
```

```ts
// dynamic-redis.module.ts — Dynamic module with forRootAsync
import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({})
export class DynamicRedisModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DynamicRedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: (config: ConfigService) => new Redis({
            host: config.get('redis.host'),
            port: config.get('redis.port'),
            password: config.get('redis.password'),
          }),
          inject: [ConfigService],
        },
      ],
      exports: ['REDIS_CLIENT'],
    };
  }
}
```

```ts
// quota.gateway.ts — Socket.IO Gateway with JWT guard
import { UseGuards } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@UseGuards(JwtWsGuard)
@WebSocketGateway({ namespace: '/ws/quota', cors: { origin: '*' }, transports: ['websocket'] })
export class QuotaGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() dto: SubscribeDto) {
    // validate dto with pipes, join rooms, emit snapshots, etc.
  }
}
```

```ts
// quota.service.ts — TypeORM repository injection
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaEntity } from './quota.entity';

@Injectable()
export class QuotaService {
  constructor(@InjectRepository(QuotaEntity) private readonly repo: Repository<QuotaEntity>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }
}
```

```ts
// app.module.ts — Global guard registration
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtHttpGuard },
  ],
})
export class AppModule {}
```

```ts
// e2e.spec.ts — E2E test with TestingModule + Supertest
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
```

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
  - **NestJS Implementation Research & Comparison**:
    - Research 2–3 viable approaches for each decision (e.g., Repository vs. Active Record; Guards vs. Interceptors vs. Middleware; Providers vs. Factories; module vs. feature organization; sync vs. async config)
    - Use a trade-off matrix to compare options:
      ```
      Approach            | Performance | Maintainability | Testability | Complexity | Use Case Fit
      --------------------|-------------|-----------------|------------|------------|-------------
      Repository Pattern  | High        | High            | High       | Medium     | Complex queries
      Active Record       | Medium      | Medium          | Low        | Low        | Simple CRUD
      Custom Provider     | High        | Medium          | High       | High       | Specialized logic
      ```
    - Document decision rationale with concrete code examples of the chosen pattern(s)
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
1. Provision the room through the backend API (Nest controller) or via the admin UI – the frontend consumes REST responses rather than static YAML.
2. Ensure the MQTT topic mapping for any new device is defined on both sides:
   - Backend: update the appropriate mapper/service so commands route to the correct topic.
   - Frontend: extend `frontend/src/lib/mqtt/mqtt-config.ts` (or the dynamic mapping service if introduced) with the new topic constants and validation schema entries.
3. Synchronize types by updating `frontend/src/types/room.ts` and any related Zod validators.
4. If persistence defaults are needed, add TypeORM migrations and seed data accordingly.
5. Exercise `room-store.fetchRooms()` and the REST integration tests to verify CRUD paths.

### Extending AC Controls
1. Expand `MQTT_TOPICS`, `VALID_VALUES`, and `mqttMessageSchemas` in `frontend/src/lib/mqtt/mqtt-config.ts` for the new capability.
2. Update `api-aircon-store` and related stores to emit the new command/state fields and expose stable selectors.
3. Introduce UI affordances inside `frontend/src/components/AirConRemote.tsx` or the quota-aware wrappers, ensuring touch targets remain ≥44px.
4. Queue backend work: add command handling in a NestJS WebSocket Gateway (planned in backend) and register new command names.
5. Extend the REST API (if needed) so analytics and history endpoints surface the additional data – remember to cover it with controller/service tests.

### Working with MQTT & WebSocket Clients
- MQTT bootstraps in `frontend/src/lib/mqtt/mqtt-client.ts`; reuse the exported singleton through `AirconProvider` to avoid duplicate connections.
- Device telemetry now flows through `DeviceWebSocketProvider`. Never access the raw store directly—select methods via `useShallow` selectors to prevent render loops.
- Quota messaging lives in `frontend/src/lib/quota/quota-websocket.tsx`; throttle reconnection attempts using the provided `forceReconnect` helper rather than rebuilding your own socket logic.
- When adding a new WebSocket channel, implement a NestJS Gateway (e.g., `*.gateway.ts`) and surface a typed hook under `frontend/src/lib/websocket`.

### Authentication & Authorization
- Auth flows are centralized in `frontend/src/lib/auth`; extend token acquisition or refresh logic there so both Axios and WebSocket clients inherit the change.
- Backend JWT validation occurs via Nest guards/middleware across HTTP and WebSocket contexts—update both if the token shape changes.
- Keep `AuthProvider` selectors narrow when exposing new actions to avoid re-render storms.

### Quota System Enhancements
- Quota configuration is defined via environment variables consumed in `backend/src/common/config/quota.config.ts`; adjust feature flags using environment variables for local testing.
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
- Verify frontend environment variable
```bash
echo $NEXT_PUBLIC_MQTT_BROKER_URL
```
- Ensure backend devices are subscribing to the same base topic defined by `MQTT_BASE_TOPIC`.
- If TLS is required, configure the `mqtt-client.ts` options and backend environment variables accordingly.

**WebSocket Issues**:
- AirConditioner/Quota sockets require a valid JWT; generate via `POST /api/auth/login` and append `token=<jwt>` to the query string.
- Use `wscat -c "ws://localhost:8081/ws/quota?quotaId=daily-limit&roomId=living-room&familyMemberId=user123&token=..."` to validate payloads.
- Check the backend logs for `WebSocketJwtAuthHandler` warnings to diagnose token expiration or scope mismatches.

**Frontend Issues**:
- Stale caches: clear the in-memory caches exposed by API clients using their `clearCache` helpers (where available) or reload the store by calling `fetchRooms`/`refreshDevices`.
- Zustand selector loops: confirm you're selecting primitives or memoized callbacks only; refer to `unified-room-selectors` for patterns.
- Service worker conflicts: run `pnpm dev --turbo` with `ServiceWorkerCleaner` rendered to purge stale Serwist registrations.
- Type errors: run type checking (`pnpm exec tsc --noEmit`).
- MQTT messages not received: verify topic subscriptions in the browser console and confirm mapping in `frontend/src/lib/mqtt/mqtt-config.ts`.

**Backend Issues**:
- Database connectivity: ensure Postgres is reachable and TypeORM connection settings match env; run migrations if applicable.
- Redis quota cache: `redis-cli -h ${QUOTA_REDIS_HOST:-localhost} ping` verifies availability; quota updates depend on it.
- MQTT session churn: inspect Nest application logs for reconnect storms; tune `MQTT_RECONNECT_*` variables as needed.
- WebSocket connectivity: validate Socket.IO transport and CORS via Nest logger; confirm JWT guard behavior if enabled.

**Development Tools**:
- React DevTools and Zustand Inspector for store analysis
- MQTT Explorer (or command-line `mosquitto_sub`) for topic validation
- `wscat`, Insomnia, or Postman for WebSocket testing
- RedisInsight / `redis-cli monitor` for quota cache activity
- Terminus health endpoints (`http://localhost:8081/health`, `/health/database`, `/health/redis`, `/health/mqtt`) for service health

### Logging and Monitoring
- Frontend: set `localStorage.setItem('debug', 'mqtt*')` for verbose MQTT logging, and enable Zustand logging utilities in development builds.
- Backend: leverage Terminus health checks. Adjust log levels via environment and Nest logger configuration.
- Use the performance monitors in `frontend/src/lib/performance` to profile WebSocket latency and render timelines; tests live alongside the monitors for regression coverage.

## Error Handling Patterns

### MQTT stream errors (RxJS)
```ts
import { catchError, of, retry } from 'rxjs';

airconStream$
  .pipe(
    catchError((error) => {
      console.error('MQTT stream error:', error);
      return of(null); // safe fallback
    }),
    retry({ count: 3, delay: 1000 })
  )
  .subscribe();
```

### Zod validation failures
```ts
const result = mqttMessageSchema.safeParse(message);
if (!result.success) {
  console.error('Invalid MQTT message:', result.error);
  // Do not update state on invalid data
  return;
}
```

### React error boundaries
```tsx
<ErrorBoundary fallback={<MqttConnectionError />}>
  <AirConRemote />
</ErrorBoundary>
```

### NestJS exception handling
```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }
    res.status(status).json({ statusCode: status, message, timestamp: new Date().toISOString() });
  }
}
```

## Security Best Practices

### MQTT security
- Use username/password for MQTT; prefer WSS for production.
- Restrict topic access by role; apply connection rate limiting.

### Environment security
- Never hardcode credentials; isolate per environment; restrict `.env` access.
- Use a secret manager (Docker secrets or vault) in production.

### Frontend security
- Configure CSP headers; serve over HTTPS; validate inputs with Zod; sanitize dynamic content.

### API security
- Configure CORS appropriately; apply rate limiting; validate all incoming requests; avoid leaking sensitive info in errors.

## Performance Guidelines

### Frontend optimization
- Analyze bundles; code split non-critical components; debounce/throttle rapid MQTT-driven updates; memoize expensive components.

### MQTT performance
- Keep payloads small; unsubscribe when unused; reuse connections; batch rapid state updates to reduce rerenders.

### Backend performance
- Tune DB pools; cache hot paths in Redis; use async processing; use Socket.IO rooms/namespaces efficiently.

## Important Implementation Details

- Spec-driven workflow remains mandatory: author `spec.md`, `design.md`, and `implementation.md` under `docs/specs/<feature>/` before coding.
- Rooms, devices, and quotas are API-first now; avoid reintroducing static YAML unless providing a fallback path.
- MQTT, REST, and WebSocket data must converge through the existing stores—reuse their selectors before introducing new global state.
- Auth tokens gate every network path; keep Axios interceptors and WebSocket factories in sync when introducing new authentication behaviors.
- Quota features rely heavily on Redis—guard against introducing long-lived blocking calls that would stall the event loop.
- Device simulations live in `demo-aircon-store` and related components; prefer them over ad-hoc mocks when building new UI interactions.
- Continue updating the steering documents as requirements evolve; ensure traceability from implementation back to design/spec remains intact.
