-- =====================================================
-- SUPABASE MIGRATION: Complete Schema Setup
-- Project: re-bot-db (kirudrpypiawrbhdjjzj)
-- Real Estate WhatsApp Bot - Production Ready
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- 1. UPDATE EXISTING AGENTS TABLE
-- =====================================================
-- Add missing columns to agents table if they don't exist
DO $$ 
BEGIN
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
        ALTER TABLE agents ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy'));
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
-- 2. UPDATE EXISTING LEADS TABLE
-- =====================================================
DO $$ 
BEGIN
    -- Lead qualification columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'intent') THEN
        ALTER TABLE leads ADD COLUMN intent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'budget') THEN
        ALTER TABLE leads ADD COLUMN budget VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'location_preference') THEN
        ALTER TABLE leads ADD COLUMN location_preference TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'property_type') THEN
        ALTER TABLE leads ADD COLUMN property_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'timeline') THEN
        ALTER TABLE leads ADD COLUMN timeline VARCHAR(100);
    END IF;
    
    -- Lead management columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status') THEN
        ALTER TABLE leads ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'booked', 'needs_human_handoff', 'converted', 'lost'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'source') THEN
        ALTER TABLE leads ADD COLUMN source VARCHAR(100) NOT NULL DEFAULT 'WA Direct';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_agent_id') THEN
        ALTER TABLE leads ADD COLUMN assigned_agent_id UUID REFERENCES agents(id);
    END IF;
    
    -- AI conversation memory
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'conversation_summary') THEN
        ALTER TABLE leads ADD COLUMN conversation_summary TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_interaction_at') THEN
        ALTER TABLE leads ADD COLUMN last_interaction_at TIMESTAMPTZ;
    END IF;
    
    -- Lead scoring
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_score') THEN
        ALTER TABLE leads ADD COLUMN lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'notes') THEN
        ALTER TABLE leads ADD COLUMN notes TEXT;
    END IF;
    
    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'updated_at') THEN
        ALTER TABLE leads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- 3. UPDATE EXISTING MESSAGES TABLE
-- =====================================================
DO $$ 
BEGIN
    -- Message metadata columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media', 'location'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'whatsapp_message_id') THEN
        ALTER TABLE messages ADD COLUMN whatsapp_message_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'template_id') THEN
        ALTER TABLE messages ADD COLUMN template_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'template_name') THEN
        ALTER TABLE messages ADD COLUMN template_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
        ALTER TABLE messages ADD COLUMN status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed'));
    END IF;
END $$;

-- =====================================================
-- 4. CREATE APPOINTMENTS TABLE
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
-- 5. CREATE TEMPLATE USAGE LOG TABLE (WABA COMPLIANCE)
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
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_google_email ON agents(google_email);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent_id ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_interaction_at ON leads(last_interaction_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id ON messages(whatsapp_message_id);

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
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. CREATE RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access" ON agents;
DROP POLICY IF EXISTS "Service role full access" ON leads;
DROP POLICY IF EXISTS "Service role full access" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON appointments;
DROP POLICY IF EXISTS "Service role full access" ON template_usage_log;

-- Service role can do everything (your backend)
CREATE POLICY "Service role full access" ON agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON appointments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON template_usage_log FOR ALL USING (auth.role() = 'service_role');

-- Agents can view their own data
CREATE POLICY "Agents can view own data" ON agents FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Agents can update own data" ON agents FOR UPDATE USING (auth.uid() = id);

-- Agents can view their assigned leads
CREATE POLICY "Agents can view assigned leads" ON leads FOR SELECT USING (assigned_agent_id = auth.uid());
CREATE POLICY "Agents can update assigned leads" ON leads FOR UPDATE USING (assigned_agent_id = auth.uid());

-- Agents can view messages for their leads
CREATE POLICY "Agents can view lead messages" ON messages FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE assigned_agent_id = auth.uid())
);

-- Agents can view their appointments
CREATE POLICY "Agents can view own appointments" ON appointments FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agents can update own appointments" ON appointments FOR UPDATE USING (agent_id = auth.uid());

-- =====================================================
-- 9. CREATE UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. CREATE USEFUL VIEWS
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

-- Lead conversation summary
CREATE OR REPLACE VIEW lead_conversation_summary AS
SELECT
    l.id as lead_id,
    l.full_name,
    l.phone_number,
    l.status,
    l.intent,
    l.budget,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    COUNT(CASE WHEN m.sender = 'lead' THEN 1 END) as lead_messages,
    COUNT(CASE WHEN m.sender = 'assistant' THEN 1 END) as bot_messages,
    COUNT(CASE WHEN m.sender = 'agent' THEN 1 END) as agent_messages
FROM leads l
LEFT JOIN messages m ON l.id = m.lead_id
GROUP BY l.id, l.full_name, l.phone_number, l.status, l.intent, l.budget;

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
GRANT SELECT ON lead_conversation_summary TO service_role;
GRANT SELECT ON template_usage_analytics TO service_role;

-- =====================================================
-- 11. INSERT DEFAULT AGENT (IF NOT EXISTS)
-- =====================================================
INSERT INTO agents (full_name, email, status)
SELECT 'Doro Smart Guide', 'doro@realestate.com', 'active'
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'doro@realestate.com');

-- =====================================================
-- 12. ADD HELPFUL COMMENTS
-- =====================================================
COMMENT ON TABLE agents IS 'Real estate agents with Google Calendar and Zoom integration';
COMMENT ON TABLE leads IS 'WhatsApp leads with qualification data and conversation memory';
COMMENT ON TABLE messages IS 'All WhatsApp messages between leads, bot, and agents';
COMMENT ON TABLE appointments IS 'Consultation appointments with Zoom and calendar integration';
COMMENT ON TABLE template_usage_log IS 'WABA compliance tracking for template message usage';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
SELECT 'Migration completed successfully! Database schema updated for production.' as status;
