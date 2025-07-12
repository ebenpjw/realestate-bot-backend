-- ============================================================================
-- MULTI-TENANT REAL ESTATE BOT DATABASE SCHEMA
-- Comprehensive multi-agent WABA architecture with lead deduplication
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE MULTI-TENANT TABLES
-- ============================================================================

-- 1.1 ORGANIZATIONS TABLE - Top-level tenant isolation
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly identifier
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Billing & Subscription
    subscription_tier VARCHAR(50) DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    billing_email VARCHAR(255),
    
    -- Configuration
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 AGENTS TABLE - Enhanced with organization isolation and WABA config
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Agent Identity
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
    
    -- WABA Configuration (NEW - Multi-tenant WABA support)
    waba_phone_number VARCHAR(20) UNIQUE, -- Each agent has unique WABA number
    waba_display_name VARCHAR(100), -- Custom sender name for this agent
    gupshup_api_key_encrypted TEXT, -- Encrypted API key for this agent's WABA
    gupshup_app_id VARCHAR(100), -- Gupshup app ID for this agent
    
    -- Bot Customization (NEW - Agent-specific bot personality)
    bot_name VARCHAR(100) DEFAULT 'Doro', -- Customizable bot name
    bot_personality_config JSONB DEFAULT '{}'::jsonb, -- Agent-specific personality tweaks
    custom_responses JSONB DEFAULT '{}'::jsonb, -- Agent-specific response templates
    
    -- OAuth Integration (Existing)
    google_email VARCHAR(255),
    google_refresh_token_encrypted TEXT,
    zoom_user_id VARCHAR(255),
    zoom_personal_meeting_id VARCHAR(255),
    
    -- Working Configuration
    working_hours JSONB DEFAULT '{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}'::jsonb,
    timezone VARCHAR(100) DEFAULT 'Asia/Singapore',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(organization_id, email), -- Email unique within organization
    UNIQUE(waba_phone_number) -- WABA numbers globally unique
);

-- 1.3 WABA_TEMPLATES TABLE - Agent-specific template management
CREATE TABLE IF NOT EXISTS waba_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Template Identity
    template_id VARCHAR(255) NOT NULL, -- Gupshup template ID
    template_name VARCHAR(255) NOT NULL, -- Template name in Gupshup
    template_category VARCHAR(50) NOT NULL CHECK (template_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    
    -- Template Configuration
    template_content TEXT, -- Template text with placeholders
    parameters JSONB DEFAULT '[]'::jsonb, -- Parameter definitions
    language_code VARCHAR(10) DEFAULT 'en',
    
    -- Status & Compliance
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'disabled')),
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, template_name) -- Template names unique per agent
);

-- ============================================================================
-- 2. ENHANCED LEAD MANAGEMENT WITH DEDUPLICATION
-- ============================================================================

-- 2.1 GLOBAL_LEADS TABLE - Master lead registry for deduplication
CREATE TABLE IF NOT EXISTS global_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL UNIQUE, -- Global unique phone number
    
    -- Lead Identity (Consolidated from all conversations)
    full_name VARCHAR(255),
    email VARCHAR(255),
    
    -- Lead Intelligence (Aggregated across all agents)
    lead_profile JSONB DEFAULT '{}'::jsonb, -- Consolidated lead intelligence
    interaction_history JSONB DEFAULT '[]'::jsonb, -- Cross-agent interaction summary
    
    -- Attribution & Source Tracking
    first_contact_source VARCHAR(100),
    first_contact_agent_id UUID REFERENCES agents(id),
    first_contact_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status Tracking
    global_status VARCHAR(50) DEFAULT 'active' CHECK (global_status IN ('active', 'converted', 'blocked', 'duplicate')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 AGENT_LEAD_CONVERSATIONS TABLE - Individual agent-lead conversation threads
CREATE TABLE IF NOT EXISTS agent_lead_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    global_lead_id UUID NOT NULL REFERENCES global_leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Conversation Context (Agent-specific)
    conversation_status VARCHAR(50) DEFAULT 'new' CHECK (conversation_status IN (
        'new', 'qualified', 'booked', 'booking_alternatives_offered', 
        'tentative_booking_offered', 'appointment_cancelled', 
        'needs_human_handoff', 'converted', 'lost'
    )),
    
    -- Lead Qualification (Per conversation)
    intent VARCHAR(100),
    budget VARCHAR(255),
    location_preference VARCHAR(255),
    property_type VARCHAR(100),
    timeline VARCHAR(100),
    
    -- Booking Management
    booking_alternatives JSONB,
    tentative_booking_time TIMESTAMP WITH TIME ZONE,
    
    -- Conversation Metadata
    source VARCHAR(100) DEFAULT 'WA Direct', -- How this specific conversation started
    additional_notes TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Performance Tracking
    messages_count INTEGER DEFAULT 0,
    response_time_avg_seconds INTEGER,
    conversion_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(global_lead_id, agent_id) -- One conversation per lead-agent pair
);

-- 2.3 MESSAGES TABLE - Enhanced with conversation isolation
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES agent_lead_conversations(id) ON DELETE CASCADE,
    
    -- Message Content
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('lead', 'bot', 'agent')),
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media', 'interactive')),
    
    -- Template Information (if applicable)
    template_id UUID REFERENCES waba_templates(id),
    template_params JSONB,
    
    -- Delivery Tracking
    message_id VARCHAR(255), -- External message ID from Gupshup
    delivery_status VARCHAR(50) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- AI Processing
    ai_processing_time_ms INTEGER,
    ai_confidence_score DECIMAL(3,2),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. APPOINTMENT SYSTEM WITH MULTI-AGENT SUPPORT
-- ============================================================================

-- 3.1 APPOINTMENTS TABLE - Enhanced with conversation context
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES agent_lead_conversations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    
    -- Appointment Details
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'
    )),
    
    -- Meeting Integration
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_password VARCHAR(50),
    calendar_event_id VARCHAR(255),
    
    -- Consultation Context
    consultation_notes TEXT,
    outcome VARCHAR(100),
    follow_up_required BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. COMPLIANCE & LOGGING TABLES
-- ============================================================================

-- 4.1 TEMPLATE_USAGE_LOG TABLE - Enhanced with agent context
CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    conversation_id UUID REFERENCES agent_lead_conversations(id),
    template_id UUID REFERENCES waba_templates(id),
    
    -- Usage Details
    phone_number VARCHAR(20) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_category VARCHAR(100),
    template_params JSONB,
    
    -- Delivery Tracking
    message_id VARCHAR(255),
    gupshup_response JSONB,
    status VARCHAR(50) DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Compliance
    compliance_check_passed BOOLEAN DEFAULT true,
    compliance_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.2 CONVERSATION_MEMORY TABLE - Enhanced with agent isolation
CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES agent_lead_conversations(id) ON DELETE CASCADE,

    -- AI Memory Context
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('context', 'preferences', 'history', 'insights')),
    memory_data JSONB NOT NULL,

    -- Memory Management
    importance_score DECIMAL(3,2) DEFAULT 0.5, -- 0.00 to 1.00
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================================

-- Organization & Agent Indexes
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_waba_phone ON agents(waba_phone_number) WHERE waba_phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_status_org ON agents(organization_id, status);

-- Lead Management Indexes
CREATE INDEX IF NOT EXISTS idx_global_leads_phone ON global_leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_global_lead ON agent_lead_conversations(global_lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON agent_lead_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON agent_lead_conversations(conversation_status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_interaction ON agent_lead_conversations(last_interaction DESC);

-- Message Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);

-- Template & Compliance Indexes
CREATE INDEX IF NOT EXISTS idx_waba_templates_agent ON waba_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_agent ON template_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_phone ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_usage_sent_at ON template_usage_log(sent_at DESC);

-- Appointment Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_conversation ON appointments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_time ON appointments(agent_id, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- JSONB Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_agents_bot_personality_gin ON agents USING GIN (bot_personality_config);
CREATE INDEX IF NOT EXISTS idx_conversations_booking_gin ON agent_lead_conversations USING GIN (booking_alternatives);
CREATE INDEX IF NOT EXISTS idx_global_leads_profile_gin ON global_leads USING GIN (lead_profile);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_gin ON conversation_memory USING GIN (memory_data);

-- ============================================================================
-- 6. UTILITY VIEWS FOR MULTI-TENANT OPERATIONS
-- ============================================================================

-- 6.1 Active Agent Conversations View
CREATE OR REPLACE VIEW active_agent_conversations AS
SELECT
    alc.*,
    gl.phone_number,
    gl.full_name as lead_name,
    a.full_name as agent_name,
    a.waba_phone_number,
    a.bot_name,
    o.name as organization_name,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = alc.id) as message_count,
    (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = alc.id) as last_message_at
FROM agent_lead_conversations alc
JOIN global_leads gl ON alc.global_lead_id = gl.id
JOIN agents a ON alc.agent_id = a.id
JOIN organizations o ON a.organization_id = o.id
WHERE alc.conversation_status NOT IN ('converted', 'lost')
AND a.status = 'active'
AND o.status = 'active';

-- 6.2 Lead Deduplication View
CREATE OR REPLACE VIEW lead_deduplication_summary AS
SELECT
    gl.phone_number,
    gl.full_name,
    COUNT(alc.id) as conversation_count,
    ARRAY_AGG(DISTINCT a.full_name) as agents_contacted,
    ARRAY_AGG(DISTINCT o.name) as organizations_contacted,
    MIN(alc.created_at) as first_contact,
    MAX(alc.last_interaction) as last_interaction,
    ARRAY_AGG(DISTINCT alc.conversation_status) as statuses
FROM global_leads gl
LEFT JOIN agent_lead_conversations alc ON gl.id = alc.global_lead_id
LEFT JOIN agents a ON alc.agent_id = a.id
LEFT JOIN organizations o ON a.organization_id = o.id
GROUP BY gl.id, gl.phone_number, gl.full_name;

-- 6.3 Agent Performance View
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT
    a.id as agent_id,
    a.full_name as agent_name,
    a.waba_phone_number,
    o.name as organization_name,
    COUNT(alc.id) as total_conversations,
    COUNT(CASE WHEN alc.conversation_status = 'converted' THEN 1 END) as conversions,
    COUNT(CASE WHEN alc.conversation_status = 'booked' THEN 1 END) as bookings,
    ROUND(
        COUNT(CASE WHEN alc.conversation_status = 'converted' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(alc.id), 0) * 100, 2
    ) as conversion_rate,
    AVG(alc.response_time_avg_seconds) as avg_response_time,
    SUM(alc.messages_count) as total_messages_sent
FROM agents a
JOIN organizations o ON a.organization_id = o.id
LEFT JOIN agent_lead_conversations alc ON a.id = alc.agent_id
WHERE a.status = 'active'
GROUP BY a.id, a.full_name, a.waba_phone_number, o.name;

-- ============================================================================
-- 7. UTILITY FUNCTIONS
-- ============================================================================

-- 7.1 Function to find or create global lead
CREATE OR REPLACE FUNCTION find_or_create_global_lead(
    p_phone_number VARCHAR(20),
    p_full_name VARCHAR(255) DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT 'WA Direct',
    p_agent_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
BEGIN
    -- Try to find existing global lead
    SELECT id INTO v_lead_id
    FROM global_leads
    WHERE phone_number = p_phone_number;

    -- If not found, create new global lead
    IF v_lead_id IS NULL THEN
        INSERT INTO global_leads (
            phone_number,
            full_name,
            first_contact_source,
            first_contact_agent_id
        ) VALUES (
            p_phone_number,
            p_full_name,
            p_source,
            p_agent_id
        ) RETURNING id INTO v_lead_id;
    ELSE
        -- Update name if provided and current name is null
        UPDATE global_leads
        SET full_name = COALESCE(full_name, p_full_name),
            updated_at = NOW()
        WHERE id = v_lead_id;
    END IF;

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql;

-- 7.2 Function to get or create agent conversation
CREATE OR REPLACE FUNCTION get_or_create_agent_conversation(
    p_phone_number VARCHAR(20),
    p_agent_id UUID,
    p_lead_name VARCHAR(255) DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT 'WA Direct'
) RETURNS UUID AS $$
DECLARE
    v_global_lead_id UUID;
    v_conversation_id UUID;
BEGIN
    -- Find or create global lead
    v_global_lead_id := find_or_create_global_lead(
        p_phone_number,
        p_lead_name,
        p_source,
        p_agent_id
    );

    -- Try to find existing conversation
    SELECT id INTO v_conversation_id
    FROM agent_lead_conversations
    WHERE global_lead_id = v_global_lead_id
    AND agent_id = p_agent_id;

    -- If not found, create new conversation
    IF v_conversation_id IS NULL THEN
        INSERT INTO agent_lead_conversations (
            global_lead_id,
            agent_id,
            source
        ) VALUES (
            v_global_lead_id,
            p_agent_id,
            p_source
        ) RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;
