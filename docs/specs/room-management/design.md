# Room Management - Technical Design Document

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Room Mgmt Page │→ │ Room Store   │→ │ Room API Client │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────────────┬──────────────────────────┘
                                   │ REST API
                        ┌──────────▼──────────┐
                        │   API Gateway       │
                        └──────────┬──────────┘
┌─────────────────────────────────▼────────────────────────────┐
│                    Backend (Spring Boot)                      │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │Room         │ → │ Room         │ → │ Room             │ │
│  │Controller   │   │ Service      │   │ Repository       │ │
│  └─────────────┘   └──────────────┘   └──────────────────┘ │
│                           │                     │             │
│                    ┌──────▼──────┐             │             │
│                    │ Room        │             │             │
│                    │ Validator   │             │             │
│                    └─────────────┘             │             │
└─────────────────────────────────────────────────┼────────────┘
                                                  │
                                        ┌─────────▼─────────┐
                                        │   PostgreSQL      │
                                        │  (rooms table)    │
                                        └───────────────────┘
```

### 1.2 Technology Stack

**Backend:**
- Spring Boot 3.5.5 (Java 21)
- Spring Data R2DBC (Reactive database access)
- PostgreSQL 14+
- Reactor (Reactive programming)
- Flyway (Database migrations)

**Frontend:**
- Next.js 15 + React 19
- TypeScript (strict mode)
- Zustand v5 (State management)
- Axios (HTTP client)
- Zod (Validation)
- ShadcnUI + Radix UI (Components)

## 2. Clean Code Principles Application

### 2.1 DRY (Don't Repeat Yourself)

**Implementations:**
1. **RoomValidator** - Centralized validation logic
   ```java
   public class RoomValidator {
       public static ValidationResult validateName(String name) { ... }
       public static ValidationResult validateRoomIdentifier(String identifier) { ... }
   }
   ```

2. **RoomIdentifierGenerator** - Centralized slug generation
   ```java
   public class RoomIdentifierGenerator {
       public static String generateFromName(String name) {
           return name.toLowerCase()
               .replaceAll("[^a-z0-9\\s-]", "")
               .replaceAll("\\s+", "-");
       }
   }
   ```

3. **Base error handling** - Reusable error response patterns
4. **Shared DTOs** - Room models used across frontend and documented in API

### 2.2 SOLID Principles

**Single Responsibility Principle (SRP):**
- `Room` (Entity): Data representation only
- `RoomRepository`: Data access only
- `RoomService`: Business logic only
- `RoomController`: HTTP handling only
- `RoomValidator`: Validation only
- `RoomMapper`: DTO↔Entity conversion only

**Open/Closed Principle (OCP):**
- RoomService is interface-based (open for extension)
- Validation rules configurable via constants
- Slug generation strategy can be replaced via RoomIdentifierGenerator

**Liskov Substitution Principle (LSP):**
- Any RoomService implementation must honor contract
- Repository extends R2DBCRepository (maintains contract)

**Interface Segregation Principle (ISP):**
- Separate DTOs: CreateRoomRequest, UpdateRoomRequest, RoomResponse
- Focused interfaces instead of one large DTO

**Dependency Inversion Principle (DIP):**
- Controller depends on RoomService **interface**
- Service depends on RoomRepository **interface**
- All dependencies injected via constructor

### 2.3 YAGNI (You Ain't Gonna Need It)

**Avoided over-engineering:**
- ❌ Room templates (can add later if needed)
- ❌ Room hierarchy/grouping (not in current requirements)
- ❌ Caching layer (add only if performance issues)
- ❌ Event sourcing (simple CRUD sufficient)
- ❌ Complex authorization (role-based sufficient)

## 3. Design Patterns

### 3.1 Repository Pattern
**Score: 4.5/5**

**Implementation:**
```java
public interface RoomRepository extends R2dbcRepository<Room, UUID> {
    Flux<Room> findByHouseholdId(UUID householdId);
    Mono<Room> findByHouseholdIdAndRoomIdentifier(UUID householdId, String roomIdentifier);
    Mono<Long> countByHouseholdIdAndName(UUID householdId, String name);
}
```

**Benefits:**
- Abstracts data access
- Testable (can mock repository)
- Centralized query definitions

**Trade-offs:**
- Complexity: Low (Spring Data R2DBC provides implementation)
- Benefit: High (clean separation, testability)

### 3.2 Service Layer Pattern
**Score: 4.8/5**

**Implementation:**
```java
public interface RoomService {
    Mono<RoomResponse> createRoom(UUID householdId, CreateRoomRequest request);
    Flux<RoomResponse> getRooms(UUID householdId);
    Mono<RoomResponse> getRoom(UUID householdId, UUID roomId);
    Mono<RoomResponse> updateRoom(UUID householdId, UUID roomId, UpdateRoomRequest request);
    Mono<Void> deleteRoom(UUID householdId, UUID roomId);
}
```

**Benefits:**
- Encapsulates business logic
- Transaction management
- Reusable across controllers

**Trade-offs:**
- Complexity: Medium (requires interface + implementation)
- Benefit: Very High (testability, reusability, maintainability)

### 3.3 DTO Pattern
**Score: 4.5/5**

**Implementation:**
```java
public record CreateRoomRequest(
    String name,
    String location,
    String description
) {}

public record RoomResponse(
    UUID id,
    String name,
    String roomIdentifier,
    String location,
    String description,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
```

**Benefits:**
- Clear API contract
- Validation at API boundary
- Security (entity not exposed)

**Trade-offs:**
- Complexity: Medium (mapping required)
- Benefit: High (API clarity, security)

### 3.4 Validator Pattern
**Score: 5.0/5**

**Implementation:**
```java
public class RoomValidator {
    public static final int MIN_NAME_LENGTH = 2;
    public static final int MAX_NAME_LENGTH = 100;

    public static ValidationResult validateName(String name) {
        List<String> errors = new ArrayList<>();
        if (name == null || name.isBlank()) {
            errors.add("Room name cannot be empty");
        } else if (name.length() < MIN_NAME_LENGTH) {
            errors.add("Room name must be at least " + MIN_NAME_LENGTH + " characters");
        } else if (name.length() > MAX_NAME_LENGTH) {
            errors.add("Room name cannot exceed " + MAX_NAME_LENGTH + " characters");
        }
        return new ValidationResult(errors);
    }
}
```

**Benefits:**
- Reusable validation logic
- Highly testable
- Centralized rules

**Trade-offs:**
- Complexity: Very Low
- Benefit: High (DRY, testability)

### 3.5 Factory Pattern (Slug Generation)
**Score: 4.0/5**

**Implementation:**
```java
public class RoomIdentifierGenerator {
    public static String generateFromName(String name) {
        return name.toLowerCase()
            .replaceAll("[^a-z0-9\\s-]", "")
            .trim()
            .replaceAll("\\s+", "-")
            .replaceAll("-+", "-");
    }
}
```

**Benefits:**
- Consistent slug generation
- Easy to test
- Changeable strategy

**Trade-offs:**
- Complexity: Very Low
- Benefit: Medium (consistency)

## 4. Database Design

### 4.1 Rooms Table Schema

```sql
CREATE TABLE rooms (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    -- Room Data
    name VARCHAR(100) NOT NULL,
    room_identifier VARCHAR(100) NOT NULL,  -- Business key (slug)
    location VARCHAR(100),
    description VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_room_identifier_per_household
        UNIQUE (household_id, room_identifier),
    CONSTRAINT unique_room_name_per_household
        UNIQUE (household_id, name),
    CONSTRAINT check_name_not_empty
        CHECK (LENGTH(TRIM(name)) >= 2),
    CONSTRAINT check_room_identifier_format
        CHECK (room_identifier ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Indexes for performance
CREATE INDEX idx_rooms_household_id ON rooms(household_id);
CREATE INDEX idx_rooms_room_identifier ON rooms(room_identifier);
```

### 4.2 Migration Strategy

**Flyway Migration: V005__create_rooms_table.sql**

```sql
-- 1. Create rooms table
CREATE TABLE rooms (...);

-- 2. Insert default rooms for ALL existing households
INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Living Room', 'living-room', 'Ground Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Master Bedroom', 'master-bedroom', 'First Floor'
FROM households h;

-- ... repeat for all 6 default rooms ...

-- 3. No changes to user_room_assignments table
-- It continues to reference room_identifier (string), not UUID
```

**Key Decision: Keep room_identifier as integration key**
- Room assignments use `room_identifier` (string) not `room_id` (UUID)
- Maintains backward compatibility
- No migration of existing assignments needed

### 4.3 Data Integrity

**Multi-tenancy:**
- All queries filtered by `household_id`
- Unique constraints scoped to household
- Cascade delete from households to rooms

**Referential Integrity:**
- Foreign key from rooms to households
- Room assignments reference room_identifier (stable)
- Deleting room cascades to assignments (via trigger or service logic)

## 5. API Design

### 5.1 REST Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | /api/rooms | Create room | Required | Parent |
| GET | /api/rooms | List household rooms | Required | Any |
| GET | /api/rooms/{id} | Get single room | Required | Any |
| PUT | /api/rooms/{id} | Update room | Required | Parent |
| DELETE | /api/rooms/{id} | Delete room | Required | Parent |

### 5.2 Request/Response Examples

**Create Room:**
```http
POST /api/rooms
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Living Room",
  "location": "Ground Floor",
  "description": "Main living area with AC"
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Living Room",
  "roomIdentifier": "living-room",
  "location": "Ground Floor",
  "description": "Main living area with AC",
  "createdAt": "2025-10-05T10:00:00Z",
  "updatedAt": "2025-10-05T10:00:00Z"
}
```

### 5.3 Error Responses

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Room name must be between 2 and 100 characters",
  "details": {
    "field": "name",
    "rejectedValue": "L"
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Invalid input (400)
- `DUPLICATE_ROOM_NAME` - Room name already exists (409)
- `ROOM_NOT_FOUND` - Room ID not found (404)
- `UNAUTHORIZED` - Not authenticated (401)
- `FORBIDDEN` - Not authorized (role check failed) (403)
- `ROOM_HAS_ASSIGNMENTS` - Cannot delete (has assignments) (409)

## 6. Frontend Architecture

### 6.1 State Management (Zustand v5)

```typescript
// stores/room-store.ts
interface RoomStoreState {
  // State
  rooms: Room[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (request: CreateRoomRequest) => Promise<Room>;
  updateRoom: (id: string, request: UpdateRoomRequest) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;

  // Queries
  getRoomById: (id: string) => Room | undefined;
  getRoomsByLocation: (location: string) => Room[];
}

// CRITICAL: Zustand v5 pattern - ALWAYS use specific selectors
const rooms = useStore(roomStore, (state) => state.rooms);
const createRoom = useStore(roomStore, (state) => state.createRoom);
```

### 6.2 API Client (Repository Pattern)

```typescript
// lib/api/room-api-client.ts
export interface RoomApiClient {
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room>;
  createRoom(request: CreateRoomRequest): Promise<Room>;
  updateRoom(id: string, request: UpdateRoomRequest): Promise<Room>;
  deleteRoom(id: string): Promise<void>;
}

export class HttpRoomApiClient implements RoomApiClient {
  constructor(private readonly httpClient: AxiosInstance) {}

  async createRoom(request: CreateRoomRequest): Promise<Room> {
    const response = await this.httpClient.post<Room>('/api/rooms', request);
    return response.data;
  }
  // ... other methods
}

export const roomApiClient = new HttpRoomApiClient(axiosClient);
```

### 6.3 UI Components

**Component Hierarchy:**
```
RoomManagementPage
├── RoomList (DataTable)
│   ├── RoomCard (Row)
│   └── EmptyState
├── CreateRoomDialog (Dialog + Form)
├── EditRoomDialog (Dialog + Form)
└── DeleteConfirmDialog (AlertDialog)
```

**ShadcnUI Components Used:**
- DataTable (room list)
- Dialog (create/edit)
- AlertDialog (delete confirmation)
- Form + Input + Label (form fields)
- Button (actions)
- Card (alternative layout)
- Badge (location, assignment count)

### 6.4 Validation (Zod)

```typescript
import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string()
    .min(2, 'Room name must be at least 2 characters')
    .max(100, 'Room name cannot exceed 100 characters')
    .trim(),
  location: z.string()
    .max(100, 'Location cannot exceed 100 characters')
    .optional(),
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export type CreateRoomRequest = z.infer<typeof createRoomSchema>;
```

## 7. Architecture Quality Assessment

### 7.1 Cohesion
- ✅ **High**: Each class has single, focused responsibility
- ✅ RoomEntity: Only room data
- ✅ RoomService: Only room business logic
- ✅ RoomController: Only HTTP handling

### 7.2 Coupling
- ✅ **Low**: Loose coupling via interfaces
- ✅ Controller → Service Interface (not implementation)
- ✅ Service → Repository Interface (Spring Data)
- ✅ Frontend → Backend via REST API (not tight coupling)

### 7.3 Separation of Concerns
- ✅ HTTP layer (Controller) separate from business logic (Service)
- ✅ Business logic separate from data access (Repository)
- ✅ Validation logic extracted to dedicated validator
- ✅ DTOs separate from entities

### 7.4 Dependency Direction
```
Controller → Service Interface ← Service Impl → Repository Interface
    ↓                                                    ↓
  DTOs                                            Entities
```
✅ All dependencies point inward toward business logic

### 7.5 Interface Design
- ✅ RoomService interface defines clear contract
- ✅ DTOs define clear API contract
- ✅ Repository interface provided by Spring Data
- ✅ All public methods documented

**Overall Assessment: Excellent architecture with high cohesion, low coupling, proper separation of concerns, and correct dependency direction.**

## 8. Security Considerations

### 8.1 Authentication
- All endpoints require valid JWT token
- Token extracted and validated by JwtAuthenticationContext
- User info (household_id, role) extracted from token

### 8.2 Authorization
- **Parents**: Full CRUD access to household rooms
- **Children**: Read-only access to assigned rooms
- Household isolation: Users can only access their household's rooms

### 8.3 Input Validation
- Server-side validation (cannot be bypassed)
- Client-side validation (better UX)
- SQL injection prevention (parameterized queries)
- XSS prevention (DTOs, no HTML in responses)

### 8.4 Data Protection
- No sensitive data in rooms table
- Cascade delete prevents orphaned data
- Audit trail via created_at/updated_at

## 9. Performance Considerations

### 9.1 Database Optimization
- Indexes on household_id and room_identifier
- Unique constraints prevent duplicate queries
- Reactive queries (non-blocking I/O)

### 9.2 Caching Strategy
- **Not implemented initially** (YAGNI)
- Add if performance issues arise
- Candidate: Cache household rooms (rarely change)

### 9.3 Query Optimization
- Filter by household_id early
- Use indexes effectively
- Limit result sets (pagination if needed)

### 9.4 Frontend Optimization
- React.memo on room components
- Zustand v5 specific selectors (prevent re-renders)
- Optimistic updates for create/update/delete

## 10. Testing Strategy

### 10.1 Backend Testing
- **Unit Tests**: RoomService, RoomValidator, RoomIdentifierGenerator
- **Integration Tests**: RoomController endpoints
- **Repository Tests**: Database queries
- **Migration Tests**: Flyway migration success

### 10.2 Frontend Testing
- **Unit Tests**: room-api-client, validation schemas
- **Component Tests**: RoomList, CreateRoomDialog
- **Integration Tests**: Full create/edit/delete flows
- **E2E Tests**: User journey (create room → assign to user)

### 10.3 Test Coverage Goals
- Backend: >80% line coverage
- Frontend: >70% line coverage
- Critical paths: 100% coverage

## 11. Deployment Strategy

### 11.1 Database Migration
1. Run Flyway migration (V005__create_rooms_table.sql)
2. Verify default rooms inserted for all households
3. Verify existing room assignments still work

### 11.2 Backend Deployment
1. Deploy new RoomController, RoomService, RoomRepository
2. Verify health check
3. Smoke test: GET /api/rooms returns data

### 11.3 Frontend Deployment
1. Deploy room management page
2. Update admin navigation to include "Room Management"
3. Smoke test: Can create/edit/delete room

### 11.4 Rollback Plan
- Revert migration if issues (rollback to V004)
- Remove room management UI from navigation
- Restore hardcoded room list in RoomController

## 12. Future Enhancements

### 12.1 Short-term (Next Sprint)
- Room assignment integration testing
- Room deletion impact analysis (show affected users)
- Room templates (predefined room types)

### 12.2 Medium-term (Next Quarter)
- MQTT topic discovery integration
- Automatic room detection from devices
- Room usage analytics

### 12.3 Long-term (Future)
- Room hierarchy (floors, zones)
- Room sharing between households
- Advanced room configuration (temperature ranges, etc.)
