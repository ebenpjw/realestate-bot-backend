-- Message Campaigns Database Schema
-- Run this in your Supabase SQL Editor to add message campaign tracking

-- 1. Create message_campaigns table for bulk messaging tracking
CREATE TABLE IF NOT EXISTS message_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    template_id VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    campaign_name VARCHAR(255),
    
    -- Campaign metrics
    total_recipients INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    
    -- Campaign status
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, paused
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_details JSONB,
    
    -- Indexes for performance
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused'))
);

-- Create indexes for message_campaigns
CREATE INDEX IF NOT EXISTS idx_message_campaigns_agent_id ON message_campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_created_at ON message_campaigns(created_at DESC);

-- 2. Add new columns to existing messages table for enhanced tracking
-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add template_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'template_id') THEN
        ALTER TABLE messages ADD COLUMN template_id VARCHAR(255);
    END IF;
    
    -- Add template_params column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'template_params') THEN
        ALTER TABLE messages ADD COLUMN template_params JSONB;
    END IF;
    
    -- Add campaign_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'campaign_id') THEN
        ALTER TABLE messages ADD COLUMN campaign_id UUID REFERENCES message_campaigns(id) ON DELETE SET NULL;
    END IF;
    
    -- Add external_message_id column if it doesn't exist (for Gupshup message ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'external_message_id') THEN
        ALTER TABLE messages ADD COLUMN external_message_id VARCHAR(255);
    END IF;
    
    -- Add delivery_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'delivery_status') THEN
        ALTER TABLE messages ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'sent';
    END IF;
    
    -- Add error_message column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'error_message') THEN
        ALTER TABLE messages ADD COLUMN error_message TEXT;
    END IF;
    
    -- Add message_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) DEFAULT 'text';
    END IF;
END $$;

-- Create additional indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_template_id ON messages(template_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_message_id ON messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

-- 3. Create RLS (Row Level Security) policies for message_campaigns
ALTER TABLE message_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can only see their own campaigns
CREATE POLICY IF NOT EXISTS "Agents can view own campaigns" ON message_campaigns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = message_campaigns.agent_id 
            AND agents.id = auth.uid()::uuid
        )
    );

-- Policy: Agents can create campaigns for themselves
CREATE POLICY IF NOT EXISTS "Agents can create own campaigns" ON message_campaigns
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = message_campaigns.agent_id 
            AND agents.id = auth.uid()::uuid
        )
    );

-- Policy: Agents can update their own campaigns
CREATE POLICY IF NOT EXISTS "Agents can update own campaigns" ON message_campaigns
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = message_campaigns.agent_id 
            AND agents.id = auth.uid()::uuid
        )
    );

-- Policy: Admins can see all campaigns
CREATE POLICY IF NOT EXISTS "Admins can view all campaigns" ON message_campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = auth.uid()::uuid 
            AND agents.role = 'admin'
        )
    );

-- 4. Create useful views for reporting

-- Campaign summary view
CREATE OR REPLACE VIEW campaign_summary AS
SELECT 
    mc.id,
    mc.agent_id,
    a.full_name as agent_name,
    mc.campaign_name,
    mc.template_name,
    mc.total_recipients,
    mc.messages_sent,
    mc.messages_delivered,
    mc.messages_failed,
    mc.status,
    mc.created_at,
    mc.completed_at,
    CASE 
        WHEN mc.total_recipients > 0 
        THEN ROUND((mc.messages_sent::decimal / mc.total_recipients::decimal) * 100, 2)
        ELSE 0 
    END as completion_percentage,
    CASE 
        WHEN mc.messages_sent > 0 
        THEN ROUND((mc.messages_delivered::decimal / mc.messages_sent::decimal) * 100, 2)
        ELSE 0 
    END as delivery_rate
FROM message_campaigns mc
JOIN agents a ON mc.agent_id = a.id;

-- Message analytics view
CREATE OR REPLACE VIEW message_analytics AS
SELECT 
    DATE(m.created_at) as message_date,
    m.lead_id,
    l.assigned_agent_id as agent_id,
    a.full_name as agent_name,
    m.message_type,
    m.template_id,
    m.delivery_status,
    m.campaign_id,
    mc.campaign_name,
    COUNT(*) as message_count
FROM messages m
LEFT JOIN leads l ON m.lead_id = l.id
LEFT JOIN agents a ON l.assigned_agent_id = a.id
LEFT JOIN message_campaigns mc ON m.campaign_id = mc.id
WHERE m.sender = 'agent'
GROUP BY 
    DATE(m.created_at),
    m.lead_id,
    l.assigned_agent_id,
    a.full_name,
    m.message_type,
    m.template_id,
    m.delivery_status,
    m.campaign_id,
    mc.campaign_name;

-- 5. Create functions for campaign management

-- Function to update campaign delivery stats from webhook data
CREATE OR REPLACE FUNCTION update_campaign_delivery_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update campaign delivery count when message delivery status changes to 'delivered'
    IF NEW.delivery_status = 'delivered' AND OLD.delivery_status != 'delivered' AND NEW.campaign_id IS NOT NULL THEN
        UPDATE message_campaigns 
        SET messages_delivered = messages_delivered + 1,
            updated_at = NOW()
        WHERE id = NEW.campaign_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic campaign stats updates
DROP TRIGGER IF EXISTS trigger_update_campaign_delivery_stats ON messages;
CREATE TRIGGER trigger_update_campaign_delivery_stats
    AFTER UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_delivery_stats();

-- 6. Add comments for documentation
COMMENT ON TABLE message_campaigns IS 'Tracks bulk messaging campaigns with status and metrics';
COMMENT ON COLUMN message_campaigns.agent_id IS 'Agent who created the campaign';
COMMENT ON COLUMN message_campaigns.template_id IS 'Gupshup template ID used for the campaign';
COMMENT ON COLUMN message_campaigns.template_name IS 'Human-readable template name';
COMMENT ON COLUMN message_campaigns.campaign_name IS 'User-defined campaign name';
COMMENT ON COLUMN message_campaigns.total_recipients IS 'Total number of intended recipients';
COMMENT ON COLUMN message_campaigns.messages_sent IS 'Number of messages successfully sent';
COMMENT ON COLUMN message_campaigns.messages_delivered IS 'Number of messages delivered (from webhooks)';
COMMENT ON COLUMN message_campaigns.messages_failed IS 'Number of messages that failed to send';
COMMENT ON COLUMN message_campaigns.status IS 'Campaign status: pending, in_progress, completed, failed, paused';
COMMENT ON COLUMN message_campaigns.error_details IS 'JSON object containing error details for failed campaigns';

COMMENT ON VIEW campaign_summary IS 'Summary view of campaigns with calculated metrics';
COMMENT ON VIEW message_analytics IS 'Analytics view for message reporting and insights';

-- Success message
SELECT 'Message campaigns database schema created successfully!' as status,
       'Tables: message_campaigns' as tables_created,
       'Enhanced: messages table with new columns' as tables_enhanced,
       'Views: campaign_summary, message_analytics' as views_created,
       'RLS policies and triggers enabled' as security_features;
