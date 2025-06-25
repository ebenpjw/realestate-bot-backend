-- =====================================================
-- COMPLETE DATABASE RESET AND SCHEMA CREATION
-- Real Estate WhatsApp Bot - Supabase Database
-- =====================================================
-- Run this in your Supabase SQL Editor to reset and create all tables

-- =====================================================
-- 1. DROP ALL EXISTING TABLES (RESET)
-- =====================================================
DROP TABLE IF EXISTS template_usage_log CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- 2. CREATE AGENTS TABLE
-- =====================================================
CREATE TABLE agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic agent info
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    
    -- Google Calendar integration
    google_email VARCHAR(255),
    google_refresh_token_encrypted TEXT,
    google_token_iv VARCHAR(255),
    google_token_tag VARCHAR(255),
    google_connected_at TIMESTAMPTZ,
    
    -- Zoom integration
    zoom_email VARCHAR(255),
    zoom_refresh_token_encrypted TEXT,
    zoom_token_iv VARCHAR(255),
    zoom_token_tag VARCHAR(255),
    zoom_connected_at TIMESTAMPTZ,
    
    -- Agent status and settings
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
    timezone VARCHAR(50) DEFAULT 'Asia/Singapore',
    working_hours JSONB DEFAULT '{"start": 9, "end": 18, "days": [1,2,3,4,5]}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. CREATE LEADS TABLE
-- =====================================================
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Contact information
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    
    -- Lead qualification data
    intent TEXT, -- What they're looking for
    budget VARCHAR(100), -- Budget range
    location_preference TEXT, -- Preferred locations
    property_type VARCHAR(100), -- Condo, HDB, Landed, etc.
    timeline VARCHAR(100), -- When they want to buy/sell
    
    -- Lead management
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'qualified', 'booked', 'needs_human_handoff', 'converted', 'lost'
    )),
    source VARCHAR(100) NOT NULL DEFAULT 'WA Direct',
    assigned_agent_id UUID REFERENCES agents(id),
    
    -- AI conversation memory
    conversation_summary TEXT,
    last_interaction_at TIMESTAMPTZ,
    
    -- Lead scoring and notes
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE MESSAGES TABLE
-- =====================================================
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Message content
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('lead', 'assistant', 'agent')),
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media', 'location')),
    
    -- WhatsApp metadata
    whatsapp_message_id VARCHAR(255),
    template_id VARCHAR(255), -- If this was a template message
    template_name VARCHAR(255),
    
    -- Message status
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. CREATE APPOINTMENTS TABLE
-- =====================================================
CREATE TABLE appointments (
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
-- 6. CREATE TEMPLATE USAGE LOG TABLE (WABA COMPLIANCE)
-- =====================================================
CREATE TABLE template_usage_log (
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
-- 7. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Agents indexes
CREATE INDEX idx_agents_email ON agents(email);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_google_email ON agents(google_email);

-- Leads indexes
CREATE INDEX idx_leads_phone_number ON leads(phone_number);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_assigned_agent_id ON leads(assigned_agent_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_last_interaction_at ON leads(last_interaction_at);

-- Messages indexes
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_whatsapp_message_id ON messages(whatsapp_message_id);

-- Appointments indexes
CREATE INDEX idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX idx_appointments_appointment_time ON appointments(appointment_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_zoom_meeting_id ON appointments(zoom_meeting_id);

-- Template usage indexes (for compliance and rate limiting)
CREATE INDEX idx_template_usage_phone_number ON template_usage_log(phone_number);
CREATE INDEX idx_template_usage_template_id ON template_usage_log(template_id);
CREATE INDEX idx_template_usage_sent_at ON template_usage_log(sent_at);
CREATE INDEX idx_template_usage_daily_count ON template_usage_log(phone_number, sent_at);

-- =====================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. CREATE RLS POLICIES
-- =====================================================

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
-- 10. CREATE UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. CREATE USEFUL VIEWS
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
-- 12. INSERT SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert a default agent
INSERT INTO agents (full_name, email, status) VALUES 
('Doro Smart Guide', 'doro@realestate.com', 'active');

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================

-- Add helpful comments
COMMENT ON TABLE agents IS 'Real estate agents with Google Calendar and Zoom integration';
COMMENT ON TABLE leads IS 'WhatsApp leads with qualification data and conversation memory';
COMMENT ON TABLE messages IS 'All WhatsApp messages between leads, bot, and agents';
COMMENT ON TABLE appointments IS 'Consultation appointments with Zoom and calendar integration';
COMMENT ON TABLE template_usage_log IS 'WABA compliance tracking for template message usage';

-- Success message
SELECT 'Database schema created successfully! All tables, indexes, RLS policies, and views are ready.' as status;
