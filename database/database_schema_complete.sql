-- ============================================================================
-- COMPLETE DATABASE SCHEMA FOR REAL ESTATE WHATSAPP BOT
-- Organized by relevance and usage frequency
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. LEADS TABLE (Most Critical - Used in Every Conversation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    -- PRIMARY IDENTIFIERS (Used in every query)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    
    -- CORE LEAD INFO (Accessed frequently)
    full_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN (
        'new', 'qualified', 'booked', 'booking_alternatives_offered', 
        'tentative_booking_offered', 'appointment_cancelled', 
        'needs_human_handoff', 'converted', 'lost'
    )),
    assigned_agent_id UUID REFERENCES agents(id),
    
    -- CONVERSATION CONTEXT (Used by AI system)
    intent VARCHAR(100),
    budget VARCHAR(255),
    location_preference VARCHAR(255),
    property_type VARCHAR(100),
    timeline VARCHAR(100),
    
    -- BOOKING MANAGEMENT (Critical for appointment system)
    booking_alternatives JSONB,
    tentative_booking_time TIMESTAMP WITH TIME ZONE,
    
    -- METADATA (Used for tracking and analytics)
    source VARCHAR(100) DEFAULT 'WA Direct',
    additional_sources JSONB DEFAULT '[]'::jsonb,
    additional_notes TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. MESSAGES TABLE (High Usage - Every Conversation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- MESSAGE CONTENT (Core functionality)
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('lead', 'assistant')),
    message TEXT NOT NULL,
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. AGENTS TABLE (Medium Usage - Referenced for Appointments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- AGENT STATUS (Frequently checked)
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
    
    -- GOOGLE CALENDAR INTEGRATION (Critical for booking)
    google_email VARCHAR(255),
    google_refresh_token_encrypted TEXT,
    google_token_status VARCHAR(50) DEFAULT 'active',
    google_token_last_error TEXT,
    google_token_error_at TIMESTAMP WITH TIME ZONE,
    
    -- ZOOM INTEGRATION (Critical for meetings)
    zoom_user_id VARCHAR(255),
    zoom_email VARCHAR(255),
    zoom_access_token_encrypted TEXT,
    zoom_access_token_iv VARCHAR(255),
    zoom_access_token_tag VARCHAR(255),
    zoom_refresh_token_encrypted TEXT,
    zoom_refresh_token_iv VARCHAR(255),
    zoom_refresh_token_tag VARCHAR(255),
    zoom_connected_at TIMESTAMP WITH TIME ZONE,
    
    -- WORKING CONFIGURATION (Used by booking system)
    working_hours JSONB DEFAULT '{"start": 8, "end": 23, "days": [0,1,2,3,4,5,6]}',
    timezone VARCHAR(100) DEFAULT 'Asia/Singapore',
    
    -- OPTIONAL FIELDS (Less frequently used)
    phone_number VARCHAR(20),
    zoom_personal_meeting_id VARCHAR(255),
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. APPOINTMENTS TABLE (Medium Usage - Booking System)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    
    -- APPOINTMENT DETAILS (Core functionality)
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'completed', 'cancelled', 'rescheduled'
    )),
    
    -- ZOOM MEETING INFO (Critical for virtual meetings)
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_password VARCHAR(50),
    
    -- GOOGLE CALENDAR INFO (Integration tracking)
    calendar_event_id VARCHAR(255),
    
    -- CONSULTATION CONTEXT (Used by agents)
    consultation_notes TEXT,
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. TEMPLATE_USAGE_LOG TABLE (Low Usage - Compliance Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- TEMPLATE IDENTIFICATION
    template_id VARCHAR(255),
    template_name VARCHAR(255) NOT NULL,
    template_category VARCHAR(100),

    -- USAGE CONTEXT
    phone_number VARCHAR(20) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    agent_id UUID REFERENCES agents(id),

    -- TEMPLATE DATA
    template_params JSONB,
    message_id VARCHAR(255),

    -- STATUS TRACKING
    status VARCHAR(50) DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE,

    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. CONVERSATION_INSIGHTS TABLE (Low Usage - AI Analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- AI INSIGHTS DATA
    insights JSONB NOT NULL,

    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. CONVERSATION_MEMORY TABLE (Low Usage - AI Context)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,

    -- MEMORY DATA
    memory_data JSONB NOT NULL,

    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE INDEXES (Organized by Usage Priority)
-- ============================================================================

-- HIGH PRIORITY INDEXES (Used in every request)
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- MEDIUM PRIORITY INDEXES (Used frequently)
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);

-- LOW PRIORITY INDEXES (Used occasionally)
CREATE INDEX IF NOT EXISTS idx_template_usage_phone ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_usage_lead ON template_usage_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_lead ON conversation_insights(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_lead ON conversation_memory(lead_id);

-- ============================================================================
-- AUTO-UPDATE TRIGGERS (For updated_at columns)
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_memory_updated_at ON conversation_memory;
CREATE TRIGGER update_conversation_memory_updated_at BEFORE UPDATE ON conversation_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PERMISSIONS (Basic setup - adjust as needed)
-- ============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
