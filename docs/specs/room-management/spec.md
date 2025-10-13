# Room Management Feature - Requirements Specification

## 1. Overview

Replace hardcoded room list with a dynamic room management system that allows administrators to create, configure, update, and delete rooms in the household.

## 2. Business Requirements

### BR-1: Dynamic Room Management
Parents/administrators must be able to create and manage rooms without code changes.

### BR-2: Room Persistence
Rooms must be stored in the database and persist across application restarts.

### BR-3: Room Discovery Integration
System should support future integration with MQTT topic discovery for automatic room detection.

### BR-4: Room Assignment Compatibility
New room system must work seamlessly with existing room assignment functionality.

## 3. User Stories

### US-1: Create Room
**As a** parent/administrator
**I want to** create a new room in the system
**So that** I can assign it to family members and configure devices for it

**Acceptance Criteria:**
- Can specify room name (required)
- Can specify location/floor (optional)
- Can add description (optional)
- Room ID is auto-generated (lowercase, hyphenated)
- System validates room name uniqueness within household
- Success confirmation displayed after creation

### US-2: View All Rooms
**As a** parent/administrator
**I want to** view all rooms in my household
**So that** I can see what rooms are currently configured

**Acceptance Criteria:**
- Displays list of all rooms with name, location, description
- Shows room assignment count (how many users have access)
- Shows device count per room (future)
- Sortable by name, location, or assignment count

### US-3: Edit Room Details
**As a** parent/administrator
**I want to** edit existing room details
**So that** I can correct mistakes or update room information

**Acceptance Criteria:**
- Can update room name, location, description
- Cannot change room ID (impacts existing assignments)
- System validates uniqueness of new name
- Changes reflected immediately in room assignments

### US-4: Delete Room
**As a** parent/administrator
**I want to** delete a room that is no longer needed
**So that** it doesn't clutter the room list

**Acceptance Criteria:**
- Can delete room if no users are assigned
- System warns if room has assignments and requires confirmation
- Deleting room removes all assignments (cascade delete)
- Deleting room unassigns all devices (future)
- Cannot be undone - requires confirmation dialog

### US-5: Room Assignment Integration
**As a** parent/administrator
**I want** the room assignment interface to use dynamic rooms
**So that** I can assign newly created rooms to family members

**Acceptance Criteria:**
- Room assignment interface fetches live room list from database
- Newly created rooms appear immediately in assignment dropdown
- Deleted rooms are removed from assignment options

## 4. Functional Requirements

### FR-1: Room CRUD Operations
- **FR-1.1**: System shall provide REST API for creating rooms (POST /api/rooms)
- **FR-1.2**: System shall provide REST API for listing rooms (GET /api/rooms)
- **FR-1.3**: System shall provide REST API for updating rooms (PUT /api/rooms/{id})
- **FR-1.4**: System shall provide REST API for deleting rooms (DELETE /api/rooms/{id})
- **FR-1.5**: System shall provide REST API for getting single room (GET /api/rooms/{id})

### FR-2: Room Data Model
- **FR-2.1**: Room shall have unique ID (UUID)
- **FR-2.2**: Room shall have household ID (multi-tenant isolation)
- **FR-2.3**: Room shall have name (required, max 100 chars)
- **FR-2.4**: Room shall have room identifier (unique slug, lowercase, hyphenated)
- **FR-2.5**: Room shall have location (optional, max 100 chars)
- **FR-2.6**: Room shall have description (optional, max 500 chars)
- **FR-2.7**: Room shall track created_at and updated_at timestamps
- **FR-2.8**: Room identifier is derived from name (e.g., "Living Room" -> "living-room")

### FR-3: Validation Rules
- **FR-3.1**: Room name must be unique within household
- **FR-3.2**: Room identifier must be unique within household
- **FR-3.3**: Room name cannot be empty or whitespace only
- **FR-3.4**: Room name length: 2-100 characters
- **FR-3.5**: Location length: 0-100 characters
- **FR-3.6**: Description length: 0-500 characters
- **FR-3.7**: Room identifier must match pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`

### FR-4: Authorization
- **FR-4.1**: Only authenticated users can access room endpoints
- **FR-4.2**: Only parents can create, update, or delete rooms
- **FR-4.3**: Children can only view rooms assigned to them
- **FR-4.4**: Parents can view all household rooms

### FR-5: Frontend Room Management Interface
- **FR-5.1**: Admin panel shall have "Room Management" page
- **FR-5.2**: Page shall display room list in table/card format
- **FR-5.3**: Page shall have "Add Room" button
- **FR-5.4**: Each room shall have edit and delete action buttons
- **FR-5.5**: Create/Edit shall use modal dialog
- **FR-5.6**: Delete shall require confirmation dialog

### FR-6: Data Migration
- **FR-6.1**: System shall migrate hardcoded rooms to database on first run
- **FR-6.2**: Migration shall preserve existing room assignments
- **FR-6.3**: Migration shall be idempotent (safe to run multiple times)

## 5. Non-Functional Requirements

### NFR-1: Performance
- Room list API response time: < 100ms
- Room CRUD operations: < 200ms
- Frontend room list render: < 500ms

### NFR-2: Scalability
- Support up to 50 rooms per household
- Support concurrent room management by multiple parents

### NFR-3: Usability
- Room creation form: < 30 seconds to complete
- Error messages must be clear and actionable
- UI must be responsive (mobile and desktop)

### NFR-4: Data Integrity
- Room deletion must cascade to assignments safely
- No orphaned room assignments after room deletion
- Database constraints enforce uniqueness

### NFR-5: Compatibility
- Must work with existing room assignment feature
- Must not break existing device-room integration
- Must work with existing WebSocket room subscriptions

## 6. Constraints

### C-1: Technical Constraints
- Must use existing PostgreSQL database
- Must use Spring Boot reactive patterns (Reactor)
- Must use existing JWT authentication
- Must follow existing API conventions

### C-2: Business Constraints
- No breaking changes to existing room assignment API
- Must maintain backward compatibility during migration
- Household isolation must be maintained (multi-tenancy)

## 7. Dependencies

### D-1: Existing Features
- User authentication and authorization
- Household management
- Room assignment feature
- Database schema (requires new migration)

### D-2: External Systems
- PostgreSQL database
- JWT authentication service
- WebSocket connections (for future real-time updates)

## 8. Success Metrics

### SM-1: Functional Success
- Parents can create rooms without developer intervention
- Room assignments work with dynamic rooms
- Zero data loss during migration
- All validation rules enforced correctly

### SM-2: Performance Success
- < 100ms average room list response time
- < 500ms room creation end-to-end time
- Zero database constraint violations

### SM-3: Usability Success
- < 5 clicks to create a new room
- Clear error messages for all validation failures
- Responsive UI on mobile and desktop

## 9. Out of Scope (Future Enhancements)

- **OOS-1**: Automatic room discovery via MQTT topics
- **OOS-2**: Room templates (e.g., "Bedroom", "Kitchen" presets)
- **OOS-3**: Room grouping/hierarchy (floors, zones)
- **OOS-4**: Room-level device configuration
- **OOS-5**: Room sharing between households
- **OOS-6**: Room usage analytics
- **OOS-7**: Bulk room import/export

## 10. Risks and Mitigations

### R-1: Data Migration Failure
**Risk**: Migration fails, leaving system in inconsistent state
**Mitigation**: Implement idempotent migration with rollback capability, extensive testing

### R-2: Room Deletion Impact
**Risk**: Deleting room breaks user experience for assigned users
**Mitigation**: Warning dialog showing impact, cascade delete with proper notifications

### R-3: Concurrent Modifications
**Risk**: Multiple parents editing same room simultaneously
**Mitigation**: Optimistic locking with version field, clear conflict resolution messages

### R-4: Performance Degradation
**Risk**: Large number of rooms slows down system
**Mitigation**: Indexed queries, pagination support, caching strategy

## 11. Assumptions

### A-1: User Behavior
- Average household has 5-15 rooms
- Room configurations change infrequently (< 1/week)
- Parents are primary room managers

### A-2: Technical Assumptions
- Database is available and performant
- JWT tokens are valid and not expired
- Network connectivity is stable for API calls

### A-3: Data Assumptions
- Existing hardcoded rooms map to common household rooms
- Room identifiers remain stable after creation
- Room names are in English (no i18n required initially)
