-- Create appointments table for managing consultation bookings
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Appointment timing
    appointment_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Zoom meeting details
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_password VARCHAR(50),
    
    -- Google Calendar integration
    calendar_event_id VARCHAR(255),
    
    -- Consultation details
    consultation_notes TEXT,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 
        'confirmed', 
        'in_progress', 
        'completed', 
        'cancelled', 
        'no_show',
        'rescheduled'
    )),
    
    -- Rescheduling and cancellation
    reschedule_reason TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_zoom_meeting_id ON appointments(zoom_meeting_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role (your backend)
CREATE POLICY "Allow all for service role" ON appointments
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow agents to see their own appointments
CREATE POLICY "Agents can view their appointments" ON appointments
    FOR SELECT USING (agent_id = auth.uid());

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointments_updated_at 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add columns to agents table for Zoom integration
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoom_email VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoom_refresh_token_encrypted TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoom_token_iv VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoom_token_tag VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoom_connected_at TIMESTAMPTZ;

-- Create a view for appointment details with lead and agent info
CREATE OR REPLACE VIEW appointment_details AS
SELECT 
    a.*,
    l.full_name as lead_name,
    l.phone_number as lead_phone,
    l.email as lead_email,
    ag.google_email as agent_google_email,
    ag.zoom_email as agent_zoom_email
FROM appointments a
JOIN leads l ON a.lead_id = l.id
JOIN agents ag ON a.agent_id = ag.id;

-- Grant access to the view
GRANT SELECT ON appointment_details TO service_role;

COMMENT ON TABLE appointments IS 'Stores consultation appointment bookings with Zoom and calendar integration';
COMMENT ON COLUMN appointments.status IS 'Appointment status: scheduled, confirmed, in_progress, completed, cancelled, no_show, rescheduled';
COMMENT ON COLUMN appointments.zoom_meeting_id IS 'Zoom meeting ID for the consultation';
COMMENT ON COLUMN appointments.calendar_event_id IS 'Google Calendar event ID';
COMMENT ON COLUMN appointments.consultation_notes IS 'Notes about what to discuss in the consultation';
