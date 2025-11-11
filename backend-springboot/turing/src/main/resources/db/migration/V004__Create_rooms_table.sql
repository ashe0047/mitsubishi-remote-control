-- V004__Create_rooms_table.sql
-- Create rooms table for dynamic room management

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    -- Room Data
    name VARCHAR(100) NOT NULL,
    room_identifier VARCHAR(100) NOT NULL,  -- Business key (slug) for assignments
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

-- Insert default rooms for all existing households
-- These match the hardcoded rooms in RoomController.java
INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Living Room', 'living-room', 'Ground Floor'
FROM households h
ON CONFLICT DO NOTHING;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Master Bedroom', 'master-bedroom', 'First Floor'
FROM households h
ON CONFLICT DO NOTHING;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Guest Bedroom', 'guest-bedroom', 'First Floor'
FROM households h
ON CONFLICT DO NOTHING;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Kitchen', 'kitchen', 'Ground Floor'
FROM households h
ON CONFLICT DO NOTHING;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Home Office', 'home-office', 'First Floor'
FROM households h
ON CONFLICT DO NOTHING;

INSERT INTO rooms (household_id, name, room_identifier, location)
SELECT h.id, 'Basement', 'basement', 'Lower Level'
FROM households h
ON CONFLICT DO NOTHING;

-- Create function for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_rooms_updated_at();
