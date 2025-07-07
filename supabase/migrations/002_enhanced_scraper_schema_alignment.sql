-- ============================================================================
-- ENHANCED SCRAPER SCHEMA ALIGNMENT MIGRATION
-- Version: 002
-- Date: 2025-07-07
-- Purpose: Align database schema with enhanced property scraper output
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENHANCE PROPERTY_PROJECTS TABLE
-- Add missing fields from enhanced scraper output
-- ============================================================================

-- Add new columns for enhanced property data
ALTER TABLE property_projects 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS units_count INTEGER,
ADD COLUMN IF NOT EXISTS blocks_info VARCHAR(255),
ADD COLUMN IF NOT EXISTS size_range_sqft VARCHAR(100),
ADD COLUMN IF NOT EXISTS price_range_raw TEXT,
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}'::jsonb;

-- Update existing columns to match scraper output
ALTER TABLE property_projects 
ALTER COLUMN developer SET DEFAULT 'Unknown Developer',
ALTER COLUMN property_type DROP DEFAULT,
ALTER COLUMN tenure DROP DEFAULT;

-- Add check constraints for new data
ALTER TABLE property_projects 
ADD CONSTRAINT IF NOT EXISTS chk_property_type_enhanced 
CHECK (property_type IN (
    'Private Condo', 'Mixed', 'Executive Condo', 'Landed House', 'Business Space',
    'Residential Lowrise', 'Residential Highrise', 'Commercial', 'Industrial'
));

ALTER TABLE property_projects 
ADD CONSTRAINT IF NOT EXISTS chk_tenure_enhanced 
CHECK (tenure IN (
    'Freehold', '999 Years', '99 Years', '60 Years', 'Leasehold'
));

-- ============================================================================
-- 2. CREATE ENHANCED UNIT MIX TABLE
-- Store detailed unit availability, pricing, and size data
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_unit_mix (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    
    -- UNIT TYPE INFORMATION
    unit_type VARCHAR(100) NOT NULL, -- e.g., "1 BEDROOM", "PENTHOUSE"
    
    -- SIZE INFORMATION
    size_range_raw VARCHAR(100), -- e.g., "495 - 785"
    size_min_sqft INTEGER,
    size_max_sqft INTEGER,
    size_unit VARCHAR(10) DEFAULT 'sqft',
    
    -- PRICING INFORMATION  
    price_range_raw VARCHAR(100), -- e.g., "$1.43M - $1.85M"
    price_min DECIMAL(12, 2),
    price_max DECIMAL(12, 2),
    price_currency VARCHAR(10) DEFAULT 'SGD',
    
    -- AVAILABILITY INFORMATION
    availability_raw VARCHAR(50), -- e.g., "8 / 28"
    units_available INTEGER,
    units_total INTEGER,
    availability_percentage INTEGER,
    
    -- METADATA
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. ENHANCE VISUAL_ASSETS TABLE
-- Add fields for enhanced floor plan data and AI analysis integration
-- ============================================================================

-- Add new columns for enhanced floor plan metadata
ALTER TABLE visual_assets 
ADD COLUMN IF NOT EXISTS bedroom_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS bedroom_count INTEGER,
ADD COLUMN IF NOT EXISTS image_width INTEGER,
ADD COLUMN IF NOT EXISTS image_height INTEGER,
ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS source_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}'::jsonb;

-- Update asset_type constraint to include new types
ALTER TABLE visual_assets DROP CONSTRAINT IF EXISTS visual_assets_asset_type_check;
ALTER TABLE visual_assets 
ADD CONSTRAINT visual_assets_asset_type_check 
CHECK (asset_type IN (
    'floor_plan', 'brochure', 'site_plan', 'facility_image', 
    'exterior_image', 'interior_image', 'unit_layout', 'property_image'
));

-- ============================================================================
-- 4. ENHANCE AI_VISUAL_ANALYSIS TABLE  
-- Add fields for comprehensive floor plan AI analysis
-- ============================================================================

-- Add new columns for enhanced AI analysis
ALTER TABLE ai_visual_analysis 
ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
ADD COLUMN IF NOT EXISTS bathrooms INTEGER,
ADD COLUMN IF NOT EXISTS study_room BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS helper_room BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS balcony BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS patio BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS yard BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS penthouse_features BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kitchen_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS living_areas INTEGER,
ADD COLUMN IF NOT EXISTS storage_rooms INTEGER,
ADD COLUMN IF NOT EXISTS size_sqft INTEGER,
ADD COLUMN IF NOT EXISTS size_sqm INTEGER,
ADD COLUMN IF NOT EXISTS special_features TEXT[],
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50) DEFAULT 'gpt-4.1';

-- Update analysis_type constraint
ALTER TABLE ai_visual_analysis DROP CONSTRAINT IF EXISTS ai_visual_analysis_analysis_type_check;
ALTER TABLE ai_visual_analysis 
ADD CONSTRAINT ai_visual_analysis_analysis_type_check 
CHECK (analysis_type IN (
    'floor_plan_analysis', 'brochure_text_extraction', 'facility_identification', 
    'layout_description', 'comprehensive_floor_plan_analysis'
));

-- ============================================================================
-- 5. CREATE SCRAPING_PROGRESS TABLE
-- Track pagination progress and resume capability
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_progress (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- PROGRESS TRACKING
    current_page INTEGER DEFAULT 1,
    total_pages INTEGER,
    completed_pages INTEGER[] DEFAULT '{}',
    
    -- STATISTICS
    total_properties_scraped INTEGER DEFAULT 0,
    new_properties_added INTEGER DEFAULT 0,
    properties_updated INTEGER DEFAULT 0,
    duplicates_skipped INTEGER DEFAULT 0,
    
    -- SESSION INFO
    last_successful_property VARCHAR(255),
    session_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'webhook'
    
    -- ERROR TRACKING
    errors JSONB DEFAULT '[]'::jsonb,
    
    -- TIMESTAMPS
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 6. CREATE ENHANCED INDEXES FOR PERFORMANCE
-- ============================================================================

-- Property projects indexes
CREATE INDEX IF NOT EXISTS idx_property_projects_district ON property_projects(district);
CREATE INDEX IF NOT EXISTS idx_property_projects_property_type ON property_projects(property_type);
CREATE INDEX IF NOT EXISTS idx_property_projects_tenure ON property_projects(tenure);
CREATE INDEX IF NOT EXISTS idx_property_projects_scraped_at ON property_projects(scraped_at);
CREATE INDEX IF NOT EXISTS idx_property_projects_extracted_data ON property_projects USING gin(extracted_data);

-- Unit mix indexes
CREATE INDEX IF NOT EXISTS idx_unit_mix_project_id ON property_unit_mix(project_id);
CREATE INDEX IF NOT EXISTS idx_unit_mix_unit_type ON property_unit_mix(unit_type);
CREATE INDEX IF NOT EXISTS idx_unit_mix_price_range ON property_unit_mix(price_min, price_max);
CREATE INDEX IF NOT EXISTS idx_unit_mix_availability ON property_unit_mix(units_available, units_total);

-- Enhanced visual assets indexes
CREATE INDEX IF NOT EXISTS idx_visual_assets_bedroom_type ON visual_assets(bedroom_type);
CREATE INDEX IF NOT EXISTS idx_visual_assets_bedroom_count ON visual_assets(bedroom_count);
CREATE INDEX IF NOT EXISTS idx_visual_assets_extraction_metadata ON visual_assets USING gin(extraction_metadata);

-- Enhanced AI analysis indexes
CREATE INDEX IF NOT EXISTS idx_ai_analysis_bedrooms ON ai_visual_analysis(bedrooms);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_features ON ai_visual_analysis USING gin(special_features);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_tags ON ai_visual_analysis USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_size ON ai_visual_analysis(size_sqft);

-- Scraping progress indexes
CREATE INDEX IF NOT EXISTS idx_scraping_progress_session ON scraping_progress(session_type, started_at);
CREATE INDEX IF NOT EXISTS idx_scraping_progress_current_page ON scraping_progress(current_page);

-- ============================================================================
-- 7. CREATE ENHANCED VIEWS FOR EASY QUERYING
-- ============================================================================

-- Enhanced project summary with unit mix data
CREATE OR REPLACE VIEW enhanced_project_summary AS
SELECT 
    pp.*,
    COUNT(DISTINCT va.id) as total_visual_assets,
    COUNT(DISTINCT CASE WHEN va.asset_type = 'floor_plan' THEN va.id END) as floor_plans_count,
    COUNT(DISTINCT pum.id) as unit_mix_types,
    MIN(pum.price_min) as min_unit_price,
    MAX(pum.price_max) as max_unit_price,
    SUM(pum.units_available) as total_units_available,
    SUM(pum.units_total) as total_units_in_project,
    ROUND(AVG(pum.availability_percentage), 2) as avg_availability_percentage
FROM property_projects pp
LEFT JOIN visual_assets va ON pp.id = va.project_id
LEFT JOIN property_unit_mix pum ON pp.id = pum.project_id
GROUP BY pp.id;

-- Enhanced AI analysis summary with new features
CREATE OR REPLACE VIEW enhanced_ai_analysis_summary AS
SELECT 
    pp.project_name,
    pp.district,
    COUNT(DISTINCT ava.id) as total_analyses,
    AVG(ava.confidence_score) as avg_confidence,
    COUNT(DISTINCT CASE WHEN ava.bedrooms IS NOT NULL THEN ava.id END) as bedroom_analyses,
    STRING_AGG(DISTINCT ava.layout_type, ', ') as layout_types_found,
    COUNT(DISTINCT CASE WHEN ava.study_room = TRUE THEN ava.id END) as units_with_study,
    COUNT(DISTINCT CASE WHEN ava.helper_room = TRUE THEN ava.id END) as units_with_helper_room,
    COUNT(DISTINCT CASE WHEN ava.balcony = TRUE THEN ava.id END) as units_with_balcony,
    COUNT(DISTINCT CASE WHEN ava.penthouse_features = TRUE THEN ava.id END) as penthouse_units
FROM property_projects pp
JOIN visual_assets va ON pp.id = va.project_id
JOIN ai_visual_analysis ava ON va.id = ava.visual_asset_id
GROUP BY pp.id, pp.project_name, pp.district;

-- ============================================================================
-- 8. UPDATE TRIGGERS FOR AUTOMATIC TIMESTAMP MANAGEMENT
-- ============================================================================

-- Update existing trigger function to handle new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to new tables
CREATE TRIGGER update_property_unit_mix_updated_at 
    BEFORE UPDATE ON property_unit_mix 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraping_progress_updated_at 
    BEFORE UPDATE ON scraping_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. MIGRATION COMPLETION LOG
-- ============================================================================

-- Log migration completion
INSERT INTO scraping_progress (
    session_type,
    total_properties_scraped,
    started_at,
    completed_at
) VALUES (
    'schema_migration',
    0,
    NOW(),
    NOW()
);

-- ============================================================================
-- MIGRATION COMPLETE
-- Schema is now aligned with enhanced scraper output format
-- ============================================================================
