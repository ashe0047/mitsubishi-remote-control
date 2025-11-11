# Entity Relationship Analysis Report

## Executive Summary

This document provides a comprehensive analysis of the entity relationships in the Mitsubishi Air Conditioner Remote Control system's NestJS backend. The analysis identifies current relationship strengths, critical gaps, and provides specific recommendations for implementing missing relationships following NestJS/TypeORM best practices.

## System Overview

The system implements a sophisticated multi-tenant AC control and quota management platform with the following core entities:

- **Household**: Multi-tenant organization structure
- **User**: User management with role-based access
- **Room**: Physical locations with AC units
- **Device**: Mitsubishi AC devices
- **UsageSession**: Detailed AC usage tracking
- **Quota**: Comprehensive quota enforcement system
- **QuotaViolation**: Violation tracking and resolution
- **QuotaOverride**: Temporary quota modifications
- **UserRoomAssignment**: Room-level access control
- **FamilyInvitation**: Household member invitations
- **DeviceStatusHistory**: Device state tracking

## Current Entity Relationship Analysis

### Strengths of Current Implementation

#### ✅ **Well-Designed Core Relationships**
- **Household → User (1:N)**: Proper cascade delete with FK constraints
- **Household → Room (1:N)**: Clean hierarchical structure
- **User → Quota (1:N)**: Effective quota ownership model
- **User → UsageSession (1:N)**: Complete session tracking
- **Quota → QuotaViolation (1:N)**: Proper violation linkage

#### ✅ **Sophisticated Access Control**
- **UserRoomAssignment**: Fine-grained room access with temporal controls
- **Schedule-based permissions**: JSON-based time restrictions
- **Action-level control**: Granular AC operation permissions

#### ✅ **Comprehensive Quota System**
- **Multiple quota types**: Time, usage, energy, cost-based quotas
- **Flexible scope**: Global, room-level, device-level quotas
- **Advanced enforcement**: Warnings, grace periods, overrides

#### ✅ **Business Key Consistency**
- **Room.roomIdentifier**: Stable business key for cross-references
- **Consistent referencing**: UsageSession, UserRoomAssignment use roomIdentifier

### Critical Relationship Gaps

#### ❌ **1. Device-Room Relationship Integrity Issue**

**Current State:**
```typescript
// Device Entity - INCONSISTENT REFERENCE
@Column({ type: 'uuid' })
roomId: string;  // References Room.id (UUID)

// UsageSession Entity - CONSISTENT BUSINESS KEY REFERENCE
@Column({ type: 'varchar', length: 255 })
roomId: string;  // References Room.roomIdentifier (VARCHAR)
```

**Problem**: Device references Room.id while other entities reference Room.roomIdentifier, creating an inconsistent relationship pattern.

**Impact**:
- Data integrity not enforced
- Query complexity increased
- Potential orphaned device records

#### ❌ **2. Missing Device-UsageSession Relationship**

**Current State:**
```typescript
// UsageSession has no device reference
@Entity()
export class UsageSession {
  @Column({ type: 'varchar' })
  roomId: string;  // Only room-level tracking

  // NO deviceId field
  // NO device relationship
}
```

**Problem**: Cannot track which specific device was used in each session.

**Impact:**
- Multiple devices per room cannot be distinguished
- Device-specific usage analytics impossible
- Maintenance tracking per device unavailable

#### ❌ **3. Missing QuotaViolation-UsageSession Relationship**

**Current State:**
```typescript
// QuotaViolation has no session reference
@Entity()
export class QuotaViolation {
  @Column({ type: 'varchar' })
  roomId: string;

  // NO usageSessionId field
  // NO usageSession relationship
}
```

**Problem**: Cannot link violations to specific usage sessions.

**Impact:**
- Violation context lost
- Session-specific violation analysis impossible
- Audit trail incomplete

#### ❌ **4. Missing Device-Level Access Control**

**Current State:**
```typescript
// Only room-level access control exists
@Entity()
export class UserRoomAssignment {
  // Room-level permissions only
  // No device-specific access control
}
```

**Problem**: No fine-grained device access control.

**Impact:**
- All devices in room inherit same permissions
- Cannot restrict specific devices to certain users
- Guest/maintenance access difficult to manage

#### ❌ **5. Missing Device Status History Integration**

**Current State:**
```typescript
// DeviceStatusHistory isolated from usage
@Entity()
export class DeviceStatusHistory {
  @Column({ type: 'varchar' })
  deviceId: string;

  // NO usageSessionId field
  // No integration with usage sessions
}
```

**Problem**: Cannot correlate device status changes with usage sessions.

**Impact:**
- Limited device behavior analysis
- Cannot optimize device settings based on usage patterns
- Diagnostic capabilities reduced

## Recommended Relationship Enhancements

### 1. **Standardize Device-Room Relationship**

**Fix Type:** Consistency Issue → Data Integrity

**Recommendation:** Standardize Device entity to use roomIdentifier like other entities.

```typescript
@Entity('devices')
export class Device extends BaseEntity {
  // CHANGE: Use business key reference
  @Column({ type: 'varchar', length: 255 })
  roomId: string;  // References Room.roomIdentifier

  // ADD: Proper relationship
  @ManyToOne(() => Room, room => room.devices, {
    nullable: true,
    onDelete: 'CASCADE',
    referencedColumnName: 'roomIdentifier'  // Key: Reference business key
  })
  @JoinColumn({
    name: 'roomId',
    referencedColumnName: 'roomIdentifier'
  })
  room: Room;
}

// ADD reverse relationship to Room
@OneToMany(() => Device, device => device.room)
devices: Device[];
```

### 2. **Add Device-UsageSession Relationship**

**Fix Type:** Missing Relationship → Audit Trail Enhancement

```typescript
@Entity('usage_sessions')
export class UsageSession extends BaseEntity {
  // ADD: Device reference
  @Column({ type: 'uuid', nullable: true })
  deviceId: string;

  @ManyToOne(() => Device, device => device.usageSessions, {
    nullable: true,
    onDelete: 'SET NULL'  // Preserve session if device deleted
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device;
}

// ADD reverse relationship to Device
@OneToMany(() => UsageSession, session => session.device)
usageSessions: UsageSession[];
```

### 3. **Add QuotaViolation-UsageSession Relationship**

**Fix Type:** Missing Relationship → Audit Trail Enhancement

```typescript
@Entity('quota_violations')
export class QuotaViolation extends BaseEntity {
  // ADD: Session reference
  @Column({ type: 'uuid', nullable: true })
  usageSessionId: string;

  @ManyToOne(() => UsageSession, session => session.violations, {
    nullable: true,
    onDelete: 'CASCADE'  // Violations meaningless without session
  })
  @JoinColumn({ name: 'usageSessionId' })
  usageSession: UsageSession;
}

// ADD reverse relationship to UsageSession
@OneToMany(() => QuotaViolation, violation => violation.usageSession)
violations: QuotaViolation[];
```

### 4. **Add Device-Level Access Control**

**Fix Type:** Missing Entity → Access Control Enhancement

**New Entity: DeviceUserAssignment**
```typescript
@Entity('device_user_assignments')
export class DeviceUserAssignment extends BaseEntity {
  @ManyToOne(() => User, user => user.deviceAssignments, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Device, device => device.userAssignments, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column({
    type: 'varchar',
    length: 50,
    enum: DeviceAccessLevel
  })
  accessLevel: DeviceAccessLevel;

  @Column({ type: 'jsonb', nullable: true })
  permissions: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  restrictions: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;
}

// ADD device access level enum
export enum DeviceAccessLevel {
  FULL = 'FULL',
  LIMITED = 'LIMITED',
  VIEW_ONLY = 'VIEW_ONLY',
  MAINTENANCE = 'MAINTENANCE',
  EMERGENCY = 'EMERGENCY'
}

// ADD reverse relationships
// To User entity
@OneToMany(() => DeviceUserAssignment, assignment => assignment.user)
deviceAssignments: DeviceUserAssignment[];

// To Device entity
@OneToMany(() => DeviceUserAssignment, assignment => assignment.device)
userAssignments: DeviceUserAssignment[];
```

### 5. **Enhance Device Status History Integration**

**Fix Type:** Missing Relationship → Analytics Enhancement

```typescript
@Entity('device_status_history')
export class DeviceStatusHistory extends BaseEntity {
  // ADD: Session reference
  @Column({ type: 'uuid', nullable: true })
  usageSessionId: string;

  @ManyToOne(() => UsageSession, {
    nullable: true,
    onDelete: 'SET NULL'  // Preserve history even if session deleted
  })
  @JoinColumn({ name: 'usageSessionId' })
  usageSession: UsageSession;
}
```

## Enhanced Entity Relationship Diagram

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Household     │      │       User       │      │   Quota         │
│─────────────────│      │──────────────────│      │─────────────────│
│ id (PK)         │◄─────┤ id (PK)          │◄─────┤ id (PK)         │
│ name            │      │ householdId (FK) │      │ userId (FK)     │
│ billingEmail    │      │ email            │      │ quotaType       │
│ timezone        │      │ role             │      │ scope           │
│ settings        │      │ status           │      │ allowedAmount   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                         │                         │
         │                         │                         │
         │            ┌────────────┴────────────┐           │
         │            │                         │           │
         │            ▼                         ▼           ▼
         │    ┌─────────────────┐      ┌─────────────────┐   │
         │    │ FamilyInvitation│      │ UsageSession    │   │
         │    │─────────────────│      │─────────────────│   │
         │    │ householdId(FK) │      │ userId (FK)     │   │
         │    │ invitedByUserId │      │ roomId (FK)     │   │
         │    │ acceptedUserId  │      │ deviceId (FK)   │   │
         │    │ status          │      │ startedAt       │   │
         │    │ expiresAt       │      │ endedAt         │   │
         │    └─────────────────┘      │ status          │   │
         │             │                │ energyConsumed │   │
         │             │                └─────────────────┘   │
         │             │                         │           │
         │             ▼                         ▼           │
         │    ┌─────────────────┐      ┌─────────────────┐   │
         │    │ UserRoomAssign. │      │ QuotaViolation  │   │
         │    │─────────────────│      │─────────────────│   │
         │    │ userId (FK)     │      │ userId (FK)     │   │
         │    │ roomId (FK)     │      │ quotaId (FK)    │   │
         │    │ accessLevel     │      │ usageSessionId(FK)│ │
         │    │ validFrom       │      │ violationType   │   │
         │    │ validUntil      │      │ resolved        │   │
         │    └─────────────────┘      └─────────────────┘   │
         │                                              ▲   │
         │                                              │   │
         │            ┌─────────────────┐              │   │
         │            │   QuotaOverride │              │   │
         │            │─────────────────│              │   │
         │            │ quotaId (FK)    │───────────────┘   │
         │            │ requestedByUserId│                  │
         │            │ approvedByUserId│                  │
         │            │ status          │                  │
         │            │ expiresAt       │                  │
         │            └─────────────────┘                  │
         │                                                  │
         ▼                                                  ▼
┌─────────────────┐                              ┌─────────────────┐
│      Room       │                              │DeviceStatusHist │
│─────────────────│                              │─────────────────│
│ id (PK)         │                              │ id (PK)         │
│ roomIdentifier  │                              │ deviceId (FK)   │
│ householdId (FK)│                              │ usageSessionId(FK)│
│ name            │                              │ payload         │
│ location        │                              │ timestamp       │
│ description     │                              └─────────────────┘
└─────────────────┘                                        │
         │                                                 │
         │                ┌─────────────────┐             │
         │                │     Device      │             │
         │                │─────────────────│             │
         │                │ id (PK)         │             │
         │                │ roomId (FK)     │─────────────┘
         │                │ identifier      │
         │                │ manufacturer    │
         │                │ model           │
         │                │ enabled         │
         │                │ metadata        │
         │                └─────────────────┘
         │                         │
         │            ┌────────────┴────────────┐
         │            │                         │
         ▼            ▼                         ▼
┌─────────────────┐ ┌─────────────────┐   ┌─────────────────┐
│DeviceUserAssign.│ │ UsageSession    │   │DeviceStatusHist │
│─────────────────│ │─────────────────│   │─────────────────│
│ userId (FK)     │ │ deviceId (FK)   │   │ deviceId (FK)   │
│ deviceId (FK)   │ │ roomId (FK)     │   │ usageSessionId(FK)│
│ accessLevel     │ │ userId (FK)     │   │ payload         │
│ validFrom       │ │ startedAt       │   │ timestamp       │
│ validUntil      │ │ endedAt         │   └─────────────────┘
│ permissions     │ │ status          │
│ restrictions    │ │ energyConsumed │
└─────────────────┘ │ violations      │
                    └─────────────────┘
```

**Legend:**
- **Solid lines**: Current relationships with FK constraints
- **Dashed lines**: Recommended new relationships
- **PK**: Primary Key
- **FK**: Foreign Key

## Database Schema Optimizations

### Recommended Indexes

```sql
-- Business key indexes
CREATE UNIQUE INDEX idx_room_identifier ON rooms(roomIdentifier);
CREATE UNIQUE INDEX idx_device_room_identifier ON devices(roomId, identifier);

-- Foreign key indexes
CREATE INDEX idx_user_household ON users(householdId);
CREATE INDEX idx_room_household ON rooms(householdId);
CREATE INDEX idx_quota_user ON quotas(userId);
CREATE INDEX idx_usage_session_user ON usage_sessions(userId);
CREATE INDEX idx_usage_session_room ON usage_sessions(roomId);
CREATE INDEX idx_usage_session_device ON usage_sessions(deviceId); -- NEW

-- Composite indexes for common queries
CREATE INDEX idx_usage_session_composite ON usage_sessions(userId, roomId, startedAt);
CREATE INDEX idx_quota_violation_composite ON quota_violations(userId, quotaId, createdAt);
CREATE INDEX idx_device_user_assignment_composite ON device_user_assignments(deviceId, userId, accessLevel); -- NEW

-- JSONB field indexes
CREATE INDEX idx_user_preferences ON users USING GIN(preferences);
CREATE INDEX idx_room_settings ON rooms USING GIN(settings);
CREATE INDEX idx_device_metadata ON devices USING GIN(metadata);
```

### Partitioning Strategy

```sql
-- Partition usage sessions by month for performance
CREATE TABLE usage_sessions (
    -- existing columns
) PARTITION BY RANGE (startedAt);

-- Monthly partitions
CREATE TABLE usage_sessions_2025_01 PARTITION OF usage_sessions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Partition device status history by month
CREATE TABLE device_status_history (
    -- existing columns
) PARTITION BY RANGE (timestamp);
```

## Implementation Priority

### **Priority 1: Critical Data Integrity**
1. **Standardize Device-Room relationship** - Fix inconsistent reference pattern
2. **Add Device-UsageSession relationship** - Enable proper device tracking

### **Priority 2: Audit Trail Enhancement**
3. **Add QuotaViolation-UsageSession relationship** - Complete violation tracking
4. **Enhance DeviceStatusHistory integration** - Improve analytics capabilities

### **Priority 3: Access Control Enhancement**
5. **Implement DeviceUserAssignment entity** - Fine-grained device access control

## Migration Strategy

### Phase 1: Core Relationship Fixes
```sql
-- 1. Update Device entity to use roomIdentifier
ALTER TABLE devices
ADD COLUMN room_identifier VARCHAR(255);

-- Populate room_identifier from room table
UPDATE devices d
SET room_identifier = r.roomIdentifier
FROM rooms r
WHERE d.roomId = r.id;

-- 2. Add deviceId to usage_sessions
ALTER TABLE usage_sessions
ADD COLUMN device_id UUID;

-- 3. Add usageSessionId to quota_violations
ALTER TABLE quota_violations
ADD COLUMN usage_session_id UUID;
```

### Phase 2: New Entity Creation
```sql
-- Create device_user_assignments table
CREATE TABLE device_user_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deviceId UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    accessLevel VARCHAR(50) NOT NULL,
    permissions JSONB,
    restrictions JSONB,
    validFrom TIMESTAMP,
    validUntil TIMESTAMP,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 3: Data Migration and Validation
- Migrate existing permissions to new structure
- Validate data integrity
- Update application code to use new relationships
- Performance testing with new indexes

## Impact Analysis

### **Positive Impacts**
1. **Enhanced Data Integrity**: Proper FK constraints prevent orphaned records
2. **Improved Audit Capabilities**: Complete relationship chain from device to violations
3. **Better Performance**: Optimized indexes for common query patterns
4. **Fine-Grained Access Control**: Device-level permission management
5. **Enhanced Analytics**: Correlation between device usage and status changes

### **Implementation Risks**
1. **Data Migration Complexity**: Need to handle existing data carefully
2. **Application Updates**: All service layers need updates for new relationships
3. **Performance Impact**: New relationships may affect query performance initially
4. **Backward Compatibility**: API changes may impact frontend integration

### **Mitigation Strategies**
1. **Gradual Migration**: Implement changes in phases with rollback capability
2. **Comprehensive Testing**: Unit, integration, and performance testing
3. **Staged Deployment**: Deploy to staging first, then production
4. **Monitoring**: Track performance and data integrity post-deployment

## Conclusion

The current entity relationship structure is well-designed for the core business requirements but has several critical gaps that impact data integrity and audit capabilities. The recommended enhancements will:

1. **Standardize relationship patterns** across all entities
2. **Complete the audit trail** from device usage to quota violations
3. **Enable fine-grained access control** at the device level
4. **Improve analytics capabilities** through better data correlation

The implementation should follow the prioritized approach, focusing first on critical data integrity issues, then moving to audit trail enhancements, and finally implementing advanced access control features.

With these improvements, the system will have a robust, scalable, and maintainable entity relationship structure that supports the sophisticated AC control and quota management requirements while following NestJS/TypeORM best practices.