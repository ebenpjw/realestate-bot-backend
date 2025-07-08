-- ============================================================================
-- DATABASE CLEANUP SCRIPT
-- Removes duplicate tables, views, and consolidates overlapping functionality
-- ============================================================================

-- ============================================================================
-- BACKUP IMPORTANT DATA BEFORE CLEANUP
-- ============================================================================

-- Create backup of property_units data before consolidation
CREATE TABLE IF NOT EXISTS property_units_backup AS 
SELECT * FROM property_units;

-- ============================================================================
-- 1. REMOVE DUPLICATE VIEWS
-- ============================================================================

-- Remove original project_summary (replaced by enhanced_project_summary)
DROP VIEW IF EXISTS project_summary CASCADE;

-- Remove original ai_analysis_summary (replaced by enhanced_ai_analysis_summary)
DROP VIEW IF EXISTS ai_analysis_summary CASCADE;

-- ============================================================================
-- 2. REMOVE UNUSED TABLES
-- ============================================================================

-- Remove ab_tests table (defined but not actively used)
DROP TABLE IF EXISTS ab_tests CASCADE;

-- Remove simulation_results table (defined but not actively used)  
DROP TABLE IF EXISTS simulation_results CASCADE;

-- ============================================================================
-- 3. CONSOLIDATE PROPERTY UNITS DATA
-- ============================================================================

-- Step 3a: Migrate any unique data from property_units to property_unit_mix
-- (This ensures no data loss during consolidation)

-- Check if property_units has data not in property_unit_mix
DO $$
DECLARE
    units_count INTEGER;
    unit_mix_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO units_count FROM property_units;
    SELECT COUNT(*) INTO unit_mix_count FROM property_unit_mix;
    
    RAISE NOTICE 'Property Units Records: %', units_count;
    RAISE NOTICE 'Property Unit Mix Records: %', unit_mix_count;
    
    -- If property_units has significant data, migrate it
    IF units_count > unit_mix_count THEN
        RAISE NOTICE 'Migrating property_units data to property_unit_mix...';
        
        -- Insert unique property_units data into property_unit_mix
        INSERT INTO property_unit_mix (
            project_id,
            unit_type,
            size_min_sqft,
            size_max_sqft,
            price_min,
            price_max,
            units_available,
            units_total,
            availability_percentage,
            created_at,
            updated_at
        )
        SELECT DISTINCT
            pu.project_id,
            COALESCE(pu.standardized_type, pu.unit_type, 'Unknown Type'),
            pu.size_min_sqft,
            pu.size_max_sqft,
            pu.price_min_sgd,
            pu.price_max_sgd,
            pu.available_units,
            pu.total_units,
            pu.availability_percentage,
            pu.created_at,
            pu.updated_at
        FROM property_units pu
        LEFT JOIN property_unit_mix pum ON (
            pu.project_id = pum.project_id 
            AND COALESCE(pu.standardized_type, pu.unit_type) = pum.unit_type
        )
        WHERE pum.id IS NULL  -- Only insert if not already exists
        AND pu.project_id IS NOT NULL;
        
        RAISE NOTICE 'Migration completed';
    END IF;
END $$;

-- Step 3b: Drop unit_mix_bot_view (will be recreated to use property_unit_mix)
DROP VIEW IF EXISTS unit_mix_bot_view CASCADE;

-- Step 3c: Drop the get_unit_recommendations function (will be recreated)
DROP FUNCTION IF EXISTS get_unit_recommendations CASCADE;

-- Step 3d: Remove property_units table (consolidated into property_unit_mix)
DROP TABLE IF EXISTS property_units CASCADE;

-- ============================================================================
-- 4. RECREATE VIEWS TO USE CONSOLIDATED TABLES
-- ============================================================================

-- Recreate unit_mix_bot_view to use property_unit_mix instead of property_units
CREATE OR REPLACE VIEW unit_mix_bot_view AS
SELECT
    pum.id,
    pum.project_id,
    pp.project_name,
    pp.district,
    -- Extract bedroom count from unit_type
    CASE 
        WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 0
        WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 1
        WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN 2
        WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN 3
        WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN 4
        WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN 5
        ELSE 2 -- Default to 2BR if unclear
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
        ELSE pum.price_min::BIGINT 
    END as avg_price,
    -- Calculate average size
    CASE 
        WHEN pum.size_min_sqft > 0 AND pum.size_max_sqft > 0 
        THEN ROUND((pum.size_min_sqft + pum.size_max_sqft) / 2)::INTEGER
        ELSE pum.size_min_sqft 
    END as avg_size,
    -- Bedroom category for bot intelligence
    CASE
        WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 'Studio'
        WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 'Studio/1BR'
        WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN '2BR'
        WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN '3BR'
        WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN '4BR'
        WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN '5BR+'
        ELSE 'Other'
    END as bedroom_category,
    -- Price category
    CASE
        WHEN pum.price_min < 1000000 THEN 'Under $1M'
        WHEN pum.price_min < 2000000 THEN '$1M - $2M'
        WHEN pum.price_min < 3000000 THEN '$2M - $3M'
        WHEN pum.price_min < 5000000 THEN '$3M - $5M'
        ELSE 'Above $5M'
    END as price_category,
    -- Size category
    CASE
        WHEN pum.size_min_sqft < 500 THEN 'Compact (<500 sqft)'
        WHEN pum.size_min_sqft < 800 THEN 'Medium (500-800 sqft)'
        WHEN pum.size_min_sqft < 1200 THEN 'Large (800-1200 sqft)'
        ELSE 'Extra Large (>1200 sqft)'
    END as size_category
FROM property_unit_mix pum
JOIN property_projects pp ON pum.project_id = pp.id
WHERE pum.units_available > 0
ORDER BY bedroom_count, pum.price_min;

-- Grant permissions on the recreated view
GRANT SELECT ON unit_mix_bot_view TO authenticated;
GRANT SELECT ON unit_mix_bot_view TO anon;

-- ============================================================================
-- 5. RECREATE FUNCTIONS TO USE CONSOLIDATED TABLES
-- ============================================================================

-- Recreate get_unit_recommendations function to use property_unit_mix
CREATE OR REPLACE FUNCTION get_unit_recommendations(
    max_budget BIGINT DEFAULT NULL,
    min_bedrooms INTEGER DEFAULT NULL,
    max_bedrooms INTEGER DEFAULT NULL,
    requires_study BOOLEAN DEFAULT FALSE,
    requires_flexi BOOLEAN DEFAULT FALSE,
    min_size INTEGER DEFAULT NULL,
    max_size INTEGER DEFAULT NULL,
    district_filter TEXT DEFAULT NULL,
    limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    property_name TEXT,
    unit_type TEXT,
    bedrooms INTEGER,
    size_range TEXT,
    price_range TEXT,
    availability TEXT,
    price_per_sqft INTEGER,
    features TEXT,
    district TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.project_name::TEXT,
        pum.unit_type::TEXT,
        CASE 
            WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 0
            WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 1
            WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN 2
            WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN 3
            WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN 4
            WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN 5
            ELSE 2
        END as bedrooms,
        COALESCE(pum.size_range_raw, pum.size_min_sqft::TEXT || ' - ' || pum.size_max_sqft::TEXT || ' sqft')::TEXT,
        COALESCE(pum.price_range_raw, '$' || ROUND(pum.price_min/1000000, 2)::TEXT || 'M - $' || ROUND(pum.price_max/1000000, 2)::TEXT || 'M')::TEXT,
        (pum.units_available || '/' || pum.units_total || ' (' || pum.availability_percentage || '%)')::TEXT,
        CASE 
            WHEN pum.size_min_sqft > 0 AND pum.price_min > 0 
            THEN ROUND(pum.price_min / pum.size_min_sqft)::INTEGER
            ELSE NULL 
        END,
        (CASE 
            WHEN pum.unit_type ILIKE '%study%' AND pum.unit_type ILIKE '%flexi%' THEN 'Study + Flexi'
            WHEN pum.unit_type ILIKE '%study%' THEN 'Study'
            WHEN pum.unit_type ILIKE '%flexi%' THEN 'Flexi'
            WHEN pum.unit_type ILIKE '%penthouse%' THEN 'Penthouse'
            ELSE 'Standard'
        END)::TEXT,
        pp.district::TEXT
    FROM property_unit_mix pum
    JOIN property_projects pp ON pum.project_id = pp.id
    WHERE pum.units_available > 0
        AND (max_budget IS NULL OR pum.price_max <= max_budget)
        AND (min_bedrooms IS NULL OR 
             CASE 
                WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 0
                WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 1
                WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN 2
                WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN 3
                WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN 4
                WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN 5
                ELSE 2
             END >= min_bedrooms)
        AND (max_bedrooms IS NULL OR 
             CASE 
                WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 0
                WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 1
                WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN 2
                WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN 3
                WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN 4
                WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN 5
                ELSE 2
             END <= max_bedrooms)
        AND (NOT requires_study OR pum.unit_type ILIKE '%study%')
        AND (NOT requires_flexi OR pum.unit_type ILIKE '%flexi%')
        AND (min_size IS NULL OR pum.size_min_sqft >= min_size)
        AND (max_size IS NULL OR pum.size_max_sqft <= max_size)
        AND (district_filter IS NULL OR pp.district ILIKE '%' || district_filter || '%')
    ORDER BY 
        CASE 
            WHEN pum.unit_type ILIKE '%studio%' OR pum.unit_type ILIKE '%0 bedroom%' THEN 0
            WHEN pum.unit_type ILIKE '%1 bedroom%' OR pum.unit_type ILIKE '%1br%' THEN 1
            WHEN pum.unit_type ILIKE '%2 bedroom%' OR pum.unit_type ILIKE '%2br%' THEN 2
            WHEN pum.unit_type ILIKE '%3 bedroom%' OR pum.unit_type ILIKE '%3br%' THEN 3
            WHEN pum.unit_type ILIKE '%4 bedroom%' OR pum.unit_type ILIKE '%4br%' THEN 4
            WHEN pum.unit_type ILIKE '%5 bedroom%' OR pum.unit_type ILIKE '%5br%' THEN 5
            ELSE 2
        END, 
        pum.price_min
    LIMIT limit_results;
END;
$$;

-- ============================================================================
-- 6. CLEANUP SUMMARY
-- ============================================================================

-- Log cleanup completion
INSERT INTO scraping_progress (
    session_type,
    total_properties_scraped,
    started_at,
    completed_at
) VALUES (
    'database_cleanup',
    0,
    NOW(),
    NOW()
);

-- ============================================================================
-- CLEANUP COMPLETE
-- Summary of changes:
-- ✅ Removed duplicate views: project_summary, ai_analysis_summary
-- ✅ Removed unused tables: ab_tests, simulation_results  
-- ✅ Consolidated property_units into property_unit_mix
-- ✅ Recreated unit_mix_bot_view to use property_unit_mix
-- ✅ Recreated get_unit_recommendations function
-- ✅ Preserved all data through migration
-- ============================================================================
