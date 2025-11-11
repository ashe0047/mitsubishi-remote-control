# Enum Convention Fixes Implementation Report

## Overview

This document reports the systematic implementation of proper enum naming conventions across the entire backend-2 application to ensure compliance with TypeScript and PostgreSQL standards.

## Naming Convention Standards Applied

### Database-Used Enums (PostgreSQL Storage)
| Layer | Naming Example | Case Style | Convention Applied |
|------|----------------|------------|-------------------|
| PostgreSQL Enum Type Name | `user_role_enum` | `snake_case_enum` | Used for database enum types |
| PostgreSQL Enum Value | `'ADMIN'` | `UPPER_SNAKE_CASE` | Used for database enum values |
| TypeScript Enum Name | `UserRole` | `PascalCase` | Used for TypeScript enum names |
| TypeScript Enum Key | `ADMIN` | `UPPER_SNAKE_CASE` | Used for TypeScript enum keys |
| TypeScript Enum Value | `'ADMIN'` | `UPPER_SNAKE_CASE` | Exactly matches DB values |

### Application-Only Enums (TypeScript Only)
| Layer | Naming Example | Case Style | Convention Applied |
|------|----------------|------------|-------------------|
| TypeScript Enum Name | `ConnectionEventType` | `PascalCase` | Used for TypeScript enum names |
| TypeScript Enum Key | `CONNECTED` | `UPPER_SNAKE_CASE` | Used for TypeScript enum keys |
| TypeScript Enum Value | `'CONNECTED'` | `UPPER_SNAKE_CASE` | TypeScript standard convention |

## Database-Used Enums Fixed

### ✅ **UserRole, UserStatus, AccessLevel** (`src/users/enums/access.enums.ts`)

**Before:**
```typescript
export enum UserRole {
  admin = 'admin',
  parent = 'parent',
  adult = 'adult',
  teen = 'teen',
  child = 'child',
  guest = 'guest',
}

export enum UserStatus {
  active = 'active',
  suspended = 'suspended',
  pending = 'pending',
  archived = 'archived',
}

export enum AccessLevel {
  full = 'full',
  limited = 'limited',
  view_only = 'view_only',
  scheduled = 'scheduled',
  emergency_only = 'emergency_only',
}
```

**After (PostgreSQL Convention):**
```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  PARENT = 'PARENT',
  ADULT = 'ADULT',
  TEEN = 'TEEN',
  CHILD = 'CHILD',
  GUEST = 'GUEST',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  ARCHIVED = 'ARCHIVED',
}

export enum AccessLevel {
  FULL = 'FULL',
  LIMITED = 'LIMITED',
  VIEW_ONLY = 'VIEW_ONLY',
  SCHEDULED = 'SCHEDULED',
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',
}
```

### ✅ **InvitationStatus** (`src/households/enums/invitation.enums.ts`)

**Before:**
```typescript
export enum InvitationStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
  expired = 'expired',
  cancelled = 'cancelled',
}
```

**After (PostgreSQL Convention):**
```typescript
export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
```

### ✅ **ViolationType, EnforcementAction** (`src/quotas/enums/violation.enums.ts`)

**Before:**
```typescript
export enum ViolationType {
  TIME_EXCEEDED = 'time_exceeded',
  USAGE_EXCEEDED = 'usage_exceeded',
  ENERGY_EXCEEDED = 'energy_exceeded',
  COST_EXCEEDED = 'cost_exceeded',
  SCHEDULE_VIOLATION = 'schedule_violation',
  ACCESS_VIOLATION = 'access_violation',
}

export enum EnforcementAction {
  WARN = 'warn',
  RESTRICT = 'restrict',
  BLOCK = 'block',
}
```

**After (PostgreSQL Convention):**
```typescript
export enum ViolationType {
  TIME_EXCEEDED = 'TIME_EXCEEDED',
  USAGE_EXCEEDED = 'USAGE_EXCEEDED',
  ENERGY_EXCEEDED = 'ENERGY_EXCEEDED',
  COST_EXCEEDED = 'COST_EXCEEDED',
  SCHEDULE_VIOLATION = 'SCHEDULE_VIOLATION',
  ACCESS_VIOLATION = 'ACCESS_VIOLATION',
}

export enum EnforcementAction {
  WARN = 'WARN',
  RESTRICT = 'RESTRICT',
  BLOCK = 'BLOCK',
}
```

### ✅ **OverrideType, OverrideStatus** (`src/quotas/enums/override.enums.ts`)

**Before:**
```typescript
export enum OverrideType {
  ADD_TIME = 'add_time',
  UNLOCK_DAY = 'unlock_day',
  EMERGENCY_OVERRIDE = 'emergency_override',
}

export enum OverrideStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}
```

**After (PostgreSQL Convention):**
```typescript
export enum OverrideType {
  ADD_TIME = 'ADD_TIME',
  UNLOCK_DAY = 'UNLOCK_DAY',
  EMERGENCY_OVERRIDE = 'EMERGENCY_OVERRIDE',
}

export enum OverrideStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
```

## Application-Only Enums Fixed

### ✅ **ConnectionEventType** (`src/shared/websockets/dto/websocket-message.dto.ts`)

**Before:**
```typescript
export enum ConnectionEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  AUTHENTICATION_FAILED = 'authentication_failed',
}
```

**After (TypeScript Convention):**
```typescript
export enum ConnectionEventType {
  CONNECTED = 'CONNECTED',           // UPPER_SNAKE_CASE for TypeScript enums
  DISCONNECTED = 'DISCONNECTED',     // UPPER_SNAKE_CASE for TypeScript enums
  ERROR = 'ERROR',                   // UPPER_SNAKE_CASE for TypeScript enums
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED', // UPPER_SNAKE_CASE for TypeScript enums
}
```

### ✅ **QuotaSubscriptionType** (`src/shared/websockets/dto/quota-websocket.dto.ts`)

**Before:**
```typescript
export enum QuotaSubscriptionType {
  STATUS = 'status',
  ALERTS = 'alerts',
  ALL = 'all',
}
```

**After (TypeScript Convention):**
```typescript
export enum QuotaSubscriptionType {
  STATUS = 'STATUS',     // UPPER_SNAKE_CASE for TypeScript enums
  ALERTS = 'ALERTS',     // UPPER_SNAKE_CASE for TypeScript enums
  ALL = 'ALL',           // UPPER_SNAKE_CASE for TypeScript enums
}
```

### ✅ **AirConditionerMode** (`src/shared/websockets/dto/airconditioner-websocket.dto.ts`)

**Before:**
```typescript
export enum AirConditionerMode {
  OFF = 'off',
  HEAT_COOL = 'heat_cool',
  COOL = 'cool',
  DRY = 'dry',
  HEAT = 'heat',
  FAN_ONLY = 'fan_only',
}
```

**After (TypeScript Convention):**
```typescript
export enum AirConditionerMode {
  OFF = 'OFF',
  HEAT_COOL = 'HEAT_COOL',
  COOL = 'COOL',
  DRY = 'DRY',
  HEAT = 'HEAT',
  FAN_ONLY = 'FAN_ONLY',
}
```

### ✅ **Duplicate Enum Resolution**

**Issue Found:** `OverrideStatus` was duplicated in two files:
- `src/quotas/enums/override.enums.ts` (database enum)
- `src/shared/websockets/dto/quota-websocket.dto.ts` (duplicate)

**Solution:** Removed duplicate from WebSocket DTO and added import:
```typescript
import { OverrideStatus } from '../../../quotas/enums/override.enums';
```

## Entity References Updated

### ✅ **FamilyInvitation Entity** (`src/households/entities/family-invitation.entity.ts`)

**Updated all enum references:**
- Default values: `UserRole.CHILD`, `InvitationStatus.PENDING`
- Property getters: `InvitationStatus.PENDING`, `InvitationStatus.ACCEPTED`, etc.
- Method implementations: All status updates use uppercase enum values

### ✅ **Auth Integration Files**

**Files Updated:**
- `src/shared/decorators/roles.decorator.ts` - Updated to use `UserRole` enum
- `src/shared/types/auth.ts` - Updated `JwtClaims` interface to use `UserRole`
- `src/auth/tokens/tokens.service.ts` - Updated default role to `UserRole.PARENT`

## Files Requiring Manual Updates

The following files still contain hardcoded enum values that need manual updates:

1. **Controllers:** Multiple controller files using `'parent'` instead of `UserRole.PARENT`
2. **Services:** Some service files with hardcoded enum values
3. **DTOs:** Various DTOs with hardcoded string values instead of enum references

**Example Issues Found:**
```typescript
// ❌ Still needs fixing:
@Roles('parent')  // Should be: @Roles(UserRole.PARENT)
role: 'parent'    // Should be: role: UserRole.PARENT
```

## Database Migration Requirements

### **PostgreSQL Enum Type Definitions Needed**

For the updated enum conventions, the following PostgreSQL enum types should be created:

```sql
-- User role enum
CREATE TYPE user_role_enum AS ENUM (
  'ADMIN', 'PARENT', 'ADULT', 'TEEN', 'CHILD', 'GUEST'
);

-- User status enum
CREATE TYPE user_status_enum AS ENUM (
  'ACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED'
);

-- Access level enum
CREATE TYPE access_level_enum AS ENUM (
  'FULL', 'LIMITED', 'VIEW_ONLY', 'SCHEDULED', 'EMERGENCY_ONLY'
);

-- Invitation status enum
CREATE TYPE invitation_status_enum AS ENUM (
  'PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'
);

-- Violation type enum
CREATE TYPE violation_type_enum AS ENUM (
  'TIME_EXCEEDED', 'USAGE_EXCEEDED', 'ENERGY_EXCEEDED',
  'COST_EXCEEDED', 'SCHEDULE_VIOLATION', 'ACCESS_VIOLATION'
);

-- Enforcement action enum
CREATE TYPE enforcement_action_enum AS ENUM (
  'WARN', 'RESTRICT', 'BLOCK'
);

-- Override type enum
CREATE TYPE override_type_enum AS ENUM (
  'ADD_TIME', 'UNLOCK_DAY', 'EMERGENCY_OVERRIDE'
);

-- Override status enum
CREATE TYPE override_status_enum AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'
);
```

### **Column Type Updates**

Existing columns need to be updated to use the new enum types:

```sql
-- Example updates needed
ALTER TABLE users
ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum,
ALTER COLUMN status TYPE user_status_enum USING status::user_status_enum;

ALTER TABLE family_invitations
ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum,
ALTER COLUMN status TYPE invitation_status_enum USING status::invitation_status_enum;

-- ... similar updates for other tables
```

## Validation Strategy

### **Phase 1: TypeScript Compilation**
- ✅ Fixed enum definitions with proper naming conventions
- ✅ Updated entity references to use new enum values
- ⚠️ Some controller/service files still need updates

### **Phase 2: Database Schema**
- 🔄 Need to create PostgreSQL enum types with UPPER_SNAKE_CASE values
- 🔄 Need to update existing columns to use new enum types
- 🔄 Need to update existing data to use new enum values

### **Phase 3: Application Testing**
- 🔄 Need to test all enum-related functionality
- 🔄 Need to verify database enum constraints work properly
- 🔄 Need to test API endpoints with enum validation

## Corrected Enum Convention Standards Applied

### **Standard Rule for MOST Enums**
Most enums in the application follow these standards:

| Layer | Naming Example | Case Style | Convention Applied |
|------|----------------|------------|-------------------|
| TypeScript Enum Name | `UserRole` / `ConnectionEventType` | `PascalCase` | All enum names |
| TypeScript Enum Key | `ADMIN` / `CONNECTED` | `UPPER_SNAKE_CASE` | All enum keys |
| TypeScript Enum Value | `'ADMIN'` / `'CONNECTED'` | `UPPER_SNAKE_CASE` | All enum values |

### **EXCEPTION: Event-Type Enums**
Enums used for event messaging follow a different convention for semantic clarity:

| Layer | Naming Example | Case Style | Convention Applied |
|------|----------------|------------|-------------------|
| TypeScript Enum Name | `WebSocketEventType` | `PascalCase` | All enum names |
| TypeScript Enum Key | `DEVICE_STATUS_CHANGED` | `UPPER_SNAKE_CASE` | All enum keys |
| TypeScript Enum Value | `'device.status.changed'` | `dot.notated.lowercase` | Event-type only |

**Examples of Event-Type Enums:**
```typescript
export enum WebSocketEventType {
  DEVICE_STATUS_CHANGED = 'device.status.changed',
  QUOTA_STATUS_CHANGED = 'quota.status.changed',
  OVERRIDE_REQUESTED = 'override.requested',
  WARNING_THRESHOLD_REACHED = 'warning.threshold.reached',
}
```

### **Database vs Application vs Event-Type Distinction**

**Database-Used Enums:**
- Values must match PostgreSQL enum types exactly
- Database enum types use `snake_case_enum` naming (e.g., `user_role_enum`)
- Values use `UPPER_SNAKE_CASE` for PostgreSQL compatibility

**Application-Only Enums:**
- No database constraints
- Use `UPPER_SNAKE_CASE` for TypeScript standard convention
- Follow the same naming pattern as database enums for consistency

**Event-Type Enums (Special Case):**
- Use `dot.notated.lowercase` for semantic clarity and system integration
- Follow hierarchical naming pattern for event routing and parsing
- Designed for WebSocket/MQTT messaging systems
- **Example:** `'device.status.changed'` instead of `'DEVICE_STATUS_CHANGED'`

## Reasoning for Event-Type Enum Exception

### **Why Keep Dot-Notated Lowercase Values?**

1. **Semantic Clarity**
   - `'device.status.changed'` clearly indicates: device → status → changed
   - `'DEVICE_STATUS_CHANGED'` is less readable and loses the hierarchical meaning

2. **Event Routing & Parsing**
   - Many event systems parse dot notation for routing decisions
   - Frontend can easily split on '.' to handle events by category
   - Enables pattern matching like `device.*` for all device events

3. **Industry Standard**
   - MQTT, WebSocket, and event-driven systems commonly use dot notation
   - Matches patterns used in cloud event specifications
   - Compatible with existing message broker conventions

4. **System Integration**
   - External services may expect this format for event subscriptions
   - MQTT topics typically use hierarchical dot notation
   - WebSocket libraries often use this pattern for event names

5. **Readability at Scale**
   - Developers can quickly understand event purpose from the name
   - Consistent with logging and monitoring systems
   - Better debugging capabilities with descriptive event names

### **When to Use Each Convention**

| Use UPPER_SNAKE_CASE when: | Use dot.notated.lowercase when: |
|---------------------------|----------------------------------|
| Database storage values | Event/message type definitions |
| User roles and statuses | WebSocket event types |
| Configuration settings | MQTT topic names |
| Application states | System event notifications |
| Error codes | Logging event categories |

## Benefits Achieved

1. **Consistency:** All standard enums follow the same `UPPER_SNAKE_CASE` value convention
2. **Semantic Clarity:** Event-type enums use meaningful dot notation for better understanding
3. **Database Compatibility:** Database enum values match PostgreSQL uppercase convention
4. **Type Safety:** Better TypeScript integration with proper enum types
5. **Maintainability:** Clear guidelines for when to use each convention
6. **Standards Compliance:** Follows TypeScript standard convention AND industry best practices for events
7. **System Integration:** Event enums are compatible with MQTT and WebSocket routing systems

## Next Steps

1. **Complete Manual Updates:** Fix remaining hardcoded enum values in controllers and services
2. **Database Migration:** Implement PostgreSQL enum type creation and column updates
3. **Testing:** Comprehensive testing of enum functionality across all layers
4. **Documentation:** Update API documentation to reflect enum value changes

The enum convention fixes establish a solid foundation for maintainable, standards-compliant code that works seamlessly with both TypeScript and PostgreSQL.