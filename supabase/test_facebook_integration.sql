-- ============================================================================
-- FACEBOOK LEAD INTEGRATION - TEST SCRIPT
-- Real Estate Bot Backend - July 2025
-- ============================================================================
-- 
-- This script tests the Facebook lead integration functionality
-- Run this after executing the migration script
-- 
-- ============================================================================

-- Test 1: Verify new tables exist
SELECT 'Testing table existence...' as test_step;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('facebook_pages', 'lead_sources', 'lead_deduplication') THEN '✅ NEW TABLE'
        WHEN table_name = 'leads' THEN '✅ ENHANCED TABLE'
        ELSE '✅ EXISTING TABLE'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('leads', 'agents', 'facebook_pages', 'lead_sources', 'lead_deduplication')
ORDER BY table_name;

-- Test 2: Verify new columns in leads table
SELECT 'Testing leads table enhancements...' as test_step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
    AND column_name IN (
        'primary_source', 'source_details', 'lead_quality_score', 
        'first_contact_method', 'lead_temperature', 'conversion_probability',
        'is_merged', 'merged_from_lead_ids', 'duplicate_check_hash'
    )
ORDER BY column_name;

-- Test 3: Test duplicate hash generation function
SELECT 'Testing duplicate hash generation...' as test_step;

SELECT 
    generate_duplicate_check_hash('+6591234567', 'John Doe', 'john@example.com') as hash_with_email,
    generate_duplicate_check_hash('+6591234567', 'John Doe', NULL) as hash_without_email,
    generate_duplicate_check_hash('+6591234567', NULL, NULL) as hash_phone_only;

-- Test 4: Test views
SELECT 'Testing database views...' as test_step;

-- Test leads_with_sources view
SELECT 'leads_with_sources view' as view_name, COUNT(*) as record_count
FROM leads_with_sources;

-- Test agent_facebook_summary view
SELECT 'agent_facebook_summary view' as view_name, COUNT(*) as record_count
FROM agent_facebook_summary;

-- Test 5: Insert test data and verify functionality
SELECT 'Testing with sample data...' as test_step;

-- Insert a test agent if none exists
INSERT INTO agents (full_name, email, phone_number, status)
SELECT 'Test Agent', 'test@example.com', '+6591234567', 'active'
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'test@example.com');

-- Get the test agent ID
DO $$
DECLARE
    test_agent_id UUID;
    test_lead_id UUID;
    test_page_id VARCHAR(255) := 'test_page_123';
BEGIN
    -- Get test agent ID
    SELECT id INTO test_agent_id FROM agents WHERE email = 'test@example.com' LIMIT 1;
    
    IF test_agent_id IS NOT NULL THEN
        -- Insert test Facebook page
        INSERT INTO facebook_pages (
            agent_id, page_id, page_name, status, lead_ads_enabled
        ) VALUES (
            test_agent_id, test_page_id, 'Test Facebook Page', 'active', true
        ) ON CONFLICT (page_id) DO NOTHING;
        
        -- Insert test lead
        INSERT INTO leads (
            phone_number, full_name, primary_source, assigned_agent_id,
            lead_temperature, first_contact_method
        ) VALUES (
            '+6598765432', 'Test Lead User', 'facebook', test_agent_id,
            'warm', 'facebook_lead_ads'
        ) ON CONFLICT (phone_number) DO NOTHING;
        
        -- Get test lead ID
        SELECT id INTO test_lead_id FROM leads WHERE phone_number = '+6598765432' LIMIT 1;
        
        IF test_lead_id IS NOT NULL THEN
            -- Insert test lead source
            INSERT INTO lead_sources (
                lead_id, source_type, source_platform, page_id,
                form_id, leadgen_id, lead_score, source_quality
            ) VALUES (
                test_lead_id, 'facebook', 'facebook_lead_ads', test_page_id,
                'test_form_123', 'test_leadgen_456', 75, 'medium'
            );
            
            RAISE NOTICE 'Test data inserted successfully';
            RAISE NOTICE 'Agent ID: %', test_agent_id;
            RAISE NOTICE 'Lead ID: %', test_lead_id;
        END IF;
    END IF;
END $$;

-- Test 6: Verify test data and relationships
SELECT 'Verifying test data relationships...' as test_step;

SELECT 
    l.phone_number,
    l.full_name,
    l.primary_source,
    l.lead_temperature,
    l.duplicate_check_hash,
    a.full_name as agent_name,
    ls.source_type,
    ls.source_platform,
    fp.page_name
FROM leads l
JOIN agents a ON l.assigned_agent_id = a.id
LEFT JOIN lead_sources ls ON l.id = ls.lead_id
LEFT JOIN facebook_pages fp ON ls.page_id = fp.page_id
WHERE l.phone_number = '+6598765432';

-- Test 7: Test duplicate detection
SELECT 'Testing duplicate detection...' as test_step;

-- This should find the test lead as a potential duplicate
SELECT 
    phone_number,
    full_name,
    duplicate_check_hash,
    primary_source
FROM leads 
WHERE duplicate_check_hash = generate_duplicate_check_hash('+6598765432', 'Test Lead User');

-- Test 8: Test views with data
SELECT 'Testing views with sample data...' as test_step;

-- Test leads_with_sources view with actual data
SELECT 
    phone_number,
    full_name,
    primary_source,
    source_type,
    source_platform,
    page_name,
    source_quality
FROM leads_with_sources 
WHERE phone_number = '+6598765432';

-- Test agent_facebook_summary view
SELECT 
    agent_name,
    connected_pages,
    active_pages,
    lead_ads_enabled_pages
FROM agent_facebook_summary
WHERE agent_name = 'Test Agent';

-- Test 9: Performance check - verify indexes exist
SELECT 'Checking performance indexes...' as test_step;

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('leads', 'facebook_pages', 'lead_sources', 'lead_deduplication')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Test 10: Clean up test data (optional)
-- Uncomment the following section if you want to clean up test data

/*
SELECT 'Cleaning up test data...' as test_step;

DELETE FROM lead_sources WHERE leadgen_id = 'test_leadgen_456';
DELETE FROM leads WHERE phone_number = '+6598765432';
DELETE FROM facebook_pages WHERE page_id = 'test_page_123';
DELETE FROM agents WHERE email = 'test@example.com';

SELECT 'Test data cleaned up' as cleanup_status;
*/

-- ============================================================================
-- TEST COMPLETE
-- ============================================================================

SELECT 
    '🎉 Facebook Lead Integration Test Complete!' as status,
    NOW() as completed_at;
