-- ============================================================================
-- FACEBOOK/INSTAGRAM LEAD INTEGRATION SCHEMA MIGRATION (FIXED)
-- Real Estate Bot Backend - July 2025
-- ============================================================================
--
-- This migration adds comprehensive support for Facebook/Instagram lead ads
-- integration with multi-agent attribution, deduplication, and source tracking.
--
-- FIXED VERSION: Handles existing columns and constraints gracefully
--
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENHANCE EXISTING LEADS TABLE
-- ============================================================================

-- Function to safely add columns to leads table
CREATE OR REPLACE FUNCTION add_leads_columns() RETURNS void AS $$
DECLARE
    column_exists boolean;
BEGIN
    -- Check and add primary_source column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'primary_source'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN primary_source VARCHAR(100) DEFAULT 'whatsapp_direct';
        RAISE NOTICE 'Added primary_source column to leads table';
    END IF;

    -- Check and add source_details column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'source_details'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN source_details JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added source_details column to leads table';
    END IF;

    -- Check and add lead_quality_score column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'lead_quality_score'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN lead_quality_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added lead_quality_score column to leads table';
    END IF;

    -- Check and add first_contact_method column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'first_contact_method'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN first_contact_method VARCHAR(50);
        RAISE NOTICE 'Added first_contact_method column to leads table';
    END IF;

    -- Check and add lead_temperature column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'lead_temperature'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN lead_temperature VARCHAR(20) DEFAULT 'warm';
        RAISE NOTICE 'Added lead_temperature column to leads table';
    END IF;

    -- Check and add conversion_probability column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'conversion_probability'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN conversion_probability DECIMAL(3,2) DEFAULT 0.50;
        RAISE NOTICE 'Added conversion_probability column to leads table';
    END IF;

    -- Check and add is_merged column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'is_merged'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN is_merged BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_merged column to leads table';
    END IF;

    -- Check and add merged_from_lead_ids column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'merged_from_lead_ids'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN merged_from_lead_ids JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added merged_from_lead_ids column to leads table';
    END IF;

    -- Check and add duplicate_check_hash column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'duplicate_check_hash'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN duplicate_check_hash VARCHAR(64);
        RAISE NOTICE 'Added duplicate_check_hash column to leads table';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to add columns
SELECT add_leads_columns();

-- Drop the temporary function
DROP FUNCTION add_leads_columns();

-- Add constraint for lead_temperature if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_lead_temperature'
        AND table_name = 'leads'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT chk_lead_temperature
        CHECK (lead_temperature IN ('hot', 'warm', 'cold'));
        RAISE NOTICE 'Added lead_temperature constraint to leads table';
    END IF;
END $$;

-- Migrate existing source data to new primary_source field
UPDATE leads
SET primary_source = CASE
    WHEN source = 'WA Direct' THEN 'whatsapp_direct'
    WHEN source ILIKE '%facebook%' THEN 'facebook'
    WHEN source ILIKE '%instagram%' THEN 'instagram'
    ELSE 'whatsapp_direct'
END
WHERE primary_source = 'whatsapp_direct' AND source IS NOT NULL AND source != 'WA Direct';

-- ============================================================================
-- 2. CREATE FACEBOOK PAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS facebook_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

    -- Facebook Page Information
    page_id VARCHAR(255) NOT NULL UNIQUE,
    page_name VARCHAR(255),
    page_category VARCHAR(100),
    page_access_token_encrypted TEXT,
    page_access_token_iv VARCHAR(255),
    page_access_token_tag VARCHAR(255),

    -- Integration Status
    webhook_subscribed BOOLEAN DEFAULT false,
    webhook_subscription_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),

    -- Permissions & Capabilities
    permissions JSONB DEFAULT '[]'::jsonb,
    lead_ads_enabled BOOLEAN DEFAULT false,
    instagram_connected BOOLEAN DEFAULT false,
    instagram_account_id VARCHAR(255),

    -- Metadata
    last_token_refresh TIMESTAMP WITH TIME ZONE,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE LEAD SOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Source Information
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('facebook', 'instagram', 'whatsapp_direct', 'referral', 'website')),
    source_platform VARCHAR(50), -- 'facebook_lead_ads', 'instagram_lead_ads', 'whatsapp_business'

    -- Facebook/Instagram Specific Data
    page_id VARCHAR(255),
    form_id VARCHAR(255),
    ad_id VARCHAR(255),
    campaign_id VARCHAR(255),
    adset_id VARCHAR(255),
    leadgen_id VARCHAR(255), -- Facebook's unique lead ID

    -- Campaign Attribution Data
    campaign_data JSONB DEFAULT '{}'::jsonb,
    utm_parameters JSONB DEFAULT '{}'::jsonb,

    -- Lead Quality Metrics
    lead_score INTEGER DEFAULT 0,
    source_quality VARCHAR(20) DEFAULT 'unknown' CHECK (source_quality IN ('high', 'medium', 'low', 'unknown')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE LEAD DEDUPLICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_deduplication (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Lead Identification
    primary_lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    duplicate_lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Deduplication Logic
    match_type VARCHAR(50) NOT NULL CHECK (match_type IN ('phone_exact', 'email_exact', 'phone_email_combo', 'name_phone_fuzzy')),
    confidence_score DECIMAL(3,2) DEFAULT 0.00 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),

    -- Resolution Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'ignored', 'false_positive')),
    resolved_by VARCHAR(50), -- 'system', 'manual', 'agent'
    resolution_notes TEXT,

    -- Metadata
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Enhanced leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_primary_source ON leads(primary_source);
CREATE INDEX IF NOT EXISTS idx_leads_lead_temperature ON leads(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_check_hash ON leads(duplicate_check_hash);
CREATE INDEX IF NOT EXISTS idx_leads_is_merged ON leads(is_merged);
CREATE INDEX IF NOT EXISTS idx_leads_source_details_gin ON leads USING GIN (source_details);
CREATE INDEX IF NOT EXISTS idx_leads_merged_from_lead_ids_gin ON leads USING GIN (merged_from_lead_ids);

-- Facebook pages indexes
CREATE INDEX IF NOT EXISTS idx_facebook_pages_agent_id ON facebook_pages(agent_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_page_id ON facebook_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_status ON facebook_pages(status);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_permissions_gin ON facebook_pages USING GIN (permissions);

-- Lead sources indexes
CREATE INDEX IF NOT EXISTS idx_lead_sources_lead_id ON lead_sources(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_source_type ON lead_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_lead_sources_page_id ON lead_sources(page_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_leadgen_id ON lead_sources(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_campaign_data_gin ON lead_sources USING GIN (campaign_data);
CREATE INDEX IF NOT EXISTS idx_lead_sources_utm_parameters_gin ON lead_sources USING GIN (utm_parameters);

-- Lead deduplication indexes
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_primary_lead ON lead_deduplication(primary_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_duplicate_lead ON lead_deduplication(duplicate_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_status ON lead_deduplication(status);

-- ============================================================================
-- 6. CREATE UTILITY FUNCTIONS AND VIEWS
-- ============================================================================

-- Function to generate duplicate check hash for leads
CREATE OR REPLACE FUNCTION generate_duplicate_check_hash(
    p_phone_number VARCHAR(20),
    p_full_name VARCHAR(255) DEFAULT NULL,
    p_email VARCHAR(255) DEFAULT NULL
) RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(
        digest(
            LOWER(COALESCE(p_phone_number, '')) || '|' ||
            LOWER(COALESCE(p_full_name, '')) || '|' ||
            LOWER(COALESCE(p_email, '')),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update duplicate check hash on leads
CREATE OR REPLACE FUNCTION update_lead_duplicate_hash() RETURNS TRIGGER AS $$
BEGIN
    NEW.duplicate_check_hash := generate_duplicate_check_hash(
        NEW.phone_number,
        NEW.full_name,
        NULL -- Email field to be added later if needed
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update duplicate check hash
DROP TRIGGER IF EXISTS trigger_update_lead_duplicate_hash ON leads;
CREATE TRIGGER trigger_update_lead_duplicate_hash
    BEFORE INSERT OR UPDATE OF phone_number, full_name ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_duplicate_hash();

-- Update existing leads with duplicate check hash
UPDATE leads
SET duplicate_check_hash = generate_duplicate_check_hash(phone_number, full_name)
WHERE duplicate_check_hash IS NULL;

-- View for leads with their source information
CREATE OR REPLACE VIEW leads_with_sources AS
SELECT
    l.*,
    ls.source_type,
    ls.source_platform,
    ls.page_id,
    ls.campaign_data,
    ls.lead_score as source_lead_score,
    ls.source_quality,
    fp.page_name,
    fp.agent_id as source_agent_id
FROM leads l
LEFT JOIN lead_sources ls ON l.id = ls.lead_id
LEFT JOIN facebook_pages fp ON ls.page_id = fp.page_id;

-- View for agent Facebook page summary
CREATE OR REPLACE VIEW agent_facebook_summary AS
SELECT
    a.id as agent_id,
    a.full_name as agent_name,
    COUNT(fp.id) as connected_pages,
    COUNT(CASE WHEN fp.status = 'active' THEN 1 END) as active_pages,
    COUNT(CASE WHEN fp.lead_ads_enabled THEN 1 END) as lead_ads_enabled_pages,
    COUNT(CASE WHEN fp.instagram_connected THEN 1 END) as instagram_connected_pages
FROM agents a
LEFT JOIN facebook_pages fp ON a.id = fp.agent_id
GROUP BY a.id, a.full_name;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '=== Facebook/Instagram Lead Integration Schema Migration Completed Successfully ===';
    RAISE NOTICE 'New tables created: facebook_pages, lead_sources, lead_deduplication';
    RAISE NOTICE 'Enhanced leads table with attribution and deduplication support';
    RAISE NOTICE 'Added performance indexes and utility functions';
    RAISE NOTICE 'Created views for common queries';
    RAISE NOTICE 'Migration completed at: %', NOW();
END $$;

-- ============================================================================
-- 1. ENHANCE EXISTING LEADS TABLE
-- ============================================================================

-- Function to safely add columns to leads table
CREATE OR REPLACE FUNCTION add_leads_columns() RETURNS void AS $$
DECLARE
    column_exists boolean;
BEGIN
    -- Check and add primary_source column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'primary_source'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN primary_source VARCHAR(100) DEFAULT 'whatsapp_direct';
        RAISE NOTICE 'Added primary_source column to leads table';
    END IF;
    
    -- Check and add source_details column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'source_details'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN source_details JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added source_details column to leads table';
    END IF;
    
    -- Check and add lead_quality_score column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'lead_quality_score'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN lead_quality_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added lead_quality_score column to leads table';
    END IF;
    
    -- Check and add first_contact_method column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'first_contact_method'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN first_contact_method VARCHAR(50);
        RAISE NOTICE 'Added first_contact_method column to leads table';
    END IF;
    
    -- Check and add lead_temperature column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'lead_temperature'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN lead_temperature VARCHAR(20) DEFAULT 'warm';
        RAISE NOTICE 'Added lead_temperature column to leads table';
    END IF;
    
    -- Check and add conversion_probability column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'conversion_probability'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN conversion_probability DECIMAL(3,2) DEFAULT 0.50;
        RAISE NOTICE 'Added conversion_probability column to leads table';
    END IF;
    
    -- Check and add is_merged column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'is_merged'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN is_merged BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_merged column to leads table';
    END IF;
    
    -- Check and add merged_from_lead_ids column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'merged_from_lead_ids'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN merged_from_lead_ids JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added merged_from_lead_ids column to leads table';
    END IF;
    
    -- Check and add duplicate_check_hash column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'duplicate_check_hash'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE leads ADD COLUMN duplicate_check_hash VARCHAR(64);
        RAISE NOTICE 'Added duplicate_check_hash column to leads table';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to add columns
SELECT add_leads_columns();

-- Drop the temporary function
DROP FUNCTION add_leads_columns();

-- Add constraint for lead_temperature if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_lead_temperature' 
        AND table_name = 'leads'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT chk_lead_temperature 
        CHECK (lead_temperature IN ('hot', 'warm', 'cold'));
        RAISE NOTICE 'Added lead_temperature constraint to leads table';
    END IF;
END $$;

-- Migrate existing source data to new primary_source field
UPDATE leads 
SET primary_source = CASE 
    WHEN source = 'WA Direct' THEN 'whatsapp_direct'
    WHEN source ILIKE '%facebook%' THEN 'facebook'
    WHEN source ILIKE '%instagram%' THEN 'instagram'
    ELSE 'whatsapp_direct'
END
WHERE primary_source = 'whatsapp_direct' AND source IS NOT NULL AND source != 'WA Direct';

-- ============================================================================
-- 2. CREATE FACEBOOK PAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS facebook_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Facebook Page Information
    page_id VARCHAR(255) NOT NULL UNIQUE,
    page_name VARCHAR(255),
    page_category VARCHAR(100),
    page_access_token_encrypted TEXT,
    page_access_token_iv VARCHAR(255),
    page_access_token_tag VARCHAR(255),
    
    -- Integration Status
    webhook_subscribed BOOLEAN DEFAULT false,
    webhook_subscription_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    
    -- Permissions & Capabilities
    permissions JSONB DEFAULT '[]'::jsonb,
    lead_ads_enabled BOOLEAN DEFAULT false,
    instagram_connected BOOLEAN DEFAULT false,
    instagram_account_id VARCHAR(255),
    
    -- Metadata
    last_token_refresh TIMESTAMP WITH TIME ZONE,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE LEAD SOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Source Information
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('facebook', 'instagram', 'whatsapp_direct', 'referral', 'website')),
    source_platform VARCHAR(50), -- 'facebook_lead_ads', 'instagram_lead_ads', 'whatsapp_business'
    
    -- Facebook/Instagram Specific Data
    page_id VARCHAR(255),
    form_id VARCHAR(255),
    ad_id VARCHAR(255),
    campaign_id VARCHAR(255),
    adset_id VARCHAR(255),
    leadgen_id VARCHAR(255), -- Facebook's unique lead ID
    
    -- Campaign Attribution Data
    campaign_data JSONB DEFAULT '{}'::jsonb,
    utm_parameters JSONB DEFAULT '{}'::jsonb,
    
    -- Lead Quality Metrics
    lead_score INTEGER DEFAULT 0,
    source_quality VARCHAR(20) DEFAULT 'unknown' CHECK (source_quality IN ('high', 'medium', 'low', 'unknown')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE LEAD DEDUPLICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_deduplication (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Lead Identification
    primary_lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    duplicate_lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Deduplication Logic
    match_type VARCHAR(50) NOT NULL CHECK (match_type IN ('phone_exact', 'email_exact', 'phone_email_combo', 'name_phone_fuzzy')),
    confidence_score DECIMAL(3,2) DEFAULT 0.00 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    
    -- Resolution Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'ignored', 'false_positive')),
    resolved_by VARCHAR(50), -- 'system', 'manual', 'agent'
    resolution_notes TEXT,
    
    -- Metadata
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Enhanced leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_primary_source ON leads(primary_source);
CREATE INDEX IF NOT EXISTS idx_leads_lead_temperature ON leads(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_check_hash ON leads(duplicate_check_hash);
CREATE INDEX IF NOT EXISTS idx_leads_is_merged ON leads(is_merged);
CREATE INDEX IF NOT EXISTS idx_leads_source_details_gin ON leads USING GIN (source_details);
CREATE INDEX IF NOT EXISTS idx_leads_merged_from_lead_ids_gin ON leads USING GIN (merged_from_lead_ids);

-- Facebook pages indexes
CREATE INDEX IF NOT EXISTS idx_facebook_pages_agent_id ON facebook_pages(agent_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_page_id ON facebook_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_status ON facebook_pages(status);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_permissions_gin ON facebook_pages USING GIN (permissions);

-- Lead sources indexes
CREATE INDEX IF NOT EXISTS idx_lead_sources_lead_id ON lead_sources(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_source_type ON lead_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_lead_sources_page_id ON lead_sources(page_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_leadgen_id ON lead_sources(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_campaign_data_gin ON lead_sources USING GIN (campaign_data);
CREATE INDEX IF NOT EXISTS idx_lead_sources_utm_parameters_gin ON lead_sources USING GIN (utm_parameters);

-- Lead deduplication indexes
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_primary_lead ON lead_deduplication(primary_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_duplicate_lead ON lead_deduplication(duplicate_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_deduplication_status ON lead_deduplication(status);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '=== Facebook/Instagram Lead Integration Schema Migration Completed Successfully ===';
    RAISE NOTICE 'New tables created: facebook_pages, lead_sources, lead_deduplication';
    RAISE NOTICE 'Enhanced leads table with attribution and deduplication support';
    RAISE NOTICE 'Added performance indexes and utility functions';
    RAISE NOTICE 'Migration completed at: %', NOW();
END $$;
