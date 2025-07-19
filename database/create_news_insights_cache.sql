-- News Insights Cache Table
-- Stores cached news insights to avoid repeated API calls

CREATE TABLE IF NOT EXISTS news_insights_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  insights JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_insights_cache_lead_id ON news_insights_cache(lead_id);
CREATE INDEX IF NOT EXISTS idx_news_insights_cache_expires_at ON news_insights_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_news_insights_cache_cached_at ON news_insights_cache(cached_at);

-- Unique constraint to prevent duplicate cache entries per lead
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_insights_cache_unique_lead 
ON news_insights_cache(lead_id);

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_news_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM news_insights_cache 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run every hour
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-news-cache', '0 * * * *', 'SELECT cleanup_expired_news_cache();');

-- Manual cleanup can be run with:
-- SELECT cleanup_expired_news_cache();

-- Add RLS policies if needed
ALTER TABLE news_insights_cache ENABLE ROW LEVEL SECURITY;

-- Policy to allow agents to access their own leads' cache
CREATE POLICY news_insights_cache_agent_access ON news_insights_cache
  FOR ALL USING (
    lead_id IN (
      SELECT id FROM leads 
      WHERE assigned_agent_id = auth.uid()::text
    )
  );

-- Policy for admin access
CREATE POLICY news_insights_cache_admin_access ON news_insights_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE id = auth.uid()::text 
      AND role = 'admin'
    )
  );

COMMENT ON TABLE news_insights_cache IS 'Caches news insights for leads to avoid repeated API calls';
COMMENT ON COLUMN news_insights_cache.insights IS 'JSON array of news insights with relevance scores';
COMMENT ON COLUMN news_insights_cache.expires_at IS 'When this cache entry expires (typically 2 hours)';
