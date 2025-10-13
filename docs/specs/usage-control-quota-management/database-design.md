# Usage Control & Quota Management - Database Design

## Executive Summary

This document outlines the database schema design for the Usage Control & Quota Management system. The design prioritizes **extensibility** while starting with MVP simplicity, using established patterns that can evolve from simple family controls to complex enterprise features without major schema rewrites.

## Design Philosophy

### Core Principles

1. **Start Simple, Design for Future**: MVP focuses on parent/child quotas, but schema supports enterprise complexity
2. **Event Sourcing Ready**: Design allows for eventual audit trails and time-travel debugging
3. **Multi-Tenancy Aware**: Schema supports single households but can scale to property management
4. **Performance First**: Optimized for real-time quota validation (<1 second response)
5. **Type Safety**: Strong typing with enum constraints and validation

### Technology Selection

**Primary Database: PostgreSQL 15+**
- **Reasoning**: JSONB for flexible configuration, excellent performance, ACID compliance
- **Alternative Considered**: MySQL (rejected: weaker JSON support)
- **Future Migration Path**: Time-series data to InfluxDB/TimescaleDB for analytics

**ORM Strategy: Spring Data JPA with R2DBC**
- **Reasoning**: Reactive support for WebFlux, familiar JPA patterns
- **Alternative Considered**: Native SQL (rejected: development speed)
- **Migration Path**: Add reactive repositories incrementally

---

## Schema Design

### Core Entity Relationships

```
Households (1) ──→ (N) Users
Users (N) ──→ (N) Rooms (via UserRoomAccess)
Users (1) ──→ (N) Quotas
Quotas (1) ──→ (N) UsageSessions  
Users (1) ──→ (N) UsageSessions
Rooms (1) ──→ (N) UsageSessions
```

### 1. User Management Schema

```sql
-- Core user account table
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Extensibility: Business features
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    billing_email VARCHAR(255),
    
    -- Extensibility: Multi-property
    address JSONB,
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Extensibility: Enterprise features  
    organization_id UUID,
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for performance
    INDEX idx_households_org (organization_id),
    INDEX idx_households_plan (subscription_plan)
);

-- User accounts with role-based access
CREATE TYPE user_role AS ENUM ('admin', 'parent', 'adult', 'teen', 'child', 'guest');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending', 'archived');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    
    -- Core user data
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'child',
    status user_status NOT NULL DEFAULT 'active',
    
    -- MVP: Basic features
    date_of_birth DATE,
    avatar_url VARCHAR(500),
    
    -- Extensibility: Advanced features
    phone VARCHAR(50),
    preferences JSONB DEFAULT '{}'::jsonb,
    emergency_contacts JSONB,
    
    -- Extensibility: Enterprise features
    employee_id VARCHAR(100),
    department VARCHAR(100),
    cost_center VARCHAR(100),
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    
    -- Indexes for performance
    INDEX idx_users_household (household_id),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_status (status)
);

-- User-Room access control (many-to-many)
CREATE TYPE access_level AS ENUM ('full', 'limited', 'view_only', 'scheduled', 'emergency_only');

CREATE TABLE user_room_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(255) NOT NULL, -- References room from existing system
    
    -- MVP: Simple access control
    access_level access_level NOT NULL DEFAULT 'limited',
    
    -- Extensibility: Time-based access
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    schedule JSONB, -- Cron-like schedule: {"monday": "09:00-17:00"}
    
    -- Extensibility: Advanced permissions
    allowed_actions JSONB DEFAULT '["power", "temperature", "fan", "mode"]'::jsonb,
    restricted_actions JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields  
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Constraints and indexes
    UNIQUE (user_id, room_id),
    INDEX idx_user_room_access_user (user_id),
    INDEX idx_user_room_access_room (room_id)
);
```

### 2. Quota Management Schema

```sql
-- Flexible quota system
CREATE TYPE quota_type AS ENUM ('time_based', 'usage_count', 'energy_based', 'cost_based');
CREATE TYPE quota_scope AS ENUM ('global', 'room', 'device');
CREATE TYPE quota_period AS ENUM ('hourly', 'daily', 'weekly', 'monthly', 'custom');
CREATE TYPE quota_status AS ENUM ('active', 'paused', 'exceeded', 'expired');
CREATE TYPE enforcement_action AS ENUM ('warn', 'restrict', 'block');

CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core quota definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quota_type quota_type NOT NULL DEFAULT 'time_based',
    scope quota_scope NOT NULL DEFAULT 'room',
    target_id VARCHAR(255), -- room_id, device_id, or NULL for global
    
    -- MVP: Time-based quotas
    allowed_amount DECIMAL(10,2) NOT NULL, -- Hours for time_based
    used_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Quota period and reset logic
    period quota_period NOT NULL DEFAULT 'daily',
    period_start TIMESTAMPTZ, -- For custom periods
    period_duration INTERVAL, -- For custom periods
    reset_time TIME DEFAULT '00:00:00', -- When daily quotas reset
    
    -- Enforcement configuration
    enforcement_action enforcement_action NOT NULL DEFAULT 'block',
    status quota_status NOT NULL DEFAULT 'active',
    
    -- Extensibility: Advanced features
    priority INTEGER DEFAULT 1,
    allow_rollover BOOLEAN DEFAULT false,
    max_rollover_amount DECIMAL(10,2),
    
    -- Warning thresholds (percentages)
    warning_thresholds INTEGER[] DEFAULT ARRAY[75, 90], 
    notification_methods TEXT[] DEFAULT ARRAY['in_app'],
    
    -- Extensibility: Grace periods and overrides
    grace_period_minutes INTEGER DEFAULT 0,
    max_grace_uses INTEGER DEFAULT 1,
    grace_cooldown_hours INTEGER DEFAULT 24,
    
    -- Extensibility: Sharing and borrowing
    allow_sharing BOOLEAN DEFAULT false,
    allow_borrowing BOOLEAN DEFAULT false,
    sharing_pool_id UUID, -- For shared quota pools
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reset_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    
    -- Indexes for performance
    INDEX idx_quotas_user (user_id),
    INDEX idx_quotas_target (target_id),
    INDEX idx_quotas_status (status),
    INDEX idx_quotas_type_scope (quota_type, scope)
);

-- Quota usage history and audit trail
CREATE TABLE quota_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quota_id UUID NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
    
    -- Usage event details
    amount_used DECIMAL(10,2) NOT NULL,
    previous_total DECIMAL(10,2) NOT NULL,
    new_total DECIMAL(10,2) NOT NULL,
    remaining_amount DECIMAL(10,2) NOT NULL,
    
    -- Event context
    event_type VARCHAR(50) NOT NULL, -- 'usage', 'reset', 'override', 'adjustment'
    source VARCHAR(50), -- 'system', 'manual', 'grace_period'
    
    -- Extensibility: Rich context
    metadata JSONB DEFAULT '{}'::jsonb, -- Device settings, weather, etc.
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Indexes for performance
    INDEX idx_quota_usage_events_quota (quota_id),
    INDEX idx_quota_usage_events_created (created_at),
    INDEX idx_quota_usage_events_type (event_type)
);
```

### 3. Usage Tracking Schema  

```sql
-- Real-time usage sessions
CREATE TYPE session_status AS ENUM ('active', 'completed', 'interrupted', 'override');

CREATE TABLE usage_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core session data
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL DEFAULT 'ac',
    
    -- Session timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER, -- Calculated field
    status session_status NOT NULL DEFAULT 'active',
    
    -- Device state during session
    initial_settings JSONB, -- AC settings when started
    final_settings JSONB,   -- AC settings when ended
    
    -- MVP: Basic tracking
    temperature_set DECIMAL(4,1),
    mode VARCHAR(50),
    fan_speed VARCHAR(50),
    
    -- Extensibility: Advanced metrics
    energy_consumed DECIMAL(10,4), -- kWh
    estimated_cost DECIMAL(10,2),  -- USD
    efficiency_rating DECIMAL(3,2), -- 0.0-1.0
    
    -- Environmental context
    outdoor_temperature DECIMAL(4,1),
    weather_conditions VARCHAR(100),
    
    -- Quota impact tracking
    quota_violations JSONB, -- Which quotas were affected
    override_reason TEXT,
    override_by UUID REFERENCES users(id),
    
    -- Extensibility: Rich context
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for performance
    INDEX idx_usage_sessions_user (user_id),
    INDEX idx_usage_sessions_room (room_id),
    INDEX idx_usage_sessions_started (started_at),
    INDEX idx_usage_sessions_status (status)
);

-- Real-time quota validation cache
CREATE TABLE quota_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(255) NOT NULL,
    
    -- Cached quota status (updated on every usage event)
    total_daily_quota DECIMAL(10,2) NOT NULL DEFAULT 0,
    used_daily_quota DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_daily_quota DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Status flags for quick validation
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    in_grace_period BOOLEAN NOT NULL DEFAULT false,
    warnings_sent INTEGER DEFAULT 0,
    
    -- Next reset time for efficient cleanup
    next_reset_at TIMESTAMPTZ NOT NULL,
    
    -- Cache metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cache_version INTEGER NOT NULL DEFAULT 1,
    
    PRIMARY KEY (user_id, room_id),
    INDEX idx_quota_cache_reset (next_reset_at),
    INDEX idx_quota_cache_blocked (is_blocked)
);
```

### 4. Extensibility Schema

```sql
-- Future: Shared quota pools for families/organizations
CREATE TABLE quota_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    used_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    quota_type quota_type NOT NULL,
    period quota_period NOT NULL,
    
    -- Pool allocation rules
    allocation_strategy VARCHAR(50) DEFAULT 'equal', -- 'equal', 'priority', 'custom'
    rebalancing_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    INDEX idx_quota_pools_household (household_id)
);

-- Future: Advanced scheduling and exceptions
CREATE TABLE quota_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quota_id UUID NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
    
    -- Schedule definition
    schedule_name VARCHAR(255),
    schedule_type VARCHAR(50), -- 'recurring', 'one_time', 'seasonal'
    
    -- Time patterns
    days_of_week INTEGER[], -- [1,2,3,4,5] for weekdays
    time_ranges JSONB, -- [{"start": "09:00", "end": "17:00"}]
    date_ranges JSONB, -- [{"start": "2024-06-01", "end": "2024-08-31"}]
    
    -- Schedule-specific quota adjustments
    quota_multiplier DECIMAL(3,2) DEFAULT 1.0,
    additional_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Exception handling
    holiday_adjustments JSONB,
    emergency_overrides JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    INDEX idx_quota_schedules_quota (quota_id)
);

-- Future: Notification and alert system
CREATE TABLE quota_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_id UUID REFERENCES quotas(id) ON DELETE SET NULL,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'warning', 'blocked', 'reset', 'override'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Delivery configuration
    delivery_methods TEXT[] NOT NULL, -- ['in_app', 'push', 'email', 'sms']
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    
    -- Rich content
    action_buttons JSONB, -- [{"label": "Request Override", "action": "request_override"}]
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    INDEX idx_quota_notifications_user (user_id),
    INDEX idx_quota_notifications_delivered (delivered_at)
);
```

---

## Performance Optimization Strategy

### 1. MVP Performance Requirements

**Target Response Times:**
- Quota validation: <1 second (acceptable for MVP)
- Dashboard loading: <3 seconds
- Real-time updates: <2 seconds propagation

**Optimization Techniques:**
```sql
-- 1. Materialized quota cache for instant validation
-- Updated on every usage event via triggers
CREATE OR REPLACE FUNCTION refresh_quota_cache()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO quota_cache (user_id, room_id, total_daily_quota, used_daily_quota, remaining_daily_quota, next_reset_at)
    SELECT 
        NEW.user_id,
        us.room_id,
        q.allowed_amount,
        COALESCE(SUM(us.duration_minutes), 0) / 60.0,
        q.allowed_amount - COALESCE(SUM(us.duration_minutes), 0) / 60.0,
        date_trunc('day', NOW()) + INTERVAL '1 day'
    FROM quotas q
    LEFT JOIN usage_sessions us ON us.user_id = q.user_id 
        AND us.started_at >= date_trunc('day', NOW())
        AND us.room_id = NEW.room_id
    WHERE q.user_id = NEW.user_id
        AND q.scope = 'room'
        AND q.quota_type = 'time_based'
        AND q.status = 'active'
    GROUP BY q.id, us.room_id, q.allowed_amount
    ON CONFLICT (user_id, room_id) 
    DO UPDATE SET
        used_daily_quota = EXCLUDED.used_daily_quota,
        remaining_daily_quota = EXCLUDED.remaining_daily_quota,
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain cache
CREATE TRIGGER update_quota_cache_trigger
    AFTER INSERT OR UPDATE ON usage_sessions
    FOR EACH ROW
    EXECUTE FUNCTION refresh_quota_cache();
```

### 2. Future Performance Enhancements

**Database Partitioning:**
```sql
-- Partition usage_sessions by month for better performance
CREATE TABLE usage_sessions (
    -- ... existing columns ...
) PARTITION BY RANGE (started_at);

-- Create monthly partitions
CREATE TABLE usage_sessions_2024_01 PARTITION OF usage_sessions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

**Read Replicas for Analytics:**
```sql
-- Separate read-only database for heavy analytics queries
-- Main app uses primary DB for real-time operations
-- Dashboard/reporting uses read replica
```

---

## Data Migration Strategy

### Phase 1: MVP Implementation (Month 1-2)

```sql
-- Minimal MVP tables
CREATE TABLE households (id, name, created_at, settings);
CREATE TABLE users (id, household_id, email, password_hash, name, role);
CREATE TABLE user_room_access (id, user_id, room_id, access_level);
CREATE TABLE quotas (id, user_id, name, quota_type, allowed_amount, used_amount, period);
CREATE TABLE usage_sessions (id, user_id, room_id, started_at, ended_at, duration_minutes);
CREATE TABLE quota_cache (user_id, room_id, total_daily_quota, used_daily_quota, is_blocked);
```

### Phase 2: Enhanced Features (Month 3-6)

```sql
-- Add advanced quota features
ALTER TABLE quotas ADD COLUMN grace_period_minutes INTEGER DEFAULT 0;
ALTER TABLE quotas ADD COLUMN warning_thresholds INTEGER[] DEFAULT ARRAY[75, 90];
CREATE TABLE quota_usage_events (...);
CREATE TABLE quota_schedules (...);
```

### Phase 3: Analytics & Enterprise (Month 6+)

```sql
-- Add analytics and enterprise features
CREATE TABLE quota_pools (...);
CREATE TABLE quota_notifications (...);
-- Migrate to time-series DB for historical analytics
```

---

## Schema Validation & Constraints

```sql
-- Business logic constraints
ALTER TABLE quotas ADD CONSTRAINT quotas_positive_amount 
    CHECK (allowed_amount > 0);
    
ALTER TABLE quotas ADD CONSTRAINT quotas_valid_used_amount
    CHECK (used_amount >= 0 AND used_amount <= allowed_amount * 1.1); -- Allow 10% overage

-- Referential integrity
ALTER TABLE user_room_access ADD CONSTRAINT valid_access_dates
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until);

-- Performance constraints
CREATE UNIQUE INDEX idx_unique_active_quota_per_user_room 
    ON quotas (user_id, target_id, quota_type) 
    WHERE status = 'active' AND scope = 'room';
```

---

## Integration with Existing System

### Current System Integration

```java
// Extend existing RoomInfo DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomInfo {
    private String id;
    private String name;
    private boolean online;
    private AirConState state;
    private AirConSettings settings;
    
    // New quota-aware fields
    private List<UserQuotaStatus> userQuotas;
    private boolean hasActiveQuotas;
    private List<String> blockedUsers;
}

// New DTOs for quota system
@Data
public class UserQuotaStatus {
    private String userId;
    private String userName;
    private Double remainingQuota;
    private Boolean isBlocked;
    private Boolean inGracePeriod;
}
```

### MQTT Integration Points

```java
// Quota validation service integration
@Component
public class QuotaValidationService {
    
    public Mono<Boolean> canUserControlAC(String userId, String roomId) {
        return quotaCacheRepository
            .findByUserIdAndRoomId(userId, roomId)
            .map(cache -> !cache.isBlocked())
            .defaultIfEmpty(true); // Allow if no quota set
    }
    
    public Mono<Void> recordUsageStart(String userId, String roomId) {
        return usageSessionRepository.save(
            UsageSession.builder()
                .userId(userId)
                .roomId(roomId)
                .startedAt(Instant.now())
                .status(SessionStatus.ACTIVE)
                .build()
        ).then();
    }
}
```

---

## Security Considerations

### Data Protection

```sql
-- Row-level security for multi-tenancy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON users
    USING (household_id = current_setting('app.current_household_id')::uuid);

-- Audit trail for all quota changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Access Control

```sql
-- Database roles for different access patterns
CREATE ROLE quota_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO quota_read_only;

CREATE ROLE quota_app_user;
GRANT SELECT, INSERT, UPDATE ON quotas, usage_sessions, quota_cache TO quota_app_user;
GRANT DELETE ON usage_sessions TO quota_app_user; -- For cleanup

CREATE ROLE quota_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO quota_admin;
```

---

## Monitoring & Observability

### Key Metrics to Track

```sql
-- Performance monitoring queries
-- 1. Quota validation performance
SELECT 
    AVG(query_duration) as avg_validation_time,
    COUNT(*) as validation_count
FROM quota_performance_log 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 2. Most active users
SELECT 
    u.name,
    COUNT(us.id) as session_count,
    SUM(us.duration_minutes) as total_minutes
FROM users u
JOIN usage_sessions us ON us.user_id = u.id
WHERE us.started_at > NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.name
ORDER BY total_minutes DESC
LIMIT 10;

-- 3. Quota violation trends
SELECT 
    DATE(created_at) as date,
    COUNT(*) as violations
FROM quota_usage_events 
WHERE event_type = 'violation'
    AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## Conclusion

This database schema design provides:

✅ **MVP Simplicity**: Core tables support basic parent/child quotas  
✅ **Enterprise Ready**: Schema can scale to complex multi-tenant scenarios  
✅ **Performance Optimized**: Materialized caches and smart indexing  
✅ **Audit Compliant**: Complete change tracking and data lineage  
✅ **Extensible Architecture**: New features require minimal schema changes  

**Next Steps:**
1. Implement core MVP tables (households, users, quotas, usage_sessions)
2. Add Spring Data JPA entities and repositories
3. Implement quota validation service with caching
4. Add real-time WebSocket updates for quota status changes
5. Create database migration scripts for production deployment

The schema supports a clear evolution path from MVP to enterprise while maintaining performance and data integrity throughout the journey.