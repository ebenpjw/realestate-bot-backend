-- ============================================================================
-- INTELLIGENT FOLLOW-UP SYSTEM SCHEMA
-- ============================================================================
-- Comprehensive follow-up system with AI-driven lead state detection,
-- multi-WABA support, progressive sequences, and PDPA compliance
-- 
-- Replaces: followUpAutomationService, wabaCompliantFollowUpService, contextualFollowUpService
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. LEAD STATES TABLE - AI-Detected Conversation Outcomes
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    conversation_id UUID, -- For multi-tenant: references agent_lead_conversations(id)
    
    -- AI-Detected Lead State
    current_state VARCHAR(50) NOT NULL CHECK (current_state IN (
        'need_family_discussion',
        'still_looking', 
        'budget_concerns',
        'timing_not_right',
        'interested_hesitant',
        'ready_to_book',
        'default'
    )),
    
    -- State Detection Details
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    detection_method VARCHAR(50) DEFAULT 'multilayer_ai',
    ai_analysis_data JSONB DEFAULT '{}'::jsonb, -- Full AI analysis for debugging
    
    -- Context from Conversation
    conversation_context JSONB DEFAULT '{}'::jsonb,
    last_message_content TEXT,
    objections_mentioned TEXT[],
    interests_expressed TEXT[],
    
    -- State History
    previous_state VARCHAR(50),
    state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    state_duration_hours INTEGER, -- How long in current state
    
    -- Follow-up Eligibility
    is_follow_up_eligible BOOLEAN DEFAULT true,
    follow_up_blocked_reason TEXT,
    pdpa_consent_status VARCHAR(20) DEFAULT 'assumed' CHECK (pdpa_consent_status IN ('given', 'assumed', 'withdrawn')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. FOLLOW-UP SEQUENCES TABLE - Progressive Follow-up Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS follow_up_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    conversation_id UUID, -- For multi-tenant support
    lead_state_id UUID REFERENCES lead_states(id) ON DELETE CASCADE,
    
    -- Sequence Configuration
    sequence_stage INTEGER NOT NULL DEFAULT 1 CHECK (sequence_stage >= 1 AND sequence_stage <= 4),
    -- Stage 1: 3 days, Stage 2: 1 week, Stage 3: 2 weeks, Stage 4: 1 month
    
    -- Timing Management
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_sent_time TIMESTAMP WITH TIME ZONE,
    next_follow_up_time TIMESTAMP WITH TIME ZONE,
    
    -- Status Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'replied', 
        'failed', 'cancelled', 'expired', 'dead'
    )),
    
    -- Template Selection
    selected_template_id UUID, -- References agent_follow_up_templates(id)
    template_variation INTEGER DEFAULT 1, -- For template rotation
    template_params JSONB DEFAULT '{}'::jsonb,
    
    -- Response Tracking
    lead_responded BOOLEAN DEFAULT false,
    response_time_minutes INTEGER,
    response_sentiment VARCHAR(20), -- positive, neutral, negative
    conversation_continued BOOLEAN DEFAULT false,
    
    -- Sequence Control
    sequence_reset_count INTEGER DEFAULT 0, -- How many times sequence was reset
    is_final_attempt BOOLEAN DEFAULT false,
    auto_mark_dead_at TIMESTAMP WITH TIME ZONE, -- When to mark lead as dead
    
    -- Delivery Details
    delivery_status VARCHAR(20),
    delivery_error_message TEXT,
    waba_message_id VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. AGENT FOLLOW-UP TEMPLATES - Multi-WABA Template Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_follow_up_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Template Identity
    template_name VARCHAR(100) NOT NULL,
    template_category VARCHAR(50) NOT NULL, -- state_based, generic, final
    lead_state VARCHAR(50) NOT NULL, -- Which lead state this template is for
    
    -- Template Content
    template_content TEXT NOT NULL,
    template_params JSONB DEFAULT '[]'::jsonb, -- Parameter definitions
    
    -- WABA Configuration
    is_waba_template BOOLEAN DEFAULT false, -- true = approved WABA template, false = free-form
    waba_template_id VARCHAR(255), -- Gupshup template ID if WABA template
    waba_template_name VARCHAR(255), -- Template name in Gupshup
    language_code VARCHAR(10) DEFAULT 'en',
    
    -- Template Variations (to avoid robotic appearance)
    variation_group VARCHAR(50), -- Templates with same group are variations of each other
    variation_number INTEGER DEFAULT 1,
    usage_weight DECIMAL(3,2) DEFAULT 1.00, -- For weighted random selection
    
    -- Performance Tracking
    usage_count INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2), -- Percentage of responses received
    conversion_rate DECIMAL(5,2), -- Percentage leading to appointments
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Template Status
    is_active BOOLEAN DEFAULT true,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    
    -- Business Hours Compliance
    business_hours_only BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'Asia/Singapore',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, template_name, variation_number)
);

-- ============================================================================
-- 4. WABA TEMPLATE STATUS - Template Approval Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS waba_template_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Template Identity
    template_name VARCHAR(255) NOT NULL,
    template_category VARCHAR(50) NOT NULL CHECK (template_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    language_code VARCHAR(10) DEFAULT 'en',

    -- Agent Association (for multi-tenant support)
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

    -- Template Content & Structure
    template_components JSONB NOT NULL, -- WhatsApp template components structure
    template_content TEXT, -- Human-readable template content

    -- Approval Status Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled', 'failed')),
    template_id VARCHAR(255), -- Gupshup template ID once approved

    -- Approval Timeline
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,

    -- Rejection Details
    rejection_reason TEXT,
    rejection_category VARCHAR(50), -- policy, content, format, etc.

    -- Generation Context (for AI-generated templates)
    generation_context JSONB, -- Context that led to template generation
    conversation_patterns JSONB, -- Patterns identified that triggered generation
    ai_confidence_score DECIMAL(3,2), -- AI confidence in template necessity

    -- Retry Logic
    submission_attempts INTEGER DEFAULT 1,
    last_submission_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Performance Tracking (once approved)
    usage_count INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(agent_id, template_name, language_code)
);

-- ============================================================================
-- 5. FOLLOW-UP TRACKING TABLE - Comprehensive Follow-up History
-- ============================================================================
CREATE TABLE IF NOT EXISTS follow_up_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follow_up_sequence_id UUID REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

    -- Follow-up Details
    follow_up_type VARCHAR(50) NOT NULL, -- state_based, generic, final_attempt
    lead_state_at_time VARCHAR(50) NOT NULL,
    sequence_stage INTEGER NOT NULL,

    -- Message Details
    message_content TEXT NOT NULL,
    template_used_id UUID REFERENCES agent_follow_up_templates(id),
    template_variation INTEGER,

    -- Delivery Information
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_status VARCHAR(20) NOT NULL,
    delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Response Tracking
    response_received BOOLEAN DEFAULT false,
    response_time_minutes INTEGER,
    response_content TEXT,
    response_sentiment VARCHAR(20),

    -- Conversion Tracking
    led_to_appointment BOOLEAN DEFAULT false,
    appointment_booked_at TIMESTAMP WITH TIME ZONE,
    conversion_value DECIMAL(10,2), -- If applicable

    -- WABA Compliance
    within_24h_window BOOLEAN NOT NULL,
    waba_template_used BOOLEAN DEFAULT false,
    compliance_notes TEXT,

    -- Performance Metrics
    engagement_score DECIMAL(3,2), -- 0.00 to 1.00
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. PDPA COMPLIANCE TABLE - Singapore PDPA Compliance Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS pdpa_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Consent Management
    consent_given BOOLEAN DEFAULT false,
    consent_given_at TIMESTAMP WITH TIME ZONE,
    consent_method VARCHAR(50), -- form_submission, verbal_confirmation, implied
    consent_source VARCHAR(100), -- facebook_form, whatsapp_conversation, etc.

    -- Opt-out Management
    opt_out_requested BOOLEAN DEFAULT false,
    opt_out_requested_at TIMESTAMP WITH TIME ZONE,
    opt_out_method VARCHAR(50), -- ai_detected, explicit_stop, manual_request
    opt_out_message TEXT, -- The message where opt-out was detected
    opt_out_processed BOOLEAN DEFAULT false,
    opt_out_processed_at TIMESTAMP WITH TIME ZONE,

    -- Data Processing Rights
    data_access_requested BOOLEAN DEFAULT false,
    data_deletion_requested BOOLEAN DEFAULT false,
    data_correction_requested BOOLEAN DEFAULT false,

    -- Compliance Status
    is_compliant BOOLEAN DEFAULT true,
    compliance_notes TEXT,
    last_compliance_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Follow-up Permissions
    marketing_messages_allowed BOOLEAN DEFAULT true,
    follow_up_messages_allowed BOOLEAN DEFAULT true,
    property_updates_allowed BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. FOLLOW-UP PERFORMANCE ANALYTICS - System Performance Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS follow_up_performance_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Time Period
    date DATE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

    -- Volume Metrics
    total_follow_ups_sent INTEGER DEFAULT 0,
    state_based_follow_ups INTEGER DEFAULT 0,
    generic_follow_ups INTEGER DEFAULT 0,
    final_attempt_follow_ups INTEGER DEFAULT 0,

    -- Response Metrics
    total_responses_received INTEGER DEFAULT 0,
    positive_responses INTEGER DEFAULT 0,
    neutral_responses INTEGER DEFAULT 0,
    negative_responses INTEGER DEFAULT 0,

    -- Conversion Metrics
    appointments_booked INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    leads_marked_dead INTEGER DEFAULT 0,

    -- Template Performance
    best_performing_template_id UUID REFERENCES agent_follow_up_templates(id),
    worst_performing_template_id UUID REFERENCES agent_follow_up_templates(id),

    -- Timing Analysis
    avg_response_time_minutes DECIMAL(8,2),
    best_performing_time_slot VARCHAR(20), -- morning, afternoon, evening

    -- Compliance Metrics
    pdpa_violations INTEGER DEFAULT 0,
    opt_out_requests INTEGER DEFAULT 0,
    compliance_score DECIMAL(3,2), -- 0.00 to 1.00

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(date, agent_id)
);

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Lead States Indexes
CREATE INDEX IF NOT EXISTS idx_lead_states_lead_id ON lead_states(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_states_current_state ON lead_states(current_state);
CREATE INDEX IF NOT EXISTS idx_lead_states_follow_up_eligible ON lead_states(is_follow_up_eligible);
CREATE INDEX IF NOT EXISTS idx_lead_states_conversation_id ON lead_states(conversation_id);

-- Follow-up Sequences Indexes
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_lead_id ON follow_up_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_status ON follow_up_sequences(status);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_scheduled_time ON follow_up_sequences(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_stage ON follow_up_sequences(sequence_stage);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_pending ON follow_up_sequences(status, scheduled_time) WHERE status = 'pending';

-- Agent Templates Indexes
CREATE INDEX IF NOT EXISTS idx_agent_templates_agent_id ON agent_follow_up_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_lead_state ON agent_follow_up_templates(lead_state);
CREATE INDEX IF NOT EXISTS idx_agent_templates_active ON agent_follow_up_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_templates_variation_group ON agent_follow_up_templates(variation_group);

-- WABA Template Status Indexes
CREATE INDEX IF NOT EXISTS idx_waba_template_status_agent_id ON waba_template_status(agent_id);
CREATE INDEX IF NOT EXISTS idx_waba_template_status_status ON waba_template_status(status);
CREATE INDEX IF NOT EXISTS idx_waba_template_status_category ON waba_template_status(template_category);
CREATE INDEX IF NOT EXISTS idx_waba_template_status_pending ON waba_template_status(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_waba_template_status_approved ON waba_template_status(agent_id, status) WHERE status = 'approved';

-- ============================================================================
-- 8. MISSING TEMPLATE SCENARIOS - Track scenarios needing new templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS missing_template_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Scenario Identity
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    lead_state VARCHAR(50) NOT NULL,
    template_category VARCHAR(50) NOT NULL,

    -- Occurrence Tracking
    occurrence_count INTEGER DEFAULT 1,
    first_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- AI Analysis
    ai_analysis_requested BOOLEAN DEFAULT false,
    ai_analysis_completed BOOLEAN DEFAULT false,
    template_generated BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(agent_id, lead_state, template_category)
);

-- Missing Template Scenarios Indexes
CREATE INDEX IF NOT EXISTS idx_missing_scenarios_agent ON missing_template_scenarios(agent_id);
CREATE INDEX IF NOT EXISTS idx_missing_scenarios_state ON missing_template_scenarios(lead_state);
CREATE INDEX IF NOT EXISTS idx_missing_scenarios_category ON missing_template_scenarios(template_category);
CREATE INDEX IF NOT EXISTS idx_missing_scenarios_count ON missing_template_scenarios(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_missing_scenarios_analysis ON missing_template_scenarios(ai_analysis_requested, ai_analysis_completed);

-- Follow-up Tracking Indexes
CREATE INDEX IF NOT EXISTS idx_follow_up_tracking_lead_id ON follow_up_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_tracking_agent_id ON follow_up_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_tracking_sent_at ON follow_up_tracking(sent_at);
CREATE INDEX IF NOT EXISTS idx_follow_up_tracking_response ON follow_up_tracking(response_received);

-- PDPA Compliance Indexes
CREATE INDEX IF NOT EXISTS idx_pdpa_compliance_lead_id ON pdpa_compliance(lead_id);
CREATE INDEX IF NOT EXISTS idx_pdpa_compliance_opt_out ON pdpa_compliance(opt_out_requested);
CREATE INDEX IF NOT EXISTS idx_pdpa_compliance_consent ON pdpa_compliance(consent_given);

-- Performance Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_performance_analytics_date ON follow_up_performance_analytics(date);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_agent_id ON follow_up_performance_analytics(agent_id);

-- ============================================================================
-- 8. SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample Agent Follow-up Templates for Different Lead States
INSERT INTO agent_follow_up_templates (
    agent_id, template_name, template_category, lead_state, template_content,
    variation_group, variation_number, is_waba_template
) VALUES
-- Need Family Discussion Templates
('00000000-0000-0000-0000-000000000001', 'family_discussion_followup_1', 'state_based', 'need_family_discussion',
'Hey {{name}}, how are you doing? Just checking in regarding your property search. Have you had a chance to discuss with your family?',
'family_discussion', 1, false),

('00000000-0000-0000-0000-000000000001', 'family_discussion_followup_2', 'state_based', 'need_family_discussion',
'Hi {{name}}! Hope you''re well. Wondering if you''ve had time to chat with your family about the property options we discussed?',
'family_discussion', 2, false),

-- Still Looking Templates
('00000000-0000-0000-0000-000000000001', 'still_looking_followup_1', 'state_based', 'still_looking',
'Hey {{name}}, how''s the property hunt going? Just wanted to check if you''d like me to keep an eye out for anything specific.',
'still_looking', 1, false),

('00000000-0000-0000-0000-000000000001', 'still_looking_followup_2', 'state_based', 'still_looking',
'Hi {{name}}! Hope your property search is going well. Any particular areas or types you''d like me to focus on?',
'still_looking', 2, false),

-- Budget Concerns Templates
('00000000-0000-0000-0000-000000000001', 'budget_concerns_followup_1', 'state_based', 'budget_concerns',
'Hey {{name}}, how are you doing? Just checking in - have you had a chance to review your budget options?',
'budget_concerns', 1, false),

-- Generic Templates for Later Stages
('00000000-0000-0000-0000-000000000001', 'generic_checkin_1', 'generic', 'default',
'Hey {{name}}, how are you doing? Just checking in regarding your property search. Anything I can help with?',
'generic_checkin', 1, false),

('00000000-0000-0000-0000-000000000001', 'generic_checkin_2', 'generic', 'default',
'Hi {{name}}! Hope you''re well. Just wanted to see how things are going with your property plans.',
'generic_checkin', 2, false),

-- Final Attempt Templates
('00000000-0000-0000-0000-000000000001', 'final_attempt_1', 'final', 'default',
'Hey {{name}}, this will be my last check-in regarding your property search. If you need any help in the future, feel free to reach out!',
'final_attempt', 1, false);

-- ============================================================================
-- 9. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_lead_states_updated_at BEFORE UPDATE ON lead_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_up_sequences_updated_at BEFORE UPDATE ON follow_up_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_templates_updated_at BEFORE UPDATE ON agent_follow_up_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pdpa_compliance_updated_at BEFORE UPDATE ON pdpa_compliance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for active follow-up sequences ready to be processed
CREATE OR REPLACE VIEW pending_follow_ups AS
SELECT
    fs.*,
    ls.current_state,
    ls.pdpa_consent_status,
    l.phone_number,
    l.full_name,
    l.assigned_agent_id,
    a.waba_phone_number,
    a.bot_name
FROM follow_up_sequences fs
JOIN lead_states ls ON fs.lead_state_id = ls.id
JOIN leads l ON fs.lead_id = l.id
LEFT JOIN agents a ON l.assigned_agent_id = a.id
WHERE fs.status = 'pending'
    AND fs.scheduled_time <= NOW()
    AND ls.is_follow_up_eligible = true
    AND ls.pdpa_consent_status != 'withdrawn';

-- View for follow-up performance summary
CREATE OR REPLACE VIEW follow_up_performance_summary AS
SELECT
    agent_id,
    DATE_TRUNC('week', sent_at) as week,
    COUNT(*) as total_sent,
    COUNT(CASE WHEN response_received THEN 1 END) as responses,
    COUNT(CASE WHEN led_to_appointment THEN 1 END) as appointments,
    ROUND(AVG(response_time_minutes), 2) as avg_response_time,
    ROUND(
        COUNT(CASE WHEN response_received THEN 1 END)::DECIMAL / COUNT(*) * 100,
        2
    ) as response_rate_percent
FROM follow_up_tracking
WHERE sent_at >= NOW() - INTERVAL '30 days'
GROUP BY agent_id, DATE_TRUNC('week', sent_at)
ORDER BY week DESC, agent_id;
