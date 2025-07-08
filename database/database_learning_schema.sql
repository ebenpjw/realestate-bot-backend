-- ============================================================================
-- AI LEARNING SYSTEM DATABASE SCHEMA
-- Tracks conversation outcomes, strategy effectiveness, and enables continuous learning
-- ============================================================================

-- ============================================================================
-- 1. CONVERSATION OUTCOMES TABLE (Core Learning Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- OUTCOME CLASSIFICATION
    outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN (
        'appointment_booked', 'lead_lost', 'consultation_declined', 
        'still_nurturing', 'handoff_requested', 'unresponsive'
    )),
    outcome_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- STRATEGY TRACKING (What was used in this conversation)
    strategies_used JSONB DEFAULT '[]'::jsonb, -- Array of strategy names
    psychology_principles JSONB DEFAULT '[]'::jsonb, -- Array of psychology principles applied
    conversation_approach VARCHAR(100), -- Overall approach taken
    consultation_timing VARCHAR(50), -- When consultation was offered
    market_data_used BOOLEAN DEFAULT false,
    
    -- CONVERSATION METRICS
    total_messages INTEGER DEFAULT 0,
    conversation_duration_minutes INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    objections_encountered JSONB DEFAULT '[]'::jsonb,
    
    -- SUCCESS/FAILURE ANALYSIS
    success_factors JSONB DEFAULT '[]'::jsonb, -- What contributed to success
    failure_factors JSONB DEFAULT '[]'::jsonb, -- What led to failure
    
    -- LEAD CONTEXT (Snapshot at time of outcome)
    lead_profile JSONB NOT NULL, -- Intent, budget, timeline, source, etc.
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. STRATEGY PERFORMANCE TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- STRATEGY IDENTIFICATION
    strategy_name VARCHAR(100) NOT NULL,
    psychology_principle VARCHAR(50),
    lead_type VARCHAR(100), -- e.g., "own_stay_WA_Direct", "investment_Facebook"
    
    -- PERFORMANCE METRICS
    total_uses INTEGER DEFAULT 0,
    successful_outcomes INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0, -- Calculated field
    avg_engagement_score DECIMAL(5,2) DEFAULT 0,
    avg_messages_to_outcome DECIMAL(5,2) DEFAULT 0,
    avg_conversation_duration DECIMAL(5,2) DEFAULT 0,
    
    -- TIMING ANALYSIS
    optimal_timing VARCHAR(50), -- When this strategy works best
    timing_success_rate DECIMAL(5,4) DEFAULT 0,
    
    -- CONTEXT EFFECTIVENESS
    effective_contexts JSONB DEFAULT '[]'::jsonb, -- Journey stages, comfort levels where it works
    ineffective_contexts JSONB DEFAULT '[]'::jsonb, -- Where it doesn't work
    
    -- METADATA
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. STRATEGY OPTIMIZATIONS (Learning Results)
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategy_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- OPTIMIZATION METADATA
    optimization_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    optimization_type VARCHAR(50) DEFAULT 'automated', -- automated, manual, a_b_test
    
    -- ANALYSIS RESULTS
    analysis_results JSONB NOT NULL, -- Full analysis from aiLearningService
    recommendations JSONB NOT NULL, -- Generated recommendations
    
    -- PERFORMANCE METRICS AT TIME OF OPTIMIZATION
    performance_metrics JSONB NOT NULL,
    
    -- IMPLEMENTATION STATUS
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'implemented', 'testing', 'rejected'
    )),
    implementation_date TIMESTAMP WITH TIME ZONE,
    
    -- RESULTS TRACKING
    pre_optimization_success_rate DECIMAL(5,4),
    post_optimization_success_rate DECIMAL(5,4),
    improvement_percentage DECIMAL(5,2),
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. A/B TESTING FRAMEWORK
-- ============================================================================
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- TEST CONFIGURATION
    test_name VARCHAR(200) NOT NULL,
    test_description TEXT,
    test_type VARCHAR(50) DEFAULT 'strategy_comparison',
    
    -- TEST VARIANTS
    control_strategy JSONB NOT NULL, -- Original strategy configuration
    variant_strategy JSONB NOT NULL, -- New strategy being tested
    
    -- TEST PARAMETERS
    target_lead_types JSONB DEFAULT '[]'::jsonb, -- Which lead types to include
    sample_size_target INTEGER DEFAULT 100,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    
    -- TEST STATUS
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'cancelled'
    )),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- RESULTS
    control_conversions INTEGER DEFAULT 0,
    control_total INTEGER DEFAULT 0,
    variant_conversions INTEGER DEFAULT 0,
    variant_total INTEGER DEFAULT 0,
    statistical_significance DECIMAL(5,4),
    winner VARCHAR(20), -- 'control', 'variant', 'inconclusive'
    
    -- METADATA
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. SIMULATION RESULTS (For Automated Training)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- SIMULATION METADATA
    simulation_batch_id UUID NOT NULL, -- Groups related simulations
    simulation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    simulation_type VARCHAR(50) DEFAULT 'strategy_testing',
    
    -- SIMULATED LEAD PROFILE
    simulated_lead_profile JSONB NOT NULL,
    simulated_personality VARCHAR(50),
    simulated_objections JSONB DEFAULT '[]'::jsonb,
    
    -- STRATEGY TESTED
    strategy_configuration JSONB NOT NULL,
    psychology_principles_used JSONB DEFAULT '[]'::jsonb,
    
    -- SIMULATION RESULTS
    outcome VARCHAR(50) NOT NULL,
    messages_to_outcome INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    objections_handled INTEGER DEFAULT 0,
    success_factors JSONB DEFAULT '[]'::jsonb,
    failure_factors JSONB DEFAULT '[]'::jsonb,
    
    -- LEARNING INSIGHTS
    insights_generated JSONB DEFAULT '{}'::jsonb,
    
    -- METADATA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Conversation outcomes indexes
CREATE INDEX IF NOT EXISTS idx_conversation_outcomes_lead_id ON conversation_outcomes(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_outcomes_outcome_type ON conversation_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_conversation_outcomes_timestamp ON conversation_outcomes(outcome_timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_outcomes_strategies ON conversation_outcomes USING GIN(strategies_used);

-- Strategy performance indexes
CREATE INDEX IF NOT EXISTS idx_strategy_performance_name ON strategy_performance(strategy_name);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_lead_type ON strategy_performance(lead_type);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_success_rate ON strategy_performance(success_rate);

-- A/B testing indexes
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_dates ON ab_tests(start_date, end_date);

-- Simulation results indexes
CREATE INDEX IF NOT EXISTS idx_simulation_results_batch ON simulation_results(simulation_batch_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_outcome ON simulation_results(outcome);
CREATE INDEX IF NOT EXISTS idx_simulation_results_timestamp ON simulation_results(simulation_timestamp);

-- ============================================================================
-- FUNCTIONS FOR AUTOMATED CALCULATIONS
-- ============================================================================

-- Function to update strategy performance metrics
CREATE OR REPLACE FUNCTION update_strategy_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update strategy performance when new outcome is recorded
    INSERT INTO strategy_performance (
        strategy_name, 
        lead_type,
        total_uses,
        successful_outcomes,
        success_rate,
        avg_engagement_score
    )
    SELECT 
        strategy,
        CONCAT(NEW.lead_profile->>'intent', '_', NEW.lead_profile->>'source'),
        1,
        CASE WHEN NEW.outcome_type = 'appointment_booked' THEN 1 ELSE 0 END,
        CASE WHEN NEW.outcome_type = 'appointment_booked' THEN 1.0 ELSE 0.0 END,
        NEW.engagement_score
    FROM jsonb_array_elements_text(NEW.strategies_used) AS strategy
    ON CONFLICT (strategy_name, lead_type) 
    DO UPDATE SET
        total_uses = strategy_performance.total_uses + 1,
        successful_outcomes = strategy_performance.successful_outcomes + 
            CASE WHEN NEW.outcome_type = 'appointment_booked' THEN 1 ELSE 0 END,
        success_rate = (strategy_performance.successful_outcomes + 
            CASE WHEN NEW.outcome_type = 'appointment_booked' THEN 1 ELSE 0 END)::DECIMAL / 
            (strategy_performance.total_uses + 1),
        avg_engagement_score = (strategy_performance.avg_engagement_score * strategy_performance.total_uses + 
            NEW.engagement_score) / (strategy_performance.total_uses + 1),
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update strategy performance
CREATE TRIGGER trigger_update_strategy_performance
    AFTER INSERT ON conversation_outcomes
    FOR EACH ROW
    EXECUTE FUNCTION update_strategy_performance();

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- View for strategy effectiveness summary
CREATE OR REPLACE VIEW strategy_effectiveness_summary AS
SELECT 
    strategy_name,
    SUM(total_uses) as total_uses,
    SUM(successful_outcomes) as total_successes,
    AVG(success_rate) as avg_success_rate,
    AVG(avg_engagement_score) as avg_engagement,
    COUNT(DISTINCT lead_type) as lead_types_tested
FROM strategy_performance
GROUP BY strategy_name
ORDER BY avg_success_rate DESC;

-- View for recent learning insights
CREATE OR REPLACE VIEW recent_learning_insights AS
SELECT 
    co.outcome_type,
    co.strategies_used,
    co.psychology_principles,
    co.engagement_score,
    co.lead_profile,
    co.outcome_timestamp
FROM conversation_outcomes co
WHERE co.outcome_timestamp >= NOW() - INTERVAL '7 days'
ORDER BY co.outcome_timestamp DESC;
