-- Add scraping_sessions table for tracking scraper progress
-- This table tracks scraping sessions for monitoring and resumability

CREATE TABLE IF NOT EXISTS scraping_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session Information
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('local_scraper', 'manual_trigger', 'scheduled', 'test')),
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    triggered_by VARCHAR(100) NOT NULL,
    
    -- Progress Tracking
    projects_processed INTEGER DEFAULT 0,
    projects_updated INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    error_details TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_scraping_sessions_status ON scraping_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scraping_sessions_started_at ON scraping_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_scraping_sessions_session_type ON scraping_sessions(session_type);

-- Add comments for documentation
COMMENT ON TABLE scraping_sessions IS 'Tracks property scraping sessions for monitoring and progress tracking';
COMMENT ON COLUMN scraping_sessions.session_type IS 'Type of scraping session (local_scraper, manual_trigger, scheduled, test)';
COMMENT ON COLUMN scraping_sessions.status IS 'Current status of the scraping session';
COMMENT ON COLUMN scraping_sessions.triggered_by IS 'Who or what triggered this scraping session';
COMMENT ON COLUMN scraping_sessions.projects_processed IS 'Total number of properties processed in this session';
COMMENT ON COLUMN scraping_sessions.projects_updated IS 'Number of properties that were updated (not new)';
COMMENT ON COLUMN scraping_sessions.errors_encountered IS 'Number of errors encountered during scraping';
