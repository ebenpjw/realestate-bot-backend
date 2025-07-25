-- WABA Health Monitoring Database Schema
-- Supports comprehensive health tracking for multi-tenant WABA infrastructure

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- WABA Health Monitoring Table
-- Stores all health check data, quality ratings, and user status validations
CREATE TABLE IF NOT EXISTS waba_health_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(255) NOT NULL, -- Gupshup app ID
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- Link to agent (optional, can be populated via app_id lookup)
    check_type VARCHAR(50) NOT NULL, -- 'health_check', 'quality_rating', 'user_status'
    check_data JSONB NOT NULL, -- Complete API response data
    status VARCHAR(20) NOT NULL, -- 'healthy', 'unhealthy', 'degraded', 'error'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexing for performance
    CONSTRAINT valid_check_type CHECK (check_type IN ('health_check', 'quality_rating', 'user_status')),
    CONSTRAINT valid_status CHECK (status IN ('healthy', 'unhealthy', 'degraded', 'error'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_waba_health_app_id ON waba_health_monitoring(app_id);
CREATE INDEX IF NOT EXISTS idx_waba_health_agent_id ON waba_health_monitoring(agent_id);
CREATE INDEX IF NOT EXISTS idx_waba_health_check_type ON waba_health_monitoring(check_type);
CREATE INDEX IF NOT EXISTS idx_waba_health_timestamp ON waba_health_monitoring(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waba_health_status ON waba_health_monitoring(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_waba_health_app_type_time ON waba_health_monitoring(app_id, check_type, timestamp DESC);

-- WABA Health Summary View (Agent-Isolated)
-- Provides latest health status for each agent with strict isolation
CREATE OR REPLACE VIEW waba_health_summary AS
WITH latest_checks AS (
    SELECT DISTINCT ON (agent_id, check_type)
        agent_id,
        app_id,
        check_type,
        check_data,
        status,
        timestamp
    FROM waba_health_monitoring
    WHERE agent_id IS NOT NULL
    ORDER BY agent_id, check_type, timestamp DESC
)
SELECT
    a.id as agent_id,
    a.full_name as agent_name,
    a.gupshup_app_id as app_id,
    a.waba_phone_number,

    -- Health check data
    hc.status as health_status,
    hc.check_data->>'healthy' as is_healthy,
    hc.timestamp as last_health_check,

    -- Quality rating data
    qr.status as rating_status,
    qr.check_data->>'currentLimit' as messaging_tier,
    qr.check_data->>'event' as last_event,
    qr.check_data->>'eventTime' as last_event_time,
    qr.timestamp as last_rating_check,

    -- Overall status calculation
    CASE
        WHEN hc.status = 'error' OR qr.status = 'error' THEN 'error'
        WHEN hc.status = 'unhealthy' THEN 'unhealthy'
        WHEN hc.status = 'degraded' OR qr.status = 'degraded' THEN 'degraded'
        WHEN hc.status = 'healthy' AND qr.status = 'healthy' THEN 'healthy'
        ELSE 'unknown'
    END as overall_status,

    NOW() as summary_generated_at

FROM agents a
LEFT JOIN latest_checks hc ON a.id = hc.agent_id AND hc.check_type = 'health_check'
LEFT JOIN latest_checks qr ON a.id = qr.agent_id AND qr.check_type = 'quality_rating'
WHERE a.status = 'active' AND a.gupshup_app_id IS NOT NULL;

-- WABA Health Analytics View
-- Provides health trends and analytics data
CREATE OR REPLACE VIEW waba_health_analytics AS
SELECT 
    app_id,
    check_type,
    status,
    DATE(timestamp) as check_date,
    COUNT(*) as check_count,
    
    -- Success rate calculation
    ROUND(
        (COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded')) * 100.0) / COUNT(*), 
        2
    ) as success_rate_percent,
    
    -- Average response time (if available in check_data)
    AVG(CAST(check_data->>'responseTime' AS INTEGER)) as avg_response_time_ms,
    
    MIN(timestamp) as first_check_time,
    MAX(timestamp) as last_check_time
    
FROM waba_health_monitoring
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY app_id, check_type, status, DATE(timestamp)
ORDER BY app_id, check_type, check_date DESC;

-- Function to get agent health status
CREATE OR REPLACE FUNCTION get_agent_health_status(agent_uuid UUID)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    app_id TEXT,
    overall_status TEXT,
    health_status TEXT,
    rating_status TEXT,
    messaging_tier TEXT,
    last_health_check TIMESTAMP WITH TIME ZONE,
    last_rating_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        whs.agent_id,
        whs.agent_name,
        whs.app_id,
        whs.overall_status,
        whs.health_status,
        whs.rating_status,
        whs.messaging_tier,
        whs.last_health_check,
        whs.last_rating_check
    FROM waba_health_summary whs
    WHERE whs.agent_id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old health monitoring data (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM waba_health_monitoring 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled cleanup job (requires pg_cron extension)
-- This is optional and should be run manually if pg_cron is not available
-- SELECT cron.schedule('cleanup-health-data', '0 2 * * 0', 'SELECT cleanup_old_health_data();');

-- Grant permissions to application user (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON waba_health_monitoring TO your_app_user;
-- GRANT SELECT ON waba_health_summary TO your_app_user;
-- GRANT SELECT ON waba_health_analytics TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_agent_health_status(UUID) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_health_data() TO your_app_user;

-- Sample queries for testing:

-- Get latest health status for all agents
-- SELECT * FROM waba_health_summary ORDER BY agent_name;

-- Get health analytics for the last 7 days
-- SELECT * FROM waba_health_analytics WHERE check_date >= CURRENT_DATE - INTERVAL '7 days';

-- Get specific agent health status
-- SELECT * FROM get_agent_health_status('your-agent-uuid-here');

-- Manual cleanup of old data
-- SELECT cleanup_old_health_data();

COMMENT ON TABLE waba_health_monitoring IS 'Stores comprehensive WABA health monitoring data including health checks, quality ratings, and user status validations';
COMMENT ON VIEW waba_health_summary IS 'Provides latest health status summary for all active agents with WABA configuration';
COMMENT ON VIEW waba_health_analytics IS 'Provides health trends and analytics data for the last 30 days';
COMMENT ON FUNCTION get_agent_health_status(UUID) IS 'Returns comprehensive health status for a specific agent';
COMMENT ON FUNCTION cleanup_old_health_data() IS 'Removes health monitoring data older than 90 days to maintain database performance';
