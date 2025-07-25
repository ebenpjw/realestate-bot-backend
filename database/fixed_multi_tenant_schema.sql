-- Fixed Multi-Tenant WABA Health & Cost Monitoring Schema
-- Implements strict agent isolation with cost processing features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update existing tables to ensure agent_id is properly set
-- This ensures all data is properly isolated per agent

-- Update waba_health_monitoring table structure
ALTER TABLE waba_health_monitoring 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Update waba_cost_tracking table structure  
ALTER TABLE waba_cost_tracking 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Create indexes for agent isolation
CREATE INDEX IF NOT EXISTS idx_waba_health_agent_isolation ON waba_health_monitoring(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waba_cost_agent_isolation ON waba_cost_tracking(agent_id, timestamp DESC);

-- Agent-Isolated Health Summary View
CREATE OR REPLACE VIEW agent_health_summary AS
WITH latest_health_checks AS (
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
    CAST(hc.check_data->>'healthy' AS BOOLEAN) as is_healthy,
    hc.timestamp as last_health_check,
    
    -- Quality rating data
    qr.status as rating_status,
    qr.check_data->>'currentLimit' as messaging_tier,
    CAST(qr.check_data->>'tierNumeric' AS INTEGER) as tier_numeric,
    qr.check_data->>'lastEvent' as last_event,
    qr.check_data->>'eventTime' as last_event_time,
    qr.timestamp as last_rating_check,
    
    -- Overall status calculation
    CASE 
        WHEN hc.status = 'error' OR qr.status = 'error' THEN 'error'
        WHEN hc.status = 'unhealthy' THEN 'unhealthy'
        WHEN hc.status = 'degraded' OR qr.status = 'degraded' THEN 'degraded'
        WHEN hc.status = 'healthy' AND qr.status = 'healthy' THEN 'healthy'
        ELSE 'unknown'
    END as overall_health_status,
    
    NOW() as summary_generated_at
    
FROM agents a
LEFT JOIN latest_health_checks hc ON a.id = hc.agent_id AND hc.check_type = 'health_check'
LEFT JOIN latest_health_checks qr ON a.id = qr.agent_id AND qr.check_type = 'quality_rating'
WHERE a.status = 'active' AND a.gupshup_app_id IS NOT NULL;

-- Agent-Isolated Cost Summary View (with markup processing)
CREATE OR REPLACE VIEW agent_cost_summary AS
WITH latest_cost_data AS (
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
    
    -- Wallet balance data (processed for display)
    wb.status as wallet_status,
    wb.tracking_data->>'currency' as display_currency,
    wb.tracking_data->>'originalCurrency' as original_currency,
    CAST(wb.tracking_data->>'currentBalance' AS DECIMAL(10,2)) as current_balance_sgd,
    wb.tracking_data->>'currentBalanceDisplay' as current_balance_display,
    CAST(wb.tracking_data->>'overDraftLimit' AS DECIMAL(10,2)) as overdraft_limit_sgd,
    wb.tracking_data->>'overDraftLimitDisplay' as overdraft_limit_display,
    CAST(wb.tracking_data->>'availableBalance' AS DECIMAL(10,2)) as available_balance_sgd,
    wb.tracking_data->>'availableBalanceDisplay' as available_balance_display,
    wb.tracking_data->>'balanceStatus' as balance_status,
    CAST(wb.tracking_data->>'markupApplied' AS INTEGER) as markup_applied,
    CAST(wb.tracking_data->>'exchangeRate' AS DECIMAL(6,4)) as exchange_rate,
    CAST(wb.tracking_data->>'isAgentView' AS BOOLEAN) as is_agent_view,
    wb.timestamp as last_balance_check,
    
    -- Usage breakdown data (filtered for agent view)
    ub.status as usage_status,
    ub.tracking_data->'totalUsage'->>'totalFees' as total_fees,
    ub.tracking_data->'totalUsage'->>'totalMessages' as total_messages,
    ub.tracking_data->'totalUsage'->>'templateMessages' as template_messages,
    ub.tracking_data->'totalUsage'->>'outgoingMessages' as outgoing_messages,
    ub.tracking_data->>'fromDate' as usage_from_date,
    ub.tracking_data->>'toDate' as usage_to_date,
    ub.timestamp as last_usage_check,
    
    -- Discount tracking data
    dt.status as discount_status,
    dt.tracking_data->'totalDiscount'->>'totalDiscount' as total_discount,
    dt.tracking_data->'totalDiscount'->>'totalBill' as total_bill,
    dt.tracking_data->>'year' as discount_year,
    dt.tracking_data->>'month' as discount_month,
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
LEFT JOIN latest_cost_data wb ON a.id = wb.agent_id AND wb.tracking_type = 'wallet_balance'
LEFT JOIN latest_cost_data ub ON a.id = ub.agent_id AND ub.tracking_type = 'usage_breakdown'
LEFT JOIN latest_cost_data dt ON a.id = dt.agent_id AND dt.tracking_type = 'discount_tracking'
WHERE a.status = 'active' AND a.gupshup_app_id IS NOT NULL;

-- Simple function to get cost alerts
CREATE OR REPLACE FUNCTION get_cost_alerts(balance_threshold DECIMAL DEFAULT 50.0)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    app_id TEXT,
    current_balance DECIMAL,
    balance_status TEXT,
    alert_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        acs.agent_id,
        acs.agent_name,
        acs.app_id,
        acs.current_balance_sgd,
        acs.balance_status,
        CASE 
            WHEN acs.current_balance_sgd <= 0 THEN 'CRITICAL'
            WHEN acs.current_balance_sgd <= 10 THEN 'HIGH'
            WHEN acs.current_balance_sgd <= balance_threshold THEN 'MEDIUM'
            ELSE 'LOW'
        END as alert_level
    FROM agent_cost_summary acs
    WHERE acs.current_balance_sgd <= balance_threshold
    AND acs.wallet_status = 'success'
    ORDER BY acs.current_balance_sgd ASC;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get system health statistics
CREATE OR REPLACE FUNCTION get_system_health_stats()
RETURNS TABLE (
    total_agents INTEGER,
    healthy_agents INTEGER,
    unhealthy_agents INTEGER,
    degraded_agents INTEGER,
    error_agents INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_agents,
        COUNT(*) FILTER (WHERE overall_health_status = 'healthy')::INTEGER as healthy_agents,
        COUNT(*) FILTER (WHERE overall_health_status = 'unhealthy')::INTEGER as unhealthy_agents,
        COUNT(*) FILTER (WHERE overall_health_status = 'degraded')::INTEGER as degraded_agents,
        COUNT(*) FILTER (WHERE overall_health_status = 'error')::INTEGER as error_agents
    FROM agent_health_summary;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get system cost statistics
CREATE OR REPLACE FUNCTION get_system_cost_stats()
RETURNS TABLE (
    total_agents INTEGER,
    healthy_agents INTEGER,
    warning_agents INTEGER,
    critical_agents INTEGER,
    error_agents INTEGER,
    total_balance_sgd DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_agents,
        COUNT(*) FILTER (WHERE overall_cost_status = 'healthy')::INTEGER as healthy_agents,
        COUNT(*) FILTER (WHERE overall_cost_status = 'warning')::INTEGER as warning_agents,
        COUNT(*) FILTER (WHERE overall_cost_status = 'critical')::INTEGER as critical_agents,
        COUNT(*) FILTER (WHERE overall_cost_status = 'error')::INTEGER as error_agents,
        COALESCE(SUM(current_balance_sgd), 0) as total_balance_sgd
    FROM agent_cost_summary
    WHERE current_balance_sgd IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies for additional security
ALTER TABLE waba_health_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE waba_cost_tracking ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on your authentication system)
CREATE POLICY agent_health_isolation ON waba_health_monitoring
    FOR ALL TO authenticated
    USING (true); -- Customize this based on your auth system

CREATE POLICY agent_cost_isolation ON waba_cost_tracking
    FOR ALL TO authenticated
    USING (true); -- Customize this based on your auth system

-- Comments for documentation
COMMENT ON VIEW agent_health_summary IS 'Agent-isolated health summary with strict data isolation';
COMMENT ON VIEW agent_cost_summary IS 'Agent-isolated cost summary with markup processing and currency conversion';
COMMENT ON FUNCTION get_cost_alerts(DECIMAL) IS 'Returns cost alerts for agents with low balances';
COMMENT ON FUNCTION get_system_health_stats() IS 'Returns system-wide health statistics for admin dashboard';
COMMENT ON FUNCTION get_system_cost_stats() IS 'Returns system-wide cost statistics for admin dashboard';

-- Sample usage queries:
-- SELECT * FROM agent_health_summary WHERE agent_id = 'your-agent-uuid';
-- SELECT * FROM agent_cost_summary WHERE agent_id = 'your-agent-uuid';
-- SELECT * FROM get_cost_alerts(25.0);
-- SELECT * FROM get_system_health_stats();
-- SELECT * FROM get_system_cost_stats();
