-- ============================================================================
-- VISUAL PROPERTY DATA COLLECTION SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Purpose: Extend existing real estate bot database to support visual property data
-- Features: Floor plans, brochures, property images, AI analysis results
-- Integration: Works with existing leads/messages/agents tables
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROPERTY PROJECTS TABLE (Master property data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_projects (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name VARCHAR(255) NOT NULL,
    developer VARCHAR(255),
    
    -- LOCATION DATA
    address TEXT,
    district VARCHAR(10),
    postal_code VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- PROJECT DETAILS
    property_type VARCHAR(50) CHECK (property_type IN (
        'Private Condo', 'Mixed', 'Executive Condo', 'Landed House', 'Business Space'
    )),
    tenure VARCHAR(50) CHECK (tenure IN (
        'Freehold', '999 Years', '99 Years', '60 Years'
    )),
    total_units INTEGER,
    
    -- PRICING & AVAILABILITY
    price_range_min DECIMAL(12, 2),
    price_range_max DECIMAL(12, 2),
    sales_status VARCHAR(20) DEFAULT 'Available' CHECK (sales_status IN (
        'Available', 'Sold out', 'Coming Soon'
    )),
    
    -- TIMELINE
    launch_date DATE,
    top_date DATE,
    completion_status VARCHAR(20) DEFAULT 'BUC' CHECK (completion_status IN (
        'BUC', 'TOP soon', 'Completed'
    )),
    
    -- DATA SOURCE & TRACKING
    source_url TEXT,
    last_scraped TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scraping_status VARCHAR(20) DEFAULT 'pending' CHECK (scraping_status IN (
        'pending', 'in_progress', 'completed', 'failed', 'needs_retry'
    )),
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. PROPERTY UNITS TABLE (Individual units within projects)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_units (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    unit_type VARCHAR(100), -- e.g., "2 Bedroom", "3 Bedroom + Study"
    
    -- UNIT SPECIFICATIONS
    bedrooms INTEGER,
    bathrooms INTEGER,
    study_room BOOLEAN DEFAULT FALSE,
    balcony BOOLEAN DEFAULT FALSE,
    
    -- SIZE & PRICING
    size_sqft INTEGER,
    size_sqm DECIMAL(8, 2),
    price_psf DECIMAL(10, 2),
    unit_price DECIMAL(12, 2),
    
    -- AVAILABILITY
    available_units INTEGER DEFAULT 0,
    total_units_of_type INTEGER DEFAULT 0,
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. VISUAL ASSETS TABLE (Floor plans, brochures, images)
-- ============================================================================
CREATE TABLE IF NOT EXISTS visual_assets (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES property_units(id) ON DELETE CASCADE, -- NULL for project-level assets
    
    -- ASSET DETAILS
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN (
        'floor_plan', 'brochure', 'site_plan', 'facility_image', 'exterior_image', 'interior_image'
    )),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    
    -- STORAGE INFORMATION
    storage_bucket VARCHAR(100) DEFAULT 'property-assets',
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    public_url TEXT, -- Public URL for access
    
    -- PROCESSING STATUS
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'completed', 'failed'
    )),
    
    -- METADATA
    original_url TEXT, -- Source URL where asset was found
    alt_text TEXT,
    description TEXT,
    
    -- TIMESTAMPS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. AI ANALYSIS RESULTS TABLE (GPT-4 Vision analysis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_visual_analysis (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_asset_id UUID REFERENCES visual_assets(id) ON DELETE CASCADE,
    
    -- ANALYSIS METADATA
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN (
        'floor_plan_analysis', 'brochure_text_extraction', 'facility_identification', 'layout_description'
    )),
    ai_model VARCHAR(50) DEFAULT 'gpt-4-vision-preview',
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- EXTRACTED DATA (JSONB for flexibility)
    extracted_data JSONB DEFAULT '{}'::jsonb,
    
    -- SPECIFIC ANALYSIS RESULTS
    room_count INTEGER,
    layout_type VARCHAR(100), -- e.g., "Open concept", "Traditional", "Split level"
    square_footage INTEGER,
    key_features TEXT[], -- Array of key features identified
    
    -- NATURAL LANGUAGE DESCRIPTION
    description TEXT,
    summary TEXT,
    
    -- PROCESSING INFO
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. PROPERTY SEARCH INDEX TABLE (For intelligent matching)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_search_index (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES property_projects(id) ON DELETE CASCADE,
    
    -- SEARCHABLE CONTENT
    search_vector tsvector, -- Full-text search vector
    keywords TEXT[], -- Extracted keywords for matching
    
    -- CATEGORIZED FEATURES
    amenities TEXT[], -- Pool, Gym, Playground, etc.
    nearby_schools TEXT[], -- School names within radius
    nearby_mrt TEXT[], -- MRT stations within radius
    nearby_shopping TEXT[], -- Shopping centers within radius
    
    -- INTELLIGENT MATCHING DATA
    family_friendly_score DECIMAL(3, 2), -- 0.00 to 1.00
    investment_potential_score DECIMAL(3, 2), -- 0.00 to 1.00
    luxury_score DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- METADATA
    last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. SCRAPING SESSIONS TABLE (Track scraping operations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_sessions (
    -- PRIMARY IDENTIFIERS
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_type VARCHAR(50) DEFAULT 'full_scrape' CHECK (session_type IN (
        'full_scrape', 'incremental_update', 'retry_failed', 'manual_trigger'
    )),
    
    -- SESSION STATUS
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN (
        'running', 'completed', 'failed', 'cancelled'
    )),
    
    -- STATISTICS
    projects_processed INTEGER DEFAULT 0,
    projects_updated INTEGER DEFAULT 0,
    assets_downloaded INTEGER DEFAULT 0,
    assets_analyzed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    
    -- TIMING
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- ERROR TRACKING
    error_log JSONB DEFAULT '[]'::jsonb,
    
    -- METADATA
    triggered_by VARCHAR(50) DEFAULT 'system', -- 'system', 'manual', 'schedule'
    user_agent TEXT,
    ip_address INET
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Property Projects Indexes
CREATE INDEX IF NOT EXISTS idx_property_projects_district ON property_projects(district);
CREATE INDEX IF NOT EXISTS idx_property_projects_property_type ON property_projects(property_type);
CREATE INDEX IF NOT EXISTS idx_property_projects_sales_status ON property_projects(sales_status);
CREATE INDEX IF NOT EXISTS idx_property_projects_top_date ON property_projects(top_date);
CREATE INDEX IF NOT EXISTS idx_property_projects_scraping_status ON property_projects(scraping_status);
CREATE INDEX IF NOT EXISTS idx_property_projects_location ON property_projects(latitude, longitude);

-- Property Units Indexes
CREATE INDEX IF NOT EXISTS idx_property_units_project_id ON property_units(project_id);
CREATE INDEX IF NOT EXISTS idx_property_units_bedrooms ON property_units(bedrooms);
CREATE INDEX IF NOT EXISTS idx_property_units_size_sqft ON property_units(size_sqft);
CREATE INDEX IF NOT EXISTS idx_property_units_price_psf ON property_units(price_psf);

-- Visual Assets Indexes
CREATE INDEX IF NOT EXISTS idx_visual_assets_project_id ON visual_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_unit_id ON visual_assets(unit_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_type ON visual_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_visual_assets_processing_status ON visual_assets(processing_status);

-- AI Analysis Indexes
CREATE INDEX IF NOT EXISTS idx_ai_analysis_asset_id ON ai_visual_analysis(visual_asset_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_visual_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_confidence ON ai_visual_analysis(confidence_score);

-- Search Index
CREATE INDEX IF NOT EXISTS idx_property_search_vector ON property_search_index USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_property_search_keywords ON property_search_index USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_property_search_amenities ON property_search_index USING gin(amenities);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_property_projects_updated_at BEFORE UPDATE ON property_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_property_units_updated_at BEFORE UPDATE ON property_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visual_assets_updated_at BEFORE UPDATE ON visual_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA VIEWS FOR EASY QUERYING
-- ============================================================================

-- Complete project view with visual assets count
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    pp.*,
    COUNT(DISTINCT va.id) as total_visual_assets,
    COUNT(DISTINCT CASE WHEN va.asset_type = 'floor_plan' THEN va.id END) as floor_plans_count,
    COUNT(DISTINCT CASE WHEN va.asset_type = 'brochure' THEN va.id END) as brochures_count,
    COUNT(DISTINCT pu.id) as unit_types_count,
    MIN(pu.unit_price) as min_unit_price,
    MAX(pu.unit_price) as max_unit_price
FROM property_projects pp
LEFT JOIN visual_assets va ON pp.id = va.project_id
LEFT JOIN property_units pu ON pp.id = pu.project_id
GROUP BY pp.id;

-- AI analysis summary view
CREATE OR REPLACE VIEW ai_analysis_summary AS
SELECT 
    pp.project_name,
    pp.district,
    COUNT(DISTINCT ava.id) as total_analyses,
    AVG(ava.confidence_score) as avg_confidence,
    COUNT(DISTINCT CASE WHEN ava.analysis_type = 'floor_plan_analysis' THEN ava.id END) as floor_plan_analyses,
    STRING_AGG(DISTINCT ava.layout_type, ', ') as layout_types_found
FROM property_projects pp
JOIN visual_assets va ON pp.id = va.project_id
JOIN ai_visual_analysis ava ON va.id = ava.visual_asset_id
GROUP BY pp.id, pp.project_name, pp.district;
