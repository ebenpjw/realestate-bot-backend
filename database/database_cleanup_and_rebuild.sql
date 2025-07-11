-- ============================================================================
-- DATABASE CLEANUP AND REBUILD SCRIPT
-- Real Estate Bot Backend - July 2025
-- ============================================================================
-- 
-- This script will:
-- 1. Backup agent data (preserve for testing)
-- 2. Drop all existing tables and views
-- 3. Recreate clean minimal schema
-- 4. Restore agent data
-- 5. Create essential views and functions
-- 
-- WARNING: This will wipe all data except agent information!
-- ============================================================================

-- ============================================================================
-- 1. BACKUP AGENT DATA
-- ============================================================================

-- Create temporary backup of agent data
CREATE TEMP TABLE agents_backup AS 
SELECT * FROM agents WHERE EXISTS (SELECT 1 FROM agents);

-- Log the backup
DO $$
DECLARE
    agent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agent_count FROM agents_backup;
    RAISE NOTICE 'Backed up % agent records', agent_count;
END $$;

-- ============================================================================
-- 2. DROP ALL EXISTING TABLES AND VIEWS
-- ============================================================================

-- Drop all views first (to avoid dependency issues)
DROP VIEW IF EXISTS unit_mix_bot_view CASCADE;
DROP VIEW IF EXISTS enhanced_project_summary CASCADE;
DROP VIEW IF EXISTS enhanced_ai_analysis_summary CASCADE;
DROP VIEW IF EXISTS strategy_effectiveness_summary CASCADE;
DROP VIEW IF EXISTS recent_learning_insights CASCADE;

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS conversation_outcomes CASCADE;
DROP TABLE IF EXISTS strategy_optimizations CASCADE;
DROP TABLE IF EXISTS strategy_performance CASCADE;
DROP TABLE IF EXISTS layer_optimization_insights CASCADE;
DROP TABLE IF EXISTS multilayer_performance_metrics CASCADE;
DROP TABLE IF EXISTS conversation_evolution CASCADE;
DROP TABLE IF EXISTS challenging_lead_performance CASCADE;
DROP TABLE IF EXISTS appointment_conversion_analytics CASCADE;
DROP TABLE IF EXISTS conversation_insights CASCADE;
DROP TABLE IF EXISTS conversation_memory CASCADE;
DROP TABLE IF EXISTS template_usage_log CASCADE;
DROP TABLE IF EXISTS ai_visual_analysis CASCADE;
DROP TABLE IF EXISTS visual_assets CASCADE;
DROP TABLE IF EXISTS property_search_index CASCADE;
DROP TABLE IF EXISTS property_unit_mix CASCADE;
DROP TABLE IF EXISTS property_units_backup CASCADE;
DROP TABLE IF EXISTS property_projects CASCADE;
DROP TABLE IF EXISTS scraping_sessions CASCADE;
DROP TABLE IF EXISTS scraping_progress CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Log cleanup completion
RAISE NOTICE 'All existing tables and views dropped successfully';

-- ============================================================================
-- 3. CREATE CLEAN MINIMAL SCHEMA
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3.1 AGENTS TABLE - Agent profiles with OAuth tokens and working hours
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
    
    -- OAuth Integration
    google_email VARCHAR(255),
    google_refresh_token_encrypted TEXT,
    zoom_user_id VARCHAR(255),
    
    -- Working Configuration
    working_hours JSONB DEFAULT '{"monday": {"start": "09:00", "end": "18:00"}, "tuesday": {"start": "09:00", "end": "18:00"}, "wednesday": {"start": "09:00", "end": "18:00"}, "thursday": {"start": "09:00", "end": "18:00"}, "friday": {"start": "09:00", "end": "18:00"}, "saturday": {"start": "09:00", "end": "13:00"}, "sunday": {"start": "closed", "end": "closed"}}'::jsonb,
    timezone VARCHAR(50) DEFAULT 'Asia/Singapore',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 LEADS TABLE - Primary entity with conversation state and booking info
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'booked', 'completed', 'lost')),
    assigned_agent_id UUID REFERENCES agents(id),
    
    -- Conversation Context (Used by AI system)
    intent VARCHAR(100),
    budget VARCHAR(255),
    location_preference VARCHAR(255),
    property_type VARCHAR(100),
    timeline VARCHAR(100),
    
    -- Booking Management (Critical for appointment system)
    booking_alternatives JSONB,
    tentative_booking_time TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    source VARCHAR(100) DEFAULT 'WA Direct',
    additional_notes TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.3 APPOINTMENTS TABLE - Booking records with Zoom/Calendar integration
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    
    -- Meeting Integration
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_password VARCHAR(50),
    calendar_event_id VARCHAR(255),
    
    -- Consultation Context
    consultation_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.4 MESSAGES TABLE - Conversation history storage
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('lead', 'bot', 'agent')),
    message TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.5 PROPERTY_PROJECTS TABLE - Master property data
CREATE TABLE property_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name VARCHAR(255) NOT NULL,
    developer VARCHAR(255),
    
    -- Location
    address TEXT,
    district VARCHAR(50),
    postal_code VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Property Details
    property_type VARCHAR(50),
    tenure VARCHAR(50),
    total_units INTEGER,
    
    -- Pricing & Status
    price_range_min DECIMAL(12, 2),
    price_range_max DECIMAL(12, 2),
    sales_status VARCHAR(20) DEFAULT 'Available' CHECK (sales_status IN ('Available', 'Sold out', 'Coming Soon')),
    
    -- Timeline
    launch_date DATE,
    top_date DATE,
    completion_status VARCHAR(20) DEFAULT 'BUC' CHECK (completion_status IN ('BUC', 'TOP soon', 'Completed')),
    
    -- Scraping Metadata
    source_url TEXT,
    last_scraped TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scraping_status VARCHAR(20) DEFAULT 'pending' CHECK (scraping_status IN ('pending', 'in_progress', 'completed', 'failed')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.6 PROPERTY_UNIT_MIX TABLE
CREATE TABLE property_unit_mix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    unit_type VARCHAR(100) NOT NULL,
    size_range_raw VARCHAR(255),
    size_min_sqft INTEGER,
    size_max_sqft INTEGER,
    size_unit VARCHAR(10) DEFAULT 'sqft',
    price_range_raw VARCHAR(255),
    price_min DECIMAL(12, 2),
    price_max DECIMAL(12, 2),
    price_currency VARCHAR(5) DEFAULT 'SGD',
    availability_raw VARCHAR(255),
    units_available INTEGER,
    units_total INTEGER,
    availability_percentage INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.7 VISUAL_ASSETS TABLE
CREATE TABLE visual_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('floor_plan', 'brochure', 'image', 'site_plan')),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    storage_bucket VARCHAR(100) DEFAULT 'visual-assets',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    original_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.8 AI_VISUAL_ANALYSIS TABLE
CREATE TABLE ai_visual_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_asset_id UUID REFERENCES visual_assets(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL DEFAULT 'floor_plan_analysis',
    ai_model VARCHAR(50) DEFAULT 'gpt-4-vision-preview',
    confidence_score DECIMAL(3, 2),
    extracted_data JSONB DEFAULT '{}'::jsonb,
    room_count INTEGER,
    layout_type VARCHAR(100),
    square_footage INTEGER,
    key_features TEXT[],
    description TEXT,
    summary TEXT,
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.9 TEMPLATE_USAGE_LOG TABLE
CREATE TABLE template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    agent_id UUID REFERENCES agents(id),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    gupshup_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.10 CONVERSATION_MEMORY TABLE
CREATE TABLE conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
    memory_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Core business indexes
CREATE INDEX idx_leads_phone_number ON leads(phone_number);
CREATE INDEX idx_leads_assigned_agent ON leads(assigned_agent_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);

-- Property data indexes
CREATE INDEX idx_property_projects_district ON property_projects(district);
CREATE INDEX idx_property_projects_sales_status ON property_projects(sales_status);
CREATE INDEX idx_property_unit_mix_project_id ON property_unit_mix(project_id);
CREATE INDEX idx_visual_assets_project_id ON visual_assets(project_id);
CREATE INDEX idx_ai_visual_analysis_asset_id ON ai_visual_analysis(visual_asset_id);

-- Compliance indexes
CREATE INDEX idx_template_usage_phone ON template_usage_log(phone_number);
CREATE INDEX idx_conversation_memory_lead_id ON conversation_memory(lead_id);

-- JSONB indexes for better query performance
CREATE INDEX idx_leads_booking_alternatives_gin ON leads USING GIN (booking_alternatives);
CREATE INDEX idx_agents_working_hours_gin ON agents USING GIN (working_hours);

-- ============================================================================
-- 5. RESTORE AGENT DATA
-- ============================================================================

-- Restore agent data from backup
INSERT INTO agents SELECT * FROM agents_backup;

-- Log restoration
DO $$
DECLARE
    restored_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO restored_count FROM agents;
    RAISE NOTICE 'Restored % agent records', restored_count;
END $$;

-- ============================================================================
-- 6. CREATE ESSENTIAL VIEWS
-- ============================================================================

-- Unit mix view for bot operations
CREATE VIEW unit_mix_bot_view AS
SELECT
    pum.id,
    pum.project_id,
    pp.project_name,
    pp.district,
    -- Extract bedroom count from unit type
    CASE
        WHEN pum.unit_type ILIKE '%studio%' THEN 0
        WHEN pum.unit_type ILIKE '%1 bed%' OR pum.unit_type ILIKE '%1-bed%' THEN 1
        WHEN pum.unit_type ILIKE '%2 bed%' OR pum.unit_type ILIKE '%2-bed%' THEN 2
        WHEN pum.unit_type ILIKE '%3 bed%' OR pum.unit_type ILIKE '%3-bed%' THEN 3
        WHEN pum.unit_type ILIKE '%4 bed%' OR pum.unit_type ILIKE '%4-bed%' THEN 4
        WHEN pum.unit_type ILIKE '%5 bed%' OR pum.unit_type ILIKE '%5-bed%' THEN 5
        ELSE NULL
    END as bedroom_count,
    pum.unit_type as standardized_type,
    pum.unit_type ILIKE '%study%' as has_study,
    pum.unit_type ILIKE '%flexi%' as has_flexi,
    pum.unit_type ILIKE '%penthouse%' as is_penthouse,
    pum.size_min_sqft,
    pum.size_max_sqft,
    pum.size_range_raw as size_range_text,
    pum.price_min,
    pum.price_max,
    pum.price_range_raw as price_range_text,
    pum.units_available as available_units,
    pum.units_total as total_units,
    pum.availability_percentage,
    (pum.units_available > 0) as is_available,
    -- Calculate price per sqft
    CASE
        WHEN pum.size_min_sqft > 0 AND pum.price_min > 0
        THEN ROUND(pum.price_min / pum.size_min_sqft)::INTEGER
        ELSE NULL
    END as price_per_sqft,
    -- Calculate average price
    CASE
        WHEN pum.price_min > 0 AND pum.price_max > 0
        THEN ROUND((pum.price_min + pum.price_max) / 2)::BIGINT
        WHEN pum.price_min > 0 THEN pum.price_min::BIGINT
        ELSE NULL
    END as avg_price,
    -- Calculate average size
    CASE
        WHEN pum.size_min_sqft > 0 AND pum.size_max_sqft > 0
        THEN ROUND((pum.size_min_sqft + pum.size_max_sqft) / 2)::INTEGER
        WHEN pum.size_min_sqft > 0 THEN pum.size_min_sqft
        ELSE NULL
    END as avg_size
FROM property_unit_mix pum
JOIN property_projects pp ON pum.project_id = pp.id
WHERE pp.sales_status = 'Available'
ORDER BY pp.project_name, pum.unit_type;

-- ============================================================================
-- 7. COMPLETION
-- ============================================================================

-- Analyze tables for optimal query planning
ANALYZE leads;
ANALYZE messages;
ANALYZE agents;
ANALYZE appointments;
ANALYZE property_projects;
ANALYZE property_unit_mix;
ANALYZE visual_assets;
ANALYZE ai_visual_analysis;

-- Final verification
DO $$
DECLARE
    table_count INTEGER;
    agent_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    -- Count agents
    SELECT COUNT(*) INTO agent_count FROM agents;

    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'DATABASE CLEANUP AND REBUILD COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE 'Agent records preserved: %', agent_count;
    RAISE NOTICE 'Schema is now clean and optimized for production use';
    RAISE NOTICE '============================================================================';
END $$;
