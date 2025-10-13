# Room Management - Implementation Plan

## Overview

This document provides step-by-step implementation instructions for the room management feature, following the design specified in `design.md` and requirements in `spec.md`.

## Implementation Phases

### Phase 1: Database Migration
### Phase 2: Backend - Utilities and Validation
### Phase 3: Backend - Entity and Repository
### Phase 4: Backend - Service Layer
### Phase 5: Backend - Controller Update
### Phase 6: Frontend - API Client and Types
### Phase 7: Frontend - State Management
### Phase 8: Frontend - UI Components
### Phase 9: Frontend - Admin Page and Navigation
### Phase 10: Integration Testing

---

## Phase 1: Database Migration

**File:** `backend/turing/src/main/resources/db/migration/V005__create_rooms_table.sql`

**Steps:**
1. Create Flyway migration file
2. Define rooms table schema
3. Insert default rooms for existing households
4. Verify constraints and indexes

**Implementation:**
```sql
-- V005__create_rooms_table.sql

-- Create rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    room_identifier VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    description VARCHAR(500),
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

-- Indexes
CREATE INDEX idx_rooms_household_id ON rooms(household_id);
CREATE INDEX idx_rooms_room_identifier ON rooms(room_identifier);

-- Insert default rooms for all existing households
INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Living Room', 'living-room', 'Ground Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Master Bedroom', 'master-bedroom', 'First Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Guest Bedroom', 'guest-bedroom', 'First Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Kitchen', 'kitchen', 'Ground Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Home Office', 'home-office', 'First Floor'
FROM households h;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Basement', 'basement', 'Lower Level'
FROM households h;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Testing:**
- Run migration on test database
- Verify rooms table exists
- Verify default rooms inserted
- Verify constraints work (try inserting duplicate)

---

## Phase 2: Backend - Utilities and Validation

**Files:**
- `backend/turing/src/main/java/com/ashelabs/turing/util/RoomIdentifierGenerator.java`
- `backend/turing/src/main/java/com/ashelabs/turing/validation/RoomValidator.java`
- `backend/turing/src/main/java/com/ashelabs/turing/validation/ValidationResult.java`

**Step 1: Create RoomIdentifierGenerator**
```java
package com.ashelabs.turing.util;

public class RoomIdentifierGenerator {

    /**
     * Generate room identifier from room name
     * Example: "Living Room" -> "living-room"
     */
    public static String generateFromName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Room name cannot be null or empty");
        }

        return name.toLowerCase()
            .replaceAll("[^a-z0-9\\s-]", "")  // Remove special chars
            .trim()
            .replaceAll("\\s+", "-")           // Replace spaces with hyphens
            .replaceAll("-+", "-");            // Remove duplicate hyphens
    }
}
```

**Step 2: Create ValidationResult**
```java
package com.ashelabs.turing.validation;

import java.util.ArrayList;
import java.util.List;

public class ValidationResult {
    private final List<String> errors;

    public ValidationResult() {
        this.errors = new ArrayList<>();
    }

    public ValidationResult(List<String> errors) {
        this.errors = new ArrayList<>(errors);
    }

    public boolean isValid() {
        return errors.isEmpty();
    }

    public List<String> getErrors() {
        return new ArrayList<>(errors);
    }

    public void addError(String error) {
        errors.add(error);
    }

    public String getFirstError() {
        return errors.isEmpty() ? null : errors.get(0);
    }
}
```

**Step 3: Create RoomValidator**
```java
package com.ashelabs.turing.validation;

import java.util.ArrayList;
import java.util.List;

public class RoomValidator {

    // Validation constants
    public static final int MIN_NAME_LENGTH = 2;
    public static final int MAX_NAME_LENGTH = 100;
    public static final int MAX_LOCATION_LENGTH = 100;
    public static final int MAX_DESCRIPTION_LENGTH = 500;
    private static final String ROOM_IDENTIFIER_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

    /**
     * Validate room name
     */
    public static ValidationResult validateName(String name) {
        List<String> errors = new ArrayList<>();

        if (name == null || name.isBlank()) {
            errors.add("Room name cannot be empty");
            return new ValidationResult(errors);
        }

        String trimmed = name.trim();
        if (trimmed.length() < MIN_NAME_LENGTH) {
            errors.add("Room name must be at least " + MIN_NAME_LENGTH + " characters");
        }
        if (trimmed.length() > MAX_NAME_LENGTH) {
            errors.add("Room name cannot exceed " + MAX_NAME_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate room identifier
     */
    public static ValidationResult validateRoomIdentifier(String identifier) {
        List<String> errors = new ArrayList<>();

        if (identifier == null || identifier.isBlank()) {
            errors.add("Room identifier cannot be empty");
            return new ValidationResult(errors);
        }

        if (!identifier.matches(ROOM_IDENTIFIER_PATTERN)) {
            errors.add("Room identifier must contain only lowercase letters, numbers, and hyphens");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate location
     */
    public static ValidationResult validateLocation(String location) {
        List<String> errors = new ArrayList<>();

        if (location != null && location.length() > MAX_LOCATION_LENGTH) {
            errors.add("Location cannot exceed " + MAX_LOCATION_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate description
     */
    public static ValidationResult validateDescription(String description) {
        List<String> errors = new ArrayList<>();

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            errors.add("Description cannot exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }
}
```

**Testing:**
- Unit test RoomIdentifierGenerator with various inputs
- Unit test RoomValidator with valid/invalid inputs
- Verify edge cases (null, empty, too long, special characters)

---

## Phase 3: Backend - Entity and Repository

**Files:**
- `backend/turing/src/main/java/com/ashelabs/turing/entity/Room.java`
- `backend/turing/src/main/java/com/ashelabs/turing/repository/RoomRepository.java`

**Step 1: Create Room Entity**
```java
package com.ashelabs.turing.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("rooms")
public class Room {

    @Id
    private UUID id;

    @Column("household_id")
    private UUID householdId;

    @Column("name")
    private String name;

    @Column("room_identifier")
    private String roomIdentifier;

    @Column("location")
    private String location;

    @Column("description")
    private String description;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;
}
```

**Step 2: Create RoomRepository**
```java
package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.Room;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Repository
public interface RoomRepository extends R2dbcRepository<Room, UUID> {

    /**
     * Find all rooms for a household
     */
    Flux<Room> findByHouseholdId(UUID householdId);

    /**
     * Find room by household and identifier
     */
    Mono<Room> findByHouseholdIdAndRoomIdentifier(UUID householdId, String roomIdentifier);

    /**
     * Find room by household and ID
     */
    Mono<Room> findByHouseholdIdAndId(UUID householdId, UUID id);

    /**
     * Count rooms with same name in household (for uniqueness check)
     */
    Mono<Long> countByHouseholdIdAndName(UUID householdId, String name);

    /**
     * Count rooms with same identifier in household
     */
    Mono<Long> countByHouseholdIdAndRoomIdentifier(UUID householdId, String roomIdentifier);

    /**
     * Delete room by household and ID
     */
    Mono<Void> deleteByHouseholdIdAndId(UUID householdId, UUID id);
}
```

**Testing:**
- Repository integration test (in-memory database)
- Test findByHouseholdId returns only household rooms
- Test uniqueness constraints
- Test cascade delete from household

---

## Phase 4: Backend - Service Layer

**Files:**
- `backend/turing/src/main/java/com/ashelabs/turing/dto/CreateRoomRequest.java`
- `backend/turing/src/main/java/com/ashelabs/turing/dto/UpdateRoomRequest.java`
- `backend/turing/src/main/java/com/ashelabs/turing/dto/RoomResponse.java`
- `backend/turing/src/main/java/com/ashelabs/turing/service/RoomService.java`
- `backend/turing/src/main/java/com/ashelabs/turing/service/RoomServiceImpl.java`

**Step 1: Create DTOs**
```java
// CreateRoomRequest.java
package com.ashelabs.turing.dto;

public record CreateRoomRequest(
    String name,
    String location,
    String description
) {}

// UpdateRoomRequest.java
package com.ashelabs.turing.dto;

public record UpdateRoomRequest(
    String name,
    String location,
    String description
) {}

// RoomResponse.java
package com.ashelabs.turing.dto;

import java.time.LocalDateTime;
import java.util.UUID;

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

**Step 2: Create RoomService Interface**
```java
package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.CreateRoomRequest;
import com.ashelabs.turing.dto.RoomResponse;
import com.ashelabs.turing.dto.UpdateRoomRequest;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface RoomService {

    Mono<RoomResponse> createRoom(UUID householdId, CreateRoomRequest request);

    Flux<RoomResponse> getRooms(UUID householdId);

    Mono<RoomResponse> getRoom(UUID householdId, UUID roomId);

    Mono<RoomResponse> updateRoom(UUID householdId, UUID roomId, UpdateRoomRequest request);

    Mono<Void> deleteRoom(UUID householdId, UUID roomId);
}
```

**Step 3: Implement RoomServiceImpl** (continued in next section due to length)

---

## Phase 5: Backend - Service Implementation (continued)

**File:** `backend/turing/src/main/java/com/ashelabs/turing/service/RoomServiceImpl.java`

```java
package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.CreateRoomRequest;
import com.ashelabs.turing.dto.RoomResponse;
import com.ashelabs.turing.dto.UpdateRoomRequest;
import com.ashelabs.turing.entity.Room;
import com.ashelabs.turing.repository.RoomRepository;
import com.ashelabs.turing.util.RoomIdentifierGenerator;
import com.ashelabs.turing.validation.RoomValidator;
import com.ashelabs.turing.validation.ValidationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;

    @Override
    public Mono<RoomResponse> createRoom(UUID householdId, CreateRoomRequest request) {
        log.info("Creating room for household {}: {}", householdId, request.name());

        return validateCreateRequest(request)
            .flatMap(validRequest -> {
                String roomIdentifier = RoomIdentifierGenerator.generateFromName(validRequest.name());

                // Check uniqueness
                return checkRoomNameUnique(householdId, validRequest.name())
                    .flatMap(isUnique -> {
                        if (!isUnique) {
                            return Mono.error(new IllegalArgumentException(
                                "Room with name '" + validRequest.name() + "' already exists in household"
                            ));
                        }

                        // Create room entity
                        Room room = Room.builder()
                            .householdId(householdId)
                            .name(validRequest.name().trim())
                            .roomIdentifier(roomIdentifier)
                            .location(validRequest.location() != null ? validRequest.location().trim() : null)
                            .description(validRequest.description() != null ? validRequest.description().trim() : null)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();

                        return roomRepository.save(room);
                    });
            })
            .map(this::mapToResponse)
            .doOnSuccess(response -> log.info("Room created: {}", response.id()))
            .doOnError(error -> log.error("Failed to create room", error));
    }

    @Override
    public Flux<RoomResponse> getRooms(UUID householdId) {
        log.info("Fetching rooms for household {}", householdId);

        return roomRepository.findByHouseholdId(householdId)
            .map(this::mapToResponse)
            .doOnComplete(() -> log.debug("Fetched all rooms for household {}", householdId));
    }

    @Override
    public Mono<RoomResponse> getRoom(UUID householdId, UUID roomId) {
        log.info("Fetching room {} for household {}", roomId, householdId);

        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Room not found")))
            .map(this::mapToResponse);
    }

    @Override
    public Mono<RoomResponse> updateRoom(UUID householdId, UUID roomId, UpdateRoomRequest request) {
        log.info("Updating room {} for household {}", roomId, householdId);

        return validateUpdateRequest(request)
            .flatMap(validRequest -> roomRepository.findByHouseholdIdAndId(householdId, roomId)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Room not found")))
                .flatMap(existingRoom -> {
                    // Check name uniqueness if name changed
                    if (!existingRoom.getName().equals(validRequest.name())) {
                        return checkRoomNameUnique(householdId, validRequest.name())
                            .flatMap(isUnique -> {
                                if (!isUnique) {
                                    return Mono.error(new IllegalArgumentException(
                                        "Room with name '" + validRequest.name() + "' already exists"
                                    ));
                                }
                                return updateRoomFields(existingRoom, validRequest);
                            });
                    } else {
                        return updateRoomFields(existingRoom, validRequest);
                    }
                }))
            .map(this::mapToResponse)
            .doOnSuccess(response -> log.info("Room updated: {}", response.id()));
    }

    @Override
    public Mono<Void> deleteRoom(UUID householdId, UUID roomId) {
        log.info("Deleting room {} for household {}", roomId, householdId);

        return roomRepository.findByHouseholdIdAndId(householdId, roomId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Room not found")))
            .flatMap(room -> roomRepository.deleteByHouseholdIdAndId(householdId, roomId))
            .doOnSuccess(v -> log.info("Room deleted: {}", roomId));
    }

    // Helper methods

    private Mono<CreateRoomRequest> validateCreateRequest(CreateRoomRequest request) {
        ValidationResult nameResult = RoomValidator.validateName(request.name());
        ValidationResult locationResult = RoomValidator.validateLocation(request.location());
        ValidationResult descResult = RoomValidator.validateDescription(request.description());

        if (!nameResult.isValid()) {
            return Mono.error(new IllegalArgumentException(nameResult.getFirstError()));
        }
        if (!locationResult.isValid()) {
            return Mono.error(new IllegalArgumentException(locationResult.getFirstError()));
        }
        if (!descResult.isValid()) {
            return Mono.error(new IllegalArgumentException(descResult.getFirstError()));
        }

        return Mono.just(request);
    }

    private Mono<UpdateRoomRequest> validateUpdateRequest(UpdateRoomRequest request) {
        ValidationResult nameResult = RoomValidator.validateName(request.name());
        ValidationResult locationResult = RoomValidator.validateLocation(request.location());
        ValidationResult descResult = RoomValidator.validateDescription(request.description());

        if (!nameResult.isValid()) {
            return Mono.error(new IllegalArgumentException(nameResult.getFirstError()));
        }
        if (!locationResult.isValid()) {
            return Mono.error(new IllegalArgumentException(locationResult.getFirstError()));
        }
        if (!descResult.isValid()) {
            return Mono.error(new IllegalArgumentException(descResult.getFirstError()));
        }

        return Mono.just(request);
    }

    private Mono<Boolean> checkRoomNameUnique(UUID householdId, String name) {
        return roomRepository.countByHouseholdIdAndName(householdId, name.trim())
            .map(count -> count == 0);
    }

    private Mono<Room> updateRoomFields(Room room, UpdateRoomRequest request) {
        room.setName(request.name().trim());
        room.setLocation(request.location() != null ? request.location().trim() : null);
        room.setDescription(request.description() != null ? request.description().trim() : null);
        room.setUpdatedAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    private RoomResponse mapToResponse(Room room) {
        return new RoomResponse(
            room.getId(),
            room.getName(),
            room.getRoomIdentifier(),
            room.getLocation(),
            room.getDescription(),
            room.getCreatedAt(),
            room.getUpdatedAt()
        );
    }
}
```

**Testing:**
- Unit test RoomServiceImpl with mocked repository
- Test validation errors
- Test uniqueness checking
- Test CRUD operations
- Test error handling

---

## Phase 6: Backend - Controller Update

**File:** `backend/turing/src/main/java/com/ashelabs/turing/controller/RoomController.java`

**Steps:**
1. Inject RoomService
2. Add CRUD endpoints
3. Extract user context from JWT
4. Add role-based authorization

**Implementation:**
```java
package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.dto.CreateRoomRequest;
import com.ashelabs.turing.dto.RoomResponse;
import com.ashelabs.turing.dto.UpdateRoomRequest;
import com.ashelabs.turing.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class RoomController {

    private final RoomService roomService;
    private final JwtAuthenticationContext jwtAuthContext;

    /**
     * Create a new room
     * POST /api/rooms
     * Role: Parent only
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<RoomResponse> createRoom(
            @RequestHeader("Authorization") String authorization,
            @RequestBody CreateRoomRequest request) {

        return jwtAuthContext.extractUserFromToken(authorization)
            .flatMap(userInfo -> {
                // Check role
                if (!"parent".equalsIgnoreCase(userInfo.getRole())) {
                    return Mono.error(new IllegalArgumentException("Only parents can create rooms"));
                }

                return roomService.createRoom(userInfo.getHouseholdId(), request);
            });
    }

    /**
     * Get all rooms for user's household
     * GET /api/rooms
     */
    @GetMapping
    public Flux<RoomResponse> getRooms(
            @RequestHeader("Authorization") String authorization) {

        return jwtAuthContext.extractUserFromToken(authorization)
            .flux()
            .flatMap(userInfo -> roomService.getRooms(userInfo.getHouseholdId()));
    }

    /**
     * Get single room
     * GET /api/rooms/{id}
     */
    @GetMapping("/{id}")
    public Mono<RoomResponse> getRoom(
            @RequestHeader("Authorization") String authorization,
            @PathVariable UUID id) {

        return jwtAuthContext.extractUserFromToken(authorization)
            .flatMap(userInfo -> roomService.getRoom(userInfo.getHouseholdId(), id));
    }

    /**
     * Update room
     * PUT /api/rooms/{id}
     * Role: Parent only
     */
    @PutMapping("/{id}")
    public Mono<RoomResponse> updateRoom(
            @RequestHeader("Authorization") String authorization,
            @PathVariable UUID id,
            @RequestBody UpdateRoomRequest request) {

        return jwtAuthContext.extractUserFromToken(authorization)
            .flatMap(userInfo -> {
                // Check role
                if (!"parent".equalsIgnoreCase(userInfo.getRole())) {
                    return Mono.error(new IllegalArgumentException("Only parents can update rooms"));
                }

                return roomService.updateRoom(userInfo.getHouseholdId(), id, request);
            });
    }

    /**
     * Delete room
     * DELETE /api/rooms/{id}
     * Role: Parent only
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteRoom(
            @RequestHeader("Authorization") String authorization,
            @PathVariable UUID id) {

        return jwtAuthContext.extractUserFromToken(authorization)
            .flatMap(userInfo -> {
                // Check role
                if (!"parent".equalsIgnoreCase(userInfo.getRole())) {
                    return Mono.error(new IllegalArgumentException("Only parents can delete rooms"));
                }

                return roomService.deleteRoom(userInfo.getHouseholdId(), id);
            });
    }

    // Keep existing methods (getAvailableRooms, getAssignedRooms, getRoomStats)
    // but update them to query database instead of returning hardcoded rooms
}
```

**Testing:**
- Integration test all endpoints
- Test role-based authorization
- Test household isolation
- Test error responses

---

## Phase 7: Frontend - API Client and Types

**Files:**
- `frontend/src/types/room.ts`
- `frontend/src/lib/api/room-api-client-enhanced.ts`

**Step 1: Create Types**
```typescript
// frontend/src/types/room.ts

export interface Room {
  id: string;
  name: string;
  roomIdentifier: string;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomRequest {
  name: string;
  location?: string;
  description?: string;
}

export interface UpdateRoomRequest {
  name: string;
  location?: string;
  description?: string;
}

export interface RoomApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}
```

**Step 2: Create API Client**
```typescript
// frontend/src/lib/api/room-api-client-enhanced.ts

import type { AxiosInstance } from 'axios';
import { axiosClient } from '@/lib/http/axios-client';
import type { Room, CreateRoomRequest, UpdateRoomRequest } from '@/types/room';

/**
 * Room API Client Interface (Repository Pattern)
 */
export interface RoomApiClient {
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room>;
  createRoom(request: CreateRoomRequest): Promise<Room>;
  updateRoom(id: string, request: UpdateRoomRequest): Promise<Room>;
  deleteRoom(id: string): Promise<void>;
}

/**
 * HTTP implementation of RoomApiClient
 */
export class HttpRoomApiClient implements RoomApiClient {
  constructor(private readonly httpClient: AxiosInstance) {}

  async getRooms(): Promise<Room[]> {
    try {
      const response = await this.httpClient.get<Room[]>('/api/rooms');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      throw this.transformError(error, 'getRooms');
    }
  }

  async getRoom(id: string): Promise<Room> {
    try {
      const response = await this.httpClient.get<Room>(`/api/rooms/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch room ${id}:`, error);
      throw this.transformError(error, 'getRoom');
    }
  }

  async createRoom(request: CreateRoomRequest): Promise<Room> {
    try {
      const response = await this.httpClient.post<Room>('/api/rooms', request);
      return response.data;
    } catch (error) {
      console.error('Failed to create room:', error);
      throw this.transformError(error, 'createRoom');
    }
  }

  async updateRoom(id: string, request: UpdateRoomRequest): Promise<Room> {
    try {
      const response = await this.httpClient.put<Room>(`/api/rooms/${id}`, request);
      return response.data;
    } catch (error) {
      console.error(`Failed to update room ${id}:`, error);
      throw this.transformError(error, 'updateRoom');
    }
  }

  async deleteRoom(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`/api/rooms/${id}`);
    } catch (error) {
      console.error(`Failed to delete room ${id}:`, error);
      throw this.transformError(error, 'deleteRoom');
    }
  }

  private transformError(error: any, operation: string): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 400:
          return new Error(`Invalid request: ${message}`);
        case 401:
          return new Error('Authentication required');
        case 403:
          return new Error('Permission denied');
        case 404:
          return new Error('Room not found');
        case 409:
          return new Error(`Conflict: ${message}`);
        default:
          return new Error(`Failed to ${operation}: ${message}`);
      }
    }

    return new Error(`Network error: ${error.message}`);
  }
}

/**
 * Factory function for dependency injection
 */
export const createRoomApiClient = (httpClient?: AxiosInstance): RoomApiClient => {
  const client = httpClient || axiosClient;
  return new HttpRoomApiClient(client);
};

/**
 * Singleton instance
 */
export const roomApiClient = createRoomApiClient();
```

---

## Phase 8: Frontend - State Management

**File:** `frontend/src/stores/room-store.ts`

```typescript
import { createStore } from 'zustand/vanilla';
import { roomApiClientEnhanced as roomApiClient, RoomApiClientEnhanced as RoomApiClient } from '@/lib/api/room-api-client-enhanced';
import type { Room, CreateRoomRequest, UpdateRoomRequest } from '@/types/room';

export interface RoomStoreState {
  // State
  rooms: Room[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (request: CreateRoomRequest) => Promise<Room>;
  updateRoom: (id: string, request: UpdateRoomRequest) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;
  clearError: () => void;

  // Queries
  getRoomById: (id: string) => Room | undefined;
  getRoomsByLocation: (location: string) => Room[];
}

export const createRoomStore = (apiClient: RoomApiClient = roomApiClient) => {
  return createStore<RoomStoreState>()((set, get) => ({
    // Initial state
    rooms: [],
    isLoading: false,
    error: null,

    // Actions
    fetchRooms: async () => {
      set({ isLoading: true, error: null });

      try {
        const rooms = await apiClient.getRooms();
        set({ rooms, isLoading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch rooms';
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    createRoom: async (request: CreateRoomRequest) => {
      set({ isLoading: true, error: null });

      try {
        const room = await apiClient.createRoom(request);
        set((state) => ({
          rooms: [...state.rooms, room],
          isLoading: false,
        }));
        return room;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create room';
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    updateRoom: async (id: string, request: UpdateRoomRequest) => {
      set({ isLoading: true, error: null });

      try {
        const updatedRoom = await apiClient.updateRoom(id, request);
        set((state) => ({
          rooms: state.rooms.map((room) => (room.id === id ? updatedRoom : room)),
          isLoading: false,
        }));
        return updatedRoom;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update room';
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    deleteRoom: async (id: string) => {
      set({ isLoading: true, error: null });

      try {
        await apiClient.deleteRoom(id);
        set((state) => ({
          rooms: state.rooms.filter((room) => room.id !== id),
          isLoading: false,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete room';
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    clearError: () => {
      set({ error: null });
    },

    // Queries
    getRoomById: (id: string) => {
      return get().rooms.find((room) => room.id === id);
    },

    getRoomsByLocation: (location: string) => {
      return get().rooms.filter((room) => room.location === location);
    },
  }));
};

export const roomStore = createRoomStore();
```

---

## Phase 9: Frontend - UI Components

**Files:**
- `frontend/src/components/admin/rooms/CreateRoomDialog.tsx`
- `frontend/src/components/admin/rooms/EditRoomDialog.tsx`
- `frontend/src/components/admin/rooms/DeleteConfirmDialog.tsx`
- `frontend/src/components/admin/rooms/RoomList.tsx`

**Implementation details and component code will continue in implementation phase...**

---

## Phase 10: Frontend - Admin Page and Navigation

**Files:**
- `frontend/src/app/admin/rooms/page.tsx`
- Update `frontend/src/components/admin/AdminNavigation.tsx`

---

## Summary

This implementation plan provides detailed, step-by-step instructions for building the room management feature following clean code principles and design patterns. Each phase builds upon the previous one, ensuring a systematic and testable implementation.

**Next Steps:**
1. Review and approve specification documents
2. Begin Phase 1 (Database Migration)
3. Use feedback tool after each phase for approval
4. Update todo list as phases complete
