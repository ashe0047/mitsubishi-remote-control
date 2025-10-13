-- =====================================================
-- Mitsubishi Remote Control: Family Invitations Table
-- Version: V002
-- Description: Create family_invitations table for managing family member invitations
-- =====================================================

-- Create enum for invitation status
CREATE TYPE invitation_status AS ENUM (
    'pending',      -- Invitation sent, waiting for response
    'accepted',     -- Invitation accepted by recipient
    'declined',     -- Invitation declined by recipient
    'expired',      -- Invitation expired
    'cancelled'     -- Invitation cancelled by sender
);

-- Create family_invitations table
CREATE TABLE family_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core invitation data
    household_id UUID NOT NULL,
    invited_by_user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'child',
    
    -- Invitation token and status
    token VARCHAR(255) UNIQUE NOT NULL,
    status invitation_status NOT NULL DEFAULT 'pending',
    message TEXT,
    
    -- Timing fields
    sent_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    
    -- When accepted, the created user ID
    accepted_user_id UUID,
    
    -- Resend tracking
    resend_count INTEGER NOT NULL DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_family_invitations_household 
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    CONSTRAINT fk_family_invitations_invited_by_user 
        FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_family_invitations_accepted_user 
        FOREIGN KEY (accepted_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Data validation constraints
    CONSTRAINT family_invitations_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT family_invitations_token_not_empty 
        CHECK (char_length(token) > 0),
    CONSTRAINT family_invitations_valid_dates 
        CHECK (expires_at > created_at),
    CONSTRAINT family_invitations_accepted_logic 
        CHECK (
            (status = 'accepted' AND accepted_at IS NOT NULL) OR 
            (status != 'accepted' AND accepted_at IS NULL)
        ),
    CONSTRAINT family_invitations_declined_logic 
        CHECK (
            (status = 'declined' AND declined_at IS NOT NULL) OR 
            (status != 'declined' AND declined_at IS NULL)
        ),
    CONSTRAINT family_invitations_resend_count_positive 
        CHECK (resend_count >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_family_invitations_household_id ON family_invitations(household_id);
CREATE INDEX idx_family_invitations_email ON family_invitations(email);
CREATE INDEX idx_family_invitations_token ON family_invitations(token);
CREATE INDEX idx_family_invitations_status ON family_invitations(status);
CREATE INDEX idx_family_invitations_invited_by ON family_invitations(invited_by_user_id);
CREATE INDEX idx_family_invitations_expires_at ON family_invitations(expires_at);

-- Unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX idx_unique_pending_invitation_per_household_email 
    ON family_invitations (household_id, email) 
    WHERE status = 'pending';

-- Apply updated_at trigger
CREATE TRIGGER trigger_family_invitations_updated_at
    BEFORE UPDATE ON family_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE family_invitations IS 'Family member invitations with lifecycle management';
COMMENT ON COLUMN family_invitations.token IS 'Unique token for invitation validation and acceptance';
COMMENT ON COLUMN family_invitations.expires_at IS 'When the invitation expires';
COMMENT ON COLUMN family_invitations.resend_count IS 'Number of times invitation has been resent';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'V002__Create_family_invitations_table migration completed successfully';
    RAISE NOTICE 'Created table: family_invitations with invitation_status enum';
END $$;