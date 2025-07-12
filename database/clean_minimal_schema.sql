-- ============================================================================
-- CLEAN MINIMAL DATABASE SCHEMA
-- Real Estate Bot Backend - July 2025
-- ============================================================================
-- 
-- This script creates a clean, minimal database schema with only the tables
-- and columns that are actually used by the current active codebase.
-- 
-- STRATEGIC ORDER:
-- 1. Core Business Tables (leads, agents, appointments, messages)
-- 2. Property Data Tables (property_projects, property_unit_mix, visual_assets, ai_visual_analysis)
-- 3. Compliance & Logging Tables (template_usage_log, conversation_memory)
-- 4. Views & Functions for bot operations
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE BUSINESS TABLES
-- ============================================================================

-- 1.1 AGENTS TABLE - Agent profiles with OAuth tokens and working hours
CREATE TABLE IF NOT EXISTS agents (
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

-- 1.2 LEADS TABLE - Primary entity with conversation state and booking info
CREATE TABLE IF NOT EXISTS leads (
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

-- 1.3 APPOINTMENTS TABLE - Booking records with Zoom/Calendar integration
CREATE TABLE IF NOT EXISTS appointments (
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

-- 1.4 MESSAGES TABLE - Conversation history storage
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('lead', 'bot', 'agent')),
    message TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. PROPERTY DATA TABLES
-- ============================================================================

-- 2.1 PROPERTY_PROJECTS TABLE - Master property data
CREATE TABLE IF NOT EXISTS property_projects (
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

-- 2.2 PROPERTY_UNIT_MIX TABLE - Individual unit specifications within projects
CREATE TABLE IF NOT EXISTS property_unit_mix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    unit_type VARCHAR(100) NOT NULL,

    -- Size Information
    size_range_raw VARCHAR(255),
    size_min_sqft INTEGER,
    size_max_sqft INTEGER,
    size_unit VARCHAR(10) DEFAULT 'sqft',

    -- Pricing Information
    price_range_raw VARCHAR(255),
    price_min DECIMAL(12, 2),
    price_max DECIMAL(12, 2),
    price_currency VARCHAR(5) DEFAULT 'SGD',

    -- Availability Information
    availability_raw VARCHAR(255),
    units_available INTEGER,
    units_total INTEGER,
    availability_percentage INTEGER,

    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 VISUAL_ASSETS TABLE - Storage metadata for floor plans and images
CREATE TABLE IF NOT EXISTS visual_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('floor_plan', 'brochure', 'image', 'site_plan')),

    -- File Information
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),

    -- Storage Information
    storage_bucket VARCHAR(100) DEFAULT 'visual-assets',
    storage_path TEXT NOT NULL,
    public_url TEXT,

    -- Processing Status
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

    -- Metadata
    original_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 AI_VISUAL_ANALYSIS TABLE - GPT-4 Vision analysis results
CREATE TABLE IF NOT EXISTS ai_visual_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_asset_id UUID REFERENCES visual_assets(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL DEFAULT 'floor_plan_analysis',

    -- AI Model Information
    ai_model VARCHAR(50) DEFAULT 'gpt-4-vision-preview',
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00

    -- Extracted Data
    extracted_data JSONB DEFAULT '{}'::jsonb,
    room_count INTEGER,
    layout_type VARCHAR(100),
    square_footage INTEGER,
    key_features TEXT[],

    -- Natural Language Description
    description TEXT,
    summary TEXT,

    -- Processing Information
    processing_time_ms INTEGER,
    tokens_used INTEGER,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. COMPLIANCE & LOGGING TABLES
-- ============================================================================

-- 3.1 TEMPLATE_USAGE_LOG TABLE - WABA compliance tracking
CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    agent_id UUID REFERENCES agents(id),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    gupshup_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 CONVERSATION_MEMORY TABLE - AI conversation context
CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
    memory_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

-- Core business indexes
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);

-- Property data indexes
CREATE INDEX IF NOT EXISTS idx_property_projects_district ON property_projects(district);
CREATE INDEX IF NOT EXISTS idx_property_projects_sales_status ON property_projects(sales_status);
CREATE INDEX IF NOT EXISTS idx_property_unit_mix_project_id ON property_unit_mix(project_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_project_id ON visual_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_visual_analysis_asset_id ON ai_visual_analysis(visual_asset_id);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_template_usage_phone ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_lead_id ON conversation_memory(lead_id);

-- JSONB indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_booking_alternatives_gin ON leads USING GIN (booking_alternatives);
CREATE INDEX IF NOT EXISTS idx_agents_working_hours_gin ON agents USING GIN (working_hours);
