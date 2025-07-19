-- Super-Intelligent Follow-Up System Database Schema
-- Run this in your Supabase SQL Editor

-- 1. News Insights Cache Table
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

-- 2. Conversation Memory Table (enhance existing table)
-- First, add missing columns if they don't exist
DO $$
BEGIN
  -- Add memory_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'conversation_memory' AND column_name = 'memory_type') THEN
    ALTER TABLE conversation_memory ADD COLUMN memory_type VARCHAR(50) DEFAULT 'insight';
  END IF;

  -- Add confidence_score column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'conversation_memory' AND column_name = 'confidence_score') THEN
    ALTER TABLE conversation_memory ADD COLUMN confidence_score DECIMAL(3,2) DEFAULT 0.0;
  END IF;
END $$;

-- Indexes for conversation memory
CREATE INDEX IF NOT EXISTS idx_conversation_memory_lead_id ON conversation_memory(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_type ON conversation_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_created_at ON conversation_memory(created_at);

-- 3. Intelligence Research Log (for tracking and optimization)
CREATE TABLE IF NOT EXISTS intelligence_research_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,
  research_type VARCHAR(50) NOT NULL, -- 'area_intelligence', 'market_analysis', etc.
  search_query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  cost_estimate DECIMAL(10,4) DEFAULT 0.0,
  processing_time_ms INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT false,
  insights_generated JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for research log
CREATE INDEX IF NOT EXISTS idx_intelligence_research_lead_id ON intelligence_research_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_research_agent_id ON intelligence_research_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_research_type ON intelligence_research_log(research_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_research_created_at ON intelligence_research_log(created_at);

-- 4. Auto-cleanup function for expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_news_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM news_insights_cache 
  WHERE expires_at < NOW();
  
  -- Also cleanup old research logs (keep last 30 days)
  DELETE FROM intelligence_research_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get lead conversation summary
CREATE OR REPLACE FUNCTION get_lead_conversation_summary(lead_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  summary JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_messages', COUNT(*),
    'conversation_span_days', EXTRACT(DAY FROM (MAX(created_at) - MIN(created_at))),
    'last_message_date', MAX(created_at),
    'user_message_count', COUNT(*) FILTER (WHERE sender = 'user'),
    'bot_message_count', COUNT(*) FILTER (WHERE sender = 'bot'),
    'response_rate', CASE 
      WHEN COUNT(*) FILTER (WHERE sender = 'bot') > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE sender = 'user')::DECIMAL / COUNT(*) FILTER (WHERE sender = 'bot')), 2)
      ELSE 0 
    END
  ) INTO summary
  FROM messages 
  WHERE lead_id = lead_uuid;
  
  RETURN summary;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS Policies (if RLS is enabled) - handle existing policies
DO $$
BEGIN
  -- Enable RLS only if not already enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'news_insights_cache' AND relrowsecurity = true) THEN
    ALTER TABLE news_insights_cache ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'conversation_memory' AND relrowsecurity = true) THEN
    ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'intelligence_research_log' AND relrowsecurity = true) THEN
    ALTER TABLE intelligence_research_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy to allow agents to access their own leads' data (create if not exists)
DO $$
BEGIN
  -- Create policies only if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'news_insights_cache_agent_access') THEN
    EXECUTE 'CREATE POLICY news_insights_cache_agent_access ON news_insights_cache
      FOR ALL USING (
        lead_id IN (
          SELECT id FROM leads
          WHERE assigned_agent_id = auth.uid()::text
        )
      )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversation_memory_agent_access') THEN
    EXECUTE 'CREATE POLICY conversation_memory_agent_access ON conversation_memory
      FOR ALL USING (
        lead_id IN (
          SELECT id FROM leads
          WHERE assigned_agent_id = auth.uid()::text
        )
      )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_research_agent_access') THEN
    EXECUTE 'CREATE POLICY intelligence_research_agent_access ON intelligence_research_log
      FOR ALL USING (
        agent_id = auth.uid()::text OR
        lead_id IN (
          SELECT id FROM leads
          WHERE assigned_agent_id = auth.uid()::text
        )
      )';
  END IF;
END $$;

-- Policy for admin access (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'news_insights_cache_admin_access') THEN
    EXECUTE 'CREATE POLICY news_insights_cache_admin_access ON news_insights_cache
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM agents
          WHERE id = auth.uid()::text
          AND role = ''admin''
        )
      )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversation_memory_admin_access') THEN
    EXECUTE 'CREATE POLICY conversation_memory_admin_access ON conversation_memory
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM agents
          WHERE id = auth.uid()::text
          AND role = ''admin''
        )
      )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_research_admin_access') THEN
    EXECUTE 'CREATE POLICY intelligence_research_admin_access ON intelligence_research_log
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM agents
          WHERE id = auth.uid()::text
          AND role = ''admin''
        )
      )';
  END IF;
END $$;

-- 7. Comments for documentation
COMMENT ON TABLE news_insights_cache IS 'Caches news insights for leads to avoid repeated API calls';
COMMENT ON COLUMN news_insights_cache.insights IS 'JSON array of news insights with relevance scores';
COMMENT ON COLUMN news_insights_cache.expires_at IS 'When this cache entry expires (typically 2 hours)';

COMMENT ON TABLE conversation_memory IS 'Stores AI-extracted insights and summaries from conversations';
COMMENT ON COLUMN conversation_memory.memory_type IS 'Type of memory: summary, milestone, insight';
COMMENT ON COLUMN conversation_memory.content IS 'JSON content of the memory';

COMMENT ON TABLE intelligence_research_log IS 'Logs all intelligence research activities for optimization';
COMMENT ON COLUMN intelligence_research_log.research_type IS 'Type of research performed';
COMMENT ON COLUMN intelligence_research_log.insights_generated IS 'JSON of insights generated from research';

-- 8. Sample data for testing (optional)
-- INSERT INTO conversation_memory (lead_id, memory_type, content, confidence_score) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'summary', '{"interests": ["schools", "transport"], "concerns": ["budget"]}', 0.85);

-- Success message
SELECT 'Super-Intelligent Follow-Up System database schema created successfully!' as status;
