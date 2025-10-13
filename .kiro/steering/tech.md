# Technology Stack

## Backend (Java Spring Boot)

- **Framework**: Spring Boot 3.5.5 with WebFlux (reactive programming)
- **Java Version**: Java 21
- **Build Tool**: Maven
- **Database**: PostgreSQL with R2DBC (reactive database connectivity)
- **Caching**: Redis for quota management and session storage
- **Message Broker**: MQTT (Eclipse Paho client) for AC device communication
- **Security**: JWT authentication with Spring Security
- **Migration**: Flyway for database schema management
- **Monitoring**: Spring Actuator with Prometheus metrics

## Frontend (Next.js)

- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Package Manager**: pnpm
- **State Management**: Zustand
- **HTTP Client**: Axios with retry logic
- **Real-time**: WebSocket and MQTT clients
- **PWA**: Serwist for service worker and offline capabilities
- **UI Components**: Radix UI primitives

## Development & Deployment

- **Containerization**: Docker Compose for local development
- **Environment Management**: Profile-based configuration (dev/test/prod)
- **Code Quality**: ESLint, TypeScript strict mode
- **Testing**: Vitest (frontend), JUnit + Testcontainers (backend)

## Common Commands

### Backend
```bash
# Development
./mvnw spring-boot:run
./mvnw spring-boot:run -Pdebug  # Debug mode on port 5005

# Build
./mvnw clean package
./mvnw clean install

# Testing
./mvnw test
./mvnw verify

# Docker
docker-compose up turing-server
```

### Frontend
```bash
# Development
pnpm dev

# Build
pnpm build
pnpm start

# Testing
pnpm test
pnpm lint

# Package management
pnpm install
pnpm add <package>
```

## Architecture Patterns

- **Reactive Programming**: Non-blocking I/O with WebFlux and R2DBC
- **Event-Driven**: MQTT pub/sub for device communication
- **Feature-Based Organization**: Code organized by business features
- **Spec-Driven Development**: Requirements → Design → Implementation workflow