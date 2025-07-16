-- ============================================================================
-- QUICK PARTNER API MIGRATION FOR PRODUCTION
-- Run this directly in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ADD MISSING WABA COLUMNS TO AGENTS TABLE
-- ============================================================================

-- Add WABA phone number
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_phone_number VARCHAR(20);

-- Add encrypted Gupshup API key
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gupshup_api_key_encrypted TEXT;

-- Add Gupshup app ID (from Partner API)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gupshup_app_id VARCHAR(255);

-- Add WABA display name
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_display_name VARCHAR(255);

-- Add bot name (customizable per agent)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS bot_name VARCHAR(100) DEFAULT 'Doro';

-- Add password hash for agent authentication
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add role for agent permissions
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'agent';

-- Add organization ID for multi-org support
ALTER TABLE agents ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add Partner API specific fields
ALTER TABLE agents ADD COLUMN IF NOT EXISTS partner_app_created BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS partner_app_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_status VARCHAR(50) DEFAULT 'pending';

-- Add check constraint for waba_status (only if column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'waba_status') THEN
        ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_waba_status_check;
        ALTER TABLE agents ADD CONSTRAINT agents_waba_status_check CHECK (waba_status IN ('pending', 'active', 'suspended', 'error'));
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE WABA TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS waba_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    template_id VARCHAR(255), -- Gupshup template ID after approval
    template_category VARCHAR(50) DEFAULT 'UTILITY',
    template_content TEXT NOT NULL,
    template_params JSONB DEFAULT '[]'::jsonb,
    language_code VARCHAR(10) DEFAULT 'en',
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Approval tracking
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Template metadata
    template_type VARCHAR(50) DEFAULT 'standard',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, template_name)
);

-- Add check constraints for waba_templates
ALTER TABLE waba_templates DROP CONSTRAINT IF EXISTS waba_templates_template_category_check;
ALTER TABLE waba_templates ADD CONSTRAINT waba_templates_template_category_check 
CHECK (template_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION'));

ALTER TABLE waba_templates DROP CONSTRAINT IF EXISTS waba_templates_status_check;
ALTER TABLE waba_templates ADD CONSTRAINT waba_templates_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'submitted'));

-- ============================================================================
-- 3. CREATE TEMPLATE USAGE LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'sent',
    gupshup_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for template_usage_log
ALTER TABLE template_usage_log DROP CONSTRAINT IF EXISTS template_usage_log_status_check;
ALTER TABLE template_usage_log ADD CONSTRAINT template_usage_log_status_check 
CHECK (status IN ('sent', 'delivered', 'read', 'failed'));

-- ============================================================================
-- 4. CREATE PARTNER API TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_encrypted TEXT NOT NULL,
    token_iv VARCHAR(255) NOT NULL,
    token_tag VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. CREATE ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    partner_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for organizations
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check 
CHECK (status IN ('active', 'inactive', 'suspended'));

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- WABA templates indexes
CREATE INDEX IF NOT EXISTS idx_waba_templates_agent_id ON waba_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_waba_templates_status ON waba_templates(status);
CREATE INDEX IF NOT EXISTS idx_waba_templates_type ON waba_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_waba_templates_category ON waba_templates(template_category);

-- Template usage log indexes
CREATE INDEX IF NOT EXISTS idx_template_usage_log_phone ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_agent ON template_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_status ON template_usage_log(status);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_created ON template_usage_log(created_at);

-- Agents WABA indexes
CREATE INDEX IF NOT EXISTS idx_agents_waba_phone ON agents(waba_phone_number);
CREATE INDEX IF NOT EXISTS idx_agents_app_id ON agents(gupshup_app_id);
CREATE INDEX IF NOT EXISTS idx_agents_waba_status ON agents(waba_status);
CREATE INDEX IF NOT EXISTS idx_agents_organization ON agents(organization_id);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- ============================================================================
-- 7. ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add organization foreign key if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agents_organization_id_fkey' 
        AND table_name = 'agents'
    ) THEN
        ALTER TABLE agents ADD CONSTRAINT agents_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- ============================================================================
-- 8. CREATE TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Update triggers for new tables
DROP TRIGGER IF EXISTS update_waba_templates_updated_at ON waba_templates;
CREATE TRIGGER update_waba_templates_updated_at 
    BEFORE UPDATE ON waba_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_template_usage_log_updated_at ON template_usage_log;
CREATE TRIGGER update_template_usage_log_updated_at 
    BEFORE UPDATE ON template_usage_log 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. INSERT DEFAULT ORGANIZATION
-- ============================================================================

INSERT INTO organizations (id, name, status)
SELECT 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid, 'Default Organization', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid);

-- ============================================================================
-- 10. UPDATE EXISTING AGENTS WITH DEFAULT VALUES
-- ============================================================================

-- Set default organization for existing agents without one
UPDATE agents 
SET organization_id = 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid
WHERE organization_id IS NULL;

-- Set default bot names for existing agents
UPDATE agents 
SET bot_name = 'Doro'
WHERE bot_name IS NULL;

-- Set default role for existing agents
UPDATE agents 
SET role = 'agent'
WHERE role IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Partner API migration completed successfully!' as result;
