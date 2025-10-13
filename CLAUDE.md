# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Mitsubishi Air Conditioner Remote Control** PWA built with Next.js 15 and React 19. The application provides a web-based interface to control Mitsubishi AC units via MQTT communication, designed to work with mitsubishi2mqtt bridge software.

## Development Commands

**Frontend Development** (from `/frontend` directory):
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

**Backend Development** (from `/backend/mitsubishi-controller` directory):
```bash
# Run with Maven wrapper
./mvnw spring-boot:run

# Build the project
./mvnw clean compile

# Run tests
./mvnw test

# Package the application
./mvnw package

# Run with Docker Compose
docker compose up --build
```

**Docker Development**:
```bash
# Build and run with Docker Compose (from frontend directory)
docker-compose up --build

# Or using compose.yaml
docker compose up --build
```

## Testing Strategy

**Frontend Testing** (from `/frontend` directory):
```bash
# Run all tests (if configured)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm type-check
```

**Backend Testing** (from `/backend/mitsubishi-controller` directory):
```bash
# Run all tests
./mvnw test

# Run specific test class
./mvnw test -Dtest=MitsubishiControllerApplicationTests

# Run tests with coverage
./mvnw test jacoco:report

# Integration tests
./mvnw verify
```

**Key Testing Areas**:
- **MQTT Message Validation**: Test Zod schemas with valid/invalid payloads
- **RxJS Observables**: Test MQTT message stream processing
- **Zustand Store**: Test state updates and room-based data management
- **React Components**: Test AC control interactions and real-time updates
- **Spring Boot Services**: Test REST endpoints and business logic

## Architecture Overview

### Core Technologies

**Frontend**:
- **Framework**: Next.js 15 (App Router) with React 19
- **State Management**: Zustand + React Context for MQTT client state
- **Real-time Communication**: MQTT.js with RxJS observables
- **Styling**: Tailwind CSS with Radix UI components
- **Configuration**: YAML-based app config with Zod validation
- **PWA**: Service Worker with Serwist

**Backend**:
- **Framework**: Spring Boot 3.5.5 with Java 21
- **Build Tool**: Maven with Maven Wrapper
- **Dependencies**: Spring Web, Spring DevTools, Lombok
- **Testing**: Spring Boot Test framework

### Directory Structure
```
frontend/src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # Reusable UI components (Radix-based)
│   ├── AirConRemote.tsx # Main AC control interface
│   └── AirconProvider.tsx # MQTT context provider
├── lib/
│   ├── config/         # App configuration (YAML loading)
│   ├── env/            # Environment variable validation
│   ├── mqtt/           # MQTT client and configuration
│   └── utils.ts        # Utility functions
├── stores/             # Zustand store definitions
└── hooks/              # Custom React hooks

backend/mitsubishi-controller/
├── src/main/java/       # Java source code
│   └── com/ashelabs/mitsubishicontroller/
├── src/main/resources/  # Configuration files (application.properties)
├── src/test/java/       # Test files
├── pom.xml              # Maven project configuration
└── compose.yaml         # Docker Compose configuration
```

### State Management Architecture

**MQTT Integration**:
- Uses RxJS observables to handle MQTT message streams
- `AirconProvider` wraps the app and provides MQTT client context
- Zustand store (`aircon-store.ts`) manages AC state per room
- Real-time bidirectional sync between MQTT broker and UI state

**Key State Flow**:
1. MQTT messages received via RxJS observable stream
2. Messages parsed and validated using Zod schemas
3. State updated in Zustand store by room ID
4. UI components reactively update via React Context

### Configuration System

**App Configuration** (`config/app-config.yaml`):
- Defines rooms and their corresponding MQTT topic IDs
- Loaded server-side and passed to client components
- Validated using Zod schema in `lib/config/config.ts`

### Environment Configuration

**Required Environment Variables** (validated in `lib/env/config.ts`):

**Frontend** (`.env` in `/frontend` directory):
```bash
# MQTT Broker Configuration (WebSocket connection)
NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:9001
NEXT_PUBLIC_MQTT_BROKER_PORT=9001
NEXT_PUBLIC_MQTT_BROKER_USERNAME=your_mqtt_username
NEXT_PUBLIC_MQTT_BROKER_PASSWORD=your_mqtt_password

# App Configuration (optional)
NEXT_PUBLIC_APP_CONFIG_PATH=/custom/path/to/config.yaml

# Development
NODE_ENV=development
```

**Backend** (`.env` or `application.properties`):
```bash
# Server Configuration
SERVER_PORT=8080
SPRING_PROFILES_ACTIVE=development

# Database (if applicable)
# SPRING_DATASOURCE_URL=jdbc:h2:mem:testdb
```

**Security Notes**:
- Never commit `.env` files to version control
- Use different credentials for development/staging/production
- MQTT credentials should be stored securely in production
- Consider using Docker secrets for production deployments

### MQTT Topics and Message Structure

**Base Topic Pattern**: `mitsubishi2mqtt/{room_id}`

**Topic Types**:
- `/mode/set` - AC mode (off, heat, cool, etc.)
- `/temp/set` - Target temperature
- `/fan/set` - Fan speed
- `/vane/set` - Vertical vane position  
- `/wideVane/set` - Horizontal vane position
- `/settings` - Current AC settings (inbound)
- `/state` - Current AC state including room temperature (inbound)
- `/system/set` - System commands (reboot)

All MQTT message schemas are defined and validated in `lib/mqtt/mqtt-config.ts` using Zod.

### WebSocket Endpoints

**URL Pattern**: `/ws/{feature}?{context-params}`

**Available Endpoints**:

#### Air Conditioner Control
- **URL**: `/ws/airconditioner`
- **Handler**: `AirConditionerWebSocketHandler`
- **Package**: `websocket/airconditioner/`
- **Query Parameters**:
  - `roomId` (required) - Room identifier for AC control
  - `familyMemberId` (required) - User/family member identifier
  - `token` (required) - JWT authentication token

**Example**:
```
ws://localhost:8080/ws/airconditioner?roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

**Message Types**: AirConditionerInboundMessage, AirConditionerOutboundMessage
**Commands**: 6 commands (SetTemperature, SetMode, SetFanSpeed, SetPower, SetSwing, GetStatus)

#### Quota Management
- **URL**: `/ws/quota`
- **Handler**: `QuotaWebSocketHandler`
- **Package**: `websocket/quota/`
- **Query Parameters**:
  - `quotaId` (required) - Quota identifier
  - `roomId` (required) - Room identifier
  - `familyMemberId` (required) - User/family member identifier
  - `token` (required) - JWT authentication token

**Example**:
```
ws://localhost:8080/ws/quota?quotaId=daily-limit&roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

**Message Types**: QuotaInboundMessage, QuotaOutboundMessage
**Commands**: 5 commands (Subscribe, Unsubscribe, OverrideRequest, OverrideApproval, HealthCheck)

### WebSocket URL Naming Convention

**Pattern**: `/ws/{feature}?{context-params}`

**Components**:
- **Base**: `/ws` - WebSocket endpoint namespace
- **Feature**: `/{feature}` - Device or capability type (airconditioner, quota, lights)
- **Context**: `?{params}` - Instance-specific parameters (roomId, token, etc.)

**1:1:1 Mapping**:
```
URL Path              Handler Class                    Package
───────────────────── ──────────────────────────────── ─────────────────────────────
/ws/airconditioner → AirConditionerWebSocketHandler → websocket/airconditioner/
/ws/quota          → QuotaWebSocketHandler          → websocket/quota/
/ws/lights         → LightsWebSocketHandler         → websocket/lights/ (future)
```

**Adding New Endpoints**:
1. Create handler extending `BaseWebSocketHandler`
2. Add URL mapping in `WebSocketConfig.java`
3. Create package structure: `websocket/{feature}/`
4. Follow existing command and message patterns

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

**CRITICAL**: These rules are **non-negotiable** and apply to ALL code modifications, refactoring, and architectural changes.

**1. No New Files Without Explicit Approval**
- **NEVER** create new files with variant names (`FooRefined.ts`, `UnifiedBar.tsx`, `EnhancedBaz.java`, `*V2`, `*New`, etc.) without explicit written approval
- **STOP** and ask for permission before generating any new file or module
- This includes components, utilities, stores, services, hooks, or any code artifact

**2. All Edits Must Be In-Place Using Diff/Patch Mode**
- Provide **diff or patch** modifications to existing files only
- Do **NOT** output full file replacements unless absolutely necessary and approved
- Preserve existing file structure and location unless explicitly directed otherwise

**3. New Abstractions Require Justification & Approval**
- If a new abstraction, module, or architectural pattern is needed:
  1. **STOP** immediately
  2. Document your justification:
     - What abstraction/pattern is needed
     - Why it's necessary (specific problem it solves)
     - How it integrates with existing architecture
     - Alternative approaches considered
  3. **WAIT** for explicit approval before proceeding
  4. Only after approval, implement with **canonical naming** (no prompt-style adjectives)

**4. Naming Discipline**
- **NEVER** echo prompt adjectives into code:
  - ❌ `EnhancedComponent`, `UnifiedStore`, `ImprovedService`, `RefactoredUtil`
  - ✅ Use names consistent with existing architecture and naming conventions
- Follow established naming patterns:
  - React Components: PascalCase (`AirConRemote.tsx`)
  - Utilities/Hooks: camelCase (`useAircon.ts`, `formatTemperature.ts`)
  - Stores: kebab-case with suffix (`room-store.ts`, `auth-store.ts`)
  - Types: PascalCase (`AirConState`, `RoomDevice`)

**5. No Logic Duplication Across Files**
- If logic is moved or refactored:
  - **Original code MUST be removed or properly deprecated**
  - If deprecating, add clear redirect/forwarding to new location
  - **NEVER** leave duplicate implementations across files
  - Update all imports and references

**6. Post-Change Validation Required**
- After **every** modification, run validation in sequence:
  1. Type checking: `pnpm exec tsc --noEmit` (frontend) or `./mvnw compile` (backend)
  2. Linting: `pnpm lint` (frontend) or `./mvnw checkstyle:check` (backend, if configured)
  3. Tests: `pnpm test` (frontend) or `./mvnw test` (backend)
  4. Build: `pnpm build` (frontend) or `./mvnw package` (backend)
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

**8. Explain Before Performing**
- For **any non-trivial refactor** (especially file moves, renames, or architectural changes):
  1. Output a **short plan/justification** first (3-5 bullet points)
  2. Explain:
     - What will change
     - Why it's necessary
     - Impact on existing code
     - Risk assessment
  3. **WAIT** for approval before applying changes
  4. Only proceed after receiving explicit confirmation

**9. Incremental Migration Strategy**
- When refactoring must happen:
  1. Create migration plan with clear phases
  2. Maintain backward compatibility during transition
  3. Update documentation and tests incrementally
  4. Verify each phase before proceeding
  5. Remove old code only after full migration is confirmed working

**10. Architecture Preservation**
- Respect existing architectural patterns:
  - State management via Zustand stores
  - MQTT communication through RxJS observables
  - React Context for dependency injection
  - Component composition with ShadcnUI
  - Backend layered architecture (domain, service, controller)
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
- **Spring Boot Won't Start**: Check application.properties and port conflicts
- **Maven Build Fails**: Run `./mvnw clean install` to refresh dependencies
- **Tests Failing**: Run individual tests to isolate issues

**Development Tools**:
- **React DevTools**: Install browser extension for component inspection
- **MQTT Client**: Use tools like MQTT Explorer to monitor topics
- **Network Tab**: Monitor WebSocket connections in browser DevTools
- **Spring Boot Actuator**: Enable for health checks and metrics

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
# Enable debug logging in application.properties
logging.level.com.ashelabs.mitsubishicontroller=DEBUG
logging.level.org.springframework.web=DEBUG
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
7. **Follow Zustand v5 patterns** - NEVER access entire store object, always use specific selectors
8. **Follow ShadcnUI styling patterns** - Use proper component integration and consistent design
9. **Ensure mobile accessibility** - Minimum 44px touch targets, responsive design, theme support
10. Consider the room-based multi-unit architecture
11. Ensure MQTT message validation is maintained for new features
12. Test components in both light and dark themes
13. Update steering documents as requirements evolve
14. **Code review checklist**: Function size (<20 lines), class responsibility, interface segregation, dependency direction

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

### Spring Boot Error Handling
```java
// Global exception handler
@ControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(MqttException.class)
  public ResponseEntity<String> handleMqttError(MqttException e) {
    return ResponseEntity.status(503).body("MQTT service unavailable");
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
- **Connection Pooling**: Configure appropriate database/MQTT connection pools
- **Caching**: Implement caching for frequently accessed data
- **Async Processing**: Use async patterns for non-blocking operations
- **Resource Management**: Properly close connections and clean up resources