-- Performance Optimization Indexes
-- Created: July 4, 2025
-- Purpose: Improve query performance for booking, availability, and conversation operations

-- ============================================================================
-- JSONB INDEXES FOR FREQUENT QUERIES
-- ============================================================================

-- Index for booking alternatives queries (used in bot conversation logic)
CREATE INDEX IF NOT EXISTS idx_leads_booking_alternatives_gin 
ON leads USING GIN (booking_alternatives);

-- Index for agent working hours queries (used in availability checking)
CREATE INDEX IF NOT EXISTS idx_agents_working_hours_gin 
ON agents USING GIN (working_hours);

-- Index for conversation memory queries (used in AI context retrieval)
CREATE INDEX IF NOT EXISTS idx_conversation_memory_data_gin 
ON conversation_memory USING GIN (memory_data);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Agent availability queries (agent_id + appointment_time)
-- Used heavily in booking system for conflict checking
CREATE INDEX IF NOT EXISTS idx_appointments_agent_time 
ON appointments(agent_id, appointment_time);

-- Lead status and agent assignment queries
-- Used for agent workload distribution and lead filtering
CREATE INDEX IF NOT EXISTS idx_leads_status_agent 
ON leads(status, assigned_agent_id);

-- Message history with timestamp ordering
-- Used for conversation context retrieval
CREATE INDEX IF NOT EXISTS idx_messages_lead_created 
ON messages(lead_id, created_at DESC);

-- Template usage tracking by phone and date
-- Used for WABA compliance checking
CREATE INDEX IF NOT EXISTS idx_template_usage_phone_created 
ON template_usage_log(phone_number, created_at DESC);

-- ============================================================================
-- PARTIAL INDEXES FOR ACTIVE RECORDS ONLY
-- ============================================================================

-- Active agents only (reduces index size and improves performance)
CREATE INDEX IF NOT EXISTS idx_agents_active 
ON agents(id) WHERE status = 'active';

-- Scheduled appointments only (for availability checking)
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled 
ON appointments(appointment_time) WHERE status = 'scheduled';

-- Active leads only (for lead management queries)
CREATE INDEX IF NOT EXISTS idx_leads_active_status 
ON leads(assigned_agent_id, last_interaction) 
WHERE status NOT IN ('converted', 'lost');

-- ============================================================================
-- SPECIALIZED INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Phone number lookups with case-insensitive search
CREATE INDEX IF NOT EXISTS idx_leads_phone_lower 
ON leads(LOWER(phone_number));

-- Recent conversations (last 24 hours) for active engagement tracking
CREATE INDEX IF NOT EXISTS idx_messages_recent 
ON messages(created_at) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Upcoming appointments (next 7 days) for scheduling optimization
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming 
ON appointments(agent_id, appointment_time) 
WHERE appointment_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
AND status = 'scheduled';

-- ============================================================================
-- PERFORMANCE ANALYSIS QUERIES
-- ============================================================================

-- Use these queries to monitor index usage and performance:

/*
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes and index sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Identify slow queries (if pg_stat_statements is enabled)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%leads%' OR query LIKE '%appointments%' OR query LIKE '%messages%'
ORDER BY mean_time DESC
LIMIT 10;
*/

-- ============================================================================
-- INDEX MAINTENANCE NOTES
-- ============================================================================

/*
MAINTENANCE SCHEDULE:
- Weekly: Monitor index usage statistics
- Monthly: Check for unused indexes and consider removal
- Quarterly: Analyze query performance and add new indexes if needed

EXPECTED PERFORMANCE IMPROVEMENTS:
- Booking availability queries: 60-80% faster
- Conversation history retrieval: 40-60% faster  
- Agent workload queries: 50-70% faster
- JSONB searches: 70-90% faster

DISK SPACE IMPACT:
- Estimated additional space: 10-20% of current database size
- GIN indexes are larger but provide significant performance benefits
- Partial indexes minimize space usage for filtered queries

MONITORING:
- Use the performance analysis queries above to track improvements
- Monitor query execution plans with EXPLAIN ANALYZE
- Watch for index bloat and rebuild if necessary
*/
