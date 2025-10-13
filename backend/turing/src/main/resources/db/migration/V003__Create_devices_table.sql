-- V003__Create_devices_table.sql
-- Device-Room Integration: Protocol-agnostic device registry

-- Create devices table
-- Note: room_id does not have FK constraint since rooms table may not exist yet
-- FK constraint can be added in a future migration when rooms table is created
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    device_identifier VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT devices_identifier_format CHECK (device_identifier ~ '^[a-z0-9_-]+$'),
    CONSTRAINT devices_unique_room_type_identifier UNIQUE(room_id, device_type, device_identifier)
);

-- Indexes for performance
CREATE INDEX idx_devices_room_id ON devices(room_id);
CREATE INDEX idx_devices_device_type ON devices(device_type);
CREATE INDEX idx_devices_device_identifier ON devices(device_identifier);
CREATE INDEX idx_devices_enabled ON devices(enabled);
CREATE INDEX idx_devices_metadata_gin ON devices USING gin(metadata);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER devices_updated_at_trigger
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_devices_updated_at();

-- Comments for documentation
COMMENT ON TABLE devices IS 'Protocol-agnostic device registry for room-based device management';
COMMENT ON COLUMN devices.id IS 'Unique device identifier (UUID)';
COMMENT ON COLUMN devices.room_id IS 'Reference to the room this device belongs to';
COMMENT ON COLUMN devices.device_type IS 'Type of device (airconditioner, thermostat, humidifier, fan)';
COMMENT ON COLUMN devices.device_identifier IS 'Protocol-agnostic identifier (e.g., ac_bedroom_main)';
COMMENT ON COLUMN devices.manufacturer IS 'Device manufacturer (optional)';
COMMENT ON COLUMN devices.model IS 'Device model (optional)';
COMMENT ON COLUMN devices.enabled IS 'Whether device is enabled for control';
COMMENT ON COLUMN devices.metadata IS 'Flexible JSONB storage for protocol-specific configuration and custom attributes';
COMMENT ON COLUMN devices.created_at IS 'Timestamp when device was registered';
COMMENT ON COLUMN devices.updated_at IS 'Timestamp of last update (auto-updated by trigger)';
