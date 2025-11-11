-- =====================================================
-- Mitsubishi Remote Control: Usage Control & Quota Management Schema
-- Version: V001
-- Description: Complete database schema for MVP quota management system
-- =====================================================

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- User roles with hierarchical permissions
CREATE TYPE user_role AS ENUM (
    'admin',        -- Full system administration
    'parent',       -- Can manage quotas and override restrictions
    'adult',        -- Standard adult access without quota restrictions
    'teen',         -- Limited access with possible quota enforcement
    'child',        -- Restricted access with quota enforcement
    'guest'         -- Temporary access
);

-- User account status
CREATE TYPE user_status AS ENUM (
    'active',       -- Normal active account
    'suspended',    -- Temporarily disabled
    'pending',      -- Account created but not activated
    'archived'      -- Account disabled but data retained
);

-- Room access level types
CREATE TYPE access_level AS ENUM (
    'full',         -- Complete control of AC settings
    'limited',      -- Basic temperature and power control only
    'view_only',    -- Can view settings but not control
    'scheduled',    -- Access based on time schedules
    'emergency_only' -- Only emergency override access
);

-- Quota configuration types
CREATE TYPE quota_type AS ENUM (
    'time_based',   -- Hours per day/week/month
    'usage_count',  -- Number of AC activations
    'energy_based', -- kWh consumption limits
    'cost_based'    -- Dollar amount limits
);

-- Quota scope definitions
CREATE TYPE quota_scope AS ENUM (
    'global',       -- Applies to all rooms/devices
    'room',         -- Specific to one room
    'device'        -- Specific to one device
);

-- Quota reset period types
CREATE TYPE quota_period AS ENUM (
    'hourly',       -- Reset every hour
    'daily',        -- Reset daily at specified time
    'weekly',       -- Reset weekly on specified day
    'monthly',      -- Reset monthly on specified date
    'custom'        -- Custom interval defined by period_duration
);

-- Current quota status
CREATE TYPE quota_status AS ENUM (
    'active',       -- Currently enforced
    'paused',       -- Temporarily disabled
    'exceeded',     -- Limit exceeded, enforcement active
    'expired'       -- Past valid date range
);

-- Enforcement actions when quota exceeded
CREATE TYPE enforcement_action AS ENUM (
    'warn',         -- Show warnings but allow usage
    'restrict',     -- Limit available actions
    'block'         -- Completely block AC control
);

-- Usage session status
CREATE TYPE session_status AS ENUM (
    'active',       -- Currently running session
    'completed',    -- Normally ended session
    'interrupted',  -- Abnormally ended (power loss, etc.)
    'override'      -- Ended by parent override
);

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Households: Multi-tenant organization structure
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    
    -- Basic configuration
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    billing_email VARCHAR(255),
    
    -- Location and time settings
    address JSONB,
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Extensibility: Enterprise features
    organization_id UUID,
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT households_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT households_valid_subscription CHECK (subscription_plan IN ('basic', 'premium', 'enterprise'))
);

-- Users: Account management with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL,
    
    -- Core authentication data
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Role and status
    role user_role NOT NULL DEFAULT 'child',
    status user_status NOT NULL DEFAULT 'active',
    
    -- Profile information
    date_of_birth DATE,
    avatar_url VARCHAR(500),
    phone VARCHAR(50),
    
    -- Extended configuration
    preferences JSONB DEFAULT '{}'::jsonb,
    emergency_contacts JSONB,
    
    -- Enterprise features
    employee_id VARCHAR(100),
    department VARCHAR(100),
    cost_center VARCHAR(100),
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_by UUID,
    
    -- Foreign key constraints
    CONSTRAINT fk_users_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Data validation constraints
    CONSTRAINT users_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_valid_birth_date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
);

-- User-Room Access Control: Many-to-many relationship with permissions
CREATE TABLE user_room_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    room_id VARCHAR(255) NOT NULL, -- References room from existing config system
    
    -- Access control
    access_level access_level NOT NULL DEFAULT 'limited',
    
    -- Time-based access (extensibility)
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    schedule JSONB, -- Example: {"monday": "09:00-17:00", "weekend": "all_day"}
    
    -- Action permissions
    allowed_actions JSONB DEFAULT '["power", "temperature", "fan", "mode"]'::jsonb,
    restricted_actions JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Foreign key constraints
    CONSTRAINT fk_user_room_assignments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_room_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Unique constraint
    CONSTRAINT uk_user_room_assignments_user_room UNIQUE (user_id, room_id),
    
    -- Data validation constraints
    CONSTRAINT user_room_assignments_valid_dates CHECK (
        valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until
    ),
    CONSTRAINT user_room_assignments_room_id_not_empty CHECK (char_length(room_id) > 0)
);

-- Quotas: Flexible quota configuration system
CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Core quota definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quota_type quota_type NOT NULL DEFAULT 'time_based',
    scope quota_scope NOT NULL DEFAULT 'room',
    target_id VARCHAR(255), -- room_id, device_id, or NULL for global
    
    -- Quota amounts (flexible for different quota types)
    allowed_amount DECIMAL(10,2) NOT NULL,
    used_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Reset and period configuration
    period quota_period NOT NULL DEFAULT 'daily',
    period_start TIMESTAMPTZ, -- For custom periods
    period_duration INTERVAL, -- For custom periods  
    reset_time TIME DEFAULT '00:00:00', -- When daily quotas reset
    
    -- Enforcement configuration
    enforcement_action enforcement_action NOT NULL DEFAULT 'block',
    status quota_status NOT NULL DEFAULT 'active',
    
    -- Advanced features
    priority INTEGER DEFAULT 1,
    allow_rollover BOOLEAN DEFAULT FALSE,
    max_rollover_amount DECIMAL(10,2),
    
    -- Warning system
    warning_thresholds INTEGER[] DEFAULT ARRAY[75, 90], -- Percentage thresholds
    notification_methods TEXT[] DEFAULT ARRAY['in_app'],
    
    -- Grace periods and overrides
    grace_period_minutes INTEGER DEFAULT 0,
    max_grace_uses INTEGER DEFAULT 1,
    grace_cooldown_hours INTEGER DEFAULT 24,
    
    -- Sharing and pooling (future extensibility)
    allow_sharing BOOLEAN DEFAULT FALSE,
    allow_borrowing BOOLEAN DEFAULT FALSE,
    sharing_pool_id UUID,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reset_at TIMESTAMPTZ,
    created_by UUID,
    
    -- Foreign key constraints
    CONSTRAINT fk_quotas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_quotas_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Data validation constraints
    CONSTRAINT quotas_positive_amount CHECK (allowed_amount > 0),
    CONSTRAINT quotas_valid_used_amount CHECK (
        used_amount >= 0 AND used_amount <= allowed_amount * 1.1 -- Allow 10% overage
    ),
    CONSTRAINT quotas_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT quotas_valid_priority CHECK (priority > 0),
    CONSTRAINT quotas_valid_grace_settings CHECK (
        max_grace_uses >= 0 AND grace_period_minutes >= 0 AND grace_cooldown_hours >= 0
    ),
    CONSTRAINT quotas_valid_rollover CHECK (
        (allow_rollover = FALSE) OR 
        (allow_rollover = TRUE AND max_rollover_amount IS NOT NULL AND max_rollover_amount >= 0)
    ),
    CONSTRAINT quotas_valid_warnings CHECK (
        array_length(warning_thresholds, 1) IS NULL OR 
        (array_length(warning_thresholds, 1) > 0 AND 
         warning_thresholds <@ ARRAY[0,10,20,25,30,40,50,60,70,75,80,85,90,95,99])
    )
);

-- Usage Sessions: Detailed tracking of AC usage
CREATE TABLE usage_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core session data
    user_id UUID NOT NULL,
    room_id VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL DEFAULT 'ac',
    
    -- Session timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER, -- Calculated field, updated when session ends
    status session_status NOT NULL DEFAULT 'active',
    
    -- Device settings during session
    initial_settings JSONB, -- AC settings when started
    final_settings JSONB,   -- AC settings when ended
    
    -- MVP: Basic AC settings tracking
    temperature_set DECIMAL(4,1),
    mode VARCHAR(50),
    fan_speed VARCHAR(50),
    
    -- Advanced metrics (for future analytics)
    energy_consumed DECIMAL(10,4), -- kWh
    estimated_cost DECIMAL(10,2),  -- USD
    efficiency_rating DECIMAL(3,2), -- 0.0-1.0
    
    -- Environmental context
    outdoor_temperature DECIMAL(4,1),
    weather_conditions VARCHAR(100),
    
    -- Quota enforcement tracking
    quota_violations JSONB, -- Which quotas were affected/exceeded
    override_reason TEXT,
    override_by UUID, -- User who performed override (parent/admin)
    
    -- Extensible metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Foreign key constraints
    CONSTRAINT fk_usage_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_usage_sessions_override_by FOREIGN KEY (override_by) REFERENCES users(id),
    
    -- Data validation constraints
    CONSTRAINT usage_sessions_room_id_not_empty CHECK (char_length(room_id) > 0),
    CONSTRAINT usage_sessions_valid_duration CHECK (
        (ended_at IS NULL AND duration_minutes IS NULL) OR 
        (ended_at IS NOT NULL AND started_at < ended_at)
    ),
    CONSTRAINT usage_sessions_valid_temperature CHECK (
        temperature_set IS NULL OR (temperature_set >= 16 AND temperature_set <= 30)
    ),
    CONSTRAINT usage_sessions_valid_energy CHECK (energy_consumed IS NULL OR energy_consumed >= 0),
    CONSTRAINT usage_sessions_valid_cost CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CONSTRAINT usage_sessions_valid_efficiency CHECK (
        efficiency_rating IS NULL OR (efficiency_rating >= 0 AND efficiency_rating <= 1)
    )
);

-- Quota Violations: Track quota breaches and enforcement actions
CREATE TABLE quota_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Violation context
    user_id UUID NOT NULL,
    quota_id UUID NOT NULL,
    usage_session_id UUID, -- Related session that caused violation (if applicable)
    
    -- Violation details
    violation_type VARCHAR(50) NOT NULL, -- 'exceeded', 'warning', 'blocked'
    violation_amount DECIMAL(10,2) NOT NULL, -- Amount over the limit
    quota_limit DECIMAL(10,2) NOT NULL, -- What the limit was at time of violation
    
    -- Enforcement taken
    enforcement_action VARCHAR(50) NOT NULL, -- 'warning_sent', 'access_blocked', 'session_ended'
    
    -- Override information
    override_granted BOOLEAN DEFAULT FALSE,
    override_by UUID, -- Parent/admin who granted override
    override_reason TEXT,
    override_duration_minutes INTEGER, -- How long override lasts
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_quota_violations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_quota_violations_quota FOREIGN KEY (quota_id) REFERENCES quotas(id) ON DELETE CASCADE,
    CONSTRAINT fk_quota_violations_usage_session FOREIGN KEY (usage_session_id) REFERENCES usage_sessions(id),
    CONSTRAINT fk_quota_violations_override_by FOREIGN KEY (override_by) REFERENCES users(id),
    CONSTRAINT fk_quota_violations_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id),
    
    -- Data validation constraints
    CONSTRAINT quota_violations_positive_amounts CHECK (
        violation_amount >= 0 AND quota_limit > 0
    ),
    CONSTRAINT quota_violations_valid_override_duration CHECK (
        override_duration_minutes IS NULL OR override_duration_minutes > 0
    ),
    CONSTRAINT quota_violations_valid_resolution CHECK (
        (resolved = FALSE) OR (resolved = TRUE AND resolved_at IS NOT NULL)
    )
);

-- =====================================================
-- 3. PERFORMANCE INDEXES
-- =====================================================

-- Households indexes
CREATE INDEX idx_households_organization ON households(organization_id);
CREATE INDEX idx_households_subscription_plan ON households(subscription_plan);
CREATE INDEX idx_households_created_at ON households(created_at);

-- Users indexes
CREATE INDEX idx_users_household_id ON users(household_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- User room assignments indexes
CREATE INDEX idx_user_room_assignments_user_id ON user_room_assignments(user_id);
CREATE INDEX idx_user_room_assignments_room_id ON user_room_assignments(room_id);
CREATE INDEX idx_user_room_assignments_access_level ON user_room_assignments(access_level);

-- Quotas indexes (critical for performance)
CREATE INDEX idx_quotas_user_id ON quotas(user_id);
CREATE INDEX idx_quotas_target_id ON quotas(target_id);
CREATE INDEX idx_quotas_status ON quotas(status);
CREATE INDEX idx_quotas_type_scope ON quotas(quota_type, scope);
CREATE INDEX idx_quotas_period ON quotas(period);
CREATE INDEX idx_quotas_last_reset ON quotas(last_reset_at);

-- Unique index for active quotas per user/room/type (prevents duplicates)
CREATE UNIQUE INDEX idx_unique_active_quota_per_user_room 
    ON quotas (user_id, target_id, quota_type) 
    WHERE status = 'active' AND scope = 'room';

-- Usage sessions indexes (high-volume table)
CREATE INDEX idx_usage_sessions_user_id ON usage_sessions(user_id);
CREATE INDEX idx_usage_sessions_room_id ON usage_sessions(room_id);
CREATE INDEX idx_usage_sessions_started_at ON usage_sessions(started_at);
CREATE INDEX idx_usage_sessions_ended_at ON usage_sessions(ended_at);
CREATE INDEX idx_usage_sessions_status ON usage_sessions(status);
CREATE INDEX idx_usage_sessions_date_range ON usage_sessions(started_at, ended_at);

-- Composite index for quota validation queries
CREATE INDEX idx_usage_sessions_quota_validation 
    ON usage_sessions(user_id, room_id, started_at) 
    WHERE status IN ('active', 'completed');

-- Quota violations indexes
CREATE INDEX idx_quota_violations_user_id ON quota_violations(user_id);
CREATE INDEX idx_quota_violations_quota_id ON quota_violations(quota_id);
CREATE INDEX idx_quota_violations_created_at ON quota_violations(created_at);
CREATE INDEX idx_quota_violations_violation_type ON quota_violations(violation_type);
CREATE INDEX idx_quota_violations_resolved ON quota_violations(resolved);

-- =====================================================
-- 4. MATERIALIZED VIEW FOR DASHBOARD PERFORMANCE
-- =====================================================

-- Daily usage summaries for fast dashboard loading
CREATE MATERIALIZED VIEW daily_usage_summaries AS
SELECT 
    us.user_id,
    us.room_id,
    DATE(us.started_at) as usage_date,
    
    -- Basic metrics
    COUNT(*) as session_count,
    SUM(COALESCE(us.duration_minutes, 0)) as total_duration_minutes,
    AVG(COALESCE(us.duration_minutes, 0)) as avg_duration_minutes,
    
    -- Energy and cost metrics
    SUM(COALESCE(us.energy_consumed, 0)) as total_energy_kwh,
    SUM(COALESCE(us.estimated_cost, 0)) as total_estimated_cost,
    
    -- AC usage patterns
    MODE() WITHIN GROUP (ORDER BY us.mode) as most_used_mode,
    AVG(us.temperature_set) as avg_temperature_set,
    
    -- Time patterns
    MIN(us.started_at) as first_session_start,
    MAX(COALESCE(us.ended_at, us.started_at)) as last_session_end,
    
    -- Quota compliance
    COUNT(CASE WHEN us.override_by IS NOT NULL THEN 1 END) as override_count,
    
    -- Metadata
    COUNT(CASE WHEN us.status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN us.status = 'interrupted' THEN 1 END) as interrupted_sessions
    
FROM usage_sessions us
WHERE us.started_at >= CURRENT_DATE - INTERVAL '90 days' -- Keep 90 days of data
GROUP BY us.user_id, us.room_id, DATE(us.started_at);

-- Index for materialized view
CREATE INDEX idx_daily_usage_summaries_user_room_date 
    ON daily_usage_summaries(user_id, room_id, usage_date);
CREATE INDEX idx_daily_usage_summaries_date 
    ON daily_usage_summaries(usage_date);

-- =====================================================
-- 5. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to calculate session duration when session ends
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate duration when session is being ended
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate duration
CREATE TRIGGER trigger_calculate_session_duration
    BEFORE UPDATE ON usage_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_session_duration();

-- Function to refresh materialized view (called by scheduled job)
CREATE OR REPLACE FUNCTION refresh_daily_usage_summaries()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_usage_summaries;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER trigger_households_updated_at
    BEFORE UPDATE ON households
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_room_assignments_updated_at
    BEFORE UPDATE ON user_room_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_quotas_updated_at
    BEFORE UPDATE ON quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. DATA SECURITY
-- =====================================================

-- Row Level Security for multi-tenancy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_violations ENABLE ROW LEVEL SECURITY;

-- Policies will be created by application when user context is available
-- These are placeholder comments for future security implementation:
-- CREATE POLICY users_household_isolation ON users USING (household_id = current_setting('app.current_household_id')::uuid);
-- CREATE POLICY quotas_household_isolation ON quotas USING (user_id IN (SELECT id FROM users WHERE household_id = current_setting('app.current_household_id')::uuid));

-- =====================================================
-- 7. INITIAL DATA AND CONSTRAINTS
-- =====================================================

-- Create system default household for initial setup
INSERT INTO households (id, name, subscription_plan, timezone, settings) 
VALUES (
    uuid_generate_v4(),
    'Default Household',
    'basic',
    'UTC',
    '{"features": ["quota_management"], "version": "1.0"}'::jsonb
);

-- =====================================================
-- 8. COMMENTS AND DOCUMENTATION
-- =====================================================

-- Table comments
COMMENT ON TABLE households IS 'Multi-tenant household organization structure with subscription plans';
COMMENT ON TABLE users IS 'User accounts with role-based access and household association';
COMMENT ON TABLE user_room_assignments IS 'Many-to-many relationship defining user access to specific rooms';
COMMENT ON TABLE quotas IS 'Flexible quota configuration system supporting time, usage, energy, and cost-based limits';
COMMENT ON TABLE usage_sessions IS 'Detailed tracking of AC usage sessions with environmental context';
COMMENT ON TABLE quota_violations IS 'Audit trail of quota violations with enforcement actions and overrides';
COMMENT ON MATERIALIZED VIEW daily_usage_summaries IS 'Pre-aggregated daily usage metrics for dashboard performance';

-- Important column comments
COMMENT ON COLUMN quotas.allowed_amount IS 'Quota limit amount - hours for time_based, count for usage_count, kWh for energy_based, USD for cost_based';
COMMENT ON COLUMN quotas.warning_thresholds IS 'Percentage thresholds for quota warnings (e.g., [75, 90] for 75% and 90% warnings)';
COMMENT ON COLUMN usage_sessions.initial_settings IS 'JSONB snapshot of AC settings when session started';
COMMENT ON COLUMN usage_sessions.final_settings IS 'JSONB snapshot of AC settings when session ended';
COMMENT ON COLUMN quota_violations.violation_amount IS 'Amount by which quota was exceeded';

-- =====================================================
-- Migration Complete
-- =====================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'V001__Create_quota_tables migration completed successfully';
    RAISE NOTICE 'Created tables: households, users, user_room_assignments, quotas, usage_sessions, quota_violations';
    RAISE NOTICE 'Created materialized view: daily_usage_summaries';
    RAISE NOTICE 'Created % indexes for performance optimization', (
        SELECT COUNT(*) FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('households', 'users', 'user_room_assignments', 'quotas', 'usage_sessions', 'quota_violations', 'daily_usage_summaries')
    );
END $$;