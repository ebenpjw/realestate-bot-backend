-- WABA Cost Tracking Database Schema
-- Supports comprehensive cost monitoring for multi-tenant WABA infrastructure

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- WABA Cost Tracking Table
-- Stores all cost monitoring data from Gupshup Partner API
CREATE TABLE IF NOT EXISTS waba_cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(255) NOT NULL, -- Gupshup app ID
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- Link to agent (optional, can be populated via app_id lookup)
    tracking_type VARCHAR(50) NOT NULL, -- 'wallet_balance', 'usage_breakdown', 'discount_tracking'
    tracking_data JSONB NOT NULL, -- Complete API response data
    status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success', 'error'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexing for performance
    CONSTRAINT valid_tracking_type CHECK (tracking_type IN ('wallet_balance', 'usage_breakdown', 'discount_tracking')),
    CONSTRAINT valid_status CHECK (status IN ('success', 'error'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_waba_cost_app_id ON waba_cost_tracking(app_id);
CREATE INDEX IF NOT EXISTS idx_waba_cost_agent_id ON waba_cost_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_waba_cost_tracking_type ON waba_cost_tracking(tracking_type);
CREATE INDEX IF NOT EXISTS idx_waba_cost_timestamp ON waba_cost_tracking(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waba_cost_status ON waba_cost_tracking(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_waba_cost_app_type_time ON waba_cost_tracking(app_id, tracking_type, timestamp DESC);

-- WABA Cost Summary View (Agent-Isolated)
-- Provides latest cost status for each agent with strict isolation
CREATE OR REPLACE VIEW waba_cost_summary AS
WITH latest_costs AS (
    SELECT DISTINCT ON (agent_id, tracking_type)
        agent_id,
        app_id,
        tracking_type,
        tracking_data,
        status,
        timestamp
    FROM waba_cost_tracking
    WHERE agent_id IS NOT NULL
    ORDER BY agent_id, tracking_type, timestamp DESC
)
SELECT
    a.id as agent_id,
    a.full_name as agent_name,
    a.gupshup_app_id as app_id,
    a.waba_phone_number,

    -- Wallet balance data (in SGD with markup for agent view)
    wb.status as wallet_status,
    wb.tracking_data->>'currency' as currency,
    CAST(wb.tracking_data->>'currentBalance' AS DECIMAL(10,2)) as current_balance,
    wb.tracking_data->>'currentBalanceDisplay' as current_balance_display,
    CAST(wb.tracking_data->>'overDraftLimit' AS DECIMAL(10,2)) as overdraft_limit,
    wb.tracking_data->>'overDraftLimitDisplay' as overdraft_limit_display,
    CAST(wb.tracking_data->>'availableBalance' AS DECIMAL(10,2)) as available_balance,
    wb.tracking_data->>'availableBalanceDisplay' as available_balance_display,
    wb.tracking_data->>'balanceStatus' as balance_status,
    CAST(wb.tracking_data->>'markupApplied' AS INTEGER) as markup_applied,
    CAST(wb.tracking_data->>'exchangeRate' AS DECIMAL(6,4)) as exchange_rate,
    wb.timestamp as last_balance_check,

    -- Usage breakdown data (filtered for agent view)
    ub.status as usage_status,
    ub.tracking_data->'totalUsage'->>'totalFees' as total_fees,
    ub.tracking_data->'totalUsage'->>'totalMessages' as total_messages,
    ub.tracking_data->>'fromDate' as usage_from_date,
    ub.tracking_data->>'toDate' as usage_to_date,
    CAST(ub.tracking_data->>'isAgentView' AS BOOLEAN) as usage_is_agent_view,
    ub.timestamp as last_usage_check,

    -- Discount tracking data (processed for agent view)
    dt.status as discount_status,
    dt.tracking_data->'totalDiscount'->>'totalDiscount' as total_discount,
    dt.tracking_data->'totalDiscount'->>'totalBill' as total_bill,
    dt.tracking_data->>'year' as discount_year,
    dt.tracking_data->>'month' as discount_month,
    CAST(dt.tracking_data->>'isAgentView' AS BOOLEAN) as discount_is_agent_view,
    dt.timestamp as last_discount_check,

    -- Overall cost health calculation
    CASE
        WHEN wb.status = 'error' OR ub.status = 'error' OR dt.status = 'error' THEN 'error'
        WHEN wb.tracking_data->>'balanceStatus' = 'critical' THEN 'critical'
        WHEN wb.tracking_data->>'balanceStatus' IN ('low', 'warning') THEN 'warning'
        ELSE 'healthy'
    END as overall_cost_status,

    NOW() as summary_generated_at

FROM agents a
LEFT JOIN latest_costs wb ON a.id = wb.agent_id AND wb.tracking_type = 'wallet_balance'
LEFT JOIN latest_costs ub ON a.id = ub.agent_id AND ub.tracking_type = 'usage_breakdown'
LEFT JOIN latest_costs dt ON a.id = dt.agent_id AND dt.tracking_type = 'discount_tracking'
WHERE a.status = 'active' AND a.gupshup_app_id IS NOT NULL;

-- WABA Cost Analytics View
-- Provides cost trends and analytics data
CREATE OR REPLACE VIEW waba_cost_analytics AS
SELECT 
    app_id,
    tracking_type,
    status,
    DATE(timestamp) as tracking_date,
    COUNT(*) as tracking_count,
    
    -- Success rate calculation
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'success') * 100.0) / COUNT(*), 
        2
    ) as success_rate_percent,
    
    -- Balance analytics (for wallet_balance type)
    AVG(CAST(tracking_data->>'currentBalance' AS DECIMAL)) FILTER (WHERE tracking_type = 'wallet_balance') as avg_balance,
    MIN(CAST(tracking_data->>'currentBalance' AS DECIMAL)) FILTER (WHERE tracking_type = 'wallet_balance') as min_balance,
    MAX(CAST(tracking_data->>'currentBalance' AS DECIMAL)) FILTER (WHERE tracking_type = 'wallet_balance') as max_balance,
    
    -- Usage analytics (for usage_breakdown type)
    AVG(CAST(tracking_data->'totalUsage'->>'totalFees' AS DECIMAL)) FILTER (WHERE tracking_type = 'usage_breakdown') as avg_daily_fees,
    AVG(CAST(tracking_data->'totalUsage'->>'totalMessages' AS DECIMAL)) FILTER (WHERE tracking_type = 'usage_breakdown') as avg_daily_messages,
    
    -- Discount analytics (for discount_tracking type)
    AVG(CAST(tracking_data->'totalDiscount'->>'totalDiscount' AS DECIMAL)) FILTER (WHERE tracking_type = 'discount_tracking') as avg_monthly_discount,
    
    MIN(timestamp) as first_tracking_time,
    MAX(timestamp) as last_tracking_time
    
FROM waba_cost_tracking
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY app_id, tracking_type, status, DATE(timestamp)
ORDER BY app_id, tracking_type, tracking_date DESC;

-- Function to get agent cost status
CREATE OR REPLACE FUNCTION get_agent_cost_status(agent_uuid UUID)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    app_id TEXT,
    overall_cost_status TEXT,
    current_balance DECIMAL,
    balance_status TEXT,
    total_fees TEXT,
    total_messages TEXT,
    last_balance_check TIMESTAMP WITH TIME ZONE,
    last_usage_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wcs.agent_id,
        wcs.agent_name,
        wcs.app_id,
        wcs.overall_cost_status,
        wcs.current_balance,
        wcs.balance_status,
        wcs.total_fees,
        wcs.total_messages,
        wcs.last_balance_check,
        wcs.last_usage_check
    FROM waba_cost_summary wcs
    WHERE wcs.agent_id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get cost alerts for low balances
CREATE OR REPLACE FUNCTION get_cost_alerts(balance_threshold DECIMAL DEFAULT 50.0)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    app_id TEXT,
    current_balance DECIMAL,
    balance_status TEXT,
    alert_level TEXT,
    last_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wcs.agent_id,
        wcs.agent_name,
        wcs.app_id,
        wcs.current_balance,
        wcs.balance_status,
        CASE 
            WHEN wcs.current_balance <= 0 THEN 'CRITICAL'
            WHEN wcs.current_balance <= 10 THEN 'HIGH'
            WHEN wcs.current_balance <= balance_threshold THEN 'MEDIUM'
            ELSE 'LOW'
        END as alert_level,
        wcs.last_balance_check
    FROM waba_cost_summary wcs
    WHERE wcs.current_balance <= balance_threshold
    AND wcs.wallet_status = 'success'
    ORDER BY wcs.current_balance ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old cost tracking data (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_cost_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM waba_cost_tracking 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage trends for an agent
CREATE OR REPLACE FUNCTION get_agent_usage_trends(
    agent_uuid UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    tracking_date DATE,
    total_fees DECIMAL,
    total_messages INTEGER,
    balance DECIMAL,
    discount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_data AS (
        SELECT 
            DATE(wct.timestamp) as tracking_date,
            wct.tracking_type,
            wct.tracking_data
        FROM waba_cost_tracking wct
        JOIN agents a ON a.gupshup_app_id = wct.app_id
        WHERE a.id = agent_uuid
        AND wct.timestamp >= NOW() - INTERVAL '1 day' * days_back
        AND wct.status = 'success'
    )
    SELECT 
        dd.tracking_date,
        COALESCE(
            AVG(CAST(dd.tracking_data->'totalUsage'->>'totalFees' AS DECIMAL)) 
            FILTER (WHERE dd.tracking_type = 'usage_breakdown'), 
            0
        ) as total_fees,
        COALESCE(
            AVG(CAST(dd.tracking_data->'totalUsage'->>'totalMessages' AS INTEGER)) 
            FILTER (WHERE dd.tracking_type = 'usage_breakdown'), 
            0
        ) as total_messages,
        COALESCE(
            AVG(CAST(dd.tracking_data->>'currentBalance' AS DECIMAL)) 
            FILTER (WHERE dd.tracking_type = 'wallet_balance'), 
            0
        ) as balance,
        COALESCE(
            AVG(CAST(dd.tracking_data->'totalDiscount'->>'totalDiscount' AS DECIMAL)) 
            FILTER (WHERE dd.tracking_type = 'discount_tracking'), 
            0
        ) as discount
    FROM daily_data dd
    GROUP BY dd.tracking_date
    ORDER BY dd.tracking_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled cleanup job (requires pg_cron extension)
-- This is optional and should be run manually if pg_cron is not available
-- SELECT cron.schedule('cleanup-cost-data', '0 3 * * 0', 'SELECT cleanup_old_cost_data();');

-- Grant permissions to application user (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON waba_cost_tracking TO your_app_user;
-- GRANT SELECT ON waba_cost_summary TO your_app_user;
-- GRANT SELECT ON waba_cost_analytics TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_agent_cost_status(UUID) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_cost_alerts(DECIMAL) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_agent_usage_trends(UUID, INTEGER) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_cost_data() TO your_app_user;

-- Sample queries for testing:

-- Get latest cost status for all agents
-- SELECT * FROM waba_cost_summary ORDER BY agent_name;

-- Get cost analytics for the last 7 days
-- SELECT * FROM waba_cost_analytics WHERE tracking_date >= CURRENT_DATE - INTERVAL '7 days';

-- Get specific agent cost status
-- SELECT * FROM get_agent_cost_status('your-agent-uuid-here');

-- Get cost alerts for balances below $25
-- SELECT * FROM get_cost_alerts(25.0);

-- Get usage trends for an agent over last 14 days
-- SELECT * FROM get_agent_usage_trends('your-agent-uuid-here', 14);

-- Manual cleanup of old data
-- SELECT cleanup_old_cost_data();

COMMENT ON TABLE waba_cost_tracking IS 'Stores comprehensive WABA cost monitoring data from Gupshup Partner API including wallet balances, usage breakdowns, and discount tracking';
COMMENT ON VIEW waba_cost_summary IS 'Provides latest cost status summary for all active agents with WABA configuration';
COMMENT ON VIEW waba_cost_analytics IS 'Provides cost trends and analytics data for the last 30 days';
COMMENT ON FUNCTION get_agent_cost_status(UUID) IS 'Returns comprehensive cost status for a specific agent';
COMMENT ON FUNCTION get_cost_alerts(DECIMAL) IS 'Returns agents with wallet balances below the specified threshold';
COMMENT ON FUNCTION get_agent_usage_trends(UUID, INTEGER) IS 'Returns usage trends for a specific agent over the specified number of days';
COMMENT ON FUNCTION cleanup_old_cost_data() IS 'Removes cost tracking data older than 90 days to maintain database performance';
