# Project Structure

## Root Organization

```
/
├── backend/turing/          # Spring Boot backend application
├── frontend/                # Next.js frontend application
├── docs/                    # Project documentation and specs
├── .kiro/                   # Kiro IDE configuration and steering
└── .claude/                 # Claude AI configuration (legacy)
```

## Backend Structure (`backend/turing/`)

### Source Organization
```
src/main/java/com/ashelabs/turing/
├── config/                  # Spring configuration classes
├── controller/              # REST API controllers
├── converter/               # Data type converters
├── dto/                     # Data Transfer Objects
├── entity/                  # JPA/R2DBC entities
├── handler/                 # WebFlux handlers
├── repository/              # Data access repositories
├── service/                 # Business logic services
└── websocket/               # WebSocket handlers
```

### Key Patterns
- **Controllers**: REST endpoints following `/api/{feature}` pattern
- **Services**: Business logic with reactive return types (`Mono<T>`, `Flux<T>`)
- **Repositories**: R2DBC reactive repositories
- **DTOs**: Request/response objects separate from entities
- **Configuration**: Feature-specific config classes (MQTT, Security, etc.)

## Frontend Structure (`frontend/src/`)

### App Router Organization
```
src/
├── app/                     # Next.js App Router pages
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # Main dashboard and family management
│   ├── quota/              # Quota management interface
│   └── rooms/              # Room-specific controls
├── components/             # Reusable React components
│   ├── auth/               # Authentication forms
│   ├── family/             # Family management components
│   ├── quota/              # Quota-related components
│   ├── room/               # Room control components
│   └── ui/                 # Base UI components (shadcn/ui style)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility libraries and clients
├── stores/                 # Zustand state management
└── types/                  # TypeScript type definitions
```

### Key Patterns
- **Feature-based components**: Organized by business domain
- **Custom hooks**: Reusable logic for API calls and state
- **Type-safe APIs**: Full TypeScript coverage with Zod validation
- **Responsive design**: Mobile-first with PWA capabilities

## Documentation Structure (`docs/`)

### Spec-Driven Development
```
docs/specs/
└── [feature-name]/
    ├── spec.md              # Requirements specification
    ├── design.md            # Technical design
    └── implementation.md    # Implementation plan
```

## Configuration Patterns

### Backend Configuration
- **Environment-based**: `application-{profile}.properties`
- **Feature toggles**: Quota system with rollout controls
- **Docker-ready**: Environment variable overrides

### Frontend Configuration
- **Environment files**: `.env` for local development
- **Build-time config**: `next.config.ts` for build optimization
- **Runtime config**: YAML-based app configuration

## Naming Conventions

- **Java**: PascalCase for classes, camelCase for methods/variables
- **TypeScript**: PascalCase for components, camelCase for functions
- **Files**: kebab-case for component files, PascalCase for class files
- **API endpoints**: RESTful with plural nouns (`/api/users`, `/api/quotas`)
- **Database**: snake_case for tables and columns