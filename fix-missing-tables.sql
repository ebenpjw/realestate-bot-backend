-- Fix missing tables: appointments and template_usage_log
-- Run this in your Supabase SQL Editor

-- =====================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add email column to leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email') THEN
        ALTER TABLE leads ADD COLUMN email VARCHAR(255);
    END IF;
END $$;

-- Add missing columns to agents table if they don't exist
DO $$
BEGIN
    -- Basic agent info columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'full_name') THEN
        ALTER TABLE agents ADD COLUMN full_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'email') THEN
        ALTER TABLE agents ADD COLUMN email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'phone_number') THEN
        ALTER TABLE agents ADD COLUMN phone_number VARCHAR(20);
    END IF;

    -- Google Calendar integration columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_email') THEN
        ALTER TABLE agents ADD COLUMN google_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_refresh_token_encrypted') THEN
        ALTER TABLE agents ADD COLUMN google_refresh_token_encrypted TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_token_iv') THEN
        ALTER TABLE agents ADD COLUMN google_token_iv VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_token_tag') THEN
        ALTER TABLE agents ADD COLUMN google_token_tag VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_connected_at') THEN
        ALTER TABLE agents ADD COLUMN google_connected_at TIMESTAMPTZ;
    END IF;

    -- Zoom integration columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_email') THEN
        ALTER TABLE agents ADD COLUMN zoom_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_refresh_token_encrypted') THEN
        ALTER TABLE agents ADD COLUMN zoom_refresh_token_encrypted TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_token_iv') THEN
        ALTER TABLE agents ADD COLUMN zoom_token_iv VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_token_tag') THEN
        ALTER TABLE agents ADD COLUMN zoom_token_tag VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_connected_at') THEN
        ALTER TABLE agents ADD COLUMN zoom_connected_at TIMESTAMPTZ;
    END IF;

    -- Agent settings columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status') THEN
        ALTER TABLE agents ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'timezone') THEN
        ALTER TABLE agents ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Singapore';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'working_hours') THEN
        ALTER TABLE agents ADD COLUMN working_hours JSONB DEFAULT '{"start": 9, "end": 18, "days": [1,2,3,4,5]}';
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'updated_at') THEN
        ALTER TABLE agents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- CREATE APPOINTMENTS TABLE
-- =====================================================
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
        'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'
    )),
    
    -- Rescheduling and cancellation
    reschedule_reason TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CREATE TEMPLATE USAGE LOG TABLE (WABA COMPLIANCE)
-- =====================================================
CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Template details
    phone_number VARCHAR(20) NOT NULL,
    template_id VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_category VARCHAR(50) NOT NULL CHECK (template_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    template_params JSONB,
    
    -- Message tracking
    message_id VARCHAR(255),
    whatsapp_message_id VARCHAR(255),
    
    -- Compliance tracking
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_status VARCHAR(50) DEFAULT 'sent',
    
    -- Rate limiting data
    daily_count INTEGER DEFAULT 1,
    monthly_count INTEGER DEFAULT 1
);

-- =====================================================
-- ADD CONSTRAINTS TO AGENTS TABLE
-- =====================================================

-- Add status constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'agents_status_check') THEN
        ALTER TABLE agents ADD CONSTRAINT agents_status_check CHECK (status IN ('active', 'inactive', 'busy'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might already exist, continue
        NULL;
END $$;

-- =====================================================
-- CREATE INDEXES
-- =====================================================

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_zoom_meeting_id ON appointments(zoom_meeting_id);

-- Template usage indexes (for compliance and rate limiting)
CREATE INDEX IF NOT EXISTS idx_template_usage_phone_number ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage_log(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_sent_at ON template_usage_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_template_usage_daily_count ON template_usage_log(phone_number, sent_at);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Service role can do everything (your backend)
CREATE POLICY "Service role full access" ON appointments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON template_usage_log FOR ALL USING (auth.role() = 'service_role');

-- Agents can view their appointments
CREATE POLICY "Agents can view own appointments" ON appointments FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agents can update own appointments" ON appointments FOR UPDATE USING (agent_id = auth.uid());

-- =====================================================
-- CREATE TRIGGER FUNCTION (IF NOT EXISTS)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE VIEWS
-- =====================================================

-- Appointment details with lead and agent info
CREATE OR REPLACE VIEW appointment_details AS
SELECT 
    a.*,
    l.full_name as lead_name,
    l.phone_number as lead_phone,
    l.email as lead_email,
    l.intent as lead_intent,
    l.budget as lead_budget,
    ag.full_name as agent_name,
    ag.google_email as agent_google_email,
    ag.zoom_email as agent_zoom_email
FROM appointments a
JOIN leads l ON a.lead_id = l.id
JOIN agents ag ON a.agent_id = ag.id;

-- Template usage analytics
CREATE OR REPLACE VIEW template_usage_analytics AS
SELECT 
    template_name,
    template_category,
    COUNT(*) as usage_count,
    COUNT(DISTINCT phone_number) as unique_recipients,
    DATE_TRUNC('day', sent_at) as usage_date
FROM template_usage_log
GROUP BY template_name, template_category, DATE_TRUNC('day', sent_at)
ORDER BY usage_date DESC, usage_count DESC;

-- Grant access to views
GRANT SELECT ON appointment_details TO service_role;
GRANT SELECT ON template_usage_analytics TO service_role;

-- =====================================================
-- INSERT DEFAULT AGENT (IF NOT EXISTS)
-- =====================================================
INSERT INTO agents (full_name, email, status) 
SELECT 'Doro Smart Guide', 'doro@realestate.com', 'active'
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'doro@realestate.com');

-- =====================================================
-- ADD HELPFUL COMMENTS
-- =====================================================
COMMENT ON TABLE appointments IS 'Consultation appointments with Zoom and calendar integration';
COMMENT ON TABLE template_usage_log IS 'WABA compliance tracking for template message usage';

-- Success message
SELECT 'Missing tables created successfully! Database is now complete.' as status;
