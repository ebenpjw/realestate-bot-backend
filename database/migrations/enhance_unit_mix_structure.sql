-- Enhanced Unit Mix Structure Migration
-- This migration enhances the existing property_units table for intelligent bot recommendations

-- ============================================================================
-- 1. ENHANCE PROPERTY_UNITS TABLE (This is our unit mix table)
-- Add intelligent fields for bot recommendations
-- ============================================================================

ALTER TABLE property_units
-- Unit Classification (for bot intelligence)
ADD COLUMN IF NOT EXISTS bedroom_count INTEGER,
ADD COLUMN IF NOT EXISTS standardized_type TEXT,
ADD COLUMN IF NOT EXISTS has_study BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_flexi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_penthouse BOOLEAN DEFAULT FALSE,

-- Size information (structured for ranges)
ADD COLUMN IF NOT EXISTS size_min_sqft INTEGER,
ADD COLUMN IF NOT EXISTS size_max_sqft INTEGER,
ADD COLUMN IF NOT EXISTS size_range_text TEXT,

-- Price information (in SGD for bot calculations)
ADD COLUMN IF NOT EXISTS price_min_sgd BIGINT,
ADD COLUMN IF NOT EXISTS price_max_sgd BIGINT,
ADD COLUMN IF NOT EXISTS price_range_text TEXT,

-- Availability information (structured)
ADD COLUMN IF NOT EXISTS available_units INTEGER,
ADD COLUMN IF NOT EXISTS total_units INTEGER,
ADD COLUMN IF NOT EXISTS availability_percentage INTEGER,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT FALSE,

-- Calculated fields for bot intelligence
ADD COLUMN IF NOT EXISTS price_per_sqft INTEGER,
ADD COLUMN IF NOT EXISTS avg_price BIGINT,
ADD COLUMN IF NOT EXISTS avg_size INTEGER,

-- Original raw data (keep for reference)
ADD COLUMN IF NOT EXISTS raw_type TEXT,
ADD COLUMN IF NOT EXISTS raw_size TEXT,
ADD COLUMN IF NOT EXISTS raw_price TEXT,
ADD COLUMN IF NOT EXISTS raw_availability TEXT;

-- ============================================================================
-- 2. ADD PERFORMANCE INDEXES
-- Optimize queries for bot recommendations
-- ============================================================================

-- Add indexes for better query performance on bot recommendation fields
CREATE INDEX IF NOT EXISTS idx_property_units_bedroom_count ON property_units(bedroom_count);
CREATE INDEX IF NOT EXISTS idx_property_units_price_range ON property_units(price_min_sgd, price_max_sgd);
CREATE INDEX IF NOT EXISTS idx_property_units_size_range ON property_units(size_min_sqft, size_max_sqft);
CREATE INDEX IF NOT EXISTS idx_property_units_availability ON property_units(is_available, availability_percentage);
CREATE INDEX IF NOT EXISTS idx_property_units_features ON property_units(has_study, has_flexi, is_penthouse);
CREATE INDEX IF NOT EXISTS idx_property_units_price_per_sqft ON property_units(price_per_sqft);

-- Add composite indexes for common bot queries
CREATE INDEX IF NOT EXISTS idx_property_units_bot_search ON property_units(bedroom_count, price_min_sgd, price_max_sgd, is_available);
CREATE INDEX IF NOT EXISTS idx_property_units_value_search ON property_units(price_per_sqft, is_available) WHERE price_per_sqft IS NOT NULL;

-- Update existing records to set is_available based on available_units
UPDATE property_units
SET is_available = (available_units > 0)
WHERE available_units IS NOT NULL;

-- ============================================================================
-- 3. ADD DOCUMENTATION COMMENTS
-- Document the new fields for future reference
-- ============================================================================

-- Add comments for documentation
COMMENT ON COLUMN property_units.bedroom_count IS 'Number of bedrooms (extracted from type)';
COMMENT ON COLUMN property_units.standardized_type IS 'Standardized unit type for bot understanding (e.g., "2 Bedroom + Study")';
COMMENT ON COLUMN property_units.has_study IS 'Whether unit includes a study room';
COMMENT ON COLUMN property_units.has_flexi IS 'Whether unit includes a flexi room';
COMMENT ON COLUMN property_units.is_penthouse IS 'Whether unit is a penthouse';
COMMENT ON COLUMN property_units.size_min_sqft IS 'Minimum size in square feet';
COMMENT ON COLUMN property_units.size_max_sqft IS 'Maximum size in square feet';
COMMENT ON COLUMN property_units.size_range_text IS 'Human-readable size range (e.g., "700 - 829 sqft")';
COMMENT ON COLUMN property_units.price_min_sgd IS 'Minimum price in Singapore Dollars';
COMMENT ON COLUMN property_units.price_max_sgd IS 'Maximum price in Singapore Dollars';
COMMENT ON COLUMN property_units.price_range_text IS 'Human-readable price range (e.g., "$1.95M - $2.04M")';
COMMENT ON COLUMN property_units.available_units IS 'Number of units currently available';
COMMENT ON COLUMN property_units.total_units IS 'Total number of units of this type';
COMMENT ON COLUMN property_units.availability_percentage IS 'Percentage of units available (available/total * 100)';
COMMENT ON COLUMN property_units.is_available IS 'Quick boolean check if any units are available';
COMMENT ON COLUMN property_units.price_per_sqft IS 'Price per square foot in SGD (for value comparison)';
COMMENT ON COLUMN property_units.avg_price IS 'Average price between min and max';
COMMENT ON COLUMN property_units.avg_size IS 'Average size between min and max';

-- ============================================================================
-- 4. CREATE BOT INTELLIGENCE VIEW
-- Optimized view for bot queries with categorized data
-- ============================================================================

-- Create a view for bot queries with commonly used fields
CREATE OR REPLACE VIEW unit_mix_bot_view AS
SELECT
    pu.id,
    pu.project_id,
    pp.project_name,
    pp.district,
    pu.bedroom_count,
    pu.standardized_type,
    pu.has_study,
    pu.has_flexi,
    pu.is_penthouse,
    pu.size_min_sqft,
    pu.size_max_sqft,
    pu.size_range_text,
    pu.price_min_sgd,
    pu.price_max_sgd,
    pu.price_range_text,
    pu.available_units,
    pu.total_units,
    pu.availability_percentage,
    pu.is_available,
    pu.price_per_sqft,
    pu.avg_price,
    pu.avg_size,
    -- Additional calculated fields for bot intelligence
    CASE
        WHEN pu.bedroom_count = 1 THEN 'Studio/1BR'
        WHEN pu.bedroom_count = 2 THEN '2BR'
        WHEN pu.bedroom_count = 3 THEN '3BR'
        WHEN pu.bedroom_count = 4 THEN '4BR'
        WHEN pu.bedroom_count >= 5 THEN '5BR+'
        ELSE 'Other'
    END as bedroom_category,
    CASE
        WHEN pu.price_min_sgd < 1000000 THEN 'Under $1M'
        WHEN pu.price_min_sgd < 2000000 THEN '$1M - $2M'
        WHEN pu.price_min_sgd < 3000000 THEN '$2M - $3M'
        WHEN pu.price_min_sgd < 5000000 THEN '$3M - $5M'
        ELSE 'Above $5M'
    END as price_category,
    CASE
        WHEN pu.size_min_sqft < 500 THEN 'Compact (<500 sqft)'
        WHEN pu.size_min_sqft < 800 THEN 'Medium (500-800 sqft)'
        WHEN pu.size_min_sqft < 1200 THEN 'Large (800-1200 sqft)'
        ELSE 'Extra Large (>1200 sqft)'
    END as size_category
FROM property_units pu
JOIN property_projects pp ON pu.project_id = pp.id
WHERE pu.is_available = true
ORDER BY pu.bedroom_count, pu.price_min_sgd;

-- Grant permissions on the view
GRANT SELECT ON unit_mix_bot_view TO authenticated;
GRANT SELECT ON unit_mix_bot_view TO anon;

-- Create a function for bot recommendations based on criteria
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
        p.project_name::TEXT,
        um.standardized_type::TEXT,
        um.bedroom_count,
        um.size_range_text::TEXT,
        um.price_range_text::TEXT,
        (um.available_units || '/' || um.total_units || ' (' || um.availability_percentage || '%)')::TEXT,
        um.price_per_sqft,
        (CASE 
            WHEN um.has_study AND um.has_flexi THEN 'Study + Flexi'
            WHEN um.has_study THEN 'Study'
            WHEN um.has_flexi THEN 'Flexi'
            WHEN um.is_penthouse THEN 'Penthouse'
            ELSE 'Standard'
        END)::TEXT,
        p.district::TEXT
    FROM unit_mix um
    JOIN properties p ON um.property_id = p.id
    WHERE um.is_available = true
        AND (max_budget IS NULL OR um.price_max_sgd <= max_budget)
        AND (min_bedrooms IS NULL OR um.bedroom_count >= min_bedrooms)
        AND (max_bedrooms IS NULL OR um.bedroom_count <= max_bedrooms)
        AND (NOT requires_study OR um.has_study = true)
        AND (NOT requires_flexi OR um.has_flexi = true)
        AND (min_size IS NULL OR um.size_min_sqft >= min_size)
        AND (max_size IS NULL OR um.size_max_sqft <= max_size)
        AND (district_filter IS NULL OR p.district ILIKE '%' || district_filter || '%')
    ORDER BY um.price_per_sqft ASC, um.availability_percentage DESC
    LIMIT limit_results;
END;
$$;

-- Example usage comments:
-- SELECT * FROM get_unit_recommendations(2000000, 2, 3, true, false, 700, 1000, 'District 10', 5);
-- This finds 2-3 bedroom units under $2M with study, 700-1000 sqft, in District 10

COMMIT;
